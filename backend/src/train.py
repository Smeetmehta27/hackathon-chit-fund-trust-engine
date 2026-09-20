import json
import math
import random

def sigmoid(z):
    return 1.0 / (1.0 + math.exp(-max(min(z, 20), -20)))

def dot_product(w, x):
    return sum(wi * xi for wi, xi in zip(w, x))

def train_logistic_regression():
    # Features: [pct_on_time, avg_days_late, consistency (0-1)]
    # We want a high score (closer to 1.0) for good payers (low risk),
    # and a low score (closer to 0.0) for bad payers (high risk).
    
    # Generate synthetic data
    # format: (features, label)
    # label: 1 = good payer, 0 = bad payer
    dataset = []
    
    for _ in range(500):
        good = random.random() > 0.5
        if good:
            pct_on_time = random.uniform(0.8, 1.0)
            avg_days_late = random.uniform(0.0, 2.0)
            consistency = random.uniform(0.8, 1.0)
            dataset.append(([pct_on_time, avg_days_late, consistency], 1.0))
        else:
            pct_on_time = random.uniform(0.0, 0.6)
            avg_days_late = random.uniform(5.0, 30.0)
            consistency = random.uniform(0.0, 0.5)
            dataset.append(([pct_on_time, avg_days_late, consistency], 0.0))
            
    # Initialize weights and bias
    w = [0.0, 0.0, 0.0]
    b = 0.0
    learning_rate = 0.01
    epochs = 1000
    
    # Gradient descent
    for epoch in range(epochs):
        for x, y in dataset:
            # Forward pass
            z = dot_product(w, x) + b
            pred = sigmoid(z)
            
            # Error
            error = pred - y
            
            # Backward pass (gradients)
            for i in range(len(w)):
                w[i] -= learning_rate * error * pred * (1 - pred) * x[i]
            b -= learning_rate * error * pred * (1 - pred)

    print(f"Trained weights: {w}")
    print(f"Trained bias: {b}")
    
    # Export to constants.py
    with open("constants.py", "w") as f:
        f.write("# Auto-generated logistic regression weights\n")
        f.write(f"RISK_WEIGHTS = {w}\n")
        f.write(f"RISK_BIAS = {b}\n")
        
    print("Exported weights to constants.py")

if __name__ == "__main__":
    train_logistic_regression()
