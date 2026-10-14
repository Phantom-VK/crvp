import { useCallback, useEffect, useState } from "react";
import { PredictionError, predict } from "../api/client";
import type { Predictions, Preset, PresetFile } from "../api/types";
import { FIELDS, type PatientValues } from "../data/fields";

const PRESETS_URL = `${import.meta.env.BASE_URL}presets.json`;

export type Origin = "stored" | "live" | "fallback" | "stale";

export interface PatientState {
  presets: Preset[];
  presetId: string;
  values: PatientValues;
  predictions: Predictions | null;
  origin: Origin;
  notice: string | null;
  busy: boolean;
  choosePreset: (id: string) => void;
  edit: (name: string, value: string | number) => void;
  submit: () => void;
}

function toRequest(values: PatientValues): PatientValues {
  const body: PatientValues = { ...values };
  for (const spec of FIELDS) {
    if (spec.type.kind !== "number") continue;
    const parsed = Number(values[spec.name]);
    if (values[spec.name] === "" || Number.isNaN(parsed)) throw new PredictionError(`Enter a value for ${spec.label}.`);
    body[spec.name] = parsed;
  }
  return body;
}

export function usePatient(): PatientState {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetId, setPresetId] = useState("");
  const [values, setValues] = useState<PatientValues>({});
  const [predictions, setPredictions] = useState<Predictions | null>(null);
  const [origin, setOrigin] = useState<Origin>("stored");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choosePreset = useCallback(
    (id: string) => {
      const preset = presets.find((candidate) => candidate.id === id);
      if (!preset) return;
      setPresetId(id);
      setValues({ ...preset.patient });
      setPredictions(preset.prediction.predictions);
      setOrigin("stored");
      setNotice(null);
    },
    [presets],
  );

  useEffect(() => {
    fetch(PRESETS_URL)
      .then((response) => response.json() as Promise<PresetFile>)
      .then((file) => setPresets(file.presets))
      .catch(() => setNotice("The example patients could not be loaded."));
  }, []);

  useEffect(() => {
    if (presets.length && !presetId) choosePreset(presets[0].id);
  }, [presets, presetId, choosePreset]);

  const edit = (name: string, value: string | number) => {
    setValues((current) => ({ ...current, [name]: value }));
    setOrigin("stale");
    setNotice("Inputs changed. The results below are for the previous values until you press Estimate risk.");
  };

  const submit = async () => {
    setBusy(true);
    try {
      setPredictions(await predict(toRequest(values)));
      setOrigin("live");
      setNotice(null);
    } catch (error) {
      const reason = error instanceof PredictionError ? error.message : "Something went wrong.";
      const stored = presets.find((candidate) => candidate.id === presetId);
      if (stored) setPredictions(stored.prediction.predictions);
      setOrigin("fallback");
      setNotice(`${reason} Showing the stored result for the selected example, which does not reflect any edits.`);
    } finally {
      setBusy(false);
    }
  };

  return { presets, presetId, values, predictions, origin, notice, busy, choosePreset, edit, submit };
}
