import * as THREE from 'three';
import type { MultiLineString } from 'geojson';
import { plateCarreePosition } from './projection';

export function createLineGeometry(geometry: MultiLineString, radius: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const mapPositions: number[] = [];
  for (const line of geometry.coordinates) {
    for (let index = 1; index < line.length; index += 1) {
      if (Math.abs(line[index]![0]! - line[index - 1]![0]!) > 180) continue;
      for (const point of [line[index - 1]!, line[index]!]) {
        const longitude = point[0]! * Math.PI / 180; const latitude = point[1]! * Math.PI / 180;
        positions.push(radius * Math.cos(latitude) * Math.cos(longitude), radius * Math.sin(latitude), -radius * Math.cos(latitude) * Math.sin(longitude));
        const mapPosition = plateCarreePosition((point[0]! + 180) / 360, (point[1]! + 90) / 180, 1, radius - 1);
        mapPositions.push(mapPosition.x, mapPosition.y, mapPosition.z);
      }
    }
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute('mapPosition', new THREE.Float32BufferAttribute(mapPositions, 3));
  result.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(),
    Math.max(radius, Math.hypot(1, 0.5, radius - 1)),
  );
  return result;
}
