# AES-256 File Encryptor

A browser-based file encryptor and decryptor. Files are encrypted with AES-256-GCM using the native Web Crypto API. Everything runs locally in your browser: no server, no uploads, no dependencies.

## Features

- AES-256-GCM authenticated encryption (detects wrong keys and tampered files)
- Key derived from your passphrase using PBKDF2 (SHA-256, 100,000 iterations)
- Random 16-byte salt and 12-byte IV generated for every encryption
- Works on any file type
- Drag and drop support, progress indicator
- 100% client-side: your files and passphrase never leave your device

## How It Works

1. You pick a file and enter a passphrase.
2. A 256-bit key is derived from the passphrase with PBKDF2 and a random salt.
3. The file is encrypted with AES-GCM using a random IV.
4. The output is downloaded as `original-name.ext.enc` with this layout:

```
[ salt (16 bytes) | IV (12 bytes) | ciphertext + auth tag ]
```

5. To decrypt, the salt and IV are read from the start of the `.enc` file, the same key is re-derived, and the original file is restored. A wrong passphrase or modified file fails authentication and shows an error.

## Usage

1. Clone the repo:
   ```bash
   git clone https://github.com/am-cybersec/aes-file-encryptor.git
   cd aes-file-encryptor
   ```
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari).
3. Select a file, enter a passphrase, click **Encrypt** or **Decrypt**.

Note: the Web Crypto API needs a secure context. Opening `index.html` directly works in most browsers, but if it fails, serve it locally:

```bash
python -m http.server 8000
```

then visit `http://localhost:8000`.

## Project Structure

```
aes-file-encryptor/
├── index.html   # UI
├── style.css    # Styling
├── script.js    # Encryption / decryption logic
└── README.md
```

## Security Notes

- If you forget the passphrase, the file cannot be recovered. There is no backdoor.
- Use a long, unique passphrase. The encryption is only as strong as the passphrase.
- Entire files are loaded into memory (max 500 MB in this app), so large files may be slow or fail on low-RAM devices.
- This is a learning/portfolio project and has not been independently audited. Do not rely on it for highly sensitive data.

## Tech Stack

HTML, CSS, JavaScript (Web Crypto API)


