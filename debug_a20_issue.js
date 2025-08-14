/**
 * Debug script to investigate A20 "no data" issue
 * Add this to browser console to diagnose the problem
 */

function debugA20Issue() {
    console.log('🔍 DEBUG A20 ISSUE - Starting investigation...');
    
    // Check if currentAnalysisResults exists
    if (!window.currentAnalysisResults) {
        console.error('❌ window.currentAnalysisResults is null/undefined');
        return;
    }
    
    if (!window.currentAnalysisResults.individual_results) {
        console.error('❌ window.currentAnalysisResults.individual_results is null/undefined');
        return;
    }
    
    const results = window.currentAnalysisResults.individual_results;
    console.log('✅ Found individual_results with', Object.keys(results).length, 'wells');
    
    // Look for A20 specifically
    const a20Variations = ['A20', 'a20', 'A-20', 'A_20'];
    let a20Found = false;
    
    for (const variation of a20Variations) {
        if (results[variation]) {
            console.log('✅ Found A20 data under key:', variation);
            console.log('🔍 A20 data:', results[variation]);
            
            // Check fluorophore assignment
            const fluorophore = results[variation].fluorophore;
            console.log('🔍 A20 fluorophore:', fluorophore || 'MISSING/UNDEFINED');
            
            // Check well_id
            const wellId = results[variation].well_id;
            console.log('🔍 A20 well_id:', wellId || 'MISSING/UNDEFINED');
            
            a20Found = true;
            break;
        }
    }
    
    if (!a20Found) {
        console.log('❌ A20 not found in individual_results');
        console.log('🔍 Available well keys:', Object.keys(results).sort());
        
        // Look for wells starting with A
        const aWells = Object.keys(results).filter(key => key.startsWith('A') || key.startsWith('a'));
        console.log('🔍 Wells starting with A:', aWells.sort());
        
        // Look for wells containing '20'
        const wells20 = Object.keys(results).filter(key => key.includes('20'));
        console.log('🔍 Wells containing "20":', wells20.sort());
    }
    
    // Check current fluorophore filter
    const wellSelector = document.getElementById('wellSelect');
    const currentFluorophore = window.currentFluorophore || 'unknown';
    console.log('🔍 Current fluorophore filter:', currentFluorophore);
    
    if (wellSelector) {
        console.log('🔍 Well selector options count:', wellSelector.options.length);
        console.log('🔍 Well selector innerHTML:', wellSelector.innerHTML.substring(0, 200) + '...');
    }
    
    // Test fluorophore filtering logic
    console.log('🔍 Testing fluorophore filtering...');
    Object.entries(results).slice(0, 5).forEach(([wellKey, result]) => {
        const fluorophore = result.fluorophore || 'Unknown';
        console.log(`  ${wellKey}: fluorophore = "${fluorophore}"`);
    });
}

// Run the debug
debugA20Issue();
