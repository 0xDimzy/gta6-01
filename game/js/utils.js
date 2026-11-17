// utils.js — math helpers, deterministic RNG, tiny event bus (Solmaris Bay)
// Everything here is written to be dependency-free: plain var/function
// style, no modules, so the game loads as classic scripts in index.html.
var SBUtils = {
  clamp: function (v, lo, hi) { if (v < lo) return lo; if (v > hi) return hi; return v; },
  clamp01: function (v) { if (v < 0) return 0; if (v > 1) return 1; return v; },
  sign: function (v) { return v < 0 ? -1 : v > 0 ? 1 : 0; },
  lerp: function (a, b, t) { return a + (b - a) * t; },
  smoothstep: function (a, b, x) {
    var t = SBUtils.clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  },
  easeOutCubic: function (t) { t = SBUtils.clamp01(t); var u = 1 - t; return 1 - u * u * u; },
  easeInOut: function (t) {
    t = SBUtils.clamp01(t);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  },
  rand: function (a, b) { return a + Math.random() * (b - a); },
  randInt: function (a, b) { return Math.floor(SBUtils.rand(a, b + 1)); },
  choice: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  deg: function (d) { return d * Math.PI / 180; },
  formatMoney: function (n) { return '$' + Math.round(n).toLocaleString('en-US'); },
  // "M:SS" for mission timers and the getaway countdown
  formatTime: function (seconds) {
    var s = Math.max(0, Math.ceil(seconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  },
  // wrap an angle into [-PI, PI]
  clampAngle: function (a) {
    var TAU = Math.PI * 2;
    a = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return a;
  },
  // shortest signed difference from a to b, in [-PI, PI]
  angleDiff: function (a, b) {
    var d = SBUtils.clampAngle(b) - SBUtils.clampAngle(a);
    return SBUtils.clampAngle(d);
  },
  // shortest-arc angle lerp (trusts already-normalized input)
  angleLerp: function (a, b, t) {
    var d = SBUtils.angleDiff(a, b);
    return a + d * t;
  },
  // lerpAngle: same as angleLerp but normalizes drifting headings first,
  // so a heading that has spun past 2*PI still blends the short way round
  lerpAngle: function (a, b, t) {
    return SBUtils.angleLerp(SBUtils.clampAngle(a), SBUtils.clampAngle(b), t);
  },
  // randChoice: pick one element; pass a seeded rng for reproducible
  // picks, or omit it for Math.random
  randChoice: function (arr, rng) {
    if (!arr || arr.length === 0) return undefined;
    var r = rng ? rng() : Math.random();
    return arr[Math.floor(r * arr.length)];
  },
  // weighted pick: pairs is [[value, weight], ...]; returns a value
  pickWeighted: function (pairs, rng) {
    var total = 0;
    for (var i = 0; i < pairs.length; i++) total += pairs[i][1];
    var roll = (rng ? rng() : Math.random()) * total;
    for (var j = 0; j < pairs.length; j++) {
      roll -= pairs[j][1];
      if (roll <= 0) return pairs[j][0];
    }
    return pairs[pairs.length - 1][0];
  },
  // deterministic 2D hash -> 0..1, for stable per-block decoration choices
  hash2: function (x, z) {
    var h = (x * 374761393 + z * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  },
  // lerp two #rrggbb colours, returns a #rrggbb string
  lerpColorHex: function (a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(SBUtils.lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
    var g = Math.round(SBUtils.lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
    var bl = Math.round(SBUtils.lerp(pa & 255, pb & 255, t));
    return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
  },
  dist2D: function (x1, z1, x2, z2) {
    var dx = x2 - x1, dz = z2 - z1;
    return Math.sqrt(dx * dx + dz * dz);
  },
  manhattan: function (x1, z1, x2, z2) { return Math.abs(x2 - x1) + Math.abs(z2 - z1); },
  // deterministic RNG (mulberry32): same seed => same sequence, handy for
  // reproducible city dressing and for tests that must not depend on Math.random
  seeded: function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  // hash a string into a uint32 seed, so a district name ("old-town") can
  // own a deterministic layout: seedFromString('old-town') always deals
  // the same buildings, palms and neon as last run
  seedFromString: function (str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  },
  // Fisher-Yates shuffle; pass a seeded rng for a reproducible order
  shuffle: function (arr, rng) {
    var a = arr.slice();
    var r = rng || Math.random;
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  },
  // short money for tight HUD spaces: 1250 -> "$1.2k", 50000 -> "$50k"
  formatMoneyShort: function (n) {
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return '$' + Math.round(n);
  },
  // turn current toward target by at most maxStep radians (shortest arc);
  // AI steering uses this so cruisers and taxis turn at a capped rate
  turnToward: function (current, target, maxStep) {
    var d = SBUtils.angleDiff(current, target);
    if (Math.abs(d) <= maxStep) return target;
    return current + Math.sign(d) * maxStep;
  },
  // circle (x,z,r) vs AABB {minX,maxX,minZ,maxZ}
  circleHitsAABB: function (x, z, r, b) {
    var cx = SBUtils.clamp(x, b.minX, b.maxX);
    var cz = SBUtils.clamp(z, b.minZ, b.maxZ);
    var dx = x - cx, dz = z - cz;
    return dx * dx + dz * dz < r * r;
  },
  // push a circle out of an AABB; returns true if a collision happened
  resolveCircleAABB: function (p, r, b) {
    var cx = SBUtils.clamp(p.x, b.minX, b.maxX);
    var cz = SBUtils.clamp(p.z, b.minZ, b.maxZ);
    var dx = p.x - cx, dz = p.z - cz;
    var d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return false;
    if (d2 > 0.0001) {
      var d = Math.sqrt(d2);
      p.x = cx + dx / d * r;
      p.z = cz + dz / d * r;
    } else {
      // centre inside the box: push out along the smallest penetration axis
      var pl = p.x - b.minX, pr = b.maxX - p.x;
      var pt = p.z - b.minZ, pb = b.maxZ - p.z;
      var m = Math.min(pl, pr, pt, pb);
      if (m === pl) p.x = b.minX - r;
      else if (m === pr) p.x = b.maxX + r;
      else if (m === pt) p.z = b.minZ - r;
      else p.z = b.maxZ + r;
    }
    return true;
  }
};

// SBBus — tiny pub/sub so systems can react without hard coupling.
// Missions emits 'mission-start' / 'mission-complete' / 'mission-fail';
// HUD subscribes for the story subtitle + summary screen, Police listens
// for 'mission-complete' to clear heat faster after a clean job.
var SBBus = {
  _handlers: {},
  on: function (ev, fn) {
    if (!this._handlers[ev]) this._handlers[ev] = [];
    this._handlers[ev].push(fn);
  },
  // like on(), but the listener removes itself after one call
  once: function (ev, fn) {
    var self = this;
    var wrapper = function (data) {
      self.off(ev, wrapper);
      fn(data);
    };
    this.on(ev, wrapper);
  },
  off: function (ev, fn) {
    var h = this._handlers[ev];
    if (!h) return;
    var i = h.indexOf(fn);
    if (i >= 0) h.splice(i, 1);
  },
  // drop every listener for one event (or all events when ev is omitted)
  clear: function (ev) {
    if (ev) this._handlers[ev] = [];
    else this._handlers = {};
  },
  emit: function (ev, data) {
    var h = this._handlers[ev];
    if (!h) return;
    var copy = h.slice();
    for (var i = 0; i < copy.length; i++) {
      try { copy[i](data); } catch (e) { /* a bad listener must not kill the game */ }
    }
  }
};
