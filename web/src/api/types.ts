export type VesselId = "LAD" | "LCX" | "RCA";
export type TargetId = "Cath" | VesselId;

export interface Contribution {
  feature: string;
  block: string;
  value: number;
  spread: number;
}

export interface TargetPrediction {
  algorithm: string;
  probability: number;
  interval_low: number;
  interval_high: number;
  cv_roc_auc: number;
  contributions: Contribution[];
}

export type Predictions = Record<TargetId, TargetPrediction>;

export interface Preset {
  id: string;
  label: string;
  description: string;
  angiography: Record<TargetId, boolean>;
  patient: Record<string, string | number>;
  prediction: { predictions: Predictions };
}

export interface PresetFile {
  note: string;
  presets: Preset[];
}
