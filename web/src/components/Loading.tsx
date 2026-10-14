import { useProgress } from "@react-three/drei";

/** Cream-palette progress shown over the canvas while the anatomy meshes load. */
export function Loading() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="loading" role="status">
      <span>Loading anatomy… {Math.round(progress)}%</span>
      <span className="loading__track">
        <span className="loading__fill" style={{ width: `${progress}%` }} />
      </span>
    </div>
  );
}
