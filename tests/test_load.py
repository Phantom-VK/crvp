import pytest

from crvp.data.load import load_dataset
from crvp.data.schema import RAW_COLUMNS
from crvp.errors import DataError


def test_loads_all_patients_and_columns(raw):
    assert raw.shape == (303, 59)
    assert set(raw.columns) == set(RAW_COLUMNS)


def test_missing_file_raises_data_error(tmp_path):
    with pytest.raises(DataError):
        load_dataset(tmp_path / "absent.xlsx")
