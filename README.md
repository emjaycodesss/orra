# Orra

Orra is a web app that pairs live Pyth oracle data with on-chain tarot and trivia experiences. The dashboard shows prices and market context. The reading flow (`/portal` → `/reading`) asks for intent, commits a snapshot of the oracle on-chain, and draws a Major Arcana card with verifiable randomness from Pyth Entropy. **Oracle Trivia Clash** (`/game`) runs a wallet-connected trivia duel that draws Major Arcana boosters on-chain via a separate `OrraTrivia` contract. This repository defaults to **Base Sepolia** (84532); point env at Base mainnet if you deploy there instead.

## Prerequisites

- **Node.js** 18.18 or newer (recommended: **20.x** LTS for Vercel and CI)
- **npm** (or another client that respects `package-lock.json`)
- **Foundry** (`forge`, `cast`) for the Solidity project under `contracts/`
- **Postgres** (optional) for durable game sessions and leaderboards in production — same connection string you would use against a Supabase project’s database if you host there; without it, the app uses a local file store under `.data/orra-game/`

## What it does

**Dashboard** (`/`) streams Pyth data for searchable assets. You get current price, confidence-style signals, sparklines, and session-aware warnings where relevant.

**Portal** (`/portal`) is the reading entry experience: connect a wallet and choose how you approach the oracle before continuing into the full reading flow.

**Reading** (`/reading`) walks through questions and a wallet step on Base Sepolia by default (`NEXT_PUBLIC_BASE_RPC_URL`). Use a Base mainnet RPC to target mainnet. When you confirm a draw:

1. The app freezes the current Pyth tick and hashes it (`feedId` plus packed price, confidence, timestamps, and related fields). That hash is the oracle snapshot commitment.
2. You pay the Pyth Entropy v2 fee. The `Orra` contract requests randomness and stores your address, `feedId`, and the snapshot hash until the callback runs.
3. Entropy returns a `bytes32`. The contract maps it to one of 22 Major Arcana indices and emits events. Anyone can correlate the draw with the committed oracle state off-chain.
4. Optional text interpretation runs server-side. The API sends oracle context and reading metadata to a configured LLM provider. No provider keys means interpretation stays disabled; the draw still works on-chain.

**Game** (`/game`) — Oracle Trivia Clash — uses `NEXT_PUBLIC_ORRA_TRIVIA_CONTRACT_ADDRESS` and the same Entropy deployment pattern: boosters and duel randomness are requested on-chain (not simulated in the UI). Game APIs under `app/api/game/*` persist state to Postgres when `ORRA_DATABASE_URL` or `DATABASE_URL` is set; otherwise they use the local JSON file store for development.

Randomness for readings and trivia comes from Pyth Entropy, not from the UI. Oracle snapshots tie the reading narrative to a specific Pyth update for the chosen feed.

## Smart contract

`contracts/src/Orra.sol` implements `IEntropyConsumer`. It calls `requestV2`, tracks pending readings by sequence number, and in `entropyCallback` emits `CardDrawn` with the card index, feed id, snapshot hash, and raw random value. `contracts/src/OrraTrivia.sol` is the Entropy consumer for trivia booster draws. Deploy readings with Foundry via `contracts/deploy.sh`; deploy trivia with `contracts/deploy-trivia.sh` (same `contracts/.env` as `Orra`). See `contracts/env.deploy.example`.

## Stack

- **App:** Next.js 15, React, TypeScript, Tailwind, wagmi, RainbowKit, viem, ethers
- **Data:** Pyth (HTTP/stream routes under `app/api/pyth-*`; `PYTH_PRO_TOKEN` unlocks Pro features where used)
- **Persistence:** Optional Postgres via `pg` (`lib/db/`, `migrations/*.sql`); local JSON fallback under `.data/orra-game/` when no DB URL is set
- **Chain:** Base Sepolia (default) or Base mainnet, driven by `NEXT_PUBLIC_BASE_RPC_URL`
- **Contracts:** Solidity 0.8.24, Forge, `@pythnetwork/entropy-sdk-solidity` — `Orra` (readings) and `OrraTrivia` (game)

## Repository layout

| Path | Purpose |
|------|---------|
| `app/` | Next.js routes, API handlers (`app/api/`), global styles |
| `app/(experience)/` | Route-grouped UX: `portal`, `reading`, `game` |
| `components/` | React UI (dashboard, reading flow, shared chrome) |
| `hooks/` | Client hooks (Pyth stream, contract, wallet helpers) |
| `lib/` | Shared TS (Pyth helpers, dashboard formatters, contract ABI helpers) |
| `lib/reading/` | Reading flow: interpret guards, oracle snapshot hash, audio, spread timing, storage/sync |
| `lib/db/` | Postgres pool + URL helpers for game APIs |
| `migrations/` | SQL migrations for game and leaderboard tables |
| `contracts/` | Foundry project: `Orra.sol`, `OrraTrivia.sol`, tests, deploy scripts; see `contracts/README.md` for `forge-std` |
| `.github/workflows/` | CI workflow (lint, test, knip) |
| `public/` | Static assets |

## Run the app

```bash
npm install
cp .env.example .env.local   # then edit values
npm run dev
```

Use the tables below to fill `.env.local`. For production, set the same variables on your host (Vercel, Docker, etc.). Next.js reads `.env.local` automatically in development.

Open `http://localhost:3000`.

### Environment (web)

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_ORRA_CONTRACT_ADDRESS` | Deployed `Orra` contract (required for readings / draws) |
| `NEXT_PUBLIC_ORRA_TRIVIA_CONTRACT_ADDRESS` | Deployed `OrraTrivia` contract (required for `/game` on-chain boosters) |
| `NEXT_PUBLIC_BASE_RPC_URL` | RPC; default in code is `https://sepolia.base.org` |
| `NEXT_PUBLIC_ENTROPY_ADDRESS` | Pyth **Entropy contract** (IEntropy v2); must match `orra.entropy()` and `orraTrivia.entropy()` on-chain |
| `NEXT_PUBLIC_ORRA_DEPLOY_BLOCK` | Optional; narrows log scans for reading history |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (browser-safe; use when your deployment relies on the Supabase client template) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser-safe) |
| `NEXT_PUBLIC_ORRA_TRIVIA_DEV_MOCK` | Optional dev-only; when set to `1`, UI may use mock trivia paths (see `GamePageClient`) |

**Pyth Entropy uses two different addresses.** The app only exposes the **Entropy contract** above. Deploy also needs **`ENTROPY_PROVIDER_ADDRESS`** in `contracts/.env` (the default **provider** from the [Pyth chainlist](https://docs.pyth.network/entropy/chainlist)). That provider address is **not** the same as the Entropy contract address. It is stored in `Orra` and `OrraTrivia` at deploy time; this repo’s `Orra.sol` does not read it after the constructor, but you should still set it to the official value for your chain. **`NEXT_PUBLIC_ENTROPY_ADDRESS` and `ENTROPY_ADDRESS` should match.** **`ENTROPY_PROVIDER_ADDRESS` has no `NEXT_PUBLIC_` counterpart.**

### Environment (server / APIs)

| Variable | Role |
|----------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server only; bypasses RLS — use only in trusted API routes (never `NEXT_PUBLIC_`) |
| `ORRA_DATABASE_URL` | Preferred Postgres URL for game persistence; if unset with no `DATABASE_URL`, game uses `.data/orra-game/*.json` |
| `DATABASE_URL` | Accepted alias for Postgres (e.g. Vercel/Neon); `ORRA_DATABASE_URL` wins if both are set |
| `ORRA_PG_POOL_MAX` | Optional; max connections for the server `pg` pool (default 10) |
| `PYTH_PRO_TOKEN` | Pyth Pro access for ticker/stream routes that need it |
| `ORRA_API_TIMING_LOG` | Set to `1` to emit structured timing lines for Pyth history routes in logs |
| `GITHUB_MODELS_TOKEN` | Optional; GitHub Models for `/api/interpret` |
| `GITHUB_TOKEN` | Optional alias read by game question services in addition to `GITHUB_MODELS_TOKEN` |
| `BLUESMINDS_API_KEY` | Optional; Bluesminds for interpretation |
| `OPENROUTER_API_KEY` | Optional; OpenRouter for interpretation |
| `ORRA_ALLOWED_ORIGINS` | Optional comma-separated list of origins allowed to POST `/api/interpret` in production (e.g. `https://yourdomain.com`). If unset on Vercel, `VERCEL_URL` / `VERCEL_BRANCH_URL` are used automatically. |
| `ORRA_INTERPRET_TRUST_ANY_ORIGIN` | Set to `1` only as an escape hatch to disable Origin checks (not recommended in production). |
| `ORRA_TRIVIA_DEV_MOCK` | Optional server-side; when `1`, relaxes trivia chain requirements for local API testing |

At least one interpretation key is required for AI text on the reading interpret route. Optional overrides (model IDs, Bluesminds base URL, OpenRouter referer/title) live in `app/api/interpret/route.ts`. Production `/api/interpret` responses omit raw provider error chains unless `NODE_ENV=development`; the server still logs failures.

Template (placeholders only): [`.env.example`](.env.example).

## Deploying on Vercel

1. Import the Git repository and use the default **Next.js** framework settings (`npm run build` / output `.next`).
2. In **Project → Settings → Environment Variables**, add every variable from `.env.example` for **Production** (and **Preview** if previews should run the full stack):
   - All `NEXT_PUBLIC_*` values: `NEXT_PUBLIC_ORRA_CONTRACT_ADDRESS`, `NEXT_PUBLIC_ORRA_TRIVIA_CONTRACT_ADDRESS`, RPC URL, entropy address, optional deploy block, and any Supabase URL/anon key you use in the browser.
   - Server-only secrets — mark **Sensitive** in the Vercel UI: `PYTH_PRO_TOKEN`, `GITHUB_MODELS_TOKEN`, `BLUESMINDS_API_KEY`, `OPENROUTER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ORRA_DATABASE_URL` or `DATABASE_URL`, `ORRA_PG_POOL_MAX`, plus any optional Bluesminds / OpenRouter overrides.
   - Never prefix API keys with `NEXT_PUBLIC_` — that would expose them in the browser bundle.
3. Custom domain: add `https://yourdomain.com` to `ORRA_ALLOWED_ORIGINS` if you disable or replace Vercel’s default host checks.
4. After deploy: in DevTools → **Sources**, search the client JS for `OPENROUTER_API_KEY`, `GITHUB_MODELS_TOKEN`, `BLUESMINDS_API_KEY`, or `PYTH_PRO_TOKEN`. They must **not** appear as string literals (only `NEXT_PUBLIC_*` may).
5. Optional: Vercel **Deployment Protection** or Firewall rules on preview URLs if you do not want anonymous traffic hitting Pyth/interpret proxies.

**Game API rate limits** use an in-memory limiter (see `lib/game/api-route-helpers.ts`). Each server instance tracks its own counters, so on Vercel or any multi-instance / serverless setup, effective limits are **per instance**, not a single global cap unless you plug in a shared limiter via `configureGameRateLimiter`.

## Contracts

```bash
cd contracts
forge install   # first time, if needed — see contracts/README.md if lib/forge-std is missing
forge build
forge test
```

```bash
# Trivia contract (same .env as Orra deploy)
./deploy-trivia.sh
```

Deploy: configure `contracts/.env` from `env.deploy.example` (`PRIVATE_KEY`, `BASE_RPC_URL`, `ENTROPY_ADDRESS`, `ENTROPY_PROVIDER_ADDRESS`). Run `./deploy.sh` for readings. Set `NEXT_PUBLIC_ORRA_CONTRACT_ADDRESS` in the app to the deployed `Orra` address. Run `./deploy-trivia.sh` for trivia; set `NEXT_PUBLIC_ORRA_TRIVIA_CONTRACT_ADDRESS` for the game client.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run dev:turbo` | Dev server with Turbopack |
| `npm run clean` | Remove `.next` build output |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint |
| `npm test` | Vitest — `*.test.ts` (e.g. under `lib/`) |
| `npm run test:watch` | Vitest watch mode |
| `npm run knip` | Unused file/export/dependency checks |
| `npm run knip:prod` | Knip production dependency scan |
| `forge test` (in `contracts/`) | Solidity tests |

### Game API hardening notes

- Wallet parsing for game routes is strict EVM hex format via `normalizeWalletAddress` in `lib/game/api-route-helpers.ts`.
- `/api/game/runs` is owner-scoped and requires authenticated session wallet identity to match the requested wallet.
- `/api/game/profile-by-wallet` is intentionally public summary-only (handle/display/avatar), while detailed run history is owner-only.
- Rate limiting defaults to an in-memory limiter for local/dev. For production multi-instance deployments, configure a durable strategy via `configureGameRateLimiter` in `lib/game/api-route-helpers.ts`.
- Apply SQL in `migrations/` in order when enabling Postgres; verify RLS with `scripts/game-policy-check.sql`.
- Dev-only env: `ORRA_TRIVIA_DEV_MOCK` / `NEXT_PUBLIC_ORRA_TRIVIA_DEV_MOCK` for local testing without a deployed trivia contract (do not enable in production).

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on pushes to `main`/`master` and on pull requests: `npm ci`, `npm run lint`, `npm test`, and `npm run knip` on Node 20.

## Repository

See `package.json` for the canonical Git remote and issue URL.

## Further reading

- [Pyth Entropy — chainlist and deployments](https://docs.pyth.network/entropy/chainlist)
- [Pyth Network documentation](https://docs.pyth.network/)
- [Base](https://docs.base.org/)
- [RainbowKit](https://www.rainbowkit.com/) and [wagmi](https://wagmi.sh/)

## Contributing

Issues and pull requests are welcome. For large behavior or contract changes, open an issue first so the design stays aligned.

## Security

Do not commit private keys or API tokens. Use GitHub [Security advisories](https://docs.github.com/en/code-security/security-advisories) for sensitive reports if that feature is enabled on the repository.

## Third-party assets

Sound on the **reading** route (`/reading`) uses clips from [Freesound](https://freesound.org/). Full credits, licenses (**CC BY 4.0** ambient, **CC BY-NC 4.0** for the reveal sting — non-commercial unless you license separately), and suggested attribution text are in [`public/audio/reading/ATTRIBUTION.md`](public/audio/reading/ATTRIBUTION.md).

Sound on the **game** route (`/game`) uses clips from Freesound. Full credits, licenses, and suggested attribution text are in [`public/audio/game/ATTRIBUTION.md`](public/audio/game/ATTRIBUTION.md).

## License

Licensed under the [Apache License, Version 2.0](LICENSE). See [`NOTICE`](NOTICE) for copyright. Third-party code (e.g. `contracts/lib/forge-std`) remains under its respective licenses.
