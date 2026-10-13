TARGETS = ("Cath", "LAD", "LCX", "RCA")

# Cath is the overall angiography verdict (CAD = >=50% stenosis); the others are per artery.
TARGET_POSITIVE_LABEL = {"Cath": "CAD", "LAD": "Stenotic", "LCX": "Stenotic", "RCA": "Stenotic"}

# Constant or near-constant (303/303, 302/1, 301/2): unlearnable and meaningless under SHAP.
DEAD_COLUMNS = ("Exertional CP", "CHF", "LowTH Ang")

# The source file spells the female label "Fmale".
SEX_MAP = {"Fmale": 0, "Male": 1}
YN_MAP = {"N": 0, "Y": 1}

NUMERIC_COLUMNS = (
    "Age", "Weight", "Length", "BMI", "BP", "PR", "Function Class",
    "FBS", "CR", "TG", "LDL", "HDL", "BUN", "ESR", "HB", "K", "Na", "WBC", "Lymph", "Neut", "PLT",
    "EF-TTE", "Region RWMA",
)  # fmt: skip

BINARY_COLUMNS = (
    "DM", "HTN", "Current Smoker", "EX-Smoker", "FH", "Edema", "Typical Chest Pain",
    "Q Wave", "St Elevation", "St Depression", "Tinversion",
)  # fmt: skip

YN_COLUMNS = (
    "Obesity", "CRF", "CVA", "Airway disease", "Thyroid Disease", "DLP",
    "Weak Peripheral Pulse", "Lung rales", "Systolic Murmur", "Diastolic Murmur",
    "Dyspnea", "Atypical", "Nonanginal", "LVH", "Poor R Progression",
)  # fmt: skip

# The first level of each column is the reference category and gets no dummy.
ONE_HOT_LEVELS = {
    "BBB": ("N", "LBBB", "RBBB"),
    "VHD": ("N", "mild", "Moderate", "Severe"),
}

RAW_FEATURE_COLUMNS = (*NUMERIC_COLUMNS, *BINARY_COLUMNS, *YN_COLUMNS, "Sex", *ONE_HOT_LEVELS)
RAW_COLUMNS = (*RAW_FEATURE_COLUMNS, *DEAD_COLUMNS, *TARGETS)


def dummy_names(column: str) -> tuple[str, ...]:
    """Return the dummy column names produced by one-hot encoding a column.

    Args:
        column: A key of ``ONE_HOT_LEVELS``.

    Returns:
        One name per non-reference level, in level order.
    """
    return tuple(f"{column}_{level}" for level in ONE_HOT_LEVELS[column][1:])


# The five blocks the dashboard groups inputs under.
FEATURE_BLOCKS = {
    "demographic": (
        "Age", "Weight", "Length", "Sex", "BMI", "DM", "HTN", "Current Smoker", "EX-Smoker",
        "FH", "Obesity", "CRF", "CVA", "Airway disease", "Thyroid Disease", "DLP",
    ),
    "symptom_exam": (
        "BP", "PR", "Edema", "Weak Peripheral Pulse", "Lung rales", "Systolic Murmur",
        "Diastolic Murmur", "Typical Chest Pain", "Atypical", "Nonanginal", "Dyspnea",
        "Function Class",
    ),
    "ecg": (
        "Q Wave", "St Elevation", "St Depression", "Tinversion", "LVH", "Poor R Progression",
        *dummy_names("BBB"),
    ),
    "lab": (
        "FBS", "CR", "TG", "LDL", "HDL", "BUN", "ESR", "HB", "K", "Na", "WBC", "Lymph", "Neut",
        "PLT", "NLR", "NonHDL",
    ),
    "echo": ("EF-TTE", "Region RWMA", *dummy_names("VHD")),
}  # fmt: skip

FEATURE_COLUMNS = tuple(name for block in FEATURE_BLOCKS.values() for name in block)
