FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:0.10.10 /uv /usr/local/bin/uv

RUN useradd -m -u 1000 user
USER user
WORKDIR /home/user/app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

COPY --chown=user pyproject.toml uv.lock config.yaml ./
COPY --chown=user src ./src
COPY --chown=user artifacts ./artifacts
RUN uv sync --frozen --no-dev

EXPOSE 7860
CMD ["uv", "run", "--no-sync", "uvicorn", "crvp.api.app:app", "--host", "0.0.0.0", "--port", "7860"]
