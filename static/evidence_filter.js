/**
 * Evidence Filtering System for Unified Compliance Dashboard
 * Fixes the issue where all run files appear for every requirement
 * Version: 1.0 - Clean implementation
 */

// Requirement-specific evidence mapping
const REQUIREMENT_EVIDENCE_MAPPING = {
    // Software Validation Requirements (use run files/validation tests)
    'FDA_CFR_21_11_10_A': ['run_files', 'validation_tests'],
    // 11.10(b): Data integrity & file validity (treat as encryption + audit controls)
    'FDA_CFR_21_11_10_B': ['encryption_evidence', 'audit_logs'], 
    'ISO_13485_4_1_6': ['run_files', 'software_validation'],
    'ISO_14971_4_4': ['run_files', 'risk_management'],
    
    // Data Integrity & Security Requirements (use encryption evidence)
    'FDA_CFR_21_11_10_E': ['encryption_evidence'],
    'FDA_CFR_21_11_50': ['encryption_evidence'], 
    'HIPAA_164_312_A_2_IV': ['encryption_evidence'],
    'ISO_27001_A_10_1_1': ['encryption_evidence'],
    'ISO_27001_A_10_1_2': ['encryption_evidence'],
    
    // Quality Management (use documentation + some run files)
    'ISO_13485_4_2_3': ['run_files', 'documentation'],
    'ISO_13485_7_3_3': ['run_files', 'documentation'],
    
    // Access Control (use encryption + audit logs)
    'HIPAA_164_312_A_1': ['encryption_evidence', 'audit_logs'],
    'ISO_27001_A_9_1_1': ['encryption_evidence', 'audit_logs'],
    
    // 21 CFR Part 11 (aliases without FDA_ prefix)
    // A: System validation evidence (runs/validation tests)
    'CFR_11_10_A': ['run_files', 'validation_tests'],
    // B: Data integrity & file validity (encryption + audit logs)
    'CFR_11_10_B': ['encryption_evidence', 'audit_logs'],
    // C: Record protection (documentation + some run evidence)
    'CFR_11_10_C': ['documentation', 'run_files'],
    // D: Audit trail (audit logs)
    'CFR_11_10_D': ['audit_logs'],
    // E: Controls for system access/security (encryption)
    'CFR_11_10_E': ['encryption_evidence'],
    
    // Default for unmapped requirements
    'default': ['run_files']
};

// Evidence type descriptions for UI
const EVIDENCE_TYPE_DESCRIPTIONS = {
    'run_files': 'qPCR Analysis Run Files and Test Results',
    'encryption_evidence': 'Data Protection and Encryption Controls', 
    'validation_tests': 'Software Validation Test Results',
    'audit_logs': 'System Access and Activity Logs',
    'documentation': 'Procedural Documentation and SOPs',
    'risk_management': 'Risk Assessment and Mitigation Records',
    'software_validation': 'Software Lifecycle and Validation Evidence'
};

/**
 * Filter evidence based on requirement type
 */
function filterEvidenceForRequirement(reqCode, confirmedSessions, pendingSessions, encryptionData) {
    const allowedEvidenceTypes = REQUIREMENT_EVIDENCE_MAPPING[reqCode] || REQUIREMENT_EVIDENCE_MAPPING['default'];
    
    const filteredEvidence = {
        confirmedSessions: [],
        pendingSessions: [],
        encryptionData: null,
        evidenceTypes: allowedEvidenceTypes,
        requirementType: getRequirementType(reqCode)
    };
    
    console.log(`🔍 Filtering evidence for ${reqCode}:`, {
        allowedTypes: allowedEvidenceTypes,
        originalConfirmed: confirmedSessions?.length || 0,
        originalPending: pendingSessions?.length || 0
    });
    
    // Include run files only if allowed for this requirement
    if (allowedEvidenceTypes.includes('run_files') || allowedEvidenceTypes.includes('validation_tests')) {
        if (isValidationRequirement(reqCode)) {
            // For software validation, include all relevant run files
            filteredEvidence.confirmedSessions = confirmedSessions || [];
            filteredEvidence.pendingSessions = pendingSessions || [];
        } else {
            // For other requirements, limit to recent/relevant runs
            filteredEvidence.confirmedSessions = (confirmedSessions || []).slice(0, 5);
            filteredEvidence.pendingSessions = (pendingSessions || []).slice(0, 3);
        }
    }
    
    // Include encryption evidence only if allowed for this requirement
    if (allowedEvidenceTypes.includes('encryption_evidence')) {
        filteredEvidence.encryptionData = encryptionData;
    }
    
    console.log(`✅ Filtered results for ${reqCode}:`, {
        confirmedCount: filteredEvidence.confirmedSessions.length,
        pendingCount: filteredEvidence.pendingSessions.length,
        hasEncryption: !!filteredEvidence.encryptionData,
        requirementType: filteredEvidence.requirementType
    });
    
    return filteredEvidence;
}

/**
 * Determine requirement type for better categorization
 */
function getRequirementType(reqCode) {
    if (isValidationRequirement(reqCode)) return 'software_validation';
    if (isEncryptionRequirement(reqCode)) return 'data_protection';
    if (isQualityRequirement(reqCode)) return 'quality_management';
    if (isAccessControlRequirement(reqCode)) return 'access_control';
    return 'general';
}

/**
 * Check if requirement is specifically for software validation
 */
function isValidationRequirement(reqCode) {
    const validationRequirements = [
    // 11.10(a) validation; (b) is handled under encryption/access controls
    'FDA_CFR_21_11_10_A', 'CFR_11_10_A',
        'ISO_13485_4_1_6', 'ISO_14971_4_4'
    ];
    return validationRequirements.includes(reqCode);
}

/**
 * Check if requirement is specifically for data protection/encryption
 */
function isEncryptionRequirement(reqCode) {
    const encryptionRequirements = [
    'FDA_CFR_21_11_10_B', 'FDA_CFR_21_11_10_E', 'FDA_CFR_21_11_50',
    'HIPAA_164_312_A_2_IV', 'ISO_27001_A_10_1_1', 'ISO_27001_A_10_1_2',
    // CFR 11 aliases
    'CFR_11_10_B', 'CFR_11_10_E'
    ];
    return encryptionRequirements.includes(reqCode);
}

/**
 * Check if requirement is for quality management
 */
function isQualityRequirement(reqCode) {
    return reqCode.includes('ISO_13485') && !isValidationRequirement(reqCode);
}

/**
 * Check if requirement is for access control
 */
function isAccessControlRequirement(reqCode) {
    const accessRequirements = ['HIPAA_164_312_A_1', 'ISO_27001_A_9_1_1'];
    return accessRequirements.includes(reqCode);
}

/**
 * Generate appropriate evidence description for UI
 */
function getEvidenceDescription(reqCode, evidenceCount) {
    const allowedTypes = REQUIREMENT_EVIDENCE_MAPPING[reqCode] || REQUIREMENT_EVIDENCE_MAPPING['default'];
    
    if (isEncryptionRequirement(reqCode)) {
        return `${evidenceCount} encryption and data protection control${evidenceCount !== 1 ? 's' : ''} implemented`;
    } else if (isValidationRequirement(reqCode)) {
        return `${evidenceCount} validation test run${evidenceCount !== 1 ? 's' : ''} completed`;
    } else if (isQualityRequirement(reqCode)) {
        return `${evidenceCount} quality management evidence item${evidenceCount !== 1 ? 's' : ''} documented`;
    } else {
        return `${evidenceCount} evidence item${evidenceCount !== 1 ? 's' : ''} available`;
    }
}

/**
 * Get relevant evidence count for requirement (used in dashboard displays)
 */
function getRelevantEvidenceCount(reqCode, confirmedSessions, pendingSessions, encryptionData, evidenceSources = []) {
    const filtered = filterEvidenceForRequirement(reqCode, confirmedSessions, pendingSessions, encryptionData);

    let count = 0;

    // Session-based evidence (dedupe by base filename to avoid channel-derived duplicates)
    const sessionBaseSet = new Set();
    try {
        const addSession = (s) => {
            const fn = (s && (s.filename || s.file_name || s.name)) || '';
            const base = normalizeBaseFilename(fn);
            if (base) sessionBaseSet.add(base);
        };
        (filtered.confirmedSessions || []).forEach(addSession);
        (filtered.pendingSessions || []).forEach(addSession);
    } catch {}
    count += sessionBaseSet.size;

    // Count encryption evidence as individual records when available
    count += countEncryptionRecords(filtered.encryptionData);

    // Count pre-materialized evidence sources from the API with deduplication
    if (Array.isArray(evidenceSources) && evidenceSources.length) {
        count += computeDedupedEvidenceSourcesCount(evidenceSources);
    }

    return count;
}

/**
 * Count individual encryption evidence records from the encryption API payload
 */
function countEncryptionRecords(encryptionData) {
    if (!encryptionData || encryptionData.success === false) return 0;

    let evidence = null;
    try {
        if (encryptionData.evidence_data) {
            evidence = typeof encryptionData.evidence_data === 'string'
                ? JSON.parse(encryptionData.evidence_data)
                : encryptionData.evidence_data;
        } else if (encryptionData.evidence) {
            evidence = encryptionData.evidence;
        } else {
            evidence = encryptionData;
        }
    } catch (e) {
        // If parsing fails, treat as a single record if it was a successful response
        return 1;
    }

    let cnt = 0;

    // New enhanced format: arrays of compliance evidence entries
    if (evidence && Array.isArray(evidence.compliance_evidence)) {
        cnt += evidence.compliance_evidence.length;
    }

    // Old format: implementation_tests is an object of named tests
    if (evidence && evidence.implementation_tests && typeof evidence.implementation_tests === 'object') {
        cnt += Object.keys(evidence.implementation_tests).length;
    }

    // Simple analysis evidence or minimal payload – count as one record if it has recognizable fields
    if (cnt === 0) {
        if (evidence && (evidence.filename || evidence.encryption_algorithm || evidence.description)) {
            cnt += 1;
        }
    }

    return cnt;
}

/**
 * Get evidence type badge for UI display
 */
function getEvidenceTypeBadge(reqCode) {
    const type = getRequirementType(reqCode);
    const badges = {
        'software_validation': { class: 'bg-primary', text: 'Validation Tests' },
        'data_protection': { class: 'bg-success', text: 'Encryption Controls' },
        'quality_management': { class: 'bg-info', text: 'Quality Documentation' },
        'access_control': { class: 'bg-warning text-dark', text: 'Access Controls' },
        'general': { class: 'bg-secondary', text: 'General Evidence' }
    };
    return badges[type] || badges['general'];
}

// Export for use in the dashboard
window.EvidenceFilter = {
    filterEvidenceForRequirement,
    isValidationRequirement,
    isEncryptionRequirement,
    isQualityRequirement,
    isAccessControlRequirement,
    getRequirementType,
    getEvidenceDescription,
    getRelevantEvidenceCount,
    countEncryptionRecords,
    getEvidenceTypeBadge,
    // expose helpers for dashboard-wide metrics
    computeDedupedEvidenceSourcesCount,
    normalizeBaseFilename,
    getGlobalEvidenceCount,
    classifyEvidenceSourceCategory,
    shouldIncludeSourceForRequirement,
    REQUIREMENT_EVIDENCE_MAPPING,
    EVIDENCE_TYPE_DESCRIPTIONS
};

// Create the specific function the dashboard is looking for
window.getFilteredEvidenceForRequirement = function(reqCode, allSessions) {
    // Use the filtering logic to get only relevant sessions
    const evidenceTypes = REQUIREMENT_EVIDENCE_MAPPING[reqCode] || ['run_files'];
    
    // For encryption requirements, return empty array (evidence comes from encryption API)
    if (evidenceTypes.includes('encryption_evidence') && !evidenceTypes.includes('run_files')) {
        return [];
    }
    
    // For validation/quality requirements, return all sessions
    if (evidenceTypes.includes('run_files')) {
        return allSessions;
    }
    
    // Default: return all sessions
    return allSessions;
};

console.log('✅ Evidence Filter System v1.0 loaded successfully');

/**
 * Normalize a base filename by stripping derived view suffixes and channel suffixes
 * Examples:
 *  AcBVAB_2590898_CFX369291_-_End_Point -> AcBVAB_2590898_CFX369291
 *  AcBVAB_2590898_CFX369291 - Quantification Amplification Results_FAM.csv -> AcBVAB_2590898_CFX369291
 */
function normalizeBaseFilename(filename) {
    if (!filename || typeof filename !== 'string') return '';
    let base = filename.trim();
    // Drop extension
    base = base.replace(/\.[A-Za-z0-9]+$/i, '');
    // Remove known derived view suffixes
    base = base.replace(/-\s*_(End|Melt)_?Point.*$/i, '')
               .replace(/-\s*_?Melt_Curve_Plate_View.*$/i, '')
               .replace(/-\s*_?Melt_Curve.*$/i, '')
               .replace(/-\s*_?End_Point.*$/i, '');
    // Remove channelized export suffix like " - Quantification Amplification Results_FAM"
    base = base.replace(/\s+-\s+Quantification\s+Amplification\s+Results_[A-Za-z0-9]+$/i, '');
    // Remove trailing channel fragments like " - FAM" or "_FAM"
    base = base.replace(/\s*-\s*(FAM|HEX|Cy5|Texas\s*Red)$/i, '')
               .replace(/_(FAM|HEX|Cy5|TexasRed)$/i, '');
    // Trim trailing separators
    base = base.replace(/\s*-\s*$/,'');
    return base;
}

/**
 * Compute deduped count for evidence sources: group repeated Data Integrity/File Validation by day
 */
function computeDedupedEvidenceSourcesCount(evidenceSources) {
    try {
        const groups = new Map();
        let others = 0;
        for (const s of evidenceSources) {
            const et = ((s && s.evidence_type) || '').toLowerCase();
            const isIntegrity = et.includes('data integrity') || et.includes('file validation');
            if (!isIntegrity) { others++; continue; }
            let dateKey = 'unknown';
            try {
                const d = new Date(s.created_at || s.updated_at || Date.now());
                if (!isNaN(d.getTime())) dateKey = d.toISOString().slice(0,10);
            } catch {}
            const key = `${et}__${dateKey}`;
            groups.set(key, (groups.get(key) || 0) + 1);
        }
        return groups.size + others;
    } catch {
        return Array.isArray(evidenceSources) ? evidenceSources.length : 0;
    }
}

/**
 * Compute a global, deduplicated evidence total for dashboard metric
 * - Dedup sessions by base filename
 * - Group integrity/validation evidence sources by day
 * - Count encryption evidence records individually
 */
function getGlobalEvidenceCount(requirements, cachedSessions, encryptionPresenceByReq) {
    const reqs = Array.isArray(requirements) ? requirements : [];
    const confirmed = (cachedSessions && cachedSessions.confirmed) || [];
    const pending = (cachedSessions && cachedSessions.pending) || [];

    // 1) Session files (dedupe by base)
    const sessionBases = new Set();
    const addSess = (s) => {
        const fn = (s && (s.filename || s.file_name || s.name)) || '';
        const base = normalizeBaseFilename(fn);
        if (base) sessionBases.add(base);
    };
    try { confirmed.forEach(addSess); } catch {}
    try { pending.forEach(addSess); } catch {}

    // 2) Evidence sources from requirements (dedupe integrity rows)
    let sourcesCount = 0;
    for (const r of reqs) {
        if (Array.isArray(r.evidence_sources) && r.evidence_sources.length) {
            sourcesCount += computeDedupedEvidenceSourcesCount(r.evidence_sources);
        }
    }

    // 3) Encryption evidence records
    let encCount = 0;
    try {
        const mapping = window.EvidenceFilter?.REQUIREMENT_EVIDENCE_MAPPING || {};
        for (const r of reqs) {
            const needsEnc = Array.isArray(mapping[r.id]) && mapping[r.id].includes('encryption_evidence');
            if (!needsEnc) continue;
            const encData = encryptionPresenceByReq ? encryptionPresenceByReq[r.id] : null;
            encCount += countEncryptionRecords(encData);
        }
    } catch {}

    return sessionBases.size + sourcesCount + encCount;
}

/**
 * Try to classify an evidence source into a broader category for matching
 */
function classifyEvidenceSourceCategory(source) {
    const et = ((source && source.evidence_type) || '').toLowerCase();
    const desc = ((source && source.description) || '').toLowerCase();
    const filename = ((source && source.filename) || '').toLowerCase();
    const text = `${et} ${desc} ${filename}`;
    if (/(encryption|crypt|phi|signature|security|authentication)/.test(text)) return 'encryption_evidence';
    if (/(validation|software validation|test run|analysis session|amplification|cq|calcj|session)/.test(text)) return 'run_files';
    if (/(audit|access log|activity log|trail)/.test(text)) return 'audit_logs';
    if (/(documentation|sop|procedure|policy|manual)/.test(text)) return 'documentation';
    if (/(risk|hazard|mitigation)/.test(text)) return 'risk_management';
    return 'general';
}

/**
 * Decide if an evidence source belongs in a requirement's modal based on mapping
 */
function shouldIncludeSourceForRequirement(reqCode, source) {
    const allowed = REQUIREMENT_EVIDENCE_MAPPING[reqCode] || REQUIREMENT_EVIDENCE_MAPPING['default'];
    const cat = classifyEvidenceSourceCategory(source);
    if (allowed.includes('encryption_evidence') && cat === 'encryption_evidence') return true;
    if ((allowed.includes('run_files') || allowed.includes('validation_tests')) && cat === 'run_files') return true;
    if (allowed.includes('audit_logs') && cat === 'audit_logs') return true;
    if (allowed.includes('documentation') && cat === 'documentation') return true;
    if (allowed.includes('risk_management') && cat === 'risk_management') return true;
    // Otherwise, exclude to keep category-appropriate content only
    return false;
}
