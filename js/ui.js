/**
 * Vaultwarden - UI Module
 * Handles all rendering, modal management, and UI state updates.
 */

const UI = {
  /**
   * Render vault items list in the center column
   * @param {Array<Object>} items 
   */
  renderVaultList(items) {
    const listContainer = document.getElementById('vault-items');
    const emptyState = document.getElementById('vault-empty');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (!items || items.length === 0) {
      if (emptyState) emptyState.classList.add('active');
      return;
    }

    if (emptyState) emptyState.classList.remove('active');

    const selectedId = window.app ? window.app._selectedItemId : null;

    items.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = `vault-item ${selectedId === item.id ? 'active' : ''}`;
      itemEl.dataset.id = item.id;

      const typeIcon = this.getTypeIcon(item.type);
      const typeColor = this.getTypeColor(item.type);
      const subtitle = this.getItemSubtitle(item);
      const isFav = Boolean(item.favorite);

      itemEl.innerHTML = `
        <div class="vault-item-icon" style="background-color: ${typeColor};">
          <i class="fas ${typeIcon}"></i>
        </div>
        <div class="vault-item-info">
          <div class="vault-item-name">${window.utils.escapeHtml(item.name || 'Sem título')}</div>
          <div class="vault-item-subtitle">${window.utils.escapeHtml(subtitle || 'Nenhum detalhe')}</div>
        </div>
        <div class="vault-item-fav ${isFav ? 'active' : ''}" title="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">
          <i class="${isFav ? 'fas' : 'far'} fa-star"></i>
        </div>
      `;

      // Select item on row click
      itemEl.addEventListener('click', (e) => {
        const favBtn = itemEl.querySelector('.vault-item-fav');
        if (favBtn && (favBtn === e.target || favBtn.contains(e.target))) {
          e.stopPropagation();
          if (window.app) window.app.handleToggleFavorite(item.id);
          return;
        }
        if (window.app) window.app.selectItem(item.id);
      });

      listContainer.appendChild(itemEl);
    });
  },

  /**
   * Render item detail in the right panel
   * @param {Object} item 
   */
  renderItemDetail(item) {
    const detailPanel = document.getElementById('item-detail');
    const emptyState = document.getElementById('detail-empty');
    const detailContent = document.getElementById('detail-content');
    if (!detailContent) return;

    if (!item) {
      this.clearDetail();
      return;
    }

    if (emptyState) emptyState.classList.remove('active');
    if (detailPanel) detailPanel.classList.add('panel-open');

    const isDeleted = Boolean(item.deletedAt);
    const typeLabel = this.getTypeLabel(item.type);
    const typeIcon = this.getTypeIcon(item.type);
    const typeColor = this.getTypeColor(item.type);

    let folderName = null;
    if (item.folderId && window.vaultService) {
      const folder = window.vaultService.getFolders().find(f => f.id === item.folderId);
      if (folder) folderName = folder.name;
    }

    let fieldsHtml = '';

    switch (item.type) {
      case 'login': {
        const login = item.login || {};
        fieldsHtml += `
          <div class="detail-section">
            <div class="detail-section-title">Credenciais de Acesso</div>
            ${login.username ? `
              <div class="detail-field">
                <span class="detail-field-label">Usuário</span>
                <div class="detail-field-value">
                  <span class="value-text">${window.utils.escapeHtml(login.username)}</span>
                  <div class="value-actions">
                    <button type="button" class="btn-copy" data-copy="${window.utils.escapeHtml(login.username)}" title="Copiar usuário">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>
            ` : ''}
            ${login.password ? `
              <div class="detail-field">
                <span class="detail-field-label">Senha</span>
                <div class="detail-field-value">
                  <span class="value-text mono" data-revealed="false">••••••••••••</span>
                  <div class="value-actions">
                    <button type="button" class="btn-toggle-secret" title="Mostrar/ocultar senha">
                      <i class="fas fa-eye"></i>
                    </button>
                    <button type="button" class="btn-copy" data-copy="${window.utils.escapeHtml(login.password)}" title="Copiar senha">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>
            ` : ''}
            ${login.uri ? `
              <div class="detail-field">
                <span class="detail-field-label">Website / URI</span>
                <div class="detail-field-value">
                  <span class="value-text">
                    <a href="${window.utils.escapeHtml(login.uri)}" target="_blank" rel="noopener noreferrer">
                      ${window.utils.escapeHtml(login.uri)} <i class="fas fa-external-link-alt" style="font-size:0.8em; margin-left:4px;"></i>
                    </a>
                  </span>
                  <div class="value-actions">
                    <button type="button" class="btn-copy" data-copy="${window.utils.escapeHtml(login.uri)}" title="Copiar URI">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>
            ` : ''}
            ${login.notes ? `
              <div class="detail-field">
                <span class="detail-field-label">Notas</span>
                <div class="detail-notes-box">${window.utils.escapeHtml(login.notes)}</div>
              </div>
            ` : ''}
          </div>
        `;
        break;
      }

      case 'note': {
        const note = item.note || {};
        fieldsHtml += `
          <div class="detail-section">
            <div class="detail-section-title">Conteúdo da Nota</div>
            <div class="detail-notes-box">${window.utils.escapeHtml(note.content || 'Nota vazia')}</div>
            ${note.content ? `
              <div style="margin-top:8px; display:flex; justify-content:flex-end;">
                <button type="button" class="btn btn-secondary btn-sm btn-copy" data-copy="${window.utils.escapeHtml(note.content)}">
                  <i class="fas fa-copy"></i> Copiar Conteúdo
                </button>
              </div>
            ` : ''}
          </div>
        `;
        break;
      }

      case 'card': {
        const card = item.card || {};
        const maskedNum = card.number ? (window.utils.maskCardNumber ? window.utils.maskCardNumber(card.number) : `•••• •••• •••• ${card.number.slice(-4)}`) : '';
        fieldsHtml += `
          <div class="detail-section">
            <div class="detail-section-title">Informações do Cartão</div>
            ${card.cardholderName ? `
              <div class="detail-field">
                <span class="detail-field-label">Nome do Titular</span>
                <div class="detail-field-value">
                  <span class="value-text">${window.utils.escapeHtml(card.cardholderName)}</span>
                  <div class="value-actions">
                    <button type="button" class="btn-copy" data-copy="${window.utils.escapeHtml(card.cardholderName)}" title="Copiar titular">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>
            ` : ''}
            ${card.number ? `
              <div class="detail-field">
                <span class="detail-field-label">Número do Cartão</span>
                <div class="detail-field-value">
                  <span class="value-text mono" data-revealed="false">${maskedNum}</span>
                  <div class="value-actions">
                    <button type="button" class="btn-toggle-card-number" data-real="${window.utils.escapeHtml(card.number)}" data-masked="${maskedNum}" title="Mostrar/ocultar número">
                      <i class="fas fa-eye"></i>
                    </button>
                    <button type="button" class="btn-copy" data-copy="${window.utils.escapeHtml(card.number)}" title="Copiar número">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>
            ` : ''}
            <div class="form-row">
              ${(card.expMonth || card.expYear) ? `
                <div class="detail-field" style="flex:1;">
                  <span class="detail-field-label">Validade</span>
                  <div class="detail-field-value">
                    <span class="value-text">${card.expMonth || '--'} / ${card.expYear || '----'}</span>
                  </div>
                </div>
              ` : ''}
              ${card.cvv ? `
                <div class="detail-field" style="flex:1;">
                  <span class="detail-field-label">CVV</span>
                  <div class="detail-field-value">
                    <span class="value-text mono" data-revealed="false">•••</span>
                    <div class="value-actions">
                      <button type="button" class="btn-toggle-cvv" data-real="${window.utils.escapeHtml(card.cvv)}" title="Mostrar/ocultar CVV">
                        <i class="fas fa-eye"></i>
                      </button>
                      <button type="button" class="btn-copy" data-copy="${window.utils.escapeHtml(card.cvv)}" title="Copiar CVV">
                        <i class="fas fa-copy"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>
            ${card.notes ? `
              <div class="detail-field">
                <span class="detail-field-label">Notas</span>
                <div class="detail-notes-box">${window.utils.escapeHtml(card.notes)}</div>
              </div>
            ` : ''}
          </div>
        `;
        break;
      }

      case 'identity': {
        const iden = item.identity || {};
        const fullName = `${iden.firstName || ''} ${iden.lastName || ''}`.trim();
        fieldsHtml += `
          <div class="detail-section">
            <div class="detail-section-title">Dados Pessoais</div>
            ${fullName ? `
              <div class="detail-field">
                <span class="detail-field-label">Nome Completo</span>
                <div class="detail-field-value">
                  <span class="value-text">${window.utils.escapeHtml(fullName)}</span>
                  <div class="value-actions">
                    <button type="button" class="btn-copy" data-copy="${window.utils.escapeHtml(fullName)}" title="Copiar nome">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>
            ` : ''}
            ${iden.email ? `
              <div class="detail-field">
                <span class="detail-field-label">Email</span>
                <div class="detail-field-value">
                  <span class="value-text">${window.utils.escapeHtml(iden.email)}</span>
                  <div class="value-actions">
                    <button type="button" class="btn-copy" data-copy="${window.utils.escapeHtml(iden.email)}" title="Copiar email">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>
            ` : ''}
            ${iden.phone ? `
              <div class="detail-field">
                <span class="detail-field-label">Telefone</span>
                <div class="detail-field-value">
                  <span class="value-text">${window.utils.escapeHtml(iden.phone)}</span>
                  <div class="value-actions">
                    <button type="button" class="btn-copy" data-copy="${window.utils.escapeHtml(iden.phone)}" title="Copiar telefone">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>
            ` : ''}
            ${(iden.address1 || iden.city || iden.state || iden.zip) ? `
              <div class="detail-field">
                <span class="detail-field-label">Endereço</span>
                <div class="detail-notes-box">
                  ${iden.address1 ? `<div>${window.utils.escapeHtml(iden.address1)}</div>` : ''}
                  ${iden.address2 ? `<div>${window.utils.escapeHtml(iden.address2)}</div>` : ''}
                  ${(iden.city || iden.state) ? `<div>${window.utils.escapeHtml(iden.city || '')}${iden.city && iden.state ? ' - ' : ''}${window.utils.escapeHtml(iden.state || '')}</div>` : ''}
                  ${iden.zip ? `<div>CEP: ${window.utils.escapeHtml(iden.zip)}</div>` : ''}
                  ${iden.country ? `<div>${window.utils.escapeHtml(iden.country)}</div>` : ''}
                </div>
              </div>
            ` : ''}
            ${iden.notes ? `
              <div class="detail-field">
                <span class="detail-field-label">Notas</span>
                <div class="detail-notes-box">${window.utils.escapeHtml(iden.notes)}</div>
              </div>
            ` : ''}
          </div>
        `;
        break;
      }
    }

    const createdFormatted = item.createdAt ? (window.utils.formatDate ? window.utils.formatDate(item.createdAt) : new Date(item.createdAt).toLocaleString()) : 'N/A';
    const updatedFormatted = item.updatedAt ? (window.utils.formatDate ? window.utils.formatDate(item.updatedAt) : new Date(item.updatedAt).toLocaleString()) : 'N/A';

    detailContent.innerHTML = `
      <div class="detail-header">
        <div class="detail-header-top">
          <div class="detail-icon" style="background-color: ${typeColor};">
            <i class="fas ${typeIcon}"></i>
          </div>
          <div class="detail-titles">
            <div class="detail-title">${window.utils.escapeHtml(item.name || 'Sem título')}</div>
            <div class="detail-badges">
              <span class="tag-badge">${typeLabel}</span>
              ${folderName ? `<span class="tag-badge badge-folder"><i class="fas fa-folder"></i> ${window.utils.escapeHtml(folderName)}</span>` : ''}
              ${item.favorite ? `<span class="tag-badge" style="color:#ecc94b;"><i class="fas fa-star"></i> Favorito</span>` : ''}
              ${isDeleted ? `<span class="tag-badge badge-trash"><i class="fas fa-trash"></i> Na Lixeira</span>` : ''}
            </div>
          </div>
        </div>
        <div class="detail-actions">
          ${isDeleted ? `
            <button type="button" id="btn-detail-restore" class="btn btn-secondary btn-sm"><i class="fas fa-trash-arrow-up"></i> Restaurar</button>
            <button type="button" id="btn-detail-delete" class="btn btn-danger btn-sm"><i class="fas fa-trash"></i> Excluir Definitivo</button>
          ` : `
            <button type="button" id="btn-detail-edit" class="btn btn-primary btn-sm"><i class="fas fa-pen"></i> Editar</button>
            <button type="button" id="btn-detail-fav" class="btn btn-secondary btn-sm"><i class="${item.favorite ? 'fas' : 'far'} fa-star"></i> ${item.favorite ? 'Desfavoritar' : 'Favoritar'}</button>
            <button type="button" id="btn-detail-delete" class="btn btn-danger btn-sm"><i class="fas fa-trash"></i> Excluir</button>
          `}
        </div>
      </div>

      ${fieldsHtml}

      <div class="detail-meta">
        <div><strong>Criado em:</strong> ${createdFormatted}</div>
        <div><strong>Última alteração:</strong> ${updatedFormatted}</div>
        ${item.deletedAt ? `<div><strong>Excluído em:</strong> ${window.utils.formatDate ? window.utils.formatDate(item.deletedAt) : new Date(item.deletedAt).toLocaleString()}</div>` : ''}
      </div>
    `;

    // Action button listeners
    const editBtn = document.getElementById('btn-detail-edit');
    if (editBtn) editBtn.addEventListener('click', () => window.app.openEditItem(item.id));

    const deleteBtn = document.getElementById('btn-detail-delete');
    if (deleteBtn) deleteBtn.addEventListener('click', () => window.app.handleDeleteItem(item.id));

    const restoreBtn = document.getElementById('btn-detail-restore');
    if (restoreBtn) restoreBtn.addEventListener('click', () => window.app.handleRestoreItem(item.id));

    const favBtn = document.getElementById('btn-detail-fav');
    if (favBtn) favBtn.addEventListener('click', () => window.app.handleToggleFavorite(item.id));

    // Secret toggles (password)
    const secretToggle = detailContent.querySelector('.btn-toggle-secret');
    if (secretToggle) {
      secretToggle.addEventListener('click', () => {
        const valSpan = secretToggle.closest('.detail-field-value').querySelector('.value-text');
        const icon = secretToggle.querySelector('i');
        const isRevealed = valSpan.dataset.revealed === 'true';
        if (isRevealed) {
          valSpan.textContent = '••••••••••••';
          valSpan.dataset.revealed = 'false';
          icon.className = 'fas fa-eye';
        } else {
          valSpan.textContent = item.login ? item.login.password : '';
          valSpan.dataset.revealed = 'true';
          icon.className = 'fas fa-eye-slash';
        }
      });
    }

    // Secret toggles (card number)
    const cardToggle = detailContent.querySelector('.btn-toggle-card-number');
    if (cardToggle) {
      cardToggle.addEventListener('click', () => {
        const valSpan = cardToggle.closest('.detail-field-value').querySelector('.value-text');
        const icon = cardToggle.querySelector('i');
        const isRevealed = valSpan.dataset.revealed === 'true';
        if (isRevealed) {
          valSpan.textContent = cardToggle.dataset.masked;
          valSpan.dataset.revealed = 'false';
          icon.className = 'fas fa-eye';
        } else {
          valSpan.textContent = cardToggle.dataset.real;
          valSpan.dataset.revealed = 'true';
          icon.className = 'fas fa-eye-slash';
        }
      });
    }

    // Secret toggles (CVV)
    const cvvToggle = detailContent.querySelector('.btn-toggle-cvv');
    if (cvvToggle) {
      cvvToggle.addEventListener('click', () => {
        const valSpan = cvvToggle.closest('.detail-field-value').querySelector('.value-text');
        const icon = cvvToggle.querySelector('i');
        const isRevealed = valSpan.dataset.revealed === 'true';
        if (isRevealed) {
          valSpan.textContent = '•••';
          valSpan.dataset.revealed = 'false';
          icon.className = 'fas fa-eye';
        } else {
          valSpan.textContent = cvvToggle.dataset.real;
          valSpan.dataset.revealed = 'true';
          icon.className = 'fas fa-eye-slash';
        }
      });
    }

    // Copy buttons
    detailContent.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const textToCopy = btn.dataset.copy;
        if (textToCopy) {
          window.utils.copyToClipboard(textToCopy).then(() => {
            window.utils.showToast('Copiado para a área de transferência', 'success');
          });
        }
      });
    });
  },

  /**
   * Clear detail panel and show empty state
   */
  clearDetail() {
    const detailPanel = document.getElementById('item-detail');
    const emptyState = document.getElementById('detail-empty');
    const detailContent = document.getElementById('detail-content');
    if (detailContent) detailContent.innerHTML = '';
    if (emptyState) emptyState.classList.add('active');
    if (detailPanel) detailPanel.classList.remove('panel-open');
  },

  /**
   * Render folder list in sidebar
   * @param {Array<Object>} folders 
   */
  renderFolders(folders) {
    const foldersContainer = document.getElementById('folders-list');
    if (!foldersContainer) return;

    foldersContainer.innerHTML = '';

    if (!folders || folders.length === 0) {
      return;
    }

    folders.forEach(folder => {
      const folderItem = document.createElement('a');
      folderItem.href = '#';
      folderItem.className = 'sidebar-item';
      folderItem.dataset.filter = 'folder';
      folderItem.dataset.type = folder.id;

      const itemsInFolder = window.vaultService ? window.vaultService.getItemsByFolder(folder.id).length : 0;

      folderItem.innerHTML = `
        <i class="fas fa-folder"></i>
        <span>${window.utils.escapeHtml(folder.name)}</span>
        <span class="badge">${itemsInFolder}</span>
        <div class="sidebar-item-actions">
          <button type="button" class="btn-edit-fld" title="Editar pasta"><i class="fas fa-pen"></i></button>
          <button type="button" class="btn-delete-fld" title="Excluir pasta"><i class="fas fa-trash"></i></button>
        </div>
      `;

      // Filter click
      folderItem.addEventListener('click', (e) => {
        e.preventDefault();
        const editBtn = folderItem.querySelector('.btn-edit-fld');
        const deleteBtn = folderItem.querySelector('.btn-delete-fld');
        if (editBtn && (editBtn === e.target || editBtn.contains(e.target))) {
          e.stopPropagation();
          if (window.app) window.app.openEditFolder(folder.id);
          return;
        }
        if (deleteBtn && (deleteBtn === e.target || deleteBtn.contains(e.target))) {
          e.stopPropagation();
          if (window.app) window.app.handleDeleteFolder(folder.id);
          return;
        }

        document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
        folderItem.classList.add('active');
        if (window.app) window.app.setFilter('folder', folder.id);
      });

      foldersContainer.appendChild(folderItem);
    });
  },

  /**
   * Update all sidebar counter badges
   */
  updateBadges() {
    if (!window.vaultService) return;

    const allItems = window.vaultService.getItems() || [];
    const favorites = window.vaultService.getFavorites() || [];
    const logins = window.vaultService.getItemsByType('login') || [];
    const cards = window.vaultService.getItemsByType('card') || [];
    const identities = window.vaultService.getItemsByType('identity') || [];
    const notes = window.vaultService.getItemsByType('note') || [];
    const trash = window.vaultService.getTrash() || [];

    const setBadge = (id, count) => {
      const el = document.getElementById(id);
      if (el) el.textContent = count > 0 ? count : '';
    };

    setBadge('badge-all', allItems.length);
    setBadge('badge-fav', favorites.length);
    setBadge('badge-login', logins.length);
    setBadge('badge-card', cards.length);
    setBadge('badge-identity', identities.length);
    setBadge('badge-note', notes.length);
    setBadge('badge-trash', trash.length);
  },

  /**
   * Open modal by ID
   * @param {string} modalId 
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
      if (firstInput) setTimeout(() => firstInput.focus(), 50);
    }
  },

  /**
   * Close modal by ID
   * @param {string} modalId 
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  /**
   * Close all active modals
   */
  closeAllModals() {
    document.querySelectorAll('.modal.active').forEach(modal => {
      modal.classList.remove('active');
    });
  },

  /**
   * Populate item form for editing
   * @param {Object} item 
   */
  populateItemForm(item) {
    if (!item) return;

    this.clearItemForm();

    document.getElementById('item-id').value = item.id || '';
    document.getElementById('item-type').value = item.type || 'login';
    document.getElementById('item-name').value = item.name || '';
    document.getElementById('item-folder').value = item.folderId || '';
    document.getElementById('item-favorite').checked = Boolean(item.favorite);

    this.showTypeFields(item.type || 'login');

    switch (item.type) {
      case 'login': {
        const login = item.login || {};
        document.getElementById('field-username').value = login.username || '';
        document.getElementById('field-password').value = login.password || '';
        document.getElementById('field-uri').value = login.uri || '';
        document.getElementById('field-login-notes').value = login.notes || '';
        break;
      }
      case 'note': {
        const note = item.note || {};
        document.getElementById('field-note-content').value = note.content || '';
        break;
      }
      case 'card': {
        const card = item.card || {};
        document.getElementById('field-cardholder').value = card.cardholderName || '';
        document.getElementById('field-card-number').value = card.number || '';
        document.getElementById('field-exp-month').value = card.expMonth || '';
        document.getElementById('field-exp-year').value = card.expYear || '';
        document.getElementById('field-cvv').value = card.cvv || '';
        document.getElementById('field-card-notes').value = card.notes || '';
        break;
      }
      case 'identity': {
        const iden = item.identity || {};
        document.getElementById('field-first-name').value = iden.firstName || '';
        document.getElementById('field-last-name').value = iden.lastName || '';
        document.getElementById('field-id-email').value = iden.email || '';
        document.getElementById('field-phone').value = iden.phone || '';
        document.getElementById('field-address1').value = iden.address1 || '';
        document.getElementById('field-address2').value = iden.address2 || '';
        document.getElementById('field-city').value = iden.city || '';
        document.getElementById('field-state').value = iden.state || '';
        document.getElementById('field-zip').value = iden.zip || '';
        document.getElementById('field-country').value = iden.country || '';
        document.getElementById('field-id-notes').value = iden.notes || '';
        break;
      }
    }
  },

  /**
   * Reset item form fields
   */
  clearItemForm() {
    const form = document.getElementById('item-form');
    if (form) form.reset();

    document.getElementById('item-id').value = '';
    document.getElementById('item-type').value = 'login';
    document.getElementById('item-name').value = '';
    document.getElementById('item-folder').value = '';
    document.getElementById('item-favorite').checked = false;

    // Reset password visibility toggles in item form
    const pwdInput = document.getElementById('field-password');
    if (pwdInput) pwdInput.type = 'password';
    const cvvInput = document.getElementById('field-cvv');
    if (cvvInput) cvvInput.type = 'password';

    document.querySelectorAll('#item-form .toggle-password i').forEach(icon => {
      icon.className = 'fas fa-eye';
    });

    this.showTypeFields('login');
  },

  /**
   * Show form fields corresponding to selected item type
   * @param {string} type 
   */
  showTypeFields(type) {
    document.querySelectorAll('.type-fields').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`fields-${type}`);
    if (target) {
      target.style.display = 'block';
    }
  },

  /**
   * Render health report in modal
   * @param {Object} report 
   */
  renderHealthReport(report) {
    const container = document.getElementById('health-report');
    if (!container) return;

    if (!report) {
      container.innerHTML = '<p class="empty-state">Relatório indisponível.</p>';
      return;
    }

    const totalLogins = report.totalLogins !== undefined ? report.totalLogins : (report.total !== undefined ? report.total : 0);
    const weakList = report.weak || [];
    const reusedList = report.reused || [];
    const oldList = report.old || [];

    let weakHtml = '';
    if (weakList.length > 0) {
      weakHtml = weakList.map(item => {
        const strLabel = item.strength ? item.strength.label : (window.passwordGenerator ? window.passwordGenerator.calculateStrength(item.login?.password || '').label : 'Fraca');
        return `
        <div class="health-item">
          <div class="health-item-info">
            <span class="health-item-name">${window.utils.escapeHtml(item.name)}</span>
            <span class="health-item-desc">Força: ${strLabel}</span>
          </div>
          <button type="button" class="btn btn-secondary btn-sm btn-health-edit" data-id="${item.id}">
            <i class="fas fa-edit"></i> Alterar
          </button>
        </div>
      `;
      }).join('');
    } else {
      weakHtml = '<p style="color:var(--success); font-size:0.9rem;"><i class="fas fa-check-circle"></i> Nenhuma senha fraca encontrada!</p>';
    }

    let reusedHtml = '';
    if (reusedList.length > 0) {
      reusedHtml = reusedList.map(item => `
        <div class="health-item">
          <div class="health-item-info">
            <span class="health-item-name">${window.utils.escapeHtml(item.name)}</span>
            <span class="health-item-desc">Reutilizada em ${item.count || 2} itens</span>
          </div>
          <button type="button" class="btn btn-secondary btn-sm btn-health-edit" data-id="${item.id}">
            <i class="fas fa-edit"></i> Alterar
          </button>
        </div>
      `).join('');
    } else {
      reusedHtml = '<p style="color:var(--success); font-size:0.9rem;"><i class="fas fa-check-circle"></i> Nenhuma senha reutilizada detectada!</p>';
    }

    let oldHtml = '';
    if (oldList.length > 0) {
      oldHtml = oldList.map(item => `
        <div class="health-item">
          <div class="health-item-info">
            <span class="health-item-name">${window.utils.escapeHtml(item.name)}</span>
            <span class="health-item-desc">Modificada ${window.utils.timeAgo ? window.utils.timeAgo(item.updatedAt) : 'há mais de 90 dias'}</span>
          </div>
          <button type="button" class="btn btn-secondary btn-sm btn-health-edit" data-id="${item.id}">
            <i class="fas fa-edit"></i> Alterar
          </button>
        </div>
      `).join('');
    } else {
      oldHtml = '<p style="color:var(--success); font-size:0.9rem;"><i class="fas fa-check-circle"></i> Todas as suas senhas estão atualizadas!</p>';
    }

    container.innerHTML = `
      <div class="health-stats-grid">
        <div class="health-stat-card stat-total">
          <div class="health-stat-value">${totalLogins}</div>
          <div class="health-stat-label">Total de Logins</div>
        </div>
        <div class="health-stat-card stat-weak">
          <div class="health-stat-value" style="color:var(--danger);">${weakList.length}</div>
          <div class="health-stat-label">Senhas Fracas</div>
        </div>
        <div class="health-stat-card stat-reused">
          <div class="health-stat-value" style="color:var(--warning);">${reusedList.length}</div>
          <div class="health-stat-label">Reutilizadas</div>
        </div>
        <div class="health-stat-card stat-old">
          <div class="health-stat-value" style="color:#ecc94b;">${oldList.length}</div>
          <div class="health-stat-label">Antigas (>90d)</div>
        </div>
      </div>

      <div class="health-section">
        <div class="health-section-header">
          <h4><i class="fas fa-triangle-exclamation" style="color:var(--danger);"></i> Senhas Fracas (${weakList.length})</h4>
        </div>
        <div class="health-item-list">${weakHtml}</div>
      </div>

      <div class="health-section">
        <div class="health-section-header">
          <h4><i class="fas fa-clone" style="color:var(--warning);"></i> Senhas Reutilizadas (${reusedList.length})</h4>
        </div>
        <div class="health-item-list">${reusedHtml}</div>
      </div>

      <div class="health-section">
        <div class="health-section-header">
          <h4><i class="fas fa-calendar-xmark" style="color:#ecc94b;"></i> Senhas Antigas (${oldList.length})</h4>
        </div>
        <div class="health-item-list">${oldHtml}</div>
      </div>
    `;

    // Wire edit buttons in health modal
    container.querySelectorAll('.btn-health-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.closeModal('health-modal');
        if (window.app) window.app.openEditItem(id);
      });
    });
  },

  /**
   * Render generator result and strength in generator modal
   * @param {string} password 
   */
  updateGeneratorDisplay(password) {
    const passwordEl = document.getElementById('generated-password');
    if (passwordEl) passwordEl.textContent = password || '';

    if (window.passwordGenerator && typeof window.passwordGenerator.calculateStrength === 'function') {
      const strength = window.passwordGenerator.calculateStrength(password || '');
      this.updateStrengthBar('gen-strength', strength);
      const labelEl = document.getElementById('gen-strength-label');
      if (labelEl) labelEl.textContent = strength.label;
    }
  },

  /**
   * Update a strength bar element
   * @param {string} barId 
   * @param {Object} strength 
   */
  updateStrengthBar(barId, strength) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    const fill = bar.querySelector('.strength-fill');
    if (!fill) return;

    fill.style.width = (strength.percentage || 0) + '%';
    const colors = ['#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#22543d'];
    const score = typeof strength.score === 'number' ? strength.score : 0;
    fill.style.backgroundColor = colors[score] || colors[0];
    bar.setAttribute('data-score', score);
  },

  /**
   * Show screen (auth or main)
   * @param {string} screenId 
   */
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
  },

  /**
   * Show auth view (login, register, lock)
   * @param {string} viewId 
   */
  showAuthView(viewId) {
    document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
  },

  /**
   * Get FontAwesome icon class for an item type
   * @param {string} type 
   * @returns {string}
   */
  getTypeIcon(type) {
    const icons = {
      login: 'fa-globe',
      note: 'fa-sticky-note',
      card: 'fa-credit-card',
      identity: 'fa-id-card'
    };
    return icons[type] || 'fa-globe';
  },

  /**
   * Get brand accent color for an item type
   * @param {string} type 
   * @returns {string}
   */
  getTypeColor(type) {
    const colors = {
      login: '#175DDC',
      note: '#38a169',
      card: '#d69e2e',
      identity: '#805ad5'
    };
    return colors[type] || '#175DDC';
  },

  /**
   * Get item type label in Portuguese
   * @param {string} type 
   * @returns {string}
   */
  getTypeLabel(type) {
    const labels = {
      login: 'Login',
      note: 'Nota Segura',
      card: 'Cartão',
      identity: 'Identidade'
    };
    return labels[type] || type;
  },

  /**
   * Get item subtitle based on type
   * @param {Object} item 
   * @returns {string}
   */
  getItemSubtitle(item) {
    if (!item) return '';
    switch (item.type) {
      case 'login':
        return item.login?.username || item.login?.uri || '';
      case 'card': {
        const holder = item.card?.cardholderName;
        const num = (item.card?.number || '').slice(-4);
        if (holder && num) return `${holder} •••• ${num}`;
        if (holder) return holder;
        if (num) return `•••• ${num}`;
        return '';
      }
      case 'identity':
        return `${item.identity?.firstName || ''} ${item.identity?.lastName || ''}`.trim() || item.identity?.email || '';
      case 'note': {
        const content = item.note?.content || '';
        return content.length > 50 ? content.substring(0, 50) + '...' : content;
      }
      default:
        return '';
    }
  }
};

window.ui = UI;
