import './style.css';
import { generateDeterministicKey } from './keygen.js';
import { decryptText, encryptText } from './message-crypto.js';

const $ = (selector) => document.querySelector(selector);
const form = $('#work-form');
const emailInput = $('#email-input');
const passwordInput = $('#password-input');
const messageInput = $('#message-input');
const outputText = $('#output-text');
const outputSection = $('#output-section');
const outputTitle = $('#output-title');
const errorMessage = $('#error-message');
const progressMessage = $('#progress-message');
const processButton = $('#process-button');
const encryptTab = $('#encrypt-tab');
const decryptTab = $('#decrypt-tab');
const revealButton = $('#reveal-button');
const clearButton = $('#clear-button');
const copyButton = $('#copy-button');
const downloadButton = $('#download-button');
const publicKeyButton = $('#public-key-button');
const privateKeyButton = $('#private-key-button');

let mode = 'encrypt';
let currentKeys = null;

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function clearError() {
  errorMessage.textContent = '';
  errorMessage.hidden = true;
}

function setBusy(isBusy, message = '') {
  [emailInput, passwordInput, messageInput, processButton, encryptTab, decryptTab, revealButton, clearButton]
    .forEach((element) => { element.disabled = isBusy; });
  copyButton.disabled = isBusy || !outputText.value;
  downloadButton.disabled = isBusy || !outputText.value;
  publicKeyButton.disabled = isBusy || !currentKeys;
  privateKeyButton.disabled = isBusy || !currentKeys;
  processButton.textContent = isBusy ? '处理中…' : mode === 'encrypt' ? '加密文本' : '解密文本';
  progressMessage.textContent = message;
}

function setMode(nextMode) {
  if (mode === nextMode) return;

  if (mode === 'encrypt' && nextMode === 'decrypt' && outputText.value.startsWith('-----BEGIN PGP MESSAGE-----')) {
    messageInput.value = outputText.value;
  }

  mode = nextMode;
  const isEncrypt = mode === 'encrypt';
  encryptTab.classList.toggle('is-active', isEncrypt);
  decryptTab.classList.toggle('is-active', !isEncrypt);
  encryptTab.setAttribute('aria-selected', String(isEncrypt));
  decryptTab.setAttribute('aria-selected', String(!isEncrypt));
  $('#message-panel').setAttribute('aria-labelledby', isEncrypt ? 'encrypt-tab' : 'decrypt-tab');
  $('#message-label').textContent = isEncrypt ? '要加密的文本' : '要解密的 PGP 密文';
  messageInput.placeholder = isEncrypt
    ? '在这里输入要加密的内容…'
    : '粘贴完整的 -----BEGIN PGP MESSAGE----- 密文…';
  processButton.textContent = isEncrypt ? '加密文本' : '解密文本';
  outputSection.hidden = true;
  clearError();
  progressMessage.textContent = '';
}

function getIdentity(email) {
  const normalizedEmail = email.trim().normalize('NFC').toLowerCase();
  if (!normalizedEmail) throw new Error('请输入 Email。');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Email 格式看起来不正确。');
  return { name: normalizedEmail.split('@')[0] || 'SeedPGP User', email: normalizedEmail };
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  progressMessage.textContent = '';
  outputSection.hidden = true;
  outputText.value = '';

  const email = emailInput.value;
  const password = passwordInput.value;
  const inputText = messageInput.value;
  let identity;

  try {
    identity = getIdentity(email);
    if (!password) throw new Error('请输入恢复口令。');
    if (Array.from(password.normalize('NFC')).length < 16) {
      throw new Error('恢复口令至少需要 16 个字符。请使用唯一、难猜的长口令。');
    }
    if (!inputText.trim()) throw new Error(mode === 'encrypt' ? '请输入要加密的文本。' : '请粘贴要解密的 PGP 密文。');
  } catch (error) {
    showError(error.message);
    return;
  }

  const currentMode = mode;
  setBusy(true, '正在从恢复口令恢复 OpenPGP 身份…');
  try {
    const keys = await generateDeterministicKey({
      ...identity,
      password,
      confirmPassword: password
    });
    currentKeys = keys;

    progressMessage.textContent = currentMode === 'encrypt' ? '正在加密文本…' : '正在解密文本…';
    const result = currentMode === 'encrypt'
      ? await encryptText(inputText, keys.publicKey)
      : await decryptText(inputText, keys.privateKey, password);

    outputText.value = result;
    outputTitle.textContent = currentMode === 'encrypt' ? 'PGP 密文' : '解密后的文本';
    downloadButton.textContent = currentMode === 'encrypt' ? '下载 .asc' : '下载 .txt';
    outputSection.hidden = false;
    progressMessage.textContent = currentMode === 'encrypt' ? '加密完成。' : '解密完成。';
  } catch (error) {
    showError(error.message || '处理失败，请检查输入后重试。');
    progressMessage.textContent = '';
  } finally {
    setBusy(false, progressMessage.textContent);
  }
});

encryptTab.addEventListener('click', () => setMode('encrypt'));
decryptTab.addEventListener('click', () => setMode('decrypt'));

revealButton.addEventListener('click', () => {
  const isVisible = passwordInput.type === 'text';
  passwordInput.type = isVisible ? 'password' : 'text';
  revealButton.textContent = isVisible ? '显示' : '隐藏';
  revealButton.setAttribute('aria-label', isVisible ? '显示恢复口令' : '隐藏恢复口令');
  revealButton.setAttribute('aria-pressed', String(!isVisible));
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(outputText.value);
    progressMessage.textContent = '已复制到剪贴板。';
  } catch {
    showError('复制失败，请手动选择并复制结果。');
  }
});

downloadButton.addEventListener('click', () => {
  downloadText(mode === 'encrypt' ? 'seedpgp-message.asc' : 'seedpgp-plaintext.txt', outputText.value);
});

publicKeyButton.addEventListener('click', () => {
  if (currentKeys) downloadText('seedpgp-public-key.asc', currentKeys.publicKey);
});

privateKeyButton.addEventListener('click', () => {
  if (currentKeys) downloadText('seedpgp-private-key.asc', currentKeys.privateKey);
});

clearButton.addEventListener('click', () => {
  form.reset();
  outputText.value = '';
  outputSection.hidden = true;
  currentKeys = null;
  passwordInput.type = 'password';
  revealButton.textContent = '显示';
  revealButton.setAttribute('aria-label', '显示恢复口令');
  revealButton.setAttribute('aria-pressed', 'false');
  setMode('encrypt');
  clearError();
  setBusy(false, '');
  emailInput.focus();
});

window.addEventListener('pagehide', () => {
  passwordInput.value = '';
  messageInput.value = '';
  outputText.value = '';
  currentKeys = null;
});