// Rendering

import { EMPTY, GARBAGE_COLOR, EYE_STYLE_BY_COLOR, COLS, ROWS } from './constants.js';
import { offsetsForOri } from './utils.js';

export class Renderer {
  static drawCell(g, x, y, color, size, animTimeMs) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size * 0.45;

    // Blob base
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.closePath();
    g.fillStyle = color;
    g.fill();

    // Soft inner shading
    const inner = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    inner.addColorStop(0, 'rgba(0,0,0,0.04)');
    inner.addColorStop(1, 'rgba(0,0,0,0.16)');
    g.fillStyle = inner;
    g.fill();

    // Glossy highlight toward top-left
    const hx = cx - r * 0.35;
    const hy = cy - r * 0.35;
    const highlight = g.createRadialGradient(hx, hy, r * 0.05, hx, hy, r * 0.7);
    highlight.addColorStop(0, 'rgba(255,255,255,0.55)');
    highlight.addColorStop(0.4, 'rgba(255,255,255,0.25)');
    highlight.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = highlight;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.closePath();
    g.fill();

    // Subtle rim light
    g.lineWidth = Math.max(1, size * 0.03);
    g.strokeStyle = 'rgba(255,255,255,0.10)';
    g.stroke();
    g.restore();

    // Cheek blush
    g.save();
    g.globalAlpha = 0.18;
    g.beginPath();
    g.ellipse(cx - r * 0.28, cy + r * 0.14, r * 0.30, r * 0.14, -0.1, 0, Math.PI * 2);
    g.fillStyle = 'rgb(255,160,180)';
    g.fill();
    g.beginPath();
    g.ellipse(cx + r * 0.28, cy + r * 0.14, r * 0.30, r * 0.14, 0.1, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // Eyes: pupils only
    const style = EYE_STYLE_BY_COLOR[color];
    if (!style) return;

    const t = animTimeMs || 0;
    const seed = ((x * 97) ^ (y * 131)) % 1000;

    const eyeDY = r * 0.02;
    const eyeDX = r * 0.42;
    const baseEyeR = r * 0.26;

    let leftOpen = 1, rightOpen = 1;
    let eyeR = baseEyeR;
    let pupilR = eyeR * 0.52;
    let leftOffset = { dx: 0, dy: 0 };
    let rightOffset = { dx: 0, dy: 0 };

    function blinkOpen(time, s, period, closeDur, halfDur, base = 1, min = 0) {
      const ph = ((time + s) % period) / period;
      if (ph < closeDur / period) return min;
      if (ph < (closeDur + halfDur) / period) return Math.max(0.2, base * 0.3);
      return base;
    }

    if (style === 'sleepy') {
      const base = 0.7;
      const p = 5400, close = 140, half = 220;
      leftOpen = blinkOpen(t, seed * 2, p, close, half, base, 0);
      rightOpen = blinkOpen(t, seed * 3, p, close, half, base, 0);
      pupilR = eyeR * 0.38;
      leftOffset.dy = eyeR * 0.06;
      rightOffset.dy = eyeR * 0.06;
    } else if (style === 'blinking') {
      const p = 3600, close = 90, half = 120;
      leftOpen = blinkOpen(t, seed * 3, p, close, half, 1, 0);
      rightOpen = blinkOpen(t, seed * 5, p, close, half, 1, 0);
    } else if (style === 'bigCute') {
      eyeR = baseEyeR * 1.22;
      pupilR = eyeR * 0.58;
      const ang = ((t + seed * 4) / 1400) * Math.PI * 2;
      const roam = eyeR * 0.12;
      leftOffset.dx = Math.cos(ang) * roam;
      rightOffset.dx = Math.cos(ang + 0.5) * roam;
      leftOffset.dy = -eyeR * 0.08 + Math.sin(ang) * roam * 0.3;
      rightOffset.dy = -eyeR * 0.08 + Math.sin(ang + 0.5) * roam * 0.3;
    } else if (style === 'smallFocused') {
      eyeR = baseEyeR * 0.80;
      pupilR = eyeR * 0.40;
      const snap = Math.floor(((t + seed * 7) / 700) % 4);
      const offset = eyeR * 0.12;
      const table = [
        { dx: 0, dy: 0 },
        { dx: offset, dy: -offset * 0.3 },
        { dx: -offset, dy: -offset * 0.3 },
        { dx: 0, dy: 0 }
      ];
      leftOffset = table[snap];
      rightOffset = table[(snap + 1) % table.length];
      const p = 3000, close = 80, half = 80;
      leftOpen = blinkOpen(t, seed, p, close, half, 1, 0);
      rightOpen = blinkOpen(t, seed + 333, p, close, half, 1, 0);
    } else if (style === 'wandering') {
      const ang = ((t + seed * 7) / 1200) * Math.PI * 2;
      const roam = eyeR * 0.18;
      leftOffset.dx = Math.cos(ang) * roam;
      leftOffset.dy = Math.sin(ang) * roam * 0.6;
      rightOffset.dx = Math.cos(ang + 0.6) * roam;
      rightOffset.dy = Math.sin(ang + 0.6) * roam * 0.6;
    }

    function drawPupil(px, py, open) {
      if (open <= 0.06) return;
      const pr = pupilR * (0.85 + 0.15 * Math.max(0, Math.min(open, 1)));
      g.beginPath();
      g.arc(px, py, pr, 0, Math.PI * 2);
      g.closePath();
      g.fillStyle = '#0d1224';
      g.fill();
      g.beginPath();
      g.ellipse(px - pr * 0.35, py - pr * 0.35, pr * 0.20, pr * 0.12, -0.35, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fill();
      g.beginPath();
      g.arc(px + pr * 0.22, py - pr * 0.18, pr * 0.09, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fill();
    }

    const leftX = cx - eyeDX;
    const rightX = cx + eyeDX;
    const eyeY = cy + eyeDY;
    drawPupil(leftX + (leftOffset.dx || 0), eyeY + (leftOffset.dy || 0), leftOpen);
    drawPupil(rightX + (rightOffset.dx || 0), eyeY + (rightOffset.dy || 0), rightOpen);
  }

  static drawGrid(p) {
    p.ctx.clearRect(0, 0, p.canvas.width, p.canvas.height);

    // Ensure default compositing on every frame
    p.ctx.globalCompositeOperation = 'source-over';
    p.ctx.globalAlpha = 1;

    // Light base fill so falling pieces have consistent contrast
    p.ctx.save();
    p.ctx.fillStyle = 'rgba(255,255,255,0.55)';
    p.ctx.fillRect(0, 0, p.canvas.width, p.canvas.height);
    p.ctx.restore();

    // Grid lines
    p.ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    for (let x = 0; x <= COLS; x++) {
      p.ctx.beginPath();
      p.ctx.moveTo(x * p.CELL + 0.5, 0);
      p.ctx.lineTo(x * p.CELL + 0.5, p.canvas.height);
      p.ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      p.ctx.beginPath();
      p.ctx.moveTo(0, y * p.CELL + 0.5);
      p.ctx.lineTo(p.canvas.width, y * p.CELL + 0.5);
      p.ctx.stroke();
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = p.grid[y][x];
        if (cell !== EMPTY) {
          const color = cell === -1 ? GARBAGE_COLOR : cell;
          Renderer.drawCell(p.ctx, x * p.CELL + 2, y * p.CELL + 2, color, p.CELL - 3, p.manager.animTimeMs);
        }
      }
    }
  }

  static drawActive(p) {
    if (!p.active) return;
    const { x, y, ori, a, b } = p.active;
    const cells = [{ x, y, color: a }];
    const { ox, oy } = offsetsForOri(ori);
    cells.push({ x: x + ox, y: y + oy, color: b });

    // Ensure we draw over everything with full opacity
    p.ctx.save();
    p.ctx.globalAlpha = 1;
    p.ctx.globalCompositeOperation = 'source-over';

    for (const c of cells) {
      const sx = c.x * p.CELL + 2;
      const sy = c.y * p.CELL + 2;
      // Fallback block fill to guarantee visibility even if gradients/paths fail
      p.ctx.fillStyle = c.color;
      p.ctx.fillRect(sx, sy, p.CELL - 3, p.CELL - 3);
      Renderer.drawCell(p.ctx, sx, sy, c.color, p.CELL - 3, p.manager.animTimeMs);
    }
    p.ctx.restore();
  }

  static drawPreview(p) {
    p.pctx.clearRect(0, 0, p.preview.width, p.preview.height);
    const size = Math.floor(p.preview.width / 3);
    // Center for P1, right-align for P2 to match the 'Next' label alignment
    const startX = (p.id === 2)
      ? Math.max(0, p.preview.width - size - 2)
      : size;
    const startY = size / 2;
    Renderer.drawCell(p.pctx, startX, startY, p.nextPair.a, size, p.manager.animTimeMs);
    Renderer.drawCell(p.pctx, startX, startY + size + 4, p.nextPair.b, size, p.manager.animTimeMs);
  }

  static updateHud(p) {
    p.hud.score.textContent = String(p.score);
    p.hud.chains.textContent = String(p.chainShown);
    p.hud.speed.textContent = `${(1600 / p.dropMs).toFixed(1)}x`;
    p.hud.lines.textContent = String(p.totalCleared);
  }

  static draw(p) {
    Renderer.drawGrid(p);
    Renderer.drawActive(p);
  }
}

  