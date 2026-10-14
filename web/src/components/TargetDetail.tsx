import type { TargetId, TargetPrediction } from "../api/types";
import { TARGET_INFO, confidenceNote, isLowConfidence } from "../data/targets";
import type { PatientValues } from "../data/fields";
import { percent } from "../data/vessels";
import { RiskBar } from "./RiskBar";
import { ShapPanel } from "./ShapPanel";

interface Props {
  id: TargetId;
  prediction: TargetPrediction;
  patient: PatientValues;
  example: boolean;
}

export function TargetDetail({ id, prediction, patient, example }: Props) {
  const info = TARGET_INFO.find((target) => target.id === id) ?? TARGET_INFO[0];
  const note = confidenceNote(prediction.cv_roc_auc);
  return (
    <section className="selected" aria-label={`${info.title} detail`}>
      <p className="kicker">
        {info.short}
        {example && <span className="badge badge--example">Example patient</span>}
      </p>
      <h2>{info.title}</h2>
      <p className="selected__value">{percent(prediction.probability)}</p>
      <RiskBar prediction={prediction} />
      <p className="selected__range">
        Likely range {percent(prediction.interval_low)}–{percent(prediction.interval_high)}. Probability {info.question}.
      </p>
      <p className="selected__confidence">
        <strong>{note.label}.</strong> {note.text}
        {isLowConfidence(id, prediction.cv_roc_auc) && <span className="badge">Low confidence</span>}
      </p>
      <ShapPanel prediction={prediction} patient={patient} />
    </section>
  );
}
