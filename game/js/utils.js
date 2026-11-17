// utils.js — math helpers, seeded RNG + tiny event bus for Solmaris Bay
var SBUtils = {
  clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
  clamp01: function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; },
  lerp: function (a, b, t) { return a + (b - a) * t; },
  smoothstep: function (a, b, x) {
    var t = SBUtils.clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  },
  rand: function (a, b) { return a + Math.random() * (b - a); },
  randInt: function (a, b) { return Math.floor(SBUtils.rand(a, b + 1)); },
  choice: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  deg: function (d) { return d * Math.PI / 180; },
  formatMoney: function (n) { return '$' + Math.round(n).toLocaleString('en-US'); },
  // shortest-arc angle lerp
  angleLerp: function (a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  },
  dist2D: function (x1, z1, x2, z2) {
    var dx = x2 - x1, dz = z2 - z1;
    return Math.sqrt(dx * dx + dz * dz);
  },
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
  off: function (ev, fn) {
    var h = this._handlers[ev];
    if (!h) return;
    var i = h.indexOf(fn);
    if (i >= 0) h.splice(i, 1);
  },
  emit: function (ev, data) {
    var h = this._handlers[ev];
    if (!h) return;
    for (var i = 0; i < h.length; i++) {
      try { h[i](data); } catch (e) { /* a bad listener must not kill the game */ }
    }
  }
};
