import { Html, useCursor } from "@react-three/drei";
import { type ThreeEvent, useLoader } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { type BufferGeometry, BackSide, Box3, type WebGLProgramParametersWithUniforms, Vector3 } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { UNSCORED_COLOUR, UNSELECTED_COLOUR, percent, riskColour, stlUrl, type VesselSpec } from "../data/vessels";
import { smooth } from "./geometry";
import { HEART_CENTRE } from "./HeartWall";

const CLICK_DRAG_TOLERANCE_PX = 4;
const OUTLINE_INK = "#2a2320";
// Coronaries run on the epicardium in fat, not inside the myocardium, so each vessel is lifted off the wall
// mesh. The lift is radial (away from the heart's centre) so the tubes sit on the surface without getting
// fatter; the dark outline hull additionally grows along the vessel's own normals to frame it.
const LIFT_MM = 2;
const OUTLINE_GROWTH_MM = 0.5;
const RECESSED_OPACITY = 0.35;

// Three.js would otherwise treat both closures as one program, hence the explicit cache key.
function liftOffWall(growthMm: number) {
  const [x, y, z] = HEART_CENTRE.toArray().map((v) => v.toFixed(2));
  return {
    onBeforeCompile: (shader: WebGLProgramParametersWithUniforms) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
transformed += normalize(transformed - vec3(${x}, ${y}, ${z})) * ${LIFT_MM.toFixed(2)};
transformed += normalize(objectNormal) * ${growthMm.toFixed(2)};`,
      );
    },
    customProgramCacheKey: () => `lift-${LIFT_MM}-${growthMm}`,
  };
}

const FILL_LIFT = liftOffWall(0);
const OUTLINE_LIFT = liftOffWall(OUTLINE_GROWTH_MM);

interface ArteryMeshProps {
  vessel: VesselSpec;
  probability: number | null;
  selected: boolean;
  anySelected: boolean;
  onSelect: (id: VesselSpec["id"]) => void;
}

function labelAnchor(geometries: BufferGeometry[]): Vector3 {
  const box = new Box3();
  geometries.forEach((geometry) => box.union(new Box3().setFromBufferAttribute(geometry.attributes.position as never)));
  return box.getCenter(new Vector3());
}

export function ArteryMesh({ vessel, probability, selected, anySelected, onSelect }: ArteryMeshProps) {
  const raw = useLoader(STLLoader, vessel.files.map(stlUrl));
  const geometries = useMemo(() => raw.map(smooth), [raw]);
  const anchor = useMemo(() => labelAnchor(geometries), [geometries]);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const recessed = anySelected && !selected && !hovered;
  const riskTint = probability === null ? UNSCORED_COLOUR : riskColour(probability);
  const colour = recessed ? UNSELECTED_COLOUR : riskTint;
  const emphasis = recessed ? 0 : selected ? 0.45 : hovered ? 0.25 : 0.05;
  const opacity = recessed ? RECESSED_OPACITY : 1;
  // The selected vessel ignores depth so it stays visible when the heart is turned away from it.
  const alwaysVisible = selected;

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_DRAG_TOLERANCE_PX) return;
    event.stopPropagation();
    onSelect(vessel.id);
  };

  return (
    <group
      onClick={handleClick}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {geometries.map((geometry, index) => (
        <group key={vessel.files[index]}>
          <mesh geometry={geometry} renderOrder={alwaysVisible ? 3 : 1}>
            <meshStandardMaterial
              color={OUTLINE_INK}
              roughness={1}
              side={BackSide}
              transparent={opacity < 1}
              opacity={opacity}
              depthTest={!alwaysVisible}
              {...OUTLINE_LIFT}
            />
          </mesh>
          <mesh geometry={geometry} renderOrder={alwaysVisible ? 4 : 2}>
            <meshStandardMaterial
              color={colour}
              emissive={colour}
              emissiveIntensity={emphasis}
              roughness={0.5}
              metalness={0.05}
              transparent={opacity < 1}
              opacity={opacity}
              depthTest={!alwaysVisible}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
              {...FILL_LIFT}
            />
          </mesh>
        </group>
      ))}
      <Html position={anchor} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <span className={`vessel-tag${selected ? " vessel-tag--selected" : ""}`}>
          {vessel.id}
          {probability !== null && <strong>{percent(probability)}</strong>}
        </span>
      </Html>
    </group>
  );
}
