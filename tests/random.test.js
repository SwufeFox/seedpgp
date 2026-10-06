import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChaCha20 } from '../src/random.js';

const fromHex = (hex) => Uint8Array.from(hex.match(/.{2}/g), (byte) => Number.parseInt(byte, 16));
const toHex = (bytes) => Buffer.from(bytes).toString('hex');

test('ChaCha20 block matches RFC 8439 test vector', () => {
  const key = fromHex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
  const nonce = fromHex('000000090000004a00000000');
  const expected = '10f1e7e4d13b5915500fdd1fa32071c4c7d1f4c733c068030422aa9ac3d46c4ed2826446079faa0914c2d705d98b02a2b5129cd1de164eb9cbd083e8a2503c4e';
  const stream = createChaCha20(key, nonce, 1);
  assert.equal(toHex(stream(64)), expected);
  stream.destroy();
  assert.throws(() => stream(1), /已销毁/);
});

test('ChaCha20 stream refuses to wrap its 32-bit block counter', () => {
  const stream = createChaCha20(new Uint8Array(32), new Uint8Array(12), 0xffffffff);
  assert.equal(stream(64).length, 64);
  assert.throws(() => stream(1), /长度超限/);
  stream.destroy();
});