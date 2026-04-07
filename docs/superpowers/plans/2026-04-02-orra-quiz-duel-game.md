# Orra Quiz Duel (Pyth Oracle Trials) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a separate `/game` experience that combines a Pyth-education quiz with a turn-based RPG duel UI, three verifiable Major Arcana power-ups per session (Entropy v2), and oracle-driven difficulty/context from Pyth Price Feeds / Pro—**without changing** the existing **`/reading` single-card draw** (same contract, flow, and UX as today).

**Architecture:** New Next.js route segment under `app/game/` with client duel state machine; server routes for **question generation** (static bank + Pyth-backed templates using existing `app/api/pyth-*` patterns and `PYTH_PRO_TOKEN`); **new Solidity consumer** (or `OrraDuel.sol`) that requests Entropy once per session and emits **three** derived card indices from a single `bytes32` via `keccak256(abi.encodePacked(randomNumber, uint8(i)))` for `i ∈ {0,1,2}` (independent uniform draws mod 22; allow duplicates or add rejection loop off-chain for UX). Optional **session commitment** hash binds power-ups to wallet + timestamp + opponent id. **One full run** = **three duels** (weakest → strongest NPC); see **Session length & questions** below. **Leaderboard** = server-persisted scores (wallet + optional display handle) after **session end**—requires a **database** or BaaS (see Leaderboard section). **One shareable performance card** (single layout) appears **once** when the session ends (**full clear or early exit**); it is **stats-only**—**no win/loss** wording or outcome badges—and compares to global aggregates like the reading flow’s **downloadable PNG** (see [`lib/export-reading-png.ts`](lib/export-reading-png.ts) / `downloadReadingAsPng` in [`app/reading/ReadingPageClient.tsx`](app/reading/ReadingPageClient.tsx)). X/Twitter avatar: **server-only** proxy to **TweetIQ** `POST https://tweetiq.onrender.com/api/analyze/profile` with body `{"username": "<handle>"}` (no `@` prefix); map JSON response to display name + profile image for the duel portrait row. Fallback: manual name + image URL if the service errors or cold-starts.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind, wagmi v2, RainbowKit, viem, Foundry, Pyth Entropy v2 SDK ([docs](https://docs.pyth.network/entropy)), Pyth Pro HTTP/WS ([benchmarks / Lazer](https://docs.pyth.network/)).

**Design reference (UX only):** Turn-based duel layout (dual portraits, HP bars, battle log) inspired by [this CodePen RPG shell](https://codepen.io/editor/wpgmb/pen/019d01d6-d54c-7d8e-aa3d-62f93fe0f707)—reimplement in React; do not embed CodePen in production.

---

## Product: mode labels (10 + 10)

Use on a **hub** page (e.g. `/` tab row or dedicated `/play`) so users pick an experience without duplicating the draw implementation.

### Navigation and payment flow (correct order)

1. **Connect wallet** on the hub (or use existing global connect)—**no Entropy fee yet.**  
2. User chooses **either**  
   - **Single card draw** → navigate to **`/reading`** — existing Orra reading flow **unchanged** (intent, snapshot, pay per draw as implemented today), **or**  
   - **Game mode** → navigate to **`/game`**.  
3. **Only on `/game`:** after wallet is connected, user pays **one Entropy v2 fee** to draw **3 booster cards** for that run; UI uses `watchContractEvent` / logs for `BoostersDrawn`, then enables **Start run** / **Enter Arena** (duel + quiz).  
4. **Never** require the game booster payment to browse the hub or to use **`/reading`**.

**Anti-pattern (avoid):** Taking booster payment immediately after connect before the user has chosen game vs reading.

### “Game Mode” (quiz + duel → `/game`) — name options

1. **Entropy Arena** — headline Pyth RNG + combat framing  
2. **Oracle Trials** — initiation / education tone  
3. **Publisher Gauntlet** — nods to multi-publisher oracle model  
4. **Truth Layer Duel** — “truth layer” meme, still serious enough for engineers  
5. **Lazer Labyrinth** — Pyth Lazer / low-latency vibe  
6. **Benchmark Boss Rush** — wink at TradingView/benchmarks tooling  
7. **Confidence Coliseum** — ties to oracle confidence / spread as difficulty knob  
8. **Feedbreaker Championship** — CT energy, still on-theme  
9. **Initiation: Shadow Fork** — playful; copy clarifies “educational sim, not a chain fork”  
10. **The Hermetica of Pyth** — tarot + gnosis + brand (use if you want less degen)

### “Single Card Draw” (existing → `/reading`) — name options

1. **The Verifiable Draw** — engineering clarity  
2. **Solo Sigil** — short, mystical  
3. **Snapshot Rite** — matches committed oracle snapshot  
4. **Lone Entropy Pull** — explicit RNG source  
5. **Whisper From The Feed** — matches oracle “whispers” copy  
6. **Cardinal Pull** — Major Arcana only  
7. **Anchor Reading** — on-chain anchor narrative  
8. **Quiet Commitment** — contemplative counterpart to arena  
9. **One Oracle Answer** — plain-language for newcomers  
10. **The Major Passage** — deck constraint explicit  

**Recommendation:** Hub primary CTA **Entropy Arena**; secondary **The Verifiable Draw** → `/reading`.

---

## Game theory core (numbers are tunable)

### Session length and questions (explicit)

A **full session** (one leaderboard-eligible **run**) consists of **exactly three duels**, one after another, against **three NPCs ordered weakest → strongest**. You **cannot** skip to boss 3 without beating 1 and 2.

**Per duel (one NPC):**

- **Question budget:** Up to **7 questions** per duel (hard cap). Each step presents **one** question (TF or MCQ).  
- **Early win / loss:** If **opponent HP ≤ 0** before the 7th question, that duel ends immediately (**you win** the round). If **player HP ≤ 0**, you **lose the run** (session over unless **Judgement** revive applies—see power-ups).  
- **If 7 questions are exhausted** and both are still alive: **higher current HP wins** the duel; if HP is **tied**, play **one** sudden-death True/False (no power-ups on that card unless you allow it in tuning).

**Per full session (all three NPCs):**

- **Maximum questions:** **3 duels × 7 = 21 questions** if every duel goes to the cap (plus at most **2** sudden-death TFs if ties occur—document as edge case).  
- **Typical length:** Fewer than 21 when you kill an opponent early (e.g. ~7 correct in a row at 15 damage vs 100 HP).  
- **Between duels:** **Reset player HP to 100** (and clear duel-specific buffs); opponent HP resets to that boss’s max for the next fight. Power-up inventory is **session-wide** (3 cards drawn once at start); unused charges persist across the three duels until consumed.

| Parameter | Default | Notes |
|-----------|---------|--------|
| NPCs per run | **3** | Fixed order: weak → mid → strong |
| Questions per duel (max) | **7** | Hard cap; early KO still allowed |
| Questions per run (max) | **21** | 3 × 7 |
| Player max HP | 100 | Per duel, after reset |
| Opponent max HP | **90 / 100 / 120** | Boss 1 / 2 / 3 (matches ladder below; tunable) |
| Base damage (wrong answer) | 15 | Player takes hit |
| Base damage (correct answer) | 15 | Opponent takes hit |
| Time limit per question | 30s | Optional; on expiry = wrong |
| Win duel | Opponent HP ≤ 0 **or** higher HP after Q7 cap | Before player HP ≤ 0 |
| Win run | Beat **all 3** NPCs | Loss on any duel loss (unless future continue item) |
| Loss | Player HP ≤ 0 | Allow **Judgement** card one-time revive (see power-ups) |

**Oracle difficulty hook (Pyth “truth”):** Map live feed metrics to a **difficulty tier** (1–3):

- Tier 1: wide confidence / stale tick → “Fog of War” — shorter options, trickier distractors  
- Tier 2: moderate  
- Tier 3: tight confidence + live session → “Clear Signal” — fairer MCQ, slightly lower opponent damage  

**Tier ↔ boss:** Boss 1 uses tier ≤ 2 weighted easy; Boss 2 tier 2 default; Boss 3 allows tier 3 more often. Implement with thresholds on data you already surface (confidence %, staleness, `publisherCount`, optional spread).

### Opponent ladder — three characters (weakest → strongest)

Exactly **three** fights per run, defined in `lib/game/opponents.ts`:

| Order | Example name | Role flavor | Suggested opponent HP | Damage modifier (optional) |
|-------|----------------|-------------|-------------------------|----------------------------|
| 1 | **Intern Node** | Onboarding / basics | 90 | Opponent deals **12** on your wrong answers (easier) |
| 2 | **Index Publisher** | Feeds, publishers, benchmarks | 100 | Standard **15** |
| 3 | **Entropy Keeper** | Entropy v2, proofs, “oracle truth” | 120 | Your wrong answers deal **18** to you (harder) |

Swap names for pure Pyth lore (**Relay Sprite** → **Benchmark Warden** → **Entropy Keeper**, etc.) as long as the **difficulty curve** stays weak → strong.

### Point system (for duels + leaderboard)

Points are **integer**, accumulated across the **entire run** (all three duels). Submit **one final score** to the leaderboard when the player **wins the run** or **dies** (optional: two boards—**high score** completed runs only vs **attempt** scoring; default: **only completed runs** count for top ranks).

**Base scoring**

- **+100** per **correct** answer (flat).  
- **−40** per **wrong** answer (or 0 if you prefer non-punitive; default **−40** so random spam loses).  
- **+250** **boss clear bonus** for each NPC defeated (3 × 250 = **750** max clear bonus per run).

**Multipliers (boss index `b` ∈ {1,2,3})**

- Multiply **only** the **+100 correct** portion by **`b`** (boss 3 correct answers worth 3× base knowledge points):  
  - Boss 1 correct: **+100**  
  - Boss 2 correct: **+200**  
  - Boss 3 correct: **+300**  

**Survival / speed (optional tuning)**

- **+2** per **1 HP** remaining on the player **at the end of each duel** (encourages clean play).  
- **+15** per **full second** remaining on the question timer when correct (cap e.g. +450 per run) — skip if it incentivizes rushing reading; **off by default** until playtest.

**Power-ups**

- **−30** per **power-up card used** (discourages trivializing the quiz; set to **0** if you want chaos). **Fool / World** count as used when triggered.  
- **Fool** (skip with no combat): **0** points for that question slot (no `+100*b`, no wrong penalty).  
- **World** (auto-correct): award **half** the correct score, rounded down, e.g. `floor(50*b)`, so it still helps the duel but not the leaderboard as much as a real answer.

**Run total (example formula)**

`score = sum_over_all_answers( tierPoints(correct, boss) ) + 750_if_all_cleared - 40*wrongs + 2*hpLeftPerDuel - 30*powerUpsUsed`

Where `tierPoints` = `+100*b` if correct else `−40`. **Minimum** score floor at **0** for display if you want no negative leaderboard entries.

**Integrity:** Final score recomputed **server-side** from a **signed or server-stored event log** (question ids + outcomes + timestamps); client displays provisional score only. Never trust client `score` alone.

---

## Leaderboard

**Purpose:** Social loop for crypto-natives—rank **best runs** by score; show **wallet** (truncated), optional **X handle** / display name from TweetIQ, and **timestamp** (UTC).

**Persistence (requires DB or BaaS):** Examples: **Vercel Postgres**, **Supabase**, **PlanetScale**, **Turso**. This is **not** optional for cross-user ranks; on-chain leaderboard is possible later but out of scope for MVP.

**Schema (minimal)**

- `id`, `wallet_address`, `score` (int), `run_completed` (bool), `display_name` (nullable), `twitter_handle` (nullable), `chain_id`, `created_at`  
- Optional: `session_id` UUID to correlate with server-side replay log  
- **For share card + analytics (session end only):** same row or joined `session_stats`: `questions_answered`, `correct_count`, `pyth_iq` (int), `mean_latency_ms` (nullable), `median_latency_ms` (nullable), `bosses_reached` (1–3), `power_ups_used` — written **once** when the session terminates so global stats compare **all finished sessions** (wins and losses) on equal footing.

**API**

- `POST /api/game/leaderboard/submit` — body: run token or signed payload; server validates and inserts row.  
- `GET /api/game/leaderboard?limit=50&period=weekly` — top scores; optional **season** key in query.  
- `GET /api/game/stats/global` — returns **`meanScore`**, **`submissionCount`**, optional **`medianScore`**, over **all submitted session-end scores** (same population as leaderboard rows). Used for mean / “frontrunning” lines on the **single** recap card.

**Anti-abuse**

- Rate limit by wallet + IP; one submission per completed run id; optional **minimum time** per run to reject bots.

**UI**

- `/game` tab or modal **“Hall of Oracles”**; link from hub.

*(Leaderboard files are also listed in the master file map below.)*

---

## Session recap: one shareable card (single template)

**When:** **Exactly once** per game session, when the run **ends**—either the player **finishes all three bosses** or **runs out of HP** (or forfeits, if you add that). Do **not** show a recap after individual boss fights.

**Tone / content rules**

- **One visual template only** (same layout for every player); differentiate by **numbers**, not by outcome skin.  
- **Do not** show **win / loss / defeated / victory** (no banners, no red/green outcome states tied to result). Copy should read like a **neutral telemetry receipt** or **oracle reading of your session**—curious, not congratulatory or shaming.  
- OK to show factual progress stats that imply depth (e.g. **bosses reached 1–3**, **questions answered**) without labeling the session as a loss.

**What:** Full-screen or modal **Session recap** + **Download PNG** (+ optional Web Share). Same engineering pattern as the reading image export.

### Stats to show (prioritize these)

| Field | Description |
|-------|-------------|
| **Pyth IQ** | One integer, **whole session**: derive from **overall accuracy** and **average boss difficulty faced** (weight questions by boss tier when computing). Baseline e.g. **100**, shift by accuracy, optional small bonus for reaching deeper bosses **without** calling it a “win.” Implement in `lib/game/pythIq.ts`; **server-authoritative**. |
| **Latency** | **Mean** and/or **median** time from **question shown → answer submitted** (ms), across all answered questions; omit questions skipped by power-ups from latency average or count them as null—pick one rule and document. Optional: **p95** for “consistency” bragging. |
| **Accuracy** | `correct / answered` as **%** (exclude idle timeouts from denominator or count as wrong—match duel rules). |
| **Session score** | Final **point total** (same as leaderboard `score`). |
| **Volume** | **Questions answered**, **power-ups used**, **bosses reached** (1–3). |
| **Focus tag** (optional) | Most-missed question **topic** (“Entropy,” “Feeds”) as a neutral *“signal noise in: …”* line—not “you failed.” |

### Global comparison (session-end score only)

- `userValue` = **final session `score`** submitted with this run (partial runs included—distribution mixes short and long sessions; document in tooltip).  
- `μ` = **`meanScore`** from `GET /api/game/stats/global`.  
- **Percentile (“frontrunning”):** fraction of stored **session-end scores** strictly below `userValue` (min sample **n ≥ 20** guard).  

**Example lines (still allowed—they compare performance, not outcome):**

1. *“Your Pyth Knowledge is **+15%** above the Global Mean.”*  
2. *“You are currently **‘Frontrunning’ 85%** of the market.”*  

**Integrity:** Server builds the recap payload (`POST /api/game/recap` or inline with submit) so IQ, latency aggregates, and comparison strings are not client-forged.

### Implementation note (reuse reading export)

Mirror [`lib/export-reading-png.ts`](lib/export-reading-png.ts): **`downloadSessionRecapPng(params)`** with **no** `outcome` / `won` field—only `{ pythIq, accuracyPct, meanLatencyMs, medianLatencyMs, sessionScore, questionsAnswered, correctCount, bossesReached, powerUpsUsed, deltaPct, frontrunPct, handle, avatarUrl?, dateLabel }`. **Reading flow stays untouched.**

**Session instrumentation:** Client or server must record **`answeredAt - shownAt`** per question into the run log so latency survives to recap.

**File map add-ons:** `lib/game/pythIq.ts`, `lib/export-session-recap-png.ts` (or second layout in `export-reading-png.ts`), `components/game/SessionRecapModal.tsx`, `app/api/game/stats/global/route.ts`, `app/api/game/recap/route.ts` (optional).

---

## Tarot power-ups: session setup (Entropy)

**Requirement:** At session start, player receives **3** random Major indices in `0..21`.

**Verifiability:** One Entropy v2 callback provides `bytes32 R`. Derive:

```text
card_k = uint8(uint256(keccak256(abi.encodePacked(R, uint8(k))))) % 22   // k = 0,1,2
```

Document this in contract NatSpec so engineers can audit uniformity (slight modulo bias negligible for game; acceptable for onboarding).

**Contract options:**

- **A (recommended):** New `OrraDuel.sol` — `requestSessionBoosters(bytes32 sessionSalt)` payable, callback emits `BoostersDrawn(user, c0, c1, c2, R, sessionSalt)`. No oracle snapshot required for boosters *or* optional `feedId` + hash for brand consistency with `Orra.sol`.  
- **B:** Extend `Orra.sol` (new function + events) — larger diff, same deploy hassle.

**Client (game only):** On **`/game`** only, after `useAccount` is connected, user clicks **Pay & reveal boosters** (or similar), pays **one** Entropy fee, then UI polls logs or uses wagmi `watchContractEvent` for `BoostersDrawn` and stores `c0,c1,c2`; then enable **Start run** / **Enter Arena**. Users who only want **`/reading`** never hit this path. Hub may show both mode CTAs regardless of whether boosters were paid.

---

## All 22 Major Arcana — power-up effects (quiz context)

Rules: Each card is **one use per session** unless noted. Effects resolve **before** or **after** answering as stated. Wording in UI can be degen; mechanics stay legible.

| # | Card | Effect |
|---|------|--------|
| 0 | The Fool | **Wild skip** — treat next question as correct without answering (no damage either way). |
| 1 | The Magician | **Reroll** — discard current question for a new one (same tier); one extra chance. |
| 2 | The High Priestess | **Hint** — eliminate one wrong MCQ option (or reveal T/F hint: “leaning Yes/No” without certainty). |
| 3 | The Empress | **Heal 20** — restore player HP (cap at max). |
| 4 | The Emperor | **Shield** — next wrong answer deals **half** damage (round down). |
| 5 | The Hierophant | **Study scroll** — show 120-char excerpt from Pyth docs + link; next question damage +5 if correct. |
| 6 | The Lovers | **Gamble** — choose: next correct deals **double** damage to opponent, next wrong deals **double** to you. |
| 7 | The Chariot | **Momentum** — if next answer correct, +10 bonus damage; if wrong, +5 extra damage to you. |
| 8 | Strength | **Brace** — negate damage from **one** wrong answer entirely. |
| 9 | The Hermit | **Simplify** — swap current question for **easier tier** (tier := max(1, tier-1)). |
| 10 | Wheel of Fortune | **Chaos** — random small table (seed `R` xor question index): 25% heal 10, 25% hurt 10, 25% free skip, 25% double-or-nothing next. |
| 11 | Justice | **Balance** — next question forced **True/False** (easier generator path). |
| 12 | The Hanged Man | **Suspend** — pay 5 HP to **preview** full question text 5s before timer starts. |
| 13 | Death | **Finisher** — opponent takes **10** true damage ignoring armor (if you add armor later). |
| 14 | Temperance | **Mix** — next wrong deals 50% to each side (rounded). |
| 15 | The Devil | **Leverage** — next 2 rounds: correct +50% damage, wrong +50% damage (both directions). |
| 16 | The Tower | **Shatter** — remove opponent shield/buff if any; else deal 15. |
| 17 | The Star | **Recovery** — heal to **at least** 40 HP if below. |
| 18 | The Moon | **Obscure** — hide one keyword in stem; if still correct, +20 bonus damage (risk/reward). |
| 19 | The Sun | **Clarity** — highlight the **correct** option outline (not text) for one MCQ. |
| 20 | Judgement | **Revive** — if player HP hits 0, once per session set HP to **1** and end opponent turn. |
| 21 | The World | **Completion** — auto-count next answer as **correct** (full damage to opponent); still show question for learning. |

**Balance:** Playtest; nerf **World** / **Fool** if pick rates dominate (e.g. cap bonus damage, or “correct but 50% damage”).

---

## Quiz engine

**Formats:** True/False and MCQ (4 options).

**Content sources:**

1. **Static bank** — `lib/game/questions/bank.json` (id, topic, stem, answer, distractors, difficulty, tags).  
2. **Pyth docs / IQ** — curated stems from [Pyth documentation](https://docs.pyth.network/) (Entropy protocol, feeds, publishers, Pro vs hermes, benchmarks).  
3. **Dynamic stems** — Server route loads latest price for feed X from existing ticker/stream helpers, asks: “Which asset moved most in last 24h among [A,B]?” or “Is confidence tighter than Y%?” — answers computed from **server-held** snapshot at question creation; client receives only stem + options + **questionId**; answer verified server-side on submit.

**Anti-cheat:** POST `/api/game/answer` with signed payload or session nonce stored server-side (Redis or encrypted cookie); compare answer hash. For MVP, **session secret in httpOnly cookie** + rate limit. **Leaderboard:** server stores an append-only **run log** (questionId, bossIndex, correct, tRemaining, **`latencyMs`**) to **recompute score** on submit and to compute **recap latency**; reject mismatched client totals.

**Question slots:** **The Magician** reroll and similar effects consume **one of the 7 question slots** for that duel (the rerolled prompt replaces the current step; you do not get an 8th free question).

**AI (optional):** `/api/game/generate-question` with strict JSON schema; **never** trust model for scoring without validation against Pyth facts; prefer template slots filled from known API values.

---

## X (Twitter) character profile

**Primary integration — TweetIQ (no X API key):** Call from a **Next.js Route Handler** only (keeps CORS simple and lets you add timeouts / caching).

```bash
curl -X POST https://tweetiq.onrender.com/api/analyze/profile \
  -H "Content-Type: application/json" \
  -d '{"username": "elonmusk"}'
```

**Client contract for Orra:**

- UI collects handle; **strip leading `@`** and trim before POST.
- `app/api/twitter-profile/route.ts` (or `app/api/game/profile/route.ts`) forwards `{"username": normalized}` to TweetIQ, reads JSON, returns a **stable shape** to the client, e.g. `{ displayName, avatarUrl, handle }` (field names depend on TweetIQ response — **inspect one real response** during implementation and document the mapping in code comments).
- **Timeout:** 8–12s; **cache:** short TTL in memory or `unstable_cache` (e.g. 5–15 min per handle) to reduce load and survive Render cold starts.
- **Errors:** 502/timeout → UI shows placeholder avatar + `@handle` text; optional manual override fields.

**Risks / ops**

- Third-party **availability and ToS** — you depend on TweetIQ staying up and permitted for your use case; Render free tier may **cold start** (slow first request).
- Response may include more than profile fields (e.g. “analyze” payload); **only pass through** name + image URL to the game UI unless product wants extra copy.
- **Privacy:** Do not log full API responses in production; avoid sending wallet addresses to TweetIQ unless you explicitly choose to extend the payload later.

**Fallback:** Manual display name + image URL in UI state (no DB) if the proxy fails.

---

## File map (create / modify)

| Path | Responsibility |
|------|----------------|
| `app/game/page.tsx` | Server shell; dynamic import client |
| `app/game/GamePageClient.tsx` | Connect check → booster paywall (`OrraDuel`) → X handle → duel; **no** payment before user lands here |
| `app/game/layout.tsx` | Optional metadata / theme |
| `components/game/DuelArena.tsx` | Portraits, HP bars, log (CodePen-inspired layout) |
| `components/game/QuestionPanel.tsx` | TF / MCQ UI + timer |
| `components/game/PowerUpTray.tsx` | 3 cards, consume actions |
| `components/game/OpponentPortrait.tsx` | Sprite + name tier |
| `lib/game/types.ts` | `GameState`, `Question`, `PowerUpId`, reducers |
| `lib/game/reducer.ts` | Pure state transitions (TDD target) |
| `lib/game/opponents.ts` | NPC defs + scaling |
| `lib/game/powerUpEffects.ts` | Map card index → effect application |
| `lib/game/deriveBoosters.ts` | Mirror Solidity derivation for client preview tests |
| `app/api/game/session/route.ts` | (Optional) issue session nonce |
| `app/api/game/answer/route.ts` | Validate answer, return damage delta |
| `app/api/game/question/route.ts` | Pull next question (tier from oracle snapshot query param) |
| `app/api/twitter-profile/route.ts` | Server proxy: POST TweetIQ `/api/analyze/profile` → normalized `{ displayName, avatarUrl, handle }` |
| `contracts/src/OrraDuel.sol` | Entropy consumer, `BoostersDrawn` |
| `contracts/test/OrraDuel.t.sol` | Callback fires 3 indices in range |
| `lib/orra-duel-abi.ts` | Generated or hand ABI for wagmi |
| `hooks/useOrraDuelBoosters.ts` | writeContract + event watch |
| Vitest | `lib/game/reducer.test.ts`, `lib/game/deriveBoosters.test.ts` |
| Hub link | `app/page.tsx` or new `components/PlayHub.tsx` — tabs/links to `/game` and `/reading` |
| `app/api/game/leaderboard/submit/route.ts` | Validate run, recompute score, insert row |
| `app/api/game/leaderboard/route.ts` | GET ranked rows (period / limit) |
| `lib/db/*` or Prisma | Persist leaderboard + optional run logs |
| `components/game/LeaderboardPanel.tsx` | “Hall of Oracles” UI |
| `lib/game/pythIq.ts` | Deterministic IQ-style number from duel stats |
| `app/api/game/stats/global/route.ts` | Mean / count for session-end score distribution |
| `lib/export-session-recap-png.ts` | Single-template PNG (mirror [`lib/export-reading-png.ts`](lib/export-reading-png.ts)) |
| `components/game/SessionRecapModal.tsx` | **Once** at session end: stats + Download / share (no win/loss UI) |

---

## Pyth integration roadmap (backbone of “Oracle Truth”)

1. **Entropy v2** — Follow [Entropy chainlist](https://docs.pyth.network/entropy/chainlist) for Base / Base Sepolia addresses; mirror `Orra.sol` provider wiring.  
2. **Price / Pro** — Reuse `PYTH_PRO_TOKEN` streams and/or benchmarks HTTP for **numbers** in dynamic questions and **difficulty tier** inputs.  
3. **Documentation** — Link in-game “scrolls” to [Pyth docs](https://docs.pyth.network/) and Entropy protocol pages.  
4. **Community** — Optional “community IQ” deck referencing public materials; avoid claiming endorsement from [Pyth X community](https://x.com/i/communities/1840746832215097412) without permission.

---

### Task 1: Game state reducer (TDD core)

**Files:**

- Create: `lib/game/types.ts`
- Create: `lib/game/reducer.ts`
- Create: `lib/game/reducer.test.ts`

- [ ] **Step 1: Write failing test — correct answer damages opponent**

```ts
import { describe, it, expect } from "vitest";
import { initialState, reduce } from "./reducer";

describe("duel reducer", () => {
  it("applies base damage to opponent on correct answer", () => {
    const s0 = initialState({ seed: 1 });
    const s1 = reduce(s0, { type: "ANSWER", correct: true });
    expect(s1.opponentHp).toBe(s0.opponentHp - 15);
    expect(s1.playerHp).toBe(s0.playerHp);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- lib/game/reducer.test.ts`  
Expected: import / function errors.

- [ ] **Step 3: Minimal `initialState` + `reduce` for ANSWER only**

Implement `initialState` with playerHp/opponentHp 100 and `reduce` subtracting 15 from opponent when `correct`.

- [ ] **Step 4: Run test — PASS**

- [ ] **Step 5: Add tests for wrong answer, win, loss; extend reducer**

- [ ] **Step 6: Commit** — `git add lib/game/ && git commit -m "test(game): add duel reducer with hp rules"`

---

### Task 2: Booster derivation parity (client = contract logic)

**Files:**

- Create: `lib/game/deriveBoosters.ts`
- Create: `lib/game/deriveBoosters.test.ts`

- [ ] **Step 1: Test three indices in 0..21 from mock R**

```ts
import { describe, it, expect } from "vitest";
import { deriveBoostersFromRandom } from "./deriveBoosters";

describe("deriveBoostersFromRandom", () => {
  it("returns length 3 and valid indices", () => {
    const r = "0x" + "11".repeat(32);
    const b = deriveBoostersFromRandom(r);
    expect(b).toHaveLength(3);
    b.forEach((c) => {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(21);
    });
  });
});
```

- [ ] **Step 2: Implement** using `keccak256` from viem: `keccak256(concat([R, toHex(k, { size: 1 })]))` then `BigInt` mod 22.

- [ ] **Step 3: Commit**

---

### Task 3: `OrraDuel.sol` + Forge tests

**Files:**

- Create: `contracts/src/OrraDuel.sol`
- Create: `contracts/test/OrraDuel.t.sol`
- Modify: `contracts/deploy.sh` (optional second deploy)

- [ ] **Step 1: Implement consumer** — `requestBoosters(bytes32 sessionSalt)`, callback emits `c0,c1,c2` with same derivation as Solidity:

```solidity
// Inside entropyCallback:
uint8 c0 = uint8(uint256(keccak256(abi.encodePacked(randomNumber, uint8(0))))) % 22;
uint8 c1 = uint8(uint256(keccak256(abi.encodePacked(randomNumber, uint8(1))))) % 22;
uint8 c2 = uint8(uint256(keccak256(abi.encodePacked(randomNumber, uint8(2))))) % 22;
```

- [ ] **Step 2: Forge test** — mock entropy provider per existing `Orra.t.sol` patterns if present; assert event args in range.

- [ ] **Step 3: `forge test` PASS**

- [ ] **Step 4: Commit**

---

### Task 4: `/game` route + DuelArena shell

**Files:**

- Create: `app/game/page.tsx`, `app/game/GamePageClient.tsx`
- Create: `components/game/DuelArena.tsx`, `components/game/QuestionPanel.tsx`, `components/game/PowerUpTray.tsx`

- [ ] **Step 1:** Stub layout: two columns, HP bars, scrollable log (structure only).  
- [ ] **Step 2:** Wire `useAccount`; if disconnected, show **Connect wallet** only—**do not** show booster payment. If connected, show **Pay for boosters** / locked duel (see Task 5).  
- [ ] **Step 3:** `npm run build` succeeds.  
- [ ] **Step 4: Commit**

---

### Task 5: Booster flow (wagmi + events) — `/game` only

**Files:**

- Create: `hooks/useOrraDuelBoosters.ts`
- Modify: `GamePageClient.tsx`

- [ ] **Step 1:** Only when `address` is set on **`/game`**, expose **Pay & reveal boosters** → `writeContract` to `requestBoosters` with value `getFeeV2`.  
- [ ] **Step 2:** Watch `BoostersDrawn` for user; store `c0,c1,c2` in state; then unlock **Start run**.  
- [ ] **Step 3:** Confirm hub + **`/reading`** never call `requestBoosters` and remain unchanged.  
- [ ] **Step 4:** Manual test on Base Sepolia.  
- [ ] **Step 5: Commit**

---

### Task 6: Quiz API + static bank

**Files:**

- Create: `lib/game/questions/bank.json`
- Create: `app/api/game/question/route.ts`
- Create: `app/api/game/answer/route.ts`

- [ ] **Step 1:** Seed 20+ questions (mix TF / MCQ, tags: entropy, feeds, pro).  
- [ ] **Step 2:** GET question returns next by `tier` query + random index (use `Math.random` only for selection MVP; later tie to commitment).  
- [ ] **Step 3:** POST answer validates and returns `{ correct, playerDelta, opponentDelta }`.  
- [ ] **Step 4: Commit**

---

### Task 7: Power-up application wiring

**Files:**

- Create: `lib/game/powerUpEffects.ts`
- Modify: `reducer.ts`, `PowerUpTray.tsx`

- [ ] **Step 1:** Map 0–21 to effect tags; apply in reducer via `POWER_UP` action.  
- [ ] **Step 2:** UI consume button + disabled state when used.  
- [ ] **Step 3: Commit**

---

### Task 8: X profile API + character row (TweetIQ)

**Files:**

- Create: `app/api/twitter-profile/route.ts`
- Modify: `GamePageClient.tsx`

- [ ] **Step 1:** Implement `POST` (or `GET ?username=`) handler that normalizes handle (remove `@`), server-side `fetch("https://tweetiq.onrender.com/api/analyze/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }), signal: AbortSignal.timeout(12000) })`.  
- [ ] **Step 2:** Map TweetIQ JSON to `displayName` + `avatarUrl` (confirm keys from one live response); on failure return `{ fallback: true, handle }`.  
- [ ] **Step 3:** `GamePageClient` calls this route after user submits handle; duel row shows player avatar + name.  
- [ ] **Step 4: Commit**

---

### Task 9: Hub entry labels + navigation

**Files:**

- Modify: `app/page.tsx` or `DashboardPageClient.tsx` (or add `components/PlayHub.tsx`)

- [ ] **Step 1:** Add prominent links: **Entropy Arena** → `/game`, **The Verifiable Draw** → `/reading`; both available after connect—**no** `OrraDuel` / booster tx on the hub.  
- [ ] **Step 2: Commit**

---

### Task 10: Dynamic Pyth-aware questions (stretch)

**Files:**

- Create: `app/api/game/question-pyth/route.ts`
- Reuse: ticker or history helpers from `lib/` / `app/api/pyth-ticker`

- [ ] **Step 1:** Build one template: “Which feed had higher 24h change: A or B?” using cached ticker snapshot.  
- [ ] **Step 2:** Integration test or manual checklist in README snippet.  
- [ ] **Step 3: Commit**

---

### Task 11: Leaderboard + DB

**Files:**

- Create: DB schema (e.g. Prisma + Postgres) or Supabase tables  
- Create: `app/api/game/leaderboard/submit/route.ts`, `app/api/game/leaderboard/route.ts`  
- Create: `components/game/LeaderboardPanel.tsx`  
- Modify: `GamePageClient.tsx` — submit on run end; link “Hall of Oracles”

- [ ] **Step 1:** Migrate schema (`wallet_address`, `score`, …) **plus session-end stats** columns or joined table (`pyth_iq`, `mean_latency_ms`, `median_latency_ms`, `questions_answered`, `correct_count`, `bosses_reached`, `power_ups_used`) populated on **session end** only.  
- [ ] **Step 2:** Server recomputes score + latency aggregates from run log; `POST /submit` idempotent per `run_id`.  
- [ ] **Step 3:** `GET` leaderboard with limit + optional weekly window.  
- [ ] **Step 4:** `GET /api/game/stats/global` — `AVG(score)`, `COUNT(*)`, percentile helper over **all** session-end rows.  
- [ ] **Step 5:** UI panel + rate limits.  
- [ ] **Step 6: Commit**

---

### Task 12: Session recap card + PNG (once per run)

**Files:**

- Create: `lib/game/pythIq.ts` + tests  
- Create: `lib/export-session-recap-png.ts` (or second layout in `export-reading-png.ts`)  
- Create: `components/game/SessionRecapModal.tsx`  
- Modify: `GamePageClient.tsx` / duel flow — open recap **only** when session **terminates** (HP = 0 after revive rules, or boss 3 duel resolved)  
- Use: `GET /api/game/stats/global` for mean / frontrun copy

- [ ] **Step 1:** Instrument `QuestionPanel` / answer route: record **`latencyMs`** per question in run log.  
- [ ] **Step 2:** Implement `computePythIq` for **full session** (accuracy + boss weights) + tests.  
- [ ] **Step 3:** Global stats route + percentile; guard `n < 20`.  
- [ ] **Step 4:** `SessionRecapModal`: **no** win/loss strings; show IQ, latency, accuracy, score, volume stats + global lines only.  
- [ ] **Step 5:** `downloadSessionRecapPng` — **one** canvas template.  
- [ ] **Step 6: Commit**

---

## Verification checklist (before ship)

- [ ] `npm run build` and `npm test` pass  
- [ ] `cd contracts && forge test` pass  
- [ ] Entropy fee and addresses documented in `.env.example`  
- [ ] Database URL + migration documented for leaderboard  
- [ ] Copy includes **entertainment / education only** disclaimer (no financial advice)  
- [ ] Power-up + answer logic covered by Vitest for regression  
- [ ] Score formula unit-tested (3 bosses, 7-cap, multipliers)  
- [ ] Pyth IQ + global mean / frontrun copy covered by tests or snapshot tests  
- [ ] Session recap PNG downloads without breaking [`lib/export-reading-png.ts`](lib/export-reading-png.ts) reading flow  

---

## Plan review

Human or `plan-document-reviewer` subagent: verify task order, legal/API assumptions, and whether `OrraDuel` should also commit a Pyth snapshot for brand parity with readings.

---

**Plan complete and saved to** `docs/superpowers/plans/2026-04-02-orra-quiz-duel-game.md`.

**Execution options:**

1. **Subagent-driven (recommended)** — one subagent per task above with review between tasks (@superpowers:subagent-driven-development).  
2. **Inline execution** — run tasks sequentially in one session with checkpoints (@superpowers:executing-plans).

**Which approach do you want to use?**
