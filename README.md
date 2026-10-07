# SeedPGP

A small static web app for encrypting and decrypting text with an OpenPGP identity that can be deterministically recovered from one strong passphrase. It runs in the browser; there is no account or server-side key processing.

## Use

1. Open the hosted page over HTTPS, or run locally with `npm ci && npm run dev`.
2. Enter an Email address and a unique, hard-to-guess recovery passphrase of at least 16 Unicode characters.
3. Choose **Encrypt** or **Decrypt** and enter plain text or an armored PGP message. Save the resulting ciphertext or plaintext as needed.
4. To decrypt later or on another device, use exactly the same passphrase. The optional **Key export** section can download the public key or the passphrase-protected private key for use in other OpenPGP software.

The passphrase alone determines the key material. Email is included as public OpenPGP User ID metadata; it is not a second secret and does not affect the generated key material. The app uses the local part of the Email as the display name. Changing the Email changes the public identity certificate but not the key fingerprints, so the same passphrase can decrypt existing messages even if the Email label changes. Use a different passphrase for each PGP identity because using the same passphrase deliberately reuses the same key material.

The default Encrypt action encrypts to the public key recovered from the current passphrase. A recipient who needs to encrypt to you in a separate PGP app needs your exported public key; that recipient must not receive your private key or recovery passphrase.

## Security model and trade-offs

- **The passphrase is the only recovery secret.** Forgetting it means the generated key and messages encrypted to it cannot be recovered. There is no reset service or hidden recovery secret.
- **Use a unique, long, high-entropy passphrase.** A PGP public key is an offline verifier: someone who has it can try candidate passphrases locally and check if the derived public key matches. Argon2id (64 MiB, 3 iterations, 1 lane) raises the cost per guess; it cannot rescue a weak or reused password. The 16-character minimum is only a guardrail, not an entropy guarantee.
- The same passphrase protects the exported secret-key file. Do not share that file or your passphrase. Email is public metadata and may be visible wherever the public key is shared.
- The app stores no form values in local storage, cookies, or a backend, and its own code makes no network requests. It uses system fonts and can work offline once the page and assets are loaded. **A hosted static page is not a trusted execution environment:** its host can replace the JavaScript it serves. For valuable keys, review the source, build it yourself, and use the generated page offline.
- This is a custom deterministic key-generation construction, not a substitute for an independent cryptographic audit. Do not use it for high-value identities until the design and implementation have been reviewed. Keep an encrypted backup of keys already in use and test recovery before relying on this as your only copy.
- Plaintext, the recovery passphrase, and private-key material exist in browser memory while the app is in use. Clear the page when finished, and avoid using a compromised device or browser.

## Reproducibility contract

The versioned scheme is `seedpgp-password-v1`. Do not change its inputs, normalization, KDF parameters, RNG bridge, OpenPGP.js version, key creation date, or generated algorithms without defining a new scheme version. The fixed creation time is `2026-10-07T00:00:00Z`. The app uses Argon2id to derive a 256-bit ChaCha20 seed from the NFC-normalized passphrase, then routes OpenPGP.js randomness for Ed25519/Curve25519 key material and packet salts through that deterministic stream. The generated OpenPGP key is Ed25519 for signing/certification with a Curve25519 encryption subkey.

The automated test builds the same patched OpenPGP.js path used by the app, generates the same test-only identity twice, compares exact armored output against a committed test vector, confirms the secret key unlocks with the passphrase, and exercises an OpenPGP message round-trip. The test fixture is public and must never be used as a real key. This verifies repeatability in the tested Node/build environment; it does not prove every browser/runtime behaves identically, which is why the project is version-pinned and the hosted page should not be treated as audited cryptographic software.

## Development

```sh
npm ci
npm test
npm run build
npm run preview
```

`npm run build` creates the static site in `dist/`. GitHub Actions publishes `dist/` to GitHub Pages on pushes to `main`.

## Licensing

Project code is MIT-licensed. The browser bundle also includes OpenPGP.js (LGPL-3.0-or-later) and hash-wasm (MIT); see `THIRD_PARTY_NOTICES.md` and `licenses/`.