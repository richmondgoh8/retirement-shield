# Repository Guidelines for AI Agents

## Overview
Retirement Shield is a local-first Singapore retirement planning Progressive Web App (PWA) comparing Community Care Apartments (CCA) and Home + Helper scenarios against CPF rules (OA/SA/MA/RA, CPF LIFE Standard/Escalating, FRS/ERS) and outside investments. All calculation runs client-side with zero runtime framework dependencies.

---

## 1. Clean Working Tree & Ephemeral File Hygiene
- **Zero untracked leftovers:** Never leave untracked scratch files, one-off test scripts, or temporary dumps in the repository root or subdirectories upon concluding a task.
- **Scratch & debugging scripts:** If creating temporary scripts to reproduce issues or verify calculations, clean them up (delete them) before finishing.
- **Atomic configuration changes:** Never reference an untracked file in persistent configurations (`package.json`, `Makefile`, `.github/workflows/`, etc.). If a new test or file is intentionally added to project scripts, stage/commit it alongside the configuration changes.
- **Verification before finish:** Always run `git status -u` before concluding to confirm no unintentional files or half-applied edits remain.

---

## 2. Module & File Extension Conventions
- **Browser runtime (`app.js`, `model.js`):**
  - Vanilla JavaScript (`.js`).
  - No external runtime dependencies or node-specific globals in client code.
  - `model.js` exports via UMD/IIFE (`root.RetirementModel = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;`) to allow direct loading in browsers and headless testing in Node.
- **Build tooling (`tools/*.mjs`):**
  - Node ES Modules with explicit `.mjs` extensions (`build.mjs`, `prune-css.mjs`, `icons.mjs`).
- **Test suites (`*.test.cjs`):**
  - CommonJS (`.cjs`) using Node's built-in test runner: `node:test` and `node:assert/strict`.
  - Execute via `npm test` (`node --test model.test.cjs pwa.test.cjs`).

---

## 3. Verification Commands
- `npm test`: Runs Node calculation invariant tests and PWA bundle validation. Must pass before completing any change.
- `npm run build`: Minifies and hashes assets into `dist/`.
- `npm run format`: Formats code, styles, tests, docs, and JSON using Prettier.
