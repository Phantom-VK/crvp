import json

import numpy as np
import pandas as pd
import pytest

from crvp.models.evaluate import METRICS, fold_metrics, summarise, write_metrics


def test_fold_metrics_known_values():
    y = pd.Series([0, 1, 1, 0])
    proba = np.array([0.2, 0.9, 0.4, 0.6])
    scores = fold_metrics(y, proba, threshold=0.5)
    assert scores["accuracy"] == 0.5
    assert scores["precision"] == 0.5
    assert scores["recall"] == 0.5
    assert scores["f1"] == 0.5
    assert scores["roc_auc"] == 0.75


def test_fold_metrics_perfect_separation():
    scores = fold_metrics(pd.Series([0, 0, 1, 1]), np.array([0.1, 0.2, 0.8, 0.9]), threshold=0.5)
    assert all(scores[metric] == 1.0 for metric in METRICS)


def test_no_positive_predictions_gives_zero_precision_not_an_error():
    scores = fold_metrics(pd.Series([0, 1, 1, 0]), np.array([0.1, 0.4, 0.3, 0.2]), threshold=0.5)
    assert scores["precision"] == 0.0
    assert scores["recall"] == 0.0


def test_summarise_mean_and_std():
    folds = [{m: 0.6 for m in METRICS}, {m: 0.8 for m in METRICS}]
    summary = summarise(folds)
    assert summary["roc_auc"]["mean"] == pytest.approx(0.7)
    assert summary["roc_auc"]["std"] == pytest.approx(0.1)
    assert set(summary) == set(METRICS)


def test_write_metrics_round_trips(tmp_path):
    path = tmp_path / "nested" / "metrics.json"
    write_metrics({"a": {"b": 1.5}}, path)
    assert json.loads(path.read_text()) == {"a": {"b": 1.5}}
