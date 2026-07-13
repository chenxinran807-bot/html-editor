# Runtime dependencies

Vendored for offline prototype playback:

- React 18.3.1 UMD production build (`unpkg.com/react@18.3.1`)
- ReactDOM 18.3.1 UMD production build (`unpkg.com/react-dom@18.3.1`)
- Babel standalone 7.24.7 (`unpkg.com/@babel/standalone@7.24.7`)

PRD-provided local assets are copied into `assets/`; no runtime network requests are made.

## Integrity

| File | SHA-256 |
|---|---|
| `react.production.min.js` | `d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd` |
| `react-dom.production.min.js` | `35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d` |
| `babel.min.js` | `d9e33722fdfba37e4e428aa72cb58da65f18358bfb229e136dfc1285e76b03ff` |

These hashes matched fresh downloads from the pinned URLs on 2026-07-13.
