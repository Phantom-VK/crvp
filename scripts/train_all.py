from typing import Any

import pandas as pd

from crvp.config import load_config, project_path
from crvp.data.features import build_features
from crvp.data.load import load_dataset
from crvp.data.schema import TARGETS
from crvp.models.artifacts import load_bundle
from crvp.models.evaluate import METRICS
from crvp.models.explain import global_importance
from crvp.models.train import train_all

TOP_FEATURES = 10


def _print_metrics(report: dict[str, Any]) -> None:
    """Print mean +/- std of each metric per target and algorithm."""
    for target, entry in report["targets"].items():
        print(f"\n{target}  (selected: {entry['selected']})")
        print(f"  {'algorithm':24}" + "".join(f"{m:>16}" for m in METRICS))
        for name, stats in entry["algorithms"].items():
            cells = "".join(f"{stats[m]['mean']:>9.3f}±{stats[m]['std']:.3f}" for m in METRICS)
            print(f"  {name:24}{cells}")


def _print_shap_ranking(raw: pd.DataFrame, config: dict[str, Any]) -> None:
    """Print each target's top features by mean |SHAP| for the sanity check."""
    directory = project_path(config["paths"]["artifacts_dir"])
    for target in TARGETS:
        bundle = load_bundle(target, directory)
        x, _ = build_features(raw, target)
        ranking = global_importance(bundle, x).head(TOP_FEATURES)
        print(f"\nTop SHAP features for {target} ({bundle.algorithm})")
        for rank, (feature, value) in enumerate(ranking.items(), start=1):
            print(f"  {rank:2d}. {feature:24}{value:.4f}")


def main() -> None:
    """Train all targets, then print the metrics table and the SHAP sanity ranking."""
    config = load_config()
    raw = load_dataset()
    _print_metrics(train_all(raw, config))
    _print_shap_ranking(raw, config)


if __name__ == "__main__":
    main()
