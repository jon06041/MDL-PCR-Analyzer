// Channel Concentration Controls Mapping
// Use this mapping to look up H, M, L values for each test/channel
// Example usage: CONCENTRATION_CONTROLS[testCode]?.[channel]

const CONCENTRATION_CONTROLS = {
    Lacto: {
        Cy5: { H: 1e6, M: 1e4, L: 1e2 },
        FAM: { H: 1e6, M: 1e4, L: 1e2 },
        HEX: { H: 1e6, M: 1e4, L: 1e2 },
        TexasRed: { H: 1e6, M: 1e4, L: 1e2 }
    },
    Calb: {
        HEX: { H: 1e7, M: 1e5, L: 1e3 }
    },
    Ctrach: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    Ngon: {
        HEX: { H: 1e7, M: 1e5, L: 1e3 }
    },
    Tvag: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    Cglab: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    Cpara: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    Ctrop: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    Gvag: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    BVAB2: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    CHVIC: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    AtopVag: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    Megasphaera: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 },
        HEX: { H: 1e7, M: 1e5, L: 1e3 }
    },
    Efaecalis: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    Saureus: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    Ecoli: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    AtopVagNY: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    BVAB2NY: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    GvagNY: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    MegasphaeraNY: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 },
        HEX: { H: 1e7, M: 1e5, L: 1e3 }
    },
    LactoNY: {
        Cy5: { H: 1e7, M: 1e5, L: 1e3 },
        FAM: { H: 1e7, M: 1e5, L: 1e3 },
        HEX: { H: 1e7, M: 1e5, L: 1e3 },
        TexasRed: { H: 1e7, M: 1e5, L: 1e3 }
    },
    RNaseP: {
        HEX: { H: 1e7, M: 1e5, L: 1e3 }
    },
    Mgen: {
        FAM: { H: 1e7, M: 1e5, L: 1e3 }
    },
    BVPanelPCR3: {
        FAM: { H: 1e8, M: 1e6, L: 1e4 },
        HEX: { H: 1e8, M: 1e6, L: 1e4 },
        'Texas Red': { H: 1e8, M: 1e6, L: 1e4 },
        Cy5: { H: 1e8, M: 1e6, L: 1e4 }
    },
    BVPanelPCR2: {
        FAM: { H: 1e8, M: 1e6, L: 1e4 },
        HEX: { H: 1e8, M: 1e6, L: 1e4 },
        'Texas Red': { H: 1e8, M: 1e6, L: 1e4 },
        Cy5: { H: 1e8, M: 1e6, L: 1e4 }
    },
    BVPanelPCR1: {
        FAM: { H: 1e8, M: 1e6, L: 1e4 },
        HEX: { H: 1e8, M: 1e6, L: 1e4 },
        'Texas Red': { H: 1e8, M: 1e6, L: 1e4 },
        Cy5: { H: 1e8, M: 1e6, L: 1e4 }
    },
    BVAB: {
        FAM: { H: 1e8, M: 1e6, L: 1e4 },
        HEX: { H: 1e8, M: 1e6, L: 1e4 },
        Cy5: { H: 1e8, M: 1e6, L: 1e4 }
    },
    // ...repeat for all other tests/channels as needed...
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONCENTRATION_CONTROLS };
}
