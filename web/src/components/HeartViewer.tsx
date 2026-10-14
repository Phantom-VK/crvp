import { Bounds, OrbitControls } from "@react-three/drei";
import { Canvas, useLoader } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import { MeshStandardMaterial } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { VesselId } from "../api/types";
import { CONTEXT_FILES, VESSELS, stlUrl } from "../data/vessels";
import { ArteryMesh } from "./ArteryMesh";

interface HeartViewerProps {
  probabilities: Partial<Record<VesselId, number>>;
  selected: VesselId | null;
  onSelect: (id: VesselId | null) => void;
}

const STEM_MATERIAL = new MeshStandardMaterial({ color: "#8a929c", roughness: 0.6 });

function CoronaryStem() {
  const geometries = useLoader(STLLoader, CONTEXT_FILES.map(stlUrl));
  const meshes = useMemo(() => geometries.map((geometry, i) => ({ geometry, key: CONTEXT_FILES[i] })), [geometries]);
  return (
    <>
      {meshes.map(({ geometry, key }) => (
        <mesh key={key} geometry={geometry} material={STEM_MATERIAL} />
      ))}
    </>
  );
}

// BodyParts3D is Z-up with anterior at -Y; rotating -90° about X puts the heart upright, facing the camera.
function Anatomy({ probabilities, selected, onSelect }: HeartViewerProps) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <CoronaryStem />
      {VESSELS.map((vessel) => (
        <ArteryMesh
          key={vessel.id}
          vessel={vessel}
          probability={probabilities[vessel.id] ?? null}
          selected={selected === vessel.id}
          anySelected={selected !== null}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

export function HeartViewer(props: HeartViewerProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 220], fov: 35, near: 1, far: 2000 }}
      onPointerMissed={() => props.onSelect(null)}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[120, 160, 200]} intensity={2.2} />
      <directionalLight position={[-160, -40, -120]} intensity={0.9} />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.25}>
          <Anatomy {...props} />
        </Bounds>
      </Suspense>
      <OrbitControls makeDefault enablePan={false} minDistance={60} maxDistance={400} />
    </Canvas>
  );
}
