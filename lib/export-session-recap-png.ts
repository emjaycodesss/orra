import { normalizeAvatarUrl } from "@/lib/avatar-url";

/**
 * Inputs for rendering a shareable session recap image.
 * Shares the Orra dark palette; footer mark matches the reading export (logo + “rra”).
 */
interface SessionRecapExportInput {
  displayName: string | null;
  /** X / Twitter handle (with or without @). */
  twitterHandle: string | null;
  /** Profile image URL; may fail CORS — initials fallback is drawn instead. */
  avatarUrl: string | null;
  walletAddress: string | null;
  runScore: number;
  pythIq: number;
  bossesDefeated: number;
  bossesReached: number;
  correctCount: number;
  questionsAnswered: number;
  /** 1-based rank on full leaderboard; null if no submissions yet. */
  leaderboardRank: number | null;
}

/** Display handle with a single leading @. */
function formatXHandle(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (!t) return "";
  return t.startsWith("@") ? t : `@${t}`;
}

/** Two-letter fallback when the avatar image cannot be painted (CORS / missing). */
function profileInitials(
  displayName: string | null,
  twitterHandle: string | null,
  wallet: string | null,
): string {
  const name = displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const h = twitterHandle?.trim().replace(/^@/, "") ?? "";
  if (h.length >= 2) return h.slice(0, 2).toUpperCase();
  if (h.length === 1) return h.toUpperCase();
  if (wallet && wallet.length >= 6) return wallet.slice(2, 4).toUpperCase();
  return "?";
}

async function loadImageOrNull(src: string): Promise<HTMLImageElement | null> {
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image load failed"));
      img.src = src;
    });
  } catch {
    return null;
  }
}

/**
 * Renders a recap PNG (1100×720): editorial layout with clear hierarchy; async for fonts and assets.
 * Bottom-right brand mark matches `export-reading-png` (white disc + `/orra.svg` + “rra”).
 */
export async function downloadSessionRecapPng(data: SessionRecapExportInput): Promise<void> {
  const T = {
    void0: "#12091d",
    void1: "#161126",
    surface2: "#1f1734",
    surface3: "#2a2143",
    surface4: "#352b56",
    ink900: "#f2ebff",
    ink700: "#cfc2eb",
    ink500: "#ab99d0",
    ink400: "#8f7eb3",
    ink300: "#736291",
    accent: "#a78bfa",
    accentDim: "rgba(167, 139, 250, 0.35)",
    accentLine: "rgba(167, 139, 250, 0.12)",
    dot: "rgba(167, 139, 250, 0.07)",
  } as const;

  const FONT = "Manrope, sans-serif";
  const DPR = 2;
  const W = 1100;
  const H = 720;
  const PAD = 44;
  /** Keeps body clear of the reading-style footer mark. */
  const FOOTER_RISE = 56;

  await document.fonts.ready;

  let logoImg: HTMLImageElement | null = null;
  try {
    logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("logo"));
      img.src = "/orra.svg";
    });
  } catch {
    logoImg = null;
  }

  const avatarSrc = normalizeAvatarUrl(data.avatarUrl);
  const avatarImg = avatarSrc ? await loadImageOrNull(avatarSrc) : null;

  const canvas = document.createElement("canvas");
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context.");
  ctx.scale(DPR, DPR);

  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, T.void0);
  bgGrad.addColorStop(0.45, "#14102a");
  bgGrad.addColorStop(1, T.void1);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const wash = ctx.createLinearGradient(W, 0, 0, H);
  wash.addColorStop(0, "rgba(167, 139, 250, 0.14)");
  wash.addColorStop(0.35, "transparent");
  wash.addColorStop(1, "transparent");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = T.dot;
  for (let gx = 12; gx < W; gx += 24) {
    for (let gy = 12; gy < H; gy += 24) {
      ctx.beginPath();
      ctx.arc(gx, gy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const vignette = ctx.createRadialGradient(W * 0.55, H * 0.2, 40, W * 0.5, H * 0.55, W * 0.95);
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  const inkDesc = (m: TextMetrics, fallback: number) => {
    const a = m.actualBoundingBoxDescent;
    if (typeof a === "number" && a > 0) return a;
    const f = m.fontBoundingBoxDescent;
    if (typeof f === "number" && f > 0) return f;
    return fallback;
  };
  const inkAsc = (m: TextMetrics, fallback: number) => {
    const a = m.actualBoundingBoxAscent;
    if (typeof a === "number" && a > 0) return a;
    const f = m.fontBoundingBoxAscent;
    if (typeof f === "number" && f > 0) return f;
    return fallback;
  };

  const xHandle = formatXHandle(data.twitterHandle);
  /** Recap image shows X handle only (no display name). */
  const primaryLine = xHandle || "Guest";

  const avatarR = 46;
  const avatarCx = PAD + avatarR + 4;
  const avatarCy = PAD + avatarR + 6;

  ctx.save();
  ctx.shadowColor = "rgba(167, 139, 250, 0.4)";
  ctx.shadowBlur = 36;
  ctx.strokeStyle = "rgba(167, 139, 250, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR + 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = T.surface2;
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = T.accentLine;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg) {
    const iw = avatarImg.naturalWidth;
    const ih = avatarImg.naturalHeight;
    const scale = Math.max((avatarR * 2) / iw, (avatarR * 2) / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(avatarImg, avatarCx - dw / 2, avatarCy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = T.surface4;
    ctx.fillRect(avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, avatarR * 2);
    ctx.fillStyle = T.ink500;
    ctx.font = `800 34px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      profileInitials(data.displayName, data.twitterHandle, data.walletAddress),
      avatarCx,
      avatarCy,
    );
    ctx.textAlign = "left";
  }
  ctx.restore();

  ctx.strokeStyle = T.accentLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
  ctx.stroke();

  const textX = avatarCx + avatarR + 28;
  const textMaxW = W - PAD - textX - 32;
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = T.ink400;
  ctx.font = `700 11px ${FONT}`;
  ctx.letterSpacing = "0.16em";
  ctx.fillText("ORRA TRIVIA CLASH · RECAP", textX, PAD + 18);
  ctx.letterSpacing = "0em";

  ctx.fillStyle = T.ink900;
  let handleSize = 48;
  ctx.font = `800 ${handleSize}px ${FONT}`;
  while (handleSize >= 26 && ctx.measureText(primaryLine).width > textMaxW) {
    handleSize -= 2;
    ctx.font = `800 ${handleSize}px ${FONT}`;
  }
  const handleTrunc = primaryLine;
  const handleM = ctx.measureText(handleTrunc);
  const handleBaseline = PAD + 30 + inkAsc(handleM, Math.ceil(0.75 * handleSize));
  ctx.fillText(handleTrunc, textX, handleBaseline);
  const cursorY = handleBaseline + inkDesc(handleM, Math.ceil(0.22 * handleSize));

  const heroTop = Math.max(cursorY + 32, avatarCy + avatarR + 32);
  const heroLabelY = heroTop;
  const HERO_SPLIT = Math.round(W * 0.48);
  const scoreColMaxW = HERO_SPLIT - PAD - 32;
  const rankColMaxW = W - PAD - HERO_SPLIT - 24;

  ctx.fillStyle = T.accent;
  ctx.font = `800 13px ${FONT}`;
  ctx.letterSpacing = "0.22em";
  ctx.fillText("SCORE", PAD, heroLabelY);
  ctx.fillText("RANK", HERO_SPLIT, heroLabelY);
  ctx.letterSpacing = "0em";

  const scoreStr = String(data.runScore);
  const rankStr = data.leaderboardRank != null ? `#${data.leaderboardRank}` : "—";
  let scorePx = 108;
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 ${scorePx}px ${FONT}`;
  while (scorePx >= 56 && ctx.measureText(scoreStr).width > scoreColMaxW) {
    scorePx -= 4;
    ctx.font = `800 ${scorePx}px ${FONT}`;
  }
  const scoreM = ctx.measureText(scoreStr);
  const scoreAsc = inkAsc(scoreM, Math.ceil(0.78 * scorePx));
  const scoreBaseline = heroLabelY + 22 + scoreAsc;

  let rankPx = scorePx;
  ctx.font = `800 ${rankPx}px ${FONT}`;
  while (rankPx >= 36 && ctx.measureText(rankStr).width > rankColMaxW) {
    rankPx -= 2;
    ctx.font = `800 ${rankPx}px ${FONT}`;
  }
  rankPx = Math.min(rankPx, scorePx);

  const scoreGrad = ctx.createLinearGradient(PAD, scoreBaseline - scoreAsc, PAD + scoreM.width, scoreBaseline);
  scoreGrad.addColorStop(0, "#f5f0ff");
  scoreGrad.addColorStop(0.45, T.accent);
  scoreGrad.addColorStop(1, "#c4b5fd");
  ctx.fillStyle = scoreGrad;
  ctx.fillText(scoreStr, PAD, scoreBaseline);

  ctx.font = `800 ${rankPx}px ${FONT}`;
  const rankM = ctx.measureText(rankStr);
  if (data.leaderboardRank != null) {
    const rankGrad = ctx.createLinearGradient(
      HERO_SPLIT,
      scoreBaseline - inkAsc(rankM, Math.ceil(0.78 * rankPx)),
      HERO_SPLIT + rankM.width,
      scoreBaseline,
    );
    rankGrad.addColorStop(0, T.ink700);
    rankGrad.addColorStop(0.55, "#ddd6fe");
    rankGrad.addColorStop(1, T.accent);
    ctx.fillStyle = rankGrad;
  } else {
    ctx.fillStyle = T.ink400;
  }
  ctx.fillText(rankStr, HERO_SPLIT, scoreBaseline);

  const rankDesc = inkDesc(rankM, Math.ceil(0.2 * rankPx));
  const belowScoreY =
    scoreBaseline + Math.max(inkDesc(scoreM, Math.ceil(0.2 * scorePx)), rankDesc) + 18;

  /** Stat numerals stay below the hero score size so hierarchy stays obvious. */
  const maxStatValuePx = Math.max(36, scorePx - 10);

  const ruleY = belowScoreY + 8;
  const ruleGrad = ctx.createLinearGradient(PAD, ruleY, W - PAD, ruleY);
  ruleGrad.addColorStop(0, T.accent);
  ruleGrad.addColorStop(0.15, T.accentLine);
  ruleGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = ruleGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, ruleY);
  ctx.lineTo(W - PAD, ruleY);
  ctx.stroke();

  const gridTop = ruleY + 26;
  const gridBottom = H - FOOTER_RISE - PAD - 4;
  const gridH = Math.max(132, gridBottom - gridTop);
  const gutter = 18;
  const colW = (W - 2 * PAD - 2 * gutter) / 3;
  const radius = 14;

  type StatCell = { label: string; value: string };
  const cells: StatCell[] = [
    { label: "PYTH IQ", value: String(data.pythIq) },
    {
      label: "GUARDIANS DEFEATED",
      value: `${data.bossesDefeated}/${data.bossesReached}`,
    },
    {
      label: "ACCURACY",
      value: `${data.correctCount}/${data.questionsAnswered}`,
    },
  ];

  for (let i = 0; i < 3; i++) {
    const x0 = PAD + i * (colW + gutter);
    const cell = cells[i]!;

    ctx.fillStyle = "rgba(31, 23, 52, 0.72)";
    ctx.strokeStyle = T.accentLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x0, gridTop, colW, gridH, radius);
    ctx.fill();
    ctx.stroke();

    const cx = x0 + colW / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    const labelTop = gridTop + 38;
    const innerMax = colW - 32;
    ctx.fillStyle = T.ink400;
    let labelPx = 12;
    ctx.font = `800 ${labelPx}px ${FONT}`;
    ctx.letterSpacing = "0.12em";
    while (labelPx >= 9 && ctx.measureText(cell.label).width > innerMax) {
      labelPx -= 1;
      ctx.font = `800 ${labelPx}px ${FONT}`;
    }
    ctx.fillText(cell.label, cx, labelTop);
    ctx.letterSpacing = "0em";

    ctx.fillStyle = T.ink900;
    let valPx = Math.min(68, maxStatValuePx);
    ctx.font = `800 ${valPx}px ${FONT}`;
    while (valPx >= 32 && ctx.measureText(cell.value).width > innerMax) {
      valPx -= 2;
      ctx.font = `800 ${valPx}px ${FONT}`;
    }
    const vm = ctx.measureText(cell.value);
    const valueGap = 28;
    const vBaseline = labelTop + valueGap + inkAsc(vm, Math.ceil(0.72 * valPx));
    ctx.fillText(cell.value, cx, vBaseline);

    ctx.textAlign = "left";
  }

  const footerY = H - PAD - 12;
  const badgeR = 16;
  const wm = "rra";
  ctx.font = `italic 800 17px ${FONT}`;
  ctx.fillStyle = T.ink900;
  const textW = ctx.measureText(wm).width;
  const badgeToTextGap = 2;
  const blockRight = W - PAD;
  const textXFooter = blockRight - textW;
  const badgeCy = footerY;
  const prevBaseline = ctx.textBaseline;
  ctx.textBaseline = "middle";
  if (logoImg) {
    const badgeCx = textXFooter - badgeToTextGap - badgeR;
    ctx.save();
    ctx.beginPath();
    ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
    const logoInset = 2;
    const logoSide = (badgeR - logoInset) * 2;
    ctx.drawImage(logoImg, badgeCx - logoSide / 2, badgeCy - logoSide / 2, logoSide, logoSide);
  }
  ctx.fillText(wm, textXFooter, badgeCy);
  ctx.textBaseline = prevBaseline;

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png", 0.95);
  });
  if (!blob) throw new Error("Could not build the image file.");

  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `orra-trivia-recap-${Date.now()}.png`;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
