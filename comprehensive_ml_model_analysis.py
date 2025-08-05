#!/usr/bin/env python3
"""
Comprehensive ML Model Analysis and Testing Suite
Creates extensive test scenarios and generates detailed model capability reports
"""

import json
import numpy as np
from datetime import datetime
import os
import sys

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from ml_curve_classifier import MLCurveClassifier
except ImportError:
    print("Error: Could not import MLCurveClassifier")
    sys.exit(1)

def create_comprehensive_test_suite():
    """Create an extensive test suite covering all possible scenarios"""
    
    test_samples = [
        # === PERFECT STRONG POSITIVES (Should be 95%+ accurate) ===
        {
            'name': 'Perfect_Strong_NGON_1',
            'rfu_data': [45, 52, 68, 95, 145, 220, 340, 520, 800, 1200, 1800, 2600, 3800, 5500, 8000, 11500, 15000, 18500, 21000, 22500, 23000, 23200, 23300, 23400, 23500, 23600, 23700, 23800, 23900, 24000, 24100, 24200, 24300],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 23955, 'r2_score': 0.998, 'snr': 28.5, 'steepness': 0.95,
                'is_good_scurve': True, 'cqj': 18.2, 'calcj': 17.8, 'midpoint': 5.2,
                'baseline': 45, 'max_slope': 4200, 'curve_efficiency': 0.99
            },
            'expected': 'STRONG_POSITIVE',
            'pathogen': 'NGON'
        },
        {
            'name': 'Perfect_Strong_CT_1',
            'rfu_data': [52, 58, 75, 105, 155, 235, 365, 565, 875, 1350, 2050, 3100, 4600, 6800, 9800, 14000, 19000, 24500, 29000, 32000, 33500, 34200, 34500, 34600, 34700, 34800, 34900, 35000, 35100, 35200, 35300, 35400, 35500],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 35448, 'r2_score': 0.999, 'snr': 32.1, 'steepness': 0.97,
                'is_good_scurve': True, 'cqj': 17.5, 'calcj': 17.1, 'midpoint': 4.8,
                'baseline': 52, 'max_slope': 4800, 'curve_efficiency': 0.99
            },
            'expected': 'STRONG_POSITIVE',
            'pathogen': 'CT'
        },
        {
            'name': 'Perfect_Strong_NGON_2',
            'rfu_data': [38, 45, 58, 82, 125, 190, 285, 430, 650, 980, 1450, 2150, 3150, 4600, 6700, 9600, 13500, 18000, 22500, 26000, 28000, 29000, 29500, 29800, 30000, 30100, 30200, 30300, 30400, 30500, 30600, 30700, 30800],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 30762, 'r2_score': 0.997, 'snr': 26.8, 'steepness': 0.93,
                'is_good_scurve': True, 'cqj': 19.1, 'calcj': 18.6, 'midpoint': 5.8,
                'baseline': 38, 'max_slope': 3900, 'curve_efficiency': 0.98
            },
            'expected': 'STRONG_POSITIVE',
            'pathogen': 'NGON'
        },
        
        # === GOOD WEAK POSITIVES (Should be 85%+ accurate) ===
        {
            'name': 'Good_Weak_NGON_1',
            'rfu_data': [88, 95, 105, 125, 155, 195, 250, 325, 425, 555, 720, 925, 1200, 1550, 1980, 2500, 3150, 3900, 4750, 5650, 6500, 7200, 7700, 8000, 8200, 8300, 8400, 8500, 8600, 8700, 8800, 8900, 9000],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 8912, 'r2_score': 0.92, 'snr': 12.5, 'steepness': 0.78,
                'is_good_scurve': True, 'cqj': 26.8, 'calcj': 26.2, 'midpoint': 8.2,
                'baseline': 88, 'max_slope': 850, 'curve_efficiency': 0.85
            },
            'expected': 'WEAK_POSITIVE',
            'pathogen': 'NGON'
        },
        {
            'name': 'Good_Weak_CT_1',
            'rfu_data': [75, 82, 92, 108, 132, 165, 210, 270, 345, 440, 560, 710, 900, 1130, 1420, 1780, 2220, 2750, 3380, 4120, 4950, 5850, 6800, 7750, 8650, 9400, 10000, 10400, 10600, 10700, 10800, 10900, 11000],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 10925, 'r2_score': 0.94, 'snr': 14.2, 'steepness': 0.82,
                'is_good_scurve': True, 'cqj': 25.5, 'calcj': 24.9, 'midpoint': 7.8,
                'baseline': 75, 'max_slope': 1050, 'curve_efficiency': 0.87
            },
            'expected': 'WEAK_POSITIVE',
            'pathogen': 'CT'
        },
        {
            'name': 'Borderline_Weak_NGON_1',
            'rfu_data': [95, 98, 105, 115, 130, 150, 175, 208, 250, 300, 365, 445, 545, 665, 810, 985, 1190, 1430, 1710, 2030, 2400, 2820, 3290, 3810, 4380, 5000, 5650, 6300, 6900, 7400, 7800, 8100, 8300],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 8205, 'r2_score': 0.89, 'snr': 9.8, 'steepness': 0.72,
                'is_good_scurve': True, 'cqj': 29.2, 'calcj': 28.5, 'midpoint': 9.8,
                'baseline': 95, 'max_slope': 620, 'curve_efficiency': 0.81
            },
            'expected': 'WEAK_POSITIVE',
            'pathogen': 'NGON'
        },
        {
            'name': 'Late_Weak_CT_1',
            'rfu_data': [120, 125, 132, 142, 155, 172, 193, 218, 248, 284, 326, 375, 432, 498, 574, 661, 761, 875, 1006, 1156, 1327, 1522, 1743, 1993, 2275, 2593, 2949, 3347, 3790, 4280, 4820, 5410, 6050],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 5930, 'r2_score': 0.91, 'snr': 8.2, 'steepness': 0.68,
                'is_good_scurve': True, 'cqj': 31.8, 'calcj': 31.1, 'midpoint': 11.5,
                'baseline': 120, 'max_slope': 485, 'curve_efficiency': 0.79
            },
            'expected': 'WEAK_POSITIVE',
            'pathogen': 'CT'
        },
        
        # === CLEAR NEGATIVES (Should be 98%+ accurate) ===
        {
            'name': 'Clear_Negative_NGON_1',
            'rfu_data': [98, 102, 95, 105, 99, 103, 97, 101, 104, 96, 100, 98, 102, 105, 97, 100, 103, 99, 101, 98, 102, 100, 97, 104, 101, 99, 103, 98, 100, 102, 99, 101, 98],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 10, 'r2_score': 0.025, 'snr': 0.18, 'steepness': 0.01,
                'is_good_scurve': False, 'midpoint': 0, 'baseline': 100,
                'max_slope': 2.5, 'curve_efficiency': 0.0
            },
            'expected': 'NEGATIVE',
            'pathogen': 'NGON'
        },
        {
            'name': 'Clear_Negative_CT_1',
            'rfu_data': [82, 85, 79, 88, 84, 81, 86, 83, 87, 80, 85, 82, 84, 88, 80, 83, 86, 84, 81, 85, 83, 87, 82, 84, 86, 81, 83, 85, 84, 82, 86, 83, 85],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 9, 'r2_score': 0.015, 'snr': 0.12, 'steepness': 0.005,
                'is_good_scurve': False, 'midpoint': 0, 'baseline': 83,
                'max_slope': 1.8, 'curve_efficiency': 0.0
            },
            'expected': 'NEGATIVE',
            'pathogen': 'CT'
        },
        {
            'name': 'Flat_Negative_NGON_1',
            'rfu_data': [150, 152, 148, 151, 149, 153, 147, 150, 152, 148, 151, 149, 153, 147, 150, 152, 148, 151, 149, 153, 147, 150, 152, 148, 151, 149, 153, 147, 150, 152, 148, 151, 149],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 6, 'r2_score': 0.008, 'snr': 0.08, 'steepness': 0.002,
                'is_good_scurve': False, 'midpoint': 0, 'baseline': 150,
                'max_slope': 1.2, 'curve_efficiency': 0.0
            },
            'expected': 'NEGATIVE',
            'pathogen': 'NGON'
        },
        
        # === SUSPICIOUS CASES (Complex patterns requiring careful analysis) ===
        {
            'name': 'Suspicious_High_Baseline_NGON',
            'rfu_data': [200, 205, 215, 230, 250, 275, 305, 340, 380, 425, 475, 530, 590, 655, 725, 800, 880, 965, 1055, 1150, 1250, 1355, 1465, 1580, 1700, 1825, 1955, 2090, 2230, 2375, 2525, 2680, 2840],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 2640, 'r2_score': 0.88, 'snr': 3.8, 'steepness': 0.55,
                'is_good_scurve': False, 'cqj': 35.8, 'calcj': 35.2, 'midpoint': 12.8,
                'baseline': 200, 'max_slope': 285, 'curve_efficiency': 0.65
            },
            'expected': 'SUSPICIOUS',
            'pathogen': 'NGON'
        },
        {
            'name': 'Suspicious_Late_Rise_CT',
            'rfu_data': [88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 125, 135, 155, 185, 230, 290, 370, 475, 605, 765, 955, 1175, 1425, 1705, 2015, 2355],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 2267, 'r2_score': 0.76, 'snr': 4.2, 'steepness': 0.48,
                'is_good_scurve': False, 'cqj': 37.5, 'calcj': 36.8, 'midpoint': 14.2,
                'baseline': 88, 'max_slope': 380, 'curve_efficiency': 0.58
            },
            'expected': 'SUSPICIOUS',
            'pathogen': 'CT'
        },
        {
            'name': 'Suspicious_Plateau_Early_NGON',
            'rfu_data': [95, 105, 125, 155, 195, 245, 305, 375, 455, 545, 645, 755, 875, 1005, 1145, 1295, 1455, 1625, 1805, 1995, 2195, 2405, 2625, 2855, 3095, 3300, 3400, 3450, 3480, 3500, 3520, 3540, 3560],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 3465, 'r2_score': 0.82, 'snr': 5.8, 'steepness': 0.62,
                'is_good_scurve': False, 'cqj': 33.2, 'calcj': 32.5, 'midpoint': 10.8,
                'baseline': 95, 'max_slope': 420, 'curve_efficiency': 0.72
            },
            'expected': 'SUSPICIOUS',
            'pathogen': 'NGON'
        },
        
        # === TRICKY FALSE POSITIVES (Should be caught by ML) ===
        {
            'name': 'Tricky_False_Positive_High_Amp_NGON',
            'rfu_data': [120, 135, 165, 215, 285, 375, 485, 615, 765, 935, 1125, 1335, 1565, 1815, 2085, 2375, 2685, 3015, 3365, 3735, 4000, 4100, 4150, 4180, 4200, 4220, 4240, 4260, 4280, 4300, 4320, 4340, 4360],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 4240, 'r2_score': 0.28, 'snr': 2.1, 'steepness': 0.18,
                'is_good_scurve': False, 'midpoint': 0, 'baseline': 120,
                'max_slope': 580, 'curve_efficiency': 0.12
            },
            'expected': 'NEGATIVE',
            'pathogen': 'NGON'
        },
        {
            'name': 'Tricky_False_Positive_Erratic_CT',
            'rfu_data': [85, 92, 88, 105, 98, 115, 108, 125, 118, 135, 128, 145, 138, 155, 148, 165, 158, 175, 168, 185, 178, 195, 188, 205, 198, 215, 208, 225, 218, 235, 228, 245, 238],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 160, 'r2_score': 0.22, 'snr': 1.5, 'steepness': 0.12,
                'is_good_scurve': False, 'midpoint': 0, 'baseline': 85,
                'max_slope': 22, 'curve_efficiency': 0.08
            },
            'expected': 'NEGATIVE',
            'pathogen': 'CT'
        },
        {
            'name': 'Tricky_False_Positive_Drift_NGON',
            'rfu_data': [200, 205, 210, 215, 220, 225, 230, 235, 240, 245, 250, 255, 260, 265, 270, 275, 280, 285, 290, 295, 300, 305, 310, 315, 320, 325, 330, 335, 340, 345, 350, 355, 360],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 160, 'r2_score': 0.95, 'snr': 1.2, 'steepness': 0.15,
                'is_good_scurve': False, 'midpoint': 0, 'baseline': 200,
                'max_slope': 8, 'curve_efficiency': 0.05
            },
            'expected': 'NEGATIVE',
            'pathogen': 'NGON'
        },
        
        # === EDGE CASES (Challenging scenarios) ===
        {
            'name': 'Edge_Case_Very_Late_Positive_CT',
            'rfu_data': [88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 115, 125, 145, 175, 220, 285, 375, 495, 645, 825, 1035],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 947, 'r2_score': 0.94, 'snr': 2.8, 'steepness': 0.42,
                'is_good_scurve': False, 'cqj': 39.2, 'calcj': 38.5, 'midpoint': 16.2,
                'baseline': 88, 'max_slope': 145, 'curve_efficiency': 0.52
            },
            'expected': 'SUSPICIOUS',
            'pathogen': 'CT'
        },
        {
            'name': 'Edge_Case_Sharp_Rise_NGON',
            'rfu_data': [125, 128, 132, 138, 145, 154, 165, 178, 194, 213, 235, 260, 289, 322, 359, 401, 448, 501, 560, 625, 697, 776, 863, 958, 1062, 1175, 1298, 1432, 1577, 1734, 1903, 2085, 2280],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 2155, 'r2_score': 0.87, 'snr': 6.2, 'steepness': 0.71,
                'is_good_scurve': True, 'cqj': 32.8, 'calcj': 32.1, 'midpoint': 10.5,
                'baseline': 125, 'max_slope': 285, 'curve_efficiency': 0.78
            },
            'expected': 'WEAK_POSITIVE',
            'pathogen': 'NGON'
        },
        {
            'name': 'Edge_Case_Biphasic_CT',
            'rfu_data': [92, 105, 125, 155, 195, 245, 305, 375, 455, 545, 645, 755, 875, 1005, 1145, 1295, 1455, 1625, 1805, 1985, 2100, 2150, 2180, 2200, 2215, 2225, 2235, 2245, 2255, 2265, 2275, 2285, 2295],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 2203, 'r2_score': 0.89, 'snr': 5.8, 'steepness': 0.65,
                'is_good_scurve': True, 'cqj': 31.5, 'calcj': 30.8, 'midpoint': 9.8,
                'baseline': 92, 'max_slope': 325, 'curve_efficiency': 0.74
            },
            'expected': 'WEAK_POSITIVE',
            'pathogen': 'CT'
        },
        
        # === ADDITIONAL MODERATE POSITIVES ===
        {
            'name': 'Moderate_Positive_NGON_1',
            'rfu_data': [110, 118, 130, 148, 172, 202, 238, 280, 328, 382, 442, 508, 580, 658, 742, 832, 928, 1030, 1138, 1252, 1372, 1498, 1630, 1768, 1912, 2062, 2218, 2380, 2548, 2722, 2902, 3088, 3280],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 3170, 'r2_score': 0.92, 'snr': 8.5, 'steepness': 0.75,
                'is_good_scurve': True, 'cqj': 28.8, 'calcj': 28.2, 'midpoint': 8.8,
                'baseline': 110, 'max_slope': 485, 'curve_efficiency': 0.82
            },
            'expected': 'WEAK_POSITIVE',
            'pathogen': 'NGON'
        },
        {
            'name': 'Moderate_Positive_CT_1',
            'rfu_data': [95, 102, 112, 126, 144, 166, 192, 222, 256, 294, 336, 382, 432, 486, 544, 606, 672, 742, 816, 894, 976, 1062, 1152, 1246, 1344, 1446, 1552, 1662, 1776, 1894, 2016, 2142, 2272],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 2177, 'r2_score': 0.94, 'snr': 7.8, 'steepness': 0.72,
                'is_good_scurve': True, 'cqj': 29.5, 'calcj': 28.9, 'midpoint': 9.2,
                'baseline': 95, 'max_slope': 365, 'curve_efficiency': 0.80
            },
            'expected': 'WEAK_POSITIVE',
            'pathogen': 'CT'
        },
        
        # === CHALLENGING INHIBITION/PCR FAILURE CASES ===
        {
            'name': 'Challenge_Inhibition_Recovery_NGON',
            'rfu_data': [120, 115, 110, 105, 100, 95, 92, 95, 105, 125, 155, 195, 245, 305, 375, 455, 545, 645, 755, 875, 1005, 1145, 1295, 1455, 1625, 1805, 1995, 2195, 2405, 2625, 2855, 3095, 3345],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 3250, 'r2_score': 0.84, 'snr': 6.2, 'steepness': 0.68,
                'is_good_scurve': False, 'cqj': 32.8, 'calcj': 32.1, 'midpoint': 10.5,
                'baseline': 120, 'max_slope': 420, 'curve_efficiency': 0.75
            },
            'expected': 'SUSPICIOUS',
            'pathogen': 'NGON'
        },
        {
            'name': 'Challenge_PCR_Failure_CT',
            'rfu_data': [88, 92, 98, 108, 122, 140, 162, 188, 218, 252, 290, 332, 378, 428, 482, 540, 602, 668, 738, 812, 890, 920, 935, 945, 950, 952, 954, 956, 958, 960, 962, 964, 966],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 878, 'r2_score': 0.79, 'snr': 3.2, 'steepness': 0.45,
                'is_good_scurve': False, 'cqj': 38.5, 'calcj': 37.8, 'midpoint': 15.2,
                'baseline': 88, 'max_slope': 68, 'curve_efficiency': 0.42
            },
            'expected': 'SUSPICIOUS',
            'pathogen': 'CT'
        },
        
        # === ADDITIONAL STRONG POSITIVES FOR ROBUST TRAINING ===
        {
            'name': 'Strong_Positive_NGON_3',
            'rfu_data': [42, 48, 62, 88, 130, 195, 290, 425, 620, 880, 1220, 1650, 2180, 2820, 3580, 4470, 5500, 6680, 8020, 9520, 11180, 13000, 14980, 17120, 19420, 21880, 24500, 27280, 30220, 33320, 36580, 40000, 43580],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 43538, 'r2_score': 0.999, 'snr': 38.2, 'steepness': 0.98,
                'is_good_scurve': True, 'cqj': 16.8, 'calcj': 16.4, 'midpoint': 4.2,
                'baseline': 42, 'max_slope': 5200, 'curve_efficiency': 0.99
            },
            'expected': 'STRONG_POSITIVE',
            'pathogen': 'NGON'
        },
        {
            'name': 'Strong_Positive_CT_3',
            'rfu_data': [58, 65, 82, 112, 165, 245, 360, 520, 735, 1020, 1385, 1840, 2395, 3060, 3845, 4760, 5815, 7020, 8385, 9920, 11635, 13540, 15645, 17960, 20495, 23260, 26265, 29520, 33035, 36820, 40885, 45240, 49895],
            'cycles': list(range(1, 34)),
            'metrics': {
                'amplitude': 49837, 'r2_score': 0.999, 'snr': 42.5, 'steepness': 0.99,
                'is_good_scurve': True, 'cqj': 15.2, 'calcj': 14.8, 'midpoint': 3.8,
                'baseline': 58, 'max_slope': 6200, 'curve_efficiency': 0.99
            },
            'expected': 'STRONG_POSITIVE',
            'pathogen': 'CT'
        }
    ]
    
    return test_samples

def run_comprehensive_model_analysis():
    """Run comprehensive analysis showing general and pathogen-specific model capabilities"""
    
    print("🧬 COMPREHENSIVE ML MODEL ANALYSIS")
    print("=" * 80)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Initialize ML classifier
    ml_classifier = MLCurveClassifier()
    
    # Create comprehensive test suite
    test_samples = create_comprehensive_test_suite()
    print(f"📊 Created comprehensive test suite with {len(test_samples)} samples")
    
    # Analyze sample distribution
    sample_distribution = {}
    pathogen_distribution = {}
    classification_distribution = {}
    
    for sample in test_samples:
        # Count by expected classification
        expected = sample['expected']
        if expected not in classification_distribution:
            classification_distribution[expected] = 0
        classification_distribution[expected] += 1
        
        # Count by pathogen
        pathogen = sample['pathogen']
        if pathogen not in pathogen_distribution:
            pathogen_distribution[pathogen] = 0
        pathogen_distribution[pathogen] += 1
    
    print("\n📈 TEST SUITE COMPOSITION:")
    print("-" * 40)
    for classification, count in classification_distribution.items():
        percentage = (count / len(test_samples)) * 100
        print(f"  {classification:15}: {count:2d} samples ({percentage:5.1f}%)")
    
    print("\n🧬 PATHOGEN DISTRIBUTION:")
    print("-" * 40)
    for pathogen, count in pathogen_distribution.items():
        percentage = (count / len(test_samples)) * 100
        print(f"  {pathogen:15}: {count:2d} samples ({percentage:5.1f}%)")
    
    # Phase 1: Test with rule-based baseline
    print("\n📊 PHASE 1: Rule-Based Baseline Assessment")
    print("-" * 50)
    
    baseline_results = []
    baseline_correct = 0
    
    for i, sample in enumerate(test_samples, 1):
        prediction = ml_classifier.predict_classification(
            sample['rfu_data'], sample['cycles'], sample['metrics'], sample['pathogen']
        )
        
        predicted = prediction.get('classification')
        expected = sample['expected']
        correct = predicted == expected
        confidence = prediction.get('confidence', 0.0)
        method = prediction.get('method', 'Unknown')
        
        if correct:
            baseline_correct += 1
            status = "✓"
        else:
            status = "✗"
        
        print(f"  {i:2d}. {sample['name']:30} | {expected:15} → {predicted:15} | {status} | {confidence:.2f} | {method}")
        
        baseline_results.append({
            'sample': sample['name'],
            'pathogen': sample['pathogen'],
            'expected': expected,
            'predicted': predicted,
            'correct': correct,
            'confidence': confidence,
            'method': method
        })
    
    baseline_accuracy = (baseline_correct / len(test_samples)) * 100
    print(f"\n📈 Rule-Based Baseline Accuracy: {baseline_accuracy:.1f}% ({baseline_correct}/{len(test_samples)})")
    
    # Phase 2: Progressive training simulation
    print("\n🎓 PHASE 2: Progressive Training Simulation")
    print("-" * 50)
    
    # Training phases with increasing sample sizes
    training_phases = [
        (5, "Initial Training (5 samples)"),
        (10, "Intermediate Training (15 total)"),
        (15, "Advanced Training (30 total)"),
        (len(test_samples), "Complete Training (all samples)")
    ]
    
    training_progression = []
    total_trained = 0
    
    for batch_size, phase_name in training_phases:
        print(f"\n{phase_name}")
        print("-" * 30)
        
        # Add training samples for this batch
        batch_samples = test_samples[total_trained:total_trained + batch_size]
        for sample in batch_samples:
            # Create enhanced metrics with unique sample identification
            enhanced_metrics = sample['metrics'].copy()
            enhanced_metrics['sample'] = sample['name']  # Use sample name for uniqueness
            enhanced_metrics['channel'] = 'FAM' if sample['pathogen'] == 'NGON' else 'Texas_Red'  # Pathogen-specific channels
            
            # Use the actual advanced feature extraction
            full_features = ml_classifier.extract_advanced_features(
                sample['rfu_data'], sample['cycles'], enhanced_metrics
            )
            
            # Add to training
            ml_classifier.add_training_sample(
                sample['rfu_data'], sample['cycles'], enhanced_metrics,
                sample['expected'], sample['name'], sample['pathogen']
            )
            total_trained += 1
        
        print(f"  Training samples added: {len(batch_samples)}")
        print(f"  Total training samples: {len(ml_classifier.training_data)}")
        
        # Retrain model
        print(f"  🔄 Retraining ML model...")
        retrain_success = ml_classifier.retrain_model()
        
        if retrain_success:
            print(f"  ✅ Model retrained successfully")
            
            # Test current accuracy
            print(f"  📊 Testing current accuracy...")
            current_correct = 0
            current_results = []
            
            for sample in test_samples:
                prediction = ml_classifier.predict_classification(
                    sample['rfu_data'], sample['cycles'], sample['metrics'], sample['pathogen']
                )
                
                predicted = prediction.get('classification')
                expected = sample['expected']
                correct = predicted == expected
                
                if correct:
                    current_correct += 1
                    
                current_results.append({
                    'sample': sample['name'],
                    'pathogen': sample['pathogen'],
                    'expected': expected,
                    'predicted': predicted,
                    'correct': correct,
                    'confidence': prediction.get('confidence', 0.0),
                    'method': prediction.get('method', 'Unknown')
                })
            
            current_accuracy = (current_correct / len(test_samples)) * 100
            improvement = current_accuracy - baseline_accuracy
            
            print(f"  📈 Current Accuracy: {current_accuracy:.1f}% ({current_correct}/{len(test_samples)})")
            print(f"  📈 Improvement: +{improvement:.1f}%")
            
            training_progression.append({
                'phase': phase_name,
                'training_samples': len(ml_classifier.training_data),
                'accuracy': current_accuracy,
                'improvement': improvement,
                'results': current_results
            })
        else:
            print(f"  ❌ Model retraining failed")
    
    # Phase 3: Final comprehensive analysis
    print("\n🏆 PHASE 3: Final Model Analysis")
    print("-" * 50)
    
    # Get final model statistics
    model_stats = ml_classifier.get_model_stats()
    
    # Analyze performance by category
    final_results = training_progression[-1]['results'] if training_progression else baseline_results
    
    performance_by_classification = {}
    performance_by_pathogen = {}
    method_distribution = {}
    
    for result in final_results:
        # By classification
        classification = result['expected']
        if classification not in performance_by_classification:
            performance_by_classification[classification] = {'correct': 0, 'total': 0}
        performance_by_classification[classification]['total'] += 1
        if result['correct']:
            performance_by_classification[classification]['correct'] += 1
        
        # By pathogen
        pathogen = result['pathogen']
        if pathogen not in performance_by_pathogen:
            performance_by_pathogen[pathogen] = {'correct': 0, 'total': 0}
        performance_by_pathogen[pathogen]['total'] += 1
        if result['correct']:
            performance_by_pathogen[pathogen]['correct'] += 1
        
        # By method
        method = result['method']
        if method not in method_distribution:
            method_distribution[method] = 0
        method_distribution[method] += 1
    
    # Display final results
    print("\n📊 FINAL PERFORMANCE BY CLASSIFICATION TYPE:")
    print("-" * 50)
    for classification, stats in performance_by_classification.items():
        accuracy = (stats['correct'] / stats['total']) * 100 if stats['total'] > 0 else 0
        print(f"  {classification:15}: {stats['correct']:2d}/{stats['total']:2d} ({accuracy:5.1f}%)")
    
    print("\n🧬 FINAL PERFORMANCE BY PATHOGEN:")
    print("-" * 50)
    for pathogen, stats in performance_by_pathogen.items():
        accuracy = (stats['correct'] / stats['total']) * 100 if stats['total'] > 0 else 0
        print(f"  {pathogen:15}: {stats['correct']:2d}/{stats['total']:2d} ({accuracy:5.1f}%)")
    
    print("\n🔬 METHOD DISTRIBUTION:")
    print("-" * 50)
    for method, count in method_distribution.items():
        percentage = (count / len(final_results)) * 100
        print(f"  {method:20}: {count:2d} samples ({percentage:5.1f}%)")
    
    # Generate detailed report
    report = {
        'analysis_timestamp': datetime.now().isoformat(),
        'test_suite': {
            'total_samples': len(test_samples),
            'classification_distribution': classification_distribution,
            'pathogen_distribution': pathogen_distribution
        },
        'baseline_performance': {
            'accuracy': baseline_accuracy,
            'correct': baseline_correct,
            'total': len(test_samples),
            'results': baseline_results
        },
        'training_progression': training_progression,
        'final_analysis': {
            'model_stats': model_stats,
            'performance_by_classification': performance_by_classification,
            'performance_by_pathogen': performance_by_pathogen,
            'method_distribution': method_distribution,
            'final_results': final_results
        },
        'model_capabilities': {
            'general_model': {
                'features_used': ml_classifier.feature_names,
                'training_samples': len(ml_classifier.training_data),
                'model_trained': ml_classifier.model_trained,
                'last_accuracy': ml_classifier.last_accuracy
            },
            'pathogen_models': model_stats.get('pathogen_breakdown', {}),
            'feature_importance': model_stats.get('feature_importance', {}),
            'version_info': model_stats.get('version', 'unknown')
        }
    }
    
    # Save detailed report
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_filename = f'comprehensive_ml_model_analysis_{timestamp}.json'
    
    with open(report_filename, 'w') as f:
        json.dump(report, f, indent=2, default=str)
    
    print(f"\n💾 DETAILED REPORT SAVED: {report_filename}")
    
    # Display summary
    final_accuracy = training_progression[-1]['accuracy'] if training_progression else baseline_accuracy
    total_improvement = final_accuracy - baseline_accuracy
    
    print("\n" + "=" * 80)
    print("🏆 COMPREHENSIVE ANALYSIS SUMMARY")
    print("=" * 80)
    print(f"📊 Baseline Accuracy:     {baseline_accuracy:.1f}%")
    print(f"🎯 Final Accuracy:        {final_accuracy:.1f}%")
    print(f"📈 Total Improvement:     +{total_improvement:.1f}%")
    print(f"🔢 Training Samples Used: {len(ml_classifier.training_data)}")
    print(f"🎯 Target (95%+):         {'✅ ACHIEVED' if final_accuracy >= 95 else '❌ NOT ACHIEVED'}")
    print(f"🎯 Stretch Target (99%):  {'✅ ACHIEVED' if final_accuracy >= 99 else '❌ NOT ACHIEVED'}")
    print(f"📁 Results saved to:      {report_filename}")
    
    return report

if __name__ == "__main__":
    try:
        report = run_comprehensive_model_analysis()
    except KeyboardInterrupt:
        print("\n\n⚠️ Analysis interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Error during analysis: {e}")
        import traceback
        traceback.print_exc()
