import json

import pytest
from pydantic import ValidationError

from crvp.api.schemas import (
    API_SEX_TO_DATASET,
    NUMERIC_BOUNDS,
    ORDINAL_LEVELS,
    STRICTLY_POSITIVE,
    PatientFeatures,
    payload_from_row,
    to_frame,
)
from crvp.data.features import encode_features
from crvp.data.schema import (
    FEATURE_COLUMNS,
    NUMERIC_COLUMNS,
    RAW_FEATURE_COLUMNS,
    SEX_MAP,
    TARGETS,
)


@pytest.fixture(scope="module")
def payload(raw):
    return payload_from_row(raw.iloc[0])


def _with(payload, **changes):
    return {**payload, **changes}


def test_every_raw_feature_has_a_field():
    assert set(PatientFeatures.model_fields) == set(RAW_FEATURE_COLUMNS)


def test_numeric_bounds_cover_every_numeric_column():
    assert set(NUMERIC_BOUNDS) | set(ORDINAL_LEVELS) == set(NUMERIC_COLUMNS)


def test_sex_labels_map_onto_dataset_labels():
    assert set(API_SEX_TO_DATASET.values()) == set(SEX_MAP)


def test_every_training_patient_is_accepted(raw):
    for _, row in raw.iterrows():
        PatientFeatures.model_validate(payload_from_row(row))


def test_payload_is_json_serialisable(payload):
    assert json.loads(json.dumps(payload)) == payload


@pytest.mark.parametrize("column", list(NUMERIC_BOUNDS))
def test_values_outside_bounds_are_rejected(payload, column):
    low, high = NUMERIC_BOUNDS[column]
    for bad in (low - 1, high + 1):
        with pytest.raises(ValidationError):
            PatientFeatures.model_validate(_with(payload, **{column: bad}))


@pytest.mark.parametrize("column", list(NUMERIC_BOUNDS))
def test_values_at_the_bounds_are_accepted_except_strictly_positive(payload, column):
    low, high = NUMERIC_BOUNDS[column]
    PatientFeatures.model_validate(_with(payload, **{column: high}))
    if column not in STRICTLY_POSITIVE:
        PatientFeatures.model_validate(_with(payload, **{column: low}))


@pytest.mark.parametrize(
    ("column", "bad"),
    [("Lymph", 0), ("DM", 7), ("Age", -5), ("Function Class", 4), ("Region RWMA", 5)],
)
def test_the_unsafe_inputs_named_in_review_are_rejected(payload, column, bad):
    with pytest.raises(ValidationError):
        PatientFeatures.model_validate(_with(payload, **{column: bad}))


@pytest.mark.parametrize("bad", ["NaN", "Infinity", "-Infinity"])
def test_non_finite_numbers_are_rejected(payload, bad):
    body = json.dumps(payload).replace(f'"Age": {payload["Age"]}', f'"Age": {bad}')
    with pytest.raises(ValidationError):
        PatientFeatures.model_validate_json(body)


@pytest.mark.parametrize("target", TARGETS)
def test_supplying_a_target_is_rejected(payload, target):
    with pytest.raises(ValidationError):
        PatientFeatures.model_validate(_with(payload, **{target: 1}))


def test_missing_field_is_rejected(payload):
    incomplete = {k: v for k, v in payload.items() if k != "EF-TTE"}
    with pytest.raises(ValidationError):
        PatientFeatures.model_validate(incomplete)


@pytest.mark.parametrize(
    ("column", "bad"), [("Sex", "Fmale"), ("BBB", "XBBB"), ("VHD", "none"), ("LVH", "Yes")]
)
def test_unknown_labels_are_rejected(payload, column, bad):
    with pytest.raises(ValidationError):
        PatientFeatures.model_validate(_with(payload, **{column: bad}))


def test_request_path_encodes_identically_to_the_training_path(raw):
    for index in (0, 100, 250):
        patient = PatientFeatures.model_validate(payload_from_row(raw.iloc[index]))
        from_api = encode_features(to_frame(patient))
        from_file = encode_features(raw.iloc[[index]])
        assert list(from_api.columns) == list(FEATURE_COLUMNS)
        assert from_api.to_numpy() == pytest.approx(from_file.to_numpy())
