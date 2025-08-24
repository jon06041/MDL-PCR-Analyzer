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
    // Entra/Azure AD role management (access control)
    'ENTRA_ROLE_MANAGEMENT': ['audit_logs'],
    
    // 21 CFR Part 11 (aliases without FDA_ prefix)
    // A: System validation evidence (runs/validation tests)
    'CFR_11_10_A': ['run_files', 'validation_tests'],
    // B: Data integrity & file validity (encryption + audit logs)
    'CFR_11_10_B': ['encryption_evidence', 'audit_logs'],
    // C: Record protection (documentation + some run evidence)
    'CFR_11_10_C': ['documentation', 'run_files'],
    // FDA-prefixed alias for 11.10(c)
    'FDA_CFR_21_11_10_C': ['documentation', 'run_files'],
    // D: Archive protection / record retention — encryption + audit logs are primary, with run files/docs as supporting
    'CFR_11_10_D': ['encryption_evidence', 'audit_logs', 'run_files', 'documentation'],
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

// ---- Policy overrides (per-requirement) stored in localStorage ----
const POLICY_OVERRIDES_KEY = 'evidence_policy_overrides_v1';

function loadPolicyOverrides() {
    try {
        const raw = localStorage.getItem(POLICY_OVERRIDES_KEY);
        if (!raw) return {};
        const obj = JSON.parse(raw);
        return (obj && typeof obj === 'object') ? obj : {};
    } catch { return {}; }
}

function savePolicyOverrides(map) {
    try { localStorage.setItem(POLICY_OVERRIDES_KEY, JSON.stringify(map || {})); } catch {}
}

function getPolicyOverride(reqCode) {
    try {
        const map = loadPolicyOverrides();
        const val = map[reqCode];
        if (Array.isArray(val) && val.length) return val;
        return null;
    } catch { return null; }
}

function setPolicyOverride(reqCode, allowedTypes) {
    try {
        const map = loadPolicyOverrides();
        // sanitize to known categories only
        const known = ['run_files', 'validation_tests', 'encryption_evidence', 'audit_logs', 'documentation', 'risk_management'];
        const clean = (Array.isArray(allowedTypes) ? allowedTypes : []).filter(t => known.includes(t));
        if (!clean.length) {
            delete map[reqCode];
        } else {
            map[reqCode] = clean;
        }
        savePolicyOverrides(map);
        return true;
    } catch { return false; }
}

function clearPolicyOverride(reqCode) {
    try {
        const map = loadPolicyOverrides();
        delete map[reqCode];
        savePolicyOverrides(map);
    } catch {}
}

/**
 * Filter evidence based on requirement type
 */
function getAllowedEvidenceTypes(reqCode) {
    try {
        if (!reqCode || typeof reqCode !== 'string') return REQUIREMENT_EVIDENCE_MAPPING['default'];
        const code = reqCode.toUpperCase();
    // 0) Per-requirement override from UI
    const override = getPolicyOverride(reqCode);
    if (override) return override;
        // Direct mapping first
        if (REQUIREMENT_EVIDENCE_MAPPING[reqCode]) return REQUIREMENT_EVIDENCE_MAPPING[reqCode];

        // Heuristics by pattern for unmapped IDs
    // Access control / RBAC / Entra / Azure AD
    if (/RBAC|ACCESS[_\s-]*CONTROL|ISO[_\s-]*27001.*A[_\s-]*9|ENTRA|AZURE[_\s-]*AD|\bAAD\b|ROLE[_\s-]*MANAGE/.test(code)) {
            return ['audit_logs', 'encryption_evidence'];
        }
        // Encryption / security controls
        if (/ENCRYPT|CRYPTO|SECURITY|HIPAA[_\s-]*164[_\s-]*312/.test(code)) {
            return ['encryption_evidence'];
        }
        // Audit trail
        if (/AUDIT[_\s-]*TRAIL|CFR[_\s-]*11[_\s-]*10[_\s-]*D/.test(code)) {
            return ['audit_logs'];
        }
        // Validation requirements
        if (/VALIDATION|CFR[_\s-]*11[_\s-]*10[_\s-]*A|ISO[_\s-]*13485[_\s-]*4[_\s-]*1[_\s-]*6|ISO[_\s-]*14971[_\s-]*4[_\s-]*4/.test(code)) {
            return ['run_files', 'validation_tests'];
        }
        // CFR 11.10(c): Record protection (documentation + some run evidence)
        if (/CFR[_\s-]*11[_\s-]*10[_\s-]*C/.test(code) || /FDA[_\s-]*CFR[_\s-]*21[_\s-]*11[_\s-]*10[_\s-]*C/.test(code)) {
            return ['documentation', 'run_files'];
        }
        // Quality management
        if (/ISO[_\s-]*13485/.test(code)) {
            return ['run_files', 'documentation'];
        }
        return REQUIREMENT_EVIDENCE_MAPPING['default'];
    } catch {
        return REQUIREMENT_EVIDENCE_MAPPING['default'];
    }
}

function filterEvidenceForRequirement(reqCode, confirmedSessions, pendingSessions, encryptionData) {
    const allowedEvidenceTypes = getAllowedEvidenceTypes(reqCode);
    
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
    // Prefer explicit classifiers
    if (isValidationRequirement(reqCode)) return 'software_validation';
    if (isEncryptionRequirement(reqCode)) return 'data_protection';
    if (isQualityRequirement(reqCode)) return 'quality_management';
    if (isAccessControlRequirement(reqCode)) return 'access_control';
    // Fallback to allowed evidence policy to infer type for custom IDs
    try {
        const allowed = getAllowedEvidenceTypes(reqCode) || [];
        if (allowed.includes('encryption_evidence') && !allowed.includes('run_files')) return 'data_protection';
        if (allowed.includes('audit_logs') && !allowed.includes('run_files')) return 'access_control';
        if (allowed.includes('run_files') || allowed.includes('validation_tests')) return 'software_validation';
        if (allowed.includes('documentation')) return 'quality_management';
    } catch {}
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
    'FDA_CFR_21_11_10_B', 'FDA_CFR_21_11_10_E', 'FDA_CFR_21_11_10_D', 'FDA_CFR_21_11_50',
    'HIPAA_164_312_A_2_IV', 'ISO_27001_A_10_1_1', 'ISO_27001_A_10_1_2',
    // CFR 11 aliases
    'CFR_11_10_B', 'CFR_11_10_E', 'CFR_11_10_D'
    ];
    return encryptionRequirements.includes(reqCode);
}

/**
 * Check if requirement is for quality management
 */
function isQualityRequirement(reqCode) {
    if (reqCode.includes('ISO_13485') && !isValidationRequirement(reqCode)) return true;
    // Record protection CFR 11.10(c) is documentation oriented
    const code = (reqCode || '').toUpperCase();
    if (/CFR[ _-]*11[ _-]*10[ _-]*C/.test(code)) return true;
    // Archive protection CFR 11.10(d): prefer encryption/audit classification when policy allows those
    if (/CFR[ _-]*11[ _-]*10[ _-]*D/.test(code)) {
        try {
            const allowed = getAllowedEvidenceTypes(reqCode) || [];
            if (allowed.includes('encryption_evidence') || allowed.includes('audit_logs')) return false;
        } catch {}
        return true; // fallback if nothing else specified
    }
    return false;
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
function getRelevantEvidenceCount(reqCode, confirmedSessions, pendingSessions, encryptionData, evidenceSources = [], auditLogs = null) {
    const filtered = filterEvidenceForRequirement(reqCode, confirmedSessions, pendingSessions, encryptionData);
    const allowedEvidenceTypes = getAllowedEvidenceTypes(reqCode);

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

    // Count audit log entries when available and allowed
    if (allowedEvidenceTypes.includes('audit_logs')) {
        count += countAuditLogRecords(auditLogs);
    }

    // Count pre-materialized evidence sources from the API with deduplication, after category filtering
    if (Array.isArray(evidenceSources) && evidenceSources.length) {
        try {
            const filteredSources = evidenceSources.filter(s => shouldIncludeSourceForRequirement(reqCode, s));
            count += computeDedupedEvidenceSourcesCount(filteredSources);
        } catch {
            count += computeDedupedEvidenceSourcesCount(evidenceSources);
        }
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
 * Count audit log entries from the ML audit log API payload
 */
function countAuditLogRecords(auditLogData) {
    try {
        if (!auditLogData) return 0;
        if (auditLogData.success === false) return 0;
        if (Array.isArray(auditLogData)) return auditLogData.length;
        if (Array.isArray(auditLogData.log_entries)) return auditLogData.log_entries.length;
        // Generic fallback
        return 0;
    } catch { return 0; }
}

/**
 * Get evidence type badge for UI display
 */
function getEvidenceTypeBadge(reqCode) {
    // Prefer explicit allowed evidence types (including user override) to choose a primary badge
    try {
        const allowed = getAllowedEvidenceTypes(reqCode) || [];
        const has = (t) => allowed.includes(t);
        // Priority: validation_tests > encryption > audit_logs > documentation > risk_management > run_files
        if (has('validation_tests')) return { class: 'bg-primary', text: 'Validation Tests' };
        if (has('encryption_evidence')) return { class: 'bg-success', text: 'Encryption Controls' };
        if (has('audit_logs')) return { class: 'bg-warning text-dark', text: 'Access Controls' };
        if (has('documentation')) return { class: 'bg-info', text: 'Quality Documentation' };
        if (has('risk_management')) return { class: 'bg-secondary', text: 'Risk Mgmt' };
        if (has('run_files')) return { class: 'bg-primary', text: 'Run Files' };
    } catch {}
    // Fallback to category inference
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
    countAuditLogRecords,
    getEvidenceTypeBadge,
    // expose helpers for dashboard-wide metrics
    computeDedupedEvidenceSourcesCount,
    normalizeBaseFilename,
    getGlobalEvidenceCount,
    classifyEvidenceSourceCategory,
    shouldIncludeSourceForRequirement,
    // policy override helpers
    getAllowedEvidenceTypes,
    getPolicyOverride,
    setPolicyOverride,
    clearPolicyOverride,
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

console.log('✅ Evidence Filter System v1.1 loaded successfully (2025-08-19)');

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
    // Remove channelized export suffix like " - Quantification Amplification Results_FAM" or multi-word channels
    base = base.replace(/\s*-\s+Quantification\s+Amplification\s+Results_[A-Za-z0-9\s]+$/i, '');
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
        for (const r of reqs) {
            let needsEnc = false;
            try {
                const allowed = window.EvidenceFilter?.getAllowedEvidenceTypes?.(r.id) || [];
                needsEnc = allowed.includes('encryption_evidence');
            } catch { needsEnc = false; }
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
    const extra = ((source && (source.category || source.type)) || '').toLowerCase();
    const text = `${et} ${desc} ${filename} ${extra}`;

    // 1) Access control / Entra / Azure AD signals → audit logs
    // Prioritize these before generic security/authentication checks
    const accessControlPatterns = [
        /\bentra\b|\bentra id\b|\bazure\s*ad\b|\bazuread\b|\baad\b|\bmsal\b|\boauth\b|\bsaml\b|\bsso\b/,
        /sign[- ]?in|login|logout|conditional access|access review|audit log|directory audit|unified audit|activity log/,
        /rbac|role assignment|role-based|user assignment|group membership|enterprise application|app registration|service principal/
    ];
    if (accessControlPatterns.some((rx) => rx.test(text))) return 'audit_logs';

    // 2) Encryption / security controls (non-access-log specific)
    if (/(encryption|crypt|phi|signature|security)(?!.*(audit|sign[- ]?in|login|entra|azure\s*ad))/ .test(text)) {
        return 'encryption_evidence';
    }

    // 3) qPCR run / validation artifacts — be stricter to avoid matching generic "session"
    const runFilesPatterns = [
        /\bvalidation\b|software validation|test run\b|verification\b/,
        /amplification|cq\b|calcj\b|threshold|baseline|standard curve|control wells|cqj/,
        /qpcr|pcr\b|cfx\b|well\b|plate\b|fluorophore|fam\b|hex\b|cy5\b|texas\s*red/
    ];
    if (runFilesPatterns.some((rx) => rx.test(text))) return 'run_files';

    if (/(audit|access log|activity log|trail)/.test(text)) return 'audit_logs';
    if (/(documentation|sop|procedure|policy|manual|archive|backup|retention|record protection|data retention)/.test(text)) return 'documentation';
    if (/(risk|hazard|mitigation)/.test(text)) return 'risk_management';
    return 'general';
}

/**
 * Decide if an evidence source belongs in a requirement's modal based on mapping
 */
function shouldIncludeSourceForRequirement(reqCode, source) {
    const allowed = getAllowedEvidenceTypes(reqCode);
    const cat = classifyEvidenceSourceCategory(source);
    if (allowed.includes('encryption_evidence') && cat === 'encryption_evidence') return true;
    if ((allowed.includes('run_files') || allowed.includes('validation_tests')) && cat === 'run_files') return true;
    if (allowed.includes('audit_logs') && cat === 'audit_logs') return true;
    if (allowed.includes('documentation') && cat === 'documentation') return true;
    if (allowed.includes('risk_management') && cat === 'risk_management') return true;
    // Otherwise, exclude to keep category-appropriate content only
    return false;
}

