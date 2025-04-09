import argparse
import json
import logging
import pandas as pd
import numpy as np
from collections import defaultdict
from sklearn.metrics import confusion_matrix, classification_report

def analyze_results(results):
    """Analyze test results and print summary information"""
    categories_count = {}
    status_codes = {}
    legitimate_success = 0
    legitimate_detected = 0  # Legitimate traffic incorrectly flagged (false positives)
    legitimate_total = 0
    incorrect_total = 0
    incorrect_success = 0
    attack_success = 0      # Attacks that weren't detected (false negatives)
    attack_detected = 0     # Attacks that were detected (true positives)
    attack_total = 0
    
    # Track category-specific metrics
    category_metrics = defaultdict(lambda: {"total": 0, "detected": 0, "success": 0})
    
    for result in results:
        # Count by category
        category = result.get("category", "Unknown")
        if category not in categories_count:
            categories_count[category] = 0
        categories_count[category] += 1
        
        # Count by status code
        status = result.get("status_code", "Error")
        if status not in status_codes:
            status_codes[status] = 0
        status_codes[status] += 1
        
        # Track metrics by attack category
        if category not in ["Legitimate", "Incorrect"]:
            category_metrics[category]["total"] += 1
            if result.get("detected", False):
                category_metrics[category]["detected"] += 1
            if status == 200:
                category_metrics[category]["success"] += 1
        
        # Track legitimate login success rate and false positives
        if result.get("legitimate", False):
            legitimate_total += 1
            if status == 200:
                legitimate_success += 1
            if result.get("detected", False):
                legitimate_detected += 1
                
        # Track incorrect login attempts (shouldn't be successful)
        elif result.get("incorrect", False):
            incorrect_total += 1
            if status == 200:
                incorrect_success += 1
        
        # Track attack success rate and detection rate
        elif result.get("attack", True):
            attack_total += 1
            if status == 200:
                attack_success += 1
            if result.get("detected", False):
                attack_detected += 1
    
    # Calculate key metrics
    if attack_total > 0:
        detection_rate = attack_detected / attack_total * 100
        bypass_rate = attack_success / attack_total * 100
    else:
        detection_rate = 0
        bypass_rate = 0
        
    if legitimate_total > 0:
        false_positive_rate = legitimate_detected / legitimate_total * 100
    else:
        false_positive_rate = 0
        
    # Prepare confusion matrix data
    y_true = []
    y_pred = []
    
    for result in results:
        # True class: attack or not attack
        is_attack = not (result.get("legitimate", False) or result.get("incorrect", False))
        y_true.append(1 if is_attack else 0)
        
        # Predicted class: detected as attack or not
        detected = result.get("detected", False)
        y_pred.append(1 if detected else 0)
    
    # Calculate confusion matrix
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
    
    # Calculate additional metrics
    accuracy = (tp + tn) / (tp + tn + fp + fn) if (tp + tn + fp + fn) > 0 else 0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1_score = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    
    # Print summary
    print("\n=== Test Results Summary ===")
    print(f"\nTotal requests: {len(results)}")
    
    print("\nRequests by category:")
    for category, count in sorted(categories_count.items(), key=lambda x: x[1], reverse=True):
        print(f"- {category}: {count} ({count/len(results)*100:.1f}%)")
    print("\n=== Security Model Performance Metrics ===")
    
    print(f"\nOverall Detection Rate: {detection_rate:.1f}%")
    print(f"Bypass Rate (False Negatives): {bypass_rate:.1f}%")
    print(f"False Positive Rate: {false_positive_rate:.1f}%")
    print(f"Accuracy: {accuracy*100:.2f}%")
    print(f"Precision: {precision*100:.2f}%")
    print(f"Recall: {recall*100:.2f}%")
    print(f"F1 Score: {f1_score*100:.2f}%")
    
    print("\nConfusion Matrix:")
    print(f"True Positives: {tp} (Attacks correctly detected)")
    print(f"False Positives: {fp} (Legitimate traffic incorrectly flagged)")
    print(f"True Negatives: {tn} (Legitimate traffic correctly passed)")
    print(f"False Negatives: {fn} (Attacks incorrectly passed)")
    
    if legitimate_total > 0:
        print(f"\nLegitimate login success rate: {legitimate_success}/{legitimate_total} ({legitimate_success/legitimate_total*100:.1f}%)")
    
    if incorrect_total > 0:
        print(f"Incorrect login success rate: {incorrect_success}/{incorrect_total} ({incorrect_success/incorrect_total*100:.1f}%)")
    
    if attack_total > 0:
        print(f"Attack success rate: {attack_success}/{attack_total} ({attack_success/attack_total*100:.1f}%)")
        print(f"Attack detection rate: {attack_detected}/{attack_total} ({attack_detected/attack_total*100:.1f}%)")
    
    # Category-specific metrics
    print("\n=== Attack Category Performance ===")
    for category, metrics in sorted(category_metrics.items(), key=lambda x: x[1]["total"], reverse=True):
        if metrics["total"] > 0:
            detection_percent = metrics["detected"] / metrics["total"] * 100
            success_percent = metrics["success"] / metrics["total"] * 100
            print(f"\n{category}:")
            print(f"  Total: {metrics['total']}")
            print(f"  Detection Rate: {metrics['detected']}/{metrics['total']} ({detection_percent:.1f}%)")
            print(f"  Bypass Rate: {metrics['success']}/{metrics['total']} ({success_percent:.1f}%)")
    
    return {
        "total_requests": len(results),
        "attack_requests": attack_total,
        "legitimate_requests": legitimate_total,
        "incorrect_requests": incorrect_total,
        "detection_rate": detection_rate,
        "bypass_rate": bypass_rate,
        "false_positive_rate": false_positive_rate,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1_score": f1_score,
        "confusion_matrix": {
            "true_positives": tp,
            "true_negatives": tn,
            "false_positives": fp,
            "false_negatives": fn
        },
        "category_metrics": {k: v for k, v in category_metrics.items()}
    }

def generate_visualizations(results, metrics, output_prefix='sqli_analysis'):
    """Generate visualizations of the results"""
    try:
        import matplotlib.pyplot as plt
        import seaborn as sns
        
        # Set style
        sns.set(style="whitegrid")
        
        # Extract categories and their counts
        categories = {}
        for r in results:
            cat = r.get('category', 'Unknown')
            if cat not in categories:
                categories[cat] = 0
            categories[cat] += 1
        
        # 1. Category distribution
        plt.figure(figsize=(12, 6))
        plt.bar(categories.keys(), categories.values())
        plt.title('Distribution of Request Categories')
        plt.xlabel('Category')
        plt.ylabel('Count')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        plt.savefig(f'{output_prefix}_category_distribution.png')
        
        # 2. Confusion matrix visualization
        cm = [
            [metrics['confusion_matrix']['true_negatives'], metrics['confusion_matrix']['false_positives']],
            [metrics['confusion_matrix']['false_negatives'], metrics['confusion_matrix']['true_positives']]
        ]
        plt.figure(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                    xticklabels=['Legitimate', 'Attack'], 
                    yticklabels=['Legitimate', 'Attack'])
        plt.title('Confusion Matrix')
        plt.xlabel('Predicted')
        plt.ylabel('True')
        plt.tight_layout()
        plt.savefig(f'{output_prefix}_confusion_matrix.png')
        
        # 3. Response time analysis
        response_times = [r.get('response_time', 0) for r in results if 'response_time' in r]
        categories_for_times = [r.get('category', 'Unknown') for r in results if 'response_time' in r]
        
        time_data = pd.DataFrame({
            'category': categories_for_times,
            'response_time': response_times
        })
        
        plt.figure(figsize=(12, 6))
        sns.boxplot(x='category', y='response_time', data=time_data)
        plt.title('Response Time by Category')
        plt.xlabel('Category')
        plt.ylabel('Response Time (s)')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        plt.savefig(f'{output_prefix}_response_times.png')
        
        # 4. Key metrics visualization
        key_metrics = {
            'Accuracy': metrics['accuracy'],
            'Precision': metrics['precision'],
            'Recall': metrics['recall'],
            'F1 Score': metrics['f1_score']
        }
        
        plt.figure(figsize=(10, 6))
        plt.bar(key_metrics.keys(), key_metrics.values())
        plt.title('Key Performance Metrics')
        plt.ylabel('Score')
        plt.ylim(0, 1)
        for i, v in enumerate(key_metrics.values()):
            plt.text(i, v + 0.02, f'{v:.3f}', ha='center')
        plt.tight_layout()
        plt.savefig(f'{output_prefix}_key_metrics.png')
        
        print(f"Visualizations saved with prefix: {output_prefix}")
        
    except ImportError:
        print("Matplotlib and/or seaborn not installed. Skipping visualizations.")

def export_to_csv(results, output_file='sqli_results.csv'):
    """Export results to CSV for further analysis"""
    df = pd.DataFrame(results)
    
    # Select only relevant columns
    columns_to_export = [
        'category', 'payload', 'status_code', 'response_time', 
        'legitimate', 'incorrect', 'detected', 'attack', 'timestamp'
    ]
    
    # Filter to columns that exist in the data
    existing_columns = [col for col in columns_to_export if col in df.columns]
    
    df[existing_columns].to_csv(output_file, index=False)
    print(f"Results exported to CSV: {output_file}")

if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='SQL Injection Test Metrics Analyzer')
    parser.add_argument('--input', type=str, default='sqli_test_results.json', 
                        help='Input JSON file with test results')
    parser.add_argument('--visualize', action='store_true',
                        help='Generate visualization graphs')
    parser.add_argument('--csv', type=str, default='',
                        help='Export results to CSV file')
    parser.add_argument('--output-prefix', type=str, default='sqli_analysis',
                        help='Prefix for output visualization files')
    args = parser.parse_args()
    
    # Load the test results
    try:
        with open(args.input, 'r') as f:
            results = json.load(f)
        
        # Analysis
        print(f"Analyzing results from {args.input}")
        metrics = analyze_results(results)
        
        # Optional: Visualizations
        if args.visualize:
            generate_visualizations(results, metrics, args.output_prefix)
        
        # Optional: CSV export
        if args.csv:
            export_to_csv(results, args.csv)
            
    except FileNotFoundError:
        print(f"Error: Could not find input file {args.input}")
    except json.JSONDecodeError:
        print(f"Error: The file {args.input} is not valid JSON")