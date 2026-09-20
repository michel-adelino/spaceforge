import * as THREE from 'three';
import { getPreset } from '../domain/materials';
import { makeTexture } from './textures';

/**
 * Materials are shared across every mesh that uses them (one per preset), so changing a sofa's fabric
 * just swaps a reference and hundreds of objects cost a handful of materials.
 */
const presetCache = new Map<string, THREE.MeshStandardMaterial>();
const fixedCache = new Map<string, THREE.MeshStandardMaterial>();

export function getMaterial(id: string): THREE.MeshStandardMaterial {
  let m = presetCache.get(id);
  if (!m) {
    const p = getPreset(id);
    m = new THREE.MeshStandardMaterial({ color: p.color, roughness: p.roughness, metalness: p.metalness });
    if (p.texture) m.map = makeTexture(p.texture);
    presetCache.set(id, m);
  }
  return m;
}

export function fixedMaterial(color: number, roughness = 0.6, metalness = 0): THREE.MeshStandardMaterial {
  const key = `${color}-${roughness}-${metalness}`;
  let m = fixedCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    fixedCache.set(key, m);
  }
  return m;
}

export const glassMaterial = new THREE.MeshStandardMaterial({
  color: 0xbfe3ff,
  roughness: 0.05,
  metalness: 0.1,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
});

export const lampShadeMaterial = new THREE.MeshStandardMaterial({
  color: 0xf6e7c8,
  emissive: 0xffc46b,
  emissiveIntensity: 0,
  roughness: 0.9,
  side: THREE.DoubleSide,
});
