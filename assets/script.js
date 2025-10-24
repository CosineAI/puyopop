// Puyo Pop Clone — Two Player with Garbage and Responsive Scaling

(() => {
  // Board settings
  const COLS = 6;
  const ROWS = 12;
  const COLORS = ['#ff4757', '#2ed573', '#1e90ff', '#ffa502', '#a55eea'];
  const EMPTY = 0;
  const GARBAGE = -1;
  const GARBAGE_COLOR = '#69707b';
  const EYE_STYLE_BY_COLOR = {
    '#ff4757': 'bigCute',       // red
    '#2ed573': 'sleepy',        // green
    '#1e90ff': 'wandering',     // blue
    '#ffa502': 'blinking',      // yellow
    '#a55eea': 'smallFocused'   // purple
  };
  const EYE_IRIS_COLORS = {
    '#ff4757': { inner: '#ff8896', mid: '#e03a4d', rim: '#8d1f2d' },
    '#2ed573': { inner: '#7ef2b9', mid: '#28c987', rim: '#167350' },
    '#1e90ff': { inner: '#7fc1ff', mid: '#2e79d9', rim: '#184278' },
    '#ffa502': { inner: '#ffd38a', mid: '#f1a300', rim: '#9a5c00' },
    '#a55eea': { inner: '#d0a7ff', mid: '#7c4fd8', rim: '#412283' }
  };
  let animTimeMs = 0;

  // Timing
  const BASE_DROP_MS = 1600; // Start at half the speed (slower fall)
  const SPEED_UP_EVERY = 10;
  const SPEED_FACTOR = 0.85;
  // Garbage animation timing
  const GARBAGE_SEND_DELAY = 700;   // delay before garbage starts dropping on opponent
  const GARBAGE_STEP_MS = 100;      // per-step fall speed for garbage animation

  function createGrid(w, h) {
    return Array.from({ length: h }, () => Array(w).fill(EMPTY));
  }
  function randChoice(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function makePair() { return { a: randChoice(COLORS), b: randChoice(COLORS) }; }

  function offsetsForOri(ori) {
    switch (ori & 3) {
      case 0: return { ox: 0, oy: -1 }; // up
      case 1: return { ox: 1, oy: 0 };  // right
      case 2: return { ox: 0, oy: 1 };  // down
      case 3: return { ox: -1, oy: 0 }; // left
    }
  }

  function drawCell(g, x, y, color, size) {
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

    // Cheek blush (kept subtle)
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

    // Eyes: pupils only (no sclera/iris/lashes)
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
      pupilR = eyeR * 0.36;
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
      // Pupil
      g.beginPath();
      g.arc(px, py, pr, 0, Math.PI * 2);
      g.closePath();
      g.fillStyle = '#0d1224';
      g.fill();
      // Shine
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

  function makePlayer(id) {
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
    return {
      id,
      canvas, ctx, preview, pctx, hud,
      CELL: Math.floor(canvas.width / COLS),
      grid: createGrid(COLS, ROWS),
      active: null,
      nextPair: makePair(),
      acc: 0,
      dropMs: BASE_DROP_MS,
      running: false,
      gameOver: false,
      score: 0,
      totalCleared: 0,
      chainShown: 0,
      incomingGarbage: 0,
      enemy: null
    };
  }

  function collides(p, x, y, ori) {
    const { ox, oy } = offsetsForOri(ori);
    const cells = [{ x, y }, { x: x + ox, y: y + oy }];
    for (const c of cells) {
      if (c.y < 0) continue;
      if (c.x < 0 || c.x >= COLS || c.y >= ROWS) return true;
      if (p.grid[c.y][c.x] !== EMPTY) return true;
    }
    return false;
  }

  function spawn(p) {
    const pair = p.nextPair;
    p.nextPair = makePair();
    p.active = {
      x: 2,
      y: -1,
      a: pair.a,
      b: pair.b,
      ori: 0
    };
    if (collides(p, p.active.x, p.active.y, p.active.ori)) {
      endGame(p);
    }
    drawPreview(p);
  }

  function endGame(p) {
    p.running = false;
    p.gameOver = true;
  }

  function rotate(p, dir) {
    if (!p.active) return;
    const old = p.active.ori;
    const next = (old + (dir > 0 ? 1 : 3)) & 3;
    if (!collides(p, p.active.x, p.active.y, next)) {
      p.active.ori = next;
    } else if (!collides(p, p.active.x + (dir > 0 ? -1 : 1), p.active.y, next)) {
      p.active.x += (dir > 0 ? -1 : 1);
      p.active.ori = next;
    }
  }

  function move(p, dx) {
    if (!p.active) return;
    if (!collides(p, p.active.x + dx, p.active.y, p.active.ori)) {
      p.active.x += dx;
    }
  }

  function softDrop(p) {
    if (!p.active) return;
    if (!step(p)) {
      lockPiece(p);
    }
  }

  function hardDrop(p) {
    if (!p.active) return;
    let moved = 0;
    while (!collides(p, p.active.x, p.active.y + 1, p.active.ori)) {
      p.active.y++;
      moved++;
    }
    p.score += moved * 2;
    lockPiece(p);
  }

  function lockPiece(p) {
    if (!p.active) return;
    const { x, y, ori, a, b } = p.active;
    const { ox, oy } = offsetsForOri(ori);
    const cells = [
      { x, y, color: a },
      { x: x + ox, y: y + oy, color: b }
    ];

    // If any part is out-of-bounds (including above the top), end the game and don't place
    for (const c of cells) {
      if (c.x < 0 || c.x >= COLS || c.y < 0 || c.y >= ROWS) {
        endGame(p);
        p.active = null;
        return;
      }
    }

    // Place both halves
    for (const c of cells) {
      p.grid[c.y][c.x] = c.color;
    }
    p.active = null;
    resolveBoard(p);
  }

  function step(p) {
    if (!p.active) return false;
    if (!collides(p, p.active.x, p.active.y + 1, p.active.ori)) {
      p.active.y++;
      return true;
    }
    return false;
  }

  function gravity(p) {
    let moved = false;
    for (let x = 0; x < COLS; x++) {
      for (let y = ROWS - 2; y >= 0; y--) {
        if (p.grid[y][x] !== EMPTY && p.grid[y + 1][x] === EMPTY) {
          let ny = y;
          while (ny + 1 < ROWS && p.grid[ny + 1][x] === EMPTY) ny++;
          p.grid[ny][x] = p.grid[y][x];
          p.grid[y][x] = EMPTY;
          moved = true;
        }
      }
    }
    return moved;
  }

  // Single-step gravity used for animated garbage falling
  function gravityStep(p) {
    let moved = false;
    for (let y = ROWS - 2; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        if (p.grid[y][x] !== EMPTY && p.grid[y + 1][x] === EMPTY) {
          p.grid[y + 1][x] = p.grid[y][x];
          p.grid[y][x] = EMPTY;
          moved = true;
        }
      }
    }
    return moved;
  }

  // Garbage mechanics (animated slow drop)
  function applyGarbage(p, count) {
    if (count <= 0) return;

    let remaining = count;

    function placeOne() {
      if (remaining <= 0) {
        draw(p);
        return;
      }
      // Choose a column with an empty top cell
      let x = (Math.random() * COLS) | 0;
      let placedIdx = -1;
      for (let t = 0; t < COLS; t++) {
        const xi = (x + t) % COLS;
        if (p.grid[0][xi] === EMPTY) {
          placedIdx = xi;
          break;
        }
      }
      if (placedIdx === -1) {
        // No room at the top – game over for target
        endGame(p);
        return;
      }

      // Place a single garbage block at the top
      p.grid[0][placedIdx] = GARBAGE;
      draw(p);

      // Animate its fall by stepping gravity
      const timer = setInterval(() => {
        const moved = gravityStep(p);
        draw(p);
        if (!moved) {
          clearInterval(timer);
          remaining--;
          // Small delay between pieces
          setTimeout(placeOne, GARBAGE_STEP_MS);
        }
      }, GARBAGE_STEP_MS);
    }

    placeOne();
  }

  function sendGarbage(sender, amount) {
    const target = sender.enemy;
    if (!target || target.gameOver) return;
    target.incomingGarbage += amount;
    setTimeout(() => {
      const count = target.incomingGarbage;
      target.incomingGarbage = 0;
      applyGarbage(target, count);
    }, GARBAGE_SEND_DELAY);
  }

  function resolveBoard(p) {
    let totalChain = 0;
    let totalThisLock = 0;
    let speedLines = 0;
    let garbageToSend = 0;

    function findGroups() {
      const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
      const groups = [];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const color = p.grid[y][x];
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
              if (p.grid[ny][nx] === color) {
                visited[ny][nx] = true;
                stack.push({ x: nx, y: ny });
              }
            }
          }
          if (cells.length >= 4) groups.push(cells);
        }
      }
      return groups;
    }

    function clearGroups(groups) {
      let cleared = 0;
      const toClearGarbage = new Set();
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

      for (const g of groups) {
        for (const { x, y } of g) {
          p.grid[y][x] = EMPTY;
          cleared++;
          for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
            if (p.grid[ny][nx] === GARBAGE) {
              toClearGarbage.add(ny * COLS + nx);
            }
          }
        }
      }
      for (const key of toClearGarbage) {
        const nx = key % COLS;
        const ny = Math.floor(key / COLS);
        p.grid[ny][nx] = EMPTY;
      }

      return cleared;
    }

    function chainScore(chainIndex, cleared) {
      const chainBonus = Math.pow(2, Math.max(0, chainIndex - 1));
      return cleared * 10 * chainBonus;
    }

    function settleAll() {
      let moved;
      do {
        moved = gravity(p);
      } while (moved);
    }

    settleAll();
    draw(p);

    (function loopChain() {
      const groups = findGroups();
      if (groups.length === 0) {
        p.score += totalThisLock;
        p.chainShown = totalChain;
        p.totalCleared += speedLines;
        updateHud(p);

        const stages = Math.floor(p.totalCleared / SPEED_UP_EVERY);
        p.dropMs = BASE_DROP_MS * Math.pow(SPEED_FACTOR, stages);

        if (garbageToSend > 0) {
          sendGarbage(p, garbageToSend);
        }

        if (!p.gameOver) spawn(p);
        return;
      }
      totalChain++;
      const cleared = clearGroups(groups);
      garbageToSend += Math.max(0, Math.floor(cleared / 4) + (totalChain - 1));
      totalThisLock += chainScore(totalChain, cleared);
      speedLines += cleared;
      draw(p);
      setTimeout(() => {
        gravity(p);
        draw(p);
        setTimeout(loopChain, 120);
      }, 160);
    })();
  }

  function drawGrid(p) {
    p.ctx.clearRect(0, 0, p.canvas.width, p.canvas.height);
    p.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
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
          const color = cell === GARBAGE ? GARBAGE_COLOR : cell;
          drawCell(p.ctx, x * p.CELL + 2, y * p.CELL + 2, color, p.CELL - 3);
        }
      }
    }
  }

  function drawActive(p) {
    if (!p.active) return;
    const { x, y, ori, a, b } = p.active;
    const { ox, oy } = offsetsForOri(ori);
    const cells = [{ x, y, color: a }, { x: x + ox, y: y + oy, color: b }];
    for (const c of cells) {
      if (c.y >= 0) {
        drawCell(p.ctx, c.x * p.CELL + 2, c.y * p.CELL + 2, c.color, p.CELL - 3);
      }
    }
  }

  function drawPreview(p) {
    p.pctx.clearRect(0, 0, p.preview.width, p.preview.height);
    const size = Math.floor(p.preview.width / 3);
    const startX = size;
    const startY = size / 2;
    drawCell(p.pctx, startX, startY, p.nextPair.a, size);
    drawCell(p.pctx, startX, startY + size + 4, p.nextPair.b, size);
  }

  function updateHud(p) {
    p.hud.score.textContent = String(p.score);
    p.hud.chains.textContent = String(p.chainShown);
    p.hud.speed.textContent = `${(BASE_DROP_MS / p.dropMs).toFixed(1)}x`;
    p.hud.lines.textContent = String(p.totalCleared);
  }

  function draw(p) {
    drawGrid(p);
    drawActive(p);
  }

  const p1 = makePlayer(1);
  const p2 = makePlayer(2);
  p1.enemy = p2;
  p2.enemy = p1;
  const players = [p1, p2];

  // Player mode control (1P/2P)
  let playersMode = 2;

  function applyModeUI() {
    const p2El = document.getElementById('player2');
    if (!p2El) return;
    if (playersMode === 1) {
      p2El.classList.add('hidden-player');
    } else {
      p2El.classList.remove('hidden-player');
    }
  }

  function setMode(count) {
    playersMode = count;
    if (count === 1) {
      // Disable Player 2 logic and unlink enemies
      p2.running = false;
      p2.gameOver = true;
      p2.active = null;
      p2.acc = 0;
      p1.enemy = null;
      p2.enemy = null;
    } else {
      // Re-enable link; start happens on reset
      p2.gameOver = false;
      p1.enemy = p2;
      p2.enemy = p1;
    }
    applyModeUI();
    resize();
    drawPreview(p1); drawPreview(p2);
    draw(p1); draw(p2);
  }

  function resetByMode() {
    if (playersMode === 1) {
      resetPlayer(p1);
      p2.running = false;
      p2.gameOver = true;
      p2.active = null;
      p2.acc = 0;
      p1.enemy = null;
      p2.enemy = null;
    } else {
      players.forEach(resetPlayer);
      p1.enemy = p2;
      p2.enemy = p1;
    }
    resize();
    drawPreview(p1); drawPreview(p2);
    draw(p1); draw(p2);
  }

  // Mode toggle UI
  const mode1Radio = document.getElementById('mode1p');
  const mode2Radio = document.getElementById('mode2p');
  if (mode1Radio) {
    mode1Radio.addEventListener('change', (e) => {
      if (e.target.checked) setMode(1);
    });
  }
  if (mode2Radio) {
    mode2Radio.addEventListener('change', (e) => {
      if (e.target.checked) setMode(2);
    });
  }
  // Initialize mode from UI
  setMode(mode2Radio && mode2Radio.checked ? 2 : 1);

  function resetPlayer(p) {
    p.grid = createGrid(COLS, ROWS);
    p.active = null;
    p.nextPair = makePair();
    p.acc = 0;
    p.dropMs = BASE_DROP_MS;
    p.running = true;
    p.gameOver = false;
    p.score = 0;
    p.totalCleared = 0;
    p.chainShown = 0;
    updateHud(p);
    spawn(p);
  }

  function resetBoth() {
    // Deprecated: use resetByMode()
    resetByMode();
  }

  let last = 0;
  function tick(ts) {
    animTimeMs = ts;
    if (!last) last = ts;
    const dt = ts - last;
    last = ts;

    for (const p of players) {
      if (!p.running) continue;
      p.acc += dt;
      const stepMs = p.dropMs;
      while (p.acc >= stepMs) {
        p.acc -= stepMs;
        if (p.active) {
          if (!step(p)) {
            lockPiece(p);
          }
        }
      }
      draw(p);
    }
    requestAnimationFrame(tick);
  }

  // Input
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
      case 'KeyA': move(p1, -1); break;
      case 'KeyD': move(p1, 1); break;
      case 'KeyS': softDrop(p1); break;
      case 'KeyF': rotate(p1, -1); break;
      case 'KeyG': rotate(p1, 1); break;
      case 'KeyW': hardDrop(p1); break;
    }

    // Player 2
    switch (e.code) {
      case 'ArrowLeft': move(p2, -1); break;
      case 'ArrowRight': move(p2, 1); break;
      case 'ArrowDown': softDrop(p2); break;
      case 'ArrowUp': hardDrop(p2); break;
      case 'Comma': rotate(p2, -1); break;
      case 'Period': rotate(p2, 1); break;
    }

    if (e.code === 'KeyR') {
      const btn = document.getElementById('startBtn');
      if (btn) btn.blur();
      resetByMode();
  }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space') e.preventDefault();
    keys.delete(e.code);
  });

  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      startBtn.blur();
      resetByMode();
    });
  }

  function resize() {
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

    function sideWidthFor(id) {
      const el = document.querySelector(`#player${id} .hud-side`);
      return el ? el.offsetWidth : 160;
    }

    function applySizeFor(p, id) {
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
    }

    applySizeFor(p1, 1);
    applySizeFor(p2, 2);
  }

  // Polyfill
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      this.beginPath();
      this.moveTo(x + rr, y);
      this.arcTo(x + w, y, x + w, y + h, rr);
      this.arcTo(x + w, y + h, x, y + h, rr);
      this.arcTo(x, y + h, x, y, rr);
      this.arcTo(x, y, x + w, y, rr);
      return this;
    };
  }

  // Init
  resize();
  updateHud(p1); updateHud(p2);
  drawPreview(p1); drawPreview(p2);
  draw(p1); draw(p2);
  window.addEventListener('resize', () => {
    resize();
    drawPreview(p1); drawPreview(p2);
    draw(p1); draw(p2);
  });
  requestAnimationFrame(tick);
})();