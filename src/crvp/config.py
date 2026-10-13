from pathlib import Path
from typing import Any

import yaml

from crvp.errors import ConfigError

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[2] / "config.yaml"


def load_config(path: Path = DEFAULT_CONFIG_PATH) -> dict[str, Any]:
    """Load the project configuration from a YAML file.

    Args:
        path: Location of the YAML file. Defaults to ``config.yaml`` at the repo root.

    Returns:
        The parsed configuration as a nested dict.

    Raises:
        ConfigError: If the file is missing or does not contain a YAML mapping.
    """
    if not path.is_file():
        raise ConfigError(f"Config file not found: {path}")
    with path.open(encoding="utf-8") as handle:
        config = yaml.safe_load(handle)
    if not isinstance(config, dict):
        raise ConfigError(f"Config file must contain a mapping: {path}")
    return config
