# Prompt Paster

A Chrome and Firefox WebExtension for saving selected page text as prompts and
pasting recently used prompts into editable fields.

## Build

```bash
npm install
npm run build
```

The extension build is written to `dist/`.

## Load In Chrome

1. Open `chrome://extensions`.
2. Enable developer mode.
3. Choose **Load unpacked** and select `dist/`.

## Load In Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `dist/manifest.json`.

## Usage

The default shortcut is `Ctrl + Shift + Space`.

- Press the shortcut while page text is selected to save it as a prompt.
- Press the shortcut while an input, textarea, or editable field is focused to
  open the prompt picker.
- Open the extension options page to change the shortcut and manage prompts.

The shortcut is handled by the content script inside web pages. Browser-level
extension command shortcuts are managed by Chrome and Firefox and cannot be set
programmatically by the extension.

## shadcn/ui

This project was initialized from the official shadcn/ui Vite template:

```bash
npx shadcn@latest init --template vite --name attestai --yes --no-monorepo --base radix --preset nova
```

UI primitives were added with the shadcn CLI:

```bash
npx shadcn@latest add input textarea label dialog popover command scroll-area separator badge --yes
```
