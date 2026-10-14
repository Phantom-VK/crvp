import type { Predictions, TargetId, TargetPrediction } from "../api/types";
import { LOW_CONFIDENCE_AUC, SCALE_GRADIENT, percent, riskColour } from "../data/vessels";

interface Props {
  predictions: Predictions;
  selected: TargetId | null;
  onSelect: (id: TargetId) => void;
}

const ROWS: { id: TargetId; title: string; subtitle: string }[] = [
  { id: "Cath", title: "Any coronary disease", subtitle: "At least one artery narrowed 50% or more" },
  { id: "LAD", title: "LAD", subtitle: "Left anterior descending" },
  { id: "LCX", title: "LCX", subtitle: "Left circumflex" },
  { id: "RCA", title: "RCA", subtitle: "Right coronary artery" },
];

function Bar({ prediction }: { prediction: TargetPrediction }) {
  const { probability, interval_low: low, interval_high: high } = prediction;
  return (
    <span className="bar" role="img" aria-label={`${percent(probability)}, likely range ${percent(low)} to ${percent(high)}`}>
      <span className="bar__track">
        <span className="bar__fill" style={{ width: `${probability * 100}%`, background: riskColour(probability) }} />
      </span>
      <span className="bar__band" style={{ left: `${low * 100}%`, width: `${Math.max(high - low, 0.005) * 100}%` }} />
    </span>
  );
}

interface RowProps {
  row: (typeof ROWS)[number];
  prediction: TargetPrediction;
  selected: boolean;
  onSelect: () => void;
}

function Row({ row, prediction, selected, onSelect }: RowProps) {
  const weak = row.id !== "Cath" && prediction.cv_roc_auc < LOW_CONFIDENCE_AUC;
  return (
    <li>
      <button type="button" className={`risk__row${selected ? " risk__row--selected" : ""}`} aria-pressed={selected} onClick={onSelect}>
        <span className="risk__name">
          <strong>{row.title}</strong>
          <small>{row.subtitle}</small>
        </span>
        <Bar prediction={prediction} />
        <span className="risk__value">{percent(prediction.probability)}</span>
        <span className="risk__meta">
          Likely range {percent(prediction.interval_low)}–{percent(prediction.interval_high)} · cross-validated AUC{" "}
          {prediction.cv_roc_auc.toFixed(2)}
          {weak && <span className="badge">Low confidence</span>}
        </span>
      </button>
    </li>
  );
}

export function RiskSummary({ predictions, selected, onSelect }: Props) {
  return (
    <section className="risk" aria-label="Estimated risk">
      <h2>Estimated probability of significant stenosis</h2>
      <ul>
        {ROWS.map((row) => (
          <Row
            key={row.id}
            row={row}
            prediction={predictions[row.id]}
            selected={selected === row.id}
            onSelect={() => onSelect(row.id)}
          />
        ))}
      </ul>
      <div className="risk__key">
        <span>0%</span>
        <span className="risk__ramp" style={{ background: SCALE_GRADIENT }} />
        <span>100%</span>
      </div>
      <p className="risk__note">
        The bar shows the estimate; the thin line beneath is the middle 80% of answers from 25 refits of the model on different subsets of the patients.
        The 3D colours use the same scale.
      </p>
    </section>
  );
}
