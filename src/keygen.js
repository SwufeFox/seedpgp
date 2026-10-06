import * as openpgp from 'openpgp';
import { argon2id } from 'hash-wasm';
import { createChaCha20 } from './random.js';

export const SCHEME_ID = 'seedpgp-password-v1';
export const KEY_DATE = new Date('2026-10-07T00:00:00.000Z');
const encoder = new TextEncoder();

function concatBytes(...chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

export function normalizeEmail(email = '') {
  return email.trim().normalize('NFC').toLowerCase();
}

export async function deriveSeed(password) {
  const normalizedPassword = password.normalize('NFC');
  const input = encoder.encode(`${SCHEME_ID}\0password\0${normalizedPassword}`);
  const salt = await sha256(encoder.encode(`${SCHEME_ID}:argon2id:password`));
  let argonBytes;
  try {
    const output = await argon2id({
      password: input,
      salt,
      parallelism: 1,
      iterations: 3,
      memorySize: 65536,
      hashLength: 32,
      outputType: 'binary'
    });
    argonBytes = output instanceof Uint8Array ? output : new Uint8Array(output);
    return await sha256(concatBytes(encoder.encode(`${SCHEME_ID}\0chacha20-seed\0`), argonBytes));
  } finally {
    input.fill(0);
    argonBytes?.fill(0);
    salt.fill(0);
  }
}

export async function generateDeterministicKey({ name, email = '', password, confirmPassword = password }) {
  const normalizedName = name.trim().normalize('NFC');
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = password.normalize('NFC');
  const normalizedConfirm = confirmPassword.normalize('NFC');

  if (!normalizedName) throw new Error('请填写名称；它会写入 OpenPGP User ID。');
  if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Email 格式看起来不正确。');
  }
  if (!normalizedPassword) throw new Error('请输入恢复口令。');
  if (Array.from(normalizedPassword).length < 16) {
    throw new Error('口令至少 16 个字符。长度只是底线，不代表口令一定够强；请使用唯一、难猜的长口令。');
  }
  if (normalizedPassword !== normalizedConfirm) throw new Error('两次输入的恢复口令不一致。');

  let seed;
  let deterministicBytes;
  try {
    seed = await deriveSeed(normalizedPassword);
    deterministicBytes = createChaCha20(seed);
    globalThis.__seedpgpRandomBytes = deterministicBytes;
    const result = await openpgp.generateKey({
      type: 'ecc',
      curve: 'curve25519',
      userIDs: [{ name: normalizedName, ...(normalizedEmail ? { email: normalizedEmail } : {}) }],
      passphrase: normalizedPassword,
      date: new Date(KEY_DATE),
      format: 'armored',
      config: { v6Keys: false }
    });
    const parsedPublic = await openpgp.readKey({ armoredKey: result.publicKey });
    return {
      fingerprint: parsedPublic.getFingerprint(),
      publicKey: result.publicKey,
      privateKey: result.privateKey
    };
  } finally {
    delete globalThis.__seedpgpRandomBytes;
    deterministicBytes?.destroy();
    seed?.fill(0);
  }
}