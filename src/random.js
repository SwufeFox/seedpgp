export function createChaCha20(seed, nonce = new Uint8Array(12), initialCounter = 0) {
  if (!(seed instanceof Uint8Array) || seed.length !== 32) throw new Error('内部派生种子长度错误。');
  if (!(nonce instanceof Uint8Array) || nonce.length !== 12) throw new Error('ChaCha20 nonce 长度错误。');
  if (!Number.isInteger(initialCounter) || initialCounter < 0 || initialCounter > 0xffffffff) {
    throw new Error('ChaCha20 counter 超出范围。');
  }
  const key = new Uint32Array(8);
  const nonceWords = new Uint32Array(3);
  const keyView = new DataView(seed.buffer, seed.byteOffset, seed.byteLength);
  const nonceView = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength);
  for (let index = 0; index < 8; index += 1) key[index] = keyView.getUint32(index * 4, true);
  for (let index = 0; index < 3; index += 1) nonceWords[index] = nonceView.getUint32(index * 4, true);

  let counter = initialCounter;
  let block = new Uint8Array(0);
  let cursor = 0;
  let destroyed = false;
  const rotateLeft = (value, bits) => (value << bits) | (value >>> (32 - bits));
  const quarterRound = (state, a, b, c, d) => {
    state[a] = (state[a] + state[b]) >>> 0; state[d] = rotateLeft(state[d] ^ state[a], 16);
    state[c] = (state[c] + state[d]) >>> 0; state[b] = rotateLeft(state[b] ^ state[c], 12);
    state[a] = (state[a] + state[b]) >>> 0; state[d] = rotateLeft(state[d] ^ state[a], 8);
    state[c] = (state[c] + state[d]) >>> 0; state[b] = rotateLeft(state[b] ^ state[c], 7);
  };

  function nextBlock() {
    if (counter > 0xffffffff) throw new Error('确定性随机流长度超限。');
    const initial = new Uint32Array([
      0x61707865, 0x3320646e, 0x79622d32, 0x6b206574,
      ...key, counter >>> 0, ...nonceWords
    ]);
    const state = new Uint32Array(initial);
    for (let round = 0; round < 10; round += 1) {
      quarterRound(state, 0, 4, 8, 12); quarterRound(state, 1, 5, 9, 13);
      quarterRound(state, 2, 6, 10, 14); quarterRound(state, 3, 7, 11, 15);
      quarterRound(state, 0, 5, 10, 15); quarterRound(state, 1, 6, 11, 12);
      quarterRound(state, 2, 7, 8, 13); quarterRound(state, 3, 4, 9, 14);
    }
    const output = new Uint8Array(64);
    const outputView = new DataView(output.buffer);
    for (let index = 0; index < 16; index += 1) {
      outputView.setUint32(index * 4, (state[index] + initial[index]) >>> 0, true);
    }
    initial.fill(0);
    state.fill(0);
    counter += 1;
    return output;
  }

  function randomBytes(length) {
    if (destroyed) throw new Error('确定性随机流已销毁。');
    if (!Number.isSafeInteger(length) || length < 0) throw new Error('随机字节长度错误。');
    const result = new Uint8Array(length);
    let written = 0;
    while (written < length) {
      if (cursor >= block.length) {
        block.fill(0);
        block = nextBlock();
        cursor = 0;
      }
      const take = Math.min(length - written, block.length - cursor);
      result.set(block.subarray(cursor, cursor + take), written);
      cursor += take;
      written += take;
    }
    return result;
  }

  randomBytes.destroy = () => {
    destroyed = true;
    key.fill(0);
    nonceWords.fill(0);
    block.fill(0);
  };
  return randomBytes;
}