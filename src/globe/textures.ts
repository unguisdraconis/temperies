import * as THREE from 'three';
import { GRID } from '../climate/constants';
import type { TemperaturePalette } from '../climate/types';
import { createLutData } from '../legend/legendScale';

export function packTemperatureTextureData(data: Uint16Array): Uint8Array {
  if (data.length !== GRID.cellCount) throw new RangeError('temperature field does not match the canonical grid');
  const packed = new Uint8Array(data.length * 2);
  for (let index = 0; index < data.length; index += 1) {
    const value = data[index]!;
    packed[index * 2] = value & 0xff;
    packed[index * 2 + 1] = value >>> 8;
  }
  return packed;
}

export function createClimateTexture(data: Uint16Array): THREE.DataTexture {
  // Store each Uint16 code as explicit low/high bytes in an RG8 texture.
  // This preserves every encoded value while avoiding driver-dependent
  // integer-texture upload and sampler behavior.
  return createPackedClimateTexture(packTemperatureTextureData(data));
}

export function createPackedClimateTexture(data: Uint8Array): THREE.DataTexture {
  if (data.length !== GRID.cellCount * 2) throw new RangeError('packed temperature field does not match the canonical grid');
  const texture = new THREE.DataTexture(data, GRID.width, GRID.height, THREE.RGFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true; texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.ClampToEdgeWrapping; texture.flipY = true;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

export function createMaskTexture(data: Uint8Array): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, GRID.width, GRID.height, THREE.RedFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true; texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.ClampToEdgeWrapping; texture.flipY = true;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

export function createPaletteTexture(palette: TemperaturePalette = 'diverging'): THREE.DataTexture {
  const texture = new THREE.DataTexture(createLutData(palette), 512, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

export function updatePaletteTexture(texture: THREE.DataTexture, palette: TemperaturePalette): void {
  const image = texture.image as { data: Uint8Array };
  image.data.set(createLutData(palette));
  texture.needsUpdate = true;
}
