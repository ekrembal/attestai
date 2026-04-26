# Mutinynet Wallet

Mutinynet Wallet is a browser-only demo wallet built with React, TypeScript, and Vite. It derives a single local key, shows one Mutinynet `tb1...` receive address, tracks UTXOs through Esplora, and builds/signs/broadcasts simple P2WPKH spends in the client.

You can use any of the links below to access the app:

- [IPFS gateway (ipfs.io)](https://ipfs.io/ipfs/bafybeiafgaowyo4a2epgus45w5zdxaf4veeoifzo5rjx4niftz2wmci5re/)
- [IPFS gateway (dweb.link)](https://dweb.link/ipfs/bafybeiafgaowyo4a2epgus45w5zdxaf4veeoifzo5rjx4niftz2wmci5re/)
- [IPFS gateway (cloudflare-ipfs.com)](https://cloudflare-ipfs.com/ipfs/bafybeiafgaowyo4a2epgus45w5zdxaf4veeoifzo5rjx4niftz2wmci5re/)
- [IPFS gateway (w3s.link)](https://w3s.link/ipfs/bafybeiafgaowyo4a2epgus45w5zdxaf4veeoifzo5rjx4niftz2wmci5re/)

## Reproducible build

This repository is configured for deterministic, IPFS-compatible production builds:

- `base: "./"` in Vite keeps generated asset URLs relative so the app works from IPFS gateways and nested content paths.
- The browser entry imports [`src/polyfill.ts`](./src/polyfill.ts) first so `Buffer` is installed on `globalThis` before app or dependency code runs.
- The repo pins the toolchain with `Node 22.22.2` and `pnpm 10.33.2`.
- `package.json` uses exact dependency versions and the committed `pnpm-lock.yaml` locks the full dependency graph.
- The production build should be run from a clean checkout without local edits so the output and CID match.

## Clean rebuild steps

Use these exact commands from a fresh clone:

```bash
cd mutiny-wallet
corepack enable
corepack prepare pnpm@10.33.2 --activate
nvm use 22.22.2
pnpm install --frozen-lockfile
pnpm build
ipfs add -r -n -Q --cid-version=1 dist
```

If `nvm` is not installed, use another Node version manager or direct install to run exactly `Node 22.22.2` before `pnpm install`.

The production CID for the committed sources is:

```text
bafybeiafgaowyo4a2epgus45w5zdxaf4veeoifzo5rjx4niftz2wmci5re
```
