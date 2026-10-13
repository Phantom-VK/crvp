class CrvpError(Exception):
    """Base class for all CRVP errors."""


class DataError(CrvpError):
    """Raised when the dataset is missing, malformed or fails validation."""


class ModelError(CrvpError):
    """Raised when a model cannot be trained, loaded or evaluated."""


class ConfigError(CrvpError):
    """Raised when config.yaml is missing or invalid."""
