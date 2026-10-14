from collections.abc import Callable
from typing import Any

from sklearn.base import BaseEstimator
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from crvp.errors import ModelError


def _logistic_regression(params: dict[str, Any], seed: int) -> BaseEstimator:
    """Scaled L2-regularised logistic regression."""
    return make_pipeline(StandardScaler(), LogisticRegression(random_state=seed, **params))


def _random_forest(params: dict[str, Any], seed: int) -> BaseEstimator:
    """Random forest."""
    return RandomForestClassifier(random_state=seed, **params)


def _hist_gradient_boosting(params: dict[str, Any], seed: int) -> BaseEstimator:
    """Histogram gradient-boosted trees."""
    return HistGradientBoostingClassifier(random_state=seed, **params)


_FACTORIES: dict[str, Callable[[dict[str, Any], int], BaseEstimator]] = {
    "logistic_regression": _logistic_regression,
    "random_forest": _random_forest,
    "hist_gradient_boosting": _hist_gradient_boosting,
}
ALGORITHMS = tuple(_FACTORIES)


def build_estimator(name: str, config: dict[str, Any]) -> BaseEstimator:
    """Build an unfitted estimator from its configured hyperparameters.

    Args:
        name: One of ``ALGORITHMS``.
        config: The project configuration.

    Returns:
        An unfitted scikit-learn estimator.

    Raises:
        ModelError: If ``name`` is not a known algorithm.
    """
    if name not in _FACTORIES:
        raise ModelError(f"Unknown algorithm {name!r}; expected one of {ALGORITHMS}")
    return _FACTORIES[name](dict(config["models"][name]), config["seed"])


def build_calibrated(name: str, config: dict[str, Any]) -> CalibratedClassifierCV:
    """Wrap an estimator in probability calibration.

    With ``ensemble=False`` the base estimator is fitted once on all training rows and only
    the calibration map is cross-validated, which leaves a single model for SHAP to explain.

    Args:
        name: One of ``ALGORITHMS``.
        config: The project configuration.

    Returns:
        An unfitted calibrated classifier.
    """
    calibration = config["calibration"]
    folds = StratifiedKFold(calibration["cv"], shuffle=True, random_state=config["seed"])
    return CalibratedClassifierCV(
        build_estimator(name, config), method=calibration["method"], cv=folds, ensemble=False
    )
