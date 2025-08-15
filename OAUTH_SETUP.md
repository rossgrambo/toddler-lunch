# Google OAuth Setup Instructions

This guide will help you set up Google OAuth authentication for the Toddler Meal Planning app using the new Google Identity Services.

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project" or select an existing project
3. Give your project a name (e.g., "Toddler Meal Planner")
4. Click "Create"

## Step 2: Enable Required APIs

1. In the Google Cloud Console, navigate to "APIs & Services" > "Library"
2. Search for and enable these APIs:
   - **Google Sheets API**
   - **Google Drive API** (needed for creating spreadsheets)

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "+ CREATE CREDENTIALS" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in the application name: "Toddler Meal Planner"
   - Add your email address as a developer contact
   - Save and continue through the scopes (no additional scopes needed)
   - Add test users if desired, or publish the app

4. For the OAuth client ID:
   - Application type: "Web application"
   - Name: "Toddler Meal Planner Web Client"
   - **Authorized JavaScript origins**: Add your domain(s)
     - For GitHub Pages: `https://YOUR-USERNAME.github.io`
     - For local development: `http://localhost:8080`
     - For custom domain: `https://yourdomain.com`
   - **Important**: Leave "Authorized redirect URIs" empty (not needed for Google Identity Services)

5. Click "Create"
6. Copy the "Client ID" (it looks like: `123456789-abcdefg.apps.googleusercontent.com`)

## Step 4: Configure the Application

1. Open the `config.js` file in your project
2. Replace `YOUR_OAUTH_CLIENT_ID_HERE` with your actual OAuth Client ID:

```javascript
OAUTH_CLIENT_ID: '123456789-abcdefg.apps.googleusercontent.com',
```

## Step 5: Serve Your Application

The OAuth flow requires your application to be served over HTTP/HTTPS (not opened as a file). You can use:

### Option A: Simple HTTP Server (Python)
```bash
# Navigate to your project folder
cd path/to/toddler-lunch

# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

### Option B: Live Server (VS Code Extension)
1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html` and select "Open with Live Server"

### Option C: Node.js HTTP Server
```bash
# Install a simple server
npm install -g http-server

# Navigate to your project folder and serve
cd path/to/toddler-lunch
http-server -p 8080
```

## Step 6: Access Your Application

1. Open your browser and go to `http://localhost:8080` (or your configured URL)
2. Click "Sign in with Google"
3. Choose your Google account and grant permissions
4. The app will automatically:
   - Create a new Google Sheets with sample data, OR
   - Let you connect to an existing spreadsheet

## What's New: Google Identity Services

This app now uses the latest Google Identity Services (GIS) instead of the deprecated Google Sign-In library. Key changes:

- **More secure**: Uses the latest Google authentication standards
- **Better performance**: Faster loading and authentication
- **Future-proof**: Compliant with Google's latest security requirements
- **Simplified setup**: No redirect URIs needed

## Troubleshooting

### "OAuth Client ID not configured"
- Make sure you've replaced `YOUR_OAUTH_CLIENT_ID_HERE` in `config.js` with your actual client ID

### "This app isn't verified"
- For personal use, click "Advanced" > "Go to [App Name] (unsafe)"
- For production, you'll need to submit your app for verification

### "Authorization Error" or "Access Denied"
- Make sure the URL you're using matches exactly what you configured in Google Cloud Console
- Include the protocol (http/https) and port number
- Check that your OAuth client has the correct authorized origins

### "Failed to create spreadsheet"
- Make sure you've enabled both Google Sheets API and Google Drive API
- Check that your OAuth client has the necessary scopes
- Verify you're signed into the correct Google account

### "Google Identity Services library not loaded"
- Check your internet connection
- Make sure you're serving the app over HTTP/HTTPS, not opening the file directly
- Try refreshing the page

## What the App Creates

When you choose "Create New Spreadsheet", the app will create a Google Sheets with these tabs:

1. **items** - Food items with categories (Carb, Protein, Fruit, Veggie)
2. **schedule** - Meal schedule with required categories per meal
3. **grocery** - Shopping list items
4. **current** - Today's generated meals
5. **history** - Past meals for tracking

Each sheet comes pre-populated with sample data to get you started!

## Security Notes

- Your OAuth client ID is safe to expose in client-side code
- The app only requests permissions to read/write spreadsheets you create or explicitly share
- You can revoke access anytime in your [Google Account settings](https://myaccount.google.com/permissions)

## Need Help?

If you encounter issues:
1. Check the browser console for error messages (F12 > Console)
2. Verify all APIs are enabled in Google Cloud Console
3. Ensure your OAuth client is properly configured
4. Make sure you're serving the app over HTTP/HTTPS, not opening the file directly
