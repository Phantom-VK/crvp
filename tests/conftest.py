import pandas as pd
import pytest

from crvp.data.load import default_dataset_path, load_dataset
from crvp.data.schema import (
    BINARY_COLUMNS,
    DEAD_COLUMNS,
    NUMERIC_COLUMNS,
    YN_COLUMNS,
)


@pytest.fixture(scope="session")
def raw() -> pd.DataFrame:
    if not default_dataset_path().is_file():
        pytest.skip("dataset not downloaded; run scripts/fetch_data.py")
    return load_dataset()


@pytest.fixture
def synthetic_row() -> pd.DataFrame:
    """One valid raw patient, including targets and dead columns, with no data file needed."""
    row = {column: 1.0 for column in NUMERIC_COLUMNS}
    row.update({column: 0 for column in BINARY_COLUMNS})
    row.update({column: "N" for column in YN_COLUMNS})
    row.update({"Sex": "Male", "BBB": "LBBB", "VHD": "mild"})
    row.update({column: "N" for column in DEAD_COLUMNS})
    row.update({"Cath": "CAD", "LAD": "Stenotic", "LCX": "Normal", "RCA": "Stenotic"})
    return pd.DataFrame([row])
