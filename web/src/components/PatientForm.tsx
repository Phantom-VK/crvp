import { BLOCKS, FIELDS, type FieldSpec, type PatientValues } from "../data/fields";

interface Props {
  values: PatientValues;
  busy: boolean;
  onChange: (name: string, value: string | number) => void;
  onSubmit: () => void;
}

function NumberInput({ spec, value, onChange }: { spec: FieldSpec; value: string | number; onChange: Props["onChange"] }) {
  if (spec.type.kind !== "number") return null;
  const { min, max, step, unit } = spec.type;
  return (
    <span className="field__control">
      <input
        id={spec.name}
        name={spec.name}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(spec.name, event.target.value)}
      />
      <span className="field__unit">{unit}</span>
    </span>
  );
}

function Control({ spec, value, onChange }: { spec: FieldSpec; value: string | number; onChange: Props["onChange"] }) {
  const { type } = spec;
  if (type.kind === "number") return <NumberInput spec={spec} value={value} onChange={onChange} />;
  if (type.kind === "flag") {
    return (
      <input
        id={spec.name}
        name={spec.name}
        type="checkbox"
        checked={value === type.yes}
        onChange={(event) => onChange(spec.name, event.target.checked ? type.yes : type.no)}
      />
    );
  }
  return (
    <select
      id={spec.name}
      name={spec.name}
      value={String(value)}
      onChange={(event) => {
        const option = type.options.find((candidate) => String(candidate.value) === event.target.value);
        onChange(spec.name, option?.value ?? event.target.value);
      }}
    >
      {type.options.map((option) => (
        <option key={option.value} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Field({ spec, value, onChange }: { spec: FieldSpec; value: string | number; onChange: Props["onChange"] }) {
  return (
    <div className={`field field--${spec.type.kind}`}>
      <label htmlFor={spec.name}>{spec.label}</label>
      <Control spec={spec} value={value} onChange={onChange} />
    </div>
  );
}

export function PatientForm({ values, busy, onChange, onSubmit }: Props) {
  return (
    <form
      className="patient-form"
      noValidate
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {BLOCKS.map((block) => (
        <div key={block.id} className="block" role="group" aria-labelledby={`block-${block.id}`}>
          <h3 id={`block-${block.id}`}>{block.title}</h3>
          {block.note && <p className="block__note">{block.note}</p>}
          <div className="block__fields">
            {FIELDS.filter((spec) => spec.block === block.id).map((spec) => (
              <Field key={spec.name} spec={spec} value={values[spec.name] ?? ""} onChange={onChange} />
            ))}
          </div>
        </div>
      ))}
      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Estimating…" : "Estimate risk"}
      </button>
    </form>
  );
}
