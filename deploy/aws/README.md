# AWS deployment of the API

The API runs on one `t3.small` EC2 instance (`ap-south-1`) behind an API Gateway HTTP API, which
provides the HTTPS URL that a Vercel-hosted frontend needs. The weights are committed to the
repo, so the instance only clones it; nothing is retrained.

1. **Instance.** Amazon Linux 2023, `t3.small` (the API peaks near 600 MB), 12 GB gp3, an
   Elastic IP, and `user-data.sh` as user data. The script clones the repo, runs
   `uv sync --frozen --no-dev` and starts `uvicorn` on port 8000 under systemd.
2. **Security group.** TCP 8000 open to the internet. API Gateway has no fixed address range, and
   the endpoint is a stateless, validated, read-only prediction service. No SSH.
3. **API Gateway.** An HTTP API with one route, `ANY /{proxy+}`, using an `HTTP_PROXY`
   integration to `http://<elastic-ip>:8000/{proxy}` and the `$default` stage.
4. **Frontend.** Set `VITE_API_URL` to the API Gateway URL in Vercel.

CloudFront would be tidier but new AWS accounts must be verified by support before they can
create distributions.

To pick up new code on the instance, replace it: launch a new instance with the same user data
and move the Elastic IP over.

## Teardown

Delete the API Gateway API, terminate the instance, release the Elastic IP and delete the
security group. All of them are tagged `project=crvp`.
