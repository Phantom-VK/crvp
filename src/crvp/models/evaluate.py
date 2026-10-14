import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score

METRICS = ("accuracy", "precision", "recall", "f1", "roc_auc")


def fold_metrics(y_true: pd.Series, proba: np.ndarray, threshold: float) -> dict[str, float]:
    """Score one fold's predicted probabilities.

    Args:
        y_true: Binary labels for the held-out rows.
        proba: Predicted probability of the positive class.
        threshold: Probability at or above which a row is called positive.

    Returns:
        Accuracy, precision, recall, F1 and ROC-AUC, each in [0, 1].
    """
    labels = (proba >= threshold).astype(int)
    return {
        "accuracy": accuracy_score(y_true, labels),
        "precision": precision_score(y_true, labels, zero_division=0),
        "recall": recall_score(y_true, labels, zero_division=0),
        "f1": f1_score(y_true, labels, zero_division=0),
        "roc_auc": roc_auc_score(y_true, proba),
    }


def summarise(folds: list[dict[str, float]]) -> dict[str, dict[str, float]]:
    """Reduce per-fold metrics to mean and standard deviation across folds.

    Args:
        folds: One metrics dict per CV fold.

    Returns:
        ``{metric: {"mean": ..., "std": ...}}``.
    """
    return {
        metric: {
            "mean": float(np.mean([fold[metric] for fold in folds])),
            "std": float(np.std([fold[metric] for fold in folds])),
        }
        for metric in METRICS
    }


def write_metrics(report: dict[str, Any], path: Path) -> None:
    """Write the evaluation report as JSON.

    Args:
        report: JSON-serialisable report.
        path: Destination file; parent directories are created.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2), encoding="utf-8")
