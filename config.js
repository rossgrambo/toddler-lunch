// Google Sheets API Configuration
// To set up OAuth:
// 1. Go to Google Cloud Console (https://console.cloud.google.com/)
// 2. Create a new project or select existing
// 3. Enable Google Sheets API and Google Drive API
// 4. Create OAuth 2.0 credentials (Web application)
// 5. Add your domain to authorized origins (e.g., http://localhost:8080)
// 6. Replace YOUR_OAUTH_CLIENT_ID with your actual OAuth client ID

const CONFIG = {
    // OAuth 2.0 Client ID (from Google Cloud Console)
    OAUTH_CLIENT_ID: '299407634606-m18r8n1kl084ikurl78snckimfcu13kg.apps.googleusercontent.com',
    
    // Authentication method: now using OAuth 2.0
    AUTH_METHOD: 'oauth',
    
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
    
    // OAuth 2.0 scopes - need Sheets and Drive file creation
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
    
    // Default spreadsheet name for auto-creation
    DEFAULT_SPREADSHEET_NAME: 'Toddler Meal Planner',
    
    // Local storage keys
    STORAGE_KEYS: {
        SPREADSHEET_ID: 'toddler_meal_planner_spreadsheet_id',
        SPREADSHEET_NAME: 'toddler_meal_planner_spreadsheet_name',
        USER_PREFERENCES: 'toddler_meal_planner_preferences',
        STAY_LOGGED_IN: 'toddler_meal_planner_stay_logged_in',
        ACCESS_TOKEN: 'toddler_meal_planner_access_token',
        TOKEN_EXPIRY: 'toddler_meal_planner_token_expiry'
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
            const result = preference === null ? true : preference === 'true'; // Default to true
            console.log('Loading stay logged in preference:', preference, '→', result);
            return result;
        } catch (error) {
            console.warn('Could not load stay logged in preference:', error);
            return true; // Default to true
        }
    },
    
    // Access token storage for stay logged in functionality
    saveAccessToken(token, expiresIn = 3600) {
        try {
            const expiryTime = Date.now() + (expiresIn * 1000); // Convert seconds to milliseconds
            localStorage.setItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN, token);
            localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
        } catch (error) {
            console.warn('Could not save access token:', error);
        }
    },
    
    loadAccessToken() {
        try {
            const token = localStorage.getItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
            const expiryTime = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN_EXPIRY);
            
            if (!token || !expiryTime) {
                return null;
            }
            
            // Check if token has expired
            if (Date.now() >= parseInt(expiryTime)) {
                console.log('Stored access token has expired');
                this.clearAccessToken();
                return null;
            }
            
            return token;
        } catch (error) {
            console.warn('Could not load access token:', error);
            return null;
        }
    },
    
    clearAccessToken() {
        try {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
            localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN_EXPIRY);
        } catch (error) {
            console.warn('Could not clear access token:', error);
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
