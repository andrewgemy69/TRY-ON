# Forma — Glasses Try-On Studio

Browser-based glasses try-on using MediaPipe Face Landmarker and Three.js. Face tracking and rendering happen locally in the browser; camera frames are not uploaded.

## Run locally

```bash
npm install
npm run dev
```

Open the localhost URL printed by Vite and allow camera access. `npm run build` creates the static site in `dist/`.

## Publish a permanent test link

The site is static and can be hosted free on GitHub Pages. Push this folder to a GitHub repository, then open **Settings → Pages → Build and deployment → Source: GitHub Actions**. The workflow builds and deploys `dist/` on every push. GitHub supplies a permanent HTTPS link suitable for iPhone Safari; your PC does not need to stay on after deployment.

The source and model assets become public when hosted from a public repository. The glasses model is user-provided; ensure you have permission to redistribute it before making the repository public.

## Included models

The Face Landmarker task and MediaPipe WASM runtime are stored under `public/`. The glasses GLB is in `public/models/Glasses.glb`. The fit finder is an estimate based on supplied reference dimensions, not a guarantee of physical fit.
