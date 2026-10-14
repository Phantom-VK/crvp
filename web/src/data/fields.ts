export type BlockId = "demographic" | "symptom_exam" | "ecg" | "lab" | "echo";

export type FieldKind =
  | { kind: "number"; unit: string; min: number; max: number; step: number }
  | { kind: "flag"; yes: 1 | "Y"; no: 0 | "N" }
  | { kind: "choice"; options: readonly { value: string | number; label: string }[] };

export interface FieldSpec {
  name: string;
  label: string;
  block: BlockId;
  type: FieldKind;
}

export const BLOCKS: { id: BlockId; title: string; note?: string }[] = [
  { id: "demographic", title: "History and risk factors" },
  { id: "symptom_exam", title: "Symptoms and examination" },
  { id: "ecg", title: "ECG" },
  { id: "lab", title: "Laboratory" },
  {
    id: "echo",
    title: "Echocardiography",
    note: "Ejection fraction is reported in 5-point steps and tops out at 60, so the model sees a coarse ordinal value, not a precise measurement.",
  },
];

const binary = (name: string, label: string, block: BlockId): FieldSpec => ({
  name,
  label,
  block,
  type: { kind: "flag", yes: 1, no: 0 },
});
const yesNo = (name: string, label: string, block: BlockId): FieldSpec => ({
  name,
  label,
  block,
  type: { kind: "flag", yes: "Y", no: "N" },
});
const num = (name: string, label: string, block: BlockId, unit: string, min: number, max: number, step = 1): FieldSpec => ({
  name,
  label,
  block,
  type: { kind: "number", unit, min, max, step },
});
const choice = (name: string, label: string, block: BlockId, options: readonly [string | number, string][]): FieldSpec => ({
  name,
  label,
  block,
  type: { kind: "choice", options: options.map(([value, text]) => ({ value, label: text })) },
});

const EF_STEPS = [15, 20, 25, 30, 35, 40, 45, 50, 55, 60] as const;

export const FIELDS: FieldSpec[] = [
  num("Age", "Age", "demographic", "years", 18, 110),
  choice("Sex", "Sex", "demographic", [
    ["Male", "Male"],
    ["Female", "Female"],
  ]),
  num("Weight", "Weight", "demographic", "kg", 20, 250),
  num("Length", "Height", "demographic", "cm", 100, 230),
  num("BMI", "BMI", "demographic", "kg/m²", 10, 80, 0.1),
  binary("DM", "Diabetes", "demographic"),
  binary("HTN", "Hypertension", "demographic"),
  binary("Current Smoker", "Current smoker", "demographic"),
  binary("EX-Smoker", "Ex-smoker", "demographic"),
  binary("FH", "Family history of CAD", "demographic"),
  yesNo("Obesity", "Obesity", "demographic"),
  yesNo("CRF", "Chronic renal failure", "demographic"),
  yesNo("CVA", "Prior stroke", "demographic"),
  yesNo("Airway disease", "Airway disease", "demographic"),
  yesNo("Thyroid Disease", "Thyroid disease", "demographic"),
  yesNo("DLP", "Dyslipidaemia", "demographic"),

  num("BP", "Systolic blood pressure", "symptom_exam", "mmHg", 50, 300),
  num("PR", "Pulse rate", "symptom_exam", "bpm", 20, 250),
  binary("Typical Chest Pain", "Typical chest pain", "symptom_exam"),
  yesNo("Atypical", "Atypical chest pain", "symptom_exam"),
  yesNo("Nonanginal", "Non-anginal chest pain", "symptom_exam"),
  yesNo("Dyspnea", "Dyspnoea", "symptom_exam"),
  choice("Function Class", "Functional class", "symptom_exam", [
    [0, "0"],
    [1, "I"],
    [2, "II"],
    [3, "III"],
  ]),
  binary("Edema", "Oedema", "symptom_exam"),
  yesNo("Weak Peripheral Pulse", "Weak peripheral pulse", "symptom_exam"),
  yesNo("Lung rales", "Lung rales", "symptom_exam"),
  yesNo("Systolic Murmur", "Systolic murmur", "symptom_exam"),
  yesNo("Diastolic Murmur", "Diastolic murmur", "symptom_exam"),

  binary("Q Wave", "Q wave", "ecg"),
  binary("St Elevation", "ST elevation", "ecg"),
  binary("St Depression", "ST depression", "ecg"),
  binary("Tinversion", "T-wave inversion", "ecg"),
  yesNo("LVH", "Left ventricular hypertrophy", "ecg"),
  yesNo("Poor R Progression", "Poor R-wave progression", "ecg"),
  choice("BBB", "Bundle branch block", "ecg", [
    ["N", "None"],
    ["LBBB", "Left"],
    ["RBBB", "Right"],
  ]),

  num("FBS", "Fasting glucose", "lab", "mg/dL", 20, 1000),
  num("CR", "Creatinine", "lab", "mg/dL", 0.1, 20, 0.1),
  num("TG", "Triglycerides", "lab", "mg/dL", 10, 5000),
  num("LDL", "LDL cholesterol", "lab", "mg/dL", 5, 700),
  num("HDL", "HDL cholesterol", "lab", "mg/dL", 5, 250, 0.1),
  num("BUN", "Urea nitrogen", "lab", "mg/dL", 1, 300),
  num("ESR", "ESR", "lab", "mm/h", 0, 200),
  num("HB", "Haemoglobin", "lab", "g/dL", 2, 25, 0.1),
  num("K", "Potassium", "lab", "mEq/L", 1.5, 10, 0.1),
  num("Na", "Sodium", "lab", "mEq/L", 100, 180),
  num("WBC", "White cell count", "lab", "/µL", 500, 100000, 100),
  num("Lymph", "Lymphocytes", "lab", "%", 1, 100),
  num("Neut", "Neutrophils", "lab", "%", 0, 100),
  num("PLT", "Platelets", "lab", "×10³/µL", 5, 2000),

  choice(
    "EF-TTE",
    "Ejection fraction",
    "echo",
    EF_STEPS.map((step) => [step, step === 60 ? "60 or more" : String(step)] as [number, string]),
  ),
  choice("Region RWMA", "Wall-motion abnormality score", "echo", [
    [0, "0 (none)"],
    [1, "1"],
    [2, "2"],
    [3, "3"],
    [4, "4 (extensive)"],
  ]),
  choice("VHD", "Valvular heart disease", "echo", [
    ["N", "None"],
    ["mild", "Mild"],
    ["Moderate", "Moderate"],
    ["Severe", "Severe"],
  ]),
];

export type PatientValues = Record<string, string | number>;

const FEATURE_LABELS: Record<string, string> = {
  ...Object.fromEntries(FIELDS.map((field) => [field.name, field.label])),
  NLR: "Neutrophil-to-lymphocyte ratio",
  NonHDL: "Non-HDL cholesterol",
  BBB_LBBB: "Left bundle branch block",
  BBB_RBBB: "Right bundle branch block",
  VHD_mild: "Mild valve disease",
  VHD_Moderate: "Moderate valve disease",
  VHD_Severe: "Severe valve disease",
};

export const featureLabel = (feature: string): string => FEATURE_LABELS[feature] ?? feature;

export const BLOCK_TITLES: Record<string, string> = {
  ...Object.fromEntries(BLOCKS.map((block) => [block.id, block.title])),
};

/** Human-readable form of one entered value, or null when the feature is derived (ratios, dummies). */
export function describeValue(feature: string, values: PatientValues): string | null {
  const spec = FIELDS.find((field) => field.name === feature);
  const value = values[feature];
  if (!spec || value === undefined || value === "") return null;
  const { type } = spec;
  if (type.kind === "number") return `${value}\u00A0${type.unit}`;
  if (type.kind === "flag") return value === type.yes ? "present" : "absent";
  return type.options.find((option) => option.value === value)?.label ?? String(value);
}
