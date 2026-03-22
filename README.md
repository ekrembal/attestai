# Document Form Helper

Document Form Helper is a browser-only PDF annotation app. It lets you load a local PDF, add text, place signatures, stamp images, and export the edited file without sending documents to a server.

You can use any of the links below to access the app:

- [ipfs.io](https://ipfs.io/ipfs/bafybeigncaiyzk6tcf6n5ao4f2s5hwmbw4exltvku6kywyyvecsbvu4mkm/)
- [dweb.link](https://dweb.link/ipfs/bafybeigncaiyzk6tcf6n5ao4f2s5hwmbw4exltvku6kywyyvecsbvu4mkm/)
- [w3s.link](https://w3s.link/ipfs/bafybeigncaiyzk6tcf6n5ao4f2s5hwmbw4exltvku6kywyyvecsbvu4mkm/)
- [gateway.pinata.cloud](https://gateway.pinata.cloud/ipfs/bafybeigncaiyzk6tcf6n5ao4f2s5hwmbw4exltvku6kywyyvecsbvu4mkm/)

## Reproducible IPFS Build

This repository is pinned to:

- Node `22.22.1`
- npm `10.9.4`
- Exact dependency versions in `package.json`
- The committed `package-lock.json`

The production build is configured for IPFS and nested-path hosting:

- Vite uses relative asset URLs via `base: "./"`
- The app avoids production sourcemaps, which prevents absolute local filesystem paths from leaking into `dist/`
- Rebuilds should be performed from a clean checkout with the exact toolchain above

## Clean Rebuild Steps

From a fresh clone, use exactly these commands:

```bash
nvm use
npm ci
npm run build
ipfs add -r -n -Q --cid-version=1 dist
```

If you want to simulate a fresh local rebuild in an existing checkout, run:

```bash
rm -rf node_modules dist
nvm use
npm ci
npm run build
ipfs add -r -n -Q --cid-version=1 dist
```

The resulting CID for `dist/` should be:

```text
bafybeigncaiyzk6tcf6n5ao4f2s5hwmbw4exltvku6kywyyvecsbvu4mkm
```
