<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/18FCqvoAAXSVpsG6pUH40eHzqqykHqHeD

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy (avoid black screen)

**Do not deploy only `index.html` and `index.tsx`.** Browsers cannot run TypeScript; the app must be built first.

1. **Build the app:**
   ```bash
   npm run build
   ```
2. **Deploy the whole `dist/` folder** (not the project root). Upload everything inside `dist/` to your host:
   - `dist/index.html`
   - `dist/assets/*.js` (and any `.css`)
   - `dist/manifest.json`, `dist/sw.js` if present
3. **If your site is at a subpath** (e.g. `https://user.github.io/unihub-main/`), set the base path before building:
   ```bash
   # Windows (PowerShell)
   $env:BASE_PATH="/unihub-main/"; npm run build
   # macOS/Linux
   BASE_PATH=/unihub-main/ npm run build
   ```
   Then deploy the contents of `dist/` into that subpath.

## Deploy on Vercel (fix black preview)

1. In Vercel, set **Root Directory** to `unilink` (if your repo root is the parent folder).
2. Add **Environment Variable**: `GEMINI_API_KEY` (or `API_KEY`) with your Gemini API key.
3. Deploy. `vercel.json` in `unilink` tells Vercel to run `npm run build` and serve the `dist/` output. Do **not** deploy only `index.html` and `index.tsx` — the build step is required.
