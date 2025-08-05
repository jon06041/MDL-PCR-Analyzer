// ML Feedback Persistence Fix
// ===============================
// This file contains the fixes needed to ensure expert feedback persists across page refreshes

// PROBLEM ANALYSIS:
// 1. Expert feedback is submitted to backend ✅ (working)
// 2. Backend saves to database ✅ (working) 
// 3. Modal navigation gets broken after feedback ❌ (needs fix)
// 4. Expert feedback doesn't persist on page refresh ❌ (needs fix)

// ROOT CAUSES:
// 1. session_id might be null when submitting feedback
// 2. Modal navigation isn't rebuilt after table updates
// 3. Data loading on refresh doesn't include expert feedback from database
// 4. Global data gets overwritten when table is updated

// COMPREHENSIVE FIX NEEDED:
// =========================

// 1. ENSURE SESSION ID IS ALWAYS AVAILABLE
function ensureSessionIdAvailable() {
    if (!window.currentSessionId) {
        // Try to get from analysis results
        if (window.currentAnalysisResults && window.currentAnalysisResults.session_id) {
            window.currentSessionId = window.currentAnalysisResults.session_id;
        } else {
            // Generate a session ID based on current timestamp and file data
            const timestamp = new Date().toISOString().replace(/[:.]/g, '');
            window.currentSessionId = `session_${timestamp}`;
        }
        console.log('🔧 Generated/recovered session ID:', window.currentSessionId);
    }
    return window.currentSessionId;
}

// 2. FORCE DATABASE SAVE WITH FALLBACK SESSION ID
function enhanceFeedbackSubmission() {
    // In ml_feedback_interface.js, modify the fetch to:
    /*
    const response = await fetch('/api/ml-submit-feedback', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            rfu_data: rawRfu,
            cycles: rawCycles,
            well_data: submissionWellData,
            expert_classification: expertClassification,
            well_id: wellKey,
            session_id: ensureSessionIdAvailable(), // CRITICAL: Always provide session ID
            force_database_save: true, // Force save even if session lookup fails
            original_well_key: wellKey, // Backup identifier
            existing_metrics: {
                // ... existing metrics
            }
        })
    });
    */
}

// 3. ENHANCE BACKEND TO HANDLE MISSING SESSION
function enhanceBackendFeedbackHandler() {
    // In app.py ml_submit_feedback function, add:
    /*
    # Enhanced session handling
    session_id = data.get('session_id')
    well_id = data.get('well_id', 'unknown')
    force_save = data.get('force_database_save', False)
    
    # If no session_id provided, try to find by well_id pattern or create one
    if not session_id:
        # Try to find existing session by well pattern
        existing_result = WellResult.query.filter(
            WellResult.well_id.like(f"{well_id.split('_')[0]}%")
        ).first()
        
        if existing_result:
            session_id = existing_result.session_id
        else:
            # Create a fallback session ID
            session_id = f"expert_feedback_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    
    # Always try to save to database, even if session lookup fails
    try:
        well_result = WellResult.query.filter_by(session_id=session_id, well_id=well_id).first()
        
        if not well_result and force_save:
            # Create a new WellResult entry for expert feedback
            well_result = WellResult(
                session_id=session_id,
                well_id=well_id,
                sample_name=well_data.get('sample', 'Expert_Feedback'),
                curve_classification=json.dumps({
                    'class': expert_classification,
                    'confidence': 1.0,
                    'method': 'Expert Review',
                    'expert_classification': expert_classification,
                    'expert_review_method': 'ml_feedback_interface',
                    'expert_review_timestamp': datetime.utcnow().isoformat()
                })
            )
            db.session.add(well_result)
        
        if well_result:
            # Update existing result
            current_classification = {}
            if well_result.curve_classification:
                try:
                    current_classification = json.loads(well_result.curve_classification)
                except:
                    current_classification = {}
            
            current_classification.update({
                'class': expert_classification,
                'confidence': 1.0,
                'method': 'Expert Review',
                'expert_classification': expert_classification,
                'expert_review_method': 'ml_feedback_interface',
                'expert_review_timestamp': datetime.utcnow().isoformat()
            })
            
            well_result.curve_classification = json.dumps(current_classification)
            db.session.commit()
            
            print(f"✅ FORCE SAVED expert feedback to database: {expert_classification}")
    
    except Exception as db_error:
        print(f"❌ Database save failed: {db_error}")
    */
}

// 4. MODAL NAVIGATION REBUILD AFTER FEEDBACK
function fixModalNavigation() {
    // After expert feedback is submitted, rebuild modal navigation
    /*
    // In updateTableCellWithClassification function, add:
    try {
        // Update the table cell first
        // ... existing table update code ...
        
        // CRITICAL: Rebuild modal navigation after any table changes
        const modal = document.getElementById('chartModal');
        if (modal && modal.style.display !== 'none') {
            console.log('🔄 Rebuilding modal navigation after classification update');
            
            // Method 1: Call the main rebuild function
            if (window.buildModalNavigationList) {
                setTimeout(() => {
                    window.buildModalNavigationList();
                    window.updateNavigationButtons && window.updateNavigationButtons();
                }, 100);
            }
            
            // Method 2: Trigger a custom event for navigation rebuild
            window.dispatchEvent(new CustomEvent('modalNavigationNeedsRebuild', {
                detail: { reason: 'classification_updated', wellKey: wellKey }
            }));
        }
    } catch (error) {
        console.error('Error rebuilding modal navigation:', error);
    }
    */
}

// 5. DATA LOADING ON REFRESH INCLUDES EXPERT FEEDBACK
function enhanceDataLoading() {
    // When analysis results are loaded, merge in expert feedback from database
    /*
    // In script.js, after analysis results are loaded, add:
    async function loadExpertFeedbackFromDatabase(analysisResults) {
        try {
            if (!analysisResults.session_id) return analysisResults;
            
            const response = await fetch('/api/get-expert-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: analysisResults.session_id })
            });
            
            if (response.ok) {
                const expertFeedback = await response.json();
                
                // Merge expert feedback into analysis results
                for (const [wellKey, feedback] of Object.entries(expertFeedback)) {
                    if (analysisResults.individual_results[wellKey]) {
                        analysisResults.individual_results[wellKey].curve_classification = {
                            classification: feedback.expert_classification,
                            method: 'expert_feedback',
                            confidence: 1.0,
                            expert_review_method: 'ml_feedback_interface',
                            timestamp: feedback.timestamp
                        };
                    }
                }
                
                console.log('✅ Merged expert feedback from database');
            }
        } catch (error) {
            console.error('Failed to load expert feedback:', error);
        }
        
        return analysisResults;
    }
    */
}

// IMPLEMENTATION PRIORITY:
// 1. Fix session ID availability (highest priority)
// 2. Force database save with fallback session
// 3. Modal navigation rebuild
// 4. Data loading enhancement

console.log('📋 ML Feedback Persistence Fix Plan loaded');
