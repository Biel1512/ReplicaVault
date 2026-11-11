/**
 * Vaultwarden - Main Application Controller
 * Manages application state, authentication flow, vault operations, and event bindings.
 */

const App = {
  _currentFilter: { type: 'all' },
  _selectedItemId: null,
  _generatorTarget: null, // null or element ID (e.g. 'field-password')

  /**
   * Initialize application
   */
  async init() {
    this.bindEvents();
    this.bindAuthEvents();
    this.bindModalEvents();
    this.bindGeneratorEvents();
    this.bindInactivityEvents();

    // Check for existing session
    try {
      if (window.authService && window.authService.isLoggedIn()) {
        await this.enterVault();
      } else if (window.authService && window.authService.isLocked()) {
        window.ui.showScreen('auth-screen');
        window.ui.showAuthView('lock-view');
        const user = window.authService.getCurrentUser();
        const lockEmail = document.getElementById('lock-email');
        if (lockEmail) lockEmail.textContent = user?.email || '';
      } else {
        window.ui.showScreen('auth-screen');
        window.ui.showAuthView('login-view');
      }
    } catch (err) {
      console.error('Erro na inicialização:', err);
      window.ui.showScreen('auth-screen');
      window.ui.showAuthView('login-view');
    }
  },

  /**
   * Bind DOM event listeners
   */
  bindEvents() {
    // Authentication forms
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', e => this.handleLogin(e));

    const registerForm = document.getElementById('register-form');
    if (registerForm) registerForm.addEventListener('submit', e => this.handleRegister(e));

    const lockForm = document.getElementById('lock-form');
    if (lockForm) lockForm.addEventListener('submit', e => this.handleUnlock(e));

    const showRegister = document.getElementById('show-register');
    if (showRegister) {
      showRegister.addEventListener('click', e => {
        e.preventDefault();
        window.ui.showAuthView('register-view');
      });
    }

    const showLogin = document.getElementById('show-login');
    if (showLogin) {
      showLogin.addEventListener('click', e => {
        e.preventDefault();
        window.ui.showAuthView('login-view');
      });
    }

    const lockLogout = document.getElementById('lock-logout');
    if (lockLogout) {
      lockLogout.addEventListener('click', e => {
        e.preventDefault();
        if (window.authService) window.authService.logout();
      });
    }

    // Toggle password visibility (all .toggle-password buttons)
    document.querySelectorAll('.toggle-password').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const target = document.getElementById(targetId);
        if (!target) return;
        const isPassword = target.type === 'password';
        target.type = isPassword ? 'text' : 'password';
        const icon = btn.querySelector('i');
        if (icon) {
          icon.classList.toggle('fa-eye', !isPassword);
          icon.classList.toggle('fa-eye-slash', isPassword);
        }
      });
    });

    // Top bar buttons
    const btnGen = document.getElementById('btn-generator');
    if (btnGen) btnGen.addEventListener('click', () => this.openGenerator());

    const btnHealth = document.getElementById('btn-health');
    if (btnHealth) btnHealth.addEventListener('click', () => this.openHealthReport());

    const btnTools = document.getElementById('btn-tools');
    if (btnTools) btnTools.addEventListener('click', () => window.ui.openModal('tools-modal'));

    const btnLock = document.getElementById('btn-lock');
    if (btnLock) btnLock.addEventListener('click', () => {
      if (window.authService) window.authService.lock();
    });

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', () => {
      if (window.authService) window.authService.logout();
    });

    // Search with debounce
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      const onSearch = window.utils && window.utils.debounce ? window.utils.debounce(e => {
        this._currentFilter.search = e.target.value.trim();
        this.refreshVaultList();
      }, 300) : (e => {
        this._currentFilter.search = e.target.value.trim();
        this.refreshVaultList();
      });
      searchInput.addEventListener('input', onSearch);
    }

    // Sidebar navigation items
    document.querySelectorAll('.sidebar-item[data-filter]').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const filter = item.dataset.filter;
        const type = item.dataset.type;
        this.setFilter(filter, type);
      });
    });

    // Add item button (switches to empty trash when viewing trash)
    const btnAddItem = document.getElementById('btn-add-item');
    if (btnAddItem) {
      btnAddItem.addEventListener('click', () => {
        if (this._currentFilter && this._currentFilter.trash) {
          this.handleEmptyTrash();
        } else {
          this.openAddItem();
        }
      });
    }

    // Item type change inside form
    const itemTypeSelect = document.getElementById('item-type');
    if (itemTypeSelect) {
      itemTypeSelect.addEventListener('change', e => {
        window.ui.showTypeFields(e.target.value);
      });
    }

    // Save item button
    const btnSaveItem = document.getElementById('btn-save-item');
    if (btnSaveItem) btnSaveItem.addEventListener('click', () => this.handleSaveItem());

    // Generate password button in item form
    const btnGenForm = document.getElementById('btn-generate-password');
    if (btnGenForm) btnGenForm.addEventListener('click', () => this.openGenerator('field-password'));

    // Folder management buttons
    const btnAddFolder = document.getElementById('btn-add-folder');
    if (btnAddFolder) btnAddFolder.addEventListener('click', () => this.openAddFolder());

    const btnSaveFolder = document.getElementById('btn-save-folder');
    if (btnSaveFolder) btnSaveFolder.addEventListener('click', () => this.handleSaveFolder());

    // Register password strength indicator
    const regPassword = document.getElementById('register-password');
    if (regPassword) {
      regPassword.addEventListener('input', e => {
        if (window.passwordGenerator && typeof window.passwordGenerator.calculateStrength === 'function') {
          const strength = window.passwordGenerator.calculateStrength(e.target.value);
          window.ui.updateStrengthBar('register-strength', strength);
          const strengthLabel = document.querySelector('#register-view .strength-label');
          if (strengthLabel) strengthLabel.textContent = strength.label;
        }
      });
    }

    // Export/Import buttons
    const btnExport = document.getElementById('btn-export');
    if (btnExport) btnExport.addEventListener('click', () => this.handleExport());

    const btnImport = document.getElementById('btn-import');
    if (btnImport) btnImport.addEventListener('click', () => this.handleImport());
  },

  /**
   * Bind global authentication events
   */
  bindAuthEvents() {
    window.addEventListener('auth:logout', () => {
      if (window.vaultService) window.vaultService.clear();
      window.ui.showScreen('auth-screen');
      window.ui.showAuthView('login-view');
      this.clearState();
    });

    window.addEventListener('auth:locked', () => {
      window.ui.showScreen('auth-screen');
      window.ui.showAuthView('lock-view');
      const user = window.authService ? window.authService.getCurrentUser() : null;
      const lockEmail = document.getElementById('lock-email');
      if (lockEmail) lockEmail.textContent = user?.email || '';
    });
  },

  /**
   * Bind modal dismissal events
   */
  bindModalEvents() {
    document.querySelectorAll('.modal-overlay, .modal-close, .modal-cancel').forEach(el => {
      el.addEventListener('click', () => window.ui.closeAllModals());
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        window.ui.closeAllModals();
      }
    });
  },

  /**
   * Bind generator modal controls
   */
  bindGeneratorEvents() {
    // Tabs (Password vs Passphrase)
    document.querySelectorAll('.gen-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.gen-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const isPassphrase = tab.dataset.tab === 'passphrase';
        const pwdOpts = document.getElementById('gen-password-options');
        const passOpts = document.getElementById('gen-passphrase-options');
        if (pwdOpts) pwdOpts.style.display = isPassphrase ? 'none' : 'block';
        if (passOpts) passOpts.style.display = isPassphrase ? 'block' : 'none';
        this.regeneratePassword();
      });
    });

    // Option inputs change / input
    const optionIds = [
      'gen-length', 'gen-uppercase', 'gen-lowercase', 'gen-numbers', 'gen-symbols',
      'gen-min-numbers', 'gen-min-symbols', 'gen-words', 'gen-separator',
      'gen-capitalize', 'gen-include-number'
    ];

    optionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.regeneratePassword());
        el.addEventListener('change', () => this.regeneratePassword());
      }
    });

    // Range display labels
    const genLength = document.getElementById('gen-length');
    if (genLength) {
      genLength.addEventListener('input', e => {
        const valSpan = document.getElementById('gen-length-val');
        if (valSpan) valSpan.textContent = e.target.value;
      });
    }

    const genWords = document.getElementById('gen-words');
    if (genWords) {
      genWords.addEventListener('input', e => {
        const valSpan = document.getElementById('gen-words-val');
        if (valSpan) valSpan.textContent = e.target.value;
      });
    }

    // Copy generated password
    const btnCopyGen = document.getElementById('btn-copy-generated');
    if (btnCopyGen) {
      btnCopyGen.addEventListener('click', () => {
        const pwd = document.getElementById('generated-password').textContent;
        if (pwd && window.utils) {
          window.utils.copyToClipboard(pwd).then(() => {
            window.utils.showToast('Senha copiada!', 'success');
          });
        }
      });
    }

    // Regenerate button
    const btnRegen = document.getElementById('btn-regenerate');
    if (btnRegen) {
      btnRegen.addEventListener('click', () => this.regeneratePassword());
    }

    // Use password button
    const btnUse = document.getElementById('btn-use-password');
    if (btnUse) {
      btnUse.addEventListener('click', () => {
        if (this._generatorTarget) {
          const field = document.getElementById(this._generatorTarget);
          if (field) {
            field.value = document.getElementById('generated-password').textContent;
            field.type = 'text'; // Reveal generated password for convenience
            const toggle = field.parentElement?.querySelector('.toggle-password i');
            if (toggle) {
              toggle.classList.remove('fa-eye');
              toggle.classList.add('fa-eye-slash');
            }
          }
        }
        window.ui.closeModal('generator-modal');
      });
    }
  },

  /**
   * Bind user activity listeners for session timeout
   */
  bindInactivityEvents() {
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => {
        if (window.authService && typeof window.authService.resetInactivityTimer === 'function') {
          window.authService.resetInactivityTimer();
        }
      });
    });
  },

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  /**
   * Handle user login
   */
  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      window.utils.showToast('Por favor, preencha todos os campos', 'error');
      return;
    }

    try {
      const success = await window.authService.login(email, password);
      if (success) {
        document.getElementById('login-form').reset();
        await this.enterVault();
      } else {
        window.utils.showToast('Email ou senha incorretos', 'error');
      }
    } catch (err) {
      window.utils.showToast(err.message || 'Erro ao fazer login', 'error');
    }
  },

  /**
   * Handle user registration
   */
  async handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    const hint = document.getElementById('register-hint').value.trim();

    if (!email || !password || !confirm) {
      window.utils.showToast('Preencha os campos obrigatórios', 'error');
      return;
    }

    if (password !== confirm) {
      window.utils.showToast('As senhas não coincidem', 'error');
      return;
    }

    if (password.length < 8) {
      window.utils.showToast('A senha deve ter no mínimo 8 caracteres', 'error');
      return;
    }

    try {
      await window.authService.register(email, password, hint);
      window.utils.showToast('Conta criada com sucesso!', 'success');
      document.getElementById('register-form').reset();
      await this.enterVault();
    } catch (err) {
      window.utils.showToast(err.message || 'Erro ao criar conta', 'error');
    }
  },

  /**
   * Handle master password verification on lock screen
   */
  async handleUnlock(e) {
    e.preventDefault();
    const password = document.getElementById('lock-password').value;

    if (!password) {
      window.utils.showToast('Digite sua senha mestra', 'error');
      return;
    }

    try {
      const success = await window.authService.verifyMasterPassword(password);
      if (success) {
        document.getElementById('lock-form').reset();
        await this.enterVault();
      } else {
        window.utils.showToast('Senha incorreta', 'error');
      }
    } catch (err) {
      window.utils.showToast(err.message || 'Erro ao desbloquear cofre', 'error');
    }
  },

  /**
   * Enter main vault view after authentication
   */
  async enterVault() {
    if (window.vaultService) {
      await window.vaultService.loadVault();
    }
    window.ui.showScreen('main-screen');
    this.refreshAll();
  },

  /**
   * Refresh all components of the vault view
   */
  refreshAll() {
    this.refreshVaultList();
    if (window.vaultService) {
      window.ui.renderFolders(window.vaultService.getFolders());
    }
    window.ui.updateBadges();
    this.updateFolderSelect();
  },

  /**
   * Refresh vault item list applying active filter
   */
  refreshVaultList() {
    if (!window.vaultService) return;

    const items = window.vaultService.getItems(this._currentFilter) || [];
    window.ui.renderVaultList(items);

    // Re-select current item if still in list
    if (this._selectedItemId) {
      const currentItem = window.vaultService.getItem(this._selectedItemId);
      if (currentItem && !this._isItemFilteredOut(currentItem)) {
        window.ui.renderItemDetail(currentItem);
      } else {
        window.ui.clearDetail();
        this._selectedItemId = null;
      }
    } else {
      window.ui.clearDetail();
    }

    window.ui.updateBadges();
  },

  /**
   * Check if an item matches current filter
   * @private
   */
  _isItemFilteredOut(item) {
    if (!item) return true;
    if (this._currentFilter.trash) {
      return !item.deletedAt;
    }
    if (item.deletedAt) return true;
    if (this._currentFilter.favorite && !item.favorite) return true;
    if (this._currentFilter.type && item.type !== this._currentFilter.type) return true;
    if (this._currentFilter.folderId && item.folderId !== this._currentFilter.folderId) return true;
    return false;
  },

  /**
   * Set active sidebar filter
   * @param {string} filter 
   * @param {string} typeOrFolderId 
   */
  setFilter(filter, typeOrFolderId) {
    this._currentFilter = {};
    this._selectedItemId = null;
    window.ui.clearDetail();

    const titleEl = document.getElementById('vault-list-title');
    const btnAddItem = document.getElementById('btn-add-item');
    let title = 'Todos os Itens';

    switch (filter) {
      case 'all':
        title = 'Todos os Itens';
        break;
      case 'favorites':
        this._currentFilter.favorite = true;
        title = 'Favoritos';
        break;
      case 'type':
        this._currentFilter.type = typeOrFolderId;
        title = window.ui.getTypeLabel(typeOrFolderId);
        break;
      case 'folder': {
        this._currentFilter.folderId = typeOrFolderId;
        const folders = window.vaultService ? window.vaultService.getFolders() : [];
        const folder = folders.find(f => f.id === typeOrFolderId);
        title = folder ? folder.name : 'Pasta';
        break;
      }
      case 'trash':
        this._currentFilter.trash = true;
        title = 'Lixeira';
        break;
    }

    if (titleEl) titleEl.textContent = title;

    // Toggle button mode in vault header for trash
    if (btnAddItem) {
      if (filter === 'trash') {
        btnAddItem.innerHTML = '<i class="fas fa-trash-can"></i> Esvaziar Lixeira';
        btnAddItem.className = 'btn btn-danger btn-sm';
      } else {
        btnAddItem.innerHTML = '<i class="fas fa-plus"></i> Novo Item';
        btnAddItem.className = 'btn btn-primary btn-sm';
      }
    }

    this.refreshVaultList();
  },

  /**
   * Select an item and display details
   * @param {string} id 
   */
  selectItem(id) {
    this._selectedItemId = id;
    if (!window.vaultService) return;

    const item = window.vaultService.getItem(id);
    if (item) {
      window.ui.renderItemDetail(item);
    }

    // Highlight row in list
    document.querySelectorAll('.vault-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });
  },

  /**
   * Open modal to create a new item
   */
  openAddItem() {
    window.ui.clearItemForm();
    const titleEl = document.getElementById('item-modal-title');
    if (titleEl) titleEl.textContent = 'Novo Item';

    // If currently filtered by folder, preselect it
    if (this._currentFilter.folderId) {
      const folderSelect = document.getElementById('item-folder');
      if (folderSelect) folderSelect.value = this._currentFilter.folderId;
    }

    // If currently filtered by type, preselect it
    if (this._currentFilter.type) {
      const typeSelect = document.getElementById('item-type');
      if (typeSelect) {
        typeSelect.value = this._currentFilter.type;
        window.ui.showTypeFields(this._currentFilter.type);
      }
    }

    this.updateFolderSelect();
    window.ui.openModal('item-modal');
  },

  /**
   * Open modal to edit an existing item
   * @param {string} id 
   */
  openEditItem(id) {
    if (!window.vaultService) return;
    const item = window.vaultService.getItem(id);
    if (!item) return;

    const titleEl = document.getElementById('item-modal-title');
    if (titleEl) titleEl.textContent = 'Editar Item';

    this.updateFolderSelect();
    window.ui.populateItemForm(item);
    window.ui.openModal('item-modal');
  },

  /**
   * Save item from modal form
   */
  async handleSaveItem() {
    const id = document.getElementById('item-id').value;
    const type = document.getElementById('item-type').value;
    const name = document.getElementById('item-name').value.trim();
    const folderId = document.getElementById('item-folder').value || null;
    const favorite = document.getElementById('item-favorite').checked;

    if (!name) {
      window.utils.showToast('Nome é obrigatório', 'error');
      return;
    }

    const data = {
      type,
      name,
      folderId,
      favorite
    };

    // Collect type-specific fields
    switch (type) {
      case 'login':
        data.login = {
          username: document.getElementById('field-username').value.trim(),
          password: document.getElementById('field-password').value,
          uri: document.getElementById('field-uri').value.trim(),
          notes: document.getElementById('field-login-notes').value.trim()
        };
        break;
      case 'note':
        data.note = {
          content: document.getElementById('field-note-content').value
        };
        break;
      case 'card':
        data.card = {
          cardholderName: document.getElementById('field-cardholder').value.trim(),
          number: document.getElementById('field-card-number').value.replace(/\s+/g, ''),
          expMonth: document.getElementById('field-exp-month').value,
          expYear: document.getElementById('field-exp-year').value.trim(),
          cvv: document.getElementById('field-cvv').value.trim(),
          notes: document.getElementById('field-card-notes').value.trim()
        };
        break;
      case 'identity':
        data.identity = {
          firstName: document.getElementById('field-first-name').value.trim(),
          lastName: document.getElementById('field-last-name').value.trim(),
          email: document.getElementById('field-id-email').value.trim(),
          phone: document.getElementById('field-phone').value.trim(),
          address1: document.getElementById('field-address1').value.trim(),
          address2: document.getElementById('field-address2').value.trim(),
          city: document.getElementById('field-city').value.trim(),
          state: document.getElementById('field-state').value.trim(),
          zip: document.getElementById('field-zip').value.trim(),
          country: document.getElementById('field-country').value.trim(),
          notes: document.getElementById('field-id-notes').value.trim()
        };
        break;
    }

    try {
      if (id) {
        await window.vaultService.updateItem(id, data);
        window.utils.showToast('Item atualizado com sucesso', 'success');
        this._selectedItemId = id;
      } else {
        const newItem = await window.vaultService.addItem(data);
        this._selectedItemId = newItem.id;
        window.utils.showToast('Item criado com sucesso', 'success');
      }

      window.ui.closeModal('item-modal');
      this.refreshAll();
      if (this._selectedItemId) this.selectItem(this._selectedItemId);
    } catch (err) {
      window.utils.showToast(err.message || 'Erro ao salvar item', 'error');
    }
  },

  /**
   * Delete or move item to trash
   * @param {string} id 
   */
  async handleDeleteItem(id) {
    if (!window.vaultService) return;
    const item = window.vaultService.getItem(id);
    if (!item) return;

    if (item.deletedAt) {
      // In trash - permanent delete confirmation
      this.confirm(`Excluir permanentemente "${item.name}"? Esta ação não pode ser desfeita.`, async () => {
        try {
          await window.vaultService.permanentDelete(id);
          window.utils.showToast('Item excluído permanentemente', 'success');
          this._selectedItemId = null;
          window.ui.clearDetail();
          this.refreshAll();
        } catch (err) {
          window.utils.showToast(err.message || 'Erro ao excluir item', 'error');
        }
      });
    } else {
      // Move to trash
      try {
        await window.vaultService.deleteItem(id);
        window.utils.showToast('Item movido para a lixeira', 'info');
        this._selectedItemId = null;
        window.ui.clearDetail();
        this.refreshAll();
      } catch (err) {
        window.utils.showToast(err.message || 'Erro ao mover para a lixeira', 'error');
      }
    }
  },

  /**
   * Restore item from trash
   * @param {string} id 
   */
  async handleRestoreItem(id) {
    if (!window.vaultService) return;
    try {
      await window.vaultService.restoreItem(id);
      window.utils.showToast('Item restaurado com sucesso', 'success');
      this._selectedItemId = null;
      window.ui.clearDetail();
      this.refreshAll();
    } catch (err) {
      window.utils.showToast(err.message || 'Erro ao restaurar item', 'error');
    }
  },

  /**
   * Toggle favorite flag for an item
   * @param {string} id 
   */
  async handleToggleFavorite(id) {
    if (!window.vaultService) return;
    const item = window.vaultService.getItem(id);
    if (item) {
      try {
        const nextState = !item.favorite;
        await window.vaultService.updateItem(id, { favorite: nextState });
        window.utils.showToast(nextState ? 'Adicionado aos favoritos' : 'Removido dos favoritos', 'info');
        this.refreshAll();
        if (this._selectedItemId === id) {
          this.selectItem(id);
        }
      } catch (err) {
        window.utils.showToast(err.message || 'Erro ao alterar favorito', 'error');
      }
    }
  },

  /**
   * Update folder options in item modal dropdown
   */
  updateFolderSelect() {
    const select = document.getElementById('item-folder');
    if (!select || !window.vaultService) return;

    const currentVal = select.value;
    const folders = window.vaultService.getFolders() || [];

    select.innerHTML = '<option value="">Nenhuma pasta</option>' +
      folders.map(f => `<option value="${f.id}">${window.utils.escapeHtml(f.name)}</option>`).join('');

    if (currentVal) select.value = currentVal;
  },

  /**
   * Open modal to create a new folder
   */
  openAddFolder() {
    const title = document.getElementById('folder-modal-title');
    if (title) title.textContent = 'Nova Pasta';

    const nameInput = document.getElementById('folder-name');
    if (nameInput) nameInput.value = '';

    const idInput = document.getElementById('folder-id');
    if (idInput) idInput.value = '';

    window.ui.openModal('folder-modal');
  },

  /**
   * Open modal to edit an existing folder
   * @param {string} id 
   */
  openEditFolder(id) {
    if (!window.vaultService) return;
    const folders = window.vaultService.getFolders() || [];
    const folder = folders.find(f => f.id === id);
    if (!folder) return;

    const title = document.getElementById('folder-modal-title');
    if (title) title.textContent = 'Editar Pasta';

    const nameInput = document.getElementById('folder-name');
    if (nameInput) nameInput.value = folder.name;

    const idInput = document.getElementById('folder-id');
    if (idInput) idInput.value = folder.id;

    window.ui.openModal('folder-modal');
  },

  /**
   * Save folder from modal
   */
  async handleSaveFolder() {
    const id = document.getElementById('folder-id').value;
    const name = document.getElementById('folder-name').value.trim();

    if (!name) {
      window.utils.showToast('Nome da pasta é obrigatório', 'error');
      return;
    }

    try {
      if (id) {
        await window.vaultService.updateFolder(id, name);
        window.utils.showToast('Pasta atualizada com sucesso', 'success');
      } else {
        await window.vaultService.addFolder(name);
        window.utils.showToast('Pasta criada com sucesso', 'success');
      }
      window.ui.closeModal('folder-modal');
      this.refreshAll();
    } catch (err) {
      window.utils.showToast(err.message || 'Erro ao salvar pasta', 'error');
    }
  },

  /**
   * Delete folder confirmation
   * @param {string} id 
   */
  async handleDeleteFolder(id) {
    if (!window.vaultService) return;
    this.confirm('Excluir esta pasta? Os itens serão mantidos fora de pastas.', async () => {
      try {
        await window.vaultService.deleteFolder(id);
        window.utils.showToast('Pasta excluída', 'success');
        this.setFilter('all');
        this.refreshAll();
      } catch (err) {
        window.utils.showToast(err.message || 'Erro ao excluir pasta', 'error');
      }
    });
  },

  /**
   * Open password generator modal
   * @param {string|null} targetField Element ID to insert password into
   */
  openGenerator(targetField = null) {
    this._generatorTarget = targetField;
    const btnUse = document.getElementById('btn-use-password');
    if (btnUse) {
      btnUse.style.display = targetField ? 'inline-flex' : 'none';
    }
    this.regeneratePassword();
    window.ui.openModal('generator-modal');
  },

  /**
   * Regenerate password based on active generator tab and options
   */
  regeneratePassword() {
    if (!window.passwordGenerator) return;

    const activeTab = document.querySelector('.gen-tab.active');
    const isPassphrase = activeTab?.dataset.tab === 'passphrase';
    let password = '';

    if (isPassphrase) {
      const wordCount = parseInt(document.getElementById('gen-words')?.value || '4', 10);
      const separator = document.getElementById('gen-separator')?.value || '-';
      const capitalize = Boolean(document.getElementById('gen-capitalize')?.checked);
      const includeNumber = Boolean(document.getElementById('gen-include-number')?.checked);

      password = window.passwordGenerator.generatePassphrase({
        wordCount,
        separator,
        capitalize,
        includeNumber
      });
    } else {
      const length = parseInt(document.getElementById('gen-length')?.value || '16', 10);
      const uppercase = Boolean(document.getElementById('gen-uppercase')?.checked);
      const lowercase = Boolean(document.getElementById('gen-lowercase')?.checked);
      const numbers = Boolean(document.getElementById('gen-numbers')?.checked);
      const symbols = Boolean(document.getElementById('gen-symbols')?.checked);
      const minNumbers = parseInt(document.getElementById('gen-min-numbers')?.value || '1', 10);
      const minSymbols = parseInt(document.getElementById('gen-min-symbols')?.value || '1', 10);

      password = window.passwordGenerator.generate({
        length,
        uppercase,
        lowercase,
        numbers,
        symbols,
        minNumbers,
        minSymbols
      });
    }

    window.ui.updateGeneratorDisplay(password);
  },

  /**
   * Open vault health report modal
   */
  openHealthReport() {
    if (!window.vaultService) return;
    const report = window.vaultService.getHealthReport();
    window.ui.renderHealthReport(report);
    window.ui.openModal('health-modal');
  },

  /**
   * Export vault data to file
   */
  async handleExport() {
    if (!window.vaultService) return;
    try {
      const encrypted = Boolean(document.getElementById('export-encrypted')?.checked);
      const json = await window.vaultService.exportVault(encrypted);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `vaultwarden-export-${encrypted ? 'encrypted-' : ''}${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.utils.showToast('Cofre exportado com sucesso', 'success');
      window.ui.closeModal('tools-modal');
    } catch (err) {
      window.utils.showToast(err.message || 'Erro ao exportar cofre', 'error');
    }
  },

  /**
   * Import vault data from file
   */
  async handleImport() {
    if (!window.vaultService) return;
    const fileInput = document.getElementById('import-file');
    const replace = Boolean(document.getElementById('import-replace')?.checked);

    if (!fileInput || !fileInput.files.length) {
      window.utils.showToast('Selecione um arquivo JSON', 'error');
      return;
    }

    try {
      const text = await fileInput.files[0].text();
      await window.vaultService.importVault(text, replace);
      window.utils.showToast('Dados importados com sucesso', 'success');
      fileInput.value = '';
      window.ui.closeModal('tools-modal');
      this.refreshAll();
    } catch (err) {
      window.utils.showToast(err.message || 'Erro ao importar arquivo', 'error');
    }
  },

  /**
   * Display confirmation modal with custom callback
   * @param {string} message 
   * @param {Function} onConfirm 
   */
  confirm(message, onConfirm) {
    const msgEl = document.getElementById('confirm-message');
    if (msgEl) msgEl.textContent = message;

    window.ui.openModal('confirm-modal');

    const okBtn = document.getElementById('btn-confirm-ok');
    if (!okBtn) return;

    // Safely replace button to remove all previous listeners
    const cleanBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(cleanBtn, okBtn);

    cleanBtn.addEventListener('click', () => {
      window.ui.closeModal('confirm-modal');
      if (typeof onConfirm === 'function') onConfirm();
    });
  },

  /**
   * Reset internal application state
   */
  clearState() {
    this._currentFilter = { type: 'all' };
    this._selectedItemId = null;
    this._generatorTarget = null;
    window.ui.clearDetail();
  },

  /**
   * Empty trash action with confirmation
   */
  async handleEmptyTrash() {
    if (!window.vaultService) return;
    const trash = window.vaultService.getTrash() || [];
    if (trash.length === 0) {
      window.utils.showToast('A lixeira já está vazia', 'info');
      return;
    }

    this.confirm('Esvaziar a lixeira? Esta ação excluirá permanentemente todos os itens da lixeira.', async () => {
      try {
        await window.vaultService.emptyTrash();
        window.utils.showToast('Lixeira esvaziada com sucesso', 'success');
        this._selectedItemId = null;
        window.ui.clearDetail();
        this.refreshAll();
      } catch (err) {
        window.utils.showToast(err.message || 'Erro ao esvaziar lixeira', 'error');
      }
    });
  }
};

window.app = App;

// Bootstrap application once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
