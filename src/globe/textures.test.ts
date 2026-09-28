import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GRID } from '../climate/constants';
import { createClimateTexture, createPackedClimateTexture, createPaletteTexture, packTemperatureTextureData, updatePaletteTexture } from './textures';

describe('climate texture sampling', () => {
  it('keeps the native raster nearest-sampled without mipmaps', () => {
    const data = new Uint16Array(GRID.cellCount); const texture = createClimateTexture(data);
    expect(texture.image).toMatchObject({ width: GRID.width, height: GRID.height });
    expect(texture.image.data).toBeInstanceOf(Uint8Array);
    expect(texture.image.data).toHaveLength(GRID.cellCount * 2);
    expect(texture.format).toBe(THREE.RGFormat); expect(texture.type).toBe(THREE.UnsignedByteType);
    expect(texture.minFilter).toBe(THREE.NearestFilter); expect(texture.magFilter).toBe(THREE.NearestFilter);
    expect(texture.generateMipmaps).toBe(false); expect(texture.flipY).toBe(true);
    texture.dispose();
  });
  it('packs every Uint16 code losslessly as low/high RG8 bytes', () => {
    const data = new Uint16Array(GRID.cellCount);
    data.set([0, 1, 255, 256, 10_000, 65_534, 65_535]);
    expect([...packTemperatureTextureData(data).slice(0, 14)]).toEqual([
      0, 0, 1, 0, 255, 0, 0, 1, 16, 39, 254, 255, 255, 255,
    ]);
  });
  it('uploads already-packed fields without allocating another encoded array', () => {
    const packed = new Uint8Array(GRID.cellCount * 2);
    const texture = createPackedClimateTexture(packed);
    expect(texture.image.data).toBe(packed);
    texture.dispose();
  });
  it('updates the palette lookup in place without replacing the GPU texture', () => {
    const texture = createPaletteTexture('diverging');
    const data = texture.image.data as Uint8Array;
    const before = data.slice();
    const versionBefore = texture.version;
    updatePaletteTexture(texture, 'sequential');
    expect(texture.image.data).toBe(data);
    expect(data).not.toEqual(before);
    expect(texture.version).toBeGreaterThan(versionBefore);
    texture.dispose();
  });
});
