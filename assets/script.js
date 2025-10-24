// Puyo Pop Clone - minimal but complete implementation

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const preview = document.getElementById('next');
  const pctx = preview.getContext('2d');

  const scoreEl = document.getElementById('score');
  const chainsEl = document.getElementById('chains');
  const speedEl = document.getElementById('speed');
  const linesEl = document.getElementById('lines');
  const startBtn = document.getElementById('startBtn');

  // Board settings
  const COLS = 6;
  const ROWS = 12;
  const CELL = Math.floor(canvas.width / COLS); // 48 px with default canvas
  const COLORS = ['#ff4757', '#2ed573', '#1e90ff', '#ffa502', '#a55eea']; // R G B Y P
  const EMPTY = 0;

  // Timing
  const BASE_DROP_MS = 800; // base gravity
  const SPEED_UP_EVERY = 10; // lines
  const SPEED_FACTOR = 0.85;

  // State
  let grid = createGrid(COLS, ROWS);
  let active = null; // {x,y,dx,dy,colorA,colorB,orientation}
  let nextPair = makePair();
  let last = 0;
  let acc = 0;
  let dropMs = BASE_DROP_MS;
  let running = false;
  let gameOver = false;
  let score = 0;
  let totalCleared = 0;
  let chainShown = 0;

  function createGrid(w, h) {
    return Array.from({ length: h }, () => Array(w).fill(EMPTY));
  }

  function randChoice(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function makePair() {
    return { a: randChoice(COLORS), b: randChoice(COLORS) };
  }

  function spawn() {
    const pair = nextPair;
    nextPair = makePair();
    active = {
      x: 2,
      y: -1,
      dx: 0,
      dy: 1,
      a: pair.a, // primary at (x,y)
      b: pair.b, // secondary adjacent by orientation
      ori: 0 // 0: up, 1: right, 2: down, 3: left
    };
    if (collides(active.x, active.y, active.ori)) {
      endGame();
    }
    drawPreview();
  }

  function endGame() {
    running = false;
    gameOver = true;
  }

  function rotate(dir) {
    if (!active) return;
    const old = active.ori;
    const next = (old + (dir > 0 ? 1 : 3)) & 3;
    if (!collides(active.x, active.y, next)) {
      active.ori = next;
    } else if (!collides(active.x + (dir > 0 ? -1 : 1), active.y, next)) {
      // wall kick
      active.x += (dir > 0 ? -1 : 1);
      active.ori = next;
    }
  }

  function move(dx) {
    if (!active) return;
    if (!collides(active.x + dx, active.y, active.ori)) {
      active.x += dx;
    }
  }

  function softDrop() {
    if (!active) return;
    if (!step()) {
      lockPiece();
    }
  }

  function hardDrop() {
    if (!active) return;
    let moved = 0;
    while (!collides(active.x, active.y + 1, active.ori)) {
      active.y++;
      moved++;
    }
    score += moved * 2;
    lockPiece();
  }

  function offsetsForOri(ori) {
    // position of secondary relative to primary
    switch (ori & 3) {
      case 0: return { ox: 0, oy: -1 }; // up
      case 1: return { ox: 1, oy: 0 };  // right
      case 2: return { ox: 0, oy: 1 };  // down
      case 3: return { ox: -1, oy: 0 }; // left
    }
  }

  function collides(x, y, ori) {
    const { ox, oy } = offsetsForOri(ori);
    const cells = [
      { x, y },
      { x: x + ox, y: y + oy }
    ];
    for (const c of cells) {
      if (c.y < 0) continue; // allow above top
      if (c.x < 0 || c.x >= COLS || c.y >= ROWS) return true;
      if (grid[c.y][c.x] !== EMPTY) return true;
    }
    return false;
  }

  function lockPiece() {
    if (!active) return;
    const { x, y, ori, a, b } = active;
    const { ox, oy } = offsetsForOri(ori);
    const cells = [
      { x, y, color: a },
      { x: x + ox, y: y + oy, color: b }
    ];
    for (const c of cells) {
      if (c.y >= 0 && c.y < ROWS && c.x >= 0 && c.x < COLS) {
        grid[c.y][c.x] = c.color;
      } else {
        endGame();
      }
    }
    active = null;
    resolveBoard();
  }

  function step() {
    if (!active) return false;
    if (!collides(active.x, active.y + 1, active.ori)) {
      active.y++;
      return true;
    }
    return false;
  }

  function gravity() {
    // drop floating pieces
    let moved = false;
    for (let x = 0; x < COLS; x++) {
      for (let y = ROWS - 2; y >= 0; y--) {
        if (grid[y][x] !== EMPTY && grid[y + 1][x] === EMPTY) {
          let ny = y;
          while (ny + 1 < ROWS && grid[ny + 1][x] === EMPTY) ny++;
          grid[ny][x] = grid[y][x];
          grid[y][x] = EMPTY;
          moved = true;
        }
      }
    }
    return moved;
  }

  function resolveBoard() {
    let totalChain = 0;
    let totalThisLock = 0;
    let speedLines = 0;

    function findGroups() {
      const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
      const groups = [];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const color = grid[y][x];
          if (color === EMPTY || visited[y][x]) continue;
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
              if (grid[ny][nx] === color) {
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
      for (const g of groups) {
        for (const { x, y } of g) {
          grid[y][x] = EMPTY;
          cleared++;
        }
      }
      return cleared;
    }

    function chainScore(chainIndex, cleared) {
      // simple scoring: base 10 per puyo * chain multiplier
      const chainBonus = Math.pow(2, Math.max(0, chainIndex - 1)); // 1,2,4,8...
      return cleared * 10 * chainBonus;
    }

    // iterative chain resolution
    (function loopChain() {
      const groups = findGroups();
      if (groups.length === 0) {
        // done
        score += totalThisLock;
        chainShown = totalChain;
        totalCleared += speedLines;
        updateHud();
        // increase speed
        const stages = Math.floor(totalCleared / SPEED_UP_EVERY);
        dropMs = BASE_DROP_MS * Math.pow(SPEED_FACTOR, stages);
        // spawn next
        if (!gameOver) spawn();
        return;
      }
      totalChain++;
      const cleared = clearGroups(groups);
      totalThisLock += chainScore(totalChain, cleared);
      speedLines += cleared;
      draw(); // show cleared
      // after small delay, apply gravity then continue
      setTimeout(() => {
        gravity();
        draw();
        setTimeout(loopChain, 120);
      }, 160);
    })();
  }

  function drawCell(g, x, y, color, size) {
    const r = Math.floor(size * 0.2);
    g.fillStyle = color;
    g.beginPath();
    g.roundRect(x, y, size - 1, size - 1, r);
    g.fill();

    // highlight
    const grd = g.createLinearGradient(x, y, x + size, y + size);
    grd.addColorStop(0, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.roundRect(x + 3, y + 3, size - 7, size - 7, r - 2);
    g.fill();
  }

  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // backdrop grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(canvas.width, y * CELL + 0.5);
      ctx.stroke();
    }

    // cells
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = grid[y][x];
        if (c !== EMPTY) {
          drawCell(ctx, x * CELL + 2, y * CELL + 2, c, CELL - 3);
        }
      }
    }
  }

  function drawActive() {
    if (!active) return;
    const { x, y, ori, a, b } = active;
    const { ox, oy } = offsetsForOri(ori);
    const cells = [
      { x, y, color: a },
      { x: x + ox, y: y + oy, color: b }
    ];
    for (const c of cells) {
      if (c.y >= 0) {
        drawCell(ctx, c.x * CELL + 2, c.y * CELL + 2, c.color, CELL - 3);
      }
    }
  }

  function drawPreview() {
    pctx.clearRect(0, 0, preview.width, preview.height);
    const size = Math.floor(preview.width / 3);
    const startX = size;
    const startY = size / 2;
    drawCell(pctx, startX, startY, nextPair.a, size);
    drawCell(pctx, startX, startY + size + 4, nextPair.b, size);
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    chainsEl.textContent = String(chainShown);
    speedEl.textContent = `${(BASE_DROP_MS / dropMs).toFixed(1)}x`;
    linesEl.textContent = String(totalCleared);
  }

  function draw() {
    drawGrid();
    drawActive();
  }

  function tick(ts) {
    if (!running) {
      draw();
      return requestAnimationFrame(tick);
    }
    if (!last) last = ts;
    const dt = ts - last;
    last = ts;
    acc += dt;

    const stepMs = dropMs;
    while (acc >= stepMs) {
      acc -= stepMs;
      if (active) {
        if (!step()) {
          // lock delay minimal
          lockPiece();
        }
      } else {
        // waiting for resolution spawn will happen after resolve
      }
    }

    draw();
    requestAnimationFrame(tick);
  }

  function reset() {
    grid = createGrid(COLS, ROWS);
    active = null;
    nextPair = makePair();
    acc = 0;
    dropMs = BASE_DROP_MS;
    running = true;
    gameOver = false;
    score = 0;
    totalCleared = 0;
    chainShown = 0;
    updateHud();
    spawn();
  }

  // Input
  const keys = new Set();
  window.addEventListener('keydown', e => {
    if (gameOver && (e.key === 'r' || e.key === 'R' || e.code === 'Space')) {
      reset();
      return;
    }
    if (!running) return;
    if (keys.has(e.code)) return; // prevent auto-repeat for some actions
    keys.add(e.code);

    switch (e.code) {
      case 'ArrowLeft': move(-1); break;
      case 'ArrowRight': move(1); break;
      case 'ArrowDown': softDrop(); break;
      case 'ArrowUp': rotate(1); break;
      case 'KeyZ': rotate(-1); break;
      case 'KeyX': rotate(1); break;
      case 'Space': hardDrop(); break;
      case 'KeyR': reset(); break;
    }
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  startBtn?.addEventListener('click', reset);

  // Polyfill for roundRect when unavailable
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
  updateHud();
  drawPreview();
  draw();
  requestAnimationFrame(tick);
})();