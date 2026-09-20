import { FurnitureKind } from '../domain/catalog';

/** Multiply an #rrggbb colour's channels by `k` (k < 1 darkens, k > 1 lightens). */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Top-down symbol of a furniture kind, drawn centred on the origin in metres.
 * "Back" is −y, "front" is +y — the same convention as the 3D models.
 * Used by the plan view and by the catalog thumbnails.
 */
export function drawFurnitureSymbol(
  ctx: CanvasRenderingContext2D,
  kind: FurnitureKind,
  w: number,
  d: number,
  fill: string,
  lw: number,
  stroke = 'rgba(15,23,42,0.8)',
): void {
  const dark = shade(fill, 0.8);
  const light = shade(fill, 1.14);
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.lineJoin = 'round';
  const box = (x: number, y: number, ww: number, hh: number, r: number, f: string) => {
    roundedRect(ctx, x, y, ww, hh, r);
    ctx.fillStyle = f;
    ctx.fill();
    ctx.stroke();
  };
  const hw = w / 2;
  const hd = d / 2;

  switch (kind) {
    case 'sofa': {
      box(-hw, -hd, w, d, 0.06, fill);
      box(-hw, -hd, w, d * 0.28, 0.05, dark);
      box(-hw, -hd + d * 0.28, w * 0.09, d * 0.72, 0.04, dark);
      box(hw - w * 0.09, -hd + d * 0.28, w * 0.09, d * 0.72, 0.04, dark);
      const cw = (w - w * 0.18) / 2;
      box(-hw + w * 0.09, -hd + d * 0.28, cw, d * 0.72, 0.03, light);
      box(0, -hd + d * 0.28, cw, d * 0.72, 0.03, light);
      break;
    }
    case 'bed': {
      box(-hw, -hd, w, d, 0.05, '#f3f1ec');
      box(-hw, -hd, w, d * 0.05, 0.02, dark);
      box(-hw * 0.9, -hd + d * 0.08, w * 0.4, d * 0.14, 0.05, '#ffffff');
      box(hw * 0.9 - w * 0.4, -hd + d * 0.08, w * 0.4, d * 0.14, 0.05, '#ffffff');
      box(-hw, -hd + d * 0.36, w, d * 0.64, 0.05, fill);
      ctx.beginPath();
      ctx.moveTo(-hw, -hd + d * 0.36 + d * 0.08);
      ctx.lineTo(hw, -hd + d * 0.36 + d * 0.08);
      ctx.stroke();
      break;
    }
    case 'table': {
      box(-hw, -hd, w, d, 0.04, fill);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      roundedRect(ctx, -hw + 0.08, -hd + 0.08, w - 0.16, d - 0.16, 0.02);
      ctx.stroke();
      break;
    }
    case 'chair': {
      box(-hw, -hd + d * 0.18, w, d * 0.82, 0.05, fill);
      box(-hw, -hd, w, d * 0.22, 0.04, dark);
      break;
    }
    case 'wardrobe': {
      box(-hw, -hd, w, d, 0.02, fill);
      ctx.beginPath();
      ctx.moveTo(0, -hd);
      ctx.lineTo(0, hd);
      ctx.moveTo(-hw, hd - d * 0.08);
      ctx.lineTo(hw, hd - d * 0.08);
      ctx.stroke();
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * w * 0.08, hd - d * 0.22, Math.max(0.015, d * 0.04), 0, Math.PI * 2);
        ctx.fillStyle = stroke;
        ctx.fill();
      }
      break;
    }
    case 'plant': {
      const r = Math.min(hw, hd);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#5f9a4d';
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 3);
        ctx.beginPath();
        ctx.ellipse(r * 0.5, 0, r * 0.42, r * 0.17, 0, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? '#78b35f' : '#4a8a3d';
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'lamp': {
      const r = Math.min(hw, hd);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#fbe6a8';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#2a2d33';
      ctx.fill();
      break;
    }
    case 'picture': {
      const th = Math.max(d, 0.07);
      box(-hw, -th / 2, w, th, 0.01, fill);
      break;
    }
    case 'carpet': {
      ctx.globalAlpha = 0.9;
      box(-hw, -hd, w, d, 0.06, fill);
      ctx.globalAlpha = 1;
      ctx.setLineDash([lw * 5, lw * 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      roundedRect(ctx, -hw + 0.1, -hd + 0.1, w - 0.2, d - 0.2, 0.04);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
  }
}
