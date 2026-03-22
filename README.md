# AttestAI Upload Limit Helper

AttestAI Upload Limit Helper is a browser-only utility for compressing PDFs, optimizing images, and preparing passport photos without uploading files to a server. The production build is configured for reproducible output and uses relative asset paths so it works correctly from IPFS gateways and nested content paths.

You can use any of the links below to access the app:

- [ipfs.io](https://ipfs.io/ipfs/zdj7WdJNV4LLfGGrjhLpGZgnAXkzUb9s1RonXASUs3vR7ucPg/)
- [dweb.link](https://dweb.link/ipfs/zdj7WdJNV4LLfGGrjhLpGZgnAXkzUb9s1RonXASUs3vR7ucPg/)
- [Cloudflare IPFS](https://cloudflare-ipfs.com/ipfs/zdj7WdJNV4LLfGGrjhLpGZgnAXkzUb9s1RonXASUs3vR7ucPg/)
- [Pinata Gateway](https://gateway.pinata.cloud/ipfs/zdj7WdJNV4LLfGGrjhLpGZgnAXkzUb9s1RonXASUs3vR7ucPg/)

## Reproducible Build

This repo pins the reproducible build inputs in version control:

- Node.js `22.22.1` via `.nvmrc`, `.node-version`, and `package.json`
- npm `10.9.4` via `package.json#packageManager` and `package.json#engines`
- Dependencies via the committed `package-lock.json`

The production build avoids root-relative asset URLs by using a relative Vite base (`./`). That makes the generated `dist/` compatible with IPFS gateways and nested content paths. The checked-in build process also avoids embedding build timestamps, random IDs, absolute local filesystem paths, or build-machine-specific metadata in the emitted bundle.

## Build From A Fresh Clone

Use these exact commands from a clean checkout:

```bash
git clone <repo-url>
cd attestai
nvm install 22.22.1
nvm use 22.22.1
npm --version
npm ci
npm run build
```

Expected package manager version:

```bash
10.9.4
```

## Verify The CID Locally

After building, calculate the CID locally without publishing anything:

```bash
mkdir -p .ipfs-tmp
IPFS_PATH=$PWD/.ipfs-tmp npx --yes ipfs init
IPFS_PATH=$PWD/.ipfs-tmp npx --yes ipfs add -r -n -Q --cid-version=1 dist
```

Expected CID for the committed sources:

```bash
zdj7WdJNV4LLfGGrjhLpGZgnAXkzUb9s1RonXASUs3vR7ucPg
```

If you build from a fresh clone with the exact versions above and `npm ci`, the generated `dist/` output and CID should match this value.
