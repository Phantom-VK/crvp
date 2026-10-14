"""Entry point for a Gradio-SDK Space: serve the FastAPI app directly on the Space port."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

import uvicorn  # noqa: E402

from crvp.api.app import app  # noqa: E402

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
