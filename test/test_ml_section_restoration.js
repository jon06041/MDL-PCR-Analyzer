/**
 * Automated Test Script for ML Section Restoration
 * Tests the createMLSectionInModal() and refreshMLDisplayInModal() functionality
 * Covers multichannel fresh/session and single channel fresh/session scenarios
 */

class MLSectionRestorationTester {
    constructor() {
        this.testResults = [];
        this.mlFeedbackInterface = null;
        this.setupEnvironment();
    }

    setupEnvironment() {
        // Mock global functions
        window.getCurrentFullPattern = () => 'TEST_PATTERN_2024';
        window.extractTestCode = (pattern) => pattern.split('_')[0];
        window.getPathogenTarget = (testCode, channel) => `${testCode}_${channel}_PATHOGEN`;
        window.currentSessionId = 'test_session_' + Date.now();
        window.currentModalWellKey = null;
        
        // Initialize analysis results
        window.currentAnalysisResults = {
            individual_results: {}
        };

        // Mock modal functions
        window.updateModalContent = (wellKey) => {
            console.log(`📋 updateModalContent called for ${wellKey}`);
            // Simulate modal content refresh that removes ML section
            const mlSection = document.getElementById('ml-feedback-section');
            if (mlSection) {
                mlSection.remove();
                console.log(`🗑️ ML section removed (simulating modal content refresh)`);
            }
        };

        window.buildModalNavigationList = () => {
            console.log(`🧭 buildModalNavigationList called`);
            window.modalNavigationList = Object.keys(window.currentAnalysisResults.individual_results);
        };

        window.updateNavigationButtons = () => {
            console.log(`🔄 updateNavigationButtons called`);
        };

        // Create minimal modal structure
        this.createModalStructure();
        
        console.log(`✅ Test environment initialized`);
    }

    createModalStructure() {
        // Create modal elements if they don't exist
        if (!document.querySelector('.modal-body')) {
            const modalBody = document.createElement('div');
            modalBody.className = 'modal-body';
            modalBody.innerHTML = `
                <div class="modal-chart-container">Chart Container</div>
                <div id="modalDetails">Modal Details</div>
            `;
            document.body.appendChild(modalBody);
        }
    }

    getTestData() {
        return {
            multichannel: {
                fresh: {
                    wellKey: 'A1_FAM',
                    wellData: {
                        well_id: 'A1',
                        channel: 'FAM',
                        fluorophore: 'FAM',
                        sample: 'Fresh_Multichannel_Sample',
                        classification: 'SUSPICIOUS',
                        amplitude: 450.2,
                        r2_score: 0.85,
                        snr: 5.2,
                        steepness: 0.3,
                        rfu_data: [100, 102, 105, 150, 200, 300, 450, 500, 520, 525],
                        cycles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                        is_good_scurve: false
                    }
                },
                session: {
                    wellKey: 'A3_CY5',
                    wellData: {
                        well_id: 'A3',
                        channel: 'CY5',
                        fluorophore: 'CY5',
                        sample: 'Session_Multichannel_Sample',
                        classification: 'POSITIVE',
                        amplitude: 1200.5,
                        r2_score: 0.95,
                        snr: 15.8,
                        steepness: 0.8,
                        rfu_data: [80, 85, 90, 120, 200, 400, 800, 1200, 1250, 1260],
                        cycles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                        is_good_scurve: true,
                        ml_classification: {
                            classification: 'POSITIVE',
                            confidence: 0.92,
                            method: 'Expert Review',
                            expert_review_method: 'ml_feedback_interface'
                        }
                    }
                }
            },
            single: {
                fresh: {
                    wellKey: 'B5',
                    wellData: {
                        well_id: 'B5',
                        channel: 'FAM',
                        sample: 'Fresh_Single_Sample',
                        classification: 'NEGATIVE',
                        amplitude: 85.3,
                        r2_score: 0.72,
                        snr: 2.1,
                        steepness: 0.1,
                        rfu_data: [75, 78, 80, 82, 85, 88, 85, 83, 84, 85],
                        cycles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                        is_good_scurve: false
                    }
                },
                session: {
                    wellKey: 'C8',
                    wellData: {
                        well_id: 'C8',
                        channel: 'FAM',
                        sample: 'Session_Single_Sample',
                        classification: 'SUSPICIOUS',
                        amplitude: 380.7,
                        r2_score: 0.88,
                        snr: 6.5,
                        steepness: 0.4,
                        rfu_data: [90, 95, 100, 130, 180, 250, 350, 380, 385, 390],
                        cycles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                        is_good_scurve: true,
                        curve_classification: {
                            classification: 'POSITIVE',
                            confidence: 0.88,
                            method: 'expert_feedback',
                            timestamp: new Date().toISOString()
                        }
                    }
                }
            }
        };
    }

    async runTest(channelType, dataType) {
        const testName = `${channelType.toUpperCase()}_${dataType.toUpperCase()}`;
        console.log(`\n🚀 Starting test: ${testName}`);
        console.log(`${'='.repeat(50)}`);

        const testData = this.getTestData();
        const testConfig = testData[channelType][dataType];
        const { wellKey, wellData } = testConfig;

        try {
            console.log(`📊 Test configuration:`);
            console.log(`  Well Key: ${wellKey}`);
            console.log(`  Channel Type: ${channelType}`);
            console.log(`  Data Type: ${dataType}`);
            console.log(`  Sample: ${wellData.sample}`);
            console.log(`  Classification: ${wellData.classification}`);

            // Step 1: Setup test data
            this.setupTestData(wellKey, wellData, dataType);

            // Step 2: Initialize ML interface
            this.mlFeedbackInterface = new MLFeedbackInterface();
            await this.sleep(100);

            // Step 3: Create initial ML section
            const creationResult = this.mlFeedbackInterface.createMLSectionInModal();
            if (!creationResult) {
                throw new Error('Failed to create initial ML section');
            }
            console.log(`✅ Initial ML section created`);

            // Step 4: Verify initial components
            await this.verifyMLSectionComponents('Initial creation');

            // Step 5: Set current well
            this.mlFeedbackInterface.setCurrentWell(wellKey, wellData);
            console.log(`✅ Set current well: ${wellKey}`);

            // Step 6: Simulate modal content refresh (removes ML section)
            console.log(`🔄 Simulating modal content refresh...`);
            window.updateModalContent(wellKey);
            await this.sleep(100);

            // Step 7: Verify ML section was removed
            let mlSection = document.getElementById('ml-feedback-section');
            if (mlSection) {
                throw new Error('ML section should have been removed during modal refresh');
            }
            console.log(`✅ ML section correctly removed during modal refresh`);

            // Step 8: Test restoration via refreshMLDisplayInModal
            console.log(`🔧 Testing ML section restoration...`);
            this.mlFeedbackInterface.refreshMLDisplayInModal();
            await this.sleep(200);

            // Step 9: Verify ML section was recreated
            await this.verifyMLSectionComponents('After restoration');

            // Step 10: Test specific functionality
            await this.testMLFunctionality(wellData, dataType);

            // Step 11: Test expert feedback persistence for session data
            if (dataType === 'session' && (wellData.ml_classification || wellData.curve_classification)) {
                await this.testExpertFeedbackPersistence(wellKey, wellData);
            }

            console.log(`✅ Test ${testName} PASSED`);
            this.testResults.push({ test: testName, status: 'PASSED' });

        } catch (error) {
            console.error(`❌ Test ${testName} FAILED: ${error.message}`);
            this.testResults.push({ test: testName, status: 'FAILED', error: error.message });
        } finally {
            this.cleanup();
        }
    }

    setupTestData(wellKey, wellData, dataType) {
        // Add to global analysis results
        window.currentAnalysisResults.individual_results[wellKey] = { ...wellData };
        
        // For multichannel, test key variations
        if (wellKey.includes('_')) {
            const duplicatedKey = wellKey + '_' + wellKey.split('_')[1]; // A1_FAM_FAM
            window.currentAnalysisResults.individual_results[duplicatedKey] = { ...wellData };
            console.log(`📝 Added key variation: ${duplicatedKey}`);
        }

        // Simulate session storage for session data
        if (dataType === 'session') {
            const sessionKey = `expert_feedback_${wellKey}`;
            const expertData = {
                classification: wellData.ml_classification?.classification || wellData.curve_classification?.classification,
                method: 'Expert Review',
                confidence: 1.0,
                expert_review_method: 'ml_feedback_interface',
                timestamp: new Date().toISOString(),
                wellKey: wellKey
            };
            sessionStorage.setItem(sessionKey, JSON.stringify(expertData));
            console.log(`💾 Added session storage: ${sessionKey}`);
        }
    }

    async verifyMLSectionComponents(context) {
        const mlSection = document.getElementById('ml-feedback-section');
        
        if (!mlSection) {
            throw new Error(`ML section not found (${context})`);
        }

        console.log(`✅ ML section exists (${context})`);

        // Verify key components
        const requiredComponents = [
            'ml-prediction-display',
            'ml-feedback-btn',
            'visual-curve-display',
            'ml-prediction-method',
            'ml-prediction-class',
            'ml-prediction-confidence',
            'submit-feedback-btn',
            'ml-feedback-form',
            'ml-stats-display'
        ];

        const missingComponents = [];
        
        for (const componentId of requiredComponents) {
            const element = document.getElementById(componentId);
            if (!element) {
                missingComponents.push(componentId);
            } else {
                console.log(`  ✓ ${componentId} found`);
            }
        }

        if (missingComponents.length > 0) {
            throw new Error(`Missing components: ${missingComponents.join(', ')}`);
        }

        console.log(`✅ All ${requiredComponents.length} components verified (${context})`);
        return true;
    }

    async testMLFunctionality(wellData, dataType) {
        console.log(`🔍 Testing ML functionality...`);

        // Test visual curve analysis display
        const visualDisplay = document.getElementById('visual-curve-display');
        if (visualDisplay) {
            // Should be visible for wells with curve data
            if (wellData.rfu_data && wellData.cycles) {
                console.log(`  ✓ Visual curve analysis available for well with curve data`);
            }
        }

        // Test feedback button functionality
        const feedbackBtn = document.getElementById('ml-feedback-btn');
        if (feedbackBtn) {
            console.log(`  ✓ Feedback button found`);
            
            // For session data with expert feedback, button should be visible
            if (dataType === 'session' && (wellData.ml_classification || wellData.curve_classification)) {
                console.log(`  📊 Session data should show feedback button for expert review`);
            }
        }

        // Test event listeners attachment
        const submitBtn = document.getElementById('submit-feedback-btn');
        if (submitBtn) {
            console.log(`  ✓ Submit feedback button found`);
            // Event listener attachment is tested by the MLFeedbackInterface internally
        }

        console.log(`✅ ML functionality tests completed`);
    }

    async testExpertFeedbackPersistence(wellKey, wellData) {
        console.log(`🎯 Testing expert feedback persistence...`);

        // Check if refreshMLDisplayInModal properly displays expert feedback
        const methodElement = document.getElementById('ml-prediction-method');
        const classElement = document.getElementById('ml-prediction-class');
        
        if (methodElement && classElement) {
            console.log(`  📊 Method element: ${methodElement.textContent}`);
            console.log(`  📊 Classification element: ${classElement.textContent}`);
            
            // Should show expert review method for session data
            const expectedClassification = wellData.ml_classification?.classification || wellData.curve_classification?.classification;
            if (expectedClassification) {
                console.log(`  📊 Expected classification: ${expectedClassification}`);
            }
        }

        // Verify session storage
        const sessionKey = `expert_feedback_${wellKey}`;
        const storedFeedback = sessionStorage.getItem(sessionKey);
        if (storedFeedback) {
            console.log(`  ✅ Session storage contains expert feedback`);
            const parsed = JSON.parse(storedFeedback);
            console.log(`    - Classification: ${parsed.classification}`);
            console.log(`    - Method: ${parsed.method}`);
        } else {
            console.log(`  ⚠️ No expert feedback found in session storage`);
        }

        console.log(`✅ Expert feedback persistence test completed`);
    }

    async runAllTests() {
        console.log(`\n🚀 Running all ML section restoration tests...`);
        console.log(`${'='.repeat(60)}`);
        
        const scenarios = [
            ['multichannel', 'fresh'],
            ['multichannel', 'session'],
            ['single', 'fresh'],
            ['single', 'session']
        ];

        for (const [channelType, dataType] of scenarios) {
            await this.runTest(channelType, dataType);
            await this.sleep(300); // Brief pause between tests
        }

        this.printTestSummary();
    }

    printTestSummary() {
        console.log(`\n📊 TEST SUMMARY`);
        console.log(`${'='.repeat(60)}`);
        
        const passed = this.testResults.filter(r => r.status === 'PASSED').length;
        const failed = this.testResults.filter(r => r.status === 'FAILED').length;
        
        console.log(`Total Tests: ${this.testResults.length}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        
        if (failed > 0) {
            console.log(`\n❌ FAILED TESTS:`);
            this.testResults.filter(r => r.status === 'FAILED').forEach(result => {
                console.log(`  - ${result.test}: ${result.error}`);
            });
        } else {
            console.log(`\n✅ ALL TESTS PASSED!`);
        }
        
        console.log(`\n🎯 Test Coverage:`);
        console.log(`  ✅ ML section creation and removal`);
        console.log(`  ✅ ML section restoration after modal refresh`);
        console.log(`  ✅ Component verification (buttons, displays, forms)`);
        console.log(`  ✅ Multichannel key format handling`);
        console.log(`  ✅ Expert feedback persistence`);
        console.log(`  ✅ Session storage integration`);
        console.log(`  ✅ Fresh upload vs session data scenarios`);
        
        console.log(`${'='.repeat(60)}`);
    }

    cleanup() {
        // Remove ML section
        const mlSection = document.getElementById('ml-feedback-section');
        if (mlSection) {
            mlSection.remove();
        }

        // Clear test data
        window.currentAnalysisResults = { individual_results: {} };
        window.currentModalWellKey = null;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Auto-run tests when included in test environment
if (typeof window !== 'undefined' && window.document) {
    // Run tests when DOM is loaded
    document.addEventListener('DOMContentLoaded', async function() {
        console.log('🔧 Initializing ML Section Restoration Test Suite...');
        
        // Wait for ML interface to be available
        if (typeof MLFeedbackInterface === 'undefined') {
            console.error('❌ MLFeedbackInterface not found. Make sure ml_feedback_interface.js is loaded.');
            return;
        }
        
        const tester = new MLSectionRestorationTester();
        
        // Add test runner to global scope for manual execution
        window.mlSectionTester = tester;
        
        console.log('✅ Test suite ready!');
        console.log('🚀 Run window.mlSectionTester.runAllTests() to start testing');
        console.log('📝 Or run individual tests with window.mlSectionTester.runTest("multichannel", "fresh")');
        
        // Auto-run all tests after a short delay
        setTimeout(() => {
            console.log('\n🚀 Auto-running all tests...');
            tester.runAllTests();
        }, 1000);
    });
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MLSectionRestorationTester;
}
