/**
 * Channel Completion Polling System for Multichannel Processing
 * Part of Phase 1: Backend Channel Completion Tracking
 */

// Channel completion polling configuration
const CHANNEL_POLLING_CONFIG = {
    interval: 2000,  // Poll every 2 seconds
    maxAttempts: 150,  // Max 5 minutes (150 * 2 seconds)
    timeout: 300000   // 5 minute timeout
};

/**
 * Poll for completion of all required channels for an experiment
 * @param {string} experimentPattern - The experiment pattern (e.g., "AcBVAB_2578825_CFX367393")
 * @param {Array} requiredFluorophores - Array of required fluorophore channels
 * @returns {Promise} Promise that resolves when all channels complete or rejects on timeout/failure
 */
async function pollChannelCompletion(experimentPattern, requiredFluorophores) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        
        console.log(`🔄 Starting channel completion polling for ${experimentPattern}`, {
            requiredFluorophores,
            maxAttempts: CHANNEL_POLLING_CONFIG.maxAttempts
        });
        
        const pollInterval = setInterval(async () => {
            attempts++;
            
            try {
                const response = await fetch('/channels/completion/poll', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        experiment_pattern: experimentPattern,
                        required_fluorophores: requiredFluorophores
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Polling request failed: ${response.status}`);
                }
                
                const data = await response.json();
                
                console.log(`🔄 Channel polling attempt ${attempts}/${CHANNEL_POLLING_CONFIG.maxAttempts}:`, {
                    experimentPattern,
                    allCompleted: data.all_completed,
                    anyFailed: data.any_failed,
                    readyForCombination: data.ready_for_combination,
                    channels: data.channels
                });
                
                // Check if all channels completed successfully
                if (data.ready_for_combination) {
                    clearInterval(pollInterval);
                    console.log(`✅ All channels completed successfully for ${experimentPattern}`);
                    resolve(data);
                    return;
                }
                
                // Check if any channels failed
                if (data.any_failed) {
                    clearInterval(pollInterval);
                    console.error(`❌ One or more channels failed for ${experimentPattern}`, data.channels);
                    reject(new Error(`Channel processing failed: ${JSON.stringify(data.channels)}`));
                    return;
                }
                
                // Check timeout
                if (attempts >= CHANNEL_POLLING_CONFIG.maxAttempts) {
                    clearInterval(pollInterval);
                    console.error(`⏰ Channel completion polling timeout for ${experimentPattern}`);
                    reject(new Error(`Timeout waiting for channel completion after ${attempts} attempts`));
                    return;
                }
                
                // Continue polling - channels still processing
                console.log(`⏳ Channels still processing, continuing to poll...`);
                
            } catch (error) {
                clearInterval(pollInterval);
                console.error(`💥 Error during channel completion polling:`, error);
                reject(error);
            }
            
        }, CHANNEL_POLLING_CONFIG.interval);
        
        // Set overall timeout
        setTimeout(() => {
            clearInterval(pollInterval);
            if (attempts < CHANNEL_POLLING_CONFIG.maxAttempts) {
                console.error(`⏰ Overall timeout reached for channel completion polling`);
                reject(new Error(`Overall timeout reached for channel completion`));
            }
        }, CHANNEL_POLLING_CONFIG.timeout);
    });
}

/**
 * Get completion status for an experiment
 * @param {string} experimentPattern - The experiment pattern
 * @returns {Promise} Promise that resolves with completion status
 */
async function getChannelCompletionStatus(experimentPattern) {
    try {
        const response = await fetch(`/channels/status/${encodeURIComponent(experimentPattern)}`);
        
        if (!response.ok) {
            throw new Error(`Status request failed: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        console.error(`Error getting channel completion status:`, error);
        throw error;
    }
}

/**
 * Display channel completion progress to user
 * @param {string} experimentPattern - The experiment pattern
 * @param {Array} requiredFluorophores - Array of required fluorophores
 * @param {HTMLElement} progressContainer - Container element for progress display
 */
function displayChannelProgress(experimentPattern, requiredFluorophores, progressContainer) {
    if (!progressContainer) {
        console.warn('No progress container provided for channel progress display');
        return;
    }
    
    // Create progress display
    progressContainer.innerHTML = `
        <div class="channel-progress-container">
            <h4>Processing Channels for ${experimentPattern}</h4>
            <div class="progress-channels">
                ${requiredFluorophores.map(fluorophore => `
                    <div class="channel-progress-item" id="progress-${fluorophore}">
                        <span class="fluorophore-tag fluorophore-${fluorophore.toLowerCase()}">${fluorophore}</span>
                        <span class="progress-status">Pending...</span>
                        <div class="progress-spinner"></div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Update progress display with current channel status
 * @param {Object} channelData - Channel completion data from polling
 */
function updateChannelProgress(channelData) {
    if (!channelData || !channelData.channels) return;
    
    Object.entries(channelData.channels).forEach(([fluorophore, status]) => {
        const progressItem = document.getElementById(`progress-${fluorophore}`);
        if (!progressItem) return;
        
        const statusElement = progressItem.querySelector('.progress-status');
        const spinner = progressItem.querySelector('.progress-spinner');
        
        switch (status.status) {
            case 'completed':
                statusElement.textContent = '✅ Completed';
                statusElement.className = 'progress-status completed';
                spinner.style.display = 'none';
                break;
            case 'processing':
                statusElement.textContent = '⏳ Processing...';
                statusElement.className = 'progress-status processing';
                spinner.style.display = 'block';
                break;
            case 'failed':
                statusElement.textContent = '❌ Failed';
                statusElement.className = 'progress-status failed';
                spinner.style.display = 'none';
                break;
            default:
                statusElement.textContent = '⏸️ Pending';
                statusElement.className = 'progress-status pending';
                spinner.style.display = 'none';
        }
    });
}

// Export functions for use in main script
if (typeof window !== 'undefined') {
    window.pollChannelCompletion = pollChannelCompletion;
    window.getChannelCompletionStatus = getChannelCompletionStatus;
    window.displayChannelProgress = displayChannelProgress;
    window.updateChannelProgress = updateChannelProgress;
}
