/**
 * Vaultwarden Replica - Utility Functions
 * Helper methods for formatting, masking, DOM toasts, debounce, and clipboard interactions.
 */

const Utils = {
  /**
   * Generate UUID v4.
   * @returns {string} UUID string.
   */
  generateId() {
    return crypto.randomUUID();
  },

  /**
   * Format ISO date string to Brazilian format: 'DD/MM/YYYY HH:mm'.
   * @param {string} isoString - ISO date representation.
   * @returns {string} Formatted date string or empty string if invalid.
   */
  formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  },

  /**
   * Format relative time in Portuguese (e.g., 'há 5 minutos', 'há 2 dias').
   * @param {string} isoString - ISO date representation.
   * @returns {string} Relative time string.
   */
  timeAgo(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 0) return 'agora mesmo';
    if (seconds < 60) return 'há poucos segundos';

    const minutes = Math.floor(seconds / 60);
    if (minutes === 1) return 'há 1 minuto';
    if (minutes < 60) return `há ${minutes} minutos`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return 'há 1 hora';
    if (hours < 24) return `há ${hours} horas`;

    const days = Math.floor(hours / 24);
    if (days === 1) return 'há 1 dia';
    if (days < 30) return `há ${days} dias`;

    const months = Math.floor(days / 30);
    if (months === 1) return 'há 1 mês';
    if (months < 12) return `há ${months} meses`;

    const years = Math.floor(days / 365);
    if (years === 1) return 'há 1 ano';
    return `há ${years} anos`;
  },

  /**
   * Debounce function execution.
   * @param {Function} fn - Target function.
   * @param {number} [ms=300] - Delay in milliseconds.
   * @returns {Function} Debounced function.
   */
  debounce(fn, ms = 300) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), ms);
    };
  },

  /**
   * Copy text to clipboard with modern API and fallback support.
   * @param {string} text - Text to copy.
   * @returns {Promise<boolean>} True if successful.
   */
  async copyToClipboard(text) {
    if (text === null || text === undefined) return false;
    const str = String(text);

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(str);
        return true;
      } catch (err) {
        // Fall back to legacy execCommand below
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = str;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let successful = false;
    try {
      successful = document.execCommand('copy');
    } catch (e) {
      successful = false;
    }
    document.body.removeChild(textarea);
    return successful;
  },

  /**
   * Show toast notification inside #toast-container.
   * Creates #toast-container if not present.
   * @param {string} message - Notification message.
   * @param {'success'|'error'|'info'|'warning'} [type='info'] - Notification type.
   */
  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${this.getToastIcon(type)}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('toast-show'), 10);
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  /**
   * Return symbol icon for toast notification type.
   * @param {'success'|'error'|'info'|'warning'} type - Toast type.
   * @returns {string} Icon character.
   */
  getToastIcon(type) {
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    return icons[type] || icons.info;
  },

  /**
   * Escape HTML special characters to prevent XSS.
   * @param {string} str - Raw input string.
   * @returns {string} Escaped HTML string.
   */
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Mask a string showing only first/last characters.
   * Example: 'password' -> 'pa****rd'
   * @param {string} str - String to mask.
   * @param {number} [showFirst=2] - Number of characters to show at start.
   * @param {number} [showLast=2] - Number of characters to show at end.
   * @returns {string} Masked string.
   */
  maskString(str, showFirst = 2, showLast = 2) {
    if (str === null || str === undefined) return '';
    const text = String(str);
    const len = text.length;
    if (len <= showFirst + showLast) {
      return '*'.repeat(len);
    }
    const first = text.substring(0, showFirst);
    const last = text.substring(len - showLast);
    const masked = '*'.repeat(len - showFirst - showLast);
    return `${first}${masked}${last}`;
  },

  /**
   * Mask credit card number: '**** **** **** 1234'.
   * @param {string} num - Card number.
   * @returns {string} Masked card representation.
   */
  maskCardNumber(num) {
    if (num === null || num === undefined) return '';
    const cleaned = String(num).replace(/\D/g, '');
    if (cleaned.length < 4) {
      return '*'.repeat(cleaned.length || 4);
    }
    const last4 = cleaned.slice(-4);
    return `**** **** **** ${last4}`;
  }
};

window.utils = Utils;
