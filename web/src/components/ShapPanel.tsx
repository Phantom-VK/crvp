import type { Contribution, TargetPrediction } from "../api/types";
import { BLOCK_TITLES, type PatientValues, describeValue, featureLabel } from "../data/fields";
import { percent } from "../data/vessels";

interface Props {
  prediction: TargetPrediction;
  patient: PatientValues;
  subject: string;
}

// 5 folds x 5 repeats of cross-validation, each refit on a different subset of the patients.
const REFIT_COUNT = 25;
const CONSISTENT_BELOW = 0.33;
const VARIES_BELOW = 0.75;

type Stability = "consistent" | "varies" | "unstable";

const STABILITY_TEXT: Record<Stability, string> = {
  consistent: "consistent",
  varies: "varies between refits",
  unstable: "unstable — read with caution",
};

/** Turn a contribution's spread across refits into a word, so no one has to read it as an interval. */
function stability(value: number, spread: number): Stability {
  const ratio = spread / Math.max(Math.abs(value), Number.EPSILON);
  if (ratio < CONSISTENT_BELOW) return "consistent";
  return ratio < VARIES_BELOW ? "varies" : "unstable";
}

interface Step {
  key: string;
  label: string;
  caption: string;
  value: number;
  stability: Stability | null;
  start: number;
  end: number;
}

const isProbability = (prediction: TargetPrediction): boolean => prediction.algorithm === "random_forest";

function steps(prediction: TargetPrediction, patient: PatientValues): Step[] {
  let running = prediction.base_value;
  const rows: Omit<Step, "start" | "end">[] = prediction.contributions.map((c: Contribution) => ({
    key: c.feature,
    label: featureLabel(c.feature),
    caption: [describeValue(c.feature, patient), BLOCK_TITLES[c.block]].filter(Boolean).join(" · "),
    value: c.value,
    stability: stability(c.value, c.spread),
  }));
  rows.push({
    key: "other",
    label: "All other features",
    caption: "combined",
    value: prediction.other_features,
    stability: null,
  });
  return rows.map((row) => {
    const step = { ...row, start: running, end: running + row.value };
    running = step.end;
    return step;
  });
}

const signed = (value: number, probability: boolean): string => {
  const scaled = probability ? value * 100 : value;
  const text = Math.abs(scaled).toFixed(probability ? 1 : 2);
  return `${scaled < 0 ? "−" : "+"}${text}${probability ? " pts" : ""}`;
};

const plain = (value: number, probability: boolean): string => (probability ? percent(value) : value.toFixed(2));

function Axis({ domain, probability }: { domain: [number, number]; probability: boolean }) {
  return (
    <li className="shap__row shap__row--axis" aria-hidden="true">
      <span />
      <span className="shap__axis">
        <span>{plain(domain[0], probability)}</span>
        <span>{plain(domain[1], probability)}</span>
      </span>
      <span />
    </li>
  );
}

function Bar({ step, domain }: { step: Step; domain: [number, number] }) {
  const span = domain[1] - domain[0];
  const at = (v: number) => `${((v - domain[0]) / span) * 100}%`;
  const low = Math.min(step.start, step.end);
  const direction = step.value >= 0 ? "raise" : "lower";
  return (
    <span className="shap__plot">
      <span
        className={`shap__bar shap__bar--${direction}`}
        style={{ left: at(low), width: `${(Math.abs(step.value) / span) * 100}%` }}
      />
    </span>
  );
}

export function ShapPanel({ prediction, patient, subject }: Props) {
  const probability = isProbability(prediction);
  const rows = steps(prediction, patient);
  const path = [prediction.base_value, prediction.raw_score, ...rows.flatMap((r) => [r.start, r.end])];
  const pad = (Math.max(...path) - Math.min(...path)) * 0.08;
  const domain: [number, number] = [Math.max(0, Math.min(...path) - pad), Math.max(...path) + pad];
  const at = (v: number) => `${((v - domain[0]) / (domain[1] - domain[0])) * 100}%`;
  return (
    <section className="shap" aria-label="Why the model says this">
      <h3>What moved the estimate</h3>
      <p className="shap__lead">
        Every patient starts at the average risk of {subject} ({plain(prediction.base_value, probability)}). Each factor below
        moves that estimate up or down; the bars show by how much. &lsquo;Consistent&rsquo; means the factor had the same
        effect when the model was refitted on {REFIT_COUNT} different subsets of patients.
      </p>
      <p className="shap__key">
        <span className="shap__item">
          <span className="shap__swatch shap__swatch--raise" aria-hidden="true" />
          raises the estimate (terracotta)
        </span>
        <span className="shap__item">
          <span className="shap__swatch shap__swatch--lower" aria-hidden="true" />
          lowers it (slate blue)
        </span>
        <span className="shap__item">{probability ? "distances in percentage points" : "distances in log-odds"}</span>
      </p>
      <details className="shap__how">
        <summary>How to read this</summary>
        <ul>
          <li>Each bar starts where the previous one ended, so the bars add up from the average patient to the model score.</li>
          <li>The black tick marks a total: the average patient at the top, the model score at the bottom.</li>
          <li>The word at the end of a row says how stable that factor is across refits. Treat an unstable factor as weak evidence.</li>
        </ul>
      </details>
      <ol className="shap__rows">
        <li className="shap__row shap__row--ends">
          <span className="shap__label">
            <strong>Average patient</strong>
          </span>
          <span className="shap__plot">
            <span className="shap__mark" style={{ left: at(prediction.base_value) }} />
          </span>
          <span className="shap__value">{plain(prediction.base_value, probability)}</span>
        </li>
        {rows.map((row) => (
          <li key={row.key} className="shap__row">
            <span className="shap__label">
              <strong>{row.label}</strong>
              <small>{row.caption}</small>
              {row.stability && (
                <span className={`chip chip--${row.stability}`}>{STABILITY_TEXT[row.stability]}</span>
              )}
            </span>
            <Bar step={row} domain={domain} />
            <span className="shap__value">{signed(row.value, probability)}</span>
          </li>
        ))}
        <li className="shap__row shap__row--ends shap__row--total">
          <span className="shap__label">
            <strong>Model score</strong>
          </span>
          <span className="shap__plot">
            <span className="shap__mark" style={{ left: at(prediction.raw_score) }} />
          </span>
          <span className="shap__value">{plain(prediction.raw_score, probability)}</span>
        </li>
        <Axis domain={domain} probability={probability} />
      </ol>
      <p className="shap__calibration">
        <span className="shap__arrow" aria-hidden="true">
          →
        </span>{" "}
        Calibration turns the model score of {plain(prediction.raw_score, probability)} into the{" "}
        <strong>{percent(prediction.probability)}</strong> shown above. These factors add up to the model&apos;s score; the
        calibration curve is a fixed conversion, so a higher total always means higher risk.
      </p>
    </section>
  );
}
