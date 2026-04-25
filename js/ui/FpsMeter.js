/**
 * FpsMeter — samples requestAnimationFrame to compute a smoothed FPS value.
 * Updates a DOM node every ~500ms so the readout doesn't flicker.
 */
export class FpsMeter {
  constructor(elementId = 'stat-fps', updateMs = 500) {
    this.el = document.getElementById(elementId);
    this._frames = 0;
    this._last = performance.now();
    this._updateMs = updateMs;
    this._smooth = 60;
  }

  tick() {
    this._frames++;
    const now = performance.now();
    const dt = now - this._last;
    if (dt >= this._updateMs) {
      const fps = (this._frames * 1000) / dt;
      this._smooth = this._smooth * 0.5 + fps * 0.5;
      if (this.el) this.el.textContent = Math.round(this._smooth);
      this._frames = 0;
      this._last = now;
    }
  }
}
