# IPS Frontend

Static frontend for the IPS workflow.

This repository is intended for static hosting, for example on GitHub Pages.
It does not contain API keys and must call a separate backend service.

## Files

- `index.html`
- `styles.css`
- `main.js`
- `config.js`
- `.nojekyll`

## Local use

Open `index.html` in a browser and point the UI to a running backend.

## Backend configuration

Edit `config.js` before publishing:

```js
window.IPS_CONFIG = {
  backendUrl: "https://your-backend.example.org",
};
```

The backend must expose CORS headers for the frontend origin.

## Features

- Scopus author search
- IPS table generation
- Detailed table generation
- User CSV upload and comparison
- CSV export

## Deploy

Publish the contents of this repository as static files.

Keep the Scopus key only on the backend.
