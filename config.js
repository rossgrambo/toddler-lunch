// Google Sheets API Configuration
// To set up OAuth:
// 1. Go to Google Cloud Console (https://console.cloud.google.com/)
// 2. Create a new project or select existing
// 3. Enable Google Sheets API and Google Drive API
// 4. Create OAuth 2.0 credentials (Web application)
// 5. Add your domain to authorized origins (e.g., http://localhost:8080)
// 6. Replace YOUR_OAUTH_CLIENT_ID with your actual OAuth client ID

const CONFIG = {
    // Home Secrets Service Configuration
    HOME_SECRETS: {
        // Dynamically match the protocol of the current page
        get BASE_URL() {
            const protocol = window.location.protocol; // 'http:' or 'https:'
            return `${protocol}//localsecrets.rossgrambo.com`;
        },
        // Redirect URI will be dynamically determined based on current URL
        get REDIRECT_URI() {
            // Auto-detect the redirect URI based on current page
            const currentOrigin = window.location.origin;
            const currentPath = window.location.pathname;
            
            if (currentOrigin.includes('github.io')) {
                // GitHub Pages: https://rossgrambo.github.io/toddler-lunch/
                return `${currentOrigin}${currentPath}`;
            } else {
                // Local development: http://localhost:8000/
                return `${currentOrigin}/`;
            }
        }
    },
    
    // Authentication method: using local secret service with OAuth 2.0 + PKCE
    AUTH_METHOD: 'home-secrets',
    
    // Your Google Spreadsheet ID (will be auto-created if it doesn't exist)
    SPREADSHEET_ID: null, // Will be set after spreadsheet creation or user input
    
    // Sheet names as defined in your requirements
    SHEETS: {
        ITEMS: 'items',
        SCHEDULE: 'schedule', 
        GROCERY: 'grocery',
        CURRENT: 'current',
        HISTORY: 'history'
    },
    
    // Discovery document for Google Sheets API
    DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4',
    
    // OAuth 2.0 scopes - need Sheets, Drive file creation, and Drive readonly for file search
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
    
    // Default spreadsheet name for auto-creation
    DEFAULT_SPREADSHEET_NAME: 'Toddler Meal Planner',
    
    // Local storage keys
    STORAGE_KEYS: {
        SPREADSHEET_ID: 'toddler_meal_planner_spreadsheet_id',
        SPREADSHEET_NAME: 'toddler_meal_planner_spreadsheet_name',
        USER_PREFERENCES: 'toddler_meal_planner_preferences',
        STAY_LOGGED_IN: 'toddler_meal_planner_stay_logged_in',
        // Token storage now handled by homeSecretsClient
        HOME_SECRETS_TOKENS: 'home_secrets_tokens',
        API_KEY: 'toddler_meal_planner_api_key'
    },
    
    // Dummy data for initial setup
    DUMMY_DATA: {
        ITEMS: [
            ['Item', 'Carb', 'Protein', 'Fruit', 'Veggie', 'Tags', 'Difficulty', 'Last Used'],
            ['Cheerios', 'y', '', '', '', 'cereal,quick', '1', 'never'],
            ['Banana slices', '', '', 'y', '', 'fresh,finger-food', '1', 'never'],
            ['Scrambled eggs', '', 'y', '', '', 'hot,protein', '2', 'never']
        ],
        SCHEDULE: [
            ['Name', 'Time', 'Carb', 'Protein', 'Fruit', 'Veggie'],
            ['Breakfast', '8:00 AM', 'y', 'y', 'y', ''],
            ['Lunch', '12:00 PM', 'y', 'y', '', 'y'],
            ['Snack', '3:00 PM', '', '', 'y', '']
        ],
        GROCERY: [
            ['Item'],
            ['Milk'],
            ['Bread'],
            ['Apples']
        ],
        CURRENT: [
            ['date', 'meal name', 'status', 'item 1', 'item 2', 'item 3', 'item 4']
        ],
        HISTORY: [
            ['date', 'meal name', 'item 1', 'item 2', 'item 3', 'item 4']
        ]
    }
};

// Helper functions for multi-user support
const StorageHelper = {
    // Helper functions for local storage operations
    saveSpreadsheetId(spreadsheetId) {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.SPREADSHEET_ID, spreadsheetId);
        } catch (error) {
            console.warn('Could not save to local storage:', error);
        }
    },
    
    // Load spreadsheet ID from local storage
    loadSpreadsheetId() {
        try {
            return localStorage.getItem(CONFIG.STORAGE_KEYS.SPREADSHEET_ID);
        } catch (error) {
            console.warn('Could not load from local storage:', error);
            return null;
        }
    },
    
    saveSpreadsheetName(spreadsheetName) {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.SPREADSHEET_NAME, spreadsheetName);
        } catch (error) {
            console.warn('Could not save spreadsheet name to local storage:', error);
        }
    },
    
    // Load spreadsheet name from local storage
    loadSpreadsheetName() {
        try {
            return localStorage.getItem(CONFIG.STORAGE_KEYS.SPREADSHEET_NAME);
        } catch (error) {
            console.warn('Could not load spreadsheet name from local storage:', error);
            return null;
        }
    },
    
    clearSpreadsheetId() {
        try {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.SPREADSHEET_ID);
            localStorage.removeItem(CONFIG.STORAGE_KEYS.SPREADSHEET_NAME);
        } catch (error) {
            console.warn('Could not clear local storage:', error);
        }
    },
    
    // Get spreadsheet ID from URL parameter
    getSpreadsheetIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('sheet') || urlParams.get('spreadsheet');
    },
    
    // Get API key from URL parameter for Home Secrets service
    getApiKeyFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const apiKey = urlParams.get('api-key');
        console.log('StorageHelper.getApiKeyFromUrl() - URL params:', window.location.search);
        console.log('StorageHelper.getApiKeyFromUrl() - All params:', Object.fromEntries(urlParams.entries()));
        console.log('StorageHelper.getApiKeyFromUrl() - API key found:', apiKey);
        return apiKey;
    },
    
    // Generate shareable URL for current spreadsheet
    generateShareableUrl(spreadsheetId) {
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}?sheet=${spreadsheetId}`;
    },
    
    // Stay logged in preferences
    saveStayLoggedInPreference(stayLoggedIn) {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.STAY_LOGGED_IN, stayLoggedIn.toString());
        } catch (error) {
            console.warn('Could not save stay logged in preference:', error);
        }
    },
    
    loadStayLoggedInPreference() {
        try {
            const preference = localStorage.getItem(CONFIG.STORAGE_KEYS.STAY_LOGGED_IN);
            return preference === null ? true : preference === 'true'; // Default to true
        } catch (error) {
            console.warn('Could not load stay logged in preference:', error);
            return true; // Default to true
        }
    },

    // API key storage for Home Secrets service
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
            const apiKey = localStorage.getItem(CONFIG.STORAGE_KEYS.API_KEY);
            console.log('API key loaded from localStorage:', apiKey ? 'Yes' : 'No');
            return apiKey;
        } catch (error) {
            console.warn('Could not load API key from local storage:', error);
            return null;
        }
    },

    clearApiKey() {
        try {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.API_KEY);
            console.log('API key cleared from localStorage');
        } catch (error) {
            console.warn('Could not clear API key from local storage:', error);
        }
    }
};

// Helper function to get today's date in MM/DD/YYYY format
function getTodayString() {
    const today = new Date();
    return (today.getMonth() + 1).toString().padStart(2, '0') + '/' + 
           today.getDate().toString().padStart(2, '0') + '/' + 
           today.getFullYear();
}

// Helper function to format time display
function formatTimeDisplay(timeString) {
    if (!timeString || timeString === 'Time not set' || timeString === 'Time not found') {
        return timeString || 'Time not set';
    }
    
    try {
        // Handle different time formats
        if (timeString.includes(' ')) {
            const [time, period] = timeString.split(' ');
            const [hours, minutes] = time.split(':');
            return `${hours}:${minutes || '00'} ${period}`;
        } else {
            // If no period, assume it's just time
            const [hours, minutes] = timeString.split(':');
            return `${hours}:${minutes || '00'}`;
        }
    } catch (error) {
        console.error('Error formatting time:', error);
        return timeString;
    }
}
