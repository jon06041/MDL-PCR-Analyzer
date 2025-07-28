#!/usr/bin/env python3
"""Test script to verify enhanced ML feature extraction with 30 metrics (12 visual + 18 computational)"""

print("Testing enhanced ML feature extraction...")

try:
    # Import the ML classifier
    from ml_curve_classifier import MLCurveClassifier
    print("✅ MLCurveClassifier imported successfully")

    # Create classifier instance
    classifier = MLCurveClassifier()
    print("✅ Classifier instance created")

    # Create test data that represents a typical qPCR curve
    test_data = {
        'rfu_data': [50, 52, 55, 58, 62, 68, 78, 95, 125, 180, 280, 450, 700, 950, 1200, 1400, 1500, 1550, 1580, 1590],
        'cycles': list(range(1, 21)),
        'r2': 0.95,
        'rmse': 25.5,
        'amplitude': 1540,
        'steepness': 0.85,
        'midpoint': 12.5,
        'snr': 31.8,
        'baseline': 50,
        'cqj': 11.2,
        'calcj': 750
    }

    # Extract features using the correct method name
    features = classifier.extract_advanced_features(
        rfu_data=test_data['rfu_data'],
        cycles=test_data['cycles'],
        existing_metrics=test_data
    )
    print(f"✅ Feature extraction completed")

    # Count different types of features
    visual_features = [k for k in features.keys() if k.startswith('visual_')]
    computational_features = [k for k in features.keys() if not k.startswith('visual_')]

    print(f"\n📊 FEATURE ANALYSIS:")
    print(f"   Total features: {len(features)}")
    print(f"   Visual features: {len(visual_features)}")
    print(f"   Computational features: {len(computational_features)}")

    # Check if we have the expected 30 features (12 visual + 18 computational)
    if len(visual_features) == 12:
        print("✅ All 12 visual features present")
    else:
        print(f"❌ Expected 12 visual features, found {len(visual_features)}")

    if len(features) >= 30:
        print("✅ Target of 30+ total features achieved")
    else:
        print(f"❌ Expected 30+ features, found {len(features)}")

    # Display sample visual feature values
    print(f"\n📈 SAMPLE VISUAL METRICS:")
    for i in range(1, 6):  # Show first 5 visual metrics
        key = f'visual_{i}'
        if key in features:
            print(f"   {key}: {features[key]:.4f}")

    print(f"\n🧮 SAMPLE COMPUTATIONAL METRICS:")
    comp_sample = list(computational_features)[:5]  # Show first 5 computational metrics
    for key in comp_sample:
        if isinstance(features[key], (int, float)):
            print(f"   {key}: {features[key]}")
        else:
            print(f"   {key}: {features[key]}")

    # List all visual features to verify completeness
    print(f"\n🔍 ALL VISUAL FEATURES:")
    for key in sorted(visual_features):
        print(f"   {key}: {features[key]:.4f}")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\nTest completed!")
