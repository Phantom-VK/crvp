import math

import pytest
from fastapi.testclient import TestClient

from crvp.api.app import create_app
from crvp.api.schemas import payload_from_row
from crvp.config import load_config
from crvp.data.schema import FEATURE_COLUMNS, TARGETS
from crvp.models.train import train_all


@pytest.fixture(scope="module")
def config(tmp_path_factory):
    cfg = load_config()
    cfg["paths"]["artifacts_dir"] = str(tmp_path_factory.mktemp("artifacts"))
    cfg["cv"] = {"n_splits": 3, "n_repeats": 2}
    cfg["calibration"] = {"method": "sigmoid", "cv": 3}
    cfg["models"]["random_forest"].update(n_estimators=20, n_jobs=1)
    cfg["models"]["hist_gradient_boosting"]["max_iter"] = 20
    return cfg


@pytest.fixture(scope="module")
def client(raw, config):
    train_all(raw, config)
    with TestClient(create_app(config)) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def payload(raw):
    return payload_from_row(raw.iloc[0])


def test_health(client):
    body = client.get("/health").json()
    assert body == {"status": "ok", "targets": list(TARGETS)}


def test_predict_returns_four_probabilities_in_unit_interval(client, payload):
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    predictions = response.json()["predictions"]
    assert list(predictions) == list(TARGETS)
    for prediction in predictions.values():
        assert 0.0 <= prediction["probability"] <= 1.0
        assert 0.0 <= prediction["interval_low"] <= prediction["interval_high"] <= 1.0


def test_predict_explains_with_known_features_largest_first(client, payload, config):
    predictions = client.post("/predict", json=payload).json()["predictions"]
    for prediction in predictions.values():
        shown = prediction["contributions"]
        assert len(shown) == config["predict"]["top_contributions"]
        assert {c["feature"] for c in shown} <= set(FEATURE_COLUMNS)
        magnitudes = [abs(c["value"]) for c in shown]
        assert magnitudes == sorted(magnitudes, reverse=True)
        assert all(c["spread"] >= 0 and math.isfinite(c["value"]) for c in shown)


def test_predict_is_deterministic(client, payload):
    first = client.post("/predict", json=payload).json()
    assert client.post("/predict", json=payload).json() == first


@pytest.mark.parametrize(
    "changes", [{"Lymph": 0}, {"DM": 7}, {"Age": -5}, {"Sex": "Fmale"}, {"LAD": 1}, {"Cath": 1}]
)
def test_invalid_input_is_a_422_never_a_prediction(client, payload, changes):
    response = client.post("/predict", json={**payload, **changes})
    assert response.status_code == 422
    assert "predictions" not in response.json()


def test_missing_field_is_a_422(client, payload):
    incomplete = {k: v for k, v in payload.items() if k != "Age"}
    assert client.post("/predict", json=incomplete).status_code == 422


def test_literal_nan_in_the_body_is_a_422(client, payload):
    body = (
        '{"Age": NaN, '
        + ", ".join(f'"{k}": {v!r}'.replace("'", '"') for k, v in payload.items() if k != "Age")
        + "}"
    )
    response = client.post("/predict", content=body, headers={"Content-Type": "application/json"})
    assert response.status_code == 422


def test_cors_allows_vercel_and_blocks_unknown_origins(client):
    def preflight(origin):
        headers = {"Origin": origin, "Access-Control-Request-Method": "POST"}
        return client.options("/predict", headers=headers).headers.get(
            "access-control-allow-origin"
        )

    assert preflight("https://crvp-demo.vercel.app") == "https://crvp-demo.vercel.app"
    assert preflight("http://localhost:5173") == "http://localhost:5173"
    assert preflight("https://evil.example.com") is None
