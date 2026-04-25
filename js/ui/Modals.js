/**
 * Modals — handles the welcome screen + help/controls panel.
 * Both are static DOM elements; this just wires open/close behaviour.
 *
 * The welcome modal is shown on first load (and persists "seen" state in
 * localStorage so returning visitors aren't re-greeted).
 */
const SEEN_KEY = 'mw.seen.welcome.v2';

export class Modals {
  constructor() {
    this.welcome = document.getElementById('welcome-modal');
    this.help    = document.getElementById('help-modal');

    this._bindWelcome();
    this._bindHelp();
    this._bindGlobalKeys();

    if (this._hasSeenWelcome()) {
      this._close(this.welcome);
    }
  }

  _hasSeenWelcome() {
    try { return !!localStorage.getItem(SEEN_KEY); }
    catch { return false; }
  }
  _markWelcomeSeen() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
  }

  _bindWelcome() {
    if (!this.welcome) return;
    document.getElementById('btn-start')?.addEventListener('click', () => {
      this._markWelcomeSeen();
      this._close(this.welcome);
    });
    document.getElementById('btn-welcome-help')?.addEventListener('click', () => {
      this._markWelcomeSeen();
      this._close(this.welcome);
      this._open(this.help);
    });
  }

  _bindHelp() {
    if (!this.help) return;
    this.help.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', () => this._close(this.help));
    });
    document.getElementById('btn-help')?.addEventListener('click', () => {
      this.toggle(this.help);
    });
  }

  _bindGlobalKeys() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this._close(this.help);
        this._close(this.welcome);
      }
    });
  }

  toggle(host) {
    if (!host) return;
    if (host.dataset.open === 'true') this._close(host);
    else this._open(host);
  }

  _open(host) {
    if (!host) return;
    host.dataset.open = 'true';
  }

  _close(host) {
    if (!host) return;
    host.dataset.open = 'false';
    host.style.display = '';
  }
}
