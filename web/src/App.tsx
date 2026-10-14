import { useRef, useState } from "react";
import type { Predictions, TargetId, VesselId } from "./api/types";
import { HeartViewer } from "./components/HeartViewer";
import { Honesty } from "./components/Honesty";
import { LegalBar } from "./components/LegalBar";
import { PatientDrawer } from "./components/PatientDrawer";
import { TargetDetail } from "./components/TargetDetail";
import { TargetRail } from "./components/TargetRail";
import { TopBar } from "./components/TopBar";
import { type Origin, usePatient } from "./hooks/usePatient";

const ORIGIN_TEXT: Record<Origin, string> = {
  stored: "Stored result for this example. These are real patients from the training set, so the scores are optimistic.",
  live: "Calculated just now by the prediction service for the values in Patient data.",
  fallback: "Prediction service unavailable.",
  stale: "Inputs edited. Press Estimate risk to update.",
};

function vesselProbabilities(predictions: Predictions | null) {
  if (!predictions) return {};
  return { LAD: predictions.LAD.probability, LCX: predictions.LCX.probability, RCA: predictions.RCA.probability };
}

export function App() {
  const patient = usePatient();
  const [selected, setSelected] = useState<TargetId>("Cath");
  const drawer = useRef<HTMLDialogElement>(null);
  const { predictions } = patient;
  const vessel: VesselId | null = selected === "Cath" ? null : selected;

  const estimate = async () => {
    await patient.submit();
    drawer.current?.close();
  };

  return (
    <div className="shell">
      <TopBar busy={patient.busy} onOpenData={() => drawer.current?.showModal()} onEstimate={estimate} />

      <div className="workspace">
        <aside className="rail" aria-label="Patient and targets">
          <label className="preset">
            <span>Example patient</span>
            <select value={patient.presetId} onChange={(event) => patient.choosePreset(event.target.value)}>
              {patient.presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <p className="rail__status" data-origin={patient.origin} aria-live="polite">
            {ORIGIN_TEXT[patient.origin]}
          </p>
          <div aria-live="polite">{patient.notice && <p className="rail__notice">{patient.notice}</p>}</div>
          {predictions && <TargetRail predictions={predictions} selected={selected} onSelect={setSelected} />}
        </aside>

        <main className="canvas">
          <HeartViewer
            probabilities={vesselProbabilities(predictions)}
            selected={vessel}
            onSelect={(id) => setSelected(id ?? "Cath")}
          />
          <p className="canvas__hint">Drag to rotate. Click a vessel or a target to explain it.</p>
        </main>

        <aside className="detail" aria-label="Selected target">
          {predictions && <TargetDetail id={selected} prediction={predictions[selected]} patient={patient.values} />}
          <Honesty />
        </aside>
      </div>

      <LegalBar />
      <PatientDrawer
        dialogRef={drawer}
        values={patient.values}
        busy={patient.busy}
        onChange={patient.edit}
        onSubmit={estimate}
      />
    </div>
  );
}
