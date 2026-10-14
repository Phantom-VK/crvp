from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from crvp.api.schemas import PatientFeatures, PredictResponse, to_frame
from crvp.config import load_config
from crvp.data.schema import TARGETS
from crvp.errors import DataError
from crvp.logging import get_logger
from crvp.models.predict import Predictor

logger = get_logger(__name__)


def create_app(config: dict[str, Any] | None = None) -> FastAPI:
    """Build the prediction service.

    Args:
        config: Project configuration. Loaded from ``config.yaml`` when omitted.

    Returns:
        A FastAPI app that loads the trained models on startup.
    """
    config = config or load_config()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.predictor = Predictor.load(config)
        logger.info("Loaded models for %s", ", ".join(TARGETS))
        yield

    app = FastAPI(title="CRVP prediction service", lifespan=lifespan)
    _add_cors(app, config["api"])
    _add_routes(app)
    return app


def _add_cors(app: FastAPI, settings: dict[str, Any]) -> None:
    """Allow the configured front-end origins to call the API."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings["cors_origins"],
        allow_origin_regex=settings["cors_origin_regex"],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )


def _add_routes(app: FastAPI) -> None:
    """Register the health and prediction endpoints."""

    @app.get("/health")
    def health() -> dict[str, Any]:
        """Report that the service is up and which targets it serves."""
        return {"status": "ok", "targets": list(TARGETS)}

    @app.post("/predict", response_model=PredictResponse)
    def predict(patient: PatientFeatures, request: Request) -> dict[str, Any]:
        """Predict CAD and per-vessel stenosis probability for one patient."""
        return {"predictions": request.app.state.predictor.predict(to_frame(patient))}

    @app.exception_handler(RequestValidationError)
    def invalid_request(_: Request, error: RequestValidationError) -> JSONResponse:
        """Report invalid fields without echoing the input, which may not be JSON-safe."""
        detail = [{"loc": e["loc"], "msg": e["msg"], "type": e["type"]} for e in error.errors()]
        return JSONResponse(status_code=422, content={"detail": detail})

    @app.exception_handler(DataError)
    def data_error(_: Request, error: DataError) -> JSONResponse:
        """Report an unencodable patient as a client error."""
        return JSONResponse(status_code=422, content={"detail": str(error)})


app = create_app()
