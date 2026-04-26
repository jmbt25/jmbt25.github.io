/**
 * MomentOverlay — cinematic captions + vignette + attribution badge for
 * Thronglet awareness events. The whole point of this component is making
 * every screenshot self-explanatory: a frame of "guy turning toward camera"
 * isn't a story, but a frame of "Joshua is watching you. He will not move."
 * with a black subtitle bar IS a story.
 *
 * Subscribes to:
 *   - thronglet:moment   → display a subtitle for `durationMs`
 *                          (with optional speaker name, optional vignette)
 *   - thronglet:stage    → show / update the bottom-right attribution badge
 *
 * Pure DOM. The canvas is WebGL but DOM elements stack over it cleanly and
 * are captured by every screenshot tool, which is exactly what we want.
 */
import { eventBus } from '../core/eventBus.js';

const DEFAULT_DURATION_MS = 4500;
const QUEUE_GAP_MS        = 350;

export class MomentOverlay {
  constructor() {
    this.subEl     = document.getElementById('moment-subtitle');
    this.subText   = document.getElementById('moment-sub-text');
    this.subSpeaker = document.getElementById('moment-sub-speaker');
    this.vignette  = document.getElementById('moment-vignette');
    this.attrEl    = document.getElementById('moment-attribution');
    this.attrStage = document.getElementById('moment-attr-stage');

    this._queue = [];
    this._showing = false;
    this._hideTimer = null;
    this._vignetteTimer = null;

    eventBus.on('thronglet:moment', (data) => this._enqueue(data));
    eventBus.on('thronglet:stage',  ({ stage }) => this._setStage(stage));
  }

  _setStage(stage) {
    if (!this.attrEl || !this.attrStage) return;
    if (stage > 0) {
      this.attrStage.textContent = `stage ${stage}`;
      this.attrEl.classList.add('visible');
    } else {
      this.attrEl.classList.remove('visible');
    }
  }

  /**
   * Queue a subtitle.
   * @param {object} data
   * @param {string} data.text      — subtitle body. Supports <b> for emphasis.
   * @param {string} [data.speaker] — name displayed above the subtitle in caps.
   * @param {number} [data.durationMs]
   * @param {boolean} [data.vignette] — if true, dims edges while showing.
   */
  _enqueue(data) {
    if (!data?.text) return;
    this._queue.push(data);
    if (!this._showing) this._next();
  }

  _next() {
    const data = this._queue.shift();
    if (!data) { this._showing = false; return; }
    this._showing = true;
    this._show(data);
    const dur = data.durationMs ?? DEFAULT_DURATION_MS;
    clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => {
      this._hide();
      setTimeout(() => this._next(), QUEUE_GAP_MS);
    }, dur);
  }

  _show({ text, speaker, vignette }) {
    if (!this.subEl) return;
    this.subSpeaker.textContent = speaker ?? '';
    this.subText.innerHTML = text;
    this.subEl.classList.add('visible');
    if (vignette && this.vignette) {
      this.vignette.classList.add('active');
      // Hold the vignette slightly longer than the subtitle for atmosphere
      clearTimeout(this._vignetteTimer);
      this._vignetteTimer = setTimeout(() => {
        this.vignette.classList.remove('active');
      }, (DEFAULT_DURATION_MS + 1500));
    }
  }

  _hide() {
    if (!this.subEl) return;
    this.subEl.classList.remove('visible');
  }

  /** Wipe queue and any active subtitle/vignette. Used by world reset. */
  reset() {
    this._queue.length = 0;
    this._showing = false;
    clearTimeout(this._hideTimer);
    clearTimeout(this._vignetteTimer);
    this._hide();
    this.vignette?.classList.remove('active');
    this.attrEl?.classList.remove('visible');
  }
}
