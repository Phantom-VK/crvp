from crvp.data.schema import (
    DEAD_COLUMNS,
    FEATURE_BLOCKS,
    FEATURE_COLUMNS,
    RAW_COLUMNS,
    RAW_FEATURE_COLUMNS,
    TARGETS,
    dummy_names,
)

DERIVED = {"NLR", "NonHDL"}


def test_raw_columns_match_dataset_width():
    assert len(RAW_COLUMNS) == 59
    assert len(set(RAW_COLUMNS)) == 59


def test_feature_columns_are_unique():
    assert len(set(FEATURE_COLUMNS)) == len(FEATURE_COLUMNS)


def test_feature_columns_exclude_targets_and_dead_columns():
    assert set(FEATURE_COLUMNS).isdisjoint(TARGETS)
    assert set(FEATURE_COLUMNS).isdisjoint(DEAD_COLUMNS)


def test_every_raw_feature_is_covered_by_a_block():
    expected = set(RAW_FEATURE_COLUMNS) | DERIVED
    expected -= {"BBB", "VHD"}
    expected |= set(dummy_names("BBB")) | set(dummy_names("VHD"))
    assert set(FEATURE_COLUMNS) == expected


def test_five_blocks():
    assert list(FEATURE_BLOCKS) == ["demographic", "symptom_exam", "ecg", "lab", "echo"]
