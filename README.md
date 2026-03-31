# Orra

Orra is a web app that pairs live Pyth oracle data with an on-chain tarot draw. The dashboard shows prices and market context. The reading flow asks for intent, commits a snapshot of the oracle on-chain, and draws a Major Arcana card with verifiable randomness. This repository defaults to **Base Sepolia** (84532); point env at Base mainnet if you deploy there instead.

## Prerequisites

- **Node.js** 18.18 or newer (recommended: **20.x** LTS for Vercel)
- **npm** (or another client that respects `package-lock.json`)
- **Foundry** (`forge`, `cast`) for the Solidity project under `contracts/`

## What it does

**Dashboard** (`/`) streams Pyth data for searchable assets. You get current price, confidence-style signals, sparklines, and session-aware warnings where relevant.

**Reading** (`/reading`) walks through questions and a wallet step on Base Sepolia by default (`NEXT_PUBLIC_BASE_RPC_URL`). Use a Base mainnet RPC to target mainnet. When you confirm a draw:

1. The app freezes the current Pyth tick and hashes it (`feedId` plus packed price, confidence, timestamps, and related fields). That hash is the oracle snapshot commitment.
2. You pay the Pyth Entropy v2 fee. The `Orra` contract requests randomness and stores your address, `feedId`, and the snapshot hash until the callback runs.
3. Entropy returns a `bytes32`. The contract maps it to one of 22 Major Arcana indices and emits events. Anyone can correlate the draw with the committed oracle state off-chain.
4. Optional text interpretation runs server-side. The API sends oracle context and reading metadata to a configured LLM provider. No provider keys means interpretation stays disabled; the draw still works on-chain.

Randomness comes from Pyth Entropy, not from the UI. The snapshot ties the narrative to a specific oracle update for the chosen feed.

## Smart contract

`contracts/src/Orra.sol` implements `IEntropyConsumer`. It calls `requestV2`, tracks pending readings by sequence number, and in `entropyCallback` emits `CardDrawn` with the card index, feed id, snapshot hash, and raw random value. Deploy with Foundry; see `contracts/deploy.sh` and `contracts/env.deploy.example`.

## Stack

- **App:** Next.js 15, React, TypeScript, Tailwind, wagmi, RainbowKit, viem, ethers
- **Data:** Pyth (HTTP/stream routes under `app/api/pyth-*`; `PYTH_PRO_TOKEN` unlocks Pro features where used)
- **Chain:** Base Sepolia (default) or Base mainnet, driven by `NEXT_PUBLIC_BASE_RPC_URL`
- **Contracts:** Solidity 0.8.24, Forge, `@pythnetwork/entropy-sdk-solidity`

## Repository layout

| Path | Purpose |
|------|---------|
| `app/` | Next.js routes, API handlers (`app/api/`), global styles |
| `components/` | React UI (dashboard, reading flow, shared chrome) |
| `hooks/` | Client hooks (Pyth stream, contract, wallet helpers) |
| `lib/` | Shared TS (oracle hash, cards, prompts, contract ABI helpers) |
| `contracts/` | Foundry project: `Orra.sol`, tests, deploy script; see `contracts/README.md` for `forge-std` |
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
| `NEXT_PUBLIC_ORRA_CONTRACT_ADDRESS` | Deployed Orra contract (required for draws) |
| `NEXT_PUBLIC_BASE_RPC_URL` | RPC; default in code is `https://sepolia.base.org` |
| `NEXT_PUBLIC_ENTROPY_ADDRESS` | Pyth **Entropy contract** (IEntropy v2); must match `orra.entropy()` on-chain |
| `NEXT_PUBLIC_ORRA_DEPLOY_BLOCK` | Optional; narrows log scans for reading history |

**Pyth Entropy uses two different addresses.** The app only exposes the **Entropy contract** above. Deploy also needs **`ENTROPY_PROVIDER_ADDRESS`** in `contracts/.env` (the default **provider** from the [Pyth chainlist](https://docs.pyth.network/entropy/chainlist)). That provider address is **not** the same as the Entropy contract address. It is stored in `Orra` at deploy time; this repo’s `Orra.sol` does not read it after the constructor, but you should still set it to the official value for your chain. **`NEXT_PUBLIC_ENTROPY_ADDRESS` and `ENTROPY_ADDRESS` should match.** **`ENTROPY_PROVIDER_ADDRESS` has no `NEXT_PUBLIC_` counterpart.**

### Environment (server / APIs)

| Variable | Role |
|----------|------|
| `PYTH_PRO_TOKEN` | Pyth Pro access for ticker/stream routes that need it |
| `GITHUB_MODELS_TOKEN` | Optional; GitHub Models for `/api/interpret` |
| `BLUESMINDS_API_KEY` | Optional; Bluesminds for interpretation |
| `OPENROUTER_API_KEY` | Optional; OpenRouter for interpretation |
| `ORRA_ALLOWED_ORIGINS` | Optional comma-separated list of origins allowed to POST `/api/interpret` in production (e.g. `https://yourdomain.com`). If unset on Vercel, `VERCEL_URL` / `VERCEL_BRANCH_URL` are used automatically. |
| `ORRA_INTERPRET_TRUST_ANY_ORIGIN` | Set to `1` only as an escape hatch to disable Origin checks (not recommended in production). |

At least one interpretation key is required for AI text. Optional overrides (model IDs, Bluesminds base URL, OpenRouter referer/title) live in `app/api/interpret/route.ts`. Production `/api/interpret` responses omit raw provider error chains unless `NODE_ENV=development`; the server still logs failures.

Template (placeholders only): [`.env.example`](.env.example).

## Deploying on Vercel

1. Import the Git repository and use the default **Next.js** framework settings (`npm run build` / output `.next`).
2. In **Project → Settings → Environment Variables**, add every variable from `.env.example` for **Production** (and **Preview** if previews should run the full stack):
   - All `NEXT_PUBLIC_*` values (contract address, RPC URL, entropy address, optional deploy block).
   - Server-only secrets — mark **Sensitive** in the Vercel UI: `PYTH_PRO_TOKEN`, `GITHUB_MODELS_TOKEN`, `BLUESMINDS_API_KEY`, `OPENROUTER_API_KEY`, plus any optional Bluesminds / OpenRouter overrides.
   - Never prefix API keys with `NEXT_PUBLIC_` — that would expose them in the browser bundle.
3. Custom domain: add `https://yourdomain.com` to `ORRA_ALLOWED_ORIGINS` if you disable or replace Vercel’s default host checks.
4. After deploy: in DevTools → **Sources**, search the client JS for `OPENROUTER_API_KEY`, `GITHUB_MODELS_TOKEN`, `BLUESMINDS_API_KEY`, or `PYTH_PRO_TOKEN`. They must **not** appear as string literals (only `NEXT_PUBLIC_*` may).
5. Optional: Vercel **Deployment Protection** or Firewall rules on preview URLs if you do not want anonymous traffic hitting Pyth/interpret proxies.

## Contracts

```bash
cd contracts
forge install   # first time, if needed — see contracts/README.md if lib/forge-std is missing
forge build
forge test
```

Deploy: configure `contracts/.env` from `env.deploy.example` (`PRIVATE_KEY`, `BASE_RPC_URL`, `ENTROPY_ADDRESS`, `ENTROPY_PROVIDER_ADDRESS`). Run `./deploy.sh`. Set `NEXT_PUBLIC_ORRA_CONTRACT_ADDRESS` in the app to the deployed address.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint |
| `npm test` | Vitest — pure `lib/` helpers (`*.test.ts`) |
| `forge test` (in `contracts/`) | Solidity tests |

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

## License

ISC (see `package.json`).
