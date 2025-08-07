#!/usr/bin/env python3
"""
Edge Case ML Batch Analysis
Only applies ML analysis to samples identified as edge cases by the rule-based classifier.
"""

from curve_classification import should_apply_ml_analysis, get_edge_case_summary
import json

def filter_edge_cases_for_ml(analysis_results):
    """
    Filter analysis results to identify only edge cases that need ML analysis.
    
    Args:
        analysis_results: Dict with individual_results from qPCR analysis
    
    Returns:
        Dict with:
        - edge_cases: Dict of wells that need ML analysis
        - confident_cases: Dict of wells that don't need ML
        - summary: Statistics about filtering
    """
    
    if not analysis_results or 'individual_results' not in analysis_results:
        return {
            'edge_cases': {},
            'confident_cases': {},
            'summary': {'total': 0, 'edge_cases': 0, 'confident_cases': 0, 'error': 'No analysis results'}
        }
    
    edge_cases = {}
    confident_cases = {}
    
    individual_results = analysis_results['individual_results']
    
    for well_id, well_data in individual_results.items():
        if not well_data or 'curve_classification' not in well_data:
            continue
            
        classification_result = well_data['curve_classification']
        
        if should_apply_ml_analysis(classification_result):
            # This is an edge case - needs ML analysis
            edge_cases[well_id] = well_data
            edge_case_summary = get_edge_case_summary(classification_result)
            well_data['ml_reason'] = edge_case_summary
            print(f"[ML-EDGE] {well_id}: {classification_result.get('classification')} - {edge_case_summary}")
        else:
            # This is confident - skip ML analysis
            confident_cases[well_id] = well_data
            classification = classification_result.get('classification', 'Unknown')
            confidence = classification_result.get('confidence', 0)
            print(f"[ML-SKIP] {well_id}: {classification} (confidence: {confidence:.2f}) - No ML needed")
    
    summary = {
        'total': len(individual_results),
        'edge_cases': len(edge_cases),
        'confident_cases': len(confident_cases),
        'edge_case_percentage': (len(edge_cases) / len(individual_results) * 100) if individual_results else 0
    }
    
    print(f"\n[ML-SUMMARY] Edge case filtering complete:")
    print(f"  Total samples: {summary['total']}")
    print(f"  Edge cases needing ML: {summary['edge_cases']} ({summary['edge_case_percentage']:.1f}%)")
    print(f"  Confident cases (skip ML): {summary['confident_cases']}")
    
    return {
        'edge_cases': edge_cases,
        'confident_cases': confident_cases,
        'summary': summary
    }


def apply_ml_to_edge_cases_only(analysis_results, ml_classifier=None):
    """
    Apply ML analysis only to edge cases identified by rule-based classification.
    
    Args:
        analysis_results: Results from qPCR analysis
        ml_classifier: ML classifier instance (optional)
    
    Returns:
        Updated analysis results with ML applied only to edge cases
    """
    
    print("\n" + "="*60)
    print("EDGE CASE ML BATCH ANALYSIS")
    print("="*60)
    
    # Filter to identify edge cases
    filtering_results = filter_edge_cases_for_ml(analysis_results)
    
    edge_cases = filtering_results['edge_cases']
    confident_cases = filtering_results['confident_cases']
    summary = filtering_results['summary']
    
    if not edge_cases:
        print("✅ No edge cases found - all samples have confident classifications!")
        return analysis_results
    
    print(f"\n🤖 Applying ML analysis to {len(edge_cases)} edge cases...")
    
    # Apply ML to edge cases only
    ml_processed = 0
    ml_improved = 0
    
    for well_id, well_data in edge_cases.items():
        try:
            if ml_classifier:
                # Get original rule-based classification
                original_classification = well_data['curve_classification']['classification']
                original_confidence = well_data['curve_classification']['confidence']
                
                # Apply ML classification
                # Extract curve data for ML
                cycles = well_data.get('raw_cycles', [])
                rfu = well_data.get('raw_rfu', [])
                metrics = well_data.copy()
                
                if cycles and rfu:
                    ml_result = ml_classifier.predict_classification(
                        rfu, cycles, metrics, pathogen=None, well_id=well_id
                    )
                    
                    # Update classification if ML provides improvement
                    ml_confidence = ml_result.get('confidence', 0)
                    if ml_confidence > original_confidence + 0.1:  # ML must be significantly better
                        well_data['curve_classification'] = ml_result
                        well_data['curve_classification']['method'] = 'ML (edge case)'
                        well_data['curve_classification']['original_rule_based'] = {
                            'classification': original_classification,
                            'confidence': original_confidence
                        }
                        ml_improved += 1
                        print(f"[ML-IMPROVED] {well_id}: {original_classification} → {ml_result['classification']} (confidence: {original_confidence:.2f} → {ml_confidence:.2f})")
                    else:
                        print(f"[ML-KEPT] {well_id}: {original_classification} (ML didn't improve confidence)")
                
                ml_processed += 1
                
            else:
                print(f"[ML-UNAVAILABLE] {well_id}: No ML classifier available")
                
        except Exception as e:
            print(f"[ML-ERROR] {well_id}: {e}")
            continue
    
    # Update analysis results
    updated_results = analysis_results.copy()
    
    # Merge confident cases (unchanged) with edge cases (potentially ML-updated)
    all_results = {}
    all_results.update(confident_cases)
    all_results.update(edge_cases)
    
    updated_results['individual_results'] = all_results
    
    # Add ML processing summary
    updated_results['ml_edge_case_summary'] = {
        'total_samples': summary['total'],
        'edge_cases_identified': len(edge_cases),
        'confident_cases_skipped': len(confident_cases),
        'ml_processed': ml_processed,
        'ml_improved': ml_improved,
        'efficiency_gain': f"{len(confident_cases)}/{summary['total']} samples skipped ML processing"
    }
    
    print(f"\n📊 ML Edge Case Analysis Complete:")
    print(f"  Edge cases processed: {ml_processed}")
    print(f"  Classifications improved: {ml_improved}")
    print(f"  Confident cases skipped: {len(confident_cases)}")
    print(f"  Processing efficiency: {len(confident_cases)}/{summary['total']} samples saved ML computation")
    
    return updated_results


def test_edge_case_filtering():
    """
    Test the edge case filtering with sample data.
    """
    
    print("Testing Edge Case ML Filtering...")
    
    # Sample analysis results with different classification types
    test_results = {
        'individual_results': {
            'A1': {
                'curve_classification': {
                    'classification': 'STRONG_POSITIVE',
                    'confidence': 0.95,
                    'edge_case': False
                }
            },
            'A2': {
                'curve_classification': {
                    'classification': 'WEAK_POSITIVE',
                    'confidence': 0.60,
                    'edge_case': True,
                    'edge_case_reasons': ['intermediate_amplitude', 'moderate_steepness']
                }
            },
            'A3': {
                'curve_classification': {
                    'classification': 'INDETERMINATE',
                    'confidence': 0.50,
                    'edge_case': True,
                    'edge_case_reasons': ['good_curve_no_cqj']
                }
            },
            'A4': {
                'curve_classification': {
                    'classification': 'NEGATIVE',
                    'confidence': 0.90,
                    'edge_case': False
                }
            },
            'A5': {
                'curve_classification': {
                    'classification': 'POSITIVE',
                    'confidence': 0.70,  # Low confidence
                    'edge_case': False
                }
            }
        }
    }
    
    results = filter_edge_cases_for_ml(test_results)
    
    print(f"\nTest Results:")
    print(f"  Edge cases: {list(results['edge_cases'].keys())}")  # Should be A2, A3, A5
    print(f"  Confident cases: {list(results['confident_cases'].keys())}")  # Should be A1, A4
    print(f"  Summary: {results['summary']}")


if __name__ == "__main__":
    test_edge_case_filtering()
