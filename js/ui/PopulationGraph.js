import { eventBus } from '../core/eventBus.js';

const SERIES = [
  { key: 'herbivore', color: '#f0d040', label: 'Herbivore' },
  { key: 'predator',  color: '#d04040', label: 'Predator'  },
  { key: 'human',     color: '#e0a060', label: 'Human'     },
  { key: 'plant',     color: '#50c040', label: 'Plant'      },
];

export class PopulationGraph {
  constructor(canvasId, history) {
    this.canvas  = document.getElementById(canvasId);
    this.ctx     = this.canvas?.getContext('2d');
    this.history = history;
    this._frame  = 0;

    eventBus.on('sim:tick', () => {
      this._frame++;
      // Redraw every 5 ticks — the graph changes slowly
      if (this._frame % 5 === 0) this._draw();
    });
  }

  _draw() {
    if (!this.ctx) return;
    const { canvas, ctx, history } = this;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    const len = history.length;
    if (len < 2) return;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth   = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (H / 4) * i;
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

    // Draw each series
    for (const s of SERIES) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();

      for (let i = 0; i < len; i++) {
        const idx = (history.head - len + i + 200) % 200;
        const v   = history[s.key][idx];
        const sx  = (i / (len - 1)) * W;
        const sy  = H - (v / maxVal) * (H - 4) - 2;
        i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Legend (bottom-left, tiny)
    ctx.font      = '8px monospace';
    ctx.textAlign = 'left';
    SERIES.forEach((s, i) => {
      ctx.fillStyle = s.color;
      ctx.fillText(s.label[0], 3 + i * 14, H - 3);
    });
  }
}
