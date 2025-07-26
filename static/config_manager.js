// Configuration Management for qPCR Analysis
// This script provides centralized configuration loading and management

class ConfigManager {
    constructor() {
        this.concentrationControls = null;
        this.isLoading = false;
        this.loadPromise = null;
    }

    /**
     * Load concentration controls from centralized JSON config
     * @returns {Promise<Object>} Concentration controls object
     */
    async loadConcentrationControls() {
        if (this.concentrationControls) {
            return this.concentrationControls;
        }

        if (this.isLoading) {
            return this.loadPromise;
        }

        this.isLoading = true;
        this.loadPromise = this._loadConfigFromServer();
        
        try {
            this.concentrationControls = await this.loadPromise;
            console.log('[CONFIG-MANAGER] Loaded centralized concentration controls for', Object.keys(this.concentrationControls).length, 'tests');
        } catch (error) {
            console.warn('[CONFIG-MANAGER] Failed to load centralized config, using fallback:', error);
            this.concentrationControls = this._getFallbackControls();
        } finally {
            this.isLoading = false;
        }

        return this.concentrationControls;
    }

    /**
     * Load configuration from server
     * @private
     */
    async _loadConfigFromServer() {
        const response = await fetch('/config/concentration_controls.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const config = await response.json();
        return config.controls || {};
    }

    /**
     * Get fallback controls if centralized config fails
     * @private
     */
    _getFallbackControls() {
        // Use the existing CONCENTRATION_CONTROLS as fallback
        return typeof CONCENTRATION_CONTROLS !== 'undefined' ? CONCENTRATION_CONTROLS : {};
    }

    /**
     * Get control values for a specific test/channel
     * @param {string} testCode - Test code (e.g., 'Cglab', 'Ngon')
     * @param {string} channel - Channel/fluorophore (e.g., 'FAM', 'HEX')
     * @returns {Object} Control values {H, M, L}
     */
    async getTestControls(testCode, channel) {
        const controls = await this.loadConcentrationControls();
        return controls[testCode]?.[channel] || {};
    }

    /**
     * Get a specific control value
     * @param {string} testCode - Test code
     * @param {string} channel - Channel/fluorophore  
     * @param {string} controlType - Control type ('H', 'M', 'L')
     * @returns {number|null} Concentration value
     */
    async getControlValue(testCode, channel, controlType) {
        const controls = await this.getTestControls(testCode, channel);
        return controls[controlType] || null;
    }

    /**
     * Update the CONCENTRATION_CONTROLS global variable with loaded config
     * This ensures backward compatibility with existing code
     */
    async updateGlobalControls() {
        const controls = await this.loadConcentrationControls();
        if (typeof window !== 'undefined') {
            window.CONCENTRATION_CONTROLS = controls;
        }
        if (typeof global !== 'undefined') {
            global.CONCENTRATION_CONTROLS = controls;
        }
        // Also update the existing global if it exists
        if (typeof CONCENTRATION_CONTROLS !== 'undefined') {
            Object.assign(CONCENTRATION_CONTROLS, controls);
        }
    }
}

// Create global instance
const configManager = new ConfigManager();

// Auto-load configuration when script loads
configManager.updateGlobalControls().catch(error => {
    console.error('[CONFIG-MANAGER] Auto-load failed:', error);
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { configManager, ConfigManager };
}

// Make available globally
if (typeof window !== 'undefined') {
    window.configManager = configManager;
}
