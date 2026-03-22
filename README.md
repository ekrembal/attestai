# PDF Utils

Browser-only PDF utilities built with React, TypeScript, and Vite. The app runs entirely client-side for merge, split, reorder, rotate, delete, page extraction, and text extraction workflows.

## Development

```bash
npm install
npm run dev
```

## Production Build

This app is configured for static hosting with relative production asset paths:

- Vite uses `base: "./"` so emitted assets resolve from the current content path.
- React Router uses `HashRouter` so tool routes work on IPFS gateways and other static hosts without rewrite rules.

Build the production output with:

```bash
npm run build
```

## IPFS Packaging

The current production build in [`dist/`](/home/runner/work/attestai/attestai/dist) was packed locally with `ipfs-car` and not published:

```bash
npx --yes ipfs-car pack dist --output dist.car
```

Generated CID:

```text
bafybeihyhv2amgqxwbuflexs3hv4tueeup7jm2pgag7gjbifgzk7w3f4dq
```

Example gateway URLs for this exact build:

- Root app: `https://ipfs.io/ipfs/bafybeihyhv2amgqxwbuflexs3hv4tueeup7jm2pgag7gjbifgzk7w3f4dq/`
- Home route: `https://ipfs.io/ipfs/bafybeihyhv2amgqxwbuflexs3hv4tueeup7jm2pgag7gjbifgzk7w3f4dq/#/`
- Merge tool: `https://ipfs.io/ipfs/bafybeihyhv2amgqxwbuflexs3hv4tueeup7jm2pgag7gjbifgzk7w3f4dq/#/tools/merge`
- Extract text tool: `https://ipfs.io/ipfs/bafybeihyhv2amgqxwbuflexs3hv4tueeup7jm2pgag7gjbifgzk7w3f4dq/#/tools/extract-text`

Alternative gateways with the same CID:

- `https://cloudflare-ipfs.com/ipfs/bafybeihyhv2amgqxwbuflexs3hv4tueeup7jm2pgag7gjbifgzk7w3f4dq/`
- `https://gateway.pinata.cloud/ipfs/bafybeihyhv2amgqxwbuflexs3hv4tueeup7jm2pgag7gjbifgzk7w3f4dq/#/tools/merge`
