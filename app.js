// Main Application Logic
class MealPlanningApp {
    constructor() {
        this.meals = [];
        this.currentMealIndex = 0;
        this.isLoading = false;
        this.lastLoadDate = null;
        this.currentUser = null;
    }

    async init() {
        try {
            this.showLoading('Initializing app...');
            
            // Check if gapi is loaded
            if (typeof gapi === 'undefined') {
                throw new Error('Google API library not loaded. Please check your internet connection.');
            }
            
            // Check OAuth client ID configuration
            if (!CONFIG.OAUTH_CLIENT_ID || CONFIG.OAUTH_CLIENT_ID === 'YOUR_OAUTH_CLIENT_ID_HERE') {
                throw new Error('OAuth Client ID not configured. Please check your config.js file.');
            }
            
            // Check for spreadsheet ID from URL or local storage
            this.loadSpreadsheetIdFromSources();
            
            // Initialize Google Sheets API
            await sheetsAPI.initialize();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize checkbox state
            this.initializeStayLoggedInCheckbox();
            
            this.hideLoading();
            
            // Check if user is already signed in or can be auto-signed in
            if (sheetsAPI.isUserSignedIn()) {
                await this.handleSignedInUser();
            } else {
                this.showAuthSection();
            }
            
        } catch (error) {
            console.error('Error initializing app:', error);
            
            // Provide more specific error messages
            let errorMessage = 'Failed to initialize app. ';
            if (error.message.includes('Google Identity Services')) {
                errorMessage += 'Google authentication service failed to load. Please refresh the page and try again.';
            } else if (error.message.includes('OAuth Client ID')) {
                errorMessage += 'Please check your OAuth configuration in config.js.';
            } else if (error.message.includes('Google API library')) {
                errorMessage += 'Please check your internet connection and refresh the page.';
            } else {
                errorMessage += error.message;
            }
            
            this.showAuthError(errorMessage);
            this.hideLoading();
        }
    }

    loadSpreadsheetIdFromSources() {
        // Priority: URL parameter > Local storage > Search by name > Create new
        const urlSpreadsheetId = StorageHelper.getSpreadsheetIdFromUrl();
        const storedSpreadsheetId = StorageHelper.loadSpreadsheetId();
        
        if (urlSpreadsheetId) {
            CONFIG.SPREADSHEET_ID = urlSpreadsheetId;
            CONFIG.SPREADSHEET_FROM_URL = true; // Flag to indicate it came from URL
            // Save to local storage for future visits
            StorageHelper.saveSpreadsheetId(urlSpreadsheetId);
        } else if (storedSpreadsheetId) {
            CONFIG.SPREADSHEET_ID = storedSpreadsheetId;
            CONFIG.SPREADSHEET_FROM_URL = false;
        } else {
            CONFIG.SPREADSHEET_ID = null;
            CONFIG.SPREADSHEET_FROM_URL = false;
        }
    }

    async handleSignedInUser() {
        try {
            this.showLoading('Setting up your meal planning...');
            
            // Get user info - placeholder since GIS doesn't provide profile info by default
            this.currentUser = {
                name: 'User',
                email: 'user@example.com'
            };
            
            // Show main content and hide auth section
            this.showMainContent();
            
            // Check or create spreadsheet with better progress updates
            this.showLoading('Checking for existing meal planner spreadsheet...');
            await sheetsAPI.checkOrCreateSpreadsheet();
            
            // If no spreadsheet ID, show setup section
            if (!CONFIG.SPREADSHEET_ID) {
                this.showSetupSection();
                return;
            }
            
            // Test the connection
            this.showLoading('Verifying spreadsheet access...');
            await sheetsAPI.testConnection();
            
            // Update date display
            this.updateDateDisplay();
            
            // Check if we need to handle a new day
            this.showLoading('Checking for new day...');
            await this.checkAndHandleNewDay();
            
            // Load meals
            this.showLoading('Loading your meals...');
            await this.loadMeals();
            
            this.hideLoading();
            this.hideSetupSection();
            
        } catch (error) {
            console.error('Error handling signed in user:', error);
            
            if (error.message.includes('spreadsheet') || error.message.includes('Spreadsheet')) {
                // Show setup section for spreadsheet issues
                this.showSetupSection();
                this.hideLoading();
            } else {
                this.showError('Failed to set up meal planning. Please try again.');
                this.hideLoading();
            }
        }
    }

    setupEventListeners() {
        // Auth event listeners
        document.getElementById('signInBtn').addEventListener('click', () => this.signIn());
        document.getElementById('signOutBtn').addEventListener('click', () => this.signOut());
        
        // API key event listeners
        document.getElementById('apiKeyToggleBtn').addEventListener('click', () => this.toggleApiKeySection());
        document.getElementById('apiKeySaveBtn').addEventListener('click', () => this.saveApiKey());
        document.getElementById('apiKeyCancelBtn').addEventListener('click', () => this.hideApiKeySection());
        
        // API key input enter key
        document.getElementById('apiKeyInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveApiKey();
            }
        });
        
        // Stay logged in checkbox
        document.getElementById('stayLoggedInCheckbox').addEventListener('change', (e) => {
            StorageHelper.saveStayLoggedInPreference(e.target.checked);
        });
        
        // Reset data functionality
        document.getElementById('resetDataBtn').addEventListener('click', () => this.resetData());
        
        // Setup event listeners
        document.getElementById('createNewBtn').addEventListener('click', () => this.createNewSpreadsheet());
        document.getElementById('useExistingBtn').addEventListener('click', () => this.useExistingSpreadsheet());
        
        // Share functionality
        document.getElementById('shareBtn').addEventListener('click', () => this.openShareModal());
        document.getElementById('copyLinkBtn').addEventListener('click', () => this.copyShareLink());
        
        // Navigation arrows
        document.getElementById('prevMeal').addEventListener('click', () => this.previousMeal());
        document.getElementById('nextMeal').addEventListener('click', () => this.nextMeal());
        
        // Action buttons
        document.getElementById('completeMeal').addEventListener('click', () => this.completeMeal());
        document.getElementById('skipMeal').addEventListener('click', () => this.skipMeal());
        
        // Window focus event to check for new day
        window.addEventListener('focus', () => this.checkAndHandleNewDay());
        
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            // Escape key to close modals
            if (e.key === 'Escape') {
                const categoryModal = document.getElementById('categoryModal');
                const shareModal = document.getElementById('shareModal');
                
                if (categoryModal && categoryModal.style.display !== 'none') {
                    this.closeCategoryModal();
                } else if (shareModal && shareModal.style.display !== 'none') {
                    this.closeShareModal();
                }
            }
        });
        
        // Click outside modal to close
        document.getElementById('categoryModal').addEventListener('click', (e) => {
            if (e.target.id === 'categoryModal') {
                this.closeCategoryModal();
            }
        });
        
        document.getElementById('shareModal').addEventListener('click', (e) => {
            if (e.target.id === 'shareModal') {
                this.closeShareModal();
            }
        });
    }

    initializeStayLoggedInCheckbox() {
        const checkbox = document.getElementById('stayLoggedInCheckbox');
        const stayLoggedIn = StorageHelper.loadStayLoggedInPreference();
        checkbox.checked = stayLoggedIn;
    }

    async signIn() {
        try {
            this.showAuthStatus('Signing in...', false);
            
            // Get checkbox state before signing in and save it immediately
            const checkbox = document.getElementById('stayLoggedInCheckbox');
            const stayLoggedIn = checkbox.checked;
            
            // Save the preference immediately before OAuth flow
            StorageHelper.saveStayLoggedInPreference(stayLoggedIn);
            
            await sheetsAPI.signIn();
            this.showAuthStatus('Successfully signed in!', true);
            
            setTimeout(async () => {
                await this.handleSignedInUser();
            }, 1000);
            
        } catch (error) {
            console.error('Sign in error:', error);
            this.showAuthStatus('Sign in failed. Please try again.', false);
        }
    }

    async signOut() {
        try {
            await sheetsAPI.signOut();
            this.currentUser = null;
            
            // Clear API key if it exists
            if (StorageHelper.hasApiKey()) {
                StorageHelper.clearApiKey();
            }
            
            // Don't clear the spreadsheet ID - keep it for next sign-in
            // CONFIG.SPREADSHEET_ID = null;
            this.showAuthSection();
        } catch (error) {
            console.error('Sign out error:', error);
            this.showError('Failed to sign out');
        }
    }

    async resetData() {
        const confirmed = confirm(
            'This will clear your current spreadsheet data and create a new spreadsheet. ' +
            'Your existing spreadsheet will not be deleted, but you\'ll start fresh. ' +
            'Are you sure you want to continue?'
        );
        
        if (!confirmed) {
            return;
        }
        
        try {
            this.showLoading('Creating new spreadsheet...');
            
            // Clear stored spreadsheet information
            StorageHelper.clearSpreadsheetId();
            CONFIG.SPREADSHEET_ID = null;
            
            // Create a new spreadsheet
            await this.createNewSpreadsheet();
            
        } catch (error) {
            console.error('Reset data error:', error);
            this.showError('Failed to reset data: ' + error.message);
            this.hideLoading();
        }
    }

    async createNewSpreadsheet() {
        try {
            this.showLoading('Creating new spreadsheet with sample data...');
            
            const spreadsheetId = await sheetsAPI.createSpreadsheet();
            console.log('Created spreadsheet:', spreadsheetId);
            
            // Save the spreadsheet ID to local storage
            StorageHelper.saveSpreadsheetId(spreadsheetId);
            
            this.showSetupStatus('Spreadsheet created successfully!', true);
            
            // Continue with meal planning setup
            setTimeout(async () => {
                await this.handleSignedInUser();
            }, 2000);
            
        } catch (error) {
            console.error('Error creating spreadsheet:', error);
            this.showSetupStatus('Failed to create spreadsheet. Please try again.', false);
            this.hideLoading();
        }
    }

    async useExistingSpreadsheet() {
        try {
            const spreadsheetId = document.getElementById('spreadsheetIdInput').value.trim();
            
            if (!spreadsheetId) {
                this.showSetupStatus('Please enter a spreadsheet ID', false);
                return;
            }
            
            this.showLoading('Connecting to your spreadsheet...');
            
            // Set the spreadsheet ID and test connection
            CONFIG.SPREADSHEET_ID = spreadsheetId;
            
            await sheetsAPI.testConnection();
            
            // Save the spreadsheet ID to local storage
            StorageHelper.saveSpreadsheetId(spreadsheetId);
            
            this.showSetupStatus('Successfully connected to your spreadsheet!', true);
            
            // Continue with meal planning setup
            setTimeout(async () => {
                await this.handleSignedInUser();
            }, 2000);
            
        } catch (error) {
            console.error('Error connecting to spreadsheet:', error);
            CONFIG.SPREADSHEET_ID = null;
            this.showSetupStatus('Failed to connect to spreadsheet. Please check the ID and try again.', false);
            this.hideLoading();
        }
    }

    openShareModal() {
        if (!CONFIG.SPREADSHEET_ID) {
            this.showError('No spreadsheet connected. Please set up a spreadsheet first.');
            return;
        }
        
        // Generate shareable URL
        const shareableUrl = StorageHelper.generateShareableUrl(CONFIG.SPREADSHEET_ID);
        const googleSheetsUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/edit`;
        
        // Populate modal content
        document.getElementById('shareLink').value = shareableUrl;
        document.getElementById('spreadsheetIdDisplay').textContent = CONFIG.SPREADSHEET_ID;
        document.getElementById('googleSheetsLink').href = googleSheetsUrl;
        
        // Show modal
        const modal = document.getElementById('shareModal');
        modal.style.display = 'flex';
        
        // Trigger animation
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    }

    closeShareModal() {
        const modal = document.getElementById('shareModal');
        modal.classList.remove('show');
        
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    async copyShareLink() {
        try {
            const shareLink = document.getElementById('shareLink');
            await navigator.clipboard.writeText(shareLink.value);
            
            // Visual feedback
            const copyBtn = document.getElementById('copyLinkBtn');
            const originalText = copyBtn.innerHTML;
            
            copyBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                </svg>
                Copied!
            `;
            copyBtn.classList.add('copied');
            
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.classList.remove('copied');
            }, 2000);
            
        } catch (error) {
            // Fallback for older browsers
            const shareLink = document.getElementById('shareLink');
            shareLink.select();
            shareLink.setSelectionRange(0, 99999);
            document.execCommand('copy');
            
            console.log('Share link copied to clipboard');
        }
    }

    showAuthSection() {
        document.getElementById('authSection').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('setupSection').style.display = 'none';
        
        // Check if we have an API key and update UI accordingly
        this.updateAuthSectionForApiKey();
    }
    
    updateAuthSectionForApiKey() {
        const hasApiKey = StorageHelper.hasApiKey();
        const signInBtn = document.getElementById('signInBtn');
        const apiKeyToggle = document.getElementById('apiKeyToggleBtn');
        
        if (hasApiKey) {
            // Hide OAuth button and API key toggle if we have an API key
            signInBtn.style.display = 'none';
            apiKeyToggle.textContent = 'Remove API key';
        } else {
            // Show OAuth button and API key toggle
            signInBtn.style.display = 'flex';
            apiKeyToggle.textContent = 'Supply an API key';
        }
    }
    
    toggleApiKeySection() {
        const hasApiKey = StorageHelper.hasApiKey();
        
        if (hasApiKey) {
            // Remove API key
            this.removeApiKey();
        } else {
            // Show API key input
            this.showApiKeySection();
        }
    }
    
    showApiKeySection() {
        const apiKeySection = document.getElementById('apiKeySection');
        apiKeySection.style.display = 'block';
        
        // Focus on the input
        setTimeout(() => {
            document.getElementById('apiKeyInput').focus();
        }, 100);
    }
    
    hideApiKeySection() {
        const apiKeySection = document.getElementById('apiKeySection');
        apiKeySection.style.display = 'none';
        
        // Clear the input
        document.getElementById('apiKeyInput').value = '';
    }
    
    async saveApiKey() {
        const apiKeyInput = document.getElementById('apiKeyInput');
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            this.showAuthStatus('Please enter an API key', false);
            return;
        }
        
        try {
            this.showAuthStatus('Validating API key...', false);
            
            // Disable the save button while validating
            const saveBtn = document.getElementById('apiKeySaveBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Validating...';
            
            // Test the API key
            await sheetsAPI.authenticateWithApiKey(apiKey);
            
            // Hide the API key section
            this.hideApiKeySection();
            
            // Update UI
            this.updateAuthSectionForApiKey();
            
            this.showAuthStatus('API key saved successfully!', true);
            
            // Continue with signed in flow
            setTimeout(async () => {
                await this.handleSignedInUser();
            }, 1000);
            
        } catch (error) {
            console.error('API key validation failed:', error);
            this.showAuthStatus(error.message || 'Invalid API key. Please check and try again.', false);
        } finally {
            // Re-enable the save button
            const saveBtn = document.getElementById('apiKeySaveBtn');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
    }
    
    removeApiKey() {
        const confirmed = confirm('Are you sure you want to remove the saved API key? You will need to authenticate again.');
        
        if (confirmed) {
            StorageHelper.clearApiKey();
            this.updateAuthSectionForApiKey();
            this.showAuthStatus('API key removed. Please sign in to continue.', false);
        }
    }

    showMainContent() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('setupSection').style.display = 'none';
        
        // Update user info
        let userInfoText = '';
        if (this.currentUser) {
            userInfoText = `Hello, ${this.currentUser.name}`;
        }
        
        // Add authentication method info
        const authMethod = sheetsAPI.getAuthMethod();
        if (authMethod === 'apikey') {
            userInfoText += ' | Using API Key';
        } else if (authMethod === 'oauth') {
            userInfoText += ' | OAuth';
        }
        
        // Add spreadsheet info
        const spreadsheetName = StorageHelper.loadSpreadsheetName();
        if (spreadsheetName) {
            userInfoText += ` | Using: ${spreadsheetName}`;
        }
        
        if (userInfoText) {
            document.getElementById('userInfo').textContent = userInfoText;
        }
    }

    showSetupSection() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('setupSection').style.display = 'flex';
    }

    hideSetupSection() {
        document.getElementById('setupSection').style.display = 'none';
    }

    showAuthStatus(message, isSuccess) {
        const statusElement = document.getElementById('authStatus');
        statusElement.textContent = message;
        statusElement.className = `auth-status ${isSuccess ? 'success' : 'error'}`;
    }

    showAuthError(message) {
        this.showAuthStatus(message, false);
    }

    showSetupStatus(message, isSuccess) {
        // Create or update setup status element
        let statusElement = document.getElementById('setupStatus');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'setupStatus';
            statusElement.className = 'auth-status';
            document.querySelector('.setup-container').appendChild(statusElement);
        }
        
        statusElement.textContent = message;
        statusElement.className = `auth-status ${isSuccess ? 'success' : 'error'}`;
    }

    updateDateDisplay() {
        const today = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        document.getElementById('dateDisplay').textContent = today.toLocaleDateString('en-US', options);
    }

    async checkAndHandleNewDay() {
        const today = getTodayString();
        
        // Always check if we need to handle a new day by looking at the data
        try {
            const needsNewMeals = await mealGenerator.checkIfNeedsNewMeals();
            
            if (needsNewMeals) {
                console.log('New day detected or no current meals, handling day transition');
                this.showLoading('Starting new day...');
                await mealGenerator.handleNewDay();
                this.hideLoading();
            }
            
            this.lastLoadDate = today;
        } catch (error) {
            console.error('Error checking/handling new day:', error);
            this.showError('Error checking for new day. Please refresh and try again.');
            this.hideLoading();
        }
    }

    async loadMeals() {
        try {
            this.showLoading('Loading meals...');
            
            // Check if we need to generate new meals
            const needsNewMeals = await mealGenerator.checkIfNeedsNewMeals();
            
            if (needsNewMeals) {
                console.log('Generating new meals...');
                this.meals = await mealGenerator.generateMealsForToday();
            } else {
                console.log('Loading existing meals...');
                
                // Ensure mealGenerator has data loaded before extracting items
                if (!mealGenerator.items || mealGenerator.items.length === 0) {
                    console.log('Loading mealGenerator data for item extraction...');
                    await mealGenerator.loadData();
                }
                
                const currentMeals = await mealGenerator.getCurrentMeals();
                
                // Convert current meals to proper format
                this.meals = currentMeals.map(meal => ({
                    name: meal['meal name'],
                    time: this.findMealTime(meal['meal name']),
                    items: this.extractItemsFromMeal(meal),
                    date: meal.date,
                    status: meal.status || 'pending' // pending, completed, skipped
                }));
            }
            
            this.currentMealIndex = 0;
            this.updateUI();
            this.hideLoading();
        } catch (error) {
            console.error('Error loading meals:', error);
            this.showError('Failed to load meals. Please check your Google Sheets setup.');
            this.hideLoading();
        }
    }

    findMealTime(mealName) {
        // Find the time for this meal from the schedule
        if (!mealGenerator.schedule || mealGenerator.schedule.length === 0) {
            console.warn('Schedule not loaded when looking up meal time');
            return 'Time not set';
        }
        
        const scheduleItem = mealGenerator.schedule.find(item => item.Name === mealName);
        if (!scheduleItem) {
            console.warn(`Meal "${mealName}" not found in schedule`);
            return 'Time not found';
        }
        
        return scheduleItem.Time;
    }

    extractItemsFromMeal(meal) {
        const items = [];
        // Start from index 1 since we now have: date, meal name, status, item 1, item 2, item 3, item 4
        for (let i = 1; i <= 4; i++) {
            const itemName = meal[`item ${i}`];
            if (itemName) {
                // Find full item details from mealGenerator
                let itemDetails = null;
                
                // Ensure mealGenerator has items loaded
                if (mealGenerator.items && mealGenerator.items.length > 0) {
                    itemDetails = mealGenerator.items.find(item => item.Item === itemName);
                }
                
                if (itemDetails) {
                    // Use the full item details with all properties
                    items.push(itemDetails);
                    console.log(`Found full details for ${itemName}:`, itemDetails);
                } else {
                    // Fallback - create minimal item object but log warning
                    console.warn(`Could not find full details for item: ${itemName}. Creating minimal object.`);
                    items.push({ Item: itemName });
                }
            }
        }
        return items;
    }

    updateUI() {
        if (this.meals.length === 0) {
            this.showError('No meals available for today.');
            return;
        }

        const currentMeal = this.meals[this.currentMealIndex];
        const formattedMeal = mealGenerator.formatMealForDisplay(currentMeal);
        
        // Update meal display
        document.getElementById('mealName').textContent = formattedMeal.name;
        document.getElementById('mealTime').textContent = formattedMeal.time;
        
        // Update meal card classes and status
        const mealCard = document.getElementById('mealCard');
        mealCard.className = 'meal-card';
        
        // Clear any existing status badge
        const existingBadge = mealCard.querySelector('.meal-status-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        if (currentMeal.status === 'completed') {
            mealCard.classList.add('completed');
            const badge = document.createElement('div');
            badge.className = 'meal-status-badge completed';
            badge.textContent = 'Completed ✓';
            mealCard.appendChild(badge);
        } else if (currentMeal.status === 'skipped') {
            mealCard.classList.add('skipped');
            const badge = document.createElement('div');
            badge.className = 'meal-status-badge skipped';
            badge.textContent = 'Skipped ✗';
            mealCard.appendChild(badge);
        }
        
        // Update meal items
        this.updateMealItems(formattedMeal.items);
        
        // Update progress
        document.getElementById('currentMeal').textContent = this.currentMealIndex + 1;
        document.getElementById('totalMeals').textContent = this.meals.length;
        
        // Update navigation buttons
        this.updateNavigationButtons();
        
        // Update action buttons based on meal status
        this.updateActionButtons(currentMeal.status);
    }

    updateMealItems(items) {
        const container = document.getElementById('mealItems');
        container.innerHTML = '';
        
        items.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'meal-item';
            itemElement.dataset.itemIndex = index;
            
            // Add swipe indicators
            const leftIndicator = document.createElement('div');
            leftIndicator.className = 'swipe-indicator left';
            leftIndicator.textContent = '↻ Replace';
            
            const rightIndicator = document.createElement('div');
            rightIndicator.className = 'swipe-indicator right';
            rightIndicator.textContent = '🛒 + Replace';
            
            const itemName = document.createElement('div');
            itemName.className = 'item-name';
            itemName.textContent = item.name;
            
            const itemTags = document.createElement('div');
            itemTags.className = 'item-tags';
            
            // Create categories container
            const categoriesContainer = document.createElement('div');
            categoriesContainer.className = 'item-categories';
            
            // Add category tags
            item.categories.forEach(category => {
                const tag = document.createElement('span');
                tag.className = `item-tag ${category.toLowerCase()}`;
                tag.textContent = category;
                
                categoriesContainer.appendChild(tag);
            });
            
            itemTags.appendChild(categoriesContainer);
            
            // Add difficulty indicator if difficulty > 0
            if (item.difficulty && item.difficulty > 0) {
                const difficultyText = this.getDifficultyText(item.difficulty);
                const difficultySpan = document.createElement('div');
                difficultySpan.className = 'item-difficulty';
                difficultySpan.textContent = difficultyText;
                itemTags.appendChild(difficultySpan);
            }
            
            itemElement.appendChild(leftIndicator);
            itemElement.appendChild(rightIndicator);
            itemElement.appendChild(itemName);
            itemElement.appendChild(itemTags);
            
            // Add swipe functionality and click handlers
            this.addSwipeAndClickHandlers(itemElement, item, index);
            
            container.appendChild(itemElement);
        });
    }

    getDifficultyText(difficulty) {
        const difficultyMap = {
            1: '~1 min',
            2: '~10 min',
            3: '~30 min',
            4: '~1 hr',
            5: '>1 hr'
        };
        return difficultyMap[difficulty] || '';
    }

    addSwipeAndClickHandlers(element, item, itemIndex) {
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let isDragging = false;
        let hasMovedMinDistance = false;
        let swipeThreshold = 80;
        let minDragDistance = 10; // Minimum distance before considering it a drag

        // Get the item name and category tags for click handling
        const itemName = element.querySelector('.item-name');
        const categoryTags = element.querySelectorAll('.item-tag');

        // Mouse events
        const handleMouseDown = (e) => {
            startX = e.clientX;
            startY = e.clientY;
            currentX = 0;
            isDragging = true;
            hasMovedMinDistance = false;
            e.preventDefault();
        };

        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
            currentX = e.clientX - startX;
            const currentY = e.clientY - startY;
            const distance = Math.sqrt(currentX * currentX + currentY * currentY);
            
            // Only start visual dragging after minimum distance
            if (distance > minDragDistance) {
                hasMovedMinDistance = true;
                element.classList.add('swiping');
                element.style.transform = `translateX(${currentX}px)`;
                this.updateSwipeVisual(element, currentX, swipeThreshold);
            }
        };

        const handleMouseUp = async (e) => {
            if (!isDragging) return;
            
            const wasDragging = hasMovedMinDistance;
            const clickTarget = e.target;
            
            // Reset state first
            isDragging = false;
            hasMovedMinDistance = false;
            element.classList.remove('swiping');
            
            if (wasDragging) {
                // Handle swipe
                await this.handleSwipeEnd(element, item, itemIndex, currentX, swipeThreshold);
            } else {
                // Handle click - check what was clicked for category-specific behavior
                if (clickTarget.classList.contains('item-tag')) {
                    const category = clickTarget.textContent;
                    this.openCategoryModal(item, itemIndex, category);
                } else {
                    // Default: open modal with all categories for this item
                    this.openCategoryModal(item, itemIndex);
                }
            }
            
            // Always reset position and visual state
            element.style.transform = '';
            element.classList.remove('swipe-left', 'swipe-right');
            
            // Remove global listeners
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        element.addEventListener('mousedown', (e) => {
            handleMouseDown(e);
            // Add global listeners to handle mouse events outside the element
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });

        // Touch events
        const handleTouchStart = (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            currentX = 0;
            isDragging = true;
            hasMovedMinDistance = false;
        };

        const handleTouchMove = (e) => {
            if (!isDragging) return;
            
            currentX = e.touches[0].clientX - startX;
            const currentY = e.touches[0].clientY - startY;
            const distance = Math.sqrt(currentX * currentX + currentY * currentY);
            
            // Only start visual dragging after minimum distance
            if (distance > minDragDistance) {
                hasMovedMinDistance = true;
                element.classList.add('swiping');
                element.style.transform = `translateX(${currentX}px)`;
                this.updateSwipeVisual(element, currentX, swipeThreshold);
                e.preventDefault();
            }
        };

        const handleTouchEnd = async (e) => {
            if (!isDragging) return;
            
            const wasDragging = hasMovedMinDistance;
            const touchTarget = e.target;
            
            // Reset state first
            isDragging = false;
            hasMovedMinDistance = false;
            element.classList.remove('swiping');
            
            if (wasDragging) {
                // Handle swipe
                await this.handleSwipeEnd(element, item, itemIndex, currentX, swipeThreshold);
            } else {
                // Handle tap - check what was tapped for category-specific behavior
                if (touchTarget.classList.contains('item-tag')) {
                    const category = touchTarget.textContent;
                    this.openCategoryModal(item, itemIndex, category);
                } else {
                    // Default: open modal with all categories for this item
                    this.openCategoryModal(item, itemIndex);
                }
            }
            
            // Always reset position and visual state
            element.style.transform = '';
            element.classList.remove('swipe-left', 'swipe-right');
        };

        element.addEventListener('touchstart', handleTouchStart);
        element.addEventListener('touchmove', handleTouchMove);
        element.addEventListener('touchend', handleTouchEnd);
    }

    updateSwipeVisual(element, currentX, threshold) {
        element.classList.remove('swipe-left', 'swipe-right');
        
        if (currentX < -threshold) {
            element.classList.add('swipe-left');
        } else if (currentX > threshold) {
            element.classList.add('swipe-right');
        }
    }

    async handleSwipeEnd(element, item, itemIndex, currentX, threshold) {
        // Only handle the swipe action - visual reset is handled by the event handlers
        if (currentX < -threshold) {
            // Swipe left - replace item
            await this.replaceItem(itemIndex, false);
        } else if (currentX > threshold) {
            // Swipe right - add to grocery and replace item
            await this.replaceItem(itemIndex, true);
        }
    }

    async replaceItem(itemIndex, addToGrocery) {
        try {
            const currentMeal = this.meals[this.currentMealIndex];
            const itemToReplace = currentMeal.items[itemIndex];
            
            console.log(`Replacing item: ${itemToReplace.Item || itemToReplace.name}`);
            
            // Show loading state
            this.showLoading(addToGrocery ? 'Adding to grocery & finding replacement...' : 'Finding replacement...');
            
            // Ensure we have fresh data loaded before replacement
            await mealGenerator.loadData();
            
            // Re-enrich the current item with full data if it's missing properties
            if (!itemToReplace.Carb && !itemToReplace.Protein && !itemToReplace.Fruit && !itemToReplace.Veggie) {
                console.log('Item missing category properties, re-enriching...');
                const fullItemData = mealGenerator.items.find(item => item.Item === itemToReplace.Item);
                if (fullItemData) {
                    // Update the item in the meal with full data
                    Object.assign(itemToReplace, fullItemData);
                    console.log('Re-enriched item:', itemToReplace);
                }
            }
            
            if (addToGrocery) {
                console.log('Adding to grocery list...');
                await this.addToGroceryList(itemToReplace.Item || itemToReplace.name);
            }
            
            // Generate replacement item(s)
            const replacementItems = await this.generateReplacementItem(currentMeal, itemIndex);
            
            if (replacementItems && replacementItems.length > 0) {
                // Remove the original item
                currentMeal.items.splice(itemIndex, 1);
                
                // Add the replacement item(s) at the same position
                currentMeal.items.splice(itemIndex, 0, ...replacementItems);
                
                // If we have too many items now, trim to 4
                if (currentMeal.items.length > 4) {
                    currentMeal.items = currentMeal.items.slice(0, 4);
                }
                
                // Update the meal in the sheet
                await sheetsAPI.saveCurrentMeals(this.meals);
                
                // Refresh the UI
                this.updateUI();
                
                const replacementNames = replacementItems.map(item => item.Item).join(', ');
                console.log(`Replaced with: ${replacementNames}`);
                
                // Show success message for multiple replacements
                if (replacementItems.length > 1) {
                    this.showTemporaryMessage(`Replaced with ${replacementItems.length} items: ${replacementNames}`);
                }
            } else if (replacementItems && replacementItems.length === 0) {
                // No replacement needed - just remove the item
                console.log('No replacement needed - removing item only');
                
                // Remove the original item
                currentMeal.items.splice(itemIndex, 1);
                
                // Update the meal in the sheet
                await sheetsAPI.saveCurrentMeals(this.meals);
                
                // Refresh the UI
                this.updateUI();
                
                this.showTemporaryMessage(`Removed ${itemToReplace.Item || itemToReplace.name} - all categories already covered`);
            } else {
                this.showError('No suitable replacement found for this item.');
            }
            
            this.hideLoading();
        } catch (error) {
            console.error('Error replacing item:', error);
            this.showError('Failed to replace item. Please try again.');
            this.hideLoading();
        }
    }

    showTemporaryMessage(message) {
        // Create a temporary success message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'temp-message';
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: #d4edda;
            color: #155724;
            padding: 10px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1002;
            font-size: 0.9rem;
            max-width: 90%;
            text-align: center;
        `;
        
        document.body.appendChild(messageDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    }

    async addToGroceryList(itemName) {
        try {
            // Add item to grocery sheet
            await sheetsAPI.appendRange(CONFIG.SHEETS.GROCERY, [[itemName]]);
            console.log(`Added ${itemName} to grocery list`);
        } catch (error) {
            console.error('Error adding to grocery list:', error);
        }
    }

    async generateReplacementItem(meal, itemIndex) {
        try {
            console.log(`Generating replacement for item at index ${itemIndex}`);
            
            // Ensure mealGenerator has data loaded
            await mealGenerator.loadData();
            
            // Use the new generateReplacement method
            const replacementItems = mealGenerator.generateReplacement(meal, itemIndex);
            
            if (replacementItems.length > 0) {
                console.log(`Found replacement: ${replacementItems.map(item => item.Item).join(', ')}`);
                return replacementItems;
            } else if (replacementItems.length === 0) {
                console.log('No replacement needed - categories already covered');
                return []; // Return empty array to indicate no replacement needed
            }
            
            console.log('No suitable replacement found');
            return null;
        } catch (error) {
            console.error('Error generating replacement item:', error);
            return null;
        }
    }

    // Remove the old complex findCategoryReplacement method as it's replaced by mealGenerator.generateReplacement

    updateActionButtons(mealStatus) {
        const completeBtn = document.getElementById('completeMeal');
        const skipBtn = document.getElementById('skipMeal');
        
        if (mealStatus === 'completed') {
            completeBtn.textContent = '✓ Completed';
            completeBtn.disabled = true;
            completeBtn.style.opacity = '0.6';
            skipBtn.disabled = true;
            skipBtn.style.opacity = '0.6';
        } else if (mealStatus === 'skipped') {
            skipBtn.textContent = '✗ Skipped';
            skipBtn.disabled = true;
            skipBtn.style.opacity = '0.6';
            completeBtn.disabled = true;
            completeBtn.style.opacity = '0.6';
        } else {
            completeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"></polyline></svg>Complete';
            skipBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Skip';
            completeBtn.disabled = false;
            skipBtn.disabled = false;
            completeBtn.style.opacity = '1';
            skipBtn.style.opacity = '1';
        }
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevMeal');
        const nextBtn = document.getElementById('nextMeal');
        
        prevBtn.disabled = this.currentMealIndex === 0;
        nextBtn.disabled = this.currentMealIndex === this.meals.length - 1;
    }

    previousMeal() {
        if (this.currentMealIndex > 0) {
            this.currentMealIndex--;
            this.updateUI();
        }
    }

    nextMeal() {
        if (this.currentMealIndex < this.meals.length - 1) {
            this.currentMealIndex++;
            this.updateUI();
        }
    }

    async completeMeal() {
        try {
            const currentMeal = this.meals[this.currentMealIndex];
            console.log(`Completing meal: ${currentMeal.name}`);
            
            // Mark meal as completed
            currentMeal.status = 'completed';
            
            // Update the current meals in the sheet
            await sheetsAPI.saveCurrentMeals(this.meals);
            
            // Update UI to show completed status
            this.updateUI();
            
            // Auto-advance to next pending meal if available
            this.goToNextPendingMeal();
        } catch (error) {
            console.error('Error completing meal:', error);
            this.showError('Failed to complete meal. Please try again.');
        }
    }

    async skipMeal() {
        try {
            const currentMeal = this.meals[this.currentMealIndex];
            console.log(`Skipping meal: ${currentMeal.name}`);
            
            // Mark meal as skipped
            currentMeal.status = 'skipped';
            
            // Update the current meals in the sheet (but don't update "Last Used" dates)
            await sheetsAPI.saveCurrentMeals(this.meals);
            
            // Update UI to show skipped status
            this.updateUI();
            
            // Auto-advance to next pending meal if available
            this.goToNextPendingMeal();
        } catch (error) {
            console.error('Error skipping meal:', error);
            this.showError('Failed to skip meal. Please try again.');
        }
    }

    goToNextPendingMeal() {
        // Find the next pending meal
        const pendingMealIndex = this.meals.findIndex((meal, index) => 
            index > this.currentMealIndex && meal.status === 'pending'
        );
        
        if (pendingMealIndex !== -1) {
            this.currentMealIndex = pendingMealIndex;
            this.updateUI();
        } else {
            // No more pending meals, check if all are done
            const allCompleted = this.meals.every(meal => meal.status !== 'pending');
            if (allCompleted) {
                this.showAllMealsCompleted();
            }
        }
    }

    showAllMealsCompleted() {
        const completedCount = this.meals.filter(meal => meal.status === 'completed').length;
        const skippedCount = this.meals.filter(meal => meal.status === 'skipped').length;
        
        document.getElementById('mealName').textContent = 'All Done!';
        document.getElementById('mealTime').textContent = `${completedCount} completed, ${skippedCount} skipped`;
        document.getElementById('mealItems').innerHTML = `
            <div class="meal-item">
                <div class="item-name">Great job today! Use the arrows to review your meals.</div>
            </div>
        `;
        
        // Don't disable navigation - allow review of completed meals
        document.getElementById('completeMeal').disabled = true;
        document.getElementById('skipMeal').disabled = true;
        document.getElementById('completeMeal').style.opacity = '0.6';
        document.getElementById('skipMeal').style.opacity = '0.6';
    }

    showLoading(message = 'Loading...') {
        this.isLoading = true;
        const overlay = document.getElementById('loadingOverlay');
        overlay.querySelector('p').textContent = message;
        overlay.classList.remove('hidden');
    }

    hideLoading() {
        this.isLoading = false;
        document.getElementById('loadingOverlay').classList.add('hidden');
    }

    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        document.getElementById('errorText').textContent = message;
        errorElement.style.display = 'block';
    }

    hideError() {
        document.getElementById('errorMessage').style.display = 'none';
    }

    // Category modal functionality
    async openCategoryModal(currentItem, itemIndex, specificCategory = null) {
        try {
            this.showLoading('Loading category options...');
            
            // Ensure we have fresh data
            await mealGenerator.loadData();
            
            // Determine which categories to show
            let categoriesToShow;
            if (specificCategory) {
                // User clicked on a specific category tag
                categoriesToShow = [specificCategory];
            } else {
                // User clicked on the item name, show all its categories
                categoriesToShow = currentItem.categories;
            }
            
            // Get all available items for the categories
            const availableItems = this.getItemsForCategories(categoriesToShow);
            
            // Store current context for modal
            this.modalContext = {
                currentItem: currentItem,
                itemIndex: itemIndex,
                categoriesToShow: categoriesToShow
            };
            
            // Populate modal
            this.populateCategoryModal(availableItems, currentItem, categoriesToShow);
            
            // Show modal
            const modal = document.getElementById('categoryModal');
            modal.style.display = 'flex';
            
            // Trigger animation
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
            
            this.hideLoading();
        } catch (error) {
            console.error('Error opening category modal:', error);
            this.showError('Failed to load category options.');
            this.hideLoading();
        }
    }

    getItemsForCategories(categories) {
        const availableItems = mealGenerator.getAvailableItems();
        
        // Filter items that have at least one of the specified categories
        const categoryItems = availableItems.filter(item => {
            const itemCategories = mealGenerator.getItemCategories(item);
            return categories.some(category => itemCategories.includes(category));
        });
        
        // Sort by Last Used (oldest first) - they should already be sorted but ensure it
        categoryItems.sort((a, b) => {
            const dateA = mealGenerator.parseDate(a['Last Used']);
            const dateB = mealGenerator.parseDate(b['Last Used']);
            
            // Primary sort: by date (oldest first)
            const dateDiff = dateA - dateB;
            if (dateDiff !== 0) return dateDiff;
            
            // Secondary sort: alphabetically for consistency
            return a.Item.localeCompare(b.Item);
        });
        
        return categoryItems;
    }

    populateCategoryModal(items, currentItem, categories) {
        const title = document.getElementById('modalTitle');
        const container = document.getElementById('categoryItems');
        
        // Set modal title
        if (categories.length === 1) {
            title.textContent = `${categories[0]} Options`;
        } else {
            title.textContent = `${categories.join(' & ')} Options`;
        }
        
        // Clear container
        container.innerHTML = '';
        
        if (items.length === 0) {
            container.innerHTML = '<div class="no-options">No options available for this category.</div>';
            return;
        }
        
        // Create item elements
        items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'category-item';
            
            // Mark current item
            if (item.Item === currentItem.name) {
                itemElement.classList.add('current');
            }
            
            // Create item info section
            const itemInfo = document.createElement('div');
            itemInfo.className = 'category-item-info';
            
            const itemName = document.createElement('div');
            itemName.className = 'category-item-name';
            itemName.textContent = item.Item;
            
            const itemMeta = document.createElement('div');
            itemMeta.className = 'category-item-meta';
            
            // Add categories
            const categoriesContainer = document.createElement('div');
            categoriesContainer.className = 'category-item-categories';
            
            const itemCategories = mealGenerator.getItemCategories(item);
            itemCategories.forEach(category => {
                const tag = document.createElement('span');
                tag.className = `item-tag ${category.toLowerCase()}`;
                tag.textContent = category;
                categoriesContainer.appendChild(tag);
            });
            
            // Add last used info
            const lastUsed = document.createElement('div');
            lastUsed.className = 'category-item-lastused';
            const lastUsedDate = item['Last Used'] || 'never';
            if (lastUsedDate === 'never') {
                lastUsed.textContent = 'Never used';
            } else if (lastUsedDate.includes('T')) {
                // ISO timestamp
                const date = new Date(lastUsedDate);
                lastUsed.textContent = `Last used: ${date.toLocaleDateString()}`;
            } else {
                lastUsed.textContent = `Last used: ${lastUsedDate}`;
            }
            
            itemMeta.appendChild(categoriesContainer);
            itemMeta.appendChild(lastUsed);
            
            itemInfo.appendChild(itemName);
            itemInfo.appendChild(itemMeta);
            
            itemElement.appendChild(itemInfo);
            
            // Add click handler
            itemElement.addEventListener('click', () => {
                this.selectCategoryItem(item);
            });
            
            container.appendChild(itemElement);
        });
    }

    async selectCategoryItem(selectedItem) {
        try {
            const { currentItem, itemIndex } = this.modalContext;
            
            // Close modal first
            this.closeCategoryModal();
            
            // If user selected the same item, do nothing
            if (selectedItem.Item === currentItem.name) {
                return;
            }
            
            this.showLoading('Replacing item...');
            
            // Replace the item in the current meal
            const currentMeal = this.meals[this.currentMealIndex];
            
            // Update the item at the specified index
            currentMeal.items[itemIndex] = selectedItem;
            
            // Update Last Used for the new item
            const timestamp = new Date().toISOString();
            await sheetsAPI.updateLastUsed(selectedItem.Item, timestamp);
            
            // Save the updated meals
            await sheetsAPI.saveCurrentMeals(this.meals);
            
            // Refresh the UI
            this.updateUI();
            
            this.hideLoading();
            console.log(`Replaced ${currentItem.name} with ${selectedItem.Item}`);
            
        } catch (error) {
            console.error('Error selecting category item:', error);
            this.showError('Failed to replace item. Please try again.');
            this.hideLoading();
        }
    }

    closeCategoryModal() {
        const modal = document.getElementById('categoryModal');
        modal.classList.remove('show');
        
        setTimeout(() => {
            modal.style.display = 'none';
            this.modalContext = null;
        }, 300);
    }
}

// Global function to hide error (called from HTML)
function hideError() {
    app.hideError();
}

// Global function to close category modal (called from HTML)
function closeCategoryModal() {
    app.closeCategoryModal();
}

// Global function to close share modal (called from HTML)
function closeShareModal() {
    app.closeShareModal();
}

// Initialize app when page loads
let app;
document.addEventListener('DOMContentLoaded', async () => {
    // Add a small delay to ensure all scripts are fully loaded
    await new Promise(resolve => setTimeout(resolve, 500));
    
    app = new MealPlanningApp();
    app.init();
});
