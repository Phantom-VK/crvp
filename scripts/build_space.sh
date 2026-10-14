#!/usr/bin/env bash
# Assemble a self-contained Hugging Face Space (Docker SDK) from the repo.
# Usage: scripts/build_space.sh <output-dir>
set -euo pipefail

out="${1:?usage: build_space.sh <output-dir>}"
root="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$out"
cp "$root"/deploy/space/Dockerfile "$root"/deploy/space/README.md "$out"/
cp "$root"/pyproject.toml "$root"/uv.lock "$root"/config.yaml "$out"/
rm -rf "$out/src" "$out/artifacts"
cp -r "$root/src" "$root/artifacts" "$out"/
find "$out" -name __pycache__ -type d -prune -exec rm -rf {} +
echo "Space files written to $out"
