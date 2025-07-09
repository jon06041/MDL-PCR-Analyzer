function formatNumber(val) {
    if (typeof val === "number") return val.toFixed(2);
    if (!isNaN(val) && val !== null && val !== undefined && val !== "") return Number(val).toFixed(2);
    return val;
}