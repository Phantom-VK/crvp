import pandas as pd
import pytest
from sklearn.metrics import roc_auc_score

from crvp.data.features import add_derived_features, build_features, encode_features
from crvp.data.schema import DEAD_COLUMNS, FEATURE_COLUMNS, TARGETS
from crvp.errors import DataError

MAX_SINGLE_FEATURE_AUC = 0.90


@pytest.mark.parametrize("target", TARGETS)
def test_leakage_no_target_column_in_features(raw, target):
    x, _ = build_features(raw, target)
    assert set(x.columns).isdisjoint(TARGETS)


@pytest.mark.parametrize("target", TARGETS)
def test_leakage_no_single_feature_predicts_the_label(raw, target):
    x, y = build_features(raw, target)
    aucs = {c: roc_auc_score(y, x[c]) for c in x.columns}
    # An inverted copy of the label scores 0.0, so fold the AUC around 0.5.
    strongest = max(aucs, key=lambda c: max(aucs[c], 1 - aucs[c]))
    assert max(aucs[strongest], 1 - aucs[strongest]) < MAX_SINGLE_FEATURE_AUC, strongest


@pytest.mark.parametrize("target", TARGETS)
def test_leakage_all_four_targets_dropped_for_synthetic_row(synthetic_row, target):
    x, _ = build_features(synthetic_row, target)
    assert set(x.columns).isdisjoint(TARGETS)


def test_leakage_encode_drops_targets_when_present(synthetic_row):
    assert set(encode_features(synthetic_row).columns).isdisjoint(TARGETS)


def test_leakage_encode_works_without_targets(synthetic_row):
    patient = synthetic_row.drop(columns=list(TARGETS))
    assert list(encode_features(patient).columns) == list(FEATURE_COLUMNS)


def test_dead_columns_are_dropped(raw):
    x, _ = build_features(raw, "Cath")
    assert set(x.columns).isdisjoint(DEAD_COLUMNS)


def test_row_count_and_no_nans_after_encoding(raw):
    x, y = build_features(raw, "Cath")
    assert len(x) == len(y) == 303
    assert not x.isna().any().any()


def test_columns_match_schema_order_and_are_numeric(raw):
    x, _ = build_features(raw, "LAD")
    assert list(x.columns) == list(FEATURE_COLUMNS)
    assert all(pd.api.types.is_numeric_dtype(dtype) for dtype in x.dtypes)


def test_labels_are_binary_with_published_base_rates(raw):
    base_rates = {"Cath": 216, "LAD": 177, "LCX": 119, "RCA": 114}
    for target, positives in base_rates.items():
        _, y = build_features(raw, target)
        assert set(y.unique()) == {0, 1}
        assert y.sum() == positives


def test_sex_and_one_hot_encoding(synthetic_row):
    x = encode_features(synthetic_row).iloc[0]
    assert x["Sex"] == 1
    assert (x["BBB_LBBB"], x["BBB_RBBB"]) == (1, 0)
    assert (x["VHD_mild"], x["VHD_Moderate"], x["VHD_Severe"]) == (1, 0, 0)


def test_derived_values_on_hand_built_frame():
    df = pd.DataFrame({"Neut": [60, 90], "Lymph": [30, 10], "LDL": [100, 130], "TG": [150, 200]})
    out = add_derived_features(df)
    assert out["NLR"].tolist() == [2.0, 9.0]
    assert out["NonHDL"].tolist() == [130.0, 170.0]


def test_unknown_target_raises(raw):
    with pytest.raises(DataError):
        build_features(raw, "Age")


def test_unexpected_label_raises(synthetic_row):
    synthetic_row["Sex"] = "Unknown"
    with pytest.raises(DataError):
        encode_features(synthetic_row)


def test_missing_feature_column_raises(synthetic_row):
    with pytest.raises(DataError):
        encode_features(synthetic_row.drop(columns=["Age"]))
