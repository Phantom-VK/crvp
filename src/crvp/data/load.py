from pathlib import Path

import pandas as pd

from crvp.config import load_config, project_path
from crvp.data.schema import RAW_COLUMNS
from crvp.errors import DataError


def default_dataset_path() -> Path:
    """Return the configured location of the dataset spreadsheet.

    Returns:
        Absolute path to the Z-Alizadeh Sani workbook.
    """
    config = load_config()
    return project_path(config["paths"]["data_dir"]) / config["dataset"]["filename"]


def load_dataset(path: Path | None = None) -> pd.DataFrame:
    """Read the Z-Alizadeh Sani workbook into a DataFrame, unmodified.

    Args:
        path: Workbook location. Defaults to the configured dataset path.

    Returns:
        One row per patient with the 59 raw columns.

    Raises:
        DataError: If the file is missing or lacks any expected column.
    """
    path = path or default_dataset_path()
    if not path.is_file():
        raise DataError(f"Dataset not found at {path}; run scripts/fetch_data.py")
    df = pd.read_excel(path, sheet_name=0)
    missing = sorted(set(RAW_COLUMNS) - set(df.columns))
    if missing:
        raise DataError(f"Dataset is missing expected columns: {missing}")
    return df
