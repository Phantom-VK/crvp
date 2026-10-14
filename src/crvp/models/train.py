from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import RepeatedStratifiedKFold

from crvp.config import project_path
from crvp.data.features import build_features
from crvp.data.schema import TARGETS
from crvp.logging import get_logger
from crvp.models.artifacts import TargetBundle, save_bundle
from crvp.models.evaluate import fold_metrics, summarise, write_metrics
from crvp.models.registry import ALGORITHMS, build_calibrated

logger = get_logger(__name__)


@dataclass
class CvResult:
    """Per-fold metrics and fitted models for one algorithm on one target."""

    algorithm: str
    folds: list[dict[str, float]]
    models: list[CalibratedClassifierCV]


def make_splitter(config: dict[str, Any]) -> RepeatedStratifiedKFold:
    """Build the repeated stratified splitter from the config.

    Args:
        config: The project configuration.

    Returns:
        A splitter yielding ``n_splits * n_repeats`` folds.
    """
    cv = config["cv"]
    return RepeatedStratifiedKFold(
        n_splits=cv["n_splits"], n_repeats=cv["n_repeats"], random_state=config["seed"]
    )


def _fit_fold(
    algorithm: str,
    x: pd.DataFrame,
    y: pd.Series,
    split: tuple[np.ndarray, np.ndarray],
    config: dict[str, Any],
) -> tuple[dict[str, float], CalibratedClassifierCV]:
    """Fit on one training split and score on its held-out rows."""
    train, test = split
    model = build_calibrated(algorithm, config).fit(x.iloc[train], y.iloc[train])
    proba = model.predict_proba(x.iloc[test])[:, 1]
    return fold_metrics(y.iloc[test], proba, config["decision_threshold"]), model


def cross_validate(
    algorithm: str, x: pd.DataFrame, y: pd.Series, config: dict[str, Any]
) -> CvResult:
    """Run repeated stratified cross-validation for one algorithm.

    Args:
        algorithm: One of ``ALGORITHMS``.
        x: Encoded feature matrix.
        y: Binary labels.
        config: The project configuration.

    Returns:
        Metrics and the fitted model for every fold.
    """
    fits = [_fit_fold(algorithm, x, y, s, config) for s in make_splitter(config).split(x, y)]
    return CvResult(algorithm, [m for m, _ in fits], [model for _, model in fits])


def select_best(results: dict[str, CvResult], metric: str, tolerance_se: float = 1.0) -> str:
    """Pick an algorithm by the one-standard-error rule.

    The best mean wins unless an earlier-listed algorithm scores within ``tolerance_se``
    standard errors of it, in which case the earlier one is preferred. On 303 rows a gap
    that small is noise, and the rule also tempers the optimism of choosing a maximum on
    the same folds that are reported. Folds overlap, so the standard error is a lower bound.

    Args:
        results: Cross-validation results keyed by algorithm, in preference order.
        metric: Metric name, e.g. ``"roc_auc"``.
        tolerance_se: Width of the tie band in standard errors of the best algorithm.

    Returns:
        The selected algorithm's name.
    """
    scores = {name: [fold[metric] for fold in r.folds] for name, r in results.items()}
    means = {name: float(np.mean(values)) for name, values in scores.items()}
    best = max(means, key=means.__getitem__)
    standard_error = np.std(scores[best]) / np.sqrt(len(scores[best]))
    floor = means[best] - tolerance_se * standard_error
    return next(name for name in results if means[name] >= floor)


def train_target(
    target: str, x: pd.DataFrame, y: pd.Series, config: dict[str, Any]
) -> tuple[TargetBundle, dict[str, Any]]:
    """Compare all algorithms by cross-validation and fit the winner on every row.

    Args:
        target: Target name.
        x: Encoded feature matrix.
        y: Binary labels for the target.
        config: The project configuration.

    Returns:
        The trained bundle and this target's section of the metrics report.
    """
    results = {name: cross_validate(name, x, y, config) for name in ALGORITHMS}
    best = select_best(results, config["selection_metric"], config["selection_tolerance_se"])
    final = build_calibrated(best, config).fit(x, y)
    bundle = TargetBundle(target, best, tuple(x.columns), final, results[best].models)
    report = {
        "selected": best,
        "algorithms": {name: summarise(result.folds) for name, result in results.items()},
    }
    return bundle, report


def train_all(raw: pd.DataFrame, config: dict[str, Any]) -> dict[str, Any]:
    """Train every target, save the bundles and write ``metrics.json``.

    Args:
        raw: The raw dataset from ``load_dataset``.
        config: The project configuration.

    Returns:
        The full metrics report.
    """
    directory = project_path(config["paths"]["artifacts_dir"])
    targets = {}
    for target in TARGETS:
        logger.info("Training %s", target)
        x, y = build_features(raw, target)
        bundle, targets[target] = train_target(target, x, y, config)
        save_bundle(bundle, directory)
    report = {"cv": _cv_summary(config), "targets": targets}
    write_metrics(report, directory / "metrics.json")
    return report


def _cv_summary(config: dict[str, Any]) -> dict[str, int]:
    """Describe the CV scheme for the metrics report."""
    cv = config["cv"]
    return {**cv, "n_folds": cv["n_splits"] * cv["n_repeats"]}
