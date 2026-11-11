/**
 * Vaultwarden Replica - Authentication Service
 * Handles user registration, master password verification, key derivation, and session lock/timeout.
 */

const AuthService = {
  _currentUser: null,
  _encryptionKey: null,
  _inactivityTimer: null,
  _inactivityTimeout: 5 * 60 * 1000, // 5 minutes

  /**
   * Register a new user.
   * Hashes password, derives initial key, initializes empty encrypted vault, and auto-logs in.
   * @param {string} email - User email address.
   * @param {string} masterPassword - Master password.
   * @param {string} [hint=''] - Password hint.
   * @returns {Promise<boolean>} True on success.
   */
  async register(email, masterPassword, hint = '') {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Por favor, informe um endereço de e-mail.');
    }
    if (!masterPassword || masterPassword.length < 8) {
      throw new Error('A senha mestre deve ter pelo menos 8 caracteres.');
    }

    const users = JSON.parse(localStorage.getItem('vw_users') || '[]');
    if (users.some(u => u.email === normalizedEmail)) {
      throw new Error('Este endereço de e-mail já está cadastrado.');
    }

    // Generate separate salts for password auth and vault encryption
    const salt = window.cryptoService.generateSalt();
    const encryptionSalt = window.cryptoService.generateSalt();

    const passwordHash = await window.cryptoService.hashPassword(masterPassword, salt);

    const newUser = {
      email: normalizedEmail,
      passwordHash,
      salt,
      encryptionSalt,
      hint: (hint || '').trim(),
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem('vw_users', JSON.stringify(users));

    // Derive initial encryption key and initialize empty vault
    const encryptionKey = await window.cryptoService.deriveKey(masterPassword, encryptionSalt);
    const initialVault = JSON.stringify({ items: [], folders: [] });
    const encryptedVault = await window.cryptoService.encrypt(initialVault, encryptionKey);
    localStorage.setItem(`vw_vault_${normalizedEmail}`, JSON.stringify(encryptedVault));

    // Auto-login
    this._currentUser = {
      email: newUser.email,
      hint: newUser.hint,
      createdAt: newUser.createdAt
    };
    this._encryptionKey = encryptionKey;
    sessionStorage.setItem('vw_session', normalizedEmail);

    this.startInactivityTimer();
    window.dispatchEvent(new CustomEvent('auth:login', { detail: this._currentUser }));

    return true;
  },

  /**
   * Login user by validating master password and deriving encryption key.
   * @param {string} email - User email.
   * @param {string} masterPassword - Master password.
   * @returns {Promise<boolean>} True if authentication succeeded, false otherwise.
   */
  async login(email, masterPassword) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !masterPassword) {
      return false;
    }

    const users = JSON.parse(localStorage.getItem('vw_users') || '[]');
    const user = users.find(u => u.email === normalizedEmail);
    if (!user) {
      return false;
    }

    const hash = await window.cryptoService.hashPassword(masterPassword, user.salt);
    if (hash !== user.passwordHash) {
      return false;
    }

    const encryptionKey = await window.cryptoService.deriveKey(masterPassword, user.encryptionSalt);

    this._currentUser = {
      email: user.email,
      hint: user.hint,
      createdAt: user.createdAt
    };
    this._encryptionKey = encryptionKey;
    sessionStorage.setItem('vw_session', normalizedEmail);

    this.startInactivityTimer();
    window.dispatchEvent(new CustomEvent('auth:login', { detail: this._currentUser }));

    return true;
  },

  /**
   * Verify master password and unlock vault for currently locked user.
   * @param {string} password - Master password to verify.
   * @returns {Promise<boolean>} True if unlocked successfully, false otherwise.
   */
  async verifyMasterPassword(password) {
    const email = this._currentUser?.email || sessionStorage.getItem('vw_session');
    if (!email || !password) {
      return false;
    }

    const users = JSON.parse(localStorage.getItem('vw_users') || '[]');
    const user = users.find(u => u.email === email);
    if (!user) {
      return false;
    }

    const hash = await window.cryptoService.hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      return false;
    }

    const encryptionKey = await window.cryptoService.deriveKey(password, user.encryptionSalt);

    this._currentUser = {
      email: user.email,
      hint: user.hint,
      createdAt: user.createdAt
    };
    this._encryptionKey = encryptionKey;

    this.startInactivityTimer();
    window.dispatchEvent(new CustomEvent('auth:unlocked', { detail: this._currentUser }));

    return true;
  },

  /**
   * Logout user, clear keys and session.
   */
  logout() {
    this._currentUser = null;
    this._encryptionKey = null;
    this.stopInactivityTimer();
    sessionStorage.removeItem('vw_session');
    window.dispatchEvent(new CustomEvent('auth:logout'));
  },

  /**
   * Lock vault: keep user information but clear encryption key from memory.
   */
  lock() {
    this._encryptionKey = null;
    this.stopInactivityTimer();
    window.dispatchEvent(new CustomEvent('auth:locked'));
  },

  /**
   * Check whether user is fully logged in and unlocked.
   * @returns {boolean}
   */
  isLoggedIn() {
    return this._currentUser !== null && this._encryptionKey !== null;
  },

  /**
   * Check whether user session is locked.
   * @returns {boolean}
   */
  isLocked() {
    return this._currentUser !== null && this._encryptionKey === null;
  },

  /**
   * Get current authenticated user profile.
   * @returns {Object|null}
   */
  getCurrentUser() {
    return this._currentUser;
  },

  /**
   * Get active AES-GCM encryption key.
   * @returns {CryptoKey|null}
   */
  getEncryptionKey() {
    return this._encryptionKey;
  },

  /**
   * Get all registered users (emails and timestamps).
   * @returns {Array<{email: string, createdAt: string}>}
   */
  getUsers() {
    const raw = localStorage.getItem('vw_users');
    const users = JSON.parse(raw || '[]');
    return users.map(u => ({ email: u.email, createdAt: u.createdAt }));
  },

  /**
   * Start or restart the inactivity timer.
   */
  startInactivityTimer() {
    this.stopInactivityTimer();
    this._inactivityTimer = setTimeout(() => {
      this.lock();
    }, this._inactivityTimeout);
  },

  /**
   * Stop running inactivity timer.
   */
  stopInactivityTimer() {
    if (this._inactivityTimer) {
      clearTimeout(this._inactivityTimer);
      this._inactivityTimer = null;
    }
  },

  /**
   * Reset inactivity timer on user interaction.
   */
  resetInactivityTimer() {
    if (this.isLoggedIn()) {
      this.startInactivityTimer();
    }
  },

  /**
   * Change master password, re-encrypting the vault with the new key.
   * @param {string} currentPassword - Existing master password.
   * @param {string} newPassword - New master password.
   * @returns {Promise<boolean>} True if successful.
   */
  async changeMasterPassword(currentPassword, newPassword) {
    if (!this.isLoggedIn()) {
      throw new Error('Você precisa estar conectado para alterar a senha mestre.');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error('A nova senha mestre deve ter pelo menos 8 caracteres.');
    }

    const users = JSON.parse(localStorage.getItem('vw_users') || '[]');
    const userIndex = users.findIndex(u => u.email === this._currentUser.email);
    if (userIndex === -1) {
      throw new Error('Usuário não encontrado.');
    }
    const user = users[userIndex];

    const currentHash = await window.cryptoService.hashPassword(currentPassword, user.salt);
    if (currentHash !== user.passwordHash) {
      throw new Error('Senha mestre atual incorreta.');
    }

    // Decrypt current vault data
    let vaultData = { items: [], folders: [] };
    const rawVault = localStorage.getItem(`vw_vault_${user.email}`);
    if (rawVault) {
      try {
        const encData = JSON.parse(rawVault);
        const decrypted = await window.cryptoService.decrypt(encData, this._encryptionKey);
        vaultData = JSON.parse(decrypted);
      } catch (err) {
        if (window.vaultService && window.vaultService._loaded) {
          vaultData = {
            items: window.vaultService._items,
            folders: window.vaultService._folders
          };
        } else {
          throw new Error('Não foi possível carregar os dados do cofre para re-criptografia.');
        }
      }
    }

    // Generate fresh salts
    const newSalt = window.cryptoService.generateSalt();
    const newEncryptionSalt = window.cryptoService.generateSalt();

    const newPasswordHash = await window.cryptoService.hashPassword(newPassword, newSalt);
    const newKey = await window.cryptoService.deriveKey(newPassword, newEncryptionSalt);

    // Re-encrypt vault with new key
    const reEncryptedVault = await window.cryptoService.encrypt(JSON.stringify(vaultData), newKey);
    localStorage.setItem(`vw_vault_${user.email}`, JSON.stringify(reEncryptedVault));

    // Update user record
    user.salt = newSalt;
    user.encryptionSalt = newEncryptionSalt;
    user.passwordHash = newPasswordHash;
    users[userIndex] = user;
    localStorage.setItem('vw_users', JSON.stringify(users));

    this._encryptionKey = newKey;
    this.resetInactivityTimer();
    return true;
  },

  /**
   * Delete account and all associated vault data.
   * @param {string} password - Master password for confirmation.
   * @returns {Promise<boolean>} True if account was deleted.
   */
  async deleteAccount(password) {
    const email = this._currentUser?.email || sessionStorage.getItem('vw_session');
    if (!email) {
      throw new Error('Nenhum usuário identificado para exclusão.');
    }

    const users = JSON.parse(localStorage.getItem('vw_users') || '[]');
    const userIndex = users.findIndex(u => u.email === email);
    if (userIndex === -1) {
      throw new Error('Conta não encontrada.');
    }
    const user = users[userIndex];

    const hash = await window.cryptoService.hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      throw new Error('Senha mestre incorreta.');
    }

    // Remove vault and user
    localStorage.removeItem(`vw_vault_${email}`);
    users.splice(userIndex, 1);
    localStorage.setItem('vw_users', JSON.stringify(users));

    this.logout();
    return true;
  },

  /**
   * Helper to retrieve password hint for an email.
   * @param {string} email
   * @returns {string|null}
   */
  getPasswordHint(email) {
    const normalized = (email || '').trim().toLowerCase();
    const users = JSON.parse(localStorage.getItem('vw_users') || '[]');
    const user = users.find(u => u.email === normalized);
    return user ? (user.hint || null) : null;
  },

  /**
   * Initialize session state from sessionStorage if available.
   * @private
   */
  _initSession() {
    const sessionEmail = sessionStorage.getItem('vw_session');
    if (sessionEmail) {
      const users = JSON.parse(localStorage.getItem('vw_users') || '[]');
      const user = users.find(u => u.email === sessionEmail);
      if (user) {
        this._currentUser = {
          email: user.email,
          hint: user.hint,
          createdAt: user.createdAt
        };
        this._encryptionKey = null; // Session begins locked until password entered
      }
    }
  }
};

// Global activity listener to reset inactivity countdown on user actions
['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(eventType => {
  window.addEventListener(eventType, () => AuthService.resetInactivityTimer(), { passive: true });
});

// Initialize session state
AuthService._initSession();

window.authService = AuthService;
