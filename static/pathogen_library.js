// Pathogen Target Library for qPCR Analysis
// Maps PCR codes to pathogen targets by fluorophore channel

// ======================================
// Pathogen Target Library for qPCR Analysis
// Now includes per-assay H, M, L concentrations for use in Calc-J
// All concentrations are set to H: 1e7, M: 1e5, L: 1e3 by default for every test.
// To change for a specific test, edit the 'concentrationControls' property for that test.
// ======================================
const PATHOGEN_LIBRARY = {
    "Lacto": {
        "Cy5": "Lactobacillus jenseni",
        "FAM": "Lactobacillus gasseri",
        "HEX": "Lactobacillus iners",
        "Texas Red": "Lactobacillus crispatus"
    },
    "Calb": {
        "HEX": "Candida albicans"
    },
    "Ctrach": {
        "FAM": "Chlamydia trachomatis"
    },
    "Ngon": {
        "HEX": "Neisseria gonhorrea"
    },
    "Tvag": {
        "FAM": "Trichomonas vaginalis"
    },
    "Cglab": {
        "FAM": "Candida glabrata"
    },
    "Cpara": {
        "FAM": "Candida parapsilosis"
    },
    "Ctrop": {
        "FAM": "Candida tropicalis"
    },
    "Gvag": {
        "FAM": "Gardnerella vaginalis"
    },
    "BVAB2": {
        "FAM": "BVAB2"
    },
    "CHVIC": {
        "FAM": "CHVIC"
    },
    "AtopVag": {
        "FAM": "Atopobium vaginae"
    },
    "Megasphaera": {
        "FAM": "Megasphaera1",
        "HEX": "Megasphaera2"
    },
    "Efaecalis": {
        "FAM": "Enterococcus faecaelis"
    },
    "Saureus": {
        "FAM": "Staphylococcus aureus"
    },
    "Ecoli": {
        "FAM": "Escherichia coli"
    },
    "AtopVagNY": {
        "FAM": "Atopobium vaginae"
    },
    "BVAB2NY": {
        "FAM": "BVAB2"
    },
    "GvagNY": {
        "FAM": "Gardnerella vaginalis"
    },
    "MegasphaeraNY": {
        "FAM": "MegasphaeraNY1",
        "HEX": "MegasphaeraNY2"
    },
    "LactoNY": {
        "Cy5": "Lactobacillus jenseni",
        "FAM": "Lactobacillus gasseri",
        "HEX": "Lactobacillus iners", 
        "Texas Red": "Lactobacillus crispatus"
    },
    "RNaseP": {
        "HEX": "Ribonuclease P"
    },
    "HPVNGS1": {
        "Unknown": "HPVNGS1"
    },
    "HPVNGS2": {
        "FAM": "HPVNGS2",
        "HEX": "HPVNGS2"
    },
    "HPVNGS3": {
        "Unknown": "HPVNGS3"
    },
    "GBS": {
        "FAM": "Group B Strep"
    },
    "GBSEnrich": {
        "FAM": "GBS Enrich"
    },
    "GBSNY": {
        "FAM": "GBS NY"
    },
    "GBSEnrichNY": {
        "FAM": "GBS Enrich NY"
    },
    "COVIDN1NY": {
        "FAM": "Unknown"
    },
    "COVIDN2NY": {
        "FAM": "Unknown"
    },
    "COVIDHRPP30NY": {
        "FAM": "Unknown"
    },
    "COVID19NY": {
        "FAM": "Unknown"
    },
    "FLUAB": {
        "Cy5": "Influenza A",
        "FAM": "Influenza B"
    },
    "InfluenzaA": {
        "Cy5": "Influenza A"
    },
    "InfluenzaB": {
        "FAM": "Influenza B"
    },
    "HPV1": {
        "FAM": "HPV16",
        "HEX": "HPV58",
        "Texas Red": "HPV18",
        "Cy5": "HPV45"
    },
    "HPV2": {
        "FAM": "HPV51",
        "HEX": "HPV52",
        "Cy5": "HPV35"
    },
    "HPV3": {
        "FAM": "HPV31",
        "HEX": "HPV39",
        "Texas Red": "HPV56",
        "Cy5": "HPVBG"
    },
    "HPV4": {
        "FAM": "HPV59",
        "HEX": "HPV33",
        "Texas Red": "HPV68"
    },
    "Mgen": {
        "FAM": "Mgen"
    },
    "NOVNOV": {
        "FAM": "NOVNOV"
    },
    "NOVRP": {
        "FAM": "NOVRP"
    },
    "NOV": {
        "FAM": "NOV"
    },
    "Ckrus": {
        "FAM": "Ckrus"
    },
    "BVPanelPCR1": {
        "FAM": "Bacteroides fragilis",
        "HEX": "Mobiluncus curtisii",
        "Texas Red": "Streptococcus anginosus",
        "Cy5": "Sneathia sanguinegens"
    },
    "BVPanelPCR2": {
        "FAM": "Atopobium vaginae",
        "HEX": "Mobiluncus mulieris",
        "Texas Red": "Megasphaera type 2",
        "Cy5": "Megasphaera type 1"
    },
    "BVPanelPCR3": {
        "FAM": "Gardnerella vaginalis",
        "HEX": "Lactobacillus acidophilus",
        "Texas Red": "Prevotella bivia",
        "Cy5": "Bifidobacterium breve"
    },
    "BVPanelPCR4": {
        "FAM": "Gardnerella vaginalis",
        "HEX": "Lactobacillus acidophilus",
        "Texas Red": "Prevotella bivia",
        "Cy5": "Bifidobacterium breve"
    },
    "BVAB": {
        "FAM": "BVAB2",
        "HEX": "BVAB1",
        "Cy5": "BVAB3"
    },
    "BifidoBreve": {
        "Cy5": "BifidoBreve"
    },
    "LactoAcido": {
        "HEX": "LactoAcido"
    },
    "MobiCurti": {
        "HEX": "MobiCurti"
    },
    "SneSangu": {
        "Cy5": "SneSangu"
    },
    "PrevoBivia": {
        "Texas Red": "PrevoBivia"
    },
    "MobiMuli": {
        "HEX": "MobiMuli"
    },
    "StrepAngi": {
        "FAM": "StrepAngi"
    },
    "HPV1NY": {
        "FAM": "HPV16",
        "HEX": "HPV58",
        "Texas Red": "HPV18",
        "Cy5": "HPV45"
    },
    "HPV2NY": {
        "FAM": "HPV51",
        "HEX": "HPV52",
        "Cy5": "HPV35"
    },
    "HPV3NY": {
        "FAM": "HPV31",
        "HEX": "HPV39",
        "Texas Red": "HPV56",
        "Cy5": "HPVBG"
    },
    "HPV4NY": {
        "FAM": "HPV59",
        "HEX": "HPV33",
        "Texas Red": "HPV68"
    },
    "BVPanelPCR1NY": {
        "FAM": "Bacteroides fragilis",
        "HEX": "Mobiluncus curtisii",
        "Texas Red": "Streptococcus anginosus",
        "Cy5": "Sneathia sanguinegens"
    },
    "BVPanelPCR2NY": {
        "FAM": "Atopobium vaginae",
        "HEX": "Mobiluncus mulieris",
        "Texas Red": "Megasphaera type 2",
        "Cy5": "Megasphaera type 1"
    },
    "BVPanelPCR3NY": {
        "FAM": "Gardnerella vaginalis",
        "HEX": "Lactobacillus acidophilus",
        "Texas Red": "Prevotella bivia",
        "Cy5": "Bifidobacterium breve"
    },
    "BVABNY": {
        "FAM": "BVAB2",
        "HEX": "BVAB1",
        "Cy5": "BVAB3"
    },
    "BifidoBreveNY": {
        "Cy5": "BifidoBreve"
    },
    "LactoAcidoNY": {
        "HEX": "LactoAcido"
    },
    "MobiCurtiNY": {
        "HEX": "MobiCurti"
    },
    "SneSanguNY": {
        "Cy5": "SneSangu"
    },
    "PrevoBiviaNY": {
        "Texas Red": "PrevoBivia"
    },
    "MobiMuliNY": {
        "HEX": "MobiMuli"
    },
    "StrepAngiNY": {
        "FAM": "StrepAngi"
    },
    "BVPanelMega2NY": {
        "Texas Red": "Megasphaera type 2"
    },
    "BVPanelMega2": {
        "Texas Red": "Megasphaera type 2"
    },
    // Single-channel tests
    "Ngon": {
        "HEX": "Neisseria gonhorrea"
    },
    "Calb": {
        "HEX": "Candida albicans"
    },
    "Ctrach": {
        "FAM": "Chlamydia trachomatis"
    },
    "Tvag": {
        "FAM": "Trichomonas vaginalis"
    },
    "Mgen": {
        "FAM": "Mycoplasma genitalium"
    },
    "Upar": {
        "FAM": "Ureaplasma parvum"
    },
    "Uure": {
        "FAM": "Ureaplasma urealyticum"
    }
};

/**
 * Get pathogen target for a specific test code and fluorophore
 * @param {string} testCode - The PCR test code (without "Ac" prefix)
 * @param {string} fluorophore - The fluorophore channel (Cy5, FAM, HEX, Texas Red)
 * @returns {string} The pathogen target or "Unknown" if not found
 */
function getPathogenTarget(testCode, fluorophore) {
    if (!testCode || !fluorophore) return "Unknown";
    
    const testData = PATHOGEN_LIBRARY[testCode];
    if (!testData) return "Unknown";
    
    return testData[fluorophore] || "Unknown";
}

/**
 * Extract test code from experiment pattern (removes "Ac" prefix)
 * @param {string} experimentPattern - Full experiment pattern like "AcBVAB_2578825_CFX367393"
 * @returns {string} Test code without "Ac" prefix
 */
function extractTestCode(experimentPattern) {
    if (!experimentPattern) return "";
    
    // Extract the test name part and remove "Ac" prefix
    const testName = experimentPattern.split('_')[0];
    return testName.startsWith('Ac') ? testName.substring(2) : testName;
}

/**
 * Get required fluorophore channels for a test
 * @param {string} testCode - The PCR test code (without "Ac" prefix)
 * @returns {Array} Array of required fluorophore channels
 */
function getRequiredChannels(testCode) {
    const testData = PATHOGEN_LIBRARY[testCode];
    if (!testData) return [];
    
    return Object.keys(testData).filter(channel => channel !== 'Unknown');
}

/**
 * Check if all required channels are satisfied for a test
 * @param {string} testCode - The PCR test code (without "Ac" prefix) 
 * @param {Array} availableChannels - Array of uploaded fluorophore channels
 * @returns {Object} Validation result with completion status and missing channels
 */
function validateChannelCompleteness(testCode, availableChannels) {
    const requiredChannels = getRequiredChannels(testCode);
    const missingChannels = requiredChannels.filter(channel => !availableChannels.includes(channel));
    const isComplete = missingChannels.length === 0;
    
    console.log(`🔍 validateChannelCompleteness DEBUG - ${testCode}:`, {
        requiredChannels,
        availableChannels,
        missingChannels,
        isComplete,
        completionRate: ((requiredChannels.length - missingChannels.length) / requiredChannels.length * 100).toFixed(1)
    });
    
    return {
        isComplete,
        requiredChannels,
        availableChannels,
        missingChannels,
        completionRate: ((requiredChannels.length - missingChannels.length) / requiredChannels.length * 100).toFixed(1)
    };
}

/**
 * Extract fluorophore(s) from CFX Manager filename format
 * @param {string} fileName - The filename to extract fluorophore from
 * @returns {Array|string} Array of fluorophores for multi-fluorophore sessions, or single fluorophore string
 */
function extractFluorophoreFromFilename(fileName) {
    const fluorophores = ['Cy5', 'FAM', 'HEX', 'Texas Red'];
    
    // Check for multi-fluorophore session format: "Multi-Fluorophore Analysis (HEX, FAM, Cy5)"
    if (fileName.includes('Multi-Fluorophore Analysis')) {
        const match = fileName.match(/Multi-Fluorophore Analysis \(([^)]+)\)/);
        if (match) {
            const fluorophoreList = match[1].split(',').map(f => f.trim());
            return fluorophoreList.filter(f => fluorophores.includes(f));
        }
    }
    
    // Single fluorophore detection for individual sessions
    for (const fluorophore of fluorophores) {
        // Check for exact match at end of filename (e.g., "Results_Cy5.csv")
        if (fileName.includes(`_${fluorophore}.csv`) || fileName.includes(`_${fluorophore}_`)) {
            return fluorophore;
        }
        // Fallback to case-insensitive search
        if (fileName.toLowerCase().includes(fluorophore.toLowerCase())) {
            return fluorophore;
        }
    }
    
    return 'Unknown';
}

/**
 * Get pathogen-specific completion status across all experiments in history
 * @param {Array} sessions - Array of analysis sessions
 * @returns {Object} Test completion status by experiment pattern
 */
function getTestCompletionStatus(sessions) {
    const testStatus = {};
    
    sessions.forEach(session => {
        if (!session.filename) return;
        
        const experimentPattern = session.filename;
        const testCode = extractTestCode(experimentPattern);
        
        if (!testCode || !PATHOGEN_LIBRARY[testCode]) return;
        
        // Extract base experiment pattern - handle both individual and multi-fluorophore sessions
        let basePattern = experimentPattern.replace(/ -  Quantification Amplification Results_[A-Za-z0-9\s]+\.csv$/, '');
        
        // Handle multi-fluorophore session format: "Multi-Fluorophore Analysis (HEX, FAM, Cy5) AcBVAB_2578826_CFX367394"
        if (basePattern.includes('Multi-Fluorophore Analysis')) {
            const multiMatch = basePattern.match(/Multi-Fluorophore Analysis \([^)]+\) (.+)/);
            if (multiMatch) {
                basePattern = multiMatch[1];
            }
        }
        
        // Clean trailing dashes to handle filename inconsistencies (AcBVAB_2578826_CFX367394- -> AcBVAB_2578826_CFX367394)
        const pattern = /^([A-Za-z][A-Za-z0-9]*_\d+_CFX\d+)/i;
        const match = basePattern.match(pattern);
        if (match) {
            basePattern = match[1].replace(/[-\s]+$/, '');
        } else {
            basePattern = basePattern.replace(/[-\s]+$/, '');
        }
        
        // Extract uploaded channels from session filename or well_results
        const uploadedChannels = new Set();
        
        // Method 1: Extract fluorophore(s) from filename
        const fluorophoreFromFilename = extractFluorophoreFromFilename(experimentPattern);
        console.log(`Extracting fluorophore from ${experimentPattern}: ${fluorophoreFromFilename}`);
        
        if (fluorophoreFromFilename && fluorophoreFromFilename !== 'Unknown') {
            // Handle both single fluorophore (string) and multi-fluorophore (array) results
            if (Array.isArray(fluorophoreFromFilename)) {
                // Multi-fluorophore session - add all detected fluorophores
                fluorophoreFromFilename.forEach(fluorophore => {
                    uploadedChannels.add(fluorophore);
                    console.log(`Added fluorophore ${fluorophore} to uploaded channels`);
                });
            } else {
                // Single fluorophore session
                uploadedChannels.add(fluorophoreFromFilename);
                console.log(`Added fluorophore ${fluorophoreFromFilename} to uploaded channels`);
            }
        }
        
        // Method 2: Extract from well_results fit_parameters
        if (session.well_results) {
            session.well_results.forEach(well => {
                // Try to get fluorophore from fit_parameters
                if (well.fit_parameters) {
                    try {
                        const fitParams = typeof well.fit_parameters === 'string' ? 
                            JSON.parse(well.fit_parameters) : well.fit_parameters;
                        if (fitParams.fluorophore && fitParams.fluorophore !== 'Unknown') {
                            uploadedChannels.add(fitParams.fluorophore);
                        }
                    } catch (e) {
                        // Ignore JSON parse errors
                    }
                }
                
                // Try to extract from well_id if it contains fluorophore (A1_Cy5)
                if (well.well_id && well.well_id.includes('_')) {
                    const parts = well.well_id.split('_');
                    if (parts.length > 1) {
                        const possibleFluorophore = parts[parts.length - 1];
                        if (['Cy5', 'FAM', 'HEX', 'Texas Red'].includes(possibleFluorophore)) {
                            uploadedChannels.add(possibleFluorophore);
                        }
                    }
                }
            });
        }
        
        if (!testStatus[testCode]) {
            testStatus[testCode] = {
                testCode,
                experiments: {}
            };
        }
        
        // Group by base experiment pattern and aggregate channels
        if (!testStatus[testCode].experiments[basePattern]) {
            testStatus[testCode].experiments[basePattern] = {
                basePattern,
                sessionIds: [],
                uploadedChannels: new Set()
            };
        }
        
        testStatus[testCode].experiments[basePattern].sessionIds.push(session.id);
        uploadedChannels.forEach(channel => {
            testStatus[testCode].experiments[basePattern].uploadedChannels.add(channel);
        });
    });
    
    // Convert to final format with validation
    Object.keys(testStatus).forEach(testCode => {
        const experiments = testStatus[testCode].experiments;
        testStatus[testCode].experiments = Object.keys(experiments).map(basePattern => {
            const experiment = experiments[basePattern];
            const uploadedChannelsArray = Array.from(experiment.uploadedChannels);
            const validation = validateChannelCompleteness(testCode, uploadedChannelsArray);
            
            return {
                experimentPattern: basePattern,
                sessionIds: experiment.sessionIds,
                uploadedChannels: uploadedChannelsArray,
                validation
            };
        });
    });
    
    return testStatus;
}

// Export for use in main script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PATHOGEN_LIBRARY, getPathogenTarget, extractTestCode };
}