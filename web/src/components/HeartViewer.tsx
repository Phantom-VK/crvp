import { Bounds, OrbitControls } from "@react-three/drei";
import { Canvas, useLoader } from "@react-three/fiber";
import { Suspense, useMemo, useRef, useState } from "react";
import { MeshStandardMaterial } from "three";
import { HeartWall, HEART_CENTRE } from "./HeartWall";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { VesselId } from "../api/types";
import { CONTEXT_FILES, VESSELS, stlUrl } from "../data/vessels";
import { ArteryMesh } from "./ArteryMesh";
import { CameraRig, type ViewApi } from "./CameraRig";
import { Loading } from "./Loading";
import { ViewTools } from "./ViewTools";

interface HeartViewerProps {
  probabilities: Partial<Record<VesselId, number>>;
  selected: VesselId | null;
  onSelect: (id: VesselId | null) => void;
}

const STEM_MATERIAL = new MeshStandardMaterial({ color: "#b8a99a", roughness: 0.6 });
const ZOOM_STEP = 0.8;

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

// The heart is centred on the origin by Anatomy, then rotated. BodyParts3D is Z-up and its heart lies oblique. This quaternion was computed from the meshes: the
// apex-to-base axis (apex = wall point farthest from the coronary stem) maps to +Y, and the LAD's
// direction from the heart centre, taken perpendicular to that axis, maps to +Z towards the camera.
const HEART_UPRIGHT: [number, number, number, number] = [-0.43164, -0.23273, -0.38365, 0.78252];

function Anatomy({ probabilities, selected, onSelect }: HeartViewerProps) {
  return (
    <group quaternion={HEART_UPRIGHT}>
      <group position={HEART_CENTRE.clone().negate()}>
        <HeartWall />
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
    </group>
  );
}

export function HeartViewer(props: HeartViewerProps) {
  const view = useRef<ViewApi | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  return (
    <div className="viewer">
      <Canvas
        camera={{ position: [0, 0, 240], fov: 35, near: 1, far: 2000 }}
        onPointerMissed={() => props.onSelect(null)}
        dpr={[1, 1.75]}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[120, 160, 200]} intensity={2} />
        <directionalLight position={[-160, -40, -120]} intensity={0.8} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={0.95}>
            <Anatomy {...props} />
            <CameraRig apiRef={view} />
          </Bounds>
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom
          enableDamping
          dampingFactor={0.08}
          minPolarAngle={Math.PI * 0.25}
          maxPolarAngle={Math.PI * 0.75}
          minDistance={90}
          maxDistance={420}
          autoRotate={autoRotate}
          autoRotateSpeed={1.2}
        />
      </Canvas>
      <Loading />
      <ViewTools
        autoRotate={autoRotate}
        onReset={() => view.current?.reset()}
        onZoomIn={() => view.current?.zoom(ZOOM_STEP)}
        onZoomOut={() => view.current?.zoom(1 / ZOOM_STEP)}
        onToggleRotate={() => setAutoRotate((on) => !on)}
      />
    </div>
  );
}
