export interface SessionRecapExportInput {
  displayName: string | null;
  walletAddress: string | null;
  runScore: number;
  pythIq: number;
  bossesDefeated: number;
  bossesReached: number;
  correctCount: number;
  questionsAnswered: number;
  frontrunPct: number | null;
  deltaPct: number | null;
}

function shortWallet(addr: string | null): string {
  if (!addr || addr.length < 10) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function downloadSessionRecapPng(data: SessionRecapExportInput): void {
  const T = {
    void0: "#0a0614",
    void1: "#1a0f2e",
    surface2: "rgba(255,255,255,0.06)",
    ink: "#EDE8F5",
    muted: "rgba(237, 232, 245, 0.55)",
    accent: "#A78BFA",
    accentLine: "rgba(167, 139, 250, 0.12)",
    dot: "rgba(167, 139, 250, 0.07)",
  } as const;

  const FONT = "Manrope, sans-serif";
  const DPR = 2;
  const W = 900;
  const H = 560;
  const PAD = 44;

  const canvas = document.createElement("canvas");
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
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

  const vignette = ctx.createRadialGradient(W * 0.45, H * 0.35, 80, W * 0.5, H * 0.5, W * 0.75);
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  let y = PAD;
  ctx.fillStyle = T.ink;
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText("Orra · Entropy Arena", PAD, y);
  y += 40;
  ctx.fillStyle = T.muted;
  ctx.font = `500 14px ${FONT}`;
  ctx.fillText("Session recap (scores & stats only)", PAD, y);
  y += 36;

  ctx.strokeStyle = T.accentLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 28;

  const label = (k: string, v: string) => {
    ctx.fillStyle = T.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(k.toUpperCase(), PAD, y);
    ctx.fillStyle = T.ink;
    ctx.font = `500 17px ${FONT}`;
    ctx.fillText(v, PAD + 200, y);
    y += 28;
  };

  label("Player", data.displayName?.trim() || "Anonymous");
  label("Wallet", shortWallet(data.walletAddress));
  label("Run score", String(data.runScore));
  label("Pyth IQ", String(data.pythIq));
  label("Bosses cleared", `${data.bossesDefeated} / ${data.bossesReached}`);
  label("Correct", `${data.correctCount} / ${data.questionsAnswered}`);
  if (data.frontrunPct != null) {
    label("vs leaderboard", `Ahead of ${data.frontrunPct}% of scores (sample)`);
  } else if (data.deltaPct != null) {
    const sign = data.deltaPct >= 0 ? "+" : "";
    label("vs mean", `${sign}${data.deltaPct}% vs mean score`);
  }

  ctx.fillStyle = T.accent;
  ctx.font = `italic 11px ${FONT}`;
  ctx.fillText("orra — Pyth-aligned quiz duel", PAD, H - PAD * 0.6);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orra-entropy-recap-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
