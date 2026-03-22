# QR Tools

`QR Tools` is a browser-only QR utility. It generates QR codes from text or URLs, can decode QR codes from the camera or uploaded images, and keeps everything client-side with no backend service.

You can use any of the links below to access the app:

- https://ipfs.io/ipfs/bafybeicpj77q77pf5alpr32yfrzvhrfwelzutnb3idlp55nfjcehvdsdru/
- https://dweb.link/ipfs/bafybeicpj77q77pf5alpr32yfrzvhrfwelzutnb3idlp55nfjcehvdsdru/
- https://w3s.link/ipfs/bafybeicpj77q77pf5alpr32yfrzvhrfwelzutnb3idlp55nfjcehvdsdru/
- https://cloudflare-ipfs.com/ipfs/bafybeicpj77q77pf5alpr32yfrzvhrfwelzutnb3idlp55nfjcehvdsdru/
- https://gateway.pinata.cloud/ipfs/bafybeicpj77q77pf5alpr32yfrzvhrfwelzutnb3idlp55nfjcehvdsdru/

## Reproducible Build

The production build is configured to be reproducible from a fresh clone:

- Relative asset paths are enabled via Vite `base: './'`, so the app works from IPFS gateways and nested content paths.
- The exact toolchain is pinned in the repo: Node `22.22.1` and npm `10.9.4`.
- Exact dependency versions are declared in `package.json` and locked in `package-lock.json`.
- `.npmrc` enables `engine-strict=true` so installs fail fast on the wrong Node/npm versions.
- Source maps are disabled for production output to avoid embedding local filesystem paths in emitted artifacts.

If you rebuild with the same committed sources, the exact toolchain above, and the commands below, you should get the same `dist/` contents and the same CID:

```bash
nvm use
npm ci
npm run build
export IPFS_PATH="$(mktemp -d)"
ipfs init
ipfs add -r -n -Q --cid-version=1 dist
```

Expected CID:

```text
bafybeicpj77q77pf5alpr32yfrzvhrfwelzutnb3idlp55nfjcehvdsdru
```

## Clean Rebuild Steps

From a fresh clone:

```bash
git clone <repo-url> qr-tools
cd qr-tools
nvm use
npm ci
npm run build
export IPFS_PATH="$(mktemp -d)"
ipfs init
ipfs add -r -n -Q --cid-version=1 dist
```

If `nvm` is not installed, use Node `22.22.1` and npm `10.9.4` directly before running `npm ci`.

## Verification Notes

The deterministic build contract for this repo is:

- Install dependencies with `npm ci`, not `npm install`.
- Build from the committed lockfile and exact versions already recorded in the repo.
- Do not add source maps or other build steps that inject timestamps, host metadata, absolute local paths, or random values into `dist/`.
- Compute the CID in no-publish mode with `ipfs add -r -n -Q --cid-version=1 dist`.
- If the CID changes, update this README in the same change so the project name remains `QR Tools` and all gateway links stay synchronized with the latest CID.
