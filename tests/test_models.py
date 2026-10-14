import numpy as np
import pandas as pd
import pytest
import shap
from sklearn.pipeline import Pipeline

from crvp.config import load_config
from crvp.errors import ModelError
from crvp.models.artifacts import TargetBundle, load_bundle, save_bundle
from crvp.models.evaluate import METRICS
from crvp.models.explain import (
    _base_estimator,
    contribution_spread,
    contributions,
    global_importance,
)
from crvp.models.registry import ALGORITHMS, build_calibrated, build_estimator
from crvp.models.train import CvResult, cross_validate, make_splitter, select_best, train_target

N_FEATURES = 6
INFORMATIVE = {"f0", "f1"}


@pytest.fixture(scope="module")
def config():
    cfg = load_config()
    cfg["cv"] = {"n_splits": 3, "n_repeats": 2}
    cfg["calibration"] = {"method": "sigmoid", "cv": 3}
    cfg["models"]["random_forest"].update(n_estimators=20, n_jobs=1)
    cfg["models"]["hist_gradient_boosting"]["max_iter"] = 20
    return cfg


@pytest.fixture(scope="module")
def separable():
    """Data whose label is a clean function of f0 and f1; the other columns are pure noise."""
    rng = np.random.default_rng(0)
    x = pd.DataFrame(
        rng.normal(size=(150, N_FEATURES)), columns=[f"f{i}" for i in range(N_FEATURES)]
    )
    y = pd.Series((2 * x["f0"] + 2 * x["f1"] + 0.3 * rng.normal(size=150) > 0).astype(int))
    return x, y


@pytest.fixture(scope="module")
def bundle_and_report(separable, config):
    x, y = separable
    return train_target("T", x, y, config)


def test_default_config_runs_25_folds():
    assert make_splitter(load_config()).get_n_splits() == 25


def test_registry_builds_every_algorithm(config):
    for name in ALGORITHMS:
        assert hasattr(build_estimator(name, config), "fit")


def test_unknown_algorithm_raises(config):
    with pytest.raises(ModelError):
        build_estimator("svm", config)


@pytest.mark.parametrize("algorithm", ALGORITHMS)
def test_cross_validate_fold_count_and_bounds(separable, config, algorithm):
    x, y = separable
    result = cross_validate(algorithm, x, y, config)
    assert len(result.folds) == len(result.models) == 6
    for fold in result.folds:
        assert set(fold) == set(METRICS)
        assert all(0.0 <= value <= 1.0 for value in fold.values())


@pytest.mark.parametrize("algorithm", ALGORITHMS)
def test_separable_data_is_learned(separable, config, algorithm):
    x, y = separable
    result = cross_validate(algorithm, x, y, config)
    assert sum(fold["roc_auc"] for fold in result.folds) / len(result.folds) > 0.95


def test_select_best_picks_highest_mean_metric():
    results = {
        "low": CvResult("low", [{"roc_auc": 0.6}, {"roc_auc": 0.7}], []),
        "high": CvResult("high", [{"roc_auc": 0.9}, {"roc_auc": 0.7}], []),
    }
    assert select_best(results, "roc_auc") == "high"


def test_train_target_report_lists_every_algorithm(bundle_and_report):
    bundle, report = bundle_and_report
    assert report["selected"] == bundle.algorithm
    assert set(report["algorithms"]) == set(ALGORITHMS)
    assert len(bundle.fold_models) == 6


def test_bundle_carries_its_feature_contract(bundle_and_report, separable, tmp_path):
    bundle, _ = bundle_and_report
    x, _ = separable
    loaded = load_bundle("T", tmp_path) if save_bundle(bundle, tmp_path) else None
    assert loaded.feature_columns == tuple(x.columns)
    shuffled = x[list(reversed(x.columns))]
    assert loaded.predict_proba(shuffled) == pytest.approx(bundle.predict_proba(x))


def test_load_missing_bundle_raises(tmp_path):
    with pytest.raises(ModelError):
        load_bundle("absent", tmp_path)


@pytest.mark.parametrize("algorithm", ALGORITHMS)
def test_contributions_shape_and_find_informative_features(separable, config, algorithm):
    x, y = separable
    model = build_calibrated(algorithm, config).fit(x, y)
    bundle = TargetBundle("T", algorithm, tuple(x.columns), model, [model])
    assert contributions(bundle, x).shape == x.shape
    assert set(global_importance(bundle, x).index[:2]) == INFORMATIVE


def _raw_output(estimator, x):
    if isinstance(estimator, Pipeline) or hasattr(estimator, "decision_function"):
        return estimator.decision_function(x)
    return estimator.predict_proba(x)[:, 1]


def _base_value(estimator):
    if isinstance(estimator, Pipeline):
        return estimator[-1].intercept_[0]
    return np.ravel(shap.TreeExplainer(estimator).expected_value)[-1]


@pytest.mark.parametrize("algorithm", ALGORITHMS)
def test_contributions_are_additive(separable, config, algorithm):
    x, y = separable
    model = build_calibrated(algorithm, config).fit(x, y)
    bundle = TargetBundle("T", algorithm, tuple(x.columns), model, [model])
    estimator = _base_estimator(model)
    reconstructed = _base_value(estimator) + contributions(bundle, x).sum(axis=1)
    assert reconstructed == pytest.approx(_raw_output(estimator, x), abs=1e-6)


def test_contribution_spread_shapes(bundle_and_report, separable):
    bundle, _ = bundle_and_report
    x, _ = separable
    mean, std = contribution_spread(bundle, x.head(3))
    assert mean.shape == std.shape == (3, N_FEATURES)
    assert (std >= 0).all()
