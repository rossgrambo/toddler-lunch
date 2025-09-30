// Home Secrets Client for OAuth Authorization Code Flow with PKCE
class HomeSecretsClient {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiryTime = null;
        this.isSignedIn = false;
        this.clientId = null;
        this.redirectUri = null;
        this.baseUrl = null; // Will be set from config
        this.codeVerifier = null;
        this.state = null;
    }

    /**
     * Initialize the client with configuration
     */
    async initialize(config) {
        this.baseUrl = config.BASE_URL;
        this.clientId = config.CLIENT_ID;
        this.redirectUri = config.REDIRECT_URI;
        
        // Handle API key from URL and localStorage
        const urlApiKey = StorageHelper.getApiKeyFromUrl();
        const storedApiKey = StorageHelper.loadApiKey();
        
        if (urlApiKey) {
            // If API key is provided in URL, save it to localStorage and use it
            this.apiKey = urlApiKey;
            StorageHelper.saveApiKey(urlApiKey);
            console.log('API key provided in URL and saved to localStorage');
        } else if (storedApiKey) {
            // If no API key in URL but one exists in localStorage, use the stored one
            this.apiKey = storedApiKey;
            console.log('Using stored API key from localStorage');
        } else {
            // No API key available
            this.apiKey = null;
            console.log('No API key available');
        }
        
        console.log('Initializing Home Secrets Client...');
        console.log('Base URL:', this.baseUrl);
        console.log('Client ID:', this.clientId);
        console.log('Redirect URI:', this.redirectUri);
        console.log('Current URL:', window.location.href);
        console.log('URL search params:', window.location.search);
        console.log('API Key retrieved:', this.apiKey);
        console.log('API Key provided:', this.apiKey ? 'Yes' : 'No');
        
        // Step 1: Check if we're returning from OAuth callback
        await this.handleOAuthCallback();
        
        // Step 2: Always check token validity with server (this is the main authentication check)
        console.log('Checking token validity with Home Secrets service...');
        const isValid = await this.checkTokenValidity();
        
        if (isValid) {
            console.log('Valid token found - user is signed in');
            this.isSignedIn = true;
        } else {
            console.log('No valid token found - user needs to sign in');
            this.isSignedIn = false;
            // Clear any stored tokens since they're invalid
            this.clearStoredTokens();
        }
        
        console.log('Home Secrets Client initialized. Signed in:', this.isSignedIn);
        return true;
    }

    /**
     * Check if user is currently signed in
     */
    isUserSignedIn() {
        return this.isSignedIn && this.accessToken && !this.isTokenExpired();
    }

    /**
     * Check token validity with the Home Secrets service
     */
    async checkTokenValidity() {
        try {
            console.log('Calling /oauth/google/token endpoint...');
            
            // Build token check URL with API key if available
            let tokenUrl = `${this.baseUrl}/oauth/google/token`;
            if (this.apiKey) {
                const urlParams = new URLSearchParams();
                urlParams.append('api-key', this.apiKey);
                tokenUrl += `?${urlParams.toString()}`;
            }
            
            console.log('Token endpoint URL:', tokenUrl);
            
            const response = await fetch(tokenUrl, {
                method: 'GET',
                headers: this.getRequestHeaders()
            });
            
            console.log('Token endpoint response status:', response.status);
            
            if (response.status === 401 || response.status === 403) {
                // No valid token available
                console.log('No valid token available (401/403 response)');
                this.clearTokenState();
                return false;
            }
            
            if (!response.ok) {
                console.error('Token endpoint error:', response.status);
                this.clearTokenState();
                return false;
            }
            
            const tokenData = await response.json();
            console.log('Token endpoint response:', tokenData);
            
            // Update our stored token information
            if (tokenData.access_token) {
                console.log('Access token found in response, updating local state...');
                this.accessToken = tokenData.access_token;
                
                // Update expiry time if provided
                if (tokenData.expiry) {
                    // expiry might be a timestamp or ISO string
                    if (typeof tokenData.expiry === 'string') {
                        this.tokenExpiryTime = new Date(tokenData.expiry).getTime();
                    } else {
                        // Assume it's a Unix timestamp in seconds, convert to milliseconds
                        this.tokenExpiryTime = tokenData.expiry * 1000;
                    }
                    console.log('Token expiry set to:', new Date(this.tokenExpiryTime).toISOString());
                } else {
                    // Default to 1 hour if no expiry provided
                    this.tokenExpiryTime = Date.now() + (3600 * 1000);
                    console.log('No expiry provided, defaulting to 1 hour from now');
                }
                
                // Store refresh token if provided
                if (tokenData.refresh_token) {
                    this.refreshToken = tokenData.refresh_token;
                }
                
                // Persist updated tokens
                this.persistTokens();
                
                console.log('Valid token received and stored. Access token length:', this.accessToken ? this.accessToken.length : 0);
                console.log('checkTokenValidity() returning true');
                return true;
            }
            
            console.log('No access token in response');
            this.clearTokenState();
            return false;
            
        } catch (error) {
            console.error('Error checking token validity:', error);
            this.clearTokenState();
            return false;
        }
    }

    /**
     * Clear token state when tokens are invalid
     */
    clearTokenState() {
        this.isSignedIn = false;
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiryTime = null;
        this.clearStoredTokens();
    }

    /**
     * Check if the current access token has expired
     */
    isTokenExpired() {
        if (!this.tokenExpiryTime) {
            console.log('No token expiry time set - considering expired');
            return true;
        }
        const now = Date.now();
        const expired = now >= this.tokenExpiryTime;
        console.log('Token expiry check:', {
            now: new Date(now).toISOString(),
            expiry: new Date(this.tokenExpiryTime).toISOString(),
            expired: expired
        });
        return expired;
    }

    /**
     * Get headers for API requests including API key if available
     */
    getRequestHeaders(additionalHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...additionalHeaders
        };
        
        // Add API key header if available
        if (this.apiKey) {
            headers['X-API-Key'] = this.apiKey;
        }
        
        return headers;
    }

    /**
     * Start the OAuth authorization flow
     */
    async signIn() {
        try {
            console.log('Starting OAuth authorization flow...');
            console.log('Current API key:', this.apiKey);
            console.log('API key type:', typeof this.apiKey);
            console.log('API key length:', this.apiKey ? this.apiKey.length : 0);
            
            // Build the OAuth start URL with API key as parameter if available
            let oauthStartUrl = `${this.baseUrl}/oauth/google/start`;
            const urlParams = new URLSearchParams();
            
            if (this.apiKey) {
                urlParams.append('api-key', this.apiKey);
                console.log('API key added to URL');
            } else {
                console.log('No API key available - URL will not include api-key parameter');
            }
            
            // Pass the redirect URI so server knows where to redirect back to
            urlParams.append('redirect_uri', this.redirectUri);
            console.log('Redirect URI being sent to server:', this.redirectUri);
            
            if (urlParams.toString()) {
                oauthStartUrl += `?${urlParams.toString()}`;
            }
            
            console.log('Final OAuth start URL:', oauthStartUrl);
            console.log('Expected redirect URI should be:', this.redirectUri);
            console.log('Headers:', this.getRequestHeaders());
            
            // Call the Home Secrets service to start OAuth flow
            const response = await fetch(oauthStartUrl, {
                method: 'GET',
                headers: this.getRequestHeaders()
            });
            
            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                const errorData = await response.text();
                console.error('Failed to start OAuth flow:', response.status, errorData);
                throw new Error(`Failed to start OAuth flow: ${response.status} - ${errorData}`);
            }
            
            const responseText = await response.text();
            console.log('Raw response:', responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse JSON response:', parseError);
                // Maybe the response is just the URL as plain text?
                if (responseText.startsWith('http')) {
                    console.log('Response appears to be a plain URL, using it directly');
                    window.location.href = responseText.trim();
                    return;
                } else {
                    throw new Error(`Invalid response format: ${responseText}`);
                }
            }
            
            console.log('Parsed response data:', data);
            
            // Try different possible property names for the authorization URL
            const authUrl = data.authorization_url || data.authorize_url || data.auth_url || data.url || data.redirect_url;
            
            if (!authUrl) {
                console.error('Available properties in response:', Object.keys(data));
                throw new Error(`No authorization URL found in response. Available properties: ${Object.keys(data).join(', ')}`);
            }
            
            console.log('Redirecting to authorization URL:', authUrl);
            
            // Redirect to the authorization URL provided by the server
            window.location.href = authUrl;
            
        } catch (error) {
            console.error('Error starting OAuth flow:', error);
            
            // Provide more specific error messages
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error(`Network error: Unable to connect to Home Secrets service at ${this.baseUrl}. Please check if the service is running and accessible.`);
            } else if (error.message.includes('Failed to start OAuth flow:')) {
                throw error; // Re-throw HTTP errors as-is
            } else {
                throw new Error('Failed to start authorization process');
            }
        }
    }

    /**
     * Handle OAuth callback after user returns from authorization server
     */
    async handleOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        
        console.log('Checking for OAuth callback parameters...');
        console.log('Current URL:', window.location.href);
        console.log('Query parameters:', Object.fromEntries(urlParams.entries()));
        
        if (error) {
            console.error('OAuth error:', error, urlParams.get('error_description'));
            throw new Error(`Authorization failed: ${error}`);
        }
        
        if (!authCode) {
            // Not a callback, normal page load
            console.log('No authorization code found - not a callback');
            return;
        }
        
        try {
            console.log('Processing OAuth callback...');
            console.log('Authorization code:', authCode);
            console.log('State:', state);
            
            // First, call the callback endpoint to complete the OAuth flow
            let callbackUrl = `${this.baseUrl}/oauth/google/callback?${window.location.search.substring(1)}`;
            
            // Add API key to callback URL if available and not already present
            if (this.apiKey) {
                const urlParams = new URLSearchParams(window.location.search);
                if (!urlParams.has('api-key')) {
                    const separator = callbackUrl.includes('?') ? '&' : '?';
                    callbackUrl += `${separator}api-key=${encodeURIComponent(this.apiKey)}`;
                }
            }
            
            console.log('Calling callback URL:', callbackUrl);
            
            const callbackResponse = await fetch(callbackUrl, {
                method: 'GET',
                headers: this.getRequestHeaders()
            });
            
            console.log('Callback response status:', callbackResponse.status);
            
            if (!callbackResponse.ok) {
                const errorData = await callbackResponse.text();
                console.error('Callback processing failed:', callbackResponse.status, errorData);
                throw new Error(`Callback processing failed: ${callbackResponse.status} - ${errorData}`);
            }
            
            // The callback endpoint processes the OAuth code
            console.log('OAuth callback completed successfully');
            console.log('Token validation will be handled by main initialization flow');
            
            // Clean up URL by removing query parameters
            const cleanUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            
            console.log('OAuth callback processed successfully');
            console.log('Access token received:', this.accessToken ? 'Yes' : 'No');
            
        } catch (error) {
            console.error('Error processing OAuth callback:', error);
            throw error;
        }
    }



    /**
     * Try to restore session from stored tokens
     */
    async tryRestoreSession() {
        try {
            const storedData = localStorage.getItem('home_secrets_tokens');
            if (!storedData) {
                console.log('No stored tokens found');
                return false;
            }
            
            const tokenData = JSON.parse(storedData);
            
            this.accessToken = tokenData.access_token;
            this.refreshToken = tokenData.refresh_token;
            this.tokenExpiryTime = tokenData.expiry_time;
            
            // Check if access token is still valid
            if (!this.isTokenExpired()) {
                console.log('Restored valid access token from storage');
                this.isSignedIn = true;
                return true;
            }
            
            // Try to refresh the token
            if (this.refreshToken) {
                console.log('Access token expired, attempting refresh...');
                const refreshed = await this.refreshAccessToken();
                if (refreshed) {
                    console.log('Successfully refreshed access token');
                    this.isSignedIn = true;
                    return true;
                }
            }
            
            console.log('Could not restore or refresh tokens');
            this.clearStoredTokens();
            return false;
            
        } catch (error) {
            console.error('Error restoring session:', error);
            this.clearStoredTokens();
            return false;
        }
    }

    /**
     * Refresh the access token using the refresh token
     */
    async refreshAccessToken() {
        if (!this.refreshToken) {
            console.log('No refresh token available');
            return false;
        }
        
        try {
            console.log('Refreshing access token...');
            
            // Build refresh URL with API key if available
            let refreshUrl = `${this.baseUrl}/oauth/google/refresh`;
            if (this.apiKey) {
                const urlParams = new URLSearchParams();
                urlParams.append('api-key', this.apiKey);
                refreshUrl += `?${urlParams.toString()}`;
            }
            
            const response = await fetch(refreshUrl, {
                method: 'POST',
                headers: this.getRequestHeaders(),
                body: JSON.stringify({
                    refresh_token: this.refreshToken
                })
            });
            
            if (!response.ok) {
                const errorData = await response.text();
                console.error('Token refresh failed:', response.status, errorData);
                return false;
            }
            
            const tokenData = await response.json();
            
            // Update access token
            this.accessToken = tokenData.access_token;
            
            // Update refresh token if provided
            if (tokenData.refresh_token) {
                this.refreshToken = tokenData.refresh_token;
            }
            
            // Calculate new expiry time
            const expiresIn = tokenData.expires_in || 3600;
            this.tokenExpiryTime = Date.now() + (expiresIn * 1000);
            
            // Persist updated tokens
            this.persistTokens();
            
            console.log('Access token refreshed successfully');
            return true;
            
        } catch (error) {
            console.error('Error refreshing access token:', error);
            return false;
        }
    }

    /**
     * Get current access token, refreshing if necessary
     */
    async getAccessToken() {
        console.log('getAccessToken called. isSignedIn:', this.isSignedIn, 'hasAccessToken:', !!this.accessToken);
        
        if (!this.isSignedIn) {
            throw new Error('User not signed in');
        }
        
        // Check if token needs refresh
        if (this.isTokenExpired()) {
            console.log('Access token expired, refreshing...');
            const refreshed = await this.refreshAccessToken();
            if (!refreshed) {
                this.signOut();
                throw new Error('Unable to refresh access token - please sign in again');
            }
        }
        
        console.log('Returning access token with length:', this.accessToken ? this.accessToken.length : 0);
        return this.accessToken;
    }

    /**
     * Sign out the user
     */
    async signOut() {
        try {
            // Revoke tokens if possible
            if (this.accessToken) {
                try {
                    // Build revoke URL with API key if available
                    let revokeUrl = `${this.baseUrl}/oauth/google/revoke`;
                    if (this.apiKey) {
                        const urlParams = new URLSearchParams();
                        urlParams.append('api-key', this.apiKey);
                        revokeUrl += `?${urlParams.toString()}`;
                    }
                    
                    await fetch(revokeUrl, {
                        method: 'POST',
                        headers: this.getRequestHeaders(),
                        body: JSON.stringify({
                            token: this.accessToken
                        })
                    });
                } catch (error) {
                    console.warn('Error revoking token:', error);
                    // Continue with logout even if revocation fails
                }
            }
            
            // Clear local state
            this.accessToken = null;
            this.refreshToken = null;
            this.tokenExpiryTime = null;
            this.isSignedIn = false;
            
            // Clear stored tokens
            this.clearStoredTokens();
            
            console.log('User signed out successfully');
            
        } catch (error) {
            console.error('Error during sign out:', error);
            // Still clear local state even if server-side logout fails
            this.accessToken = null;
            this.refreshToken = null;
            this.tokenExpiryTime = null;
            this.isSignedIn = false;
            this.clearStoredTokens();
        }
    }

    /**
     * Persist tokens to localStorage
     */
    persistTokens() {
        try {
            const tokenData = {
                access_token: this.accessToken,
                refresh_token: this.refreshToken,
                expiry_time: this.tokenExpiryTime
            };
            
            localStorage.setItem('home_secrets_tokens', JSON.stringify(tokenData));
        } catch (error) {
            console.error('Error persisting tokens:', error);
        }
    }

    /**
     * Clear stored tokens from localStorage
     */
    clearStoredTokens() {
        try {
            localStorage.removeItem('home_secrets_tokens');
        } catch (error) {
            console.error('Error clearing stored tokens:', error);
        }
    }

    /**
     * Generate a cryptographically secure code verifier for PKCE
     */
    generateCodeVerifier() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return this.base64URLEncode(array);
    }

    /**
     * Generate code challenge from code verifier
     */
    async generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return this.base64URLEncode(new Uint8Array(digest));
    }

    /**
     * Generate a random string for state parameter
     */
    generateRandomString(length) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Base64 URL encode (without padding)
     */
    base64URLEncode(array) {
        return btoa(String.fromCharCode.apply(null, array))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }
}

// Create global instance
const homeSecretsClient = new HomeSecretsClient();
