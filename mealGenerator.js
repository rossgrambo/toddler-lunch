// Meal Generation Logic
class MealGenerator {
    constructor() {
        this.items = [];
        this.schedule = [];
        this.groceryList = [];
        this.currentMeals = [];
    }

    async loadData() {
        try {
            console.log('Loading data from Google Sheets...');
            
            // Load all required data
            [this.items, this.schedule, this.groceryList] = await Promise.all([
                sheetsAPI.getItems(),
                sheetsAPI.getSchedule(),
                sheetsAPI.getGroceryList()
            ]);

            console.log('Loaded items:', this.items.length);
            console.log('Loaded schedule:', this.schedule.length);
            console.log('Loaded grocery list:', this.groceryList.length);
            
            return true;
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    async getCurrentMeals() {
        try {
            this.currentMeals = await sheetsAPI.getCurrentMeals();
            return this.currentMeals;
        } catch (error) {
            console.error('Error getting current meals:', error);
            throw error;
        }
    }

    async generateMealsForToday() {
        try {
            await this.loadData();
            
            const generatedMeals = [];
            const usedItems = []; // Track items used across all meals today
            
            for (const scheduledMeal of this.schedule) {
                const meal = this.generateSingleMeal(scheduledMeal, usedItems);
                if (meal) {
                    generatedMeals.push(meal);
                    
                    // Add selected items to used items list
                    usedItems.push(...meal.items);
                    
                    // Update Last Used with current timestamp for better granularity
                    const timestamp = new Date().toISOString();
                    for (const item of meal.items) {
                        await sheetsAPI.updateLastUsed(item.Item, timestamp);
                        console.log(`Updated Last Used for ${item.Item} to ${timestamp}`);
                    }
                    
                    // Reload data to get updated Last Used timestamps for next meal generation
                    await this.loadData();
                }
            }
            
            // Save all generated meals to current sheet
            await sheetsAPI.saveCurrentMeals(generatedMeals);
            
            this.currentMeals = generatedMeals;
            return generatedMeals;
        } catch (error) {
            console.error('Error generating meals:', error);
            throw error;
        }
    }

    /**
     * Generate a single meal following the requirements:
     * - Use 1-4 items to satisfy all required categories
     * - No duplicate categories
     * - No extra categories
     * - Prioritize by "Last Used" (oldest first)
     */
    generateSingleMeal(scheduledMeal, usedItems = []) {
        const requiredCategories = this.getRequiredCategories(scheduledMeal);
        const availableItems = this.getAvailableItems(usedItems);
        
        console.log(`\n=== Generating meal: ${scheduledMeal.Name} ===`);
        console.log(`Required categories: [${requiredCategories.join(', ')}]`);
        console.log(`Available items count: ${availableItems.length}`);
        console.log(`Used items this session: [${usedItems.map(item => item.Item || item.name || item).join(', ')}]`);
        
        if (requiredCategories.length === 0) {
            console.warn(`No categories required for ${scheduledMeal.Name}`);
            return null;
        }
        
        // Find optimal combination of items to satisfy exactly the required categories
        const selectedItems = this.findOptimalItemCombination(requiredCategories, availableItems);
        
        if (selectedItems.length === 0) {
            console.warn(`No suitable items found for meal: ${scheduledMeal.Name}`);
            return null;
        }
        
        console.log(`Selected items for ${scheduledMeal.Name}: [${selectedItems.map(item => item.Item).join(', ')}]`);
        
        return {
            name: scheduledMeal.Name,
            time: scheduledMeal.Time,
            items: selectedItems,
            requiredCategories: requiredCategories
        };
    }

    /**
     * Find optimal combination of 1-4 items that satisfy exactly the required categories
     * without duplicates or extras, prioritizing by Last Used date
     */
    findOptimalItemCombination(requiredCategories, availableItems) {
        // Try to find a single item that covers all categories first
        const singleItemSolution = this.findSingleItemSolution(requiredCategories, availableItems);
        if (singleItemSolution) {
            console.log(`Single item solution: ${singleItemSolution.Item}`);
            return [singleItemSolution];
        }
        
        // Use greedy approach to cover all categories with minimal items
        return this.findGreedySolution(requiredCategories, availableItems);
    }

    /**
     * Try to find a single item that covers all required categories exactly
     */
    findSingleItemSolution(requiredCategories, availableItems) {
        // Items are already sorted by Last Used (oldest first), so check in that order
        for (const item of availableItems) {
            const itemCategories = this.getItemCategories(item);
            
            // Check if this item covers exactly the required categories
            if (this.categoriesMatch(itemCategories, requiredCategories)) {
                console.log(`Found single item solution: ${item.Item} covers [${itemCategories.join(', ')}]`);
                return item;
            }
        }
        console.log('No single item solution found, using greedy approach');
        return null;
    }

    /**
     * Use greedy approach to find minimal set of items covering all categories
     */
    findGreedySolution(requiredCategories, availableItems) {
        const selectedItems = [];
        const coveredCategories = new Set();
        const remainingItems = [...availableItems];
        
        console.log(`Starting greedy search for categories: [${requiredCategories.join(', ')}]`);
        
        while (coveredCategories.size < requiredCategories.length && remainingItems.length > 0) {
            let selectedItem = null;
            let selectedIndex = -1;
            
            console.log(`Looking for item to cover remaining categories: [${requiredCategories.filter(cat => !coveredCategories.has(cat)).join(', ')}]`);
            
            // Find the FIRST item (oldest) that can cover at least one remaining category
            for (let i = 0; i < remainingItems.length; i++) {
                const item = remainingItems[i];
                const itemCategories = this.getItemCategories(item);
                
                // Check for category conflicts with already selected items
                const hasConflict = itemCategories.some(cat => coveredCategories.has(cat));
                if (hasConflict) {
                    console.log(`  Skipping ${item.Item} - conflicts with already covered: [${itemCategories.filter(cat => coveredCategories.has(cat)).join(', ')}]`);
                    continue;
                }
                
                // Check for extra categories not in requirements
                const hasExtra = itemCategories.some(cat => !requiredCategories.includes(cat));
                if (hasExtra) {
                    console.log(`  Skipping ${item.Item} - has extra categories: [${itemCategories.filter(cat => !requiredCategories.includes(cat)).join(', ')}]`);
                    continue;
                }
                
                // Count new categories this item would cover
                const newCoverage = itemCategories.filter(cat => 
                    requiredCategories.includes(cat) && !coveredCategories.has(cat)
                ).length;
                
                if (newCoverage > 0) {
                    const lastUsed = item['Last Used'] || 'never';
                    const displayDate = lastUsed === 'never' ? 'never' : 
                                       lastUsed.includes('T') ? new Date(lastUsed).toLocaleString() : lastUsed;
                    console.log(`  Found viable item: ${item.Item} (Last Used: ${displayDate}) - covers ${newCoverage} new categories: [${itemCategories.filter(cat => requiredCategories.includes(cat) && !coveredCategories.has(cat)).join(', ')}]`);
                    
                    // Take the first viable item (oldest by Last Used)
                    selectedItem = item;
                    selectedIndex = i;
                    break; // Stop searching, take the first viable option
                }
            }
            
            if (!selectedItem) {
                console.warn('No valid item found to continue combination');
                break;
            }
            
            // Add selected item and mark its categories as covered
            selectedItems.push(selectedItem);
            const itemCategories = this.getItemCategories(selectedItem);
            itemCategories.forEach(cat => coveredCategories.add(cat));
            remainingItems.splice(selectedIndex, 1);
            
            console.log(`Added ${selectedItem.Item}, covered: [${Array.from(coveredCategories).join(', ')}]`);
            
            // Safety check - max 4 items
            if (selectedItems.length >= 4) break;
        }
        
        // Verify we covered all required categories
        const allCovered = requiredCategories.every(cat => coveredCategories.has(cat));
        if (!allCovered) {
            const missing = requiredCategories.filter(cat => !coveredCategories.has(cat));
            console.warn(`Could not cover all categories. Missing: [${missing.join(', ')}]`);
        }
        
        return selectedItems;
    }

    /**
     * Generate replacement for a specific item in an existing meal
     * Maintains other items while replacing one item following same rules
     */
    generateReplacement(existingMeal, itemIndexToReplace) {
        const itemToReplace = existingMeal.items[itemIndexToReplace];
        const otherItems = existingMeal.items.filter((_, index) => index !== itemIndexToReplace);
        
        // Get categories that the replaced item was providing
        const replacedCategories = this.getItemCategories(itemToReplace);
        
        // Get categories already covered by other items
        const coveredByOthers = new Set();
        otherItems.forEach(item => {
            this.getItemCategories(item).forEach(cat => coveredByOthers.add(cat));
        });
        
        // Find which of the replaced categories are still needed
        const neededCategories = replacedCategories.filter(cat => !coveredByOthers.has(cat));
        
        console.log(`Replacing ${itemToReplace.Item}, needed categories: ${neededCategories}`);
        
        if (neededCategories.length === 0) {
            // All categories already covered by other items, no replacement needed
            console.log('No categories needed - all already covered by other items. No replacement will be added.');
            return [];
        }
        
        // Find replacement items for the needed categories
        const availableItems = this.getAvailableItems([itemToReplace, ...otherItems]);
        return this.findOptimalItemCombination(neededCategories, availableItems);
    }

    /**
     * Get available items sorted by Last Used date, excluding grocery items and specified items
     */
    getAvailableItems(excludeItems = []) {
        const excludeNames = excludeItems.map(item => item.Item || item.name || item);
        
        const filteredItems = this.items
            .filter(item => {
                // Exclude grocery items
                if (this.groceryList.includes(item.Item)) return false;
                
                // Exclude specified items
                if (excludeNames.includes(item.Item)) return false;
                
                return true;
            });

        const sortedItems = filteredItems.sort((a, b) => {
            const dateA = this.parseDate(a['Last Used']);
            const dateB = this.parseDate(b['Last Used']);
            
            // Primary sort: by date (oldest first)
            const dateDiff = dateA - dateB;
            if (dateDiff !== 0) return dateDiff;
            
            // Secondary sort: if dates are equal, sort alphabetically for consistency
            return a.Item.localeCompare(b.Item);
        });

        // Debug logging to verify sorting
        console.log('Available items sorted by Last Used (oldest first):');
        sortedItems.slice(0, 10).forEach((item, index) => {
            const lastUsed = item['Last Used'] || 'never';
            const parsedDate = this.parseDate(lastUsed);
            const displayDate = lastUsed === 'never' ? 'never' : 
                               lastUsed.includes('T') ? parsedDate.toLocaleString() : lastUsed;
            console.log(`  ${index + 1}. ${item.Item}: ${displayDate}`);
        });

        return sortedItems;
    }

    parseDate(dateString) {
        if (!dateString) return new Date(0); // If no date, treat as very old (highest priority)
        
        try {
            // Handle ISO timestamp format (e.g., "2025-08-15T14:30:25.123Z")
            if (dateString.includes('T') && dateString.includes('Z')) {
                return new Date(dateString);
            }
            
            // Handle MM/DD/YYYY format (legacy)
            if (dateString.includes('/')) {
                const [month, day, year] = dateString.split('/');
                return new Date(year, month - 1, day);
            }
            
            // Try parsing as general date string
            return new Date(dateString);
        } catch (error) {
            console.warn(`Failed to parse date: ${dateString}`);
            return new Date(0); // If parse fails, treat as very old (highest priority)
        }
    }

    getRequiredCategories(scheduledMeal) {
        const categories = [];
        
        if (scheduledMeal.Carb === 'y') categories.push('Carb');
        if (scheduledMeal.Protein === 'y') categories.push('Protein');
        if (scheduledMeal.Fruit === 'y') categories.push('Fruit');
        if (scheduledMeal.Veggie === 'y') categories.push('Veggie');
        
        return categories;
    }

    getItemCategories(item) {
        const categories = [];
        
        if (item.Carb === 'y') categories.push('Carb');
        if (item.Protein === 'y') categories.push('Protein');
        if (item.Fruit === 'y') categories.push('Fruit');
        if (item.Veggie === 'y') categories.push('Veggie');
        
        return categories;
    }

    /**
     * Check if two category arrays match exactly (same categories, no extras)
     */
    categoriesMatch(categories1, categories2) {
        if (categories1.length !== categories2.length) return false;
        
        const set1 = new Set(categories1);
        const set2 = new Set(categories2);
        
        return categories1.every(cat => set2.has(cat)) && 
               categories2.every(cat => set1.has(cat));
    }

    async checkIfNeedsNewMeals() {
        try {
            const currentMeals = await this.getCurrentMeals();
            
            // If no current meals, we need to generate
            if (currentMeals.length === 0) {
                console.log('No current meals found, generating new ones');
                return true;
            }
            
            // Check if current meals are for today
            const today = getTodayString();
            const mealDate = currentMeals[0].date; // All meals should have the same date
            
            if (mealDate !== today) {
                console.log(`Current meals are for ${mealDate}, but today is ${today}. Need new meals.`);
                return true;
            }
            
            console.log('Current meals found for today:', currentMeals.length);
            return false;
        } catch (error) {
            console.error('Error checking if needs new meals:', error);
            return true; // Generate new meals on error
        }
    }

    async forceRegenerateToday() {
        try {
            console.log('Force regenerating meals for today...');
            
            // Clear current meals first
            await sheetsAPI.clearRange(CONFIG.SHEETS.CURRENT, 'A:Z');
            
            // Generate new meals
            return await this.generateMealsForToday();
        } catch (error) {
            console.error('Error force regenerating meals:', error);
            throw error;
        }
    }

    async handleNewDay() {
        try {
            console.log('Handling new day - moving completed meals to history and clearing old meals');
            
            // Get current meals to check for completed ones
            const currentMeals = await sheetsAPI.getCurrentMeals();
            
            if (currentMeals.length > 0) {
                // Move only completed meals to history (if any)
                const completedMeals = currentMeals.filter(meal => meal.status === 'completed');
                if (completedMeals.length > 0) {
                    const historyData = completedMeals.map(meal => {
                        const row = [meal.date, meal['meal name']];
                        for (let i = 1; i <= 4; i++) {
                            row.push(meal[`item ${i}`] || '');
                        }
                        return row;
                    });
                    await sheetsAPI.appendRange(CONFIG.SHEETS.HISTORY, historyData);
                    console.log(`Moved ${completedMeals.length} completed meals to history`);
                }
                
                // Clear all current meals (both completed and incomplete from previous day)
                await sheetsAPI.clearRange(CONFIG.SHEETS.CURRENT, 'A:Z');
            }
            
            // Generate new meals for today
            await this.generateMealsForToday();
            
            return true;
        } catch (error) {
            console.error('Error handling new day:', error);
            throw error;
        }
    }

    formatMealForDisplay(meal) {
        return {
            name: meal.name,
            time: formatTimeDisplay(meal.time),
            items: meal.items.map(item => ({
                name: item.Item,
                categories: this.getItemCategories(item),
                tags: item.Tags ? item.Tags.split(',') : [],
                difficulty: item.difficulty || item.Difficulty || 0
            }))
        };
    }
}

// Create global instance
const mealGenerator = new MealGenerator();
