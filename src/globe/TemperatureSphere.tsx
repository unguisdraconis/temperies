import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { DisplayMode, FramePair, HoveredCell, LegendSelection, ProjectionMode, TemperaturePalette, TemperatureRenderStyle } from '../climate/types';
import { uvToGridCell, uvToLatLon } from '../climate/grid';
import { createPaletteTexture, updatePaletteTexture } from './textures';
import { DisplayTextureCache } from './displayTextureCache';
import { canonicalGridUniformSize, HEATMAP_GRID_PRESENTATION, heatmapGridActive, replaceTemperatureFieldTexture } from './rendering';
import { lookupTemperatureAtIndex } from './temperatureLookup';
import { createProjectionGeometry, type ProjectionMixRef } from './projection';
import vertexShader from './shaders/temperature.vert.glsl?raw';
import fragmentShader from './shaders/temperature.frag.glsl?raw';

const displayTextureCache = new DisplayTextureCache();

interface Props {
  frames: FramePair; mask: Uint8Array; mode: DisplayMode; renderStyle: TemperatureRenderStyle; palette: TemperaturePalette; highlight: LegendSelection | null;
  projectionMode: ProjectionMode; projectionMix: ProjectionMixRef;
  onHover: (cell: HoveredCell) => void; onLeave: () => void;
}

export function TemperatureSphere({ frames, mask, mode, renderStyle, palette, highlight, projectionMode, projectionMix, onHover, onLeave }: Props) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const initialRenderStyle = useRef(renderStyle);
  const fieldTexture = useMemo(() => displayTextureCache.get(frames.current, mask, mode), [frames, mask, mode]);
  const initialFieldTexture = useRef(fieldTexture);
  const initialPalette = useRef(palette);
  const paletteTexture = useMemo(() => createPaletteTexture(initialPalette.current), []);
  const geometry = useMemo(() => createProjectionGeometry(), []);
  const uniforms = useMemo(() => ({
    uField: { value: initialFieldTexture.current }, uLut: { value: paletteTexture },
    uProjectionMix: { value: projectionMix.current },
    uHighlightActive: { value: 0 }, uHighlightMin: { value: 0 }, uHighlightMax: { value: 0 },
    uGridSize: { value: canonicalGridUniformSize() },
    uHeatmapGridActive: { value: heatmapGridActive(initialRenderStyle.current) },
    uHeatmapGridOpacity: { value: HEATMAP_GRID_PRESENTATION.opacity },
    uHeatmapGridColor: { value: new THREE.Color(HEATMAP_GRID_PRESENTATION.color) },
    uGridLineHalfWidthPixels: { value: HEATMAP_GRID_PRESENTATION.lineHalfWidthPixels },
    uGridFadeStartPixelsPerCell: { value: HEATMAP_GRID_PRESENTATION.fadeStartPixelsPerCell },
    uGridFadeEndPixelsPerCell: { value: HEATMAP_GRID_PRESENTATION.fadeEndPixelsPerCell },
  }), [paletteTexture, projectionMix]);

  useEffect(() => () => { paletteTexture.dispose(); geometry.dispose(); }, [geometry, paletteTexture]);
  useFrame(() => {
    if (materialRef.current) materialRef.current.uniforms.uProjectionMix!.value = projectionMix.current;
  });
  useEffect(() => {
    if (materialRef.current) replaceTemperatureFieldTexture(materialRef.current.uniforms, fieldTexture);
  }, [fieldTexture]);
  useEffect(() => {
    if (materialRef.current) materialRef.current.uniforms.uHeatmapGridActive!.value = heatmapGridActive(renderStyle);
  }, [renderStyle]);
  useEffect(() => updatePaletteTexture(paletteTexture, palette), [palette, paletteTexture]);
  useEffect(() => {
    const uniformsNow = materialRef.current?.uniforms;
    if (!uniformsNow) return;
    uniformsNow.uHighlightActive!.value = highlight ? 1 : 0;
    if (highlight) { uniformsNow.uHighlightMin!.value = highlight.minimum; uniformsNow.uHighlightMax!.value = highlight.maximum; }
  }, [highlight]);

  const emitHover = (event: ThreeEvent<PointerEvent>) => {
    if (!event.uv) return;
    event.stopPropagation();
    const coordinates = uvToLatLon(event.uv.x, event.uv.y);
    const cell = uvToGridCell(event.uv.x, event.uv.y);
    const { surface, temperatureC } = lookupTemperatureAtIndex(frames, mask, mode, cell.index, 0);
    onHover({ ...cell, ...coordinates, surface, temperatureC,
      clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY, interpolation: 0 });
  };

  const handleGlobeMove = (event: ThreeEvent<PointerEvent>) => {
    if (projectionMode === 'globe' && projectionMix.current <= 0.001) emitHover(event);
  };
  const handleMapMove = (event: ThreeEvent<PointerEvent>) => {
    if (projectionMode === 'map' && projectionMix.current >= 0.999) emitHover(event);
  };

  return <>
    <mesh geometry={geometry} onPointerMove={handleGlobeMove} onPointerOut={onLeave}>
      <shaderMaterial ref={materialRef} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} glslVersion={THREE.GLSL3} />
    </mesh>
    {projectionMode === 'map' && <mesh position={[0, 0, 0.012]} onPointerMove={handleMapMove} onPointerOut={onLeave}>
      <planeGeometry args={[2, 1]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>}
  </>;
}
