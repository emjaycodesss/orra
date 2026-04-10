import { MAJOR_ARCANA, type CardOrientation } from "@/lib/cards";

function compactFeedSymbolForExport(symbol: string | undefined): string {
  if (!symbol?.trim()) return "";
  return symbol
    .replace(/^Crypto\./i, "")
    .replace(/^Equity\./i, "")
    .replace(/^Metal\./i, "")
    .replace(/^FX\./i, "")
    .trim();
}

function formatWalletForExport(addr: string | undefined): string {
  if (!addr || addr.length < 12) return "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

type DownloadReadingPngParams = {
  cardIndex: number;
  cardOrientation: CardOrientation;
  drawnDateStr: string;
  walletAddress: string | undefined;
  realm?: string;
  realmSymbol?: string;
  interpretation: string;
  sequenceNumberForFile: string;
};

/** Browser canvas → PNG download; throws on missing assets or context. */
export async function downloadReadingAsPng(params: DownloadReadingPngParams): Promise<void> {
  const {
    cardIndex,
    cardOrientation,
    drawnDateStr,
    walletAddress,
    realm,
    realmSymbol,
    interpretation,
    sequenceNumberForFile,
  } = params;

  const card = MAJOR_ARCANA[cardIndex];
  if (!card) throw new Error("Card data unavailable.");

  await document.fonts.ready;

  const cardImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load card image."));
    img.src = card.image;
  });
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
  const PAD = 48;

  const canvas = document.createElement("canvas");
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context.");
  ctx.scale(DPR, DPR);

  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, T.void0);
  bgGrad.addColorStop(0.5, "#130e22");
  bgGrad.addColorStop(1, T.void1);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = T.dot;
  for (let gx = 12; gx < W; gx += 24) {
    for (let gy = 12; gy < H; gy += 24) {
      ctx.beginPath();
      ctx.arc(gx, gy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const vignette = ctx.createRadialGradient(W * 0.45, H * 0.4, 100, W * 0.5, H * 0.5, W * 0.82);
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  const CARD_W = 280;
  const cardAspect = cardImg.naturalHeight / cardImg.naturalWidth;
  const CARD_H = CARD_W * cardAspect;
  const cardX = PAD;
  const cardY = (H - CARD_H) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(167, 139, 250, 0.55)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = "rgba(167, 139, 250, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(cardX - 0.5, cardY - 0.5, CARD_W + 1, CARD_H + 1);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = T.surface2;
  ctx.fillRect(cardX - 6, cardY - 6, CARD_W + 12, CARD_H + 12);
  ctx.restore();

  ctx.strokeStyle = T.accentLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(cardX - 6, cardY - 6, CARD_W + 12, CARD_H + 12);

  ctx.save();
  ctx.beginPath();
  ctx.rect(cardX, cardY, CARD_W, CARD_H);
  ctx.clip();
  if (cardOrientation === "reversed") {
    ctx.translate(cardX + CARD_W / 2, cardY + CARD_H / 2);
    ctx.rotate(Math.PI);
    ctx.drawImage(cardImg, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H);
  } else {
    ctx.drawImage(cardImg, cardX, cardY, CARD_W, CARD_H);
  }
  ctx.restore();

  const DIV_X = cardX + CARD_W + 36;
  const gradLine = ctx.createLinearGradient(DIV_X, cardY, DIV_X, H - PAD - 40);
  gradLine.addColorStop(0, "transparent");
  gradLine.addColorStop(0.3, T.accentLine);
  gradLine.addColorStop(0.7, T.accentLine);
  gradLine.addColorStop(1, "transparent");
  ctx.strokeStyle = gradLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(DIV_X, cardY);
  ctx.lineTo(DIV_X, H - PAD - 40);
  ctx.stroke();

  const TX = DIV_X + 36;
  const TW = W - TX - PAD;
  const GAP_BLOCK = 28;
  const GAP_META_ROW = 22;
  const GAP_AFTER_COLON = 12;

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

  const displayCardName =
    cardOrientation === "reversed" ? `${card.name} (Reversed)` : card.name;
  const compactSym = compactFeedSymbolForExport(realmSymbol);
  const pairValue = compactSym || realm?.trim() || "—";

  const walletShort = formatWalletForExport(walletAddress);
  const drawnRowValue =
    walletShort === "—" ? drawnDateStr : `${drawnDateStr} by ${walletShort}`;
  const sequenceDisplay =
    sequenceNumberForFile && sequenceNumberForFile !== "export"
      ? `#${sequenceNumberForFile}`
      : "—";

  /**
   * Alphabetic baselines tie the title to `cardY`; spacing before INTERPRETATION mirrors title→first-meta;
   * meta rows align via `drawMetaRow`.
   */
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = T.ink900;
  ctx.font = `700 30px ${FONT}`;
  const titleM = ctx.measureText(displayCardName);
  const titleAsc = inkAsc(titleM, Math.ceil(0.72 * 30));
  const titleDescRaw = inkDesc(titleM, Math.ceil(0.22 * 30));
  const titleBaseline = cardY + titleAsc;
  ctx.fillText(displayCardName, TX, titleBaseline);
  const titleInkBottom = titleBaseline + titleDescRaw;

  const drawLabel = (name: string) => `${name.toUpperCase()}:`;
  ctx.font = `600 9px ${FONT}`;
  ctx.letterSpacing = "0.08em";
  const drawnLabM = ctx.measureText(drawLabel("Drawn"));
  ctx.letterSpacing = "0em";
  const drawnLabelAsc = inkAsc(drawnLabM, 7);
  ctx.font = `500 14px ${FONT}`;
  const drawnValM = ctx.measureText(drawnRowValue);
  const drawnValAsc = inkAsc(drawnValM, 10);
  const metaVisualAsc = Math.max(drawnLabelAsc, drawnValAsc);
  let y = titleInkBottom + GAP_BLOCK + metaVisualAsc;
  const yDrawnBaseline = y;
  const visualGapTitleToFirstMeta = yDrawnBaseline - metaVisualAsc - titleInkBottom;

  const drawMetaRow = (label: string, value: string) => {
    const labelText = `${label.toUpperCase()}:`;
    ctx.fillStyle = T.ink400;
    ctx.font = `600 9px ${FONT}`;
    ctx.letterSpacing = "0.08em";
    ctx.fillText(labelText, TX, y);
    ctx.letterSpacing = "0em";
    const labelW = ctx.measureText(labelText).width + GAP_AFTER_COLON;
    ctx.fillStyle = T.ink700;
    ctx.font = `500 14px ${FONT}`;
    ctx.fillText(value, TX + labelW, y);
    y += GAP_META_ROW;
  };

  drawMetaRow("Drawn", drawnRowValue);
  drawMetaRow("Sequence", sequenceDisplay);
  const yPairBaseline = y;
  drawMetaRow("Pair", pairValue);

  ctx.font = `600 9px ${FONT}`;
  ctx.letterSpacing = "0.08em";
  const pairLabM = ctx.measureText(drawLabel("Pair"));
  ctx.letterSpacing = "0em";
  const pairLabDesc = inkDesc(pairLabM, 2);
  ctx.font = `500 14px ${FONT}`;
  const pairValM = ctx.measureText(pairValue);
  const pairValDesc = inkDesc(pairValM, 4);
  const yPairInkBottom = yPairBaseline + Math.max(pairLabDesc, pairValDesc);

  ctx.font = `600 9px ${FONT}`;
  ctx.letterSpacing = "0.1em";
  const interpLabel = "INTERPRETATION:";
  const interpLabelM = ctx.measureText(interpLabel);
  ctx.letterSpacing = "0em";
  const interpAsc = inkAsc(interpLabelM, 7);

  y = yPairInkBottom + visualGapTitleToFirstMeta + interpAsc;

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = T.ink400;
  ctx.font = `600 9px ${FONT}`;
  ctx.letterSpacing = "0.1em";
  ctx.fillText(interpLabel, TX, y);
  ctx.letterSpacing = "0em";
  y += GAP_META_ROW;

  const footerY = H - PAD - 12;
  const interpFooterClearance = 22;
  ctx.fillStyle = T.ink700;
  ctx.font = `400 15px ${FONT}`;
  const LINE_H = GAP_META_ROW;
  const interpMaxY = footerY - interpFooterClearance;
  const rawLineSlots = Math.floor(Math.max(0, interpMaxY - y) / LINE_H);
  const MAX_LINES = Math.min(22, Math.max(0, rawLineSlots));
  const interpText = interpretation.trim() || card.meaning;
  const words = interpText.split(/\s+/);
  let line = "";
  let lineCount = 0;
  if (MAX_LINES > 0) {
    for (const word of words) {
      if (!word) continue;
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > TW && line) {
        if (lineCount === MAX_LINES - 1) {
          ctx.fillText(`${line}\u2026`, TX, y);
        } else {
          ctx.fillText(line, TX, y);
        }
        y += LINE_H;
        lineCount++;
        if (lineCount >= MAX_LINES) break;
        line = word;
      } else {
        line = test;
      }
    }
    if (line && lineCount < MAX_LINES) {
      ctx.fillText(line, TX, y);
      y += LINE_H;
    }
  }

  const badgeR = 16;
  const wm = "rra";
  ctx.font = `italic 800 17px ${FONT}`;
  ctx.fillStyle = T.ink900;
  const textW = ctx.measureText(wm).width;
  const badgeToTextGap = 2;
  const blockRight = W - PAD;
  const textX = blockRight - textW;
  const badgeCy = footerY;
  const prevBaseline = ctx.textBaseline;
  ctx.textBaseline = "middle";
  if (logoImg) {
    const badgeCx = textX - badgeToTextGap - badgeR;
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
  ctx.fillText(wm, textX, badgeCy);
  ctx.textBaseline = prevBaseline;

  const fileName = `orra-reading-${sequenceNumberForFile}.png`;
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png", 0.95);
  });
  if (!blob) throw new Error("Could not build the image file.");

  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileName;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
