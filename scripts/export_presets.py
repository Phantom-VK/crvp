import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import pandas as pd

from crvp.api.schemas import PatientFeatures, payload_from_row
from crvp.config import load_config, project_path
from crvp.data.load import load_dataset
from crvp.data.schema import TARGET_POSITIVE_LABEL, TARGETS
from crvp.errors import DataError
from crvp.models.predict import Predictor

NOTE = (
    "Each preset is a real patient from the published training dataset, so its prediction is "
    "in-sample and optimistic. Presets demonstrate the interface; they are not a validation."
)


def _stenotic(df: pd.DataFrame, target: str) -> pd.Series:
    """Rows where the target was found stenotic on angiography."""
    return df[target] == TARGET_POSITIVE_LABEL[target]


def _no_chest_pain(df: pd.DataFrame) -> pd.Series:
    """Rows reporting none of the three chest-pain presentations."""
    return (df["Typical Chest Pain"] == 0) & (df["Atypical"] == "N") & (df["Nonanginal"] == "N")


@dataclass(frozen=True)
class PresetSpec:
    """How to pick one illustrative patient from the dataset."""

    id: str
    label: str
    description: str
    mask: Callable[[pd.DataFrame], pd.Series]
    sort_by: str
    ascending: bool


SPECS = (
    PresetSpec(
        "no_disease",
        "No coronary disease",
        "Normal angiography and no regional wall-motion abnormality; highest EF.",
        lambda df: ~_stenotic(df, "Cath") & (df["Region RWMA"] == 0),
        "EF-TTE",
        False,
    ),
    PresetSpec(
        "single_lad",
        "Single-vessel disease (LAD only)",
        "Only the LAD is significantly narrowed on angiography.",
        lambda df: _stenotic(df, "LAD") & ~_stenotic(df, "LCX") & ~_stenotic(df, "RCA"),
        "Age",
        True,
    ),
    PresetSpec(
        "triple_vessel",
        "Triple-vessel disease",
        "LAD, LCX and RCA are all significantly narrowed; youngest such patient.",
        lambda df: _stenotic(df, "LAD") & _stenotic(df, "LCX") & _stenotic(df, "RCA"),
        "Age",
        True,
    ),
    PresetSpec(
        "high_rwma_low_ef",
        "Extensive wall-motion abnormality, low EF",
        "Maximum regional wall-motion score with the lowest ejection fraction.",
        lambda df: df["Region RWMA"] == df["Region RWMA"].max(),
        "EF-TTE",
        True,
    ),
    PresetSpec(
        "silent_disease",
        "Disease without chest pain",
        "Significant coronary disease in a patient reporting no chest pain.",
        lambda df: _stenotic(df, "Cath") & _no_chest_pain(df),
        "Age",
        False,
    ),
    PresetSpec(
        "normal_despite_typical_pain",
        "Typical chest pain, normal angiography",
        "Classic symptoms but open arteries; a case the model should not over-call.",
        lambda df: ~_stenotic(df, "Cath") & (df["Typical Chest Pain"] == 1),
        "Age",
        True,
    ),
)


def _pick(df: pd.DataFrame, spec: PresetSpec) -> pd.Series:
    """Choose the single qualifying patient a spec describes."""
    matches = df[spec.mask(df)]
    if matches.empty:
        raise DataError(f"No patient matches preset {spec.id!r}")
    return matches.sort_values(spec.sort_by, ascending=spec.ascending, kind="stable").iloc[0]


def _build_preset(spec: PresetSpec, row: pd.Series, predictor: Predictor) -> dict[str, Any]:
    """Assemble one preset: the validated request body, its prediction and the truth."""
    payload = payload_from_row(row)
    PatientFeatures.model_validate(payload)
    prediction = predictor.predict(pd.DataFrame([row]))
    return {
        "id": spec.id,
        "label": spec.label,
        "description": spec.description,
        "angiography": {t: bool(row[t] == TARGET_POSITIVE_LABEL[t]) for t in TARGETS},
        "patient": payload,
        "prediction": {"predictions": prediction},
    }


def main() -> None:
    """Write the preset patients and their predictions to the front-end's public folder."""
    config = load_config()
    raw = load_dataset()
    predictor = Predictor.load(config)
    presets = [_build_preset(spec, _pick(raw, spec), predictor) for spec in SPECS]
    path = project_path(config["paths"]["presets"])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"note": NOTE, "presets": presets}, indent=2), encoding="utf-8")
    for preset in presets:
        scores = {
            t: round(p["probability"], 2) for t, p in preset["prediction"]["predictions"].items()
        }
        print(f"{preset['id']:30} truth={preset['angiography']} predicted={scores}")
    print(f"\nWrote {len(presets)} presets to {path}")


if __name__ == "__main__":
    main()
