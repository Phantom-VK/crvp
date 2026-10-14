#!/bin/bash
set -eux
exec > >(tee /var/log/crvp-setup.log) 2>&1
dnf install -y git
useradd -m crvp
su - crvp -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'
su - crvp -c 'git clone --depth 1 https://github.com/Phantom-VK/crvp app'
su - crvp -c 'cd app && ~/.local/bin/uv sync --frozen --no-dev'
cat > /etc/systemd/system/crvp.service <<'UNIT'
[Unit]
Description=CRVP API
After=network-online.target
Wants=network-online.target

[Service]
User=crvp
WorkingDirectory=/home/crvp/app
ExecStart=/home/crvp/.local/bin/uv run --no-sync uvicorn crvp.api.app:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now crvp
