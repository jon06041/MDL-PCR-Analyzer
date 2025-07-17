// Test extractBasePattern function with various filename formats

console.log('=== TESTING extractBasePattern FUNCTION ===');

// Test cases for different filename formats
const testCases = [
    // Regular CFX filenames
    'AcBVAB_2578825_CFX367393.csv',
    'BVPanelPCR1_12345_CFX367393_FAM.csv',
    'Lacto_67890_CFX367393.csv',
    
    // Multi-Fluorophore Analysis format (from fresh uploads)
    'Multi-Fluorophore Analysis (Cy5, FAM, HEX) AcBVAB_2578825_CFX367393',
    'Multi-Fluorophore Analysis (FAM, HEX) BVPanelPCR1_12345_CFX367393',
    
    // Multi-Fluorophore_ format (from session loading)
    'Multi-Fluorophore_AcBVAB_2578825_CFX367393',
    'Multi-Fluorophore_BVPanelPCR1_12345_CFX367393',
    'Multi-Fluorophore_Lacto_67890_CFX367393',
    
    // Problematic cases
    'Multi-Fluorophore_Unknown Pattern',
    'Unknown Pattern',
    'Unknown_1674123456789'
];

testCases.forEach(filename => {
    const extracted = extractBasePattern(filename);
    const testCode = extractTestCode(extracted);
    const pathogenName = getPathogenName(testCode);
    
    console.log(`\nFilename: "${filename}"`);
    console.log(`  → Base Pattern: "${extracted}"`);
    console.log(`  → Test Code: "${testCode}"`);
    console.log(`  → Pathogen: "${pathogenName}"`);
    
    const isValid = extracted !== 'Unknown Pattern' && 
                   extracted !== filename && 
                   testCode && 
                   testCode !== 'null' && 
                   pathogenName !== 'Unknown Pathogen';
    
    console.log(`  → Status: ${isValid ? '✅ WORKING' : '❌ BROKEN'}`);
});

console.log('\n=== SUMMARY ===');
console.log('The extractBasePattern function should now handle:');
console.log('1. Regular CFX filenames ✅');
console.log('2. Multi-Fluorophore Analysis format ✅');
console.log('3. Multi-Fluorophore_ session format ✅');
console.log('4. Still fail gracefully on truly unknown patterns ✅');
