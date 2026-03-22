# PDF Utils

Current reproducible production CID: `bafybeig5gugrplkyj5x2qkxx3fqwbxiharumon5xkos4kz4lhayju76vaq`

- [ipfs.io root](https://ipfs.io/ipfs/bafybeig5gugrplkyj5x2qkxx3fqwbxiharumon5xkos4kz4lhayju76vaq/)
- [ipfs.io app route](https://ipfs.io/ipfs/bafybeig5gugrplkyj5x2qkxx3fqwbxiharumon5xkos4kz4lhayju76vaq/#/)
- [ipfs.io merge tool](https://ipfs.io/ipfs/bafybeig5gugrplkyj5x2qkxx3fqwbxiharumon5xkos4kz4lhayju76vaq/#/tools/merge)
- [Cloudflare gateway](https://cloudflare-ipfs.com/ipfs/bafybeig5gugrplkyj5x2qkxx3fqwbxiharumon5xkos4kz4lhayju76vaq/)
- [Pinata gateway](https://gateway.pinata.cloud/ipfs/bafybeig5gugrplkyj5x2qkxx3fqwbxiharumon5xkos4kz4lhayju76vaq/#/tools/extract-text)

## Reproducibility

This repo pins the full install/build toolchain in versioned files and committed manifests:

- Node `22.22.1` in `.nvmrc` and `.node-version`
- npm `10.9.4` in `package.json`
- exact dependency versions in `package.json` with the resolved tree in `package-lock.json`

From a fresh clone, these are the exact clean commands used to reproduce the build and CID locally without publishing anything:

```bash
nvm use
npm ci
npm run build
npm exec -- ipfs-car pack dist --output /tmp/pdf-utils-app.car
```

The last command should print:

```text
bafybeig5gugrplkyj5x2qkxx3fqwbxiharumon5xkos4kz4lhayju76vaq
```

The production build is IPFS-compatible because emitted asset URLs stay relative (`./...`) and routing uses `HashRouter`, so the app works from gateway paths and nested content paths without origin-root assumptions.

## Overview

Browser-only PDF utilities built with React, TypeScript, and Vite. The app runs entirely client-side for merge, split, reorder, rotate, delete, page extraction, and text extraction workflows.

## Development

```bash
npm install
npm run dev
```

## Production Build Notes

- Vite uses `base: "./"` so emitted assets resolve from the current content path.
- React Router uses `HashRouter` so tool routes work on IPFS gateways and other static hosts without rewrite rules.
- The verified production build was created locally with `npm ci`, `npm run build`, and `npm exec -- ipfs-car pack dist --output /tmp/pdf-utils-app.car`.
