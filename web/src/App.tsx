import { useState } from "react";
import type { Predictions, TargetId, VesselId } from "./api/types";
import { Attribution } from "./components/Attribution";
import { Disclaimer } from "./components/Disclaimer";
import { HeartViewer } from "./components/HeartViewer";
import { Honesty } from "./components/Honesty";
import { PatientForm } from "./components/PatientForm";
import { RiskSummary } from "./components/RiskSummary";
import { ShapPanel } from "./components/ShapPanel";
import { type Origin, usePatient } from "./hooks/usePatient";

const EXPLAINED_TITLE: Record<TargetId, string> = {
  Cath: "the model estimates coronary disease",
  LAD: "the model estimates LAD narrowing",
  LCX: "the model estimates LCX narrowing",
  RCA: "the model estimates RCA narrowing",
};

const ORIGIN_TEXT: Record<Origin, string> = {
  stored: "Stored result for this example patient. Real patients from the training set, so these scores are optimistic.",
  live: "Calculated just now by the prediction service for the values in the form below.",
  fallback: "Prediction service unavailable.",
  stale: "Inputs edited.",
};

function vesselProbabilities(predictions: Predictions | null) {
  if (!predictions) return {};
  return { LAD: predictions.LAD.probability, LCX: predictions.LCX.probability, RCA: predictions.RCA.probability };
}

export function App() {
  const patient = usePatient();
  const [selected, setSelected] = useState<TargetId | null>(null);
  const explained: TargetId = selected ?? "Cath";
  const vessel: VesselId | null = selected && selected !== "Cath" ? selected : null;
  const { predictions } = patient;

  return (
    <div className="app">
      <a className="skip" href="#patient-data">
        Skip to patient data
      </a>
      <header className="masthead">
        <h1>CRVP</h1>
        <p>Coronary disease and per-vessel stenosis estimates from clinical data</p>
      </header>

      <section className="example" aria-label="Example patient">
        <label>
          <span>Example patient</span>
          <select value={patient.presetId} onChange={(event) => patient.choosePreset(event.target.value)}>
            {patient.presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <p className="example__status" data-origin={patient.origin} aria-live="polite">
          {ORIGIN_TEXT[patient.origin]}
        </p>
        <div aria-live="polite" className="example__notice-slot">
          {patient.notice && <p className="example__notice">{patient.notice}</p>}
        </div>
      </section>

      <main className="stage">
        <div className="viewer">
          <HeartViewer
            probabilities={vesselProbabilities(predictions)}
            selected={vessel}
            onSelect={setSelected}
          />
          <p className="viewer__hint">Drag to rotate · click a vessel</p>
        </div>
        {predictions && <RiskSummary predictions={predictions} selected={selected} onSelect={setSelected} />}
      </main>

      {predictions && (
        <ShapPanel title={EXPLAINED_TITLE[explained]} prediction={predictions[explained]} patient={patient.values} />
      )}
      <Honesty />

      <section className="inputs" id="patient-data" aria-label="Patient data">
        <h2>Patient data</h2>
        <p>Edit any value and press Estimate risk. Field names follow the published dataset.</p>
        <PatientForm values={patient.values} busy={patient.busy} onChange={patient.edit} onSubmit={patient.submit} />
      </section>

      <Disclaimer />
      <Attribution />
    </div>
  );
}
