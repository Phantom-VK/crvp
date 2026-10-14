import type { Predictions, VesselId } from "../api/types";
import { SCALE_GRADIENT, VESSELS, percent, riskColour } from "../data/vessels";

interface VesselLegendProps {
  predictions: Predictions | null;
  selected: VesselId | null;
  onSelect: (id: VesselId) => void;
}

export function VesselLegend({ predictions, selected, onSelect }: VesselLegendProps) {
  return (
    <section aria-label="Vessel legend" className="legend">
      <ul className="legend__vessels">
        {VESSELS.map((vessel) => {
          const prediction = predictions?.[vessel.id];
          return (
            <li key={vessel.id}>
              <button
                type="button"
                className={`legend__vessel${selected === vessel.id ? " legend__vessel--selected" : ""}`}
                aria-pressed={selected === vessel.id}
                onClick={() => onSelect(vessel.id)}
              >
                <span
                  className="legend__swatch"
                  style={{ background: prediction ? riskColour(prediction.probability) : undefined }}
                />
                <span className="legend__name">
                  <strong>{vessel.id}</strong>
                  <small>{vessel.name}</small>
                </span>
                <span className="legend__value">{prediction ? percent(prediction.probability) : "—"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="legend__scale">
        <div className="legend__ramp" style={{ background: SCALE_GRADIENT }} />
        <div className="legend__ticks">
          <span>0%</span>
          <span>predicted probability of ≥50% stenosis</span>
          <span>100%</span>
        </div>
      </div>
    </section>
  );
}
