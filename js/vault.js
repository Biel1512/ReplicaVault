/**
 * Vaultwarden Replica - Vault Service
 * Manages encrypted storage of vault items (logins, notes, cards, identities), folders, trash, import/export, and health audit.
 */

const VaultService = {
  _items: [],
  _folders: [],
  _loaded: false,

  /**
   * Load and decrypt vault data from localStorage.
   */
  async loadVault() {
    const user = window.authService.getCurrentUser();
    const key = window.authService.getEncryptionKey();
    if (!user || !key) {
      this._items = [];
      this._folders = [];
      this._loaded = false;
      return;
    }

    const encrypted = localStorage.getItem(`vw_vault_${user.email}`);
    if (!encrypted) {
      this._items = [];
      this._folders = [];
    } else {
      try {
        const data = JSON.parse(encrypted);
        const decrypted = await window.cryptoService.decrypt(data, key);
        const vault = JSON.parse(decrypted);
        this._items = Array.isArray(vault.items) ? vault.items : [];
        this._folders = Array.isArray(vault.folders) ? vault.folders : [];
      } catch (err) {
        console.error('Falha ao descriptografar cofre:', err);
        this._items = [];
        this._folders = [];
        throw new Error('Falha ao descriptografar cofre. Chave incorreta ou dados corrompidos.');
      }
    }
    this._loaded = true;
  },

  /**
   * Encrypt and save current vault to localStorage.
   */
  async saveVault() {
    const user = window.authService.getCurrentUser();
    const key = window.authService.getEncryptionKey();
    if (!user || !key) {
      throw new Error('Usuário não autenticado ou cofre bloqueado.');
    }

    const data = JSON.stringify({ items: this._items, folders: this._folders });
    const encrypted = await window.cryptoService.encrypt(data, key);
    localStorage.setItem(`vw_vault_${user.email}`, JSON.stringify(encrypted));
  },

  /**
   * Get items matching the optional filter criteria.
   * @param {Object} [filter={}] - Filter criteria.
   * @param {string} [filter.type] - 'login' | 'note' | 'card' | 'identity'
   * @param {string} [filter.folderId] - Specific folder ID or 'none' for unassigned
   * @param {boolean} [filter.favorite] - Filter favorite items
   * @param {boolean} [filter.trash] - Filter trash items
   * @param {string} [filter.search] - Search text query
   * @returns {Array<Object>} Filtered and sorted items.
   */
  getItems(filter = {}) {
    let items = [...this._items];

    if (!filter.trash) {
      items = items.filter(i => !i.deletedAt);
    } else {
      items = items.filter(i => !!i.deletedAt);
    }

    if (filter.type) {
      items = items.filter(i => i.type === filter.type);
    }

    if (filter.folderId === 'none') {
      items = items.filter(i => !i.folderId);
    } else if (filter.folderId) {
      items = items.filter(i => i.folderId === filter.folderId);
    }

    if (filter.favorite) {
      items = items.filter(i => !!i.favorite);
    }

    if (filter.search) {
      const q = filter.search.toLowerCase().trim();
      items = items.filter(i => {
        const nameMatch = (i.name || '').toLowerCase().includes(q);
        const usernameMatch = (i.login?.username || '').toLowerCase().includes(q);
        const uriMatch = (i.login?.uri || '').toLowerCase().includes(q);
        const noteMatch = (i.note?.content || i.login?.notes || i.card?.notes || i.identity?.notes || '').toLowerCase().includes(q);
        const emailMatch = (i.identity?.email || '').toLowerCase().includes(q);
        const cardholderMatch = (i.card?.cardholderName || '').toLowerCase().includes(q);
        return nameMatch || usernameMatch || uriMatch || noteMatch || emailMatch || cardholderMatch;
      });
    }

    return items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  },

  /**
   * Get a single item by its ID.
   * @param {string} id - Item ID.
   * @returns {Object|null} Item or null if not found.
   */
  getItem(id) {
    return this._items.find(i => i.id === id) || null;
  },

  /**
   * Add a new item to the vault.
   * @param {Object} itemData - Item attributes.
   * @returns {Promise<Object>} Created item.
   */
  async addItem(itemData) {
    const item = {
      id: window.cryptoService.generateId(),
      type: itemData.type || 'login',
      name: (itemData.name || '').trim(),
      folderId: itemData.folderId || null,
      favorite: !!itemData.favorite,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      ...this._buildTypeData(itemData)
    };

    this._items.push(item);
    await this.saveVault();
    return item;
  },

  /**
   * Build type-specific attributes for vault items.
   * Accepts flat or nested input objects.
   * @param {Object} data - Input item payload.
   * @returns {Object} Type-specific nested payload.
   * @private
   */
  _buildTypeData(data) {
    const type = data.type || 'login';
    switch (type) {
      case 'login': {
        const src = data.login || data;
        return {
          login: {
            username: src.username || '',
            password: src.password || '',
            uri: src.uri || '',
            notes: src.notes || '',
            totp: src.totp || ''
          }
        };
      }
      case 'note': {
        const src = data.note || data;
        return {
          note: {
            content: src.content || ''
          }
        };
      }
      case 'card': {
        const src = data.card || data;
        return {
          card: {
            cardholderName: src.cardholderName || '',
            number: src.number || '',
            expMonth: src.expMonth || '',
            expYear: src.expYear || '',
            cvv: src.cvv || '',
            notes: src.notes || ''
          }
        };
      }
      case 'identity': {
        const src = data.identity || data;
        return {
          identity: {
            firstName: src.firstName || '',
            lastName: src.lastName || '',
            email: src.email || '',
            phone: src.phone || '',
            address1: src.address1 || '',
            address2: src.address2 || '',
            city: src.city || '',
            state: src.state || '',
            zip: src.zip || '',
            country: src.country || '',
            notes: src.notes || ''
          }
        };
      }
      default:
        return {};
    }
  },

  /**
   * Update an existing vault item.
   * @param {string} id - Item ID.
   * @param {Object} data - Updated attributes.
   * @returns {Promise<Object>} Updated item.
   */
  async updateItem(id, data) {
    const idx = this._items.findIndex(i => i.id === id);
    if (idx === -1) {
      throw new Error('Item não encontrado.');
    }

    const item = this._items[idx];
    if (data.name !== undefined) item.name = String(data.name).trim();
    if (data.folderId !== undefined) item.folderId = data.folderId;
    if (data.favorite !== undefined) item.favorite = !!data.favorite;
    item.updatedAt = new Date().toISOString();

    const typeData = this._buildTypeData({ type: item.type, ...data });
    Object.assign(item, typeData);

    this._items[idx] = item;
    await this.saveVault();
    return item;
  },

  /**
   * Soft delete item (move to trash).
   * @param {string} id - Item ID.
   */
  async deleteItem(id) {
    const item = this._items.find(i => i.id === id);
    if (item) {
      item.deletedAt = new Date().toISOString();
      await this.saveVault();
    }
  },

  /**
   * Restore item from trash.
   * @param {string} id - Item ID.
   */
  async restoreItem(id) {
    const item = this._items.find(i => i.id === id);
    if (item) {
      item.deletedAt = null;
      await this.saveVault();
    }
  },

  /**
   * Permanently delete an item from the vault.
   * @param {string} id - Item ID.
   */
  async permanentDelete(id) {
    this._items = this._items.filter(i => i.id !== id);
    await this.saveVault();
  },

  /**
   * Empty trash permanently removing all soft-deleted items.
   */
  async emptyTrash() {
    this._items = this._items.filter(i => !i.deletedAt);
    await this.saveVault();
  },

  /**
   * Get all folders alphabetically sorted.
   * @returns {Array<Object>} Sorted folders.
   */
  getFolders() {
    return [...this._folders].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  },

  /**
   * Add a new folder.
   * @param {string} name - Folder name.
   * @returns {Promise<Object>} Created folder.
   */
  async addFolder(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      throw new Error('O nome da pasta não pode estar vazio.');
    }
    const folder = {
      id: window.cryptoService.generateId(),
      name: trimmed
    };
    this._folders.push(folder);
    await this.saveVault();
    return folder;
  },

  /**
   * Update folder name.
   * @param {string} id - Folder ID.
   * @param {string} name - New folder name.
   * @returns {Promise<Object|null>} Updated folder.
   */
  async updateFolder(id, name) {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      throw new Error('O nome da pasta não pode estar vazio.');
    }
    const folder = this._folders.find(f => f.id === id);
    if (folder) {
      folder.name = trimmed;
      await this.saveVault();
    }
    return folder || null;
  },

  /**
   * Delete folder and detach associated items.
   * @param {string} id - Folder ID.
   */
  async deleteFolder(id) {
    this._folders = this._folders.filter(f => f.id !== id);
    this._items.forEach(i => {
      if (i.folderId === id) {
        i.folderId = null;
      }
    });
    await this.saveVault();
  },

  /**
   * Convenience getter for favorite items.
   * @returns {Array<Object>}
   */
  getFavorites() {
    return this.getItems({ favorite: true });
  },

  /**
   * Convenience getter for trash items.
   * @returns {Array<Object>}
   */
  getTrash() {
    return this.getItems({ trash: true });
  },

  /**
   * Convenience getter for items by type.
   * @param {string} type - 'login' | 'note' | 'card' | 'identity'
   * @returns {Array<Object>}
   */
  getItemsByType(type) {
    return this.getItems({ type });
  },

  /**
   * Convenience getter for items by folder ID.
   * @param {string} folderId
   * @returns {Array<Object>}
   */
  getItemsByFolder(folderId) {
    return this.getItems({ folderId });
  },

  /**
   * Convenience getter for searching items.
   * @param {string} query
   * @returns {Array<Object>}
   */
  search(query) {
    return this.getItems({ search: query });
  },

  /**
   * Export vault as JSON string (plain or encrypted).
   * @param {boolean} [encrypted=false] - Whether to encrypt export with master key.
   * @returns {Promise<string>} JSON string.
   */
  async exportVault(encrypted = false) {
    const data = {
      items: this._items.filter(i => !i.deletedAt),
      folders: this._folders,
      exportedAt: new Date().toISOString(),
      format: 'vaultwarden-replica'
    };

    if (encrypted) {
      const key = window.authService.getEncryptionKey();
      if (!key) {
        throw new Error('Chave de criptografia não disponível para exportação.');
      }
      const enc = await window.cryptoService.encrypt(JSON.stringify(data), key);
      return JSON.stringify({ encrypted: true, data: enc }, null, 2);
    }

    return JSON.stringify(data, null, 2);
  },

  /**
   * Import vault from JSON string.
   * @param {string} jsonString - Imported JSON content.
   * @param {boolean} [replace=false] - If true, replaces existing vault; if false, merges.
   */
  async importVault(jsonString, replace = false) {
    let data;
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.encrypted) {
        const key = window.authService.getEncryptionKey();
        if (!key) {
          throw new Error('Chave de criptografia necessária para importar cofre criptografado.');
        }
        const decrypted = await window.cryptoService.decrypt(parsed.data, key);
        data = JSON.parse(decrypted);
      } else {
        data = parsed;
      }
    } catch (e) {
      throw new Error('Formato de arquivo inválido');
    }

    if (replace) {
      this._items = Array.isArray(data.items) ? data.items : [];
      this._folders = Array.isArray(data.folders) ? data.folders : [];
    } else {
      // Merge: generate new IDs for imported items to avoid collisions
      (data.items || []).forEach(item => {
        const importedItem = {
          ...item,
          id: window.cryptoService.generateId(),
          updatedAt: new Date().toISOString()
        };
        this._items.push(importedItem);
      });

      // Merge folders without duplicates by name
      (data.folders || []).forEach(folder => {
        if (!this._folders.find(f => f.name === folder.name)) {
          this._folders.push({
            id: window.cryptoService.generateId(),
            name: folder.name
          });
        }
      });
    }

    await this.saveVault();
  },

  /**
   * Vault security and health audit report.
   * Identifies weak, reused, and old (>90 days) passwords.
   * @returns {{weak: Array<Object>, reused: Array<Object>, old: Array<Object>, total: number}}
   */
  getHealthReport() {
    const activeItems = this._items.filter(i => !i.deletedAt && i.type === 'login');

    // Weak passwords (score < 3)
    const weak = activeItems.filter(i => {
      const password = i.login?.password || '';
      if (!password) return false;
      const strength = window.passwordGenerator.calculateStrength(password);
      return strength.score < 3;
    });

    // Reused passwords
    const passwordMap = {};
    activeItems.forEach(i => {
      const pwd = i.login?.password || '';
      if (pwd) {
        if (!passwordMap[pwd]) {
          passwordMap[pwd] = [];
        }
        passwordMap[pwd].push(i);
      }
    });
    const reused = Object.values(passwordMap).filter(arr => arr.length > 1).flat();

    // Old passwords (not updated in 90+ days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const old = activeItems.filter(i => i.updatedAt < ninetyDaysAgo);

    return {
      weak,
      reused,
      old,
      total: activeItems.length
    };
  },

  /**
   * Clear in-memory items and state on logout or lock.
   */
  clear() {
    this._items = [];
    this._folders = [];
    this._loaded = false;
  }
};

// Automatic cleanup on auth events
window.addEventListener('auth:logout', () => VaultService.clear());
window.addEventListener('auth:locked', () => VaultService.clear());

window.vaultService = VaultService;
