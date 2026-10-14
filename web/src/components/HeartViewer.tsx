import { Bounds, OrbitControls } from "@react-three/drei";
import { Canvas, useLoader } from "@react-three/fiber";
import { Suspense, useMemo, useRef, useState } from "react";
import { DoubleSide, MeshStandardMaterial } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { VesselId } from "../api/types";
import { CONTEXT_FILES, HEART_FILE, VESSELS, stlUrl } from "../data/vessels";
import { ArteryMesh } from "./ArteryMesh";
import { CameraRig, type ViewApi } from "./CameraRig";
import { smooth } from "./geometry";
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

// Context only: not a prediction target, so it has no handlers and never takes part in picking.
function HeartWall() {
  const [raw] = useLoader(STLLoader, [stlUrl(HEART_FILE)]);
  const geometry = useMemo(() => smooth(raw), [raw]);
  return (
    <mesh geometry={geometry} renderOrder={1} raycast={() => null}>
      <meshStandardMaterial
        color="#e3c8b8"
        roughness={0.9}
        metalness={0}
        transparent
        opacity={0.3}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}

// BodyParts3D is Z-up with anterior at -Y; rotating -90° about X puts the heart upright, facing the camera.
function Anatomy({ probabilities, selected, onSelect }: HeartViewerProps) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
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
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[120, 160, 200]} intensity={2} />
        <directionalLight position={[-160, -40, -120]} intensity={0.8} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.15}>
            <Anatomy {...props} />
            <CameraRig apiRef={view} />
          </Bounds>
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={false}
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
