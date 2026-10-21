const ITERATIONS = 100000;
const SALT_LEN = 16;
const IV_LEN = 12;
const MAX_SIZE = 500 * 1024 * 1024; // 500 MB

const fileInput = document.getElementById('file');
const dropZone = document.getElementById('dropZone');
const dropText = document.getElementById('dropText');
const fileInfo = document.getElementById('fileInfo');
const keyInput = document.getElementById('key');
const encBtn = document.getElementById('encBtn');
const decBtn = document.getElementById('decBtn');
const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');
const statusEl = document.getElementById('status');

let selectedFile = null;

// ---------- helpers ----------
function setStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (type ? ' ' + type : '');
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function setProgress(percent) {
  progressWrap.hidden = false;
  progressBar.style.width = percent + '%';
}

function hideProgress() {
  setTimeout(() => {
    progressWrap.hidden = true;
    progressBar.style.width = '0%';
  }, 800);
}

function setBusy(busy) {
  encBtn.disabled = busy;
  decBtn.disabled = busy;
}

// lets the browser repaint (progress bar / status) before heavy work starts
function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- file selection ----------
function setFile(file) {
  if (!file) return;
  if (file.size > MAX_SIZE) {
    selectedFile = null;
    fileInfo.textContent = '';
    setStatus('File too large. Max supported size is ' + formatSize(MAX_SIZE) + '.', 'error');
    return;
  }
  selectedFile = file;
  dropText.textContent = 'File selected. Click or drop to change.';
  fileInfo.textContent = file.name + '  (' + formatSize(file.size) + ')';
  setStatus('', '');
}

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => setFile(fileInput.files[0]));

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag');
  setFile(e.dataTransfer.files[0]);
});

// ---------- crypto ----------
async function deriveKey(passphrase, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function validate(forEncrypt) {
  if (!window.crypto || !crypto.subtle) {
    setStatus('Web Crypto API not available. Open this page via localhost or HTTPS.', 'error');
    return false;
  }
  if (!selectedFile) {
    setStatus('Please select a file first.', 'error');
    return false;
  }
  const pass = keyInput.value;
  if (!pass) {
    setStatus('Please enter a secret key.', 'error');
    return false;
  }
  if (forEncrypt && pass.length < 8) {
    setStatus('Use a passphrase of at least 8 characters.', 'error');
    return false;
  }
  return true;
}

async function encryptFile() {
  if (!validate(true)) return;
  setBusy(true);
  try {
    setStatus('Reading file...', '');
    setProgress(10);
    await nextFrame();
    const data = await selectedFile.arrayBuffer();

    setStatus('Deriving key...', '');
    setProgress(35);
    await nextFrame();
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
    const key = await deriveKey(keyInput.value, salt);

    setStatus('Encrypting...', '');
    setProgress(65);
    await nextFrame();
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, data)
    );

    const output = new Uint8Array(SALT_LEN + IV_LEN + ciphertext.length);
    output.set(salt, 0);
    output.set(iv, SALT_LEN);
    output.set(ciphertext, SALT_LEN + IV_LEN);

    setProgress(100);
    downloadBlob(new Blob([output]), selectedFile.name + '.enc');
    setStatus('Encrypted. Downloaded ' + selectedFile.name + '.enc', 'success');
  } catch (err) {
    console.error(err);
    setStatus('Encryption failed: ' + err.message, 'error');
  } finally {
    setBusy(false);
    hideProgress();
  }
}

async function decryptFile() {
  if (!validate(false)) return;
  setBusy(true);
  try {
    setStatus('Reading file...', '');
    setProgress(10);
    await nextFrame();
    const buffer = new Uint8Array(await selectedFile.arrayBuffer());

    // salt + iv + at least the 16-byte GCM auth tag
    if (buffer.length < SALT_LEN + IV_LEN + 16) {
      throw new Error('This file is too small to be a valid encrypted file.');
    }

    const salt = buffer.slice(0, SALT_LEN);
    const iv = buffer.slice(SALT_LEN, SALT_LEN + IV_LEN);
    const ciphertext = buffer.slice(SALT_LEN + IV_LEN);

    setStatus('Deriving key...', '');
    setProgress(35);
    await nextFrame();
    const key = await deriveKey(keyInput.value, salt);

    setStatus('Decrypting...', '');
    setProgress(65);
    await nextFrame();
    let plaintext;
    try {
      plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ciphertext);
    } catch (e) {
      throw new Error('Wrong key, or the file is corrupted / not encrypted by this tool.');
    }

    const outName = selectedFile.name.toLowerCase().endsWith('.enc')
      ? selectedFile.name.slice(0, -4)
      : selectedFile.name + '.decrypted';

    setProgress(100);
    downloadBlob(new Blob([plaintext]), outName);
    setStatus('Decrypted. Downloaded ' + outName, 'success');
  } catch (err) {
    console.error(err);
    setStatus(err.message, 'error');
  } finally {
    setBusy(false);
    hideProgress();
  }
}

encBtn.addEventListener('click', encryptFile);
decBtn.addEventListener('click', decryptFile);
