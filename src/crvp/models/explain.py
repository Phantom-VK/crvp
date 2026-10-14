import numpy as np
import pandas as pd
import shap
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline

from crvp.models.artifacts import TargetBundle


def _base_estimator(model: CalibratedClassifierCV) -> object:
    """Return the single fitted estimator inside an ``ensemble=False`` calibrated model."""
    return model.calibrated_classifiers_[0].estimator


def _linear_values(pipeline: Pipeline, x: pd.DataFrame) -> np.ndarray:
    """SHAP for scaled logistic regression; the scaled mean is zero so it is the background."""
    scaled = pipeline[:-1].transform(x)
    explainer = shap.LinearExplainer(pipeline[-1], np.zeros((1, scaled.shape[1])))
    return explainer.shap_values(scaled)


def _tree_values(estimator: object, x: pd.DataFrame) -> np.ndarray:
    """SHAP for a tree ensemble, reduced to the positive class."""
    values = shap.TreeExplainer(estimator).shap_values(x)
    return values[:, :, 1] if values.ndim == 3 else values


def _values(model: CalibratedClassifierCV, x: pd.DataFrame) -> np.ndarray:
    """SHAP values of the model's base estimator for the positive class."""
    estimator = _base_estimator(model)
    if isinstance(estimator, Pipeline):
        return _linear_values(estimator, x)
    return _tree_values(estimator, x)


def contributions(bundle: TargetBundle, x: pd.DataFrame) -> np.ndarray:
    """Per-feature SHAP contributions from the serving model.

    Units are the base model's raw output: probability for forests, log-odds for boosted
    trees and logistic regression. Calibration is a monotone map applied afterwards.

    Args:
        bundle: A trained bundle.
        x: Encoded features containing at least ``bundle.feature_columns``.

    Returns:
        Array of shape ``(n_rows, n_features)`` in ``feature_columns`` order.
    """
    return _values(bundle.model, x[list(bundle.feature_columns)])


def contribution_spread(bundle: TargetBundle, x: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Mean and standard deviation of SHAP contributions across the CV fold models.

    The spread is the uncertainty estimate: how much a 303-row model's explanation moves
    when it is refitted on a different 80% of the patients.

    Args:
        bundle: A trained bundle.
        x: Encoded features containing at least ``bundle.feature_columns``.

    Returns:
        ``(mean, std)``, each of shape ``(n_rows, n_features)``.
    """
    ordered = x[list(bundle.feature_columns)]
    stacked = np.stack([_values(model, ordered) for model in bundle.fold_models])
    return stacked.mean(axis=0), stacked.std(axis=0)


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
