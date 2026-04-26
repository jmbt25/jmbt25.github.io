/**
 * Toaster — persistent event feed in the top-right panel. Subscribes to
 * interesting sim events (special births, tribe lifecycle, war/peace,
 * Thronglet stages) and appends a timestamped row to #event-log.
 *
 * Identical messages within SAME_KEY_THROTTLE are coalesced. Old rows are
 * trimmed once MAX_LOG_ROWS is exceeded.
 */
import { eventBus } from '../core/eventBus.js';
import { TYPE } from '../core/constants.js';

const MAX_LOG_ROWS      = 12;
const SAME_KEY_THROTTLE = 1500;   // suppress identical messages within this window

export class Toaster {
  constructor(civ, hostId = 'event-log') {
    this.civ = civ;
    this.host = document.getElementById(hostId);
    this._lastByKey = new Map();
    this._knownTribes = new Set();
    this._warPairs = new Set();      // "minId|maxId" for currently-known wars

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

    // Tribe upgraded a hut to a higher tier — surface it as a story event
    eventBus.on('tribe:upgrade', ({ tribe, tier }) => {
      const label = ['', '', 'longhouse', 'grand hall'][tier] ?? `tier ${tier}`;
      this.show(
        `<b style="color:${tribe.color}">${tribe.name}</b> raised a <em>${label}</em>`,
        { kind: 'tribe', icon: tier === 3 ? '🏛' : '🏠', key: `upgrade-${tribe.id}-${tier}` },
      );
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

    // First real event clears the "awaiting events…" placeholder.
    const empty = this.host.querySelector('.event-empty');
    if (empty) empty.remove();

    const node = document.createElement('div');
    node.className = 'event-row' + (opts.kind ? ` event-${opts.kind}` : '');
    node.innerHTML = `
      <span class="event-time">${this._timestamp()}</span>
      <span class="event-icon">${opts.icon ?? '·'}</span>
      <span class="event-msg">${message}</span>
    `;
    // Newest on top
    this.host.prepend(node);

    while (this.host.children.length > MAX_LOG_ROWS) {
      this.host.removeChild(this.host.lastChild);
    }
  }

  _timestamp() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  _onBorn(entity, parent) {
    if (entity.type === TYPE.HUMAN && entity.skill) {
      const inheritedSame = parent?.skill?.id === entity.skill.id;
      const inheritedAny  = !!parent?.skill;
      const blurb = inheritedSame
        ? `inherited <em>${entity.skill.name}</em> from a parent`
        : inheritedAny
          ? `awoke as a <em>${entity.skill.name}</em>, breaking from the family line`
          : `was born a <em>${entity.skill.name}</em>`;
      this.show(
        `<b>${entity.name}</b> ${blurb}`,
        { kind: 'skill', icon: '◆', key: `skill-${entity.skill.id}-${inheritedSame ? 'same' : inheritedAny ? 'reroll' : 'spon'}` },
      );
    } else if (entity.trait && (entity.type === TYPE.PREDATOR || entity.type === TYPE.HUMAN)) {
      // Only announce traits for the more notable creatures
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
    if (this.host) {
      this.host.innerHTML = '<div class="event-empty">awaiting events…</div>';
    }
    if (this.civ) {
      for (const t of this.civ.tribes.values()) {
        this._knownTribes.add(t.id);
      }
    }
  }
}
