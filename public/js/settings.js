/**
 * Settings Manager Module
 * 
 * Self-contained settings UI component that injects a gear button and
 * an animated popup panel into the DOM. Currently supports background
 * music mute/unmute; designed for easy extension with future settings
 * (SFX toggle, theme selection, language, notifications).
 */
export const SettingsManager = {
  /** @type {import('./audio.js').AudioManager|null} */
  _audio: null,
  _panelOpen: false,
  _btnEl: null,
  _panelEl: null,
  _backdropEl: null,
  _currentScreen: 'home',

  // ───────────────────── Public API ─────────────────────

  /**
   * Initialise the settings system. Call once after AudioManager.init().
   * @param {object} audioManager — reference to the AudioManager singleton
   */
  init(audioManager) {
    this._audio = audioManager;
    this._createDOM();
    this._bindEvents();
    this.repositionForScreen('home');
  },

  /**
   * Reposition the settings button for the active screen.
   * @param {'home'|'lobby'|'game'|'matchEnd'} screenName
   */
  repositionForScreen(screenName) {
    this._currentScreen = screenName;
    const btn = this._btnEl;
    if (!btn) return;

    // Reset any inline positioning
    btn.style.position = 'fixed';
    btn.style.bottom = '';
    btn.style.right = '';

    if (screenName === 'game') {
      // Position just above the chat panel with ~16px gap, clamped to viewport
      const chatPanel = document.querySelector('.chat-panel');
      if (chatPanel) {
        const chatRect = chatPanel.getBoundingClientRect();
        const btnHeight = btn.offsetHeight || 42;
        const gap = 16; // spacing between button bottom and chat top
        const minTop = 14; // never clip against viewport top
        const idealTop = chatRect.top - btnHeight - gap;
        btn.style.position = 'fixed';
        btn.style.top = Math.max(idealTop, minTop) + 'px';
        btn.style.left = chatRect.left + 'px';
      } else {
        btn.style.top = '16px';
        btn.style.left = '16px';
      }
    } else {
      // Home, Lobby, Match End — top-left corner
      btn.style.top = '16px';
      btn.style.left = '16px';
    }
  },

  // ───────────────────── DOM Creation ─────────────────────

  _createDOM() {
    // ── Settings Button ──
    const btn = document.createElement('button');
    btn.id = 'settings-btn';
    btn.className = 'settings-btn';
    btn.setAttribute('aria-label', 'Settings');
    btn.innerHTML = '⚙️';
    btn.type = 'button';
    document.body.appendChild(btn);
    this._btnEl = btn;

    // ── Invisible backdrop for click-outside ──
    const backdrop = document.createElement('div');
    backdrop.id = 'settings-backdrop';
    backdrop.className = 'settings-backdrop';
    document.body.appendChild(backdrop);
    this._backdropEl = backdrop;

    // ── Settings Panel ──
    const panel = document.createElement('div');
    panel.id = 'settings-panel';
    panel.className = 'settings-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Settings');

    // Panel header
    const header = document.createElement('div');
    header.className = 'settings-panel-header';
    header.innerHTML = `
      <span class="settings-panel-title">SETTINGS</span>
      <button class="settings-panel-close" aria-label="Close settings">&times;</button>
    `;
    panel.appendChild(header);

    // Divider
    const divider = document.createElement('div');
    divider.className = 'settings-panel-divider';
    panel.appendChild(divider);

    // ── Music Row ──
    const isMuted = this._audio?.bgmMuted ?? false;
    const row = document.createElement('div');
    row.className = 'settings-row';
    row.id = 'settings-row-bgm';
    row.innerHTML = `
      <button class="settings-toggle-btn" id="settings-bgm-toggle" aria-label="Toggle background music">
        <span class="settings-toggle-icon" id="settings-bgm-icon">${isMuted ? '🔇' : '🔊'}</span>
      </button>
      <span class="settings-toggle-label" id="settings-bgm-label">${isMuted ? 'Muted' : 'Music On'}</span>
    `;
    panel.appendChild(row);

    document.body.appendChild(panel);
    this._panelEl = panel;
  },

  // ───────────────────── Event Binding ─────────────────────

  _bindEvents() {
    // Toggle panel on gear click
    this._btnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this._panelOpen) {
        this._closePanel();
      } else {
        this._openPanel();
      }
    });

    // Close on backdrop click
    this._backdropEl.addEventListener('click', () => {
      this._closePanel();
    });

    // Close button inside panel
    this._panelEl.querySelector('.settings-panel-close')?.addEventListener('click', () => {
      this._closePanel();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._panelOpen) {
        this._closePanel();
      }
    });

    // BGM toggle
    document.getElementById('settings-bgm-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleBGM();
    });
  },

  // ───────────────────── Panel Open / Close ─────────────────────

  _openPanel() {
    if (this._panelOpen) return;
    this._panelOpen = true;

    const panel = this._panelEl;
    const btn = this._btnEl;
    const backdrop = this._backdropEl;

    // Position panel below the button
    const btnRect = btn.getBoundingClientRect();
    panel.style.top = (btnRect.bottom + 8) + 'px';
    panel.style.left = btnRect.left + 'px';

    backdrop.classList.add('visible');
    panel.classList.add('open');
    btn.classList.add('active');
  },

  _closePanel() {
    if (!this._panelOpen) return;
    this._panelOpen = false;

    this._backdropEl.classList.remove('visible');
    this._panelEl.classList.remove('open');
    this._btnEl.classList.remove('active');
  },

  // ───────────────────── BGM Toggle ─────────────────────

  _toggleBGM() {
    if (!this._audio) return;

    const iconEl = document.getElementById('settings-bgm-icon');
    const labelEl = document.getElementById('settings-bgm-label');

    if (this._audio.bgmMuted) {
      this._audio.unmuteBGM();
      if (iconEl) iconEl.textContent = '🔊';
      if (labelEl) labelEl.textContent = 'Music On';
    } else {
      this._audio.muteBGM();
      if (iconEl) iconEl.textContent = '🔇';
      if (labelEl) labelEl.textContent = 'Muted';
    }
  }
};
