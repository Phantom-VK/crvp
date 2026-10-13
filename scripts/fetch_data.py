import io
import urllib.request
import zipfile
from pathlib import Path

from crvp.config import load_config, project_path
from crvp.errors import DataError
from crvp.logging import get_logger

logger = get_logger(__name__)


def _download(url: str) -> bytes:
    """Fetch a URL and return the response body."""
    with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310
        return response.read()


def _extract_spreadsheet(archive: bytes, destination: Path) -> Path:
    """Write the single .xlsx member of a zip archive into destination, flattening paths."""
    with zipfile.ZipFile(io.BytesIO(archive)) as zf:
        members = [name for name in zf.namelist() if name.lower().endswith(".xlsx")]
        if len(members) != 1:
            raise DataError(f"Expected exactly one .xlsx in archive, found: {members}")
        target = destination / Path(members[0]).name
        target.write_bytes(zf.read(members[0]))
    return target


def main() -> None:
    """Download the Z-Alizadeh Sani dataset into the configured data directory."""
    config = load_config()
    data_dir = project_path(config["paths"]["data_dir"])
    data_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading %s", config["dataset"]["url"])
    path = _extract_spreadsheet(_download(config["dataset"]["url"]), data_dir)
    logger.info("Saved %s", path)


if __name__ == "__main__":
    main()
