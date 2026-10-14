export function Honesty() {
  return (
    <section className="honesty" aria-label="How to read these results">
      <h3>How to read these results</h3>
      <ul>
        <li>
          <strong>No input localises disease to an artery.</strong> The model never sees where a narrowing sits. Differences
          between LAD, LCX and RCA reflect how common disease is in each vessel and the patient&apos;s overall disease
          burden, not anatomy. The wall-motion score counts how many regions are abnormal; it does not say which.
        </li>
        <li>
          <strong>The circumflex (LCX) and right coronary (RCA) estimates are weak.</strong> Their cross-validated AUC is
          about 0.70, against about 0.85 for the LAD and 0.92 for any disease. Treat them as a rough prior and read the
          likely range, not the single number.
        </li>
        <li>
          <strong>Ejection fraction is coarse.</strong> It is reported in 5-point steps and tops out at 60, so the model
          cannot distinguish a 60 from a 65.
        </li>
        <li>
          <strong>Trained on 303 patients,</strong> predicting narrowing of 50% or more, not its severity. Example patients
          come from that training set, so their scores are optimistic.
        </li>
      </ul>
    </section>
  );
}
