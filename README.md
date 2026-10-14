# CRVP — Coronary Risk Visualisation Platform

Multimodal AI Hackathon 2026, Track A.

CRVP takes a patient's clinical record (demographics, symptoms, ECG, echo and laboratory
values) and estimates the probability of coronary artery disease (CAD) and of ≥50% stenosis
in each of the three main coronary arteries (LAD, LCX, RCA). The result is shown on an
interactive 3D heart. Each probability comes with a SHAP explanation of which inputs pushed it
up or down, a likely range from 25 cross-validation refits, and a plain statement of how far
it can be trusted.

- **Live API:** https://uh99tuxt1l.execute-api.ap-south-1.amazonaws.com (`/health`, `/predict`)
- **Live demo:** https://crvp.vercel.app
- **Source:** https://github.com/Phantom-VK/crvp
- **Write-up:** [`docs/writeup.pdf`](docs/writeup.pdf) (also as [Markdown](docs/writeup.md))

> **Decision support and education only.** CRVP is a research prototype built for a hackathon.
> It is not a medical device and is not a substitute for clinical judgement or for
> angiography. Do not use it to make decisions about the care of a real patient.

**No input localises disease to an artery.** The dataset has no spatially resolved inputs
(`Region RWMA` is a severity count, not a location). Differences between the LAD, LCX and RCA
estimates reflect base rates and the overall risk pattern, not evidence about where a lesion
sits. LCX and RCA models are weak (AUC ≈ 0.70) and are flagged as low confidence in the UI.

## Prerequisites

- Python 3.14
- [uv](https://docs.astral.sh/uv/)
- Node 20+ and npm

## Setup

```bash
uv sync
uv run python scripts/fetch_data.py     # downloads the UCI dataset into data/ (gitignored)
```

## Train

```bash
uv run python scripts/train_all.py
```

The trained weights (`artifacts/*.joblib`) and the cross-validation report
(`artifacts/metrics.json`) are **committed**, so this step is optional for reviewers; the
backend runs straight from a clone. Training runs 5×5 repeated stratified cross-validation
for three algorithms on each target, selects one per target, refits it on all rows and
writes the weights.

## Run the backend

```bash
uv run uvicorn crvp.api.app:app --port 8000
```

`GET /health` reports readiness. `POST /predict` takes the patient fields and returns the four
probabilities, likely ranges and SHAP contributions.

## Run the frontend

```bash
cd web
npm ci
VITE_API_URL=http://localhost:8000 npm run dev
```

Open http://localhost:5173. Without `VITE_API_URL`, or if the API is unreachable, the app
falls back to six real example patients in `web/public/presets.json`, so every view still
renders. Those patients come from the training set, so their estimates are optimistic and the
UI says so.

### Regenerating assets

After `npm ci`, `node scripts/bake_heart_colours.mjs` rebuilds
`web/public/anatomy/heartwall-colors.bin` (the per-vertex muscle and fat colours of the heart
wall). `uv run python scripts/export_presets.py` rebuilds `web/public/presets.json` from the
trained weights. The "Model & validation" panel reads `web/src/data/metrics.json`, a copy of
`artifacts/metrics.json`; copy it again after retraining.

## Deployment

- **Backend:** one EC2 instance behind an API Gateway HTTP API on AWS, set up as described in
  [`deploy/aws`](deploy/aws/README.md). The weights come from this repo; nothing is retrained.
- **Frontend:** Vercel, root directory `web`, with `VITE_API_URL` set to the API URL.
  Browsers allowed to call the API are listed under `api` in `config.yaml`.

## Tests and lint

```bash
uv run pytest
uv run ruff check . && uv run ruff format --check .
```

## Results

Mean ± standard deviation over 25 folds (5-fold × 5 repeats) of the selected model for each
target, decision threshold 0.5, 303 patients. Full figures for all three algorithms are in
`artifacts/metrics.json`.

| Target | Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|---|---|
| Overall CAD (`Cath`) | random forest | 0.869 ± 0.042 | 0.894 ± 0.038 | 0.928 ± 0.039 | 0.910 ± 0.029 | 0.922 ± 0.037 |
| LAD ≥50% stenosis | random forest | 0.791 ± 0.039 | 0.798 ± 0.043 | 0.865 ± 0.057 | 0.828 ± 0.032 | 0.850 ± 0.047 |
| LCX ≥50% stenosis | random forest | 0.682 ± 0.039 | 0.634 ± 0.082 | 0.467 ± 0.077 | 0.533 ± 0.064 | 0.720 ± 0.064 |
| RCA ≥50% stenosis | random forest | 0.685 ± 0.052 | 0.640 ± 0.134 | 0.391 ± 0.092 | 0.479 ± 0.094 | 0.705 ± 0.062 |

The winner per target is chosen on the same cross-validation that is reported (by the
one-standard-error rule on ROC-AUC), so these figures are mildly optimistic. The displayed
probabilities are sigmoid-calibrated.

## Method notes

- **No leakage.** `Cath`, `LAD`, `LCX` and `RCA` are never model inputs, including when
  predicting another one of them; a test enforces this. Three constant or near-constant
  columns (`Exertional CP`, `CHF`, `LowTH Ang`) are dropped.
- **Binary target.** Each artery label is stenosis ≥50% versus <50%, not graded severity.
- **`EF-TTE`** is ordinal in 5-point steps with a reporting ceiling at 60; the UI does not
  imply 1% precision.
- **Small data.** 303 patients; the LCX and RCA models are weak (AUC ≈ 0.70).

## Attribution and licences

- BodyParts3D, © The Database Center for Life Science, licensed under
  [CC Attribution-Share Alike 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en).
  Mitsuhashi N, et al. BodyParts3D: 3D structure database for anatomical concepts.
  *Nucleic Acids Res.* 2009;37:D782-5.
- Dataset: Extension of the Z-Alizadeh Sani CAD dataset, UCI Machine Learning Repository
  ([dataset 411](https://archive.ics.uci.edu/dataset/411)), licensed CC BY 4.0.
