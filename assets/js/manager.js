// Game Manager

import { BASE_DROP_MS, COLS, COLORS } from './constants.js';
import { Renderer } from './renderer.js';
import { Player } from './player.js';

// Seeded RNG for shared pair sequence
function mulberry32(a) {
  return function() {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class GameManager {
  constructor() {
    this.animTimeMs = 0;
    this.last = 0;

    this.p1 = new Player(1, this);
    this.p2 = new Player(2, this);
    this.p1.enemy = this.p2;
    this.p2.enemy = this.p1;
    this.players = [this.p1, this.p2];

    // Shared random sequence for identical piece generation
    this.rng = mulberry32((Math.random() * 4294967296) >>> 0);
    this.pairSeq = [];
    this.initPairSequence(2000);

    this.playersMode = 2;

    this.bindInputs();
    this.bindUI();
    this.resize();
    Renderer.updateHud(this.p1); Renderer.updateHud(this.p2);
    Renderer.drawPreview(this.p1); Renderer.drawPreview(this.p2);
    Renderer.draw(this.p1); Renderer.draw(this.p2);

    // Hint overlay so boards don't look blank before starting
    this.showGameOverlay(1, 'Press Start');
    if (this.playersMode === 2) this.showGameOverlay(2, 'Press Start');

    window.addEventListener('resize', () => {
      this.resize();
      Renderer.drawPreview(this.p1); Renderer.drawPreview(this.p2);
      Renderer.draw(this.p1); Renderer.draw(this.p2);
    });
    requestAnimationFrame(this.tick.bind(this));
  }

  tick(ts) {
    this.animTimeMs = ts;
    if (!this.last) this.last = ts;
    const dt = ts - this.last;
    this.last = ts;

    for (const p of this.players) {
      if (!p.running) continue;
      p.acc += dt;
      const stepMs = p.dropMs;
      while (p.acc >= stepMs) {
        p.acc -= stepMs;
        if (p.active) {
          if (!p.step()) {
            p.lockPiece();
          }
        }
      }
      Renderer.draw(p);
    }
    requestAnimationFrame(this.tick.bind(this));
  }

  bindInputs() {
    const keys = new Set();
    window.addEventListener('keydown', e => {
      const gameplayCodes = new Set([
        'KeyA','KeyD','KeyS','KeyF','KeyG','KeyW','Space',
        'ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Comma','Period',
        'KeyR'
      ]);
      if (gameplayCodes.has(e.code)) e.preventDefault();
      if (keys.has(e.code)) return;
      keys.add(e.code);

      // Player 1
      switch (e.code) {
        case 'KeyA': this.p1.move(-1); break;
        case 'KeyD': this.p1.move(1); break;
        case 'KeyS': this.p1.softDrop(); break;
        case 'KeyF': this.p1.rotate(-1); break;
        case 'KeyG': this.p1.rotate(1); break;
        case 'KeyW': this.p1.hardDrop(); break;
      }
      // Player 2
      switch (e.code) {
        case 'ArrowLeft': this.p2.move(-1); break;
        case 'ArrowRight': this.p2.move(1); break;
        case 'ArrowDown': this.p2.softDrop(); break;
        case 'ArrowUp': this.p2.hardDrop(); break;
        case 'Comma': this.p2.rotate(-1); break;
        case 'Period': this.p2.rotate(1); break;
      }
      if (e.code === 'KeyR') {
        const btn = document.getElementById('startBtn');
        if (btn) btn.blur();
        this.resetByMode();
      }
    });
    window.addEventListener('keyup', e => {
      if (e.code === 'Space') e.preventDefault();
      keys.delete(e.code);
    });
  }

  bindUI() {
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        startBtn.blur();
        this.resetByMode();
      });
    }

    const mode1Radio = document.getElementById('mode1p');
    const mode2Radio = document.getElementById('mode2p');
    if (mode1Radio) {
      mode1Radio.addEventListener('change', (e) => {
        if (e.target.checked) this.setMode(1);
      });
    }
    if (mode2Radio) {
      mode2Radio.addEventListener('change', (e) => {
        if (e.target.checked) this.setMode(2);
      });
    }
    this.setMode((mode2Radio && mode2Radio.checked) ? 2 : 1);
  }

  applyModeUI() {
    const p2El = document.getElementById('player2');
    if (!p2El) return;
    if (this.playersMode === 1) {
      p2El.classList.add('hidden-player');
    } else {
      p2El.classList.remove('hidden-player');
    }
  }

  setMode(count) {
    this.playersMode = count;
    if (count === 1) {
      this.p2.running = false;
      this.p2.gameOver = true;
      this.p2.active = null;
      this.p2.acc = 0;
      this.p1.enemy = null;
      this.p2.enemy = null;
    } else {
      this.p2.gameOver = false;
      this.p1.enemy = this.p2;
      this.p2.enemy = this.p1;
    }
    this.applyModeUI();
    this.resize();
    Renderer.drawPreview(this.p1); Renderer.drawPreview(this.p2);
    Renderer.draw(this.p1); Renderer.draw(this.p2);
  }

  resetByMode() {
    this.clearAllOverlays();
    if (this.playersMode === 1) {
      this.p1.reset();
      this.p2.running = false;
      this.p2.gameOver = true;
      this.p2.active = null;
      this.p2.acc = 0;
      this.p1.enemy = null;
      this.p2.enemy = null;
    } else {
      this.players.forEach(p => p.reset());
      this.p1.enemy = this.p2;
      this.p2.enemy = this.p1;
    }
    this.resize();
    Renderer.drawPreview(this.p1); Renderer.drawPreview(this.p2);
    Renderer.draw(this.p1); Renderer.draw(this.p2);
  }

  // Overlays
  showGameOverlay(playerId, text) {
    const parent = document.getElementById(`player${playerId}`);
    if (!parent) return;
    let ov = parent.querySelector('.gameover-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'gameover-overlay';
      const txt = document.createElement('div');
      txt.className = 'gameover-text';
      ov.appendChild(txt);
      parent.appendChild(ov);
    }
    const txt = ov.querySelector('.gameover-text');
    txt.textContent = text;
    ov.style.display = 'flex';
  }

  hideGameOverlay(playerId) {
    const parent = document.getElementById(`player${playerId}`);
    if (!parent) return;
    const ov = parent.querySelector('.gameover-overlay');
    if (ov) ov.style.display = 'none';
  }

  clearAllOverlays() {
    this.hideGameOverlay(1);
    this.hideGameOverlay(2);
  }

  endGame(p) {
    p.running = false;
    p.gameOver = true;
    this.handleGameOver(p);
  }

  handleGameOver(loser) {
    if (this.playersMode === 2) {
      const winner = loser === this.p1 ? this.p2 : this.p1;
      const winnerWasDown = !!winner.gameOver;
      winner.running = false;
      winner.gameOver = true;
      this.showGameOverlay(loser.id, 'Game Over');
      if (winnerWasDown) {
        this.showGameOverlay(winner.id, 'Draw');
      } else {
        this.showGameOverlay(winner.id, 'Winner!');
      }
    } else {
      this.showGameOverlay(loser.id, 'Game Over');
    }
  }

  // Shared pair sequence
  initPairSequence(len = 2000) {
    this.pairSeq = new Array(len);
    for (let i = 0; i < len; i++) {
      const a = COLORS[(this.rng() * COLORS.length) | 0];
      const b = COLORS[(this.rng() * COLORS.length) | 0];
      this.pairSeq[i] = { a, b };
    }
  }

  getPair(index) {
    if (index >= this.pairSeq.length) {
      this.initPairSequence(this.pairSeq.length * 2);
    }
    return this.pairSeq[index];
  }

  // Layout & sizing
  resize() {
    const main = document.querySelector('main');
    const controls = document.querySelector('.controls');
    const footer = document.querySelector('footer');
    const wrap = document.querySelector('.game-wrap.two') || document.querySelector('.game-wrap');

    const wrapStyles = wrap ? getComputedStyle(wrap) : null;
    const colGap = wrapStyles ? parseFloat(wrapStyles.columnGap || wrapStyles.gap || '0') || 0 : 0;

    const availW = main.clientWidth;
    const perHalfW = Math.floor((availW - colGap) / 2);

    const styles = getComputedStyle(main);
    const padV = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    const availH = window.innerHeight - (footer ? footer.offsetHeight : 0) - (controls ? controls.offsetHeight : 0) - padV - 20;

    const sideWidthFor = (id) => {
      const el = document.querySelector(`#player${id} .hud-side`);
      return el ? el.offsetWidth : 160;
    };

    const applySizeFor = (p, id) => {
      const sideW = sideWidthFor(id);
      const canvasMaxW = Math.max(72, perHalfW - sideW - 12);
      const widthByHeight = Math.max(96, Math.floor(availH / 2));
      const targetW = Math.min(canvasMaxW, widthByHeight);

      const cellPix = Math.max(10, Math.floor(targetW / COLS));
      const internalW = cellPix * COLS;
      const internalH = internalW * 2;

      const previewSizeBase = Math.floor(internalW / 3);
      const previewMax = Math.max(48, sideW - 24);
      const previewSize = Math.max(48, Math.min(previewSizeBase, previewMax));

      p.canvas.width = internalW;
      p.canvas.height = internalH;
      p.canvas.style.width = internalW + 'px';
      p.canvas.style.height = internalH + 'px';
      p.preview.width = previewSize;
      p.preview.height = previewSize;
      p.CELL = Math.floor(p.canvas.width / COLS);
    };

    applySizeFor(this.p1, 1);
    applySizeFor(this.p2, 2);
  }
}