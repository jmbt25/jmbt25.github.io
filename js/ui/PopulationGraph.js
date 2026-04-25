import { eventBus } from '../core/eventBus.js';

const SERIES = [
  { key: 'plant',     color: '#65d34d', label: 'Plant',     fill: 'rgba(101,211,77,0.18)' },
  { key: 'herbivore', color: '#f5d550', label: 'Herbivore', fill: 'rgba(245,213,80,0.18)' },
  { key: 'predator',  color: '#e15252', label: 'Predator',  fill: 'rgba(225,82,82,0.18)' },
  { key: 'human',     color: '#ec9b5a', label: 'Human',     fill: 'rgba(236,155,90,0.18)' },
];

export class PopulationGraph {
  constructor(canvasId, history) {
    this.canvas  = document.getElementById(canvasId);
    this.ctx     = this.canvas?.getContext('2d');
    this.history = history;
    this._frame  = 0;

    this._resizeForDpr();
    window.addEventListener('resize', () => this._resizeForDpr());

    eventBus.on('sim:tick', () => {
      this._frame++;
      if (this._frame % 5 === 0) this._draw();
    });
    this._draw();
  }

  _resizeForDpr() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = this.canvas.clientWidth || 220;
    const cssH = this.canvas.clientHeight || 84;
    this.canvas.width  = cssW * dpr;
    this.canvas.height = cssH * dpr;
    if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._cssW = cssW;
    this._cssH = cssH;
  }

  _draw() {
    if (!this.ctx) return;
    const { ctx, history } = this;
    const W = this._cssW, H = this._cssH;

    ctx.clearRect(0, 0, W, H);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#080d18');
    bg.addColorStop(1, '#040810');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const len = history.length;
    if (len < 2) {
      ctx.fillStyle = '#4a5670';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('gathering data…', W / 2, H / 2 + 3);
      return;
    }

    // Subtle grid
    ctx.strokeStyle = 'rgba(120,150,200,0.06)';
    ctx.lineWidth   = 1;
    for (let i = 1; i <= 3; i++) {
      const y = (H / 4) * i + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Find overall max for normalisation (shared Y-axis)
    let maxVal = 1;
    for (const s of SERIES) {
      for (let i = 0; i < len; i++) {
        const idx = (history.head - len + i + 200) % 200;
        const v   = history[s.key][idx];
        if (v > maxVal) maxVal = v;
      }
    }

    // Draw filled areas under each series (back to front so plants don't hide humans)
    for (let si = SERIES.length - 1; si >= 0; si--) {
      const s = SERIES[si];
      ctx.fillStyle   = s.fill;
      ctx.strokeStyle = s.color;
      ctx.lineWidth   = 1.5;

      // Filled area
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let i = 0; i < len; i++) {
        const idx = (history.head - len + i + 200) % 200;
        const v   = history[s.key][idx];
        const sx  = (i / (len - 1)) * W;
        const sy  = H - (v / maxVal) * (H - 6) - 2;
        ctx.lineTo(sx, sy);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      // Line on top
      ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const idx = (history.head - len + i + 200) % 200;
        const v   = history[s.key][idx];
        const sx  = (i / (len - 1)) * W;
        const sy  = H - (v / maxVal) * (H - 6) - 2;
        i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Latest values, top-right
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    let yy = 11;
    const latestIdx = (history.head - 1 + 200) % 200;
    for (const s of SERIES) {
      const v = history[s.key][latestIdx];
      ctx.fillStyle = s.color;
      ctx.fillText(`${s.label[0]} ${v}`, W - 4, yy);
      yy += 11;
    }

    // Border
    ctx.strokeStyle = 'rgba(120,150,200,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }
}
