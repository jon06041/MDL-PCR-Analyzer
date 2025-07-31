/**
 * Integration Helper for ML Configuration
 * Use this in your main qPCR analysis scripts to check ML enabled status
 */

// Example integration with existing qPCR analysis code
async function checkMLEnabledForPathogen(pathogenCode, fluorophore) {
    try {
        const response = await fetch(`/api/ml-config/check-enabled/${encodeURIComponent(pathogenCode)}/${encodeURIComponent(fluorophore)}`);
        const data = await response.json();
        
        if (data.success) {
            return data.enabled;
        } else {
            console.warn(`Failed to check ML status for ${pathogenCode}/${fluorophore}:`, data.error);
            return true; // Default to enabled if check fails
        }
    } catch (error) {
        console.error('ML config check failed:', error);
        return true; // Default to enabled on network error
    }
}

// Example usage in analysis workflow
async function performAnalysisWithMLCheck(wellData) {
    const pathogenCode = wellData.pathogen_code;
    const fluorophore = wellData.fluorophore;
    
    // Check if ML is enabled for this pathogen/fluorophore combination
    const mlEnabled = await checkMLEnabledForPathogen(pathogenCode, fluorophore);
    
    if (mlEnabled) {
        console.log(`ML classification enabled for ${pathogenCode}/${fluorophore}`);
        // Proceed with ML classification
        return await performMLClassification(wellData);
    } else {
        console.log(`ML classification disabled for ${pathogenCode}/${fluorophore}`);
        // Use traditional analysis method
        return await performTraditionalAnalysis(wellData);
    }
}

// Example integration in existing ML classification code
async function performMLClassification(wellData) {
    // First check if ML is enabled
    const mlEnabled = await checkMLEnabledForPathogen(
        wellData.pathogen_code, 
        wellData.fluorophore
    );
    
    if (!mlEnabled) {
        return {
            classification: 'disabled',
            confidence: null,
            message: 'ML classification disabled for this pathogen/fluorophore'
        };
    }
    
    // Proceed with normal ML classification
    // ... existing ML classification code ...
}

// Example: Bulk check for multiple pathogens
async function checkMLStatusForSession(sessionData) {
    const mlStatuses = new Map();
    
    for (const well of sessionData.wells) {
        const key = `${well.pathogen_code}_${well.fluorophore}`;
        
        if (!mlStatuses.has(key)) {
            const enabled = await checkMLEnabledForPathogen(
                well.pathogen_code, 
                well.fluorophore
            );
            mlStatuses.set(key, enabled);
        }
        
        // Add ML status to well data
        well.ml_enabled = mlStatuses.get(key);
    }
    
    return sessionData;
}

// Example: Show ML status in UI
function updateUIWithMLStatus(pathogenCode, fluorophore, elementId) {
    checkMLEnabledForPathogen(pathogenCode, fluorophore).then(enabled => {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <span class="ml-status ${enabled ? 'enabled' : 'disabled'}">
                    ML: ${enabled ? 'ON' : 'OFF'}
                </span>
            `;
        }
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkMLEnabledForPathogen,
        performAnalysisWithMLCheck,
        checkMLStatusForSession,
        updateUIWithMLStatus
    };
}
