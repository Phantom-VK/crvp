import type { Predictions, TargetId } from "../api/types";
import { TARGET_INFO, isLowConfidence } from "../data/targets";
import { SCALE_GRADIENT, percent } from "../data/vessels";
import { RiskBar } from "./RiskBar";

interface Props {
  predictions: Predictions;
  selected: TargetId;
  onSelect: (id: TargetId) => void;
}

export function TargetRail({ predictions, selected, onSelect }: Props) {
  return (
    <section className="targets" aria-label="Targets">
      <h2>Targets</h2>
      <ul>
        {TARGET_INFO.map((target) => {
          const prediction = predictions[target.id];
          return (
            <li key={target.id}>
              <button
                type="button"
                className={`target${selected === target.id ? " target--selected" : ""}`}
                aria-pressed={selected === target.id}
                onClick={() => onSelect(target.id)}
              >
                <span className="target__name">
                  <strong>{target.short}</strong>
                  {isLowConfidence(target.id, prediction.cv_roc_auc) && <span className="badge">Low confidence</span>}
                </span>
                <span className="target__value">{percent(prediction.probability)}</span>
                <RiskBar prediction={prediction} withBand={false} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="key">
        <span>0%</span>
        <span className="key__ramp" style={{ background: SCALE_GRADIENT }} />
        <span>100%</span>
      </div>
    </section>
  );
}
