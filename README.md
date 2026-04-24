# VOLLEY3D Mobile

A mobile-first Three.js volleyball arcade game inspired by the mock image.

## Features
- Neon 3D court with animated players and ball trails
- Touch-friendly serve / spike / block flow
- Aim slider for cross-court placement
- Play-insights, shot map, and momentum HUD

## Local dev
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Run production preview
```bash
npm start
```

## Deploy to Google Cloud Run
```bash
gcloud run deploy volley3d-mobile --source . --region europe-west2 --allow-unauthenticated --port 8080
```

If you want a different region, swap `europe-west2` for your preferred Cloud Run region.
