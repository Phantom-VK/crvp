import pytest

from crvp.config import load_config
from crvp.errors import ConfigError, CrvpError


def test_default_config_has_cv_settings():
    config = load_config()
    assert config["cv"] == {"n_splits": 5, "n_repeats": 5}


def test_missing_config_raises_config_error(tmp_path):
    with pytest.raises(ConfigError):
        load_config(tmp_path / "absent.yaml")


def test_config_error_is_a_crvp_error():
    assert issubclass(ConfigError, CrvpError)
