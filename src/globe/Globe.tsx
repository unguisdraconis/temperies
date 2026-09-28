import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { DisplayMode, FramePair, HoveredCell, LegendSelection, ProjectionMode, TemperaturePalette, TemperatureRenderStyle, VectorLayerVisibility } from '../climate/types';
import { TemperatureSphere } from './TemperatureSphere';
import { VectorLayers } from './VectorLayers';
import { advanceProjectionMix, easeProjectionMix, GLOBE_INITIAL_ROTATION, PROJECTION_TRANSITION_SECONDS, projectionTarget } from './projection';

interface Props {
  frames: FramePair; mask: Uint8Array; mode: DisplayMode; renderStyle: TemperatureRenderStyle; palette: TemperaturePalette; highlight: LegendSelection | null;
  projectionMode: ProjectionMode; vectorLayers: VectorLayerVisibility; reducedMotion: boolean;
  onHover: (cell: HoveredCell) => void; onLeave: () => void;
}

type OrbitControlsInstance = ComponentRef<typeof OrbitControls>;
interface SceneProps extends Props { controlsRef: { current: OrbitControlsInstance | null } }

const CAMERA_HOME = new THREE.Vector3(0, 0.18, 2.55);
const TARGET_HOME = new THREE.Vector3(0, 0, 0);

function ProjectionScene({ frames, mask, mode, renderStyle, palette, highlight, projectionMode, vectorLayers, reducedMotion, onHover, onLeave, controlsRef }: SceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const initialProjection = useRef(projectionTarget(projectionMode));
  const projectionMix = useRef(initialProjection.current);
  const projectionTargetRef = useRef(projectionTarget(projectionMode));
  const cameraStart = useRef(CAMERA_HOME.clone());
  const targetStart = useRef(TARGET_HOME.clone());
  const cameraProgress = useRef(1);
  const camera = useThree((state) => state.camera);

  useLayoutEffect(() => {
    projectionTargetRef.current = projectionTarget(projectionMode);
    cameraStart.current.copy(camera.position);
    targetStart.current.copy(controlsRef.current?.target ?? TARGET_HOME);
    cameraProgress.current = reducedMotion ? 1 : 0;
    if (reducedMotion) {
      projectionMix.current = projectionTargetRef.current;
      camera.position.copy(CAMERA_HOME);
      if (controlsRef.current) {
        controlsRef.current.target.copy(TARGET_HOME);
        controlsRef.current.update();
      } else camera.lookAt(TARGET_HOME);
    }
  }, [camera, controlsRef, projectionMode, reducedMotion]);

  useFrame((_, delta) => {
    projectionMix.current = advanceProjectionMix(projectionMix.current, projectionTargetRef.current, delta, reducedMotion);
    const easedProjection = easeProjectionMix(projectionMix.current);
    if (groupRef.current) {
      groupRef.current.rotation.x = GLOBE_INITIAL_ROTATION.x * (1 - easedProjection);
      groupRef.current.rotation.y = GLOBE_INITIAL_ROTATION.y * (1 - easedProjection);
    }
    if (cameraProgress.current < 1) {
      cameraProgress.current = Math.min(1, cameraProgress.current + delta / PROJECTION_TRANSITION_SECONDS);
      const easedCamera = easeProjectionMix(cameraProgress.current);
      camera.position.lerpVectors(cameraStart.current, CAMERA_HOME, easedCamera);
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(targetStart.current, TARGET_HOME, easedCamera);
        controlsRef.current.update();
      } else camera.lookAt(TARGET_HOME);
    }
  });

  return <group ref={groupRef} rotation={[
    GLOBE_INITIAL_ROTATION.x * (1 - initialProjection.current),
    GLOBE_INITIAL_ROTATION.y * (1 - initialProjection.current),
    0,
  ]}>
    <TemperatureSphere frames={frames} mask={mask} mode={mode} renderStyle={renderStyle} palette={palette} highlight={highlight}
      projectionMode={projectionMode} projectionMix={projectionMix} onHover={onHover} onLeave={onLeave} />
    <VectorLayers {...vectorLayers} projectionMix={projectionMix} />
  </group>;
}

export function Globe(props: Props) {
  const controlsRef = useRef<OrbitControlsInstance>(null);
  const previousProjection = useRef(props.projectionMode);
  const [controlsLocked, setControlsLocked] = useState(false);

  useEffect(() => {
    const changed = previousProjection.current !== props.projectionMode;
    previousProjection.current = props.projectionMode;
    if (!changed || props.reducedMotion) {
      setControlsLocked(false);
      return;
    }
    setControlsLocked(true);
    const timer = window.setTimeout(() => setControlsLocked(false), PROJECTION_TRANSITION_SECONDS * 1000 + 80);
    return () => window.clearTimeout(timer);
  }, [props.projectionMode, props.reducedMotion]);

  return <Canvas aria-label={props.projectionMode === 'globe' ? 'Interactive temperature globe' : 'Interactive Plate Carrée temperature map'}
    fallback={<div className="webgl-error" role="alert">WebGL is unavailable in this browser.</div>}
    camera={{ position: CAMERA_HOME.toArray(), fov: 39 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }}>
    <ambientLight intensity={0.6} />
    {!props.reducedMotion && <Stars radius={8} depth={20} count={900} factor={1.5} saturation={0} fade speed={0.25} />}
    <ProjectionScene {...props} controlsRef={controlsRef} />
    <OrbitControls ref={controlsRef} enabled={!controlsLocked} enablePan={props.projectionMode === 'map'} enableRotate={props.projectionMode === 'globe'}
      screenSpacePanning minDistance={1.45} maxDistance={4.2} rotateSpeed={0.45} zoomSpeed={0.65} dampingFactor={0.06}
      enableDamping={!props.reducedMotion} />
  </Canvas>;
}
