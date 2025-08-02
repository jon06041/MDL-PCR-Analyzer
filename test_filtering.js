// Test script to debug file filtering issue
console.log("Testing file filtering patterns...");

// These are the problematic filenames you mentioned
const testFiles = [
    "AcBVAB_2590898_CFX369291_-_End_Point",
    "AcBVAB_2590898_CFX369291_-_Melt_Curve_Plate_View"
];

// Current exclusion patterns from queue.html
const excludedPatterns = [
    /end_point/i,
    /endpoint/i,
    /_end_point/i,        // Enhanced: catch files like "..._End_Point"
    /_endpoint/i,         // Enhanced: catch files like "..._EndPoint"
    /melt_curve/i,
    /meltcurve/i,
    /melting_curve/i,
    /_melt_curve/i,       // Enhanced: catch files like "..._Melt_Curve"
    /_melting_curve/i,    // Enhanced: catch files like "..._Melting_Curve"
    /plate_view/i,
    /plateview/i,
    /_plate_view/i,       // Enhanced: catch files like "..._Plate_View"
    /standard_curve/i,
    /standardcurve/i,
    /_standard_curve/i,   // Enhanced: catch files like "..._Standard_Curve"
    /thermal_profile/i,
    /thermalprofile/i,
    /_thermal_profile/i,  // Enhanced: catch files like "..._Thermal_Profile"
    /_tm_/i,
    /_derivative/i,
    /_peaks/i,
    /analysis_overview/i, // Additional: catch analysis overview files
    /plate_setup/i,       // Additional: catch plate setup files
    /run_information/i    // Additional: catch run information files
];

// Test each file against patterns
testFiles.forEach(fileName => {
    console.log(`\n=== Testing: ${fileName} ===`);
    const matchedPatterns = excludedPatterns.filter(pattern => pattern.test(fileName));
    console.log(`Matched patterns: ${matchedPatterns.length}`);
    
    if (matchedPatterns.length > 0) {
        console.log("✅ SHOULD BE EXCLUDED");
        matchedPatterns.forEach((pattern, index) => {
            console.log(`  - Pattern ${index}: ${pattern.toString()}`);
        });
    } else {
        console.log("❌ NOT EXCLUDED (THIS IS THE PROBLEM!)");
        
        // Test individual components
        console.log("Testing individual checks:");
        console.log(`  - Contains 'End_Point': ${fileName.includes('End_Point')}`);
        console.log(`  - Contains 'Melt_Curve': ${fileName.includes('Melt_Curve')}`);
        console.log(`  - Contains 'Plate_View': ${fileName.includes('Plate_View')}`);
        
        // Test each pattern individually
        excludedPatterns.forEach((pattern, index) => {
            const matches = pattern.test(fileName);
            if (matches) {
                console.log(`  - Pattern ${index} (${pattern.toString()}): MATCHES`);
            }
        });
    }
});
