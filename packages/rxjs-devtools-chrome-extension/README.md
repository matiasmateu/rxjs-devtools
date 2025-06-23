# ⚠️ Project Status: Under Development

> **Note:** This project is currently under active development. Only beta versions will be published for now. Features, APIs, and behaviors may change frequently until a stable release is announced.

# RXJS DevTools - Chrome Extension Package

This README provides an overview and instructions for working with the Chrome extension package located inside the monorepo. It is optimized for Cursor integration, offering clear metadata to help Cursor index and navigate the package.

---

## 📦 Package Metadata

```yaml
name: @reefmix/rxjs-devtools-chrome-extension
version: 1.0.0
author: Matias Mateu
description: A Chrome extension for rxjs devtools
license: MIT
main: dist/index.js
manifest: dist/manifest.json
private: false
```

* **name**: Package identifier
* **version**: Current version
* **main**: Entry point after build
* **manifest**: Path to Chrome manifest

---

## 🚀 Getting Started

### Prerequisites

* Node.js >= 14
* TypeScript -> compiled inside dist folder
* yarn
* Cursor extension for VSCode or compatible editor

### Installation

1. From the monorepo root, run:

   ```bash
   yarn install
   ```
2. Navigate to the extension package:

   ```bash
   cd packages/rxjs-devtools-chrome-extension
   ```

---

## 🗂️ Directory Structure

```plaintext
packages/rxjs-devtools-chrome-extension/
├── src/
│   ├── background.ts       # Background script
│   ├── content.ts          # Content script
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.tsx       # Popup UI
│   └── manifest.json       # Chrome manifest
├── public/
│   └── icons/              # Extension icons
├── dist/                   # Compiled output
├── package.json
├── tsconfig.json
├── webpack.config.js       # Build config
└── README.md               # This file
```

* **src/**: Source code for extension
* **public/icons**: PNG/SVG icons
* **dist/**: Build artifacts

---

## 🛠️ Scripts

| Command        | Description                        |
| -------------- | ---------------------------------- |
| `yarn build`   | Bundle and output to `dist/`       |
| `yarn watch`   | Rebuild on changes for development |
| `yarn lint`    | Run ESLint                         |
| `yarn test`    | Run unit tests                     |
| `yarn package` | Create `.zip` for Chrome upload    |

---

## 🧑‍💻 Development

1. Run in watch mode:

   ```bash
   ```

yarn watch

````
2. Load unpacked extension in Chrome:
   1. Open `chrome://extensions`
   2. Enable **Developer mode**
   3. Click **Load unpacked**
   4. Select `packages/chrome-extension/dist`

---

## 📋 Manifest Configuration

Should also include the required icons.

Key fields in `src/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "RxJs DevTools",
  "version": "1.0.0",
  "permissions": ["storage", "tabs"],
  "background": {"service_worker": "background.js"},
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }],
  "action": {"default_popup": "popup.html"}
}
````

---

## 🔍 Cursor Integration

Cursor will use the YAML metadata block and code annotations to index:

* Package entry points
* Script definitions
* File and folder relationships

To improve Cursor insights, add JSDoc/TSDoc comments in source files and ensure scripts in `package.json` follow naming conventions.

---

## 📦 Publishing

1. Ensure version bump in `package.json`.
2. Build the package:

   ```bash
   ```

yarn build

````
3. Zip for Chrome Web Store:
   ```bash
yarn package
````

---

## 📖 Further Reading

* [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
* [Monorepo Best Practices](https://monorepo.tools/)