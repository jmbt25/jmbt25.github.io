/**
 * Toaster — small ephemeral notifications surfaced in the top-right of the
 * canvas. Subscribes to interesting sim events (births of special creatures,
 * tribe lifecycle, war/peace) and shows a short message for each.
 *
 * Toasts are throttled so the screen never floods, and identical messages
 * within the throttle window are coalesced.
 */
import { eventBus } from '../core/eventBus.js';
import { TYPE, JOSHUA_NAME } from '../core/constants.js';

const TOAST_LIFETIME_MS = 4200;
const MAX_TOASTS        = 4;
const SAME_KEY_THROTTLE = 1500;   // suppress identical messages within this window

export class Toaster {
  constructor(civ, hostId = 'toast-host') {
    this.civ = civ;
    this.host = document.getElementById(hostId);
    this._lastByKey = new Map();
    this._knownTribes = new Set();
    this._warPairs = new Set();      // "minId|maxId" for currently-known wars
    this._primed = false;            // suppresses the first scan to avoid

    if (!this.host) return;

    // Pre-seed known state so existing tribes/wars don't all toast at boot.
    if (this.civ) {
      for (const t of this.civ.tribes.values()) {
        this._knownTribes.add(t.id);
        for (const eid of t.enemies) {
          const a = Math.min(t.id, eid);
          const b = Math.max(t.id, eid);
          this._warPairs.add(`${a}|${b}`);
        }
      }
    }

    eventBus.on('entity:born', ({ entity, parent }) => {
      this._onBorn(entity, parent);
    });

    // Track tribe roster changes by polling on each tick (cheap — civ.tribes is small)
    eventBus.on('sim:tick', () => this._scanCiv());
  }

  show(message, opts = {}) {
    if (!this.host) return;
    const key = opts.key ?? message;
    const last = this._lastByKey.get(key) ?? 0;
    const now = performance.now();
    if (now - last < SAME_KEY_THROTTLE) return;
    this._lastByKey.set(key, now);

    const node = document.createElement('div');
    node.className = 'toast' + (opts.kind ? ` toast-${opts.kind}` : '');
    node.innerHTML = `
      <div class="toast-icon">${opts.icon ?? 'ℹ️'}</div>
      <div class="toast-msg">${message}</div>
    `;
    this.host.prepend(node);

    while (this.host.children.length > MAX_TOASTS) {
      this.host.removeChild(this.host.lastChild);
    }

    setTimeout(() => {
      node.classList.add('fade-out');
      setTimeout(() => node.remove(), 350);
    }, TOAST_LIFETIME_MS);
  }

  _onBorn(entity, parent) {
    if (entity.type === TYPE.HUMAN && entity.name === JOSHUA_NAME && entity.skill) {
      const inherited = parent?.name === JOSHUA_NAME;
      const kind = inherited ? 'born to a Joshua' : 'spontaneously emerged';
      this.show(
        `<b>Joshua</b> ${kind} — <em>${entity.skill.name}</em>`,
        { kind: 'skill', icon: '◆', key: `joshua-${entity.skill.id}-${inherited ? 'inh' : 'spo'}` },
      );
    } else if (entity.trait && (entity.type === TYPE.PREDATOR || entity.type === TYPE.HUMAN)) {
      // Only annouce traits for the more notable creatures
      this.show(
        `<b>${this._typeLabel(entity.type)}</b> with <em>${entity.trait.name}</em> appeared`,
        { kind: 'trait', icon: '★', key: `trait-${entity.type}-${entity.trait.id}` },
      );
    }
  }

  _scanCiv() {
    if (!this.civ) return;

    const seen = new Set();
    for (const t of this.civ.tribes.values()) {
      seen.add(t.id);
      if (!this._knownTribes.has(t.id)) {
        this._knownTribes.add(t.id);
        this.show(
          `Tribe <b style="color:${t.color}">${t.name}</b> founded`,
          { kind: 'tribe', icon: '⚑', key: `found-${t.id}` },
        );
      }
    }
    // Removed tribes (extinct)
    for (const id of this._knownTribes) {
      if (!seen.has(id)) {
        this._knownTribes.delete(id);
      }
    }

    // War pairs
    const currentPairs = new Set();
    for (const t of this.civ.tribes.values()) {
      for (const eid of t.enemies) {
        const a = Math.min(t.id, eid);
        const b = Math.max(t.id, eid);
        currentPairs.add(`${a}|${b}`);
      }
    }
    for (const pair of currentPairs) {
      if (!this._warPairs.has(pair)) {
        const [aid, bid] = pair.split('|').map(Number);
        const a = this.civ.getTribe(aid);
        const b = this.civ.getTribe(bid);
        if (a && b) {
          this.show(
            `<b style="color:${a.color}">${a.name}</b> declared war on <b style="color:${b.color}">${b.name}</b>`,
            { kind: 'war', icon: '⚔', key: `war-${pair}` },
          );
        }
      }
    }
    for (const pair of this._warPairs) {
      if (!currentPairs.has(pair)) {
        const [aid, bid] = pair.split('|').map(Number);
        const a = this.civ.getTribe(aid);
        const b = this.civ.getTribe(bid);
        if (a && b) {
          this.show(
            `<b style="color:${a.color}">${a.name}</b> and <b style="color:${b.color}">${b.name}</b> made peace`,
            { kind: 'peace', icon: '☮', key: `peace-${pair}` },
          );
        }
      }
    }
    this._warPairs = currentPairs;
  }

  _typeLabel(t) {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  reset() {
    this._knownTribes.clear();
    this._warPairs.clear();
    this._lastByKey.clear();
    if (this.host) this.host.innerHTML = '';
    if (this.civ) {
      for (const t of this.civ.tribes.values()) {
        this._knownTribes.add(t.id);
      }
    }
  }
}
