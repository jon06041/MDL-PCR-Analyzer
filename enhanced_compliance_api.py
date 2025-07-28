"""
Enhanced Compliance API for MDL PCR Analyzer
Provides detailed compliance tracking with evidence and export functionality
"""

from flask import Blueprint, jsonify, request, send_file
from datetime import datetime, timedelta
import json
import sqlite3
import io
import csv
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import xlsxwriter
from software_compliance_requirements import SOFTWARE_TRACKABLE_REQUIREMENTS, get_requirements_by_implementation_status
import sqlite3

compliance_api = Blueprint('compliance_api', __name__)

def collect_compliance_evidence():
    """Collect evidence of compliance activities from various database tables"""
    evidence = {}
    
    try:
        # Get database connection
        conn = sqlite3.connect('qpcr_analysis.db')
        conn.row_factory = sqlite3.Row
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get all requirements for evidence collection
        all_requirements = []
        for status_reqs in SOFTWARE_TRACKABLE_REQUIREMENTS.values():
            all_requirements.extend(status_reqs)
        
        for req in all_requirements:
            req_code = req['code']
            evidence[req_code] = {
                'count': 0,
                'events': {},
                'latest_activity': None,
                'details': []
            }
            
            # Collect evidence based on tracked events
            for event in req['tracked_by']:
                event_count = 0
                latest_time = None
                
                if event in ['ANALYSIS_COMPLETED', 'CALCULATION_PERFORMED', 'RESULT_VERIFIED']:
                    cursor.execute("""
                        SELECT COUNT(*) as count, MAX(created_at) as latest 
                        FROM well_results 
                        WHERE created_at > date('now', '-30 days')
                    """)
                    result = cursor.fetchone()
                    event_count = result[0] if result else 0
                    latest_time = result[1] if result else None
                    
                elif event in ['QC_ANALYZED', 'NEGATIVE_CONTROL_VERIFIED', 'CONTROL_ANALYZED']:
                    cursor.execute("""
                        SELECT COUNT(*) as count, MAX(timestamp) as latest 
                        FROM ml_validations 
                        WHERE validation_type = 'qc_check'
                    """)
                    result = cursor.fetchone()
                    event_count = result[0] if result else 0
                    latest_time = result[1] if result else None
                    
                elif event in ['DATA_EXPORTED', 'FILE_UPLOADED', 'DATA_MODIFIED']:
                    cursor.execute("""
                        SELECT COUNT(*) as count, MAX(created_at) as latest 
                        FROM well_results 
                        WHERE data_integrity_hash IS NOT NULL
                    """)
                    result = cursor.fetchone()
                    event_count = result[0] if result else 0
                    latest_time = result[1] if result else None
                    
                elif event in ['SYSTEM_VALIDATION', 'SOFTWARE_FEATURE_USED']:
                    cursor.execute("""
                        SELECT COUNT(*) as count, MAX(timestamp) as latest 
                        FROM system_logs 
                        WHERE log_level = 'INFO'
                    """)
                    result = cursor.fetchone()
                    event_count = result[0] if result else 0
                    latest_time = result[1] if result else None
                    
                elif event in ['REPORT_GENERATED']:
                    cursor.execute("""
                        SELECT COUNT(*) as count, MAX(backup_timestamp) as latest 
                        FROM backup_logs
                    """)
                    result = cursor.fetchone()
                    event_count = result[0] if result else 0
                    latest_time = result[1] if result else None
                    
                elif event in ['ML_ACCURACY_VALIDATED', 'ML_PERFORMANCE_TRACKING', 'ML_PREDICTION_MADE', 
                              'ML_MODEL_TRAINED', 'ML_MODEL_RETRAINED', 'ML_FEEDBACK_SUBMITTED', 'ML_VERSION_CONTROL']:
                    cursor.execute("""
                        SELECT COUNT(*) as count, MAX(timestamp) as latest 
                        FROM ml_validations 
                        WHERE validation_type = 'model_performance'
                    """)
                    result = cursor.fetchone()
                    event_count = result[0] if result else 0
                    latest_time = result[1] if result else None
                
                evidence[req_code]['events'][event] = event_count
                evidence[req_code]['count'] += event_count
                
                if latest_time and (not evidence[req_code]['latest_activity'] or latest_time > evidence[req_code]['latest_activity']):
                    evidence[req_code]['latest_activity'] = latest_time
        
        conn.close()
        
    except Exception as e:
        print(f"Error collecting compliance evidence: {e}")
    
    return evidence

@compliance_api.route('/api/compliance/requirements-by-status')
def get_requirements_by_status_api():
    """Get compliance requirements organized by implementation status"""
    try:
        requirements_by_status = get_requirements_by_implementation_status()
        return jsonify(requirements_by_status)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@compliance_api.route('/api/compliance/evidence-summary')
def get_evidence_summary():
    """Get evidence summary for all requirements"""
    try:
        evidence = collect_compliance_evidence()
        return jsonify(evidence)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@compliance_api.route('/api/compliance/evidence/<req_code>')
def get_detailed_evidence(req_code):
    """Get detailed evidence for a specific requirement"""
    try:
        evidence = collect_compliance_evidence()
        return jsonify({req_code: evidence.get(req_code, {})})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@compliance_api.route('/api/compliance/export/pdf')
def export_pdf():
    """Export compliance evidence to PDF"""
    try:
        evidence = collect_compliance_evidence()
        pdf_buffer = generate_pdf_report(evidence)
        return send_file(
            pdf_buffer,
            as_attachment=True,
            download_name=f'compliance_evidence_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf',
            mimetype='application/pdf'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@compliance_api.route('/api/compliance/export/excel')
def export_excel():
    """Export compliance evidence to Excel"""
    try:
        evidence = collect_compliance_evidence()
        excel_buffer = generate_excel_report(evidence)
        return send_file(
            excel_buffer,
            as_attachment=True,
            download_name=f'compliance_evidence_{datetime.now().strftime("%Y%m%d_%H%M")}.xlsx',
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@compliance_api.route('/api/compliance/export/organization/<org_name>')
def export_organization_report(org_name):
    """Export organization-specific compliance report"""
    try:
        evidence = collect_compliance_evidence()
        pdf_buffer = generate_organization_report(evidence, org_name)
        return send_file(
            pdf_buffer,
            as_attachment=True,
            download_name=f'{org_name}_compliance_report_{datetime.now().strftime("%Y%m%d")}.pdf',
            mimetype='application/pdf'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def generate_pdf_report(evidence):
    """Generate PDF compliance report"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=30,
        alignment=1
    )
    story.append(Paragraph("FDA Compliance Evidence Report", title_style))
    story.append(Spacer(1, 20))
    
    # Report metadata
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", styles['Normal']))
    story.append(Paragraph(f"Total Requirements Tracked: {len(evidence)}", styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Requirements summary table
    data = [['Requirement Code', 'Evidence Count', 'Latest Activity']]
    for req_code, req_evidence in evidence.items():
        latest = req_evidence.get('latest_activity', 'No activity recorded')
        if latest and latest != 'No activity recorded':
            try:
                # Format timestamp if it's a valid datetime string
                latest = datetime.fromisoformat(latest.replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M')
            except:
                pass
        data.append([req_code, str(req_evidence.get('count', 0)), latest])
    
    table = Table(data)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(table)
    doc.build(story)
    buffer.seek(0)
    return buffer

def generate_excel_report(evidence):
    """Generate Excel compliance report"""
    buffer = io.BytesIO()
    
    with xlsxwriter.Workbook(buffer, {'in_memory': True}) as workbook:
        worksheet = workbook.add_worksheet('Compliance Evidence')
        
        # Headers
        headers = ['Requirement Code', 'Evidence Count', 'Latest Activity', 'Event Details']
        for col, header in enumerate(headers):
            worksheet.write(0, col, header)
        
        # Data
        row = 1
        for req_code, req_evidence in evidence.items():
            worksheet.write(row, 0, req_code)
            worksheet.write(row, 1, req_evidence.get('count', 0))
            worksheet.write(row, 2, req_evidence.get('latest_activity', 'No activity'))
            
            # Event details as JSON string
            events_str = json.dumps(req_evidence.get('events', {}))
            worksheet.write(row, 3, events_str)
            row += 1
    
    buffer.seek(0)
    return buffer

def generate_organization_report(evidence, org_name):
    """Generate organization-specific compliance report"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # Custom styles
    title_style = ParagraphStyle(
        'OrgTitle',
        parent=styles['Heading1'],
        fontSize=20,
        spaceAfter=30,
        alignment=1
    )
    
    # Title with organization name
    story.append(Paragraph(f"{org_name} - FDA Compliance Report", title_style))
    story.append(Spacer(1, 20))
    
    # Organization header
    story.append(Paragraph(f"Organization: {org_name}", styles['Heading2']))
    story.append(Paragraph(f"Report Date: {datetime.now().strftime('%B %d, %Y')}", styles['Normal']))
    story.append(Paragraph(f"Software: MDL PCR Analyzer", styles['Normal']))
    story.append(Spacer(1, 30))
    
    # Compliance summary
    total_requirements = len(evidence)
    requirements_with_evidence = sum(1 for req in evidence.values() if req.get('count', 0) > 0)
    compliance_rate = (requirements_with_evidence / total_requirements * 100) if total_requirements > 0 else 0
    
    story.append(Paragraph("Compliance Summary", styles['Heading2']))
    story.append(Paragraph(f"Total Requirements: {total_requirements}", styles['Normal']))
    story.append(Paragraph(f"Requirements with Evidence: {requirements_with_evidence}", styles['Normal']))
    story.append(Paragraph(f"Compliance Rate: {compliance_rate:.1f}%", styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Detailed evidence table
    story.append(Paragraph("Detailed Evidence", styles['Heading2']))
    data = [['Requirement', 'Evidence Count', 'Status', 'Last Activity']]
    
    for req_code, req_evidence in evidence.items():
        count = req_evidence.get('count', 0)
        status = 'Compliant' if count > 0 else 'Pending'
        latest = req_evidence.get('latest_activity', 'No activity')
        
        if latest and latest != 'No activity':
            try:
                latest = datetime.fromisoformat(latest.replace('Z', '+00:00')).strftime('%m/%d/%Y')
            except:
                pass
                
        data.append([req_code, str(count), status, latest])
    
    table = Table(data, colWidths=[2*inch, 1*inch, 1*inch, 1.5*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    
    story.append(table)
    doc.build(story)
    buffer.seek(0)
    return buffer
