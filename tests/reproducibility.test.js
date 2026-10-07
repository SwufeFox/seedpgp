import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, test } from 'node:test';
import { build } from 'vite';
import testConfig from '../vite.test.config.js';

await build(testConfig);
const { decryptKey, decryptText, encryptText, generateDeterministicKey, readPrivateKey } = await import('../.test-dist/keygen-test.js');
const fixture = {
  name: 'SeedPGP Reproducibility Test',
  email: 'fixture@example.invalid',
  password: 'correct horse battery staple - test only',
  confirmPassword: 'correct horse battery staple - test only'
};
const digest = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

after(async () => {
  const { rm } = await import('node:fs/promises');
  await rm(new URL('../.test-dist/', import.meta.url), { recursive: true, force: true });
});

test('same recovery inputs reproduce exact armored keys and import with the same password', async () => {
  const first = await generateDeterministicKey(fixture);
  const second = await generateDeterministicKey({ ...fixture, email: 'FIXTURE@EXAMPLE.INVALID' });

  assert.equal(second.fingerprint, first.fingerprint);
  assert.equal(second.publicKey, first.publicKey);
  assert.equal(second.privateKey, first.privateKey);
  assert.equal(first.fingerprint, 'c9571435635de09e4abfc924289673917115fbca');
  assert.equal(digest(first.publicKey), '89ca0cbe2219788224ff57083ccbafe7356674cf7d15054cfe29335153800f18');
  assert.equal(digest(first.privateKey), '8d2bc4dabdcb0ea1d55d37b8fe91ed30eddab046a56adca3daf7928d3059dbf9');

  const differentMetadata = await generateDeterministicKey({ ...fixture, email: 'elsewhere@example.invalid' });
  assert.equal(differentMetadata.fingerprint, first.fingerprint);
  assert.notEqual(differentMetadata.publicKey, first.publicKey);

  const differentPassphrase = 'a different long passphrase - test only';
  const differentKey = await generateDeterministicKey({
    ...fixture,
    password: differentPassphrase,
    confirmPassword: differentPassphrase
  });
  assert.notEqual(differentKey.fingerprint, first.fingerprint);

  const encryptedSecretKey = await readPrivateKey({ armoredKey: first.privateKey });
  const unlockedSecretKey = await decryptKey({ privateKey: encryptedSecretKey, passphrase: fixture.password });
  assert.ok(unlockedSecretKey);

  const plaintext = '测试文本：SeedPGP encrypts and decrypts locally. 🐈';
  const ciphertext = await encryptText(plaintext, first.publicKey);
  assert.match(ciphertext, /^-----BEGIN PGP MESSAGE-----/);
  assert.equal(await decryptText(ciphertext, first.privateKey, fixture.password), plaintext);
  assert.equal(await decryptText(ciphertext, differentMetadata.privateKey, fixture.password), plaintext);
  await assert.rejects(
    decryptText(ciphertext, first.privateKey, 'incorrect recovery passphrase for test'),
    /无法解密/
  );
});
