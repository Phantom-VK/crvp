---
title: "CRVP: Coronary Risk Visualisation Platform"
subtitle: "Technical write-up, Multimodal AI Hackathon 2026, Track A"
---

Live demo: <https://crvp.vercel.app> · Code: <https://github.com/Phantom-VK/crvp>

*Where the numbers come from: every model result below is read from `artifacts/metrics.json`, which is committed with the trained weights. Every count about the patients comes from the dataset file itself.*

# 1. Problem and approach

Coronary artery disease (CAD) happens when the arteries that feed the heart muscle become narrowed. The standard test for it is coronary angiography, which is invasive and expensive. CRVP asks a simpler question: how far can ordinary clinical information (age, symptoms, ECG, echo and blood tests) go in estimating who has narrowed arteries?

CRVP takes one patient's clinical record and estimates four probabilities:

- **Overall CAD:** at least one coronary artery is narrowed by 50% or more.
- **LAD, LCX and RCA:** the same question for each of the three main arteries (left anterior descending, left circumflex and right coronary artery).

The probabilities are shown on an interactive 3D heart. For each one, the app shows which inputs raised or lowered it, how much the estimate moves when the model is refitted, and how far it can be trusted.

CRVP is a research prototype for decision support and education. It is **not** a medical device. It does not replace a doctor's judgement or an angiogram, and it must not be used to decide the care of a real patient.

# 2. Data

**Source.** We use the extended Z-Alizadeh Sani dataset from the UCI Machine Learning Repository (dataset 411), released under CC BY 4.0. It describes 303 patients (176 men and 127 women, aged 30 to 86) from a single cardiac centre in Tehran. The file has 59 columns and no missing values. Of these, 52 are inputs, 3 are unusable, and 4 are the answers we predict.

**The four targets.** A target is "positive" when the artery is narrowed by 50% or more. The dataset has the following positives out of 303 patients: overall CAD 216, LAD 177, LCX 119 and RCA 114.

**Dropped columns.** We removed three columns because they carry no usable signal: `Exertional CP` is "no" for all 303 patients, `CHF` is "yes" for only 1 patient, and `LowTH Ang` is "yes" for only 2 patients. A model cannot learn from a column that almost never changes, and explanations built on it would be meaningless.

**Preparation.** Yes/no columns become 0 and 1. The two multi-class columns (bundle branch block and valve disease) become one-hot dummy columns. We add two derived inputs: the neutrophil-to-lymphocyte ratio, and non-HDL cholesterol (LDL plus triglycerides divided by 5). This gives **57 model inputs**. The logistic regression scales its inputs inside its own pipeline. The tree models need no scaling.

**Two columns that are easy to misread.**

- `Region RWMA` is a **severity count** (0 to 4) of how many heart-wall regions move abnormally. It is **not a location**. It cannot tell us which artery is affected.
- `EF-TTE` (ejection fraction from the echo scan) is reported in steps of 5 percentage points, and it stops at 60. Its values run from 15 to 60, with one stray value of 46, and 7 patients sit at the ceiling of 60. We therefore treat it as a coarse scale and never imply 1% precision.

# 3. Leakage control

Leakage means a model gets to see the answer, or something that gives it away, and so looks better than it really is. The four targets are the obvious risk, because overall CAD, LAD, LCX and RCA are closely tied to each other.

**Allow-list design.** The model input is built from a fixed list of 57 named columns (`FEATURE_COLUMNS`). The encoder returns exactly those columns in that order. It drops `Cath`, `LAD`, `LCX` and `RCA` even if they are present. This holds for every model, including when one artery is predicted: for example, the LAD model never sees `LCX`, `RCA` or `Cath`. The prediction service refuses a request that contains a target field and returns an error, and automated tests cover this guard.

**Single-feature audit.** To check that no input secretly gives the answer away, we measured how well each input alone separates positive from negative patients (ROC-AUC, where 0.5 is chance and 1.0 is perfect). The best single input scores 0.80 for overall CAD, 0.73 for LAD, 0.68 for LCX and 0.65 for RCA. In all four cases this is well below 0.90, and the best input is usually `Typical Chest Pain` or `Age`. No single column behaves like a leaked answer.

**Agreement between algorithms.** We trained three different model families on every target. They give similar results, and none of them gets close to a perfect score. This is a weaker check than the two above, because a leaked column would help all three families, so agreement alone cannot prove there is no leak. We use it to confirm that no single algorithm is exploiting something the others cannot. The strong evidence is the allow-list and the single-feature audit. The scores also stay below 0.93 for every algorithm on every target, while a leaked answer would push them towards 1.0.

# 4. Modelling and validation

**Models.** For each of the four targets we compared three algorithms: logistic regression, random forest (300 trees) and gradient boosting (histogram-based, depth 3, 150 rounds). Hyperparameters are fixed in `config.yaml`, and we did not search for better ones.

**Validation.** With only 303 patients, one train/test split would be mostly noise. Each algorithm is therefore scored with **5-fold stratified cross-validation, repeated 5 times**, which gives 25 fits per algorithm per target. Stratified means every fold keeps the same share of positive patients. We report the mean and standard deviation over the 25 held-out folds, with the decision threshold at 0.5.

**Calibration.** Raw model scores are not reliable probabilities. Inside every training fold we therefore fit **Platt calibration** (a sigmoid curve that maps scores to probabilities). Calibration never sees the held-out patients. The final model that the app uses is refitted on all 303 patients.

**Choosing the winner.** We do not simply pick the highest AUC. We use the **one-standard-error rule**: if an algorithm listed earlier (simplest first) scores within one standard error of the best, it wins. A gap of 0.004 on 303 patients is noise and should not decide anything. Random forest was chosen for all four targets.

**Results for the selected model** (mean ± standard deviation over 25 folds):

| Target | Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|:---|:---|---:|---:|---:|---:|---:|
| Overall CAD | Random forest | 0.869 ± 0.042 | 0.894 ± 0.038 | 0.928 ± 0.039 | 0.910 ± 0.029 | 0.922 ± 0.037 |
| LAD | Random forest | 0.791 ± 0.039 | 0.798 ± 0.043 | 0.865 ± 0.057 | 0.828 ± 0.032 | 0.850 ± 0.047 |
| LCX | Random forest | 0.682 ± 0.039 | 0.634 ± 0.082 | 0.467 ± 0.077 | 0.533 ± 0.064 | 0.720 ± 0.064 |
| RCA | Random forest | 0.685 ± 0.052 | 0.640 ± 0.134 | 0.391 ± 0.092 | 0.479 ± 0.094 | 0.705 ± 0.062 |

**All three algorithms compared** (ROC-AUC, mean over 25 folds; the selected one is in bold):

| Target | Logistic regression | Random forest | Gradient boosting |
|:---|---:|---:|---:|
| Overall CAD | 0.901 | **0.922** | 0.903 |
| LAD | 0.795 | **0.850** | 0.817 |
| LCX | 0.651 | **0.720** | 0.724 |
| RCA | 0.688 | **0.705** | 0.702 |

**What the numbers say.**

- Overall CAD and LAD are predicted well (AUC 0.922 and 0.850).
- LCX and RCA are weak (AUC 0.720 and 0.705). At the 0.5 threshold, the selected models find only 47% of narrowed LCX arteries and 39% of narrowed RCA arteries. That means they miss more than half of them. The app marks both as **low confidence**.
- LCX stays between 0.65 and 0.72 AUC for all three algorithm families. When very different algorithms all stop at the same level, the limit is more likely to be in the data than in the model choice.
- The two tree models agree within 0.04 AUC on every target. Logistic regression is lower than random forest on LAD and LCX, by 0.055 and 0.069.
- **Comparison with published work.** Some published studies on this dataset report higher per-artery accuracy than ours. One study reports 82.7% for RCA, 83.7% for LCX and 86.4% for LAD (Alizadehsani et al., *Expert Systems*, 2020, doi:10.1111/exsy.12573), while ours is 68.5%, 68.2% and 79.1%. We did not try to match those figures, and we have not checked how those studies chose their features or split their data, so we cannot say why the numbers differ. We report our own cross-validated results as they are.

# 5. Interpretability

**SHAP explanations.** For each prediction, SHAP (a method that shares a prediction out among the inputs) gives every input a contribution: how much it pushed this patient's score up or down. The contributions are exact, not approximate. The average score plus all the contributions equals the model's raw score, and a test checks this on every run. The app shows the ten largest contributions, plus one row for "all other features", as a waterfall chart in percentage points.

**The calibration step is shown, not hidden.** The raw score is turned into the displayed probability by the fixed calibration curve from section 4. That curve only ever goes up, so a higher total always means a higher risk. The panel says this in a sentence under the chart, so nobody is surprised when the waterfall numbers and the final percentage differ.

**Stability.** A model trained on 303 patients can change when a few patients change. For each prediction we therefore ask all 25 cross-validation models for their answer. The 10th to 90th percentile of their answers is shown as the **likely range**. Each row of the waterfall carries one word that describes how steady its contribution was across those models: "consistent", "varies between refits", or "unstable, read with caution".

**The honesty layer.** These statements are always visible on screen, not hidden in a tooltip:

- No input localises disease to a particular artery, so differences between LAD, LCX and RCA reflect base rates and overall disease burden, not anatomy.
- LCX and RCA carry a "low confidence" badge, with the cross-validated AUC in words.
- Example patients are labelled as real patients from the training set, so their scores are optimistic.
- The 5-point step of `EF-TTE` is explained.
- A clinical disclaimer and the data and mesh attributions are in the footer.

# 6. 3D visualisation and system integration

**Anatomy.** The 3D heart uses meshes from BodyParts3D, each identified by its FMA anatomy code: the heart wall (FMA7274), the aortic and coronary stem (FMA4685), the LAD (FMA3862), the LCX (FMA3895) and the RCA (four mesh files: FMA3802, FMA3818, FMA3840 and FMA76994). The viewer is built with React Three Fiber and drei.

**Making it fast.** The heart wall has 9,822 vertices. Their muscle and fat colours are worked out once, offline, by `scripts/bake_heart_colours.mjs`, and saved as a small 118 KB binary file. The browser only loads this file and does not have to compute the colours when the page opens. The viewer also caps its pixel density to keep drawing light.

**Making it readable.** The heart is turned upright, with the LAD facing the camera. The arteries are lifted 2 mm off the wall, and the selected artery is drawn on top of everything, so it stays visible. Risk is painted on the arteries with a three-step colour scale that we checked for contrast and for colour-blind readers. The user can rotate with the mouse, zoom with the scroll wheel or the buttons, and click an artery or a target to explain it.

**Fallback.** The app ships with six real example patients and their stored predictions. It always opens on one of them, so the viewer, the explanations and the validation panel work even if the prediction service is down. If the service does not answer when the user presses "Estimate risk", the app says so and shows the stored example. It never presents a stored number as if it were a live result. We tested this on the deployed site by blocking the service.

**Architecture.** The frontend (React, three.js, Vite) is hosted on Vercel. The prediction service (FastAPI with the trained weights, which are committed to the repository) runs on one small AWS EC2 instance behind an API Gateway HTTP API, which supplies the HTTPS address the frontend needs. A prediction takes about half a second end to end. The repository contains 143 automated tests, covering the leakage guard, feature encoding, metric computation and the API.

# 7. Limitations

- **Yes/no, not severity.** Every target is "narrowed by 50% or more" versus not. It does not measure how severe a narrowing is.
- **Small data.** There are 303 patients from one centre. The standard deviations in the results table show how much the scores move.
- **No location information.** No input says where in the heart a problem is. Differences between the three arteries come from base rates and overall disease burden.
- **Coarse ejection fraction.** `EF-TTE` is reported in 5-point steps and stops at 60.
- **No external validation.** All results are cross-validation on this one dataset. The winning algorithm was chosen on the same folds that are reported, which makes the results slightly optimistic. We have not tested on patients from another hospital.
- **Weak LCX and RCA models.** They miss more than half of narrowed arteries at the 0.5 threshold.
- **Example patients are in-sample.** The six presets come from the training data, so their scores are optimistic.
- **Published results differ.** Some published studies report higher per-artery accuracy (section 4). We have not reproduced or audited them.
- **Demo API origin rule (a deliberate scope call).** The demo API accepts any `*.vercel.app` origin. It is unauthenticated, read-only and stores nothing, so the origin check is defence in depth rather than a control. A production deployment would pin the origin.
- **Not a medical device.** See section 1.

# 8. Attribution

- BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution-Share Alike 2.1 Japan.
- Mitsuhashi N, et al. BodyParts3D: 3D structure database for anatomical concepts. *Nucleic Acids Research*. 2009;37:D782-5.
- Extended Z-Alizadeh Sani dataset, UCI Machine Learning Repository (dataset 411), CC BY 4.0. Original data description: Alizadehsani R, et al. *Computer Methods and Programs in Biomedicine*. 2013;111(1):52-61.