export interface OrbitAnimState {
  collapse: boolean;
  expanse: boolean;
}

export interface OrbitPalette {
  bg: [number, number, number];
  star: [number, number, number];
}

export interface OrbitCanvasPersistence {
  /** Stable random seed so star field geometry survives full page reloads. */
  seed?: number;
  /** Shared time origin so rotation phase continues after refresh. */
  startTimeMs?: number;
}

const DEFAULT_PALETTE: OrbitPalette = {
  bg: [18, 9, 29],
  star: [210, 190, 255],
};

function rotate(cx: number, cy: number, x: number, y: number, angle: number): [number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const nx = cos * (x - cx) + sin * (y - cy) + cx;
  const ny = cos * (y - cy) - sin * (x - cx) + cy;
  return [nx, ny];
}

function sizeCanvasToContainer(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  g: CanvasRenderingContext2D,
): { cw: number; ch: number } {
  const rect = container.getBoundingClientRect();
  let w = Math.floor(rect.width);
  let h = Math.floor(rect.height);
  if (w < 2 || h < 2) {
    w = typeof window !== "undefined" ? window.innerWidth : 800;
    h = typeof window !== "undefined" ? window.innerHeight : 600;
  }
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cw: w, ch: h };
}

export function createOrbitCanvas(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  getAnim: () => OrbitAnimState,
  palette: OrbitPalette = DEFAULT_PALETTE,
  starCount = 1400,
  persistence?: OrbitCanvasPersistence,
): () => void {
  const ctxMaybe = canvas.getContext("2d");
  if (!ctxMaybe) return () => {};
  const g = ctxMaybe;

  g.globalCompositeOperation = "source-over";

  const [br, bg, bb] = palette.bg;
  const [sr, sg, sb] = palette.star;

  let cw = 0;
  let ch = 0;
  let centerx = 0;
  let centery = 0;
  const maxorbit = 255;

  const startTime = persistence?.startTimeMs ?? Date.now();
  let currentTime = 0;
  const seededRandom = (() => {
    const rawSeed = persistence?.seed;
    if (rawSeed == null) return Math.random;
    let t = (rawSeed >>> 0) || 1;
    return () => {
      // Mulberry32 PRNG: deterministic and tiny, good for reproducible visuals.
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  })();

  type Star = {
    orbital: number;
    x: number;
    y: number;
    yOrigin: number;
    speed: number;
    rotation: number;
    startRotation: number;
    id: number;
    collapseBonus: number;
    color: string;
    hoverPos: number;
    expansePos: number;
    prevR: number;
    prevX: number;
    prevY: number;
  };

  const stars: Star[] = [];

  // After first seed, resize rescales only (RO from layout must not re-randomize the field).
  let orbitStarsInitialized = false;

  function reseedStarsAndFrame() {
    const dims = sizeCanvasToContainer(canvas, container, g);
    cw = dims.cw;
    ch = dims.ch;
    centerx = cw / 2;
    centery = ch / 2;
    g.globalCompositeOperation = "source-over";
    g.lineWidth = 1;
    g.lineCap = "round";
    stars.length = 0;
    for (let i = 0; i < starCount; i++) {
      const rands = [seededRandom() * (maxorbit / 2) + 1, seededRandom() * (maxorbit / 2) + maxorbit];
      const orbital = rands.reduce((p, c) => p + c, 0) / rands.length;

      let collapseBonus = orbital - maxorbit * 0.7;
      if (collapseBonus < 0) collapseBonus = 0;

      const alpha = Math.min(0.24, 0.04 + (1 - orbital / 255) * 0.2);
      const color = `rgba(${sr},${sg},${sb},${alpha})`;

      const st: Star = {
        orbital,
        x: centerx,
        y: centery + orbital,
        yOrigin: centery + orbital,
        speed: (Math.floor(seededRandom() * 2.5) + 1.5) * (Math.PI / 180),
        rotation: 0,
        startRotation: (Math.floor(seededRandom() * 360) + 1) * (Math.PI / 180),
        id: i,
        collapseBonus,
        color,
        hoverPos: centery + maxorbit / 2 + collapseBonus,
        expansePos: centery + (i % 100) * -10 + (Math.floor(seededRandom() * 20) + 1),
        prevR: 0,
        prevX: centerx,
        prevY: centery + orbital,
      };
      st.prevR = st.startRotation;
      stars.push(st);
    }

    orbitStarsInitialized = true;

    g.fillStyle = `rgba(${br},${bg},${bb},1)`;
    g.fillRect(0, 0, cw, ch);
  }

  // Rescale on RO instead of reseeding — avoids visible “restart” when chrome/modals resize.
  function onContainerResize() {
    const prevCw = cw;
    const prevCh = ch;
    const prevCx = centerx;
    const prevCy = centery;
    const dims = sizeCanvasToContainer(canvas, container, g);
    const newCw = dims.cw;
    const newCh = dims.ch;

    g.globalCompositeOperation = "source-over";
    g.lineWidth = 1;
    g.lineCap = "round";

    if (orbitStarsInitialized && stars.length > 0) {
      if (prevCw > 0 && prevCh > 0) {
        if (newCw === prevCw && newCh === prevCh) {
          return;
        }
        const sx = newCw / prevCw;
        const sy = newCh / prevCh;
        cw = newCw;
        ch = newCh;
        centerx = cw / 2;
        centery = ch / 2;
        for (let i = 0; i < stars.length; i++) {
          const st = stars[i];
          st.x = (st.x - prevCx) * sx + centerx;
          st.y = (st.y - prevCy) * sy + centery;
          st.yOrigin = (st.yOrigin - prevCy) * sy + centery;
          st.hoverPos = (st.hoverPos - prevCy) * sy + centery;
          st.expansePos = (st.expansePos - prevCy) * sy + centery;
          st.prevX = (st.prevX - prevCx) * sx + centerx;
          st.prevY = (st.prevY - prevCy) * sy + centery;
        }
        g.fillStyle = `rgba(${br},${bg},${bb},1)`;
        g.fillRect(0, 0, cw, ch);
        return;
      }
      // Rare degenerate prev dims: keep the same star field, just match canvas size.
      cw = newCw;
      ch = newCh;
      centerx = cw / 2;
      centery = ch / 2;
      g.fillStyle = `rgba(${br},${bg},${bb},1)`;
      g.fillRect(0, 0, cw, ch);
      return;
    }

    reseedStarsAndFrame();
  }

  reseedStarsAndFrame();
  const kickId = window.requestAnimationFrame(() => {
    onContainerResize();
  });

  function drawStar(st: Star) {
    const { collapse, expanse } = getAnim();

    if (!expanse) {
      st.rotation = st.startRotation + currentTime * st.speed;
      if (!collapse) {
        if (st.y > st.yOrigin) st.y -= 2.5;
        if (st.y < st.yOrigin - 4) st.y += (st.yOrigin - st.y) / 10;
      } else {
        if (st.y > st.hoverPos) st.y -= (st.hoverPos - st.y) / -5;
        if (st.y < st.hoverPos - 4) st.y += 2.5;
      }
    } else {
      st.rotation = st.startRotation + currentTime * (st.speed / 2);
      if (st.y > st.expansePos) st.y -= Math.floor(st.expansePos - st.y) / -140;
    }

    g.save();
    g.fillStyle = st.color;
    g.strokeStyle = st.color;
    g.beginPath();
    const oldPos = rotate(centerx, centery, st.prevX, st.prevY, -st.prevR);
    g.moveTo(oldPos[0], oldPos[1]);
    g.translate(centerx, centery);
    g.rotate(st.rotation);
    g.translate(-centerx, -centery);
    g.lineTo(st.x, st.y);
    g.stroke();
    g.restore();

    st.prevR = st.rotation;
    st.prevX = st.x;
    st.prevY = st.y;
  }

  let raf = 0;
  const loop = () => {
    const now = Date.now();
    currentTime = (now - startTime) / 50;
    if (stars.length === 0) {
      raf = window.requestAnimationFrame(loop);
      return;
    }
    g.fillStyle = `rgba(${br},${bg},${bb},0.09)`;
    g.fillRect(0, 0, cw, ch);
    for (let i = 0; i < stars.length; i++) {
      drawStar(stars[i]);
    }
    raf = window.requestAnimationFrame(loop);
  };

  raf = window.requestAnimationFrame(loop);

  const ro = new ResizeObserver(() => {
    onContainerResize();
  });
  ro.observe(container);

  return () => {
    window.cancelAnimationFrame(kickId);
    window.cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.remove();
  };
}
