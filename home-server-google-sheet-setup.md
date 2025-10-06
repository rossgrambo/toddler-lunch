# Home Secrets Server Google Sheets Integration Setup

This guide describes how to integrate another Single Page Application (SPA) with the Home Secrets Server for Google Sheets access. This setup is designed for applications that need simple Google Sheets integration without handling the full OAuth flow themselves.

## Overview

The integration works by:
1. Using an API key for authentication with the Home Secrets Server
2. Calling the `/oauth/google/token` endpoint to get Google access tokens
3. Using those tokens with the Google Sheets API
4. Automatically finding or creating a spreadsheet for the application

## Prerequisites

- Home Secrets Server running and accessible
- Google Cloud Project with Sheets API enabled
- API key configured in the Home Secrets Server

## Implementation Steps

### 1. Configuration Setup

Create a `config.js` file with the following structure:

```javascript
const CONFIG = {
    // Home Secrets Service Configuration
    HOME_SECRETS: {
        // Dynamically match the protocol of the current page
        get BASE_URL() {
            const protocol = window.location.protocol; // 'http:' or 'https:'
            return `${protocol}//localsecrets.rossgrambo.com`;
        }
    },
    
    // Your application's spreadsheet configuration
    SPREADSHEET_ID: null, // Will be set after spreadsheet creation/discovery
    
    // Define your sheet structure
    SHEETS: {
        DATA: 'example-data',
        CONFIG: 'example-config', 
        LOGS: 'example-logs'
    },
    
    // Google Sheets API configuration
    DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
    
    // Default spreadsheet name for auto-creation
    DEFAULT_SPREADSHEET_NAME: 'Example App Data',
    
    // Local storage keys
    STORAGE_KEYS: {
        SPREADSHEET_ID: 'example_app_spreadsheet_id',
        SPREADSHEET_NAME: 'example_app_spreadsheet_name',
        API_KEY: 'example_app_api_key'
    },
    
    // Initial data structure for new spreadsheets
    DUMMY_DATA: {
        DATA: [
            ['ID', 'Name', 'Value', 'Created', 'Modified'],
            ['1', 'Example Item 1', 'Sample Value', '2024-01-01', '2024-01-01'],
            ['2', 'Example Item 2', 'Another Value', '2024-01-01', '2024-01-01']
        ],
        CONFIG: [
            ['Setting', 'Value'],
            ['app_version', '1.0.0'],
            ['last_sync', '2024-01-01']
        ],
        LOGS: [
            ['Timestamp', 'Event', 'Details'],
            ['2024-01-01 12:00:00', 'App Started', 'Initial setup']
        ]
    }
};
```

**Note:** The `BASE_URL` uses a getter function to dynamically match the protocol (http/https) of the current page. This ensures the Home Secrets Server is accessed with the same protocol, avoiding mixed content issues. If your page is served over HTTPS, it will use `https://localsecrets.rossgrambo.com`. If served over HTTP, it will use `http://localsecrets.rossgrambo.com`.

### 2. URL Parameter Handling

The app should support these URL parameters:

- `api-key`: API key for Home Secrets Server authentication
- `sheet`: Spreadsheet ID to use (optional)

Example: `https://yourapp.com?api-key=your-api-key&sheet=1ABC123xyz`

### 3. Storage Helper Implementation

Create a storage helper for managing persistent data:

```javascript
const StorageHelper = {
    // API key management
    saveApiKey(apiKey) {
        try {
            if (apiKey) {
                localStorage.setItem(CONFIG.STORAGE_KEYS.API_KEY, apiKey);
                console.log('API key saved to localStorage');
            } else {
                this.clearApiKey();
            }
        } catch (error) {
            console.warn('Could not save API key to local storage:', error);
        }
    },

    loadApiKey() {
        try {
            return localStorage.getItem(CONFIG.STORAGE_KEYS.API_KEY);
        } catch (error) {
            console.warn('Could not load API key from local storage:', error);
            return null;
        }
    },

    clearApiKey() {
        try {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.API_KEY);
        } catch (error) {
            console.warn('Could not clear API key from local storage:', error);
        }
    },

    // Spreadsheet ID management
    saveSpreadsheetId(spreadsheetId) {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.SPREADSHEET_ID, spreadsheetId);
        } catch (error) {
            console.warn('Could not save spreadsheet ID:', error);
        }
    },
    
    loadSpreadsheetId() {
        try {
            return localStorage.getItem(CONFIG.STORAGE_KEYS.SPREADSHEET_ID);
        } catch (error) {
            console.warn('Could not load spreadsheet ID:', error);
            return null;
        }
    },

    // Get parameters from URL
    getApiKeyFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('api-key');
    },
    
    getSpreadsheetIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('sheet') || urlParams.get('spreadsheet');
    }
};
```

### 4. Home Secrets Client (Simplified)

Create a simplified client that only handles token retrieval:

```javascript
class HomeSecretsClient {
    constructor() {
        this.accessToken = null;
        this.tokenExpiryTime = null;
        this.baseUrl = null;
        this.apiKey = null;
    }

    async initialize(config) {
        this.baseUrl = config.BASE_URL;
        
        // Handle API key from URL and localStorage
        const urlApiKey = StorageHelper.getApiKeyFromUrl();
        const storedApiKey = StorageHelper.loadApiKey();
        
        if (urlApiKey) {
            this.apiKey = urlApiKey;
            StorageHelper.saveApiKey(urlApiKey);
            console.log('API key provided in URL and saved');
        } else if (storedApiKey) {
            this.apiKey = storedApiKey;
            console.log('Using stored API key');
        } else {
            throw new Error('No API key available. Please provide api-key parameter in URL.');
        }
        
        // Check if we can get a valid token
        return await this.checkTokenValidity();
    }

    async checkTokenValidity() {
        try {
            console.log('Checking token validity with Home Secrets service...');
            
            // Build token URL with API key
            const tokenUrl = `${this.baseUrl}/oauth/google/token?api-key=${encodeURIComponent(this.apiKey)}`;
            
            const response = await fetch(tokenUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey
                }
            });
            
            if (response.status === 401 || response.status === 403) {
                throw new Error('API key invalid or token not available');
            }
            
            if (!response.ok) {
                throw new Error(`Token endpoint error: ${response.status}`);
            }
            
            const tokenData = await response.json();
            
            if (tokenData.access_token) {
                this.accessToken = tokenData.access_token;
                
                // Set expiry time
                if (tokenData.expiry) {
                    this.tokenExpiryTime = typeof tokenData.expiry === 'string' 
                        ? new Date(tokenData.expiry).getTime()
                        : tokenData.expiry * 1000;
                } else {
                    this.tokenExpiryTime = Date.now() + (3600 * 1000); // 1 hour default
                }
                
                console.log('Valid token received');
                return true;
            }
            
            throw new Error('No access token in response');
            
        } catch (error) {
            console.error('Error checking token validity:', error);
            throw error;
        }
    }

    isTokenExpired() {
        if (!this.tokenExpiryTime) return true;
        return Date.now() >= this.tokenExpiryTime;
    }

    async getAccessToken() {
        if (!this.accessToken || this.isTokenExpired()) {
            // Try to refresh token
            await this.checkTokenValidity();
        }
        
        if (!this.accessToken) {
            throw new Error('No valid access token available');
        }
        
        return this.accessToken;
    }
}

// Create global instance
const homeSecretsClient = new HomeSecretsClient();
```

### 5. Google Sheets API Wrapper

Create a simplified Google Sheets API wrapper:

```javascript
class GoogleSheetsAPI {
    constructor() {
        this.isInitialized = false;
        this.accessToken = null;
    }

    async initialize() {
        try {
            // Load Google API client
            if (typeof gapi === 'undefined') {
                throw new Error('Google API library not loaded');
            }

            // Initialize Google API client
            await new Promise((resolve, reject) => {
                gapi.load('client', async () => {
                    try {
                        await gapi.client.init({
                            discoveryDocs: [CONFIG.DISCOVERY_DOC],
                        });
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            // Initialize Home Secrets client
            const tokenValid = await homeSecretsClient.initialize(CONFIG.HOME_SECRETS);
            
            if (tokenValid) {
                await this.updateSignInStatus();
                this.isInitialized = true;
                console.log('Google Sheets API initialized successfully');
                return true;
            } else {
                throw new Error('Could not obtain valid access token');
            }
            
        } catch (error) {
            console.error('Error initializing Google Sheets API:', error);
            throw error;
        }
    }

    async updateSignInStatus() {
        try {
            this.accessToken = await homeSecretsClient.getAccessToken();
            gapi.client.setToken({ access_token: this.accessToken });
            console.log('Updated Google API with access token');
        } catch (error) {
            console.error('Error updating sign-in status:', error);
            this.accessToken = null;
            gapi.client.setToken(null);
            throw error;
        }
    }

    isUserSignedIn() {
        return this.isInitialized && this.accessToken && !homeSecretsClient.isTokenExpired();
    }

    // Add your Google Sheets API methods here
    async createSpreadsheet(title) {
        if (!this.isUserSignedIn()) {
            throw new Error('User not signed in');
        }

        try {
            const response = await gapi.client.sheets.spreadsheets.create({
                properties: {
                    title: title
                }
            });
            
            return response.result;
        } catch (error) {
            console.error('Error creating spreadsheet:', error);
            throw error;
        }
    }

    async findSpreadsheetByName(name) {
        if (!this.isUserSignedIn()) {
            throw new Error('User not signed in');
        }

        try {
            // Load Google Drive API if not loaded
            await gapi.client.load('drive', 'v3');
            
            const response = await gapi.client.drive.files.list({
                q: `name='${name}' and mimeType='application/vnd.google-apps.spreadsheet'`,
                fields: 'files(id, name)'
            });
            
            return response.result.files;
        } catch (error) {
            console.error('Error searching for spreadsheet:', error);
            throw error;
        }
    }

    // Add more Google Sheets methods as needed...
}

// Create global instance
const sheetsAPI = new GoogleSheetsAPI();
```

### 6. Spreadsheet Setup Logic

Implement logic to find or create the application's spreadsheet:

```javascript
async function setupSpreadsheet() {
    try {
        // Check if we have a spreadsheet ID from URL or storage
        let spreadsheetId = StorageHelper.getSpreadsheetIdFromUrl() || StorageHelper.loadSpreadsheetId();
        
        if (spreadsheetId) {
            // Verify the spreadsheet exists and we can access it
            try {
                const spreadsheet = await gapi.client.sheets.spreadsheets.get({
                    spreadsheetId: spreadsheetId
                });
                console.log('Using existing spreadsheet:', spreadsheet.result.properties.title);
                CONFIG.SPREADSHEET_ID = spreadsheetId;
                StorageHelper.saveSpreadsheetId(spreadsheetId);
                return spreadsheetId;
            } catch (error) {
                console.warn('Could not access specified spreadsheet, will search/create new one');
                spreadsheetId = null;
            }
        }
        
        // Search for existing spreadsheet by name
        const existingSheets = await sheetsAPI.findSpreadsheetByName(CONFIG.DEFAULT_SPREADSHEET_NAME);
        
        if (existingSheets.length > 0) {
            // Use the first found spreadsheet
            spreadsheetId = existingSheets[0].id;
            console.log('Found existing spreadsheet:', existingSheets[0].name);
            CONFIG.SPREADSHEET_ID = spreadsheetId;
            StorageHelper.saveSpreadsheetId(spreadsheetId);
            return spreadsheetId;
        }
        
        // Create new spreadsheet
        console.log('Creating new spreadsheet...');
        const newSpreadsheet = await sheetsAPI.createSpreadsheet(CONFIG.DEFAULT_SPREADSHEET_NAME);
        spreadsheetId = newSpreadsheet.spreadsheetId;
        
        // Initialize with dummy data
        await initializeSpreadsheetData(spreadsheetId);
        
        CONFIG.SPREADSHEET_ID = spreadsheetId;
        StorageHelper.saveSpreadsheetId(spreadsheetId);
        
        console.log('Created and initialized new spreadsheet:', spreadsheetId);
        return spreadsheetId;
        
    } catch (error) {
        console.error('Error setting up spreadsheet:', error);
        throw error;
    }
}

async function initializeSpreadsheetData(spreadsheetId) {
    try {
        // Create additional sheets and populate with dummy data
        const requests = [];
        
        // Add sheets for each data type (skip the first one as it already exists)
        const sheetNames = Object.values(CONFIG.SHEETS);
        for (let i = 1; i < sheetNames.length; i++) {
            requests.push({
                addSheet: {
                    properties: {
                        title: sheetNames[i]
                    }
                }
            });
        }
        
        // Execute sheet creation
        if (requests.length > 0) {
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: spreadsheetId,
                requests: requests
            });
        }
        
        // Populate each sheet with dummy data
        for (const [key, sheetName] of Object.entries(CONFIG.SHEETS)) {
            if (CONFIG.DUMMY_DATA[key]) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: spreadsheetId,
                    range: `${sheetName}!A1`,
                    valueInputOption: 'RAW',
                    values: CONFIG.DUMMY_DATA[key]
                });
            }
        }
        
        console.log('Spreadsheet initialized with dummy data');
        
    } catch (error) {
        console.error('Error initializing spreadsheet data:', error);
        throw error;
    }
}
```

### 7. Application Initialization

Put it all together in your main app initialization:

```javascript
class ExampleApp {
    constructor() {
        this.isInitialized = false;
    }

    async init() {
        try {
            console.log('Initializing Example App...');
            
            // Check for required libraries
            if (typeof gapi === 'undefined') {
                throw new Error('Google API library not loaded');
            }
            
            // Initialize Google Sheets API with Home Secrets
            await sheetsAPI.initialize();
            
            // Set up or find spreadsheet
            await setupSpreadsheet();
            
            this.isInitialized = true;
            console.log('Example App initialized successfully');
            
            // Your app logic here...
            await this.loadData();
            
        } catch (error) {
            console.error('Error initializing app:', error);
            
            // Show user-friendly error
            this.showError(`Failed to initialize: ${error.message}`);
        }
    }

    async loadData() {
        try {
            // Example: Load data from the example-data sheet
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${CONFIG.SHEETS.DATA}!A:E`
            });
            
            const values = response.result.values;
            console.log('Loaded data:', values);
            
            // Process your data here...
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data from spreadsheet');
        }
    }

    showError(message) {
        // Implement your error display logic
        console.error(message);
        alert(message); // Replace with better UI
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', async () => {
    const app = new ExampleApp();
    await app.init();
});
```

### 8. HTML Setup

Include the necessary libraries in your HTML:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Example App</title>
</head>
<body>
    <div id="app">
        <div id="loading">Loading...</div>
        <div id="error" style="display: none;"></div>
        <div id="content" style="display: none;">
            <!-- Your app content here -->
        </div>
    </div>

    <!-- Google API library -->
    <script src="https://apis.google.com/js/api.js"></script>
    
    <!-- Your app files -->
    <script src="config.js"></script>
    <script src="home-secrets-client.js"></script>
    <script src="google-sheets-api.js"></script>
    <script src="app.js"></script>
</body>
</html>
```

## Usage

1. Set up your Home Secrets Server with Google OAuth configured
2. Get an API key from the Home Secrets Server
3. Access your app with the API key: `https://yourapp.com?api-key=your-api-key`
4. The app will automatically:
   - Save the API key to localStorage for future visits
   - Get a Google access token from the Home Secrets Server
   - Find or create a spreadsheet named "Example App Data"
   - Initialize the spreadsheet with your defined structure

## Error Handling

The implementation includes basic error handling for:
- Missing API key
- Invalid API key
- Network errors
- Google API errors
- Spreadsheet access issues

If the Home Secrets Server returns a 401/403, the app will show an appropriate error message rather than attempting a login flow.

## Security Notes

- API keys are stored in localStorage and sent with each request
- Access tokens are obtained fresh from the Home Secrets Server
- No OAuth flow is handled client-side
- The app fails gracefully if authentication is not available

## Customization

Modify the following for your specific app:
- `CONFIG.SHEETS` - Define your sheet structure
- `CONFIG.DUMMY_DATA` - Set up initial data
- `CONFIG.DEFAULT_SPREADSHEET_NAME` - Set your app's spreadsheet name
- Add your specific Google Sheets API methods to the `GoogleSheetsAPI` class