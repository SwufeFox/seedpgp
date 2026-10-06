import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const openpgpEntry = resolve('node_modules/openpgp/dist/openpgp.mjs');

function deterministicOpenPGPRngBridge() {
  return {
    name: 'deterministic-openpgp-rng-bridge',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].endsWith('/node_modules/openpgp/dist/openpgp.mjs')) return null;
      const marker = 'globalThis.__seedpgpRandomBytes';
      if (code.includes(marker)) return null;
      const patches = [
        [
          `function getRandomBytes(length) {
    const webcrypto`,
          `function getRandomBytes(length) {
    const deterministicBytes = globalThis.__seedpgpRandomBytes;
    if (deterministicBytes) return deterministicBytes(length);
    const webcrypto`
        ],
        [
          `async function generate$3(algo) {
    switch (algo) {`,
          `async function generate$3(algo) {
    const deterministicBytes = globalThis.__seedpgpRandomBytes;
    if (deterministicBytes && algo === enums.publicKey.ed25519) {
        const { default: ed25519 } = await Promise.resolve().then(function () { return naclFast; });
        const seed = deterministicBytes(32);
        const { publicKey: A } = ed25519.sign.keyPair.fromSeed(seed);
        return { A, seed };
    }
    switch (algo) {`
        ],
        [
          `async function generate$2(algo) {
    switch (algo) {`,
          `async function generate$2(algo) {
    const deterministicBytes = globalThis.__seedpgpRandomBytes;
    if (deterministicBytes && algo === enums.publicKey.x25519) {
        const { default: x25519 } = await Promise.resolve().then(function () { return naclFast; });
        const k = deterministicBytes(32);
        const { publicKey: A } = x25519.box.keyPair.fromSecretKey(k);
        return { A, k };
    }
    switch (algo) {`
        ]
      ];
      let transformed = code;
      for (const [needle, replacement] of patches) {
        const occurrences = transformed.split(needle).length - 1;
        if (occurrences !== 1) {
          throw new Error(`OpenPGP.js RNG patch expected one match; found ${occurrences}: ${needle.slice(0, 48)}`);
        }
        transformed = transformed.replace(needle, replacement);
      }
      return { code: transformed, map: null };
    }
  };
}

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'seedpgp';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? `/${repositoryName}/` : '/',
  optimizeDeps: { exclude: ['openpgp'] },
  plugins: [deterministicOpenPGPRngBridge()],
  resolve: { alias: [{ find: /^openpgp$/, replacement: openpgpEntry }] },
  build: { target: 'es2022', sourcemap: false }
});