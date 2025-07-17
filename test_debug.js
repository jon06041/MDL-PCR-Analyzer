// Debug script to test pattern extraction fixes
// This simulates the exact issue and tests our fixes

console.log('=== TESTING PATTERN EXTRACTION FIXES ===');

// Save original state
const originalAmplificationFiles = window.amplificationFiles || {};
const originalSessionFilename = window.currentSessionFilename;
const originalAnalysisResults = window.currentAnalysisResults;

// TEST 1: Fresh Upload Scenario (Should work)
console.log('\n🟢 TEST 1: Fresh Upload Scenario');
window.amplificationFiles = {
    'FAM': { fileName: 'BVPanelPCR1_12345_CFX_FAM.csv' }
};
window.currentSessionFilename = null;
window.currentAnalysisResults = null;

const freshPattern = getCurrentFullPattern();
console.log(`Fresh Pattern: "${freshPattern}"`);
console.log(`Fresh Test Code: "${extractTestCode(freshPattern)}"`);
console.log(`Fresh Pathogen: "${getPathogenName(extractTestCode(freshPattern))}"`);

// TEST 2: Session Loading (Before our fixes - would fail)
console.log('\n🔴 TEST 2: Session Loading (Pre-fix simulation)');
window.amplificationFiles = {}; // No amplification files
window.currentSessionFilename = null; // No session filename preserved
window.currentAnalysisResults = null; // No analysis results

const brokenPattern = getCurrentFullPattern();
console.log(`Broken Pattern: "${brokenPattern}"`);
console.log(`Broken Test Code: "${extractTestCode(brokenPattern)}"`);
console.log(`Broken Pathogen: "${getPathogenName(extractTestCode(brokenPattern))}"`);

// TEST 3: Session Loading (After our fixes - should work)
console.log('\n🟢 TEST 3: Session Loading (Post-fix)');
window.amplificationFiles = {}; // Still no amplification files
window.currentSessionFilename = 'BVPanelPCR1_12345_CFX_combined.csv'; // But session filename preserved
window.currentAnalysisResults = {
    filename: 'BVPanelPCR1_12345_CFX_combined.csv'
}; // And analysis results with filename

const fixedPattern = getCurrentFullPattern();
console.log(`Fixed Pattern: "${fixedPattern}"`);
console.log(`Fixed Test Code: "${extractTestCode(fixedPattern)}"`);
console.log(`Fixed Pathogen: "${getPathogenName(extractTestCode(fixedPattern))}"`);

// TEST 4: Multiple pathogen types
console.log('\n🧪 TEST 4: Multiple Pathogen Types');
const testFiles = [
    'Lacto_67890_CFX.csv',
    'Ctrach_11111_CFX.csv',
    'BVPanelPCR3_22222_CFX.csv',
    'Ngon_33333_CFX.csv'
];

testFiles.forEach(filename => {
    window.currentSessionFilename = filename;
    const pattern = getCurrentFullPattern();
    const testCode = extractTestCode(pattern);
    const pathogenName = getPathogenName(testCode);
    console.log(`${filename} → "${pattern}" → "${testCode}" → "${pathogenName}"`);
});

// SUMMARY
console.log('\n=== SUMMARY ===');
const fresh_works = freshPattern !== 'Unknown Pattern';
const broken_fails = brokenPattern === 'Unknown Pattern'; // This should be true (broken as expected)
const fixed_works = fixedPattern !== 'Unknown Pattern';

console.log(`Fresh Upload Works: ${fresh_works ? '✅' : '❌'}`);
console.log(`Pre-fix Broken (expected): ${broken_fails ? '✅' : '❌'}`);
console.log(`Post-fix Works: ${fixed_works ? '✅' : '❌'}`);

if (fresh_works && broken_fails && fixed_works) {
    console.log('🎉 ALL TESTS PASS! Fixes are working correctly.');
} else {
    console.log('⚠️ Some tests failed. Need investigation.');
}

// Restore original state
window.amplificationFiles = originalAmplificationFiles;
window.currentSessionFilename = originalSessionFilename;
window.currentAnalysisResults = originalAnalysisResults;
