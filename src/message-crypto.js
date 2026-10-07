import { createMessage, decrypt, decryptKey, encrypt, readKey, readMessage, readPrivateKey } from 'openpgp';

export async function encryptText(text, armoredPublicKey) {
  if (typeof text !== 'string') throw new TypeError('要加密的内容必须是文本。');
  const publicKey = await readKey({ armoredKey: armoredPublicKey });
  const message = await createMessage({ text });
  return encrypt({ message, encryptionKeys: publicKey, format: 'armored' });
}

export async function decryptText(armoredMessage, armoredPrivateKey, passphrase) {
  try {
    const encryptedMessage = await readMessage({ armoredMessage });
    const encryptedPrivateKey = await readPrivateKey({ armoredKey: armoredPrivateKey });
    const privateKey = await decryptKey({ privateKey: encryptedPrivateKey, passphrase });
    const { data } = await decrypt({ message: encryptedMessage, decryptionKeys: privateKey, format: 'utf8' });
    return data;
  } catch {
    throw new Error('无法解密。请确认恢复口令与加密时完全一致，并检查 PGP 密文是否完整。');
  }
}