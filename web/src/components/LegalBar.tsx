import { Attribution } from "./Attribution";
import { Disclaimer } from "./Disclaimer";

export function LegalBar() {
  return (
    <footer className="legalbar">
      <p className="legalbar__caveat">
        <strong>No input localises disease to an artery.</strong> Differences between LAD, LCX and RCA reflect base rates
        and overall disease burden, not anatomy.
      </p>
      <Disclaimer />
      <Attribution />
    </footer>
  );
}
