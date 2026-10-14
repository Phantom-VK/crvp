from functools import lru_cache

import numpy as np
import pandas as pd
import shap
from sklearn.base import BaseEstimator
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline

from crvp.models.artifacts import TargetBundle, base_estimator


@lru_cache(maxsize=256)
def _tree_explainer(estimator: BaseEstimator) -> shap.TreeExplainer:
    """Build a tree explainer once per fitted estimator; construction dominates its cost."""
    return shap.TreeExplainer(estimator)


def _linear_explain(pipeline: Pipeline, x: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Explain scaled logistic regression; the scaled mean is zero so it is the background."""
    scaled = pipeline[:-1].transform(x)
    classifier = pipeline[-1]
    explainer = shap.LinearExplainer(classifier, np.zeros((1, scaled.shape[1])))
    return float(classifier.intercept_[0]), explainer.shap_values(scaled)


def _tree_explain(estimator: BaseEstimator, x: pd.DataFrame) -> tuple[float, np.ndarray]:
    """Explain a tree ensemble for the positive class.

    Additivity is verified by the test suite, so the per-call re-prediction is skipped.
    """
    explainer = _tree_explainer(estimator)
    values = explainer.shap_values(x, check_additivity=False)
    values = values[:, :, 1] if values.ndim == 3 else values
    return float(np.ravel(explainer.expected_value)[-1]), values


def _explain(model: CalibratedClassifierCV, x: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Return the base model's raw output and its SHAP values for each row.

    SHAP is additive, so the raw output is the base value plus the summed contributions:
    probability for forests, log-odds for boosted trees and logistic regression.
    """
    estimator = base_estimator(model)
    if isinstance(estimator, Pipeline):
        base, values = _linear_explain(estimator, x)
    else:
        base, values = _tree_explain(estimator, x)
    return base + values.sum(axis=1), values


def _calibrated(model: CalibratedClassifierCV, raw: np.ndarray) -> np.ndarray:
    """Apply a calibrated model's fitted sigmoid to the base model's raw output."""
    return model.calibrated_classifiers_[0].calibrators[0].predict(raw)


def warm_up(bundle: TargetBundle) -> None:
    """Build every tree explainer for a bundle so the first request is not slow.

    Args:
        bundle: A trained bundle.
    """
    for model in [bundle.model, *bundle.fold_models]:
        estimator = base_estimator(model)
        if not isinstance(estimator, Pipeline):
            _tree_explainer(estimator)


def contributions(bundle: TargetBundle, x: pd.DataFrame) -> np.ndarray:
    """Per-feature SHAP contributions from the serving model.

    Units are the base model's raw output (see ``_explain``). The contributions plus the
    explainer's base value sum exactly to that raw score, and the fitted calibration curve
    (``_calibrated``) maps the score to the displayed probability. That curve is monotone, so
    a larger total always means a higher probability.

    Args:
        bundle: A trained bundle.
        x: Encoded features containing at least ``bundle.feature_columns``.

    Returns:
        Array of shape ``(n_rows, n_features)`` in ``feature_columns`` order.
    """
    return _explain(bundle.model, x[list(bundle.feature_columns)])[1]


def serving_explanation(bundle: TargetBundle, x: pd.DataFrame) -> tuple[float, np.ndarray]:
    """Base value and per-feature SHAP contributions from the serving model.

    The base value plus the summed contributions is the raw score that the fitted calibration
    curve converts to the displayed probability.

    Args:
        bundle: A trained bundle.
        x: Encoded features containing at least ``bundle.feature_columns``.

    Returns:
        ``(base_value, values)`` where values has shape ``(n_rows, n_features)``.
    """
    raw, values = _explain(bundle.model, x[list(bundle.feature_columns)])
    return float(raw[0] - values[0].sum()), values


def fold_explanations(bundle: TargetBundle, x: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Probabilities and SHAP values from every CV fold model in a single pass.

    The spread across folds is the uncertainty estimate: how much a 303-row model's answer
    moves when it is refitted on a different 80% of the patients. Probabilities come from
    each fold's own calibrator applied to its SHAP-reconstructed output, which avoids
    running every forest a second time.

    Args:
        bundle: A trained bundle.
        x: Encoded features containing at least ``bundle.feature_columns``.

    Returns:
        ``(probabilities, values)`` of shapes ``(n_folds, n_rows)`` and
        ``(n_folds, n_rows, n_features)``.
    """
    ordered = x[list(bundle.feature_columns)]
    explained = [_explain(model, ordered) for model in bundle.fold_models]
    probabilities = [
        _calibrated(m, raw) for m, (raw, _) in zip(bundle.fold_models, explained, strict=True)
    ]
    return np.stack(probabilities), np.stack([values for _, values in explained])


def contribution_spread(bundle: TargetBundle, x: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Mean and standard deviation of SHAP contributions across the CV fold models.

    Args:
        bundle: A trained bundle.
        x: Encoded features containing at least ``bundle.feature_columns``.

    Returns:
        ``(mean, std)``, each of shape ``(n_rows, n_features)``.
    """
    _, values = fold_explanations(bundle, x)
    return values.mean(axis=0), values.std(axis=0)


def global_importance(bundle: TargetBundle, x: pd.DataFrame) -> pd.Series:
    """Rank features by mean absolute SHAP contribution.

    Args:
        bundle: A trained bundle.
        x: Encoded features to average over.

    Returns:
        Importance per feature, sorted descending.
    """
    importance = np.abs(contributions(bundle, x)).mean(axis=0)
    return pd.Series(importance, index=list(bundle.feature_columns)).sort_values(ascending=False)
