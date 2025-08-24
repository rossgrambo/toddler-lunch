// Google Sheets API Integration with Google Identity Services (GIS) and API Key Support
class GoogleSheetsAPI {
    constructor() {
        this.isInitialized = false;
        this.isSignedIn = false;
        this.accessToken = null;
        this.tokenClient = null;
        this.authMethod = null; // 'oauth' or 'apikey'
        this.apiKey = null;
    }

    async initialize() {
        try {
            // Check if we have an API key first
            const storedApiKey = StorageHelper.loadApiKey();
            if (storedApiKey) {
                console.log('API key found, initializing with API key authentication');
                return await this.initializeWithApiKey(storedApiKey);
            }
            
            // Fall back to OAuth initialization
            console.log('No API key found, initializing with OAuth');
            return await this.initializeWithOAuth();
            
        } catch (error) {
            console.error('Error initializing Google Sheets API:', error);
            throw error;
        }
    }
    
    async initializeWithApiKey(apiKey) {
        try {
            // Check if required libraries are loaded
            if (typeof gapi === 'undefined') {
                throw new Error('Google API library not loaded');
            }
            
            // Initialize the Google API client with API key
            await new Promise((resolve, reject) => {
                gapi.load('client', async () => {
                    try {
                        await gapi.client.init({
                            apiKey: apiKey,
                            discoveryDocs: [CONFIG.DISCOVERY_DOC],
                        });
                        console.log('Google API client initialized with API key');
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            this.apiKey = apiKey;
            this.authMethod = 'apikey';
            this.isSignedIn = true;
            this.isInitialized = true;
            
            console.log('Google Sheets API initialized successfully with API key');
            return true;
            
        } catch (error) {
            console.error('Error initializing with API key:', error);
            // If API key fails, clear it and fall back to OAuth
            StorageHelper.clearApiKey();
            throw new Error('Invalid API key. Please check your API key or use OAuth authentication.');
        }
    }
    
    async initializeWithOAuth() {
        try {
            // Check if required libraries are loaded
            if (typeof gapi === 'undefined') {
                throw new Error('Google API library not loaded');
            }
            
            // Wait for Google Identity Services to load
            await this.waitForGoogleIdentityServices();

            // Initialize the Google API client
            await new Promise((resolve, reject) => {
                gapi.load('client', async () => {
                    try {
                        await gapi.client.init({
                            discoveryDocs: [CONFIG.DISCOVERY_DOC],
                        });
                        console.log('Google API client initialized');
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            // Initialize the Google Identity Services token client
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CONFIG.OAUTH_CLIENT_ID,
                scope: CONFIG.SCOPES,
                callback: (response) => {
                    if (response.access_token) {
                        this.accessToken = response.access_token;
                        gapi.client.setToken({ access_token: response.access_token });
                        this.isSignedIn = true;
                        this.authMethod = 'oauth';
                        
                        // Save token if stay logged in is enabled
                        if (StorageHelper.loadStayLoggedInPreference()) {
                            const expiresIn = response.expires_in || 3600;
                            StorageHelper.saveAccessToken(response.access_token, expiresIn);
                        }
                        
                        console.log('Successfully authenticated with Google Identity Services');
                    }
                },
            });

            this.authMethod = 'oauth';
            this.isInitialized = true;
            console.log('Google Sheets API initialized successfully with OAuth');
            
            // Try to restore session if stay logged in is enabled
            await this.tryRestoreSession();
            
        } catch (error) {
            console.error('Error initializing Google Sheets API with OAuth:', error);
            throw error;
        }
    }

    async waitForGoogleIdentityServices(maxAttempts = 50) {
        try {
            // Use the promise created in index.html
            if (window.googleIdentityServicesLoaded) {
                await window.googleIdentityServicesLoaded;
                return;
            }
        } catch (error) {
            console.error('Promise-based loading failed:', error);
        }
        
        // Fallback to polling method
        for (let i = 0; i < maxAttempts; i++) {
            if (typeof google !== 'undefined' && 
                google.accounts && 
                google.accounts.oauth2 && 
                google.accounts.oauth2.initTokenClient) {
                return;
            }
            
            // Wait 100ms before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error('Google Identity Services library failed to load within timeout period');
    }

    async tryRestoreSession() {
        // Only try to restore if stay logged in is enabled and we're using OAuth
        if (this.authMethod !== 'oauth' || !StorageHelper.loadStayLoggedInPreference()) {
            console.log('Skipping session restore (not OAuth or stay logged in disabled)');
            return false;
        }

        const storedToken = StorageHelper.loadAccessToken();
        if (!storedToken) {
            console.log('No stored access token found');
            return false;
        }

        try {
            // Set the token and test if it's still valid
            this.accessToken = storedToken;
            gapi.client.setToken({ access_token: storedToken });
            
            // Test the token by making a simple API call to check token validity
            // We'll use the drive API to get user info since it's more lightweight
            const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + storedToken);
            
            if (!response.ok) {
                throw new Error('Token validation failed');
            }
            
            const tokenInfo = await response.json();
            
            // Check if token has the required scopes
            if (!tokenInfo.scope || !tokenInfo.scope.includes('https://www.googleapis.com/auth/spreadsheets')) {
                throw new Error('Token missing required scopes');
            }
            
            // If we reach here, the token is valid
            this.isSignedIn = true;
            console.log('Successfully restored session from stored token');
            return true;
            
        } catch (error) {
            console.log('Stored access token is invalid or expired:', error.message);
            StorageHelper.clearAccessToken();
            this.accessToken = null;
            gapi.client.setToken(null);
            this.isSignedIn = false;
            return false;
        }
    }

    async authenticateWithApiKey(apiKey) {
        try {
            console.log('Attempting to authenticate with API key');
            
            // Test the API key by making a simple request to the Sheets API
            // We'll try to access a public spreadsheet first as a validation
            const testResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/values/Class%20Data!A1:E1?key=${apiKey}`);
            
            if (!testResponse.ok) {
                const errorData = await testResponse.json().catch(() => ({}));
                if (testResponse.status === 403) {
                    throw new Error('API key is valid but may not have sufficient permissions for Google Sheets API');
                } else if (testResponse.status === 400) {
                    throw new Error('Invalid API key format');
                } else {
                    throw new Error(`API key validation failed: ${errorData.error?.message || 'Unknown error'}`);
                }
            }
            
            // Save the API key
            StorageHelper.saveApiKey(apiKey);
            
            // Reinitialize with the API key
            await this.initializeWithApiKey(apiKey);
            
            console.log('Successfully authenticated with API key');
            return true;
            
        } catch (error) {
            console.error('API key authentication failed:', error);
            throw new Error(error.message || 'Invalid API key. Please check your API key and try again.');
        }
    }

    async signIn() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (this.isSignedIn) {
            return true;
        }

        // If we have an API key, we should already be signed in
        if (this.authMethod === 'apikey') {
            console.log('Already authenticated with API key');
            return true;
        }

        // OAuth sign in
        try {
            // Request access token
            return new Promise((resolve, reject) => {
                this.tokenClient.callback = (response) => {
                    if (response.error) {
                        reject(new Error(response.error));
                        return;
                    }
                    
                    if (response.access_token) {
                        this.accessToken = response.access_token;
                        gapi.client.setToken({ access_token: response.access_token });
                        this.isSignedIn = true;
                        this.authMethod = 'oauth';
                        
                        // Save token if stay logged in is enabled
                        if (StorageHelper.loadStayLoggedInPreference()) {
                            const expiresIn = response.expires_in || 3600;
                            StorageHelper.saveAccessToken(response.access_token, expiresIn);
                        }
                        
                        console.log('Successfully signed in');
                        resolve(true);
                    } else {
                        reject(new Error('No access token received'));
                    }
                };
                
                this.tokenClient.requestAccessToken();
            });
            
        } catch (error) {
            console.error('Sign in failed:', error);
            throw new Error('Failed to sign in to Google account');
        }
    }

    async signOut() {
        if (this.authMethod === 'oauth' && this.accessToken) {
            google.accounts.oauth2.revoke(this.accessToken);
            this.accessToken = null;
            gapi.client.setToken(null);
            StorageHelper.clearAccessToken();
        } else if (this.authMethod === 'apikey') {
            this.apiKey = null;
            StorageHelper.clearApiKey();
        }
        
        this.isSignedIn = false;
        this.authMethod = null;
        
        console.log('Successfully signed out');
    }

    getAuthMethod() {
        return this.authMethod;
    }

    isUserSignedIn() {
        return this.isSignedIn && this.accessToken;
    }

    async ensureSignedIn() {
        if (!this.isUserSignedIn()) {
            if (this.authMethod === 'apikey') {
                throw new Error('API key authentication failed. Please check your API key.');
            }
            await this.signIn();
        }
    }

    async createSpreadsheet() {
        await this.ensureSignedIn();

        try {
            console.log('Creating new spreadsheet with name:', CONFIG.DEFAULT_SPREADSHEET_NAME);
            
            // Create the spreadsheet
            const response = await gapi.client.sheets.spreadsheets.create({
                properties: {
                    title: CONFIG.DEFAULT_SPREADSHEET_NAME
                },
                sheets: Object.keys(CONFIG.SHEETS).map(key => ({
                    properties: {
                        title: CONFIG.SHEETS[key]
                    }
                }))
            });

            const spreadsheetId = response.result.spreadsheetId;
            console.log('Created new spreadsheet with ID:', spreadsheetId);

            // Store the spreadsheet ID and name
            CONFIG.SPREADSHEET_ID = spreadsheetId;
            StorageHelper.saveSpreadsheetId(spreadsheetId);
            StorageHelper.saveSpreadsheetName(CONFIG.DEFAULT_SPREADSHEET_NAME);

            // Initialize sheets with dummy data
            await this.initializeSheetsWithDummyData();

            return spreadsheetId;
        } catch (error) {
            console.error('Error creating spreadsheet:', error);
            throw new Error('Failed to create spreadsheet');
        }
    }

    async initializeSheetsWithDummyData() {
        try {
            console.log('Initializing sheets with dummy data...');
            
            // Initialize each sheet with its dummy data
            for (const [sheetKey, dummyData] of Object.entries(CONFIG.DUMMY_DATA)) {
                const sheetName = CONFIG.SHEETS[sheetKey];
                console.log(`Initializing ${sheetName} with dummy data...`);
                
                await this.writeRange(sheetName, 'A1', dummyData);
            }
            
            console.log('All sheets initialized with dummy data');
        } catch (error) {
            console.error('Error initializing sheets with dummy data:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            await this.ensureSignedIn();
            
            if (!CONFIG.SPREADSHEET_ID) {
                throw new Error('No spreadsheet ID configured');
            }

            console.log('Testing Google Sheets connection...');
            
            const response = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                fields: 'properties.title,sheets.properties.title'
            });
            
            const title = response.result.properties.title;
            console.log('Connection test successful. Spreadsheet title:', title);
            
            // Store the name for reference
            StorageHelper.saveSpreadsheetName(title);
            
            return true;
        } catch (error) {
            console.error('Connection test failed:', error);
            
            if (error.status === 403) {
                throw new Error('No permission to access this spreadsheet. Please check the spreadsheet ID or create a new one.');
            } else if (error.status === 404) {
                throw new Error('Spreadsheet not found. It may have been deleted or the ID is incorrect.');
            } else {
                throw new Error(`Failed to connect to Google Sheets: ${error.message}`);
            }
        }
    }

    async findSpreadsheetByName(spreadsheetName) {
        try {
            console.log(`Searching for spreadsheet with name: "${spreadsheetName}"`);
            
            // Use Google Drive API to search for spreadsheets with the specified name
            // Include modifiedTime to sort by most recent
            const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(spreadsheetName)}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            
            if (!response.ok) {
                console.error('Drive API search failed:', response.status, response.statusText);
                return null;
            }
            
            const data = await response.json();
            
            if (data.files && data.files.length > 0) {
                // Check each spreadsheet to see if it has the correct structure
                for (const file of data.files) {
                    console.log(`Checking spreadsheet: ${file.name} (ID: ${file.id})`);
                    
                    // Verify this spreadsheet has the expected sheets
                    if (await this.verifySpreadsheetStructure(file.id)) {
                        console.log(`Found valid spreadsheet: ${file.name} (ID: ${file.id})`);
                        return {
                            id: file.id,
                            name: file.name
                        };
                    } else {
                        console.log(`Spreadsheet ${file.name} doesn't have the expected structure, skipping...`);
                    }
                }
                
                console.log(`Found ${data.files.length} spreadsheet(s) with name "${spreadsheetName}" but none have the correct structure`);
                return null;
            } else {
                console.log(`No spreadsheet found with name: "${spreadsheetName}"`);
                return null;
            }
        } catch (error) {
            console.error('Error searching for spreadsheet by name:', error);
            return null;
        }
    }

    async verifySpreadsheetStructure(spreadsheetId) {
        try {
            // Get the spreadsheet metadata to check sheet names
            const response = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: spreadsheetId,
                fields: 'sheets.properties.title'
            });
            
            const existingSheetNames = response.result.sheets.map(sheet => sheet.properties.title);
            const expectedSheetNames = Object.values(CONFIG.SHEETS);
            
            // Check if all expected sheets exist
            const hasAllSheets = expectedSheetNames.every(sheetName => 
                existingSheetNames.includes(sheetName)
            );
            
            if (hasAllSheets) {
                console.log(`Spreadsheet ${spreadsheetId} has all expected sheets:`, expectedSheetNames);
                return true;
            } else {
                console.log(`Spreadsheet ${spreadsheetId} missing some sheets. Expected:`, expectedSheetNames, 'Found:', existingSheetNames);
                return false;
            }
        } catch (error) {
            console.error(`Error verifying spreadsheet structure for ${spreadsheetId}:`, error);
            return false;
        }
    }

    async checkOrCreateSpreadsheet() {
        await this.ensureSignedIn();

        // If no spreadsheet ID is configured, try to find existing spreadsheet by name first
        if (!CONFIG.SPREADSHEET_ID) {
            console.log('No spreadsheet ID configured, searching for existing spreadsheet...');
            const existingSpreadsheet = await this.findSpreadsheetByName(CONFIG.DEFAULT_SPREADSHEET_NAME);
            
            if (existingSpreadsheet) {
                console.log('Found existing spreadsheet:', existingSpreadsheet.name, 'ID:', existingSpreadsheet.id);
                CONFIG.SPREADSHEET_ID = existingSpreadsheet.id;
                StorageHelper.saveSpreadsheetId(existingSpreadsheet.id);
                StorageHelper.saveSpreadsheetName(existingSpreadsheet.name);
                return existingSpreadsheet.id;
            } else {
                console.log('No existing spreadsheet found, creating new one...');
                return await this.createSpreadsheet();
            }
        }

        // Try to access the existing spreadsheet
        try {
            await this.testConnection();
            console.log('Existing spreadsheet is accessible');
            return CONFIG.SPREADSHEET_ID;
        } catch (error) {
            console.log('Existing spreadsheet not accessible, searching for spreadsheet by name...');
            
            // Clear the invalid ID from storage
            StorageHelper.clearSpreadsheetId();
            CONFIG.SPREADSHEET_ID = null;
            
            // Try to find existing spreadsheet by name
            const existingSpreadsheet = await this.findSpreadsheetByName(CONFIG.DEFAULT_SPREADSHEET_NAME);
            
            if (existingSpreadsheet) {
                console.log('Found existing spreadsheet:', existingSpreadsheet.name, 'ID:', existingSpreadsheet.id);
                CONFIG.SPREADSHEET_ID = existingSpreadsheet.id;
                StorageHelper.saveSpreadsheetId(existingSpreadsheet.id);
                StorageHelper.saveSpreadsheetName(existingSpreadsheet.name);
                return existingSpreadsheet.id;
            } else {
                console.log('No existing spreadsheet found, creating new one...');
                return await this.createSpreadsheet();
            }
        }
    }

    async readRange(sheetName, range = '') {
        await this.ensureSignedIn();

        try {
            const fullRange = range ? `${sheetName}!${range}` : sheetName;
            console.log(`Reading range: ${fullRange}`);
            
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: fullRange,
            });
            
            return response.result.values || [];
        } catch (error) {
            console.error(`Error reading range ${sheetName}!${range}:`, error);
            throw error;
        }
    }

    async writeRange(sheetName, range, values) {
        await this.ensureSignedIn();

        try {
            const response = await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${sheetName}!${range}`,
                valueInputOption: 'RAW',
                resource: {
                    values: values
                }
            });
            
            return response.result;
        } catch (error) {
            console.error(`Error writing to range ${sheetName}!${range}:`, error);
            throw error;
        }
    }

    async appendRange(sheetName, values) {
        await this.ensureSignedIn();

        try {
            const response = await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: sheetName,
                valueInputOption: 'RAW',
                resource: {
                    values: values
                }
            });
            
            return response.result;
        } catch (error) {
            console.error(`Error appending to ${sheetName}:`, error);
            throw error;
        }
    }

    async clearRange(sheetName, range) {
        await this.ensureSignedIn();

        try {
            const response = await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${sheetName}!${range}`,
            });
            
            return response.result;
        } catch (error) {
            console.error(`Error clearing range ${sheetName}!${range}:`, error);
            throw error;
        }
    }

    // Specific methods for each sheet type
    async getItems() {
        const data = await this.readRange(CONFIG.SHEETS.ITEMS);
        if (data.length === 0) return [];
        
        const headers = data[0];
        return data.slice(1).map(row => {
            const item = {};
            headers.forEach((header, index) => {
                item[header] = row[index] || '';
            });
            return item;
        });
    }

    async getSchedule() {
        const data = await this.readRange(CONFIG.SHEETS.SCHEDULE);
        if (data.length === 0) return [];
        
        const headers = data[0];
        return data.slice(1).map(row => {
            const meal = {};
            headers.forEach((header, index) => {
                meal[header] = row[index] || '';
            });
            return meal;
        });
    }

    async getGroceryList() {
        const data = await this.readRange(CONFIG.SHEETS.GROCERY);
        if (data.length === 0) return [];
        
        // Return just the list of items needed
        return data.slice(1).map(row => row[0]).filter(item => item);
    }

    async getCurrentMeals() {
        const data = await this.readRange(CONFIG.SHEETS.CURRENT);
        if (data.length === 0) return [];
        
        const headers = data[0];
        return data.slice(1).map(row => {
            const meal = {};
            headers.forEach((header, index) => {
                meal[header] = row[index] || '';
            });
            return meal;
        });
    }

    async updateLastUsed(itemName, date) {
        try {
            // Get all items to find the row
            const allData = await this.readRange(CONFIG.SHEETS.ITEMS);
            const headers = allData[0];
            const lastUsedIndex = headers.indexOf('Last Used');
            const itemIndex = headers.indexOf('Item');
            
            if (lastUsedIndex === -1 || itemIndex === -1) {
                throw new Error('Required columns not found in items sheet');
            }

            // Find the item row
            for (let i = 1; i < allData.length; i++) {
                if (allData[i][itemIndex] === itemName) {
                    const rowNumber = i + 1; // 1-indexed
                    const column = String.fromCharCode(65 + lastUsedIndex); // Convert to letter
                    await this.writeRange(CONFIG.SHEETS.ITEMS, `${column}${rowNumber}`, [[date]]);
                    break;
                }
            }
        } catch (error) {
            console.error('Error updating last used date:', error);
            throw error;
        }
    }

    async saveCurrentMeals(meals) {
        try {
            // Clear current sheet first
            await this.clearRange(CONFIG.SHEETS.CURRENT, 'A:Z');
            
            // Prepare data with headers including date and status
            const headers = ['date', 'meal name', 'status', 'item 1', 'item 2', 'item 3', 'item 4'];
            const data = [headers];
            
            const today = getTodayString();
            meals.forEach(meal => {
                const row = [today, meal.name, meal.status || 'pending'];
                
                // Add items (up to 4)
                for (let i = 0; i < 4; i++) {
                    if (i < meal.items.length) {
                        row.push(meal.items[i].Item || meal.items[i].name || meal.items[i]);
                    } else {
                        row.push('');
                    }
                }
                
                data.push(row);
            });
            
            await this.writeRange(CONFIG.SHEETS.CURRENT, 'A1', data);
        } catch (error) {
            console.error('Error saving current meals:', error);
            throw error;
        }
    }

    async moveCurrentToHistory() {
        try {
            const currentMeals = await this.getCurrentMeals();
            if (currentMeals.length === 0) return;

            // Current meals already have date, so we can use them directly
            const historyData = currentMeals.map(meal => {
                const row = [meal.date, meal['meal name']];
                for (let i = 1; i <= 4; i++) {
                    row.push(meal[`item ${i}`] || '');
                }
                return row;
            });

            // Append to history
            await this.appendRange(CONFIG.SHEETS.HISTORY, historyData);
            
            // Clear current
            await this.clearRange(CONFIG.SHEETS.CURRENT, 'A:Z');
        } catch (error) {
            console.error('Error moving current to history:', error);
            throw error;
        }
    }
}

// Create global instance
const sheetsAPI = new GoogleSheetsAPI();
