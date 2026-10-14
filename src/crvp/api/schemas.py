from typing import Annotated, Any, Literal

import pandas as pd
from pydantic import BaseModel, ConfigDict, Field, create_model

from crvp.data.schema import (
    BINARY_COLUMNS,
    ONE_HOT_LEVELS,
    RAW_FEATURE_COLUMNS,
    YN_COLUMNS,
)

# Observed range in the 303-patient file, widened to clinically plausible limits so a valid
# patient outside the training range is accepted while a typo or unit error is not.
NUMERIC_BOUNDS = {
    "Age": (18, 110),
    "Weight": (20, 250),
    "Length": (100, 230),
    "BMI": (10, 80),
    "BP": (50, 300),
    "PR": (20, 250),
    "FBS": (20, 1000),
    "CR": (0.1, 20),
    "TG": (10, 5000),
    "LDL": (5, 700),
    "HDL": (5, 250),
    "BUN": (1, 300),
    "ESR": (0, 200),
    "HB": (2, 25),
    "K": (1.5, 10),
    "Na": (100, 180),
    "WBC": (500, 100000),
    "Lymph": (0, 100),
    "Neut": (0, 100),
    "PLT": (5, 2000),
    "EF-TTE": (5, 80),
}

# NLR divides by Lymph, so zero must be rejected rather than yield an infinite ratio.
STRICTLY_POSITIVE = ("Lymph",)

ORDINAL_LEVELS = {"Function Class": (0, 1, 2, 3), "Region RWMA": (0, 1, 2, 3, 4)}

# The source file spells the female label "Fmale"; the API exposes the correct word.
API_SEX_TO_DATASET = {"Male": "Male", "Female": "Fmale"}
DATASET_SEX_TO_API = {dataset: api for api, dataset in API_SEX_TO_DATASET.items()}

TargetName = Literal["Cath", "LAD", "LCX", "RCA"]


def _numeric_field(column: str) -> tuple[Any, Any]:
    """Field definition for a bounded, finite number."""
    low, high = NUMERIC_BOUNDS[column]
    bound = {"gt": low} if column in STRICTLY_POSITIVE else {"ge": low}
    return Annotated[float, Field(le=high, allow_inf_nan=False, **bound)], ...


def _field_definitions() -> dict[str, tuple[Any, Any]]:
    """One required, tightly typed field per raw feature column."""
    fields = {column: _numeric_field(column) for column in NUMERIC_BOUNDS}
    fields.update({column: (Literal[levels], ...) for column, levels in ORDINAL_LEVELS.items()})
    fields.update({column: (Literal[0, 1], ...) for column in BINARY_COLUMNS})
    fields.update({column: (Literal["N", "Y"], ...) for column in YN_COLUMNS})
    fields.update({column: (Literal[levels], ...) for column, levels in ONE_HOT_LEVELS.items()})
    fields["Sex"] = (Literal["Male", "Female"], ...)
    return fields


PatientFeatures = create_model(
    "PatientFeatures",
    __config__=ConfigDict(extra="forbid"),
    __doc__="One patient's chart, exam, ECG, lab and echo findings. No target may be supplied.",
    **_field_definitions(),
)


class Contribution(BaseModel):
    """One feature's SHAP contribution to a target's prediction."""

    feature: str
    block: str
    value: float
    spread: float


class TargetPrediction(BaseModel):
    """Probability, uncertainty band and explanation for one target."""

    algorithm: str
    probability: float = Field(ge=0, le=1)
    interval_low: float = Field(ge=0, le=1)
    interval_high: float = Field(ge=0, le=1)
    cv_roc_auc: float
    base_value: float
    other_features: float
    raw_score: float
    contributions: list[Contribution]


class PredictResponse(BaseModel):
    """Predictions keyed by target name."""

    predictions: dict[TargetName, TargetPrediction]


def to_frame(patient: BaseModel) -> pd.DataFrame:
    """Convert a validated request into the one-row raw frame the pipeline expects.

    Args:
        patient: A validated ``PatientFeatures`` instance.

    Returns:
        A single-row frame using the dataset's own labels.
    """
    row = patient.model_dump()
    row["Sex"] = API_SEX_TO_DATASET[row["Sex"]]
    return pd.DataFrame([row])


def payload_from_row(row: pd.Series) -> dict[str, Any]:
    """Convert a raw dataset row into an API request body.

    Args:
        row: One patient from the raw dataset.

    Returns:
        A JSON-serialisable dict that validates as ``PatientFeatures``.
    """
    payload = {
        column: row[column].item() if hasattr(row[column], "item") else row[column]
        for column in RAW_FEATURE_COLUMNS
    }
    payload["Sex"] = DATASET_SEX_TO_API[payload["Sex"]]
    return payload
