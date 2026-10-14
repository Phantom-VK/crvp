import { type RefObject } from "react";
import metrics from "../data/metrics.json";
import { TARGET_INFO } from "../data/targets";

interface Props {
  dialogRef: RefObject<HTMLDialogElement | null>;
}

type Stat = { mean: number; std: number };
type Scores = Record<"accuracy" | "precision" | "recall" | "f1" | "roc_auc", Stat>;
type Entry = { selected: string; algorithms: Record<string, Scores> };

const TARGETS = metrics.targets as Record<string, Entry>;
const COLUMNS: { key: keyof Scores; label: string }[] = [
  { key: "accuracy", label: "Accuracy" },
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" },
  { key: "f1", label: "F1" },
  { key: "roc_auc", label: "ROC-AUC" },
];
const ALGORITHM_LABEL: Record<string, string> = {
  logistic_regression: "Logistic regression",
  random_forest: "Random forest",
  hist_gradient_boosting: "Gradient boosting",
};
const AUC_FLOOR = 0.5;

const targetName = (id: string) => TARGET_INFO.find((t) => t.id === id)?.short ?? id;
const plusMinus = (stat: Stat) => `${stat.mean.toFixed(3)} ± ${stat.std.toFixed(3)}`;

function SelectedTable() {
  return (
    <div className="model-table-wrap">
      <table className="model-table">
        <caption>Selected model per target, mean ± standard deviation over 25 held-out folds</caption>
        <thead>
          <tr>
            <th scope="col">Target</th>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(TARGETS).map(([id, entry]) => (
            <tr key={id}>
              <th scope="row">
                {targetName(id)}
                <span>{ALGORITHM_LABEL[entry.selected]}</span>
              </th>
              {COLUMNS.map((column) => (
                <td key={column.key}>{plusMinus(entry.algorithms[entry.selected][column.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AucRows({ id, entry }: { id: string; entry: Entry }) {
  return (
    <div className="auc-group" role="group" aria-label={`${targetName(id)} ROC-AUC by algorithm`}>
      <h4>{targetName(id)}</h4>
      {Object.entries(entry.algorithms).map(([name, scores]) => {
        const auc = scores.roc_auc.mean;
        const chosen = name === entry.selected;
        return (
          <div key={name} className="auc-row" data-chosen={chosen}>
            <span className="auc-row__name">
              {ALGORITHM_LABEL[name]}
              {chosen && <em>selected</em>}
            </span>
            <span className="auc-row__track" aria-hidden="true">
              <span className="auc-row__fill" style={{ width: `${((auc - AUC_FLOOR) / (1 - AUC_FLOOR)) * 100}%` }} />
            </span>
            <span className="auc-row__value">{auc.toFixed(3)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ModelPanel({ dialogRef }: Props) {
  const { n_splits, n_repeats } = metrics.cv;
  return (
    <dialog
      ref={dialogRef}
      className="drawer drawer--wide"
      aria-labelledby="model-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="drawer__head">
        <h2 id="model-title">Model &amp; validation</h2>
        <button type="button" className="secondary" onClick={() => dialogRef.current?.close()}>
          Close
        </button>
      </div>
      <p className="drawer__lead">
        How the models were built and how well they perform on patients they were not trained on. Every figure is read from
        the training report committed with the weights.
      </p>

      <section className="block">
        <SelectedTable />
      </section>

      <section className="block">
        <h3>ROC-AUC across three model families</h3>
        <p className="block__note">
          Bars run from 0.5 (chance) to 1.0. The two tree ensembles agree within 0.04 on every target; logistic regression is
          lower on LAD and LCX, by up to 0.07. The ordering of the targets is the same for every family: coronary disease
          highest, then LAD, then LCX and RCA at about 0.70. No model pulls away from the others and none approaches 1.0,
          which is what a leaked label would produce.
        </p>
        <div className="auc-grid">
          {Object.entries(TARGETS).map(([id, entry]) => (
            <AucRows key={id} id={id} entry={entry} />
          ))}
        </div>
      </section>

      <section className="block">
        <h3>Method</h3>
        <ul className="method">
          <li>
            {n_splits * n_repeats} fits per algorithm per target: {n_splits}-fold stratified cross-validation, repeated{" "}
            {n_repeats}×.
          </li>
          <li>
            The winner is chosen by the one-standard-error rule, not the raw maximum, so a 0.004 difference in AUC does not
            decide anything. It is chosen on the same folds that are reported, so the figures are mildly optimistic.
          </li>
          <li>
            Cath, LAD, LCX and RCA are excluded from the input matrix for every model, including when predicting a different
            one of them.
          </li>
          <li>
            The AUCs sit at the levels this dataset is expected to give (about 0.90 for coronary disease, 0.85 for the LAD,
            0.70 to 0.72 for the LCX and RCA). Values far above that would signal leakage, not success.
          </li>
          <li>
            Targets are binary: stenosis of 50% or more versus less. There are 303 patients and no input says where in the
            heart a lesion is.
          </li>
        </ul>
      </section>
    </dialog>
  );
}
