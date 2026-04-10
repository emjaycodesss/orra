#!/usr/bin/env bash
# Deploy OrraTrivia against Pyth Entropy v2 (see script/DeployOrraTrivia.s.sol).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

if [[ ! -f .env ]]; then
  echo "Create contracts/.env from env.deploy.example (set PRIVATE_KEY and RPC)."
  exit 1
fi

set -a
# shellcheck source=/dev/null
source .env
set +a

if [[ -z "${PRIVATE_KEY:-}" || "$PRIVATE_KEY" == "0xYOUR_KEY" ]]; then
  echo "Set PRIVATE_KEY in contracts/.env"
  exit 1
fi

if [[ -z "${ENTROPY_ADDRESS:-}" || -z "${ENTROPY_PROVIDER_ADDRESS:-}" ]]; then
  echo "Set ENTROPY_ADDRESS and ENTROPY_PROVIDER_ADDRESS (Pyth Entropy v2 chainlist) in contracts/.env"
  exit 1
fi

RPC_URL="${BASE_RPC_URL:-https://sepolia.base.org}"

echo "Building…"
forge build

echo "Deploying OrraTrivia with ENTROPY_ADDRESS=${ENTROPY_ADDRESS:-unset} on ${RPC_URL}…"
forge script script/DeployOrraTrivia.s.sol:DeployOrraTrivia \
  --rpc-url "$RPC_URL" \
  --broadcast \
  -vvvv

echo
echo "Next: set NEXT_PUBLIC_ORRA_TRIVIA_CONTRACT_ADDRESS in the app .env.local to the new OrraTrivia address from the forge output above."
