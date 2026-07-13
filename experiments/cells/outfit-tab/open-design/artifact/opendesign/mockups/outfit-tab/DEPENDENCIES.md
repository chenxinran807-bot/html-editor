# Runtime dependencies

The prototype is self-contained and does not require network access at preview time. Fixed browser builds are vendored under `vendor/`:

- React 18.3.1 — `react.production.min.js`
- ReactDOM 18.3.1 — `react-dom.production.min.js`
- Babel Standalone 7.24.7 — `babel.min.js`

They were downloaded from unpkg during the experiment. React state and effects use `useState` and `useEffect`; the source remains readable JSX split into functional components in `index.html`.
