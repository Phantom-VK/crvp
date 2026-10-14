from typing import Any

import numpy as np
import pandas as pd

from crvp.config import project_path
from crvp.data.features import encode_features
from crvp.data.schema import BLOCK_OF, TARGETS
from crvp.models.artifacts import TargetBundle, load_bundle, load_cv_auc
from crvp.models.explain import contributions, fold_explanations, warm_up


class Predictor:
    """Turns raw patient rows into per-target probabilities, bands and SHAP contributions."""

    def __init__(
        self,
        bundles: dict[str, TargetBundle],
        cv_auc: dict[str, float],
        config: dict[str, Any],
    ) -> None:
        """Hold trained bundles and the settings that shape the output.

        Args:
            bundles: Trained bundle per target.
            cv_auc: Cross-validated ROC-AUC per target.
            config: The project configuration.
        """
        self._bundles = bundles
        self._cv_auc = cv_auc
        self._settings = config["predict"]

    @classmethod
    def load(cls, config: dict[str, Any]) -> Predictor:
        """Load every target's bundle from the configured artifact directory.

        Args:
            config: The project configuration.

        Returns:
            A ready predictor.

        Raises:
            ModelError: If any bundle or the metrics file is missing.
        """
        directory = project_path(config["paths"]["artifacts_dir"])
        bundles = {target: load_bundle(target, directory) for target in TARGETS}
        for bundle in bundles.values():
            warm_up(bundle)
        return cls(bundles, load_cv_auc(directory), config)

    def predict(self, patient: pd.DataFrame) -> dict[str, dict[str, Any]]:
        """Predict all four targets for one patient.

        Args:
            patient: A single raw row with every feature column. Target columns are ignored.

        Returns:
            Per target: algorithm, probability, uncertainty band, cross-validated AUC and
            the largest SHAP contributions with their spread across CV folds.
        """
        x = encode_features(patient)
        return {target: self._predict_target(target, x) for target in TARGETS}

    def _predict_target(self, target: str, x: pd.DataFrame) -> dict[str, Any]:
        """Assemble one target's prediction."""
        bundle = self._bundles[target]
        fold_probabilities, fold_values = fold_explanations(bundle, x)
        low, high = np.percentile(fold_probabilities, self._settings["uncertainty_percentiles"])
        return {
            "algorithm": bundle.algorithm,
            "probability": float(bundle.predict_proba(x)[0]),
            "interval_low": float(low),
            "interval_high": float(high),
            "cv_roc_auc": self._cv_auc[target],
            "contributions": self._top_contributions(bundle, x, fold_values[:, 0].std(axis=0)),
        }

    def _top_contributions(
        self, bundle: TargetBundle, x: pd.DataFrame, spread: np.ndarray
    ) -> list[dict[str, Any]]:
        """The largest SHAP contributions by magnitude, with fold-to-fold spread."""
        values = contributions(bundle, x)[0]
        order = np.argsort(-np.abs(values))[: self._settings["top_contributions"]]
        return [
            {
                "feature": bundle.feature_columns[i],
                "block": BLOCK_OF[bundle.feature_columns[i]],
                "value": float(values[i]),
                "spread": float(spread[i]),
            }
            for i in order
        ]
