# Toddler Meal Planning App

A static web application that helps plan snacks and meals using Google Sheets as a backend. The app uses Google OAuth for secure authentication and can automatically create Google Sheets with sample data to get you started.

## 🚀 Live Demo

**[Try the Live Demo on GitHub Pages](https://YOUR-USERNAME.github.io/toddler-lunch/)**

## Features

- **Multi-User Collaboration** - Multiple family members can share the same meal planning data
- **Google OAuth Authentication** - Secure sign-in with your Google account
- **Automatic Spreadsheet Creation** - Creates Google Sheets with sample data if needed
- **Easy Sharing** - Generate shareable links for family members to join meal planning
- **Persistent Data** - Remembers your spreadsheet across browser sessions
- **GitHub Pages Ready** - Deploy instantly with zero configuration
- **Card-based meal display** with left/right navigation
- **Google Sheets integration** for data storage and management
- **Automatic meal generation** based on schedule and item availability
- **Least recently used algorithm** to ensure variety
- **Category conflict prevention** (no duplicate categories in a meal)
- **Grocery list integration** to skip unavailable items
- **Daily reset functionality** that moves completed meals to history
- **Meal completion tracking** with visual status indicators
- **Item swipe functionality** to replace items and manage grocery list
- **Difficulty indicators** showing prep time estimates for items
- **Mobile-responsive design** with touch support

## 📋 Quick Start

### Option 1: Deploy to GitHub Pages (Recommended)

1. **Fork this repository** to your own GitHub account
2. **Enable GitHub Pages** in your repository settings (Settings → Pages → Source: Deploy from a branch → main)
3. **Set up Google OAuth** (see detailed instructions below)
4. **Update your OAuth settings** to include your GitHub Pages URL
5. **Start using your deployed app** at `https://YOUR-USERNAME.github.io/toddler-lunch/`

### Option 2: Local Development

1. **Set up Google OAuth** (see [OAUTH_SETUP.md](OAUTH_SETUP.md) for detailed instructions)
2. **Configure the app** - Update `config.js` with your OAuth Client ID
3. **Serve the app** - Use a local web server (required for OAuth)
4. **Sign in and start planning** - The app will create spreadsheets automatically!

## Setup Instructions

### 🌐 For GitHub Pages Deployment

#### Step 1: Fork and Deploy
1. **Fork this repository** to your GitHub account
2. **Go to Settings** → Pages in your forked repository
3. **Select Source**: Deploy from a branch → main
4. **Your app will be available** at: `https://YOUR-USERNAME.github.io/toddler-lunch/`

#### Step 2: Google OAuth Setup for GitHub Pages
1. Follow the [OAUTH_SETUP.md](OAUTH_SETUP.md) guide to create OAuth credentials
2. **Important**: When setting up authorized origins, use your GitHub Pages URL:
   - Authorized JavaScript origins: `https://YOUR-USERNAME.github.io`
3. Copy your OAuth Client ID

#### Step 3: Configure Your App
1. **Edit `config.js`** in your GitHub repository (online or locally)
2. **Replace `YOUR_OAUTH_CLIENT_ID_HERE`** with your actual OAuth Client ID
3. **Commit and push** your changes

```javascript
const CONFIG = {
    OAUTH_CLIENT_ID: 'YOUR-ACTUAL-CLIENT-ID.apps.googleusercontent.com',
    // ... rest of config
};
```

#### Step 4: Start Using Your App
- Visit your GitHub Pages URL
- Sign in with Google
- Create or connect to a spreadsheet
- Start meal planning!

### 💻 For Local Development

### 💻 For Local Development

#### 1. Google OAuth Setup

⚠️ **Important**: This app now uses Google OAuth instead of API keys for better security and functionality.

See the detailed guide in [OAUTH_SETUP.md](OAUTH_SETUP.md) for step-by-step instructions on:
- Creating a Google Cloud Project
- Enabling required APIs
- Setting up OAuth credentials
- Configuring the application

#### 2. Configuration

1. Open `config.js`
2. Replace `YOUR_OAUTH_CLIENT_ID_HERE` with your actual OAuth Client ID from Google Cloud Console

```javascript
const CONFIG = {
    OAUTH_CLIENT_ID: '123456789-abcdefg.apps.googleusercontent.com',
    // ... rest of config
};
```

#### 3. Running the App

**Important**: OAuth requires the app to be served over HTTP/HTTPS, not opened as a file.

Choose one of these options:

```bash
# Python 3
python -m http.server 8080

# Node.js
npx serve . -p 8080

# Or use VS Code Live Server extension
```

Then open `http://localhost:8080` in your browser.

## Multi-User Collaboration

### Sharing with Family Members

1. **Create or access your spreadsheet** through the app
2. **Click the "Share" button** in the top-right corner when signed in
3. **Copy the shareable link** and send it to family members
4. **Family members can**:
   - Click the shared link to automatically connect to your meal planner
   - Sign in with their own Google account
   - Collaborate in real-time on meal planning

### How Sharing Works

- **Automatic synchronization**: Changes made by any user are immediately visible to others
- **Individual authentication**: Each user signs in with their own Google account
- **Shared data**: All users see the same meals, grocery list, and meal history
- **Collaborative editing**: Multiple people can plan meals, mark them complete, and manage the grocery list
- **Persistent access**: Once connected, users can return directly to the shared meal planner

### URL Sharing

The app supports sharing via URL parameters:
- Share format: `https://yourdomain.com/?sheet=SPREADSHEET_ID`
- Automatically connects new users to the specified spreadsheet
- Works across different devices and browsers

## How It Works

### First Time Setup
1. **Sign in**: Click "Sign in with Google" and authorize the app
2. **Choose setup option**:
   - **Create New Spreadsheet**: Automatically creates Google Sheets with sample data
   - **Use Existing Spreadsheet**: Connect to your existing meal planning spreadsheet

### Daily Workflow
1. **App loads**: Checks if current meals exist for today
2. **New day detected**: Moves yesterday's meals to history, generates new meals
3. **Meal generation**: Uses least recently used items while respecting:
   - Category requirements from schedule
   - No duplicate categories in a meal
   - Excludes items from grocery list
4. **Navigation**: Use arrows to move between meals
5. **Item interaction**: 
   - **Swipe left**: Replace item with alternative
   - **Swipe right**: Add item to grocery list + replace with alternative
   - **Click item**: Open category selector to choose specific replacement
6. **Actions**: 
   - **Complete**: Marks items as used (updates Last Used date)
   - **Skip**: Removes meal without updating Last Used dates

## Google Sheets Structure

The app automatically creates these sheets with sample data:

### `items` Sheet
| Column | Example | Description |
|--------|---------|-------------|
| Item | Cheerios | Name of the food item |
| Carb | y | "y" if item contains carbs |
| Protein | | "y" if item contains protein |
| Fruit | y | "y" if item contains fruit |
| Veggie | | "y" if item contains vegetables |
| Tags | cereal,quick | Comma-separated tags |
| Difficulty | 1 | Prep time: 1=1min, 2=10min, 3=30min, 4=1hr, 5=>1hr |
| Last Used | never | Date when item was last used |

### `schedule` Sheet
| Column | Example | Description |
|--------|---------|-------------|
| Name | Breakfast | Name of the meal |
| Time | 8:00 AM | Time in HH:MM AM/PM format |
| Carb | y | "y" if meal requires carbs |
| Protein | y | "y" if meal requires protein |
| Fruit | y | "y" if meal requires fruit |
| Veggie | | "y" if meal requires vegetables |

### `grocery` Sheet
Items you need to buy (excluded from meal generation)

### `current` Sheet
Today's generated meals with completion status

### `history` Sheet
Past meals for tracking and analysis

## File Structure

```
toddler-lunch/
├── index.html          # Main HTML structure
├── styles.css          # Styling and responsive design
├── config.js           # OAuth and app configuration
├── googleSheetsApi.js  # Google Sheets API with OAuth
├── mealGenerator.js    # Meal generation logic
├── app.js              # Main application logic
├── OAUTH_SETUP.md      # Detailed OAuth setup guide
└── README.md           # This file
```

## Troubleshooting

### Authentication Issues

1. **"OAuth Client ID not configured"**
   - Make sure you've replaced `YOUR_OAUTH_CLIENT_ID_HERE` in `config.js`

2. **"This app isn't verified"**
   - For personal use: click "Advanced" → "Go to [App Name] (unsafe)"
   - This is normal for personal projects

3. **"Redirect URI mismatch"**
   - Ensure your URL matches exactly what you configured in Google Cloud Console
   - Include the correct protocol (http/https) and port

### App Issues

1. **Can't create spreadsheet**
   - Make sure Google Drive API is enabled (required for creating sheets)
   - Check that you're signed into the correct Google account

2. **No meals generated**
   - Check that your spreadsheet has data in the `items` and `schedule` sheets
   - Verify that items have the required categories for your scheduled meals

3. **CORS/Network Errors**
   - Must serve from a web server, not open as file
   - Use one of the suggested local server options

### Data Validation

- Category columns should contain "y" or be empty
- Difficulty should be numbers 1-5 or empty
- Times should be in "HH:MM AM/PM" format
- Sheet names are case-sensitive

## Security & Privacy

- Uses Google OAuth for secure authentication
- Only requests access to spreadsheets the app creates or you explicitly share
- Your data stays in your Google Drive
- You can revoke access anytime in your Google Account settings
- OAuth Client ID is safe to expose in client-side code

## Browser Compatibility

- Modern browsers that support ES6+ features
- Requires internet connection for Google API access
