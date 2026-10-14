#!/usr/bin/env bash
# Assemble a self-contained Hugging Face Space from the repo.
# Usage: scripts/build_space.sh <output-dir> [docker|gradio]
set -euo pipefail

out="${1:?usage: build_space.sh <output-dir> [docker|gradio]}"
sdk="${2:-gradio}"
root="$(cd "$(dirname "$0")/.." && pwd)"

case "$sdk" in
  docker) template="$root/deploy/space" ;;
  gradio) template="$root/deploy/space-gradio" ;;
  *) echo "unknown sdk: $sdk" >&2; exit 1 ;;
esac

mkdir -p "$out"
rm -rf "$out/src" "$out/artifacts"
cp "$template"/* "$out"/
cp "$root"/config.yaml "$out"/
if [ "$sdk" = docker ]; then cp "$root"/pyproject.toml "$root"/uv.lock "$out"/; fi
cp -r "$root/src" "$root/artifacts" "$out"/
find "$out" -name __pycache__ -type d -prune -exec rm -rf {} +
echo "Space files ($sdk) written to $out"
