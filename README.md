# PDF Utils

Use any of the gateway links below to access the app.

Current reproducible production CID: `bafybeih45viwbjixio2wg4224o4kebt6jpgl7vh56obbnhcphpxh3l5kmi`

- [ipfs.io root](https://ipfs.io/ipfs/bafybeih45viwbjixio2wg4224o4kebt6jpgl7vh56obbnhcphpxh3l5kmi/)
- [ipfs.io app route](https://ipfs.io/ipfs/bafybeih45viwbjixio2wg4224o4kebt6jpgl7vh56obbnhcphpxh3l5kmi/#/)
- [ipfs.io merge tool](https://ipfs.io/ipfs/bafybeih45viwbjixio2wg4224o4kebt6jpgl7vh56obbnhcphpxh3l5kmi/#/tools/merge)
- [Cloudflare gateway](https://cloudflare-ipfs.com/ipfs/bafybeih45viwbjixio2wg4224o4kebt6jpgl7vh56obbnhcphpxh3l5kmi/)
- [Pinata gateway](https://gateway.pinata.cloud/ipfs/bafybeih45viwbjixio2wg4224o4kebt6jpgl7vh56obbnhcphpxh3l5kmi/#/)
- [dweb.link gateway](https://bafybeih45viwbjixio2wg4224o4kebt6jpgl7vh56obbnhcphpxh3l5kmi.ipfs.dweb.link/#/)

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
npm exec --package kubo -- ipfs init
npm exec --package kubo -- ipfs add -r -n -Q --cid-version=1 dist
```

The last command should print:

```text
bafybeih45viwbjixio2wg4224o4kebt6jpgl7vh56obbnhcphpxh3l5kmi
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
- The verified production CID was created locally with `npm ci`, `npm run build`, `npm exec --package kubo -- ipfs init`, and `npm exec --package kubo -- ipfs add -r -n -Q --cid-version=1 dist`.
