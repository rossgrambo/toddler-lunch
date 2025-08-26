# Silent Re-Authentication Implementation

## Overview
This implementation adds silent re-authentication to prevent token expiration issues in the Toddler Lunch meal planning app. The screen can now sit open continuously without requiring manual re-authentication.

## Features Implemented

### 1. Silent Re-Authentication Setup
- **Automatic token refresh every hour** - Prevents tokens from expiring during long sessions
- **Token expiry monitoring** - Checks token expiry every 10 minutes and refreshes if needed (within 15 minutes of expiration)
- **Graceful fallback** - If silent re-auth fails, the user isn't interrupted with error messages

### 2. Enhanced Token Management
- **Token expiry tracking** - Stores and monitors token expiration times
- **User email hint storage** - Saves user email for improved silent authentication (when possible)
- **Intelligent cleanup** - Properly clears intervals and tokens on sign out or page unload

### 3. User Experience Improvements
- **Visual indicator** - Small green pulsing dot shows when auto re-auth is enabled
- **Stay logged in integration** - Silent re-auth only works when "Stay logged in" is checked
- **Immediate feedback** - Toggling "Stay logged in" immediately enables/disables silent re-auth

## How It Works

### Initialization
1. When user signs in with "Stay logged in" checked:
   - Token and expiry time are saved to localStorage
   - User email is saved as a hint for future silent auth
   - Silent re-auth interval is set up (hourly)
   - Token monitoring interval is set up (every 10 minutes)

### Silent Re-Authentication Process
1. **Hourly trigger**: Every hour, attempt silent re-authentication
2. **Token expiry check**: Every 10 minutes, check if token expires soon (within 15 minutes)
3. **Silent auth attempt**:
   - Use existing Google OAuth2 token client with empty prompt for silent operation
   - If successful, update stored token and expiry time
   - If failed, log the failure but don't interrupt user experience

### Token Expiry Monitoring
- Checks token expiry every 10 minutes
- If token expires within 15 minutes, immediately attempts refresh
- Prevents authentication failures during API calls

## Configuration Options

### Storage Keys (in config.js)
```javascript
STORAGE_KEYS: {
    ACCESS_TOKEN: 'toddler_meal_planner_access_token',
    TOKEN_EXPIRY: 'toddler_meal_planner_token_expiry',
    LAST_SIGNED_IN_EMAIL: 'toddler_meal_planner_last_email',
    STAY_LOGGED_IN: 'toddler_meal_planner_stay_logged_in'
}
```

### Timing Configuration
- **Silent re-auth interval**: 1 hour (60 * 60 * 1000 ms)
- **Token check interval**: 10 minutes (10 * 60 * 1000 ms)
- **Token refresh threshold**: 15 minutes before expiry
- **Silent auth timeout**: 5 seconds

## User Interface

### Auth Status Indicator
When silent re-auth is active, a small indicator appears in the header:
- Green pulsing dot
- Text: "Auto re-auth enabled"
- Only visible when "Stay logged in" is checked and user is signed in

### Stay Logged In Checkbox
Enhanced behavior:
- Immediately enables/disables silent re-auth when toggled
- Clears stored tokens when unchecked for security
- Shows/hides auth status indicator accordingly

## Security Considerations

1. **Token storage**: Tokens are only stored when user explicitly chooses "Stay logged in"
2. **Token validation**: Stored tokens are validated before use
3. **Cleanup on sign out**: All tokens and email hints are cleared when user signs out
4. **Silent failures**: Silent re-auth failures don't expose error details to prevent information leakage
5. **User control**: User can disable auto re-auth by unchecking "Stay logged in"

## Technical Implementation Details

### Key Files Modified
1. **googleSheetsApi.js**: Added silent re-auth methods and token management
2. **app.js**: Integrated silent re-auth with UI and user preferences
3. **config.js**: Added storage helper methods for email hints
4. **index.html**: Added auth status indicator element
5. **styles.css**: Added styling for auth status indicator

### New Methods Added

#### GoogleSheetsAPI class:
- `setupSilentReAuth()` - Sets up the periodic re-authentication
- `attemptSilentReAuth()` - Performs silent token refresh
- `checkAndRefreshToken()` - Monitors token expiry and refreshes when needed
- `clearSilentReAuth()` - Cleanup method for intervals
- `saveUserEmailHint()` - Saves user email for future silent auth

#### StorageHelper:
- `saveLastSignedInEmail(email)` - Store email hint
- `getLastSignedInEmail()` - Retrieve email hint
- `clearLastSignedInEmail()` - Clear email hint

#### MealPlanningApp:
- `showSilentAuthIndicator()` - Show auth status indicator
- `hideSilentAuthIndicator()` - Hide auth status indicator

## Testing the Implementation

1. **Sign in** with "Stay logged in" checked
2. **Verify indicator** appears in header showing "Auto re-auth enabled"
3. **Check console** for "Setting up silent re-authentication" message
4. **Wait** or modify timing for testing to see hourly re-auth attempts
5. **Toggle "Stay logged in"** to see immediate enable/disable of silent re-auth
6. **Sign out** to verify all cleanup occurs properly

## Benefits

1. **Uninterrupted usage**: App can stay open for hours without authentication issues
2. **User-friendly**: Silent failures don't interrupt the user experience
3. **Secure**: Only enabled when user explicitly chooses to stay logged in
4. **Transparent**: Visual indicator shows when auto re-auth is active
5. **Reliable**: Multiple fallback mechanisms prevent authentication failures

This implementation provides a robust solution for maintaining authentication in long-running sessions while respecting user preferences and maintaining security.
