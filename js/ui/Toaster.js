/**
 * Toaster — populates the top-right event-log panel with timestamped story
 * events, formatted to match the reference mockup:
 *
 *   18:42  ORANGE TRIBE
 *          BUILT A HUT
 *
 * The first line is the actor (tribe name in tribe color, or "THE WORLD"),
 * the second line is the action in dimmer text. Newest on top.
 */
import { eventBus } from '../core/eventBus.js';
import { TYPE } from '../core/constants.js';

const MAX_LOG_ROWS      = 4;
const SAME_KEY_THROTTLE = 1500;

const TRIBE_COLOR_CLASS = (hex) => {
  // Map known tribe palette colors to CSS classes for color-coding.
  const h = (hex || '').toLowerCase();
  if (h.startsWith('#d8845f') || h.startsWith('#e0a870') || h.startsWith('#d8c95f')) return 'orange';
  if (h.startsWith('#a06fd8')) return 'violet';
  if (h.startsWith('#5fb6d8') || h.startsWith('#5fd896')) return 'teal';
  return 'cyan';
};

export class Toaster {
  constructor(civ, hostId = 'event-log') {
    this.civ = civ;
    this.host = document.getElementById(hostId);
    this._lastByKey = new Map();
    this._knownTribes = new Set();
    this._warPairs = new Set();
    this._knownHuts = new Set();

    if (!this.host) return;

    if (this.civ) {
      for (const t of this.civ.tribes.values()) {
        this._knownTribes.add(t.id);
        for (const eid of t.enemies) {
          this._warPairs.add(`${Math.min(t.id, eid)}|${Math.max(t.id, eid)}`);
        }
      }
    }

    eventBus.on('entity:born', ({ entity, parent, builder }) => {
      this._onBorn(entity, parent, builder);
    });

    eventBus.on('thronglet:stage', ({ stage }) => {
      if (stage >= 1) {
        this.show({
          actor: 'THE WORLD',
          action: 'LOOKS BACK',
          actorClass: 'cyan',
          key: `thr-stage-${stage}`,
        });
      }
    });

    eventBus.on('world:migration', ({ type, count }) => {
      this.show({
        actor: type === TYPE.HUMAN ? 'TRAVELLERS' : 'PREDATORS',
        action: `${count} ARRIVED`,
        actorClass: 'cyan',
        key: `migrate-${type}-${count}`,
      });
    });

    eventBus.on('sim:tick', () => this._scanCiv());
  }

  show({ actor, action, actorClass = 'cyan', key }) {
    if (!this.host) return;
    const k = key ?? `${actor}|${action}`;
    const last = this._lastByKey.get(k) ?? 0;
    const now = performance.now();
    if (now - last < SAME_KEY_THROTTLE) return;
    this._lastByKey.set(k, now);

    const empty = this.host.querySelector('.event-empty');
    if (empty) empty.remove();

    const node = document.createElement('div');
    node.className = 'event-row';
    node.innerHTML = `
      <span class="event-time">${this._timestamp()}</span>
      <span class="event-body">
        <span class="ev-tribe ${actorClass}">${actor}</span>
        <span class="ev-action">${action}</span>
      </span>
    `;
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

  _onBorn(entity, parent, builder) {
    if (entity.type === TYPE.BUILDING && builder?.tribeId != null) {
      const tribe = this.civ?.getTribe(builder.tribeId);
      if (tribe) {
        this.show({
          actor: `${tribe.name.toUpperCase()} TRIBE`,
          action: 'BUILT A HUT',
          actorClass: TRIBE_COLOR_CLASS(tribe.color),
          key: `built-${tribe.id}-${this._coarseTime()}`,
        });
      }
      return;
    }
    if (entity.type === TYPE.PLANT && parent && Math.random() < 0.04) {
      const tribe = parent?.tribeId != null ? this.civ?.getTribe(parent.tribeId) : null;
      if (tribe) {
        this.show({
          actor: `${tribe.name.toUpperCase()} TRIBE`,
          action: 'GATHERED WOOD',
          actorClass: TRIBE_COLOR_CLASS(tribe.color),
          key: `gather-wood-${tribe.id}-${this._coarseTime()}`,
        });
      }
    }
    if (entity.type === TYPE.HUMAN && entity.skill) {
      this.show({
        actor: (entity.name ?? 'JOSHUA').toUpperCase(),
        action: `BORN A ${entity.skill.name.toUpperCase()}`,
        actorClass: 'cyan',
        key: `skill-${entity.skill.id}`,
      });
    }
  }

  _scanCiv() {
    if (!this.civ) return;

    const seen = new Set();
    for (const t of this.civ.tribes.values()) {
      seen.add(t.id);
      if (!this._knownTribes.has(t.id)) {
        this._knownTribes.add(t.id);
        this.show({
          actor: `${t.name.toUpperCase()} TRIBE`,
          action: 'FOUNDED',
          actorClass: TRIBE_COLOR_CLASS(t.color),
          key: `found-${t.id}`,
        });
      }
      // Surface fishing/foraging once per tribe per minute as flavor
      if (t.members.size > 0 && Math.random() < 0.0015) {
        const actions = ['DISCOVERED FISHING', 'GATHERED WOOD', 'MINED STONE', 'HUNTED PREY'];
        const action = actions[Math.floor(Math.random() * actions.length)];
        this.show({
          actor: `${t.name.toUpperCase()} TRIBE`,
          action,
          actorClass: TRIBE_COLOR_CLASS(t.color),
          key: `flavor-${t.id}-${action}-${this._coarseTime()}`,
        });
      }
    }
    for (const id of this._knownTribes) {
      if (!seen.has(id)) this._knownTribes.delete(id);
    }

    const currentPairs = new Set();
    for (const t of this.civ.tribes.values()) {
      for (const eid of t.enemies) {
        currentPairs.add(`${Math.min(t.id, eid)}|${Math.max(t.id, eid)}`);
      }
    }
    for (const pair of currentPairs) {
      if (!this._warPairs.has(pair)) {
        const [aid, bid] = pair.split('|').map(Number);
        const a = this.civ.getTribe(aid);
        const b = this.civ.getTribe(bid);
        if (a && b) {
          this.show({
            actor: `${a.name.toUpperCase()} TRIBE`,
            action: `DECLARED WAR ON ${b.name.toUpperCase()}`,
            actorClass: TRIBE_COLOR_CLASS(a.color),
            key: `war-${pair}`,
          });
        }
      }
    }
    this._warPairs = currentPairs;
  }

  _coarseTime() { return Math.floor(performance.now() / 60000); }

  reset() {
    this._knownTribes.clear();
    this._warPairs.clear();
    this._lastByKey.clear();
    if (this.host) {
      this.host.innerHTML = '<div class="event-empty">— awaiting events —</div>';
    }
    if (this.civ) {
      for (const t of this.civ.tribes.values()) this._knownTribes.add(t.id);
    }
  }
}
