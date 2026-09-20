import * as THREE from 'three';
import { TextureKind } from '../domain/materials';

/** Small deterministic PRNG so procedural textures look the same on every load. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const grey = (v: number): string => `rgb(${v | 0},${v | 0},${v | 0})`;

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d') as CanvasRenderingContext2D];
}

/**
 * Greyscale tiles (1 m × 1 m in world space). The material colour multiplies them,
 * so one texture serves every tint of a family.
 */
export function makeTexture(kind: TextureKind): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = canvas(size);
  const rand = rng(kind.length * 7919 + 13);

  if (kind === 'planks') {
    const rows = 5;
    const h = size / rows;
    ctx.fillStyle = grey(225);
    ctx.fillRect(0, 0, size, size);
    for (let r = 0; r < rows; r++) {
      const joint = rand() * size;
      for (const [x0, x1] of [
        [joint - size, joint],
        [joint, joint + size],
      ]) {
        ctx.fillStyle = grey(205 + rand() * 45);
        ctx.fillRect(x0, r * h, x1 - x0, h);
        for (let g = 0; g < 14; g++) {
          ctx.strokeStyle = `rgba(90,60,30,${0.05 + rand() * 0.1})`;
          ctx.lineWidth = 0.6 + rand() * 1.2;
          const y = r * h + rand() * h;
          ctx.beginPath();
          ctx.moveTo(Math.max(0, x0), y);
          ctx.bezierCurveTo(
            x0 + (x1 - x0) * 0.3,
            y + (rand() - 0.5) * 6,
            x0 + (x1 - x0) * 0.7,
            y + (rand() - 0.5) * 6,
            x1,
            y,
          );
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(40,25,10,0.55)';
        ctx.fillRect(x0, r * h, 1.5, h);
      }
      ctx.fillStyle = 'rgba(40,25,10,0.5)';
      ctx.fillRect(0, r * h, size, 1.5);
    }
  } else if (kind === 'marble') {
    ctx.fillStyle = grey(244);
    ctx.fillRect(0, 0, size, size);
    for (let v = 0; v < 9; v++) {
      ctx.strokeStyle = `rgba(80,86,96,${0.08 + rand() * 0.18})`;
      ctx.lineWidth = 0.6 + rand() * 2;
      ctx.beginPath();
      let x = rand() * size;
      let y = 0;
      ctx.moveTo(x, y);
      while (y < size) {
        x += (rand() - 0.5) * 60;
        y += 20 + rand() * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (kind === 'concrete') {
    ctx.fillStyle = grey(225);
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = grey(190 + rand() * 60);
      ctx.globalAlpha = 0.15 + rand() * 0.25;
      const s = 1 + rand() * 3;
      ctx.fillRect(rand() * size, rand() * size, s, s);
    }
    ctx.globalAlpha = 1;
  } else {
    const n = 4;
    const s = size / n;
    ctx.fillStyle = grey(150);
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = grey(232 + rand() * 20);
        ctx.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
      }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Abstract artwork for the Picture item. */
export function makeArtTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256);
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, '#f6d7a7');
  g.addColorStop(1, '#5b8db8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#e8553d';
  ctx.beginPath();
  ctx.arc(150, 100, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f3b57';
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(0, 170);
  ctx.lineTo(90, 120);
  ctx.lineTo(170, 190);
  ctx.lineTo(256, 140);
  ctx.lineTo(256, 256);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
