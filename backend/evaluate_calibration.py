from __future__ import annotations

"""Evaluate detection accuracy/calibration and fit temperature scaling.

Text CSV format: `text,label` where label is FAKE/REAL.
Image CSV format: `path,label` where path is relative to the dataset root.

Example:
  python evaluate_calibration.py --kind text --csv validation.csv --model hamzab/roberta-fake-news-classification

The printed temperature can be supplied as DETECTION_TEMPERATURE in production.
"""

import argparse
import csv
import math
from pathlib import Path

import numpy as np
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score


def _softmax_temperature(p: float, temperature: float) -> float:
    eps = 1e-6
    p = min(max(p, eps), 1 - eps)
    logit = math.log(p / (1 - p)) / temperature
    return 1.0 / (1.0 + math.exp(-logit))


def _nll(probs, labels, temperature):
    eps = 1e-7
    calibrated = [_softmax_temperature(p, temperature) for p in probs]
    return -float(np.mean([
        math.log(max(p, eps)) if y == 1 else math.log(max(1 - p, eps))
        for p, y in zip(calibrated, labels)
    ]))


def _ece(probs, labels, bins=10):
    probs = np.asarray(probs, dtype=float)
    labels = np.asarray(labels, dtype=int)
    total = len(labels)
    error = 0.0
    for low, high in zip(np.linspace(0, 1, bins + 1)[:-1], np.linspace(0, 1, bins + 1)[1:]):
        mask = (probs >= low) & (probs < high if high < 1 else probs <= high)
        if not np.any(mask):
            continue
        confidence = float(np.mean(probs[mask]))
        accuracy = float(np.mean(labels[mask]))
        error += (np.sum(mask) / total) * abs(confidence - accuracy)
    return error


def _metrics(probs, labels, temperature):
    calibrated = np.array([_softmax_temperature(p, temperature) for p in probs])
    predicted = (calibrated >= 0.5).astype(int)
    return {
        "temperature": temperature,
        "accuracy": float(accuracy_score(labels, predicted)),
        "precision": float(precision_score(labels, predicted, zero_division=0)),
        "recall": float(recall_score(labels, predicted, zero_division=0)),
        "f1": float(f1_score(labels, predicted, zero_division=0)),
        "ece": float(_ece(calibrated, labels)),
        "confusion_matrix": confusion_matrix(labels, predicted).tolist(),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kind", choices=["text", "image"], required=True)
    parser.add_argument("--csv", required=True)
    parser.add_argument("--root", default=".")
    parser.add_argument("--model", default=None)
    args = parser.parse_args()

    from transformers import pipeline

    model_id = args.model or (
        "hamzab/roberta-fake-news-classification"
        if args.kind == "text"
        else "dima806/deepfake_vs_real_image_detection"
    )
    classifier = pipeline("text-classification" if args.kind == "text" else "image-classification", model=model_id)

    probs = []
    labels = []
    with open(args.csv, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            label = str(row["label"]).strip().upper()
            labels.append(1 if label == "FAKE" else 0)
            if args.kind == "text":
                output = classifier(row["text"][:10000], truncation=True, max_length=512)
            else:
                from PIL import Image
                output = classifier(Image.open(Path(args.root) / row["path"]).convert("RGB"))
            fake = next((float(x["score"]) for x in output if "fake" in str(x["label"]).lower() or "deepfake" in str(x["label"]).lower()), 0.5)
            probs.append(fake)

    if not labels:
        raise SystemExit("Validation CSV is empty")

    baseline = _metrics(probs, labels, 1.0)
    candidates = np.linspace(0.25, 4.0, 151)
    best_temperature = min(candidates, key=lambda t: _nll(probs, labels, float(t)))
    calibrated = _metrics(probs, labels, float(best_temperature))

    print("MODEL:", model_id)
    print("BASELINE:", baseline)
    print("CALIBRATED:", calibrated)
    print("Set DETECTION_TEMPERATURE=", round(float(best_temperature), 4))


if __name__ == "__main__":
    main()
