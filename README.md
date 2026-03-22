# attestai

AttestAI is a browser-based image conversion and optimization app built with React, TypeScript, and Vite. The production build is configured for reproducible output and IPFS-compatible hosting, including relative asset paths so it works correctly from IPFS gateways and nested content paths.

You can use any of the links below to access the app:

- [ipfs.io](https://ipfs.io/ipfs/bafybeidtyafzy3v62cif7u4u7vkmwskn232rmkhmiq4t6jls5wjkoy7kbe/)
- [dweb.link](https://dweb.link/ipfs/bafybeidtyafzy3v62cif7u4u7vkmwskn232rmkhmiq4t6jls5wjkoy7kbe/)
- [cloudflare-ipfs.com](https://cloudflare-ipfs.com/ipfs/bafybeidtyafzy3v62cif7u4u7vkmwskn232rmkhmiq4t6jls5wjkoy7kbe/)
- [gateway.pinata.cloud](https://gateway.pinata.cloud/ipfs/bafybeidtyafzy3v62cif7u4u7vkmwskn232rmkhmiq4t6jls5wjkoy7kbe/)

Expected production CID:

```text
bafybeidtyafzy3v62cif7u4u7vkmwskn232rmkhmiq4t6jls5wjkoy7kbe
```

## Reproducibility

The repo pins the build inputs needed to reproduce the same `dist/` output and CID from a fresh clone:

- Node.js is pinned to `22.22.1` in [`package.json`](/home/runner/work/attestai/attestai/package.json) and [`.nvmrc`](/home/runner/work/attestai/attestai/.nvmrc).
- npm is pinned to `10.9.4` in [`package.json`](/home/runner/work/attestai/attestai/package.json).
- Dependencies are pinned to exact versions in [`package.json`](/home/runner/work/attestai/attestai/package.json), and the full dependency tree is committed in [`package-lock.json`](/home/runner/work/attestai/attestai/package-lock.json).
- Vite is configured with a relative base path and source maps are disabled in [`vite.config.ts`](/home/runner/work/attestai/attestai/vite.config.ts), which avoids root-relative asset URLs and prevents leaking absolute local filesystem paths into build artifacts.
- The checked-in [`index.html`](/home/runner/work/attestai/attestai/index.html) also uses relative links.

## Rebuild From A Fresh Clone

Clone the repository and use the exact toolchain versions:

```bash
git clone <repo-url> attestai
cd attestai
nvm install 22.22.1
nvm use 22.22.1
node -v
npm -v
```

The version checks should print:

```text
v22.22.1
10.9.4
```

Install dependencies and create a clean production build:

```bash
npm ci
npm run build
```

Calculate the CID locally without publishing anything:

```bash
export IPFS_PATH="$PWD/.ipfs-cid"
ipfs init
ipfs add -r -n -Q --cid-version=1 dist
```

The expected result is:

```text
bafybeidtyafzy3v62cif7u4u7vkmwskn232rmkhmiq4t6jls5wjkoy7kbe
```

Notes:

- `npm ci` must be used instead of `npm install` so the committed lockfile is applied exactly.
- `ipfs add -r -n -Q --cid-version=1 dist` computes the directory CID only. The `-n` flag prevents publishing.
- I verified the current repo state with a clean `npm ci`, then ran the production build twice and got the same CID both times.
