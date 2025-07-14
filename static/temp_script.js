function populateResultsTable(resultsObj) {
    const tableBody = document.getElementById('resultsTableBody');
    if (!tableBody) {
        console.error("Could not find results table body with ID 'resultsTableBody'");
        return;
    }
    tableBody.innerHTML = ''; // Clear existing rows

    // Ensure resultsObj is the dictionary of wells, not the parent object
    const wells = resultsObj.individual_results || resultsObj;

    if (!wells || typeof wells !== 'object' || Object.keys(wells).length === 0) {
        console.warn("populateResultsTable called with no wells to display.");
        tableBody.innerHTML = '<tr><td colspan="16">No analysis results available.</td></tr>';
        return;
    }

    // Helper to format numbers, displaying 'N/A' for null/undefined/NaN values.
    const format = (num, places = 2) => (num === null || num === undefined || isNaN(Number(num))) ? 'N/A' : Number(num).toFixed(places);

    for (const wellId in wells) {
        const well = wells[wellId];
        if (!well) continue;

        const row = document.createElement('tr');
        row.setAttribute('data-well-id', wellId);
        row.setAttribute('data-fluorophore', well.fluorophore || 'N/A');

        // Safely access nested properties
        const anomalies = (well.anomalies && Object.keys(well.anomalies).length > 0) ? Object.keys(well.anomalies).join(', ') : 'None';
        const curveClass = well.is_good_scurve ? 'Good' : 'Bad';
        const resultStatus = typeof classifyResult === 'function' ? classifyResult(well) : 'N/A';

        row.innerHTML = `
            <td>${well.well_name || 'N/A'}</td>
            <td>${well.sample_name || 'N/A'}</td>
            <td>${well.fluorophore || 'N/A'}</td>
            <td>${resultStatus}</td>
            <td>${curveClass}</td>
            <td>${well.status || 'N/A'}</td>
            <td>${format(well.r_squared)}</td>
            <td>${format(well.rmse)}</td>
            <td>${format(well.amplitude, 0)}</td>
            <td>${format(well.slope)}</td>
            <td>${format(well.midpoint)}</td>
            <td>${format(well.baseline, 0)}</td>
            <td>${format(well.cq_value)}</td>
            <td>${format(well.cqj)}</td>
            <td>${format(well.calcj)}</td>
            <td>${anomalies}</td>
        `;
        tableBody.appendChild(row);
    }
}
