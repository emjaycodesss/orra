# Orra contracts (Foundry)

## Dependencies

This project vendors **`forge-std`** under `lib/forge-std/` (see `foundry.toml` remappings).

If `lib/forge-std` is missing or incomplete after a fresh clone, install it:

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit
forge build
forge test
```

Do not commit private keys; use `env.deploy.example` as a template for `contracts/.env`.
