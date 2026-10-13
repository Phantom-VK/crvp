from collections.abc import Mapping

import pandas as pd

from crvp.data.schema import (
    DEAD_COLUMNS,
    FEATURE_COLUMNS,
    ONE_HOT_LEVELS,
    RAW_FEATURE_COLUMNS,
    SEX_MAP,
    TARGET_POSITIVE_LABEL,
    TARGETS,
    YN_COLUMNS,
    YN_MAP,
    dummy_names,
)
from crvp.errors import DataError

# The dataset has no total cholesterol. Friedewald gives total = LDL + HDL + TG/5, so
# non-HDL = LDL + TG/5.
FRIEDEWALD_TG_DIVISOR = 5


def _require_columns(df: pd.DataFrame) -> None:
    """Raise DataError if any raw feature column is absent."""
    missing = sorted(set(RAW_FEATURE_COLUMNS) - set(df.columns))
    if missing:
        raise DataError(f"Missing feature columns: {missing}")


def _map_strict(series: pd.Series, mapping: Mapping[str, int]) -> pd.Series:
    """Map labels to integers, raising on any label not in the mapping."""
    mapped = series.map(mapping)
    if mapped.isna().any():
        unexpected = sorted(set(series[mapped.isna()].astype(str)))
        raise DataError(f"Unexpected values in {series.name!r}: {unexpected}")
    return mapped.astype(int)


def _one_hot(df: pd.DataFrame) -> pd.DataFrame:
    """Replace each multi-class column with dummies for its non-reference levels."""
    out = df.copy()
    for column, levels in ONE_HOT_LEVELS.items():
        codes = _map_strict(out.pop(column), {level: i for i, level in enumerate(levels)})
        for code, name in enumerate(dummy_names(column), start=1):
            out[name] = (codes == code).astype(int)
    return out


def add_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add the neutrophil-lymphocyte ratio and non-HDL cholesterol.

    Args:
        df: Frame holding ``Neut``, ``Lymph``, ``LDL`` and ``TG``.

    Returns:
        A copy with ``NLR`` and ``NonHDL`` columns appended.
    """
    out = df.copy()
    out["NLR"] = out["Neut"] / out["Lymph"]
    out["NonHDL"] = out["LDL"] + out["TG"] / FRIEDEWALD_TG_DIVISOR
    return out


def encode_features(df: pd.DataFrame) -> pd.DataFrame:
    """Encode raw patient rows into the model input matrix.

    All four targets and the dead columns are dropped whether or not they are present, so
    no caller can leak a target into the inputs.

    Args:
        df: Raw rows with at least every column in ``RAW_FEATURE_COLUMNS``.

    Returns:
        Numeric frame with exactly ``FEATURE_COLUMNS``, in that order.

    Raises:
        DataError: If a feature column is missing or holds an unexpected label.
    """
    _require_columns(df)
    out = df.drop(columns=[c for c in (*TARGETS, *DEAD_COLUMNS) if c in df.columns])
    out["Sex"] = _map_strict(out["Sex"], SEX_MAP)
    for column in YN_COLUMNS:
        out[column] = _map_strict(out[column], YN_MAP)
    return add_derived_features(_one_hot(out))[list(FEATURE_COLUMNS)]


def build_features(df: pd.DataFrame, target: str) -> tuple[pd.DataFrame, pd.Series]:
    """Build the input matrix and binary label for one prediction target.

    Args:
        df: The raw dataset, including the target columns.
        target: One of ``TARGETS``.

    Returns:
        ``(X, y)`` where X excludes all four targets and y is 1 for the positive class.

    Raises:
        DataError: If ``target`` is unknown or not present in ``df``.
    """
    if target not in TARGETS:
        raise DataError(f"Unknown target {target!r}; expected one of {TARGETS}")
    if target not in df.columns:
        raise DataError(f"Target column {target!r} not found in data")
    y = (df[target] == TARGET_POSITIVE_LABEL[target]).astype(int)
    return encode_features(df), y
