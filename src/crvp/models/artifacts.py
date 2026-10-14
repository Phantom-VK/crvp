from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV

from crvp.errors import ModelError


@dataclass
class TargetBundle:
    """A trained model for one target, carrying its own input contract.

    Attributes:
        target: Target name, one of ``TARGETS``.
        algorithm: Name of the algorithm that won cross-validation.
        feature_columns: Exact input columns, in the order the model was fitted on.
        model: Calibrated model fitted on all rows; the one that serves predictions.
        fold_models: Calibrated models from each CV fold, used for uncertainty.
    """

    target: str
    algorithm: str
    feature_columns: tuple[str, ...]
    model: CalibratedClassifierCV
    fold_models: list[CalibratedClassifierCV]

    def predict_proba(self, x: pd.DataFrame) -> np.ndarray:
        """Predict the positive-class probability using the saved column contract.

        Args:
            x: Encoded features containing at least ``feature_columns``.

        Returns:
            One probability per row.
        """
        return self.model.predict_proba(x[list(self.feature_columns)])[:, 1]


def _bundle_path(target: str, directory: Path) -> Path:
    """Return where a target's bundle is stored."""
    return directory / f"{target}.joblib"


def save_bundle(bundle: TargetBundle, directory: Path) -> Path:
    """Persist a bundle to ``<directory>/<target>.joblib``.

    Args:
        bundle: The trained bundle.
        directory: Artifact directory; created if missing.

    Returns:
        The written path.
    """
    directory.mkdir(parents=True, exist_ok=True)
    path = _bundle_path(bundle.target, directory)
    joblib.dump(bundle, path, compress=3)
    return path


def load_bundle(target: str, directory: Path) -> TargetBundle:
    """Load a previously saved bundle. Only load artifacts this project produced.

    Args:
        target: Target name.
        directory: Artifact directory.

    Returns:
        The stored bundle.

    Raises:
        ModelError: If no bundle exists for the target.
    """
    path = _bundle_path(target, directory)
    if not path.is_file():
        raise ModelError(f"No trained model at {path}; run scripts/train_all.py")
    return joblib.load(path)
