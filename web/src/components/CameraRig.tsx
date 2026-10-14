import { useBounds } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { type RefObject, useEffect } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";

export interface ViewApi {
  reset: () => void;
  zoom: (factor: number) => void;
}

export const START_DISTANCE = 240;

/** Exposes reset and zoom to the toolbar outside the canvas. Must render inside drei's Bounds. */
export function CameraRig({ apiRef }: { apiRef: RefObject<ViewApi | null> }) {
  const bounds = useBounds();
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;

  useEffect(() => {
    apiRef.current = {
      reset: () => {
        camera.up.set(0, 1, 0);
        camera.position.set(0, 0, START_DISTANCE);
        controls?.target.set(0, 0, 0);
        controls?.update();
        bounds.refresh().clip().fit();
      },
      zoom: (factor) => {
        if (!controls) return;
        const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor);
        camera.position.copy(controls.target).add(offset);
        controls.update();
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, bounds, camera, controls]);

  return null;
}
