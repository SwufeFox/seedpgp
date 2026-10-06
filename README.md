# SeedPGP

A small static web app that deterministically creates an OpenPGP keypair in the browser. One long passphrase is the only recovery secret. There is no wallet signature, mnemonic, recovery file, account, or server-side key generation.

## Use

1. Open the hosted page over HTTPS, or run a local build (`npm ci && npm run dev`).
2. Enter a PGP display name, optional Email, and a unique, hard-to-guess passphrase of at least 16 Unicode characters.
3. Save the encrypted private-key `.asc` file somewhere durable. It is protected by the same passphrase.
4. To regenerate the same key material on another device, enter the same passphrase. Name and Email are public OpenPGP User ID metadata, not recovery inputs. Use the same identity metadata too if you want the full exported certificate to match byte-for-byte.

The passphrase alone determines the primary key and encryption subkey. It is case-sensitive, spaces are significant, and the input is NFC-normalized. Therefore using the same passphrase for different names or Email addresses deliberately reuses the same key material; use a different passphrase for each PGP identity. Changing the name or Email changes User ID certifications but not the key fingerprints. Email can be left blank.

## Security model and trade-offs

- **The passphrase is the only secret needed to regenerate the key.** This makes migration simple, but forgetting it means the generated key cannot be recovered. There is no reset service or hidden recovery secret.
- **Use a unique, long, high-entropy passphrase.** A PGP public key is an offline verifier: anyone who has it can try candidate passphrases locally and check whether the derived public key matches. Argon2id (64 MiB, 3 iterations, 1 lane) raises the cost per guess; it cannot rescue a weak or reused password. The 16-character minimum is only a guardrail, not an entropy guarantee.
- The same passphrase is used to encrypt the exported secret key, so it can be imported into normal OpenPGP software. Do not share the private-key file or passphrase.
- The app's own code makes no network requests and stores no form values in local storage, cookies, or a backend. Once loaded, it can work offline. **A hosted static page is not a trusted execution environment:** its host can replace the JavaScript it serves. For valuable keys, review the source, build it yourself, and use the generated page offline.
- This is a custom deterministic key-generation construction, not a substitute for an independent cryptographic audit. Do not use it for high-value identities until the design and implementation have been reviewed. Keep an encrypted backup of keys already in use and test recovery before relying on this as your only copy.

## Reproducibility contract

The versioned scheme is `seedpgp-password-v1`. Do not change its inputs, normalization, KDF parameters, RNG bridge, OpenPGP.js version, key creation date, or generated algorithms without defining a new scheme version. The fixed creation time is `2026-10-07T00:00:00Z`. The app uses Argon2id to derive a 256-bit ChaCha20 seed from the NFC-normalized passphrase, then routes OpenPGP.js randomness for Ed25519/Curve25519 key material and packet salts through that deterministic stream. The generated OpenPGP key is Ed25519 for signing/certification with a Curve25519 encryption subkey.

The automated test builds the same patched OpenPGP.js path used by the app, generates the same test-only identity twice, compares exact armored output against a committed test vector, and confirms the secret key unlocks with the passphrase. The test fixture is public and must never be used as a real key. This verifies repeatability in the tested Node/build environment; it does not prove every browser/runtime behaves identically, which is why the project is version-pinned and the hosted page should not be treated as audited cryptographic software.

## Development

```sh
npm ci
npm test
npm run build
npm run preview
```

`npm test` performs an end-to-end deterministic generation check. `npm run build` creates the static site in `dist/`. GitHub Actions publishes `dist/` to GitHub Pages on pushes to `main`.

## Licensing

Project code is MIT-licensed. The browser bundle also includes OpenPGP.js (LGPL-3.0-or-later) and hash-wasm (MIT); see `THIRD_PARTY_NOTICES.md` and `licenses/`.