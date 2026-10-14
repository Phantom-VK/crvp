import type { TargetPrediction } from "../api/types";
import { percent, riskColour } from "../data/vessels";

/** Probability bar in the risk ramp, with the likely range as a thin line beneath. */
export function RiskBar({ prediction, withBand = true }: { prediction: TargetPrediction; withBand?: boolean }) {
  const { probability, interval_low: low, interval_high: high } = prediction;
  return (
    <span className="bar" role="img" aria-label={`${percent(probability)}, likely range ${percent(low)} to ${percent(high)}`}>
      <span className="bar__track">
        <span className="bar__fill" style={{ width: `${probability * 100}%`, background: riskColour(probability) }} />
      </span>
      {withBand && <span className="bar__band" style={{ left: `${low * 100}%`, width: `${Math.max(high - low, 0.005) * 100}%` }} />}
    </span>
  );
}
