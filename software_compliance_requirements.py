"""
Software-Trackable Compliance Requirements
Only includes regulations that can be validated through software operation and usage
Organized by regulatory organization and trackable through app activities
"""

SOFTWARE_TRACKABLE_REQUIREMENTS = {
    # FDA 21 CFR Part 11 - Electronic Records and Electronic Signatures
    "FDA_CFR_21": {
        "organization": "FDA",
        "regulation": "21 CFR Part 11",
        "title": "Electronic Records; Electronic Signatures",
        "trackable_requirements": {
            "CFR_11_10_A": {
                "code": "CFR_11_10_A",
                "title": "Software Validation Controls",
                "description": "System capable of accurately and reliably performing intended functions",
                "section": "§ 11.10(a)",
                "tracked_by": ["ANALYSIS_COMPLETED", "QC_ANALYZED", "SYSTEM_VALIDATION"],
                "evidence_type": "Analysis execution success rates and system performance metrics",
                "auto_trackable": True
            },
            "CFR_11_10_B": {
                "code": "CFR_11_10_B",
                "title": "Data Integrity Assurance",
                "description": "Ability to discern invalid or altered records",
                "section": "§ 11.10(b)",
                "tracked_by": ["DATA_EXPORTED", "FILE_UPLOADED", "DATA_MODIFIED"],
                "evidence_type": "Data integrity checks and file validation logs",
                "auto_trackable": True
            },
            "CFR_11_10_C": {
                "code": "CFR_11_10_C",
                "title": "Electronic Record Generation",
                "description": "Generation of accurate and complete copies of records",
                "section": "§ 11.10(c)",
                "tracked_by": ["REPORT_GENERATED", "DATA_EXPORTED", "ANALYSIS_COMPLETED"],
                "evidence_type": "Report generation logs and export functionality verification",
                "auto_trackable": True
            },
            "CFR_11_10_D": {
                "code": "CFR_11_10_D",
                "title": "Archive Protection",
                "description": "Protection of records to enable their accurate retrieval",
                "section": "§ 11.10(d)",
                "tracked_by": ["DATA_EXPORTED", "ANALYSIS_COMPLETED"],
                "evidence_type": "Data export and backup functionality demonstration",
                "auto_trackable": True
            },
            "CFR_11_10_E": {
                "code": "CFR_11_10_E",
                "title": "User Access Controls",
                "description": "Limited system access to authorized individuals",
                "section": "§ 11.10(e)",
                "tracked_by": ["USER_LOGIN", "ACCESS_DENIED", "ROLE_ASSIGNED", "PERMISSION_CHECKED"],
                "evidence_type": "User authentication and access control logs",
                "auto_trackable": True,
                "implementation_status": "planned",
                "implementation_features": [
                    "Role-based access control (Admin, QC Tech, Analyst, Viewer)",
                    "User authentication with login/logout tracking",
                    "Permission verification for sensitive operations",
                    "Access attempt logging with success/failure tracking"
                ]
            },
            "CFR_11_10_F": {
                "code": "CFR_11_10_F",
                "title": "Operational System Checks",
                "description": "Use of operational system checks to enforce permitted sequencing",
                "section": "§ 11.10(f)",
                "tracked_by": ["WORKFLOW_ENFORCED", "SEQUENCE_VALIDATED", "SYSTEM_CHECK_PERFORMED"],
                "evidence_type": "Workflow enforcement and operational sequence validation",
                "auto_trackable": True,
                "implementation_status": "partial",
                "implementation_features": [
                    "Analysis workflow enforcement (upload → analyze → review → export)",
                    "QC workflow validation (controls required before sample analysis)",
                    "Data integrity checks before export",
                    "Mandatory review steps for critical results"
                ]
            },
            "CFR_11_10_G": {
                "code": "CFR_11_10_G",
                "title": "User Identity Verification",
                "description": "Determination that persons attempting to access are authorized",
                "section": "§ 11.10(g)",
                "tracked_by": ["USER_LOGIN", "USER_AUTHENTICATION", "ACCESS_DENIED", "IDENTITY_VERIFIED"],
                "evidence_type": "Authentication attempt logs and user verification records",
                "auto_trackable": True,
                "implementation_status": "planned",
                "implementation_features": [
                    "Multi-factor authentication integration",
                    "User identity verification with external providers",
                    "Session management and timeout tracking",
                    "Failed authentication attempt monitoring"
                ]
            },
            "CFR_11_10_H": {
                "code": "CFR_11_10_H",
                "title": "Authority Checks",
                "description": "Use of authority checks to ensure only authorized individuals use the system",
                "section": "§ 11.10(h)",
                "tracked_by": ["AUTHORITY_VERIFIED", "ROLE_CHECKED", "PRIVILEGED_ACTION_LOGGED"],
                "evidence_type": "Authority verification and privileged action logging",
                "auto_trackable": True,
                "implementation_status": "planned",
                "implementation_features": [
                    "Authority checks for ML model training",
                    "Supervisor approval for compliance actions",
                    "Privileged operation logging (data deletion, system config)",
                    "Role hierarchy enforcement"
                ]
            },
            "CFR_11_30": {
                "code": "CFR_11_30",
                "title": "Electronic Signature Controls",
                "description": "Controls for electronic signatures",
                "section": "§ 11.30",
                "tracked_by": ["ELECTRONIC_SIGNATURE_APPLIED", "SIGNATURE_VERIFIED", "APPROVAL_RECORDED"],
                "evidence_type": "Electronic signature application and verification logs",
                "auto_trackable": True,
                "implementation_status": "planned",
                "implementation_features": [
                    "Digital signatures for report approval",
                    "Electronic signatures for compliance evidence",
                    "Signature verification and tamper detection",
                    "Audit trail for signed documents"
                ]
            }
        }
    },
    
    # Data Security and Encryption Requirements
    "DATA_SECURITY": {
        "organization": "FDA/HIPAA",
        "regulation": "Data Protection and Security",
        "title": "Data Security and Encryption Requirements",
        "trackable_requirements": {
            "DATA_ENCRYPTION_TRANSIT": {
                "code": "DATA_ENCRYPTION_TRANSIT",
                "title": "Data Encryption in Transit",
                "description": "All data transmissions must be encrypted",
                "section": "Security Best Practices",
                "tracked_by": ["HTTPS_ENFORCED", "SECURE_UPLOAD", "ENCRYPTED_COMMUNICATION"],
                "evidence_type": "HTTPS usage and secure communication logging",
                "auto_trackable": True,
                "implementation_status": "ready_to_implement",
                "implementation_features": [
                    "HTTPS enforcement for all communications",
                    "Secure file upload with encryption",
                    "TLS certificate management and monitoring",
                    "Encrypted API communications"
                ]
            },
            "DATA_ENCRYPTION_REST": {
                "code": "DATA_ENCRYPTION_REST",
                "title": "Data Encryption at Rest",
                "description": "All stored data must be encrypted",
                "section": "Security Best Practices",
                "tracked_by": ["DATABASE_ENCRYPTED", "FILE_ENCRYPTED", "ENCRYPTION_KEY_ROTATED"],
                "evidence_type": "Database and file encryption status verification",
                "auto_trackable": True,
                "implementation_status": "ready_to_implement",
                "implementation_features": [
                    "Database encryption (SQLite → PostgreSQL with encryption)",
                    "Encrypted file storage for uploads and exports",
                    "Encryption key management and rotation",
                    "Encrypted backup storage"
                ]
            },
            "ACCESS_LOGGING": {
                "code": "ACCESS_LOGGING",
                "title": "Comprehensive Access Logging",
                "description": "All system access must be logged and monitored",
                "section": "Security Best Practices",
                "tracked_by": ["ACCESS_LOGGED", "LOGIN_TRACKED", "ACTION_AUDITED", "SECURITY_EVENT_LOGGED"],
                "evidence_type": "Comprehensive access and action audit logs",
                "auto_trackable": True,
                "implementation_status": "partial",
                "implementation_features": [
                    "User session tracking with timestamps",
                    "Action-level audit logging",
                    "Security event monitoring and alerting",
                    "Failed access attempt tracking"
                ]
            }
        }
    },
    
    # CLIA - Clinical Laboratory Improvement Amendments
    "CLIA": {
        "organization": "CLIA",
        "regulation": "Clinical Laboratory Improvement Amendments",
        "title": "Laboratory Quality Standards",
        "trackable_requirements": {
            "CLIA_493_1251": {
                "code": "CLIA_493_1251",
                "title": "Quality Control Procedures",
                "description": "Quality control procedures that monitor test performance",
                "section": "§ 493.1251",
                "tracked_by": ["QC_ANALYZED", "CONTROL_ANALYZED", "NEGATIVE_CONTROL_VERIFIED"],
                "evidence_type": "Control sample analysis logs and QC procedure execution",
                "auto_trackable": True
            },
            "CLIA_493_1252": {
                "code": "CLIA_493_1252",
                "title": "Quality Control Frequency",
                "description": "Performance of quality control as specified",
                "section": "§ 493.1252",
                "tracked_by": ["QC_ANALYZED", "CONTROL_ANALYZED"],
                "evidence_type": "QC execution frequency and compliance tracking",
                "auto_trackable": True
            },
            "CLIA_493_1253": {
                "code": "CLIA_493_1253",
                "title": "Quality Control Documentation",
                "description": "Documentation of quality control results",
                "section": "§ 493.1253",
                "tracked_by": ["QC_ANALYZED", "REPORT_GENERATED"],
                "evidence_type": "QC result documentation and report generation",
                "auto_trackable": True
            },
            "CLIA_493_1281": {
                "code": "CLIA_493_1281",
                "title": "Test Result Documentation",
                "description": "Test results must be documented",
                "section": "§ 493.1281",
                "tracked_by": ["ANALYSIS_COMPLETED", "REPORT_GENERATED", "RESULT_VERIFIED"],
                "evidence_type": "Test result generation and documentation logs",
                "auto_trackable": True
            }
        }
    },
    
    # CAP - College of American Pathologists
    "CAP": {
        "organization": "CAP",
        "regulation": "Laboratory Accreditation Program",
        "title": "Laboratory Quality Standards",
        "trackable_requirements": {
            "CAP_GEN_43400": {
                "code": "CAP_GEN_43400",
                "title": "Information System Validation",
                "description": "Laboratory information systems are validated",
                "section": "GEN.43400",
                "tracked_by": ["SYSTEM_VALIDATION", "SOFTWARE_FEATURE_USED", "ANALYSIS_COMPLETED"],
                "evidence_type": "System validation activities and software functionality verification",
                "auto_trackable": True
            },
            "CAP_GEN_43420": {
                "code": "CAP_GEN_43420",
                "title": "Data Integrity Controls",
                "description": "Controls to ensure data integrity",
                "section": "GEN.43420",
                "tracked_by": ["DATA_EXPORTED", "CALCULATION_PERFORMED", "DATA_MODIFIED"],
                "evidence_type": "Data integrity verification and calculation validation",
                "auto_trackable": True
            },
            "CAP_GEN_40425": {
                "code": "CAP_GEN_40425",
                "title": "Quality Control Documentation",
                "description": "Quality control activities are documented",
                "section": "GEN.40425",
                "tracked_by": ["QC_ANALYZED", "CONTROL_ANALYZED", "REPORT_GENERATED"],
                "evidence_type": "QC documentation and control analysis records",
                "auto_trackable": True
            }
        }
    },
    
    # ISO 15189 - Medical Laboratories
    "ISO_15189": {
        "organization": "ISO",
        "regulation": "ISO 15189:2012",
        "title": "Medical laboratories - Requirements for quality and competence",
        "trackable_requirements": {
            "ISO_15189_5_5_1": {
                "code": "ISO_15189_5_5_1",
                "title": "Equipment Validation",
                "description": "Equipment and measurement systems validation",
                "section": "5.5.1",
                "tracked_by": ["SYSTEM_VALIDATION", "ANALYSIS_COMPLETED", "QC_ANALYZED"],
                "evidence_type": "Equipment validation through software operation and analysis",
                "auto_trackable": True
            },
            "ISO_15189_5_8_2": {
                "code": "ISO_15189_5_8_2",
                "title": "Quality Control Procedures",
                "description": "Quality control procedures designed to verify attainment of intended quality",
                "section": "5.8.2",
                "tracked_by": ["QC_ANALYZED", "CONTROL_ANALYZED", "NEGATIVE_CONTROL_VERIFIED"],
                "evidence_type": "Quality control procedure execution and verification",
                "auto_trackable": True
            },
            "ISO_15189_4_14_7": {
                "code": "ISO_15189_4_14_7",
                "title": "Information System Management",
                "description": "Laboratory information management system controls",
                "section": "4.14.7",
                "tracked_by": ["DATA_EXPORTED", "REPORT_GENERATED", "DATA_MODIFIED"],
                "evidence_type": "Information system operation and data management",
                "auto_trackable": True
            }
        }
    },
    
    # Machine Learning Specific Requirements (Based on FDA AI/ML Guidance)
    "FDA_AI_ML": {
        "organization": "FDA",
        "regulation": "AI/ML-Based Software Guidance",
        "title": "Software as Medical Device (SaMD) - AI/ML",
        "trackable_requirements": {
            "AI_ML_VALIDATION": {
                "code": "AI_ML_VALIDATION",
                "title": "ML Model Validation",
                "description": "AI/ML models must be validated for intended use",
                "section": "AI/ML Guidance",
                "tracked_by": ["ML_MODEL_TRAINED", "ML_ACCURACY_VALIDATED", "ML_PERFORMANCE_TRACKING"],
                "evidence_type": "ML model training, validation, and performance metrics",
                "auto_trackable": True
            },
            "AI_ML_VERSION_CONTROL": {
                "code": "AI_ML_VERSION_CONTROL",
                "title": "Model Version Control",
                "description": "Version control and change tracking for ML models",
                "section": "AI/ML Guidance",
                "tracked_by": ["ML_MODEL_TRAINED", "ML_MODEL_RETRAINED", "ML_VERSION_CONTROL"],
                "evidence_type": "Model versioning and change control documentation",
                "auto_trackable": True
            },
            "AI_ML_PERFORMANCE_MONITORING": {
                "code": "AI_ML_PERFORMANCE_MONITORING",
                "title": "Continuous Performance Monitoring",
                "description": "Ongoing monitoring of AI/ML performance",
                "section": "AI/ML Guidance",
                "tracked_by": ["ML_PREDICTION_MADE", "ML_FEEDBACK_SUBMITTED", "ML_ACCURACY_VALIDATED"],
                "evidence_type": "ML prediction tracking and performance monitoring",
                "auto_trackable": True
            }
        }
    }
}

def get_all_trackable_requirements():
    """Get all software-trackable requirements across all regulations"""
    all_requirements = {}
    
    for regulation_key, regulation_info in SOFTWARE_TRACKABLE_REQUIREMENTS.items():
        for req_code, requirement in regulation_info["trackable_requirements"].items():
            requirement["regulation_source"] = regulation_key
            requirement["organization"] = regulation_info["organization"]
            requirement["regulation_title"] = regulation_info["title"]
            all_requirements[req_code] = requirement
    
    return all_requirements

def get_requirements_by_organization():
    """Get requirements organized by regulatory organization"""
    by_org = {}
    
    for regulation_key, regulation_info in SOFTWARE_TRACKABLE_REQUIREMENTS.items():
        org = regulation_info["organization"]
        if org not in by_org:
            by_org[org] = []
        
        for req_code, requirement in regulation_info["trackable_requirements"].items():
            requirement["regulation_source"] = regulation_key
            requirement["regulation_title"] = regulation_info["title"]
            by_org[org].append(requirement)
    
    return by_org

def get_trackable_events():
    """Get all events that can be tracked for compliance"""
    events = set()
    
    for regulation_key, regulation_info in SOFTWARE_TRACKABLE_REQUIREMENTS.items():
        for req_code, requirement in regulation_info["trackable_requirements"].items():
            events.update(requirement["tracked_by"])
    
    return sorted(list(events))

def get_requirements_by_implementation_status():
    """Get requirements organized by implementation status"""
    by_status = {
        "active": [],      # Currently tracking
        "partial": [],     # Some tracking implemented
        "planned": [],     # Ready to implement when features added
        "ready_to_implement": []  # Technical implementation ready
    }
    
    for regulation_key, regulation_info in SOFTWARE_TRACKABLE_REQUIREMENTS.items():
        for req_code, requirement in regulation_info["trackable_requirements"].items():
            requirement["regulation_source"] = regulation_key
            requirement["organization"] = regulation_info["organization"]
            requirement["regulation_title"] = regulation_info["title"]
            
            status = requirement.get("implementation_status", "active")
            by_status[status].append(requirement)
    
    return by_status

def get_implementation_roadmap():
    """Get roadmap of features to implement for compliance tracking"""
    roadmap = {}
    
    for regulation_key, regulation_info in SOFTWARE_TRACKABLE_REQUIREMENTS.items():
        for req_code, requirement in regulation_info["trackable_requirements"].items():
            if "implementation_features" in requirement:
                roadmap[req_code] = {
                    "title": requirement["title"],
                    "organization": regulation_info["organization"],
                    "status": requirement.get("implementation_status", "active"),
                    "features": requirement["implementation_features"],
                    "tracked_events": requirement["tracked_by"]
                }
    
    return roadmap

def get_compliance_evidence_requirements():
    """Get what evidence each requirement needs for compliance demonstration"""
    evidence_map = {}
    
    for regulation_key, regulation_info in SOFTWARE_TRACKABLE_REQUIREMENTS.items():
        for req_code, requirement in regulation_info["trackable_requirements"].items():
            evidence_map[req_code] = {
                "requirement": requirement["title"],
                "evidence_type": requirement["evidence_type"],
                "tracked_by": requirement["tracked_by"],
                "regulation": f"{regulation_info['organization']} {regulation_info['regulation']}",
                "section": requirement["section"],
                "auto_trackable": requirement["auto_trackable"]
            }
    
    return evidence_map
