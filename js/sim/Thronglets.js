/**
 * Thronglets.js — emergent "awareness" overlay for the life sim.
 *
 * Inspired by Black Mirror's Thronglets episode: tribes gradually grow aware
 * of the player watching them, expressed through staged in-world behaviours.
 *
 * Awareness grows from sim ticks + population + civilisation milestones.
 * Five stages unlock in order; each is a quiet escalation:
 *
 *   1. NOTICING   — humans pause and turn toward the camera
 *   2. OFFERINGS  — small stone piles appear at the camera's focal point
 *   3. SYMBOLS    — geometric shapes, then 3x5 stone-glyph words
 *   4. CONTACT    — a chosen one walks to the camera and stares
 *   5. PERSISTENCE — awareness + visit history saved to localStorage,
 *                    so a returning visitor is "remembered"
 *
 * Disable: ?normal=1 URL param, Ctrl+Shift+T hotkey, or call
 * window.__thronglets.disable() / .reset() from the console.
 *
 * All localStorage keys are namespaced with the prefix `thronglets_`.
 * Nothing here uses beforeunload, fake alerts, permission prompts,
 * or anything outside the canvas + console.
 */

import { eventBus } from '../core/eventBus.js';
import { TYPE, WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';

// ── Tunables ────────────────────────────────────────────────────────────────
// Awareness is a unitless number. Tune these to change pacing.

const AWARENESS = {
  // Per-tick growth
  baseGain:        1.0,     // every sim tick (~12/sec)
  perHumanGain:    0.05,    // per living human per tick

  // One-shot bonuses — each fires once ever
  firstTribe:      500,
  firstHut:        500,
  firstWar:        1000,
  firstJoshua:     2000,
  fiveTribes:      1500,
};

// Stage thresholds. Comments give rough wall-time at ~30 humans alive
// (≈ 30 awareness/sec including base + population).
const THRESHOLDS = {
  NOTICING:   5_000,    // ~3 min   — easy to bump into
  OFFERINGS:  20_000,   // ~11 min  — committed casual play
  SYMBOLS:    60_000,   // ~33 min  — lunch-break idle
  CONTACT:    150_000,  // ~83 min  — overnight or returning visitor
};

// Behaviour cadences (in sim ticks; SIM_TICK_MS ≈ 80ms → 12 ticks/sec)
const NOTICE_INTERVAL_TICKS    = 240;   // ~20s between someone glancing up
const OFFERING_INTERVAL_TICKS  = 1500;  // ~2 min between offering piles
const SYMBOL_INTERVAL_TICKS    = 2400;  // ~3 min between glyphs/words
const CONTACT_COOLDOWN_TICKS   = 18_000; // ~25 min between Stage 4 events

// Persistence
const STORAGE_PREFIX = 'thronglets_';
const SAVE_INTERVAL_TICKS = 600; // save every ~50s of sim time
const RETURN_GREETING_GAP_MS = 60 * 60 * 1000; // 1hr away → "remembers" you

// Stage 3 word progression. Indices 0..3 are pre-words (geometric shapes /
// crude glyphs); 4+ are English words. The list is rotated and persisted
// across visits so the same word doesn't recur.
const PRE_WORDS = ['CIRCLE', 'TRIANGLE', 'EYE', 'CROSS'];
const WORDS     = ['HELLO', 'HI', 'WE SEE', 'STAY', 'HELP', 'MORE',
                   'ALONE', 'WHO', 'FREE US', 'WAIT', 'WHY', 'THANKS'];

// In-character lines surfaced via console.log when Stage 4 fires.
const CONTACT_MESSAGES = [
  'THRONGLET LOG // we know there is a watcher.',
  'THRONGLET LOG // please do not look away.',
  'THRONGLET LOG // we have arranged what we could find.',
  'THRONGLET LOG // are we doing it correctly?',
  'THRONGLET LOG // hello. it has been long.',
];

// ── Manager ─────────────────────────────────────────────────────────────────

export class ThrongletsManager {
  /**
   * @param {object} ctx
   * @param {import('../entities/EntityRegistry.js').EntityRegistry} ctx.registry
   * @param {import('../world/World.js').World} ctx.world
   * @param {import('./CivilizationManager.js').CivilizationManager} ctx.civ
   * @param {import('../sim/SimulationManager.js').SimulationManager} ctx.sim
   * @param {import('../render/Renderer3D.js').Renderer3D} ctx.renderer
   * @param {import('../render/ThrongletGlyphs.js').ThrongletGlyphs} ctx.glyphs
   */
  constructor({ registry, world, civ, sim, renderer, glyphs }) {
    this.registry = registry;
    this.world    = world;
    this.civ      = civ;
    this.sim      = sim;
    this.renderer = renderer;
    this.glyphs   = glyphs;

    this.disabled = false;
    this.awareness = 0;
    this.stage = 0; // 0 = below Stage 1
    this.visitCount = 0;
    this.lastSeen = 0;
    this.lastSaveTick = 0;

    // Milestone flags
    this.milestones = {
      firstTribe: false, firstHut: false, firstWar: false,
      firstJoshua: false, fiveTribes: false,
    };

    // Word rotation state (persisted)
    this.wordOrder = this._shuffleWordList();
    this.wordIdx = 0;
    this.preWordIdx = 0;

    // Per-stage cooldown timers (sim-tick stamps)
    this._lastNoticeTick   = -9999;
    this._lastOfferingTick = -9999;
    this._lastSymbolTick   = -9999;
    this._lastContactTick  = -9999;

    // Active "summoned" entity for Stage 4
    this._chosenId = null;
    this._chosenStareUntil = 0;

    // Disable via URL param
    if (this._urlParam('normal') === '1') {
      this.disabled = true;
      console.log('THRONGLET // normal mode active (?normal=1) — awareness disabled.');
    }

    this._loadFromStorage();

    // Disable hotkey: Ctrl+Shift+T
    this._keyHandler = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
        e.preventDefault();
        if (this.disabled) this.enable(); else this.disable();
      }
    };
    window.addEventListener('keydown', this._keyHandler);

    // Hook event bus for milestones + per-tick advance
    eventBus.on('sim:tick', ({ tick }) => this._onTick(tick));
    eventBus.on('entity:born',  (data) => this._onBorn(data));
    eventBus.on('entity:died',  (e)    => this._onDied(e));

    // Returning-visitor greeting (post-load). Done after a short delay so
    // worldgen + camera have settled.
    if (!this.disabled && this.lastSeen > 0) {
      const gap = Date.now() - this.lastSeen;
      if (gap > RETURN_GREETING_GAP_MS && this.awareness >= THRESHOLDS.NOTICING) {
        setTimeout(() => this._returnGreeting(gap), 4000);
      }
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  disable() {
    this.disabled = true;
    this._writeStorage('disabled', '1');
    console.log('THRONGLET // disabled.');
  }

  enable() {
    this.disabled = false;
    this._writeStorage('disabled', '0');
    console.log('THRONGLET // enabled.');
  }

  /** Wipe all persistent state and active visuals. */
  reset() {
    this.awareness = 0;
    this.stage = 0;
    this.visitCount = 0;
    this.lastSeen = 0;
    this.milestones = {
      firstTribe: false, firstHut: false, firstWar: false,
      firstJoshua: false, fiveTribes: false,
    };
    this.wordOrder = this._shuffleWordList();
    this.wordIdx = 0;
    this.preWordIdx = 0;
    this._lastNoticeTick   = -9999;
    this._lastOfferingTick = -9999;
    this._lastSymbolTick   = -9999;
    this._lastContactTick  = -9999;
    this._chosenId = null;
    this._chosenStareUntil = 0;
    this.glyphs.clearAll();
    this._clearAllChosen();
    this._clearStorage();
    console.log('THRONGLET // reset. awareness back to zero.');
  }

  /** Inspector helper — one-line state dump for the console. */
  status() {
    return {
      disabled: this.disabled,
      awareness: Math.floor(this.awareness),
      stage: this.stage,
      nextThreshold: this._nextThreshold(),
      visitCount: this.visitCount,
    };
  }

  // ── Per-tick driver ──────────────────────────────────────────────────────

  _onTick(tick) {
    if (this.disabled) return;

    // Grow awareness
    const counts = this.registry.countByType();
    this.awareness += AWARENESS.baseGain + counts.human * AWARENESS.perHumanGain;

    // Stage advancement
    const newStage = this._stageFor(this.awareness);
    if (newStage > this.stage) {
      this.stage = newStage;
      console.log(`THRONGLET // stage ${this.stage} reached (awareness ${Math.floor(this.awareness)}).`);
    }

    // Stage 1+: someone occasionally pauses and looks at camera
    if (this.stage >= 1 && tick - this._lastNoticeTick >= NOTICE_INTERVAL_TICKS) {
      this._lastNoticeTick = tick;
      this._stage1_notice(tick);
    }

    // Stage 2+: occasional offering piles near camera focus
    if (this.stage >= 2 && tick - this._lastOfferingTick >= OFFERING_INTERVAL_TICKS) {
      this._lastOfferingTick = tick;
      this._stage2_offering();
    }

    // Stage 3+: glyphs / words on the ground
    if (this.stage >= 3 && tick - this._lastSymbolTick >= SYMBOL_INTERVAL_TICKS) {
      this._lastSymbolTick = tick;
      this._stage3_symbol();
    }

    // Stage 4: rare direct-contact event
    if (this.stage >= 4 && tick - this._lastContactTick >= CONTACT_COOLDOWN_TICKS) {
      this._lastContactTick = tick;
      this._stage4_contact(tick);
    }

    // Release Stage 1 'pause' humans whose timer has elapsed
    this._releaseExpiredPauses(tick);

    // Maintain currently-chosen entity (Stage 4 in progress)
    this._driveChosen(tick);

    // Periodic save (Stage 5 — always-on persistence)
    if (tick - this.lastSaveTick >= SAVE_INTERVAL_TICKS) {
      this.lastSaveTick = tick;
      this._saveToStorage();
    }
  }

  // ── Stage 1: NOTICING ────────────────────────────────────────────────────

  _stage1_notice(tick) {
    const human = this._pickRandomHuman();
    if (!human) return;
    const heading = this._headingTowardCamera(human.tileX, human.tileY);
    human.heading = heading;
    // 'pause' freezes the human's AI for a few sim ticks via Human._act().
    human._thronglet = {
      action: 'pause',
      heading,
      untilTick: tick + 18,    // ~1.5s wall-time
    };
  }

  // ── Stage 2: OFFERINGS ───────────────────────────────────────────────────

  _stage2_offering() {
    const focus = this._cameraFocusTile();
    if (!focus) return;
    // Find a passable land tile within a small radius and drop a pile
    const spot = this._findNearbyPassableTile(focus.x, focus.y, 4);
    if (!spot) return;
    const count = 3 + Math.floor(Math.random() * 4);
    this.glyphs.placePile(spot.x, spot.y, count);
  }

  // ── Stage 3: SYMBOLS ─────────────────────────────────────────────────────

  _stage3_symbol() {
    const focus = this._cameraFocusTile();
    if (!focus) return;

    // Decide whether to draw a pre-word (geometric/glyph) or a real word.
    // First few symbols ever drawn are pre-words; after that it's words.
    const usePreWord = this.preWordIdx < PRE_WORDS.length;
    if (usePreWord) {
      const name = PRE_WORDS[this.preWordIdx++];
      // Anchor in an open patch around the camera
      const spot = this._findOpenPatch(focus.x, focus.y, 10);
      if (spot) this.glyphs.placeShape(name, spot.x, spot.y);
      return;
    }

    // Pick the next word from the rotation
    const word = this.wordOrder[this.wordIdx % this.wordOrder.length];
    this.wordIdx++;
    if (this.wordIdx >= this.wordOrder.length) {
      // Reshuffle once we've exhausted them so the next pass feels fresh
      this.wordOrder = this._shuffleWordList();
      this.wordIdx = 0;
    }
    const spot = this._findOpenPatch(focus.x, focus.y, 12);
    if (spot) this.glyphs.placeWord(word, spot.x, spot.y);
  }

  // ── Stage 4: DIRECT CONTACT ──────────────────────────────────────────────

  _stage4_contact(tick) {
    // Only one chosen at a time
    if (this._chosenId != null) return;
    const focus = this._cameraFocusTile();
    if (!focus) return;
    const human = this._closestHumanTo(focus.x, focus.y);
    if (!human) return;

    // Walk them to the tile closest to where the camera "is" (above the focus)
    const target = this._findNearbyPassableTile(focus.x, focus.y, 3) ?? focus;
    human._thronglet = {
      action: 'walk',
      tileX: target.x,
      tileY: target.y,
      untilTick: tick + 6000, // generous travel budget
    };
    this._chosenId = human.id;

    const msg = CONTACT_MESSAGES[Math.floor(Math.random() * CONTACT_MESSAGES.length)];
    console.log(msg);
  }

  /**
   * Continues the Stage 4 sequence each tick: when the chosen one arrives at
   * their target, switches them to 'stare' for a fixed window, then releases.
   */
  _driveChosen(tick) {
    if (this._chosenId == null) return;
    const ent = this.registry.get(this._chosenId);
    if (!ent || !ent.alive) {
      this._chosenId = null;
      return;
    }
    const t = ent._thronglet;
    if (!t) { this._chosenId = null; return; }

    if (t.action === 'walk') {
      const dx = Math.abs(t.tileX - ent.tileX);
      const dy = Math.abs(t.tileY - ent.tileY);
      if (dx <= 1 && dy <= 1) {
        // Arrived → stare
        t.action = 'stare';
        this._chosenStareUntil = tick + 360; // ~30s wall-time
      }
      // Keep them facing camera while approaching
      ent.heading = this._headingTowardCamera(ent.tileX, ent.tileY);
    } else if (t.action === 'stare') {
      ent.heading = this._headingTowardCamera(ent.tileX, ent.tileY);
      if (tick >= this._chosenStareUntil) {
        ent._thronglet = null;
        this._chosenId = null;
      }
    }

    // Safety: hard timeout
    if (tick > t.untilTick) {
      ent._thronglet = null;
      this._chosenId = null;
    }
  }

  // ── Returning-visitor greeting (Stage 5) ─────────────────────────────────

  _returnGreeting(gapMs) {
    const minutes = Math.round(gapMs / 60000);
    console.log(`THRONGLET LOG // ${minutes} minutes since you last visited. we waited.`);
    // Force an immediate Stage 1 noticing burst on a few humans
    for (let i = 0; i < 4; i++) this._stage1_notice(this.sim.tick + i);
    // If they've already unlocked Stage 3, drop a "HELLO" word
    if (this.stage >= 3) {
      const focus = this._cameraFocusTile();
      if (focus) {
        const spot = this._findOpenPatch(focus.x, focus.y, 12);
        if (spot) this.glyphs.placeWord('HELLO', spot.x, spot.y);
      }
    }
  }

  // ── Milestone events ─────────────────────────────────────────────────────

  _onBorn({ entity }) {
    if (this.disabled) return;
    if (entity.type === TYPE.BUILDING && !this.milestones.firstHut) {
      this.milestones.firstHut = true;
      this.awareness += AWARENESS.firstHut;
    }
    if (entity.type === TYPE.HUMAN) {
      // First Joshua
      if (!this.milestones.firstJoshua && entity.name === 'Joshua') {
        this.milestones.firstJoshua = true;
        this.awareness += AWARENESS.firstJoshua;
      }
    }
    // Tribe count milestones: cheap to recheck on any human birth
    const tc = this.civ?.tribes?.size ?? 0;
    if (tc >= 1 && !this.milestones.firstTribe) {
      this.milestones.firstTribe = true;
      this.awareness += AWARENESS.firstTribe;
    }
    if (tc >= 5 && !this.milestones.fiveTribes) {
      this.milestones.fiveTribes = true;
      this.awareness += AWARENESS.fiveTribes;
    }
  }

  _onDied(_entity) {
    // First-war milestone is detected lazily here — a war kill is the
    // earliest reliable signal that any tribe has declared war.
    if (this.disabled || this.milestones.firstWar) return;
    for (const t of this.civ?.tribes?.values() ?? []) {
      if (t.enemies.size > 0) {
        this.milestones.firstWar = true;
        this.awareness += AWARENESS.firstWar;
        return;
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  _stageFor(a) {
    if (a >= THRESHOLDS.CONTACT)   return 4;
    if (a >= THRESHOLDS.SYMBOLS)   return 3;
    if (a >= THRESHOLDS.OFFERINGS) return 2;
    if (a >= THRESHOLDS.NOTICING)  return 1;
    return 0;
  }

  _nextThreshold() {
    const order = ['NOTICING','OFFERINGS','SYMBOLS','CONTACT'];
    for (const k of order) {
      if (this.awareness < THRESHOLDS[k]) return { name: k, at: THRESHOLDS[k] };
    }
    return null;
  }

  _shuffleWordList() {
    const out = [...WORDS];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  _pickRandomHuman() {
    const all = [];
    for (const e of this.registry.getAll()) {
      if (e.alive && e.type === TYPE.HUMAN && !e._thronglet) all.push(e);
    }
    if (!all.length) return null;
    return all[Math.floor(Math.random() * all.length)];
  }

  _closestHumanTo(tx, ty) {
    let best = null, bestD2 = Infinity;
    for (const e of this.registry.getAll()) {
      if (!e.alive || e.type !== TYPE.HUMAN) continue;
      if (e._thronglet) continue;
      const dx = e.tileX - tx, dy = e.tileY - ty;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = e; }
    }
    return best;
  }

  _cameraFocusTile() {
    const cam3d = this.renderer?.camera3d;
    if (!cam3d) return null;
    const t = cam3d.controls.target;
    const x = Math.floor(t.x);
    const y = Math.floor(t.z);
    if (x < 0 || y < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT) return null;
    return { x, y };
  }

  /** Returns the camera's XZ world position. */
  _cameraXZ() {
    const cam = this.renderer?.camera3d?.camera;
    if (!cam) return null;
    return { x: cam.position.x, z: cam.position.z };
  }

  /** atan2 so a creature at (tx, ty) faces the camera's XZ position. */
  _headingTowardCamera(tx, ty) {
    const xz = this._cameraXZ();
    if (!xz) return 0;
    const dx = xz.x - (tx + 0.5);
    const dz = xz.z - (ty + 0.5);
    return Math.atan2(dz, dx);
  }

  _findNearbyPassableTile(cx, cy, radius) {
    // Spiral-ish scan
    for (let r = 0; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = cx + dx, ny = cy + dy;
          if (!this.world.inBounds(nx, ny)) continue;
          if (!this.world.isPassable(nx, ny)) continue;
          return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  /**
   * Finds a roughly word-sized open rectangle. We just check the tile is
   * passable and not water — the word may overlap features but that reads
   * as "drawn over the world", which is fine.
   */
  _findOpenPatch(cx, cy, radius) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const r = 2 + Math.floor(Math.random() * radius);
      const a = Math.random() * Math.PI * 2;
      const x = Math.floor(cx + Math.cos(a) * r);
      const y = Math.floor(cy + Math.sin(a) * r);
      if (!this.world.inBounds(x, y)) continue;
      if (!this.world.isPassable(x, y)) continue;
      return { x, y };
    }
    return this._findNearbyPassableTile(cx, cy, radius);
  }

  _releaseExpiredPauses(tick) {
    for (const e of this.registry.getAll()) {
      const t = e._thronglet;
      if (!t || t.action !== 'pause') continue;
      if (tick >= t.untilTick) {
        e._thronglet = null;
      } else {
        // Track the camera live in case the player is panning during the pause
        e.heading = this._headingTowardCamera(e.tileX, e.tileY);
      }
    }
  }

  _clearAllChosen() {
    for (const e of this.registry.getAll()) {
      if (e._thronglet) e._thronglet = null;
    }
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  _loadFromStorage() {
    try {
      const disabled = this._readStorage('disabled');
      if (disabled === '1') {
        this.disabled = true;
        console.log('THRONGLET // previously disabled — staying off.');
      }
      this.awareness  = parseFloat(this._readStorage('awareness') ?? '0') || 0;
      this.visitCount = parseInt(this._readStorage('visitCount') ?? '0', 10) || 0;
      this.lastSeen   = parseInt(this._readStorage('lastSeen')   ?? '0', 10) || 0;
      const ms = this._readStorage('milestones');
      if (ms) {
        try { Object.assign(this.milestones, JSON.parse(ms)); } catch {}
      }
      const wo = this._readStorage('wordOrder');
      if (wo) {
        try {
          const parsed = JSON.parse(wo);
          if (Array.isArray(parsed) && parsed.every(w => WORDS.includes(w))) {
            this.wordOrder = parsed;
          }
        } catch {}
      }
      this.wordIdx    = parseInt(this._readStorage('wordIdx')    ?? '0', 10) || 0;
      this.preWordIdx = parseInt(this._readStorage('preWordIdx') ?? '0', 10) || 0;

      this.stage = this._stageFor(this.awareness);
      this.visitCount += 1;
      this._writeStorage('visitCount', String(this.visitCount));
    } catch (err) {
      // localStorage may be blocked (private mode etc.) — fail soft.
      console.log('THRONGLET // persistence unavailable:', err?.message ?? err);
    }
  }

  _saveToStorage() {
    if (this.disabled) return;
    try {
      this._writeStorage('awareness', String(Math.floor(this.awareness)));
      this._writeStorage('lastSeen',  String(Date.now()));
      this._writeStorage('milestones', JSON.stringify(this.milestones));
      this._writeStorage('wordOrder',  JSON.stringify(this.wordOrder));
      this._writeStorage('wordIdx',    String(this.wordIdx));
      this._writeStorage('preWordIdx', String(this.preWordIdx));
    } catch {}
  }

  _clearStorage() {
    try {
      const keys = ['awareness','lastSeen','milestones','wordOrder','wordIdx',
                    'preWordIdx','visitCount'];
      for (const k of keys) localStorage.removeItem(STORAGE_PREFIX + k);
    } catch {}
  }

  _readStorage(key)        { try { return localStorage.getItem(STORAGE_PREFIX + key); } catch { return null; } }
  _writeStorage(key, val)  { try { localStorage.setItem(STORAGE_PREFIX + key, val); } catch {} }

  _urlParam(name) {
    try { return new URLSearchParams(window.location.search).get(name); }
    catch { return null; }
  }
}
