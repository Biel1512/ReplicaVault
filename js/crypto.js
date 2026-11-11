/**
 * Vaultwarden Replica - Crypto Service
 * Pure logic module for cryptographic operations using the Web Crypto API.
 */

const CryptoService = {
  /**
   * Derive an AES-256-GCM CryptoKey from password and salt using PBKDF2.
   * @param {string} password - The master password.
   * @param {string|ArrayBuffer} salt - Base64 salt or ArrayBuffer.
   * @param {number} [iterations=600000] - Number of PBKDF2 iterations.
   * @returns {Promise<CryptoKey>} AES-GCM 256-bit CryptoKey.
   */
  async deriveKey(password, salt, iterations = 600000) {
    if (!password) {
      throw new Error('Senha não fornecida para derivação de chave.');
    }
    const saltBuffer = this._resolveSaltBuffer(salt);
    const passwordBuffer = new TextEncoder().encode(password);

    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: iterations,
        hash: 'SHA-256'
      },
      baseKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );
  },

  /**
   * Encrypt plaintext string with AES-256-GCM key.
   * @param {string} plaintext - Text to encrypt.
   * @param {CryptoKey} key - AES-GCM CryptoKey.
   * @returns {Promise<{iv: string, ciphertext: string}>} Object containing base64 iv and ciphertext.
   */
  async encrypt(plaintext, key) {
    if (typeof plaintext !== 'string') {
      throw new Error('Texto para criptografia deve ser uma string.');
    }
    if (!key) {
      throw new Error('Chave de criptografia não fornecida.');
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encoded
    );

    return {
      iv: this.arrayBufferToBase64(iv.buffer),
      ciphertext: this.arrayBufferToBase64(ciphertextBuffer)
    };
  },

  /**
   * Decrypt { iv, ciphertext } with AES-256-GCM key.
   * @param {{iv: string, ciphertext: string}} encryptedData - Base64 iv and ciphertext.
   * @param {CryptoKey} key - AES-GCM CryptoKey.
   * @returns {Promise<string>} Decrypted plaintext string.
   */
  async decrypt(encryptedData, key) {
    if (!encryptedData || !encryptedData.iv || !encryptedData.ciphertext) {
      throw new Error('Dados criptografados inválidos para descriptografia.');
    }
    if (!key) {
      throw new Error('Chave de descriptografia não fornecida.');
    }

    const iv = this.base64ToArrayBuffer(encryptedData.iv);
    const ciphertext = this.base64ToArrayBuffer(encryptedData.ciphertext);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  },

  /**
   * Hash password with PBKDF2 (SHA-256, 256 bits), returns base64 hash string.
   * @param {string} password - Password to hash.
   * @param {string|ArrayBuffer} salt - Base64 salt or ArrayBuffer.
   * @param {number} [iterations=600000] - Number of iterations.
   * @returns {Promise<string>} Base64 hash string.
   */
  async hashPassword(password, salt, iterations = 600000) {
    if (!password) {
      throw new Error('Senha não fornecida para hash.');
    }
    const saltBuffer = this._resolveSaltBuffer(salt);
    const passwordBuffer = new TextEncoder().encode(password);

    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: iterations,
        hash: 'SHA-256'
      },
      baseKey,
      256
    );

    return this.arrayBufferToBase64(derivedBits);
  },

  /**
   * Generate random 32-byte salt as base64 string.
   * @returns {string} Base64 representation of 32 random bytes.
   */
  generateSalt() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return this.arrayBufferToBase64(bytes.buffer);
  },

  /**
   * Generate UUID using crypto.randomUUID().
   * @returns {string} Standard UUID string.
   */
  generateId() {
    return crypto.randomUUID();
  },

  /**
   * Convert ArrayBuffer to base64 string.
   * @param {ArrayBuffer} buffer - Buffer to convert.
   * @returns {string} Base64 encoded string.
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  },

  /**
   * Convert base64 string to ArrayBuffer.
   * @param {string} base64 - Base64 string to convert.
   * @returns {ArrayBuffer} ArrayBuffer of decoded data.
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  },

  /**
   * Helper to normalize salt input into an ArrayBuffer.
   * @private
   */
  _resolveSaltBuffer(salt) {
    if (!salt) {
      throw new Error('Salt não fornecido.');
    }
    if (salt instanceof ArrayBuffer) {
      return salt;
    }
    if (ArrayBuffer.isView(salt)) {
      return salt.buffer;
    }
    if (typeof salt === 'string') {
      try {
        return this.base64ToArrayBuffer(salt);
      } catch {
        return new TextEncoder().encode(salt).buffer;
      }
    }
    throw new Error('Formato de salt inválido.');
  }
};

window.cryptoService = CryptoService;
