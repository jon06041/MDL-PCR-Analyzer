/**
 * Real Control Data Integration for Pathogen Grids
 * Creates tabbed interface showing one pathogen's controls at a time
 */

function showPathogenGridsWithData(testCode, controlSets) {
    console.log('🔍 PATHOGEN GRID - showPathogenGridsWithData called with testCode:', testCode);
    console.log('🔍 PATHOGEN GRID - controlSets:', controlSets);
    console.log('🔍 PATHOGEN GRID - window.currentAnalysisResults available:', !!window.currentAnalysisResults);
    console.log('🔍 PATHOGEN GRID - currentAnalysisResults type:', typeof window.currentAnalysisResults);
    console.log('🔍 PATHOGEN GRID - currentSessionFilename:', window.currentSessionFilename);
    console.log('🔍 PATHOGEN GRID - currentFilePattern:', window.currentFilePattern);
    
    // Enhanced debugging: Check if testCode is supported
    const supportedTestCodes = ['BVAB', 'BVPanelPCR3', 'Cglab', 'Ngon', 'Calb', 'Ctrach', 'Tvag', 'Mgen'];
    const isSupported = supportedTestCodes.includes(testCode);
    console.log('🔍 PATHOGEN GRID - Test code supported:', isSupported, 'Supported codes:', supportedTestCodes);
    
    const container = document.getElementById('pathogenControlGrids');
    if (!container) {
        console.log('🔍 PATHOGEN GRID - Container pathogenControlGrids not found');
        return;
    }
    
    // Get real control validation data from current analysis
    console.log('🔍 PATHOGEN GRID - About to call getRealControlValidationData()');
    const controlValidationData = getRealControlValidationData();
    console.log('🔍 PATHOGEN GRID - Real control validation data received:', controlValidationData);
    console.log('🔍 PATHOGEN GRID - Control data keys count:', Object.keys(controlValidationData).length);
    
    // If no control data found, show debug info
    if (Object.keys(controlValidationData).length === 0) {
        console.log('🔍 PATHOGEN GRID - No control data found, debugging...');
        if (window.currentAnalysisResults && window.currentAnalysisResults.individual_results) {
            const sampleWells = Object.entries(window.currentAnalysisResults.individual_results).slice(0, 5);
            console.log('🔍 PATHOGEN GRID - Sample wells for debugging:', sampleWells.map(([key, well]) => ({
                key, 
                sampleName: well.sample_name, 
                amplitude: well.amplitude,
                fluorophore: well.fluorophore
            })));
        }
    }
    
    container.style.display = 'block';
    container.innerHTML = '';
    
    if (testCode === 'BVAB') {
        createTabbedPathogenGrids(container, 'BVAB', controlValidationData);
    } else if (testCode === 'BVPanelPCR3') {
        createTabbedPathogenGrids(container, 'BVPanelPCR3', controlValidationData);
    } else if (testCode === 'Cglab') {
        createTabbedPathogenGrids(container, 'Cglab', controlValidationData);
    } else if (testCode === 'Ngon') {
        createTabbedPathogenGrids(container, 'Ngon', controlValidationData);
    } else if (testCode === 'Calb') {
        createTabbedPathogenGrids(container, 'Calb', controlValidationData);
    } else if (testCode === 'Ctrach') {
        createTabbedPathogenGrids(container, 'Ctrach', controlValidationData);
    } else if (testCode === 'Tvag') {
        createTabbedPathogenGrids(container, 'Tvag', controlValidationData);
    } else if (testCode === 'Mgen') {
        createTabbedPathogenGrids(container, 'Mgen', controlValidationData);
    } else if (testCode === 'Upar') {
        createTabbedPathogenGrids(container, 'Upar', controlValidationData);
    } else if (testCode === 'Uure') {
        createTabbedPathogenGrids(container, 'Uure', controlValidationData);
    } else {
        // Fallback: Use universal control grid for unsupported test codes
        console.warn('No specific grid available for testCode:', testCode, '- using universal fallback');
        if (window.createUniversalControlGrid && typeof window.createUniversalControlGrid === 'function') {
            // Extract individual results from currentAnalysisResults
            let individualResults = {};
            if (window.currentAnalysisResults && window.currentAnalysisResults.individual_results) {
                individualResults = window.currentAnalysisResults.individual_results;
            }
            window.createUniversalControlGrid(testCode, individualResults);
        } else {
            const fallbackDiv = document.createElement('div');
            fallbackDiv.className = 'no-static-grid-warning';
            fallbackDiv.innerHTML = `<p style="color: #b00; font-weight: bold;">No grid system available for test code: <code>${testCode}</code></p>`;
            container.appendChild(fallbackDiv);
        }
    }
}

function getRealControlValidationData() {
    console.log('🔍 CONTROL GRID DATA - Starting real control validation data extraction');
    console.log('🔍 CONTROL GRID DATA - Current analysis results available:', !!window.currentAnalysisResults);
    console.log('🔍 CONTROL GRID DATA - currentSessionFilename:', window.currentSessionFilename);
    console.log('🔍 CONTROL GRID DATA - currentFilePattern:', window.currentFilePattern);
    
    // Extract testCode from current session or filename pattern
    let testCode = 'BVAB'; // Default fallback
    if (window.currentSessionFilename) {
        // Extract from session filename for history loads
        if (window.currentSessionFilename.includes('BVAB')) testCode = 'BVAB';
        else if (window.currentSessionFilename.includes('BVPanelPCR3')) testCode = 'BVPanelPCR3';
        else if (window.currentSessionFilename.includes('Ngon')) testCode = 'Ngon';
        else if (window.currentSessionFilename.includes('Cglab')) testCode = 'Cglab';
        else if (window.currentSessionFilename.includes('Calb')) testCode = 'Calb';
        else if (window.currentSessionFilename.includes('Ctrach')) testCode = 'Ctrach';
        else if (window.currentSessionFilename.includes('Tvag')) testCode = 'Tvag';
        else if (window.currentSessionFilename.includes('Mgen')) testCode = 'Mgen';
        // Add more test code detection as needed
        console.log('🔍 CONTROL GRID DATA - Test code detected from session filename:', testCode);
    } else if (window.currentFilePattern) {
        // Extract from file pattern for fresh uploads
        if (window.currentFilePattern.includes('BVAB')) testCode = 'BVAB';
        else if (window.currentFilePattern.includes('BVPanelPCR3')) testCode = 'BVPanelPCR3';
        else if (window.currentFilePattern.includes('Ngon')) testCode = 'Ngon';
        else if (window.currentFilePattern.includes('Cglab')) testCode = 'Cglab';
        else if (window.currentFilePattern.includes('Calb')) testCode = 'Calb';
        else if (window.currentFilePattern.includes('Ctrach')) testCode = 'Ctrach';
        else if (window.currentFilePattern.includes('Tvag')) testCode = 'Tvag';
        else if (window.currentFilePattern.includes('Mgen')) testCode = 'Mgen';
        // Add more test code detection as needed
        console.log('🔍 CONTROL GRID DATA - Test code detected from file pattern:', testCode);
    }
    
    console.log('🔍 CONTROL GRID DATA - Final detected test code:', testCode);
    // Support both array and object for window.currentAnalysisResults
    let wellsArray = [];
    if (Array.isArray(window.currentAnalysisResults)) {
        wellsArray = window.currentAnalysisResults;
    } else if (window.currentAnalysisResults && typeof window.currentAnalysisResults === 'object') {
        if (window.currentAnalysisResults.individual_results && typeof window.currentAnalysisResults.individual_results === 'object') {
            wellsArray = Object.values(window.currentAnalysisResults.individual_results);
        } else {
            wellsArray = Object.values(window.currentAnalysisResults);
        }
    }
    // Patch: always use wellsArray for iteration, never call forEach on window.currentAnalysisResults directly
    console.log('🔍 CONTROL GRID DATA - Analysis results count:', wellsArray.length);
    const controlData = {};
    
    if (!wellsArray || wellsArray.length === 0) {
        console.log('🔍 CONTROL DATA - No current analysis results available');
        return controlData;
    }
    
    // Get all fluorophores in the dataset for fallback assignment
    const datasetFluorophores = [...new Set(wellsArray.map(w => w.fluorophore).filter(f => f && f !== 'Unknown'))];
    console.log('🔍 CONTROL DATA - Dataset fluorophores:', datasetFluorophores);
    
    // First, show all unique sample names for debugging
    const allSampleNames = [...new Set(wellsArray.map(w => w.sample_name || 'UNNAMED'))];
    console.log('🔍 CONTROL DATA - All sample names in session:', allSampleNames.slice(0, 50));
    
    // Show wells with their coordinates and sample names for debugging
    const wellsWithCoords = wellsArray.slice(0, 20).map(w => ({
        wellId: w.well_id,
        coordinate: w.well_id ? w.well_id.split('_')[0] : 'Unknown',
        sampleName: w.sample_name,
        amplitude: w.amplitude
    }));
    console.log('🔍 CONTROL DATA - First 20 wells with coordinates:', wellsWithCoords);
    
    // Show potential control samples
    const potentialControls = allSampleNames.filter(name => 
        name && (name.includes('H') || name.includes('M') || name.includes('L') || name.includes('NTC') || 
                 name.includes('Control') || name.includes('control') || name.includes('Pos') || name.includes('Neg'))
    );
    console.log('🔍 CONTROL DATA - Potential control samples:', potentialControls);
    
    // Group wells by coordinate to detect control sets
    const wellsByCoordinate = {};
    wellsArray.forEach(well => {
        const coordinate = well.well_id ? well.well_id.split('_')[0] : 'Unknown';
        if (!wellsByCoordinate[coordinate]) {
            wellsByCoordinate[coordinate] = [];
        }
        wellsByCoordinate[coordinate].push(well);
    });
    
    // Extract control samples directly from analysis results
    // Use the same logic as the results table "Controls" filter
    function extractTestPattern(sampleName) {
        if (!sampleName) return `Ac${testCode}`;
        const match = sampleName.match(/^(Ac[A-Za-z]+)/);
        return match ? match[1] : `Ac${testCode}`;
    }
    const testPattern = wellsArray && wellsArray.length > 0 ? 
        extractTestPattern(wellsArray[0].sample_name || '') : 'AcBVAB';
    const controlSamples = [];
    wellsArray.forEach(well => {
        const sampleName = well.sample_name || '';
        const coordinate = well.well_id ? well.well_id.split('_')[0] : 'Unknown';
        // Improved fluorophore assignment with fallbacks
        const fluorophore = well.fluorophore || (well.well_id ? well.well_id.split('_')[1] : null) || 
                          (datasetFluorophores.length === 1 ? datasetFluorophores[0] : 'Unknown');
        if (sampleName.startsWith(testPattern)) {
            controlSamples.push({
                coordinate: coordinate,
                sampleName: sampleName,
                fluorophore: fluorophore,
                amplitude: well.amplitude || 0,
                wellId: well.well_id
            });
        }
    });
    
    console.log('🔍 CONTROL DATA - Real control samples found (from results table logic):');
    console.log(`🔍 Test pattern: "${testPattern}"`);
    controlSamples.forEach(control => {
        console.log(`  ${control.coordinate}: ${control.sampleName} (${control.fluorophore}, amp: ${control.amplitude.toFixed(1)})`);
    });
    
    // Group by coordinate to see all fluorophores for each control well
    const controlsByCoordinate = {};
    controlSamples.forEach(control => {
        if (!controlsByCoordinate[control.coordinate]) {
            controlsByCoordinate[control.coordinate] = [];
        }
        controlsByCoordinate[control.coordinate].push(control);
    });
    
    console.log('🔍 CONTROL DATA - Controls grouped by coordinate:');
    Object.keys(controlsByCoordinate).sort().forEach(coord => {
        const controls = controlsByCoordinate[coord];
        const fluorophores = controls.map(c => c.fluorophore).join(', ');
        const sampleName = controls[0].sampleName;
        console.log(`  ${coord}: ${sampleName} [${fluorophores}]`);
    });
    
    // Create coordinate-to-control mapping directly from the real control sample data
    const coordinateToControlInfo = {};
    
    // Analyze actual control samples found in the results
    controlSamples.forEach(control => {
        const { coordinate, sampleName, fluorophore, amplitude } = control;
        
        // Extract control type and set directly from the sample name pattern
        let controlType = null;
        let setNumber = null;
        
        // Parse control type from sample name (priority order for better matching)
        if (sampleName.includes('NTC')) {
            controlType = 'NTC';
        } else if (sampleName.match(/\bH\b/) || sampleName.match(/H-\d/) || sampleName.match(/H\d/)) {
            controlType = 'H';
        } else if (sampleName.match(/\bM\b/) || sampleName.match(/M-\d/) || sampleName.match(/M\d/)) {
            controlType = 'M';
        } else if (sampleName.match(/\bL\b/) || sampleName.match(/L-\d/) || sampleName.match(/L\d/)) {
            controlType = 'L';
        }
        
        // Extract set number from sample name pattern (look for numbers after control type)
        let setMatch = sampleName.match(/-(\d+)$/);
        if (setMatch) {
            setNumber = parseInt(setMatch[1]);
        } else {
            // Try alternative patterns for set extraction
            setMatch = sampleName.match(/(\d+)$/);
            if (setMatch) {
                setNumber = parseInt(setMatch[1]);
            } else {
                // Use coordinate-based set assignment as last resort
                setNumber = 1; // Default to set 1
            }
        }
        
        if (controlType && setNumber) {
            coordinateToControlInfo[coordinate] = {
                set: setNumber,
                type: controlType,
                sampleName: sampleName,
                amplitude: amplitude,
                fluorophore: fluorophore
            };
            
            console.log(`🔍 CONTROL MAPPING - ${coordinate}: ${controlType} Set ${setNumber} (${sampleName}) [${fluorophore}]`);
        } else {
            console.log(`🔍 CONTROL MAPPING - Could not parse: ${coordinate}: ${sampleName} (type: ${controlType}, set: ${setNumber})`);
        }
    });
    
    console.log('🔍 CONTROL DATA - Coordinate to control mapping:', coordinateToControlInfo);
    
    // Extract control samples from current analysis results using coordinate mapping
    wellsArray.forEach(well => {
        const sampleName = well.sample_name || '';
        const amplitude = well.amplitude || 0;
        // Improved fluorophore assignment with fallbacks
        const fluorophore = well.fluorophore || (well.well_id ? well.well_id.split('_')[1] : null) || 
                          (datasetFluorophores.length === 1 ? datasetFluorophores[0] : 'Unknown');
        const coordinate = well.well_id ? well.well_id.split('_')[0] : 'Unknown';
        const controlInfo = coordinateToControlInfo[coordinate];
        if (controlInfo) {
            const controlType = controlInfo.type;
            const setNumber = controlInfo.set;
            const key = `${fluorophore}_${controlType}_${setNumber}`;
            const expected = getExpectedResult(controlType);
            const actual = getActualResult(well);
            const isValid = (expected === actual);
            controlData[key] = {
                fluorophore: fluorophore,
                controlType: controlType,
                setNumber: setNumber,
                sampleName: sampleName,
                amplitude: amplitude,
                expected: expected,
                actual: actual,
                isValid: isValid,
                wellId: well.well_id,
                coordinate: coordinate
            };
            console.log(`🔍 CONTROL DATA - Found coordinate-based control: ${key}`, controlData[key]);
        }
        
        // Fallback: try pattern-based detection for other naming formats
        const fallbackControlInfo = getControlTypeAndSetFromSample(sampleName);
        if (fallbackControlInfo && !coordinateToControlInfo[coordinate]) {
            const key = `${fluorophore}_${fallbackControlInfo.type}_${fallbackControlInfo.set}`;
            
            // Only add if not already found via coordinate mapping
            if (!controlData[key]) {
                const expected = getExpectedResult(fallbackControlInfo.type);
                const actual = getActualResult(well);
                const isValid = (expected === actual);
                
                controlData[key] = {
                    fluorophore: fluorophore,
                    controlType: fallbackControlInfo.type,
                    setNumber: fallbackControlInfo.set,
                    sampleName: sampleName,
                    amplitude: amplitude,
                    expected: expected,
                    actual: actual,
                    isValid: isValid,
                    wellId: well.well_id,
                    coordinate: coordinate
                };
                
                console.log(`🔍 CONTROL DATA - Found pattern-based control: ${key}`, controlData[key]);
            }
        }
        
        if (potentialControls.includes(sampleName) && !coordinateToControlInfo[coordinate] && !getControlTypeAndSetFromSample(sampleName)) {
            console.log(`🔍 CONTROL DATA - Unmatched potential control: "${sampleName}" in well ${well.well_id} (${coordinate})`);
        }
    });
    
    console.log('🔍 CONTROL DATA - Final control data keys:', Object.keys(controlData));
    return controlData;
}

function getControlTypeAndSetFromSample(sampleName) {
    if (!sampleName) return null;
    
    const name = sampleName.toString().trim();
    
    // Pattern matching for the actual BVAB control naming format: AcBVAB362273G23NTC-2578825
    const bvabPatterns = [
        { regex: /AcBVAB\d+[A-P]\d+([HML])-\d+/, typeIndex: 1 },        // AcBVAB362273G23H-2578825
        { regex: /AcBVAB\d+[A-P]\d+(NTC)-\d+/, typeIndex: 1 }           // AcBVAB362273G23NTC-2578825
    ];
    
    for (const pattern of bvabPatterns) {
        const match = name.match(pattern.regex);
        if (match) {
            const type = match[pattern.typeIndex];
            
            // Extract coordinate-based set number from the sample name
            // Map common control coordinates to set numbers
            let set = 1; // Default
            
            if (name.includes('G23') || name.includes('G10')) set = 1;      // Set 1
            else if (name.includes('P20') || name.includes('K19')) set = 2; // Set 2  
            else if (name.includes('L24') || name.includes('A15')) set = 3; // Set 3
            else if (name.includes('C20') || name.includes('M5')) set = 4;  // Set 4
            
            return {
                type: type,
                set: set
            };
        }
    }
    
    // Fallback: Legacy pattern matching for other formats
    const legacyPatterns = [
        { regex: /([HML])-(\d+)$/, typeIndex: 1, setIndex: 2 },        // H-1, M-2, L-3
        { regex: /([HML])(\d+)$/, typeIndex: 1, setIndex: 2 },          // H1, M2, L3
        { regex: /(NTC)-(\d+)$/, typeIndex: 1, setIndex: 2 },           // NTC-1
        { regex: /(NTC)(\d+)$/, typeIndex: 1, setIndex: 2 },            // NTC1
        { regex: /^([HML])-(\d+)/, typeIndex: 1, setIndex: 2 },         // H-1 at start
        { regex: /^(NTC)-(\d+)/, typeIndex: 1, setIndex: 2 }            // NTC-1 at start
    ];
    
    for (const pattern of legacyPatterns) {
        const match = name.match(pattern.regex);
        if (match) {
            return {
                type: match[pattern.typeIndex],
                set: parseInt(match[pattern.setIndex])
            };
        }
    }
    
    return null;
}

function getExpectedResult(controlType) {
    switch (controlType) {
        case 'H':
        case 'M':
        case 'L':
            return 'POS';
        case 'NTC':
            return 'NEG';
        default:
            return 'UNKNOWN';
    }
}

function getActualResult(wellData) {
    // Use the shared strict result classification logic from script.js
    if (window.classifyResult) {
        return window.classifyResult(wellData);
    } else {
        console.error('classifyResult is not defined on window!');
        return 'REDO';
    }
}

function extractCoordinateFromWellId(wellId) {
    if (!wellId) return 'Unknown';
    const parts = wellId.split('_');
    return parts[0] || 'Unknown';
}

function createTabbedPathogenGrids(container, testCode, controlData) {
    let allPathogens = [];
    
    if (testCode === 'BVAB') {
        allPathogens = [
            { name: 'BVAB1', fluorophore: 'HEX' },
            { name: 'BVAB2', fluorophore: 'FAM' },
            { name: 'BVAB3', fluorophore: 'Cy5' }
        ];
    } else if (testCode === 'BVPanelPCR3') {
        allPathogens = [
            { name: 'Bifidobacterium breve', fluorophore: 'Cy5' },
            { name: 'Gardnerella vaginalis', fluorophore: 'FAM' },
            { name: 'Lactobacillus acidophilus', fluorophore: 'HEX' },
            { name: 'Prevotella bivia', fluorophore: 'Texas Red' }
        ];
    } else if (testCode === 'Cglab') {
        allPathogens = [
            { name: 'Candida glabrata', fluorophore: 'FAM' }
        ];
    } else if (testCode === 'Ngon') {
        allPathogens = [
            { name: 'Neisseria gonhorrea', fluorophore: 'HEX' }
        ];
    } else if (testCode === 'Calb') {
        allPathogens = [
            { name: 'Candida albicans', fluorophore: 'HEX' }
        ];
    } else if (testCode === 'Ctrach') {
        allPathogens = [
            { name: 'Chlamydia trachomatis', fluorophore: 'FAM' }
        ];
    } else if (testCode === 'Tvag') {
        allPathogens = [
            { name: 'Trichomonas vaginalis', fluorophore: 'FAM' }
        ];
    } else if (testCode === 'Mgen') {
        allPathogens = [
            { name: 'Mycoplasma genitalium', fluorophore: 'FAM' }
        ];
    } else if (testCode === 'Upar') {
        allPathogens = [
            { name: 'Ureaplasma parvum', fluorophore: 'FAM' }
        ];
    } else if (testCode === 'Uure') {
        allPathogens = [
            { name: 'Ureaplasma urealyticum', fluorophore: 'FAM' }
        ];
    }
    
    // Filter pathogens to only include those with actual control data
    const pathogensWithData = allPathogens.filter(pathogen => {
        const controlSets = getControlSetsForPathogen(pathogen.fluorophore, controlData);
        const hasData = Object.keys(controlSets).length > 0;
        console.log(`🔍 PATHOGEN FILTER - ${pathogen.name} (${pathogen.fluorophore}): ${hasData ? 'HAS DATA' : 'NO DATA'} (sets: ${Object.keys(controlSets).length})`);
        return hasData;
    });
    
    console.log(`🔍 PATHOGEN TABS - Filtered ${allPathogens.length} pathogens to ${pathogensWithData.length} with data`);
    
    // If no pathogens have data, check if there's any control data at all before showing "no data" message
    if (pathogensWithData.length === 0) {
        const totalControlDataKeys = Object.keys(controlData).length;
        console.log(`🔍 PATHOGEN TABS - Total control data keys available: ${totalControlDataKeys}`);
        
        if (totalControlDataKeys > 0) {
            // There is control data, but fluorophore filtering failed
            console.log('🔍 PATHOGEN TABS - Control data exists but fluorophore filtering failed, using fallback approach');
            
            // Fallback: Show all pathogens and let each one try to find data
            const pathogensWithFallback = allPathogens.map(pathogen => {
                // Try to find any control data that could belong to this pathogen
                const fallbackSets = {};
                Object.keys(controlData).forEach(key => {
                    const control = controlData[key];
                    // If fluorophore matches, or if there's only one fluorophore in dataset
                    if (control.fluorophore === pathogen.fluorophore || 
                        control.fluorophore === 'Unknown' ||
                        datasetFluorophores.length === 1) {
                        const setNum = control.setNumber;
                        if (!fallbackSets[setNum]) {
                            fallbackSets[setNum] = {};
                        }
                        fallbackSets[setNum][control.controlType] = {
                            coordinate: control.coordinate,
                            amplitude: control.amplitude,
                            isValid: control.isValid
                        };
                    }
                });
                return {
                    ...pathogen,
                    fallbackSets: fallbackSets,
                    hasData: Object.keys(fallbackSets).length > 0
                };
            }).filter(p => p.hasData);
            
            if (pathogensWithFallback.length > 0) {
                console.log(`🔍 PATHOGEN TABS - Fallback found ${pathogensWithFallback.length} pathogens with data`);
                // Use fallback data for rendering
                createTabbedPathogenGridsWithFallback(container, pathogensWithFallback, controlData);
                return;
            }
        }
        
        // Only show "no control data" if there's actually no control data
        container.innerHTML = `
            <div class="no-control-data-message">
                <p style="color: #888; font-style: italic; text-align: center; padding: 20px;">
                    No control data available for ${testCode} test
                </p>
            </div>
        `;
        console.log('🔍 PATHOGEN TABS - No control data found for any pathogen');
        return;
    }
    
    // Create tabbed interface only for pathogens with data
    let tabsHTML = '<div class="pathogen-tabs-container">';
    
    // Tab headers (only for pathogens with data)
    if (pathogensWithData.length > 1) {
        tabsHTML += '<div class="pathogen-tab-headers">';
        pathogensWithData.forEach((pathogen, index) => {
            const activeClass = index === 0 ? ' active' : '';
            tabsHTML += `<button class="pathogen-tab-header${activeClass}" onclick="showPathogenTab('${pathogen.fluorophore}')">${pathogen.name}</button>`;
        });
        tabsHTML += '</div>';
    }
    
    // Tab content
    tabsHTML += '<div class="pathogen-tab-content">';
    pathogensWithData.forEach((pathogen, index) => {
        const activeClass = index === 0 ? ' active' : '';
        const displayStyle = pathogensWithData.length === 1 ? 'block' : (index === 0 ? 'block' : 'none');
        tabsHTML += `<div id="tab-${pathogen.fluorophore}" class="pathogen-tab-panel${activeClass}" style="display: ${displayStyle};">`;
        tabsHTML += createSinglePathogenControlGrid(pathogen, controlData);
        tabsHTML += '</div>';
    });
    tabsHTML += '</div>';
    
    tabsHTML += '</div>';
    
    container.innerHTML = tabsHTML;
    console.log(`🔍 PATHOGEN TABS - Tabbed pathogen grids created for ${testCode} with ${pathogensWithData.length} pathogen(s)`);
}

function createSinglePathogenControlGrid(pathogen, controlData) {
    const controlTypes = ['H', 'M', 'L', 'NTC'];
    
    // Get actual control sets with their coordinates from the data
    const controlSets = getControlSetsForPathogen(pathogen.fluorophore, controlData);
    const setNumbers = Object.keys(controlSets).sort();
    
    console.log(`🔍 PATHOGEN GRID - ${pathogen.name} control sets:`, controlSets);
    
    let gridHTML = `
        <div class="single-pathogen-grid">
            <h4>${pathogen.name} (${pathogen.fluorophore})</h4>
            <div class="control-grid-table" data-sets="${setNumbers.length}">
                <div class="grid-corner">Control</div>
    `;
    
    // Add set headers directly
    setNumbers.forEach(setNum => {
        gridHTML += `<div class="set-header">Set ${setNum}</div>`;
    });
    
    // Add control rows directly without wrapper divs
    controlTypes.forEach(controlType => {
        const ntcClass = controlType === 'NTC' ? ' ntc-label' : '';
        gridHTML += `<div class="control-type-label${ntcClass}">${controlType}</div>`;
        
        setNumbers.forEach(setNum => {
            const key = `${pathogen.fluorophore}_${controlType}_${setNum}`;
            const controlInfo = controlData[key];
            
            let cellClass = 'pending';
            let symbol = '-';
            let coordinate = '?';
            let tooltip = `${controlType} Set ${setNum}: No data available`;
            
            if (controlInfo) {
                cellClass = controlInfo.isValid ? 'valid' : 'invalid';
                symbol = controlInfo.isValid ? '✓' : '✗';
                coordinate = controlInfo.isValid ? controlInfo.coordinate : 'N/A';
                tooltip = `${controlType} Set ${setNum} (${coordinate}): Expected ${controlInfo.expected}, Got ${controlInfo.actual} (Amplitude: ${controlInfo.amplitude.toFixed(1)})`;
            } else {
                // Check if this set exists for this fluorophore
                const setData = controlSets[setNum];
                if (setData && setData[controlType]) {
                    coordinate = setData[controlType].coordinate;
                    tooltip = `${controlType} Set ${setNum} (${coordinate}): Expected data not found`;
                }
            }
            
            gridHTML += `<div class="control-cell ${cellClass}" title="${tooltip}">
                <span class="control-symbol">${symbol}</span>
                <span class="control-coordinate">${coordinate}</span>
            </div>`;
        });
    });
    
    gridHTML += `
            </div>
        </div>
    `;
    
    return gridHTML;
}

function getControlSetsForPathogen(fluorophore, controlData) {
    const controlSets = {};
    
    // Group control data by set number for this specific fluorophore
    Object.keys(controlData).forEach(key => {
        const control = controlData[key];
        if (control.fluorophore === fluorophore) {
            const setNum = control.setNumber;
            if (!controlSets[setNum]) {
                controlSets[setNum] = {};
            }
            controlSets[setNum][control.controlType] = {
                coordinate: control.coordinate,
                amplitude: control.amplitude,
                isValid: control.isValid
            };
        }
    });
    
    return controlSets;
}

function showPathogenTab(fluorophore) {
    // Hide all tab panels
    const panels = document.querySelectorAll('.pathogen-tab-panel');
    panels.forEach(panel => panel.classList.remove('active'));
    
    // Remove active class from all tab headers
    const headers = document.querySelectorAll('.pathogen-tab-header');
    headers.forEach(header => header.classList.remove('active'));
    
    // Show selected tab panel
    const selectedPanel = document.getElementById(`tab-${fluorophore}`);
    if (selectedPanel) {
        selectedPanel.classList.add('active');
    }
    
    // Add active class to clicked tab header
    const selectedHeader = document.querySelector(`[onclick="showPathogenTab('${fluorophore}')"]`);
    if (selectedHeader) {
        selectedHeader.classList.add('active');
    }
    
    console.log('Switched to pathogen tab:', fluorophore);
}

function createBVPanelPCR3GridsWithData(container, controlSets) {
    const pathogens = [
        { name: 'Bifidobacterium breve', fluorophore: 'Cy5', coordinates: ['A1', 'A5', 'A9', 'A13'] },
        { name: 'Gardnerella vaginalis', fluorophore: 'FAM', coordinates: ['B1', 'B5', 'B9', 'B13'] },
        { name: 'Lactobacillus acidophilus', fluorophore: 'HEX', coordinates: ['C1', 'C5', 'C9', 'C13'] },
        { name: 'Prevotella bivia', fluorophore: 'Texas Red', coordinates: ['D1', 'D5', 'D9', 'D13'] }
    ];
    
    let gridHTML = '';
    
    pathogens.forEach(pathogen => {
        gridHTML += createSinglePathogenGrid(pathogen, controlSets);
    });
    
    container.innerHTML = gridHTML;
    console.log('Real data pathogen grids created for BVPanelPCR3 test');
}

function createSinglePathogenGrid(pathogen, controlSets) {
    const controlTypes = ['H', 'M', 'L', 'NTC'];
    const sets = [1, 2, 3, 4];
    
    let gridHTML = `
        <div class="pathogen-control-grid">
            <h5>${pathogen.name} (${pathogen.fluorophore})</h5>
            <div class="pathogen-grid">
                <div class="pathogen-grid-corner">Control</div>
                <div class="pathogen-set-header">Set 1</div>
                <div class="pathogen-set-header">Set 2</div>
                <div class="pathogen-set-header">Set 3</div>
                <div class="pathogen-set-header">Set 4</div>
    `;
    
    controlTypes.forEach((controlType, typeIndex) => {
        const ntcClass = controlType === 'NTC' ? ' ntc-label' : '';
        
        gridHTML += `
            <div class="pathogen-type-label${ntcClass}">${controlType}</div>
        `;
        
        sets.forEach(setNum => {
            const controlResult = getControlResult(controlSets, pathogen.fluorophore, controlType, setNum);
            gridHTML += `<div class="pathogen-control-cell ${controlResult.class}" title="${controlResult.tooltip}">${controlResult.symbol}</div>`;
        });
    });
    
    gridHTML += `
            </div>
        </div>
    `;
    
    return gridHTML;
}

function createTabbedPathogenGridsWithFallback(container, pathogensWithFallback, controlData) {
    console.log(`🔍 FALLBACK TABS - Creating fallback tabs for ${pathogensWithFallback.length} pathogens`);
    
    // Create tabbed interface using fallback data
    let tabsHTML = '<div class="pathogen-tabs-container">';
    
    // Tab headers (only for pathogens with fallback data)
    if (pathogensWithFallback.length > 1) {
        tabsHTML += '<div class="pathogen-tab-headers">';
        pathogensWithFallback.forEach((pathogen, index) => {
            const activeClass = index === 0 ? ' active' : '';
            tabsHTML += `<button class="pathogen-tab-header${activeClass}" onclick="showPathogenTab('${pathogen.fluorophore}')">${pathogen.name}</button>`;
        });
        tabsHTML += '</div>';
    }
    
    // Tab content using fallback sets
    tabsHTML += '<div class="pathogen-tab-content">';
    pathogensWithFallback.forEach((pathogen, index) => {
        const activeClass = index === 0 ? ' active' : '';
        const displayStyle = pathogensWithFallback.length === 1 ? 'block' : (index === 0 ? 'block' : 'none');
        tabsHTML += `<div id="tab-${pathogen.fluorophore}" class="pathogen-tab-panel${activeClass}" style="display: ${displayStyle};">`;
        
        // Create grid using fallback sets
        tabsHTML += createSinglePathogenControlGridFromFallback(pathogen, pathogen.fallbackSets);
        tabsHTML += '</div>';
    });
    
    tabsHTML += '</div></div>';
    container.innerHTML = tabsHTML;
}

function createSinglePathogenControlGridFromFallback(pathogen, fallbackSets) {
    let gridHTML = `<h4>${pathogen.name} Controls (${pathogen.fluorophore})</h4>`;
    
    if (Object.keys(fallbackSets).length === 0) {
        return gridHTML + '<p>No control data available</p>';
    }
    
    // Use flat grid structure without wrapper divs
    const controlTypes = ['H', 'M', 'L', 'NTC'];
    const setNumbers = Object.keys(fallbackSets).sort();
    
    gridHTML += `
        <div class="single-pathogen-grid">
            <div class="control-grid-table" data-sets="${setNumbers.length}">
                <div class="grid-corner">Control</div>
    `;
    
    // Add set headers directly
    setNumbers.forEach(setNum => {
        gridHTML += `<div class="set-header">Set ${setNum}</div>`;
    });
    
    // Add control rows directly without wrapper divs
    controlTypes.forEach(controlType => {
        const ntcClass = controlType === 'NTC' ? ' ntc-label' : '';
        gridHTML += `<div class="control-type-label${ntcClass}">${controlType}</div>`;
        
        setNumbers.forEach(setNum => {
            const control = fallbackSets[setNum] && fallbackSets[setNum][controlType];
            
            let cellClass = 'pending';
            let symbol = '-';
            let coordinate = '?';
            let tooltip = `${controlType} Set ${setNum}: No data available`;
            
            if (control) {
                cellClass = control.isValid ? 'valid' : 'invalid';
                symbol = control.isValid ? '✓' : '✗';
                coordinate = control.isValid ? control.coordinate : 'N/A';
                const amplitude = control.amplitude ? control.amplitude.toFixed(1) : 'N/A';
                tooltip = `${controlType} Set ${setNum} (${coordinate}): Amplitude ${amplitude}`;
            }
            
            gridHTML += `<div class="control-cell ${cellClass}" title="${tooltip}">
                <span class="control-symbol">${symbol}</span>
                <span class="control-coordinate">${coordinate}</span>
            </div>`;
        });
    });
    
    gridHTML += `
            </div>
        </div>
    `;
    
    return gridHTML;
}

// Export functions for use in main script
window.showPathogenGridsWithData = showPathogenGridsWithData;
window.createTabbedPathogenGrids = createTabbedPathogenGrids;
window.createTabbedPathogenGridsWithFallback = createTabbedPathogenGridsWithFallback;
window.showPathogenTab = showPathogenTab;
window.getRealControlValidationData = getRealControlValidationData;