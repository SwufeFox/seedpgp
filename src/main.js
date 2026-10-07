import './style.css';
import { generateDeterministicKey, SCHEME_ID } from './keygen.js';

const $ = (selector) => document.querySelector(selector);
let currentKeys = null;

function setBusy(busy, message = '正在派生密钥…') {
  $('#progress').classList.toggle('hidden', !busy);
  $('#progress-text').textContent = message;
  $('#generate').disabled = busy;
  if (busy) $('#error').classList.add('hidden');
}

function showError(message) {
  $('#error').textContent = message;
  $('#error').classList.remove('hidden');
}

function renderKeys(keys) {
  currentKeys = keys;
  $('#fingerprint').textContent = keys.fingerprint.toUpperCase().replace(/(.{4})/g, '$1 ').trim();
  $('#public-key').textContent = keys.publicKey;
  $('#private-key').textContent = keys.privateKey;
  $('#result').classList.remove('hidden');
  $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function generate() {
  setBusy(true, 'Argon2id 正在派生恢复种子…');
  $('#result').classList.add('hidden');
  try {
    const result = await generateDeterministicKey({
      name: $('#name').value,
      email: $('#email').value,
      password: $('#password').value,
      confirmPassword: $('#password-confirm').value
    });
    setBusy(true, '正在生成 Ed25519 / Curve25519 密钥…');
    renderKeys(result);
  } catch (error) {
    showError(error instanceof Error ? error.message : '生成失败，请检查输入后重试。');
  } finally {
    setBusy(false);
  }
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const oldText = button.textContent;
    button.textContent = '已复制';
    setTimeout(() => { button.textContent = oldText; }, 1200);
  } catch {
    showError('复制被浏览器拦截了；可以手动选中内容复制。');
  }
}

$('#generate').addEventListener('click', generate);

$('#password-reveal').addEventListener('click', () => {
  const reveal = $('#password').type === 'password';
  $('#password').type = reveal ? 'text' : 'password';
  $('#password-confirm').type = reveal ? 'text' : 'password';
  $('#password-reveal').textContent = reveal ? '隐藏' : '显示';
});

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = document.getElementById(button.dataset.copy);
    copyText(target.textContent, button);
  });
});

document.querySelectorAll('[data-download]').forEach((button) => {
  button.addEventListener('click', () => {
    if (!currentKeys) return;
    const key = button.dataset.download;
    const value = key === 'public-key' ? currentKeys.publicKey : currentKeys.privateKey;
    const kind = key === 'public-key' ? 'public' : 'private';
    downloadText(`seedpgp-${kind}-${currentKeys.fingerprint.slice(0, 16)}.asc`, value);
  });
});

$('#clear-result').addEventListener('click', () => {
  currentKeys = null;
  $('#result').classList.add('hidden');
  $('#fingerprint').textContent = '';
  $('#public-key').textContent = '';
  $('#private-key').textContent = '';
  $('#password').value = '';
  $('#password-confirm').value = '';
});

window.addEventListener('beforeunload', () => {
  currentKeys = null;
  delete globalThis.__seedpgpRandomBytes;
});

document.querySelector('footer .scheme').textContent = SCHEME_ID;