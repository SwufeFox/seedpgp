# Third-party notices

This application bundles the following third-party runtime libraries in its browser build:

- **OpenPGP.js 6.3.2** — LGPL-3.0-or-later. The license text is in [`licenses/openpgp-LICENSE.txt`](licenses/openpgp-LICENSE.txt). The deterministic RNG bridge is applied to the installed OpenPGP.js source at build time by `vite.config.js`; the project source and pinned dependency lockfile are provided here so the bundle can be rebuilt.
- **hash-wasm 4.12.0** — MIT. The license text is in [`licenses/hash-wasm-LICENSE.txt`](licenses/hash-wasm-LICENSE.txt).

The MIT license at the repository root applies to original project code, not to third-party components whose own licenses are listed above.