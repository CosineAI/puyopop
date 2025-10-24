// Player class

import {
  COLS, ROWS, EMPTY, GARBAGE, BASE_DROP_MS,
  SPEED_UP_EVERY, SPEED_FACTOR,
  GARBAGE_SEND_DELAY, GARBAGE_STEP_MS
} from './constants.js';
import { createGrid, offsetsForOri } from './utils.js';
import { Renderer } from './renderer.js';

export class Player {
  constructor(id, manager) {
    const canvas = document.getElementById(`game${id}`);
    const ctx = canvas.getContext('2d');
    const preview = document.getElementById(`next${id}`);
    const pctx = preview.getContext('2d');
    const hud = {
      score: document.getElementById(`score${id}`),
      chains: document.getElementById(`chains${id}`),
      speed: document.getElementById(`speed${id}`),
      lines: document.getElementById(`lines${id}`)
    };
    this.id = id;
    this.canvas = canvas;
    this.ctx = ctx;
    this.preview = preview;
    this.pctx = pctx;
    this.hud = hud;
    this.manager = manager;

    this.CELL = Math.floor(canvas.width / COLS);
    this.grid = createGrid(COLS, ROWS);
    this.active = null;
    this.nextPair = null;
    this.acc = 0;
    this.dropMs = BASE_DROP_MS;
    this.running = false;
    this.gameOver = false;
    this.score = 0;
    this.totalCleared = 0;
    this.chainShown = 0;
    this.incomingGarbage = 0;
    this.enemy = null;
    this.spawnCount = 0;
  }

  collides(x, y, ori) {
    const { ox, oy } = offsetsForOri(ori);
    const cells = [{ x, y }, { x: x + ox, y: y + oy }];
    for (const c of cells) {
      if (c.y < 0) continue;
      if (c.x < 0 || c.x >= COLS || c.y >= ROWS) return true;
      if (this.grid[c.y][c.x] !== EMPTY) return true;
    }
    return false;
  }

  spawn() {
    const pair = this.manager.getPair(this.spawnCount);
    this.active = { x: 2, y: -1, a: pair.a, b: pair.b, ori: 0 };
    if (this.collides(this.active.x, this.active.y, this.active.ori)) {
      this.manager.endGame(this);
      return;
    }
    this.spawnCount++;
    this.nextPair = this.manager.getPair(this.spawnCount);
    Renderer.drawPreview(this);
  }

  rotate(dir) {
    if (!this.active) return;
    const old = this.active.ori;
    const next = (old + (dir > 0 ? 1 : 3)) & 3;
    if (!this.collides(this.active.x, this.active.y, next)) {
      this.active.ori = next;
    } else if (!this.collides(this.active.x + (dir > 0 ? -1 : 1), this.active.y, next)) {
      this.active.x += (dir > 0 ? -1 : 1);
      this.active.ori = next;
    }
  }

  move(dx) {
    if (!this.active) return;
    if (!this.collides(this.active.x + dx, this.active.y, this.active.ori)) {
      this.active.x += dx;
    }
  }

  softDrop() {
    if (!this.active) return;
    if (!this.step()) {
      this.lockPiece();
    }
  }

  hardDrop() {
    if (!this.active) return;
    let moved = 0;
    while (!this.collides(this.active.x, this.active.y + 1, this.active.ori)) {
      this.active.y++;
      moved++;
    }
    this.score += moved * 2;
    this.lockPiece();
  }

  lockPiece() {
    if (!this.active) return;
    const { x, y, ori, a, b } = this.active;
    const { ox, oy } = offsetsForOri(ori);
    const cells = [
      { x, y, color: a },
      { x: x + ox, y: y + oy, color: b }
    ];

    for (const c of cells) {
      if (c.x < 0 || c.x >= COLS || c.y < 0 || c.y >= ROWS) {
        this.active = null;
        this.manager.endGame(this);
        return;
      }
    }

    for (const c of cells) {
      this.grid[c.y][c.x] = c.color;
    }
    this.active = null;
    this.resolveBoard();
  }

  step() {
    if (!this.active) return false;
    if (!this.collides(this.active.x, this.active.y + 1, this.active.ori)) {
      this.active.y++;
      return true;
    }
    return false;
  }

  gravity() {
    let moved = false;
    for (let x = 0; x < COLS; x++) {
      for (let y = ROWS - 2; y >= 0; y--) {
        if (this.grid[y][x] !== EMPTY && this.grid[y + 1][x] === EMPTY) {
          let ny = y;
          while (ny + 1 < ROWS && this.grid[ny + 1][x] === EMPTY) ny++;
          this.grid[ny][x] = this.grid[y][x];
          this.grid[y][x] = EMPTY;
          moved = true;
        }
      }
    }
    return moved;
  }

  gravityStep() {
    let moved = false;
    for (let y = ROWS - 2; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        if (this.grid[y][x] !== EMPTY && this.grid[y + 1][x] === EMPTY) {
          this.grid[y + 1][x] = this.grid[y][x];
          this.grid[y][x] = EMPTY;
          moved = true;
        }
      }
    }
    return moved;
  }

  applyGarbage(count) {
    if (count <= 0) return;

    let remaining = count;
    const placeOne = () => {
      if (remaining <= 0) {
        Renderer.draw(this);
        return;
      }
      let x = (Math.random() * COLS) | 0;
      let placedIdx = -1;
      for (let t = 0; t < COLS; t++) {
        const xi = (x + t) % COLS;
        if (this.grid[0][xi] === EMPTY) {
          placedIdx = xi;
          break;
        }
      }
      if (placedIdx === -1) {
        this.manager.endGame(this);
        return;
      }
      this.grid[0][placedIdx] = GARBAGE;
      Renderer.draw(this);

      const timer = setInterval(() => {
        const moved = this.gravityStep();
        Renderer.draw(this);
        if (!moved) {
          clearInterval(timer);
          remaining--;
          setTimeout(placeOne, GARBAGE_STEP_MS);
        }
      }, GARBAGE_STEP_MS);
    };

    placeOne();
  }

  sendGarbage(amount) {
    const target = this.enemy;
    if (!target || target.gameOver) return;
    target.incomingGarbage += amount;
    setTimeout(() => {
      const count = target.incomingGarbage;
      target.incomingGarbage = 0;
      target.applyGarbage(count);
    }, GARBAGE_SEND_DELAY);
  }

  resolveBoard() {
    let totalChain = 0;
    let totalThisLock = 0;
    let speedLines = 0;
    let garbageToSend = 0;

    const findGroups = () => {
      const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
      const groups = [];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const color = this.grid[y][x];
          if (color === EMPTY || color === GARBAGE || visited[y][x]) continue;
          const stack = [{ x, y }];
          const cells = [];
          visited[y][x] = true;
          while (stack.length) {
            const { x: cx, y: cy } = stack.pop();
            cells.push({ x: cx, y: cy });
            const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
            for (const [dx, dy] of dirs) {
              const nx = cx + dx, ny = cy + dy;
              if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
              if (visited[ny][nx]) continue;
              if (this.grid[ny][nx] === color) {
                visited[ny][nx] = true;
                stack.push({ x: nx, y: ny });
              }
            }
          }
          if (cells.length >= 4) groups.push(cells);
        }
      }
      return groups;
    };

    const clearGroups = (groups) => {
      let cleared = 0;
      const toClearGarbage = new Set();
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const g of groups) {
        for (const { x, y } of g) {
          this.grid[y][x] = EMPTY;
          cleared++;
          for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
            if (this.grid[ny][nx] === GARBAGE) {
              toClearGarbage.add(ny * COLS + nx);
            }
          }
        }
      }
      for (const key of toClearGarbage) {
        const nx = key % COLS;
        const ny = Math.floor(key / COLS);
        this.grid[ny][nx] = EMPTY;
      }
      return cleared;
    };

    const settleAll = () => {
      let moved;
      do {
        moved = this.gravity();
      } while (moved);
    };

    settleAll();
    Renderer.draw(this);

    const chainLoop = () => {
      const groups = findGroups();
      if (groups.length === 0) {
        this.score += totalThisLock;
        this.chainShown = totalChain;
        this.totalCleared += speedLines;
        Renderer.updateHud(this);

        const stages = Math.floor(this.totalCleared / SPEED_UP_EVERY);
        this.dropMs = BASE_DROP_MS * Math.pow(SPEED_FACTOR, stages);

        if (garbageToSend > 0) {
          this.sendGarbage(garbageToSend);
        }

        if (!this.gameOver) this.spawn();
        return;
      }
      totalChain++;
      const cleared = clearGroups(groups);
      garbageToSend += Math.max(0, Math.floor(cleared / 4) + (totalChain - 1));
      totalThisLock += cleared * 10 * Math.pow(2, Math.max(0, totalChain - 1));
      speedLines += cleared;
      Renderer.draw(this);
      setTimeout(() => {
        this.gravity();
        Renderer.draw(this);
        setTimeout(chainLoop, 120);
      }, 160);
    };

    chainLoop();
  }

  reset() {
    this.grid = createGrid(COLS, ROWS);
    this.active = null;
    this.spawnCount = 0;
    this.nextPair = this.manager.getPair(0);
    this.acc = 0;
    this.dropMs = BASE_DROP_MS;
    this.running = true;
    this.gameOver = false;
    this.score = 0;
    this.totalCleared = 0;
    this.chainShown = 0;
    Renderer.updateHud(this);
    this.spawn();
  }
}