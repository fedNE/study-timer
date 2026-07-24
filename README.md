# Study Cycle Timer

Minimal Tauri desktop timer for a 20-3-40-2-10-20 study cycle.

## Run

Install Rust and Node.js, then:

```sh
npm install
npm run dev
```

Build a desktop bundle:

```sh
npm run build
```

The frontend is dependency-free HTML/CSS/JS. Tauri serves `app/` directly for builds and uses the tiny `scripts/dev-server.js` static server during development.
