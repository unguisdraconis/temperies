import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import worldData from 'world-atlas/countries-110m.json';
import type { VectorLayerVisibility } from '../climate/types';
import { createLineGeometry } from './vectorGeometry';
import type { ProjectionMixRef } from './projection';
import vertexShader from './shaders/vector.vert.glsl?raw';
import fragmentShader from './shaders/vector.frag.glsl?raw';

interface ProjectedLineProps { geometry: THREE.BufferGeometry; color: string; opacity: number; projectionMix: ProjectionMixRef }

function ProjectedLine({ geometry, color, opacity, projectionMix }: ProjectedLineProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uProjectionMix: { value: projectionMix.current },
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: opacity },
  }), [color, opacity, projectionMix]);
  useFrame(() => {
    if (materialRef.current) materialRef.current.uniforms.uProjectionMix!.value = projectionMix.current;
  });
  return <lineSegments geometry={geometry}><shaderMaterial ref={materialRef} uniforms={uniforms} vertexShader={vertexShader}
    fragmentShader={fragmentShader} glslVersion={THREE.GLSL3} transparent depthWrite={false} /></lineSegments>;
}

export function VectorLayers({ countries, coastlines, projectionMix }: VectorLayerVisibility & { projectionMix: ProjectionMixRef }) {
  const geometries = useMemo(() => {
    const topology = worldData as unknown as Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
    return {
      borders: createLineGeometry(mesh(topology, topology.objects.countries, (a, b) => a !== b), 1.006),
      coasts: createLineGeometry(mesh(topology, topology.objects.land), 1.009),
    };
  }, []);
  useEffect(() => () => { geometries.borders.dispose(); geometries.coasts.dispose(); }, [geometries]);
  return <>
    {countries && <ProjectedLine geometry={geometries.borders} color="#d9ebe7" opacity={0.62} projectionMix={projectionMix} />}
    {coastlines && <ProjectedLine geometry={geometries.coasts} color="#f0f7f5" opacity={0.82} projectionMix={projectionMix} />}
  </>;
}
