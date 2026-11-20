// utils.js — math helpers, deterministic RNG, easing li...
var SBUtils = {
  clamp: function (v, lo, hi) { if (v < lo) return lo; if (v > hi) return hi; return v; },
  clamp01: function (v) { if (v < 0) return 0; if (v > 1) return 1; return v; },
  sign: function (v) { return v < 0 ? -1 : v > 0 ? 1 : 0; },
  lerp: function (a, b, t) { return a + (b - a) * t; },
  // frame-rate independent exponential approach: damp(cur...
  damp: function (current, target, rate, dt) {
    var k = 1 - Math.exp(-rate * dt);
    return current + (target - current) * k;
  },
  // critically-damped-ish smoothing with separate rise/fa...
  smoothDamp: function (current, target, rise, fall, dt) {
    var rate = target > current ? rise : fall;
    return SBUtils.damp(current, target, rate, dt);
  },
  // true when two floats are within eps of each other
  approx: function (a, b, eps) { return Math.abs(a - b) <= (eps === undefined ? 0.0001 : eps); },
  // true when v sits inside [lo, hi]
  isBetween: function (v, lo, hi) { return v >= lo && v <= hi; },
  // wrap v into [lo, hi) — angles and cyclic timers both...
  wrapRange: function (v, lo, hi) {
    var span = hi - lo;
    if (span <= 0) return lo;
    return lo + ((((v - lo) % span) + span) % span);
  },
  smoothstep: function (a, b, x) {
    var t = SBUtils.clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  },
  easeOutCubic: function (t) { t = SBUtils.clamp01(t); var u = 1 - t; return 1 - u * u * u; },
  easeInOut: function (t) {
    t = SBUtils.clamp01(t);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  },
  // ---- easing library: every curve takes t in [0, 1] an...
  EASE: {
    linear: function (t) { return t; },
    inQuad: function (t) { return t * t; },
    outQuad: function (t) { return 1 - (1 - t) * (1 - t); },
    inOutQuad: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    inCubic: function (t) { return t * t * t; },
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    inQuart: function (t) { return t * t * t * t; },
    outQuart: function (t) { return 1 - Math.pow(1 - t, 4); },
    inOutQuart: function (t) { return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; },
    inExpo: function (t) { return t === 0 ? 0 : Math.pow(2, 10 * t - 10); },
    outExpo: function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    inBack: function (t) { var c = 1.70158; return (c + 1) * t * t * t - c * t * t; },
    outBack: function (t) { var c = 1.70158, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; },
    inElastic: function (t) {
      if (t === 0) return 0; if (t === 1) return 1;
      return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * (2 * Math.PI / 3));
    },
    outElastic: function (t) {
      if (t === 0) return 0; if (t === 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
    },
    inBounce: function (t) { return 1 - SBUtils.EASE.outBounce(1 - t); },
    outBounce: function (t) {
      var n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
      if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
      t -= 2.625 / d;
      return n * t * t + 0.984375;
    }
  },
  // ease by name: ease('outBack', 0.4). Unknown names fal...
  ease: function (name, t) {
    var fn = SBUtils.EASE[name];
    if (!fn) return SBUtils.clamp01(t);
    return fn(SBUtils.clamp01(t));
  },
  rand: function (a, b) { return a + Math.random() * (b - a); },
  randInt: function (a, b) { return Math.floor(SBUtils.rand(a, b + 1)); },
  choice: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  deg: function (d) { return d * Math.PI / 180; },
  radToDeg: function (r) { return r * 180 / Math.PI; },
  formatMoney: function (n) { return '$' + Math.round(n).toLocaleString('en-US'); },
  // "M:SS" for mission timers and the getaway countdown
  formatTime: function (seconds) {
    var s = Math.max(0, Math.ceil(seconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  },
  // "H:MM" wall-clock for the in-game day readout
  formatClock: function (seconds) {
    var s = Math.floor(seconds) % 86400;
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    return h + ':' + (m < 10 ? '0' : '') + m;
  },
  // "MM:SS.cc" with centiseconds, for the race-style time...
  formatDuration: function (seconds) {
    var s = Math.max(0, seconds);
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    var cs = Math.floor((s - Math.floor(s)) * 100);
    return m + ':' + (sec < 10 ? '0' : '') + sec + '.' + (cs < 10 ? '0' : '') + cs;
  },
  // two-digit pad for clock digits: pad2(7) -> "07"
  pad2: function (n) { return (n < 10 ? '0' : '') + Math.floor(n); },
  // wrap an angle into [-PI, PI]
  clampAngle: function (a) {
    var TAU = Math.PI * 2;
    a = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return a;
  },
  // same wrap, in degrees: clampAngleDeg(370) -> 10
  clampAngleDeg: function (d) {
    return SBUtils.wrapRange(d + 180, 0, 360) - 180;
  },
  // shortest signed difference from a to b, in [-PI, PI]
  angleDiff: function (a, b) {
    var d = SBUtils.clampAngle(b) - SBUtils.clampAngle(a);
    return SBUtils.clampAngle(d);
  },
  // shortest-arc angle lerp (trusts already-normalized in...
  angleLerp: function (a, b, t) {
    var d = SBUtils.angleDiff(a, b);
    return a + d * t;
  },
  // lerpAngle: same as angleLerp but normalizes drifting...
  lerpAngle: function (a, b, t) {
    return SBUtils.angleLerp(SBUtils.clampAngle(a), SBUtils.clampAngle(b), t);
  },
  // degree version of lerpAngle, for UI dials and compass...
  lerpAngleDeg: function (a, b, t) {
    var d = SBUtils.clampAngleDeg(b - a);
    return a + d * t;
  },
  // randChoice: pick one element; pass a seeded rng for r...
  randChoice: function (arr, rng) {
    if (!arr || arr.length === 0) return undefined;
    var r = rng ? rng() : Math.random();
    return arr[Math.floor(r * arr.length)];
  },
  // weighted pick: pairs is [[value, weight], ...]; retur...
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
  // deterministic 2D hash -> 0..1, for stable per-block d...
  hash2: function (x, z) {
    var h = (x * 374761393 + z * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  },
  // 3D hash for per-voxel / per-floor variation (y = stor...
  hash3: function (x, y, z) {
    var h = (x * 374761393 + y * 2246822519 + z * 668265263) | 0;
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
  // ---- 2D vector helpers: plain {x, z} objects, no allo...
  v2: {
    make: function (x, z) { return { x: x, z: z }; },
    add: function (a, b) { return { x: a.x + b.x, z: a.z + b.z }; },
    sub: function (a, b) { return { x: a.x - b.x, z: a.z - b.z }; },
    scale: function (a, s) { return { x: a.x * s, z: a.z * s }; },
    len: function (a) { return Math.sqrt(a.x * a.x + a.z * a.z); },
    lenSq: function (a) { return a.x * a.x + a.z * a.z; },
    norm: function (a) {
      var l = SBUtils.v2.len(a);
      if (l < 0.0001) return { x: 0, z: 0 };
      return { x: a.x / l, z: a.z / l };
    },
    dot: function (a, b) { return a.x * b.x + a.z * b.z; },
    dist: function (a, b) { return SBUtils.dist2D(a.x, a.z, b.x, b.z); },
    angle: function (a) { return Math.atan2(a.x, a.z); },
    fromAngle: function (ang, len) {
      return { x: Math.sin(ang) * len, z: Math.cos(ang) * len };
    },
    lerp: function (a, b, t) {
      return { x: SBUtils.lerp(a.x, b.x, t), z: SBUtils.lerp(a.z, b.z, t) };
    },
    rotate: function (a, ang) {
      var c = Math.cos(ang), s = Math.sin(ang);
      return { x: a.x * c - a.z * s, z: a.x * s + a.z * c };
    },
    // perpendicular (90 deg CCW): used for lane offsets and...
    perp: function (a) { return { x: -a.z, z: a.x }; }
  },
  // deterministic RNG (mulberry32): same seed => same seq...
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
  // hash a string into a uint32 seed, so a district name...
  seedFromString: function (str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  },
  // Fisher-Yates shuffle; pass a seeded rng for a reprodu...
  shuffle: function (arr, rng) {
    var a = arr.slice();
    var r = rng || Math.random;
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  },
  // short money for tight HUD spaces: 1250 -> "$1.2k", 50...
  formatMoneyShort: function (n) {
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return '$' + Math.round(n);
  },
  // turn current toward target by at most maxStep radians...
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
  // push a circle out of an AABB; returns true if a colli...
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
      // centre inside the box: push out along the smallest pe...
      var pl = p.x - b.minX, pr = b.maxX - p.x;
      var pt = p.z - b.minZ, pb = b.maxZ - p.z;
      var m = Math.min(pl, pr, pt, pb);
      if (m === pl) p.x = b.minX - r;
      else if (m === pr) p.x = b.maxX + r;
      else if (m === pt) p.z = b.minZ - r;
      else p.z = b.maxZ + r;
    }
    return true;
  },
  // angle from (x1,z1) to (x2,z2), in the same convention...
  angleTo: function (x1, z1, x2, z2) { return Math.atan2(x2 - x1, z2 - z1); },
  // move v toward target by at most maxDelta (never overs...
  moveToward: function (v, target, maxDelta) {
    var d = target - v;
    if (Math.abs(d) <= maxDelta) return target;
    return v + Math.sign(d) * maxDelta;
  },
  // random sign: -1 or 1, for scattering things both ways
  randSign: function () { return Math.random() < 0.5 ? -1 : 1; },
  // sample n distinct elements (order shuffled); pass a s...
  pickN: function (arr, n, rng) {
    var shuffled = SBUtils.shuffle(arr, rng);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  },
  // a random point inside a circle of radius r around (cx...
  randomPointInCircle: function (cx, cz, r, rng) {
    var rand = rng || Math.random;
    var a = rand() * Math.PI * 2;
    var d = Math.sqrt(rand()) * r;
    return { x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d };
  },
  // a random point in the ring between rMin and rMax arou...
  randomPointInAnnulus: function (cx, cz, rMin, rMax, rng) {
    var rand = rng || Math.random;
    var a = rand() * Math.PI * 2;
    var d = Math.sqrt(rand() * (rMax * rMax - rMin * rMin) + rMin * rMin);
    return { x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d };
  },
  // easeOutBack: overshoots slightly past the target, the...
  easeOutBack: function (t) {
    t = SBUtils.clamp01(t);
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  // bounceOut: a decaying bounce, for coins / pickups lan...
  bounceOut: function (t) {
    return SBUtils.EASE.outBounce(t);
  },
  // ---- spatial hash: a uniform grid so proximity querie...
  createSpatialHash: function (cellSize) {
    var cell = cellSize || 20;
    var buckets = {};
    var key = function (x, z) {
      return Math.floor(x / cell) + ':' + Math.floor(z / cell);
    };
    return {
      cellSize: cell,
      insert: function (item) {
        var k = key(item.x, item.z);
        if (!buckets[k]) buckets[k] = [];
        buckets[k].push(item);
      },
      remove: function (item) {
        var k = key(item.x, item.z);
        var b = buckets[k];
        if (!b) return false;
        var i = b.indexOf(item);
        if (i < 0) return false;
        b.splice(i, 1);
        return true;
      },
      // everything whose cell touches the (x, z, radius) disc...
      query: function (x, z, radius) {
        var out = [];
        var minX = Math.floor((x - radius) / cell), maxX = Math.floor((x + radius) / cell);
        var minZ = Math.floor((z - radius) / cell), maxZ = Math.floor((z + radius) / cell);
        for (var cx = minX; cx <= maxX; cx++) {
          for (var cz = minZ; cz <= maxZ; cz++) {
            var b = buckets[cx + ':' + cz];
            if (b) for (var i = 0; i < b.length; i++) out.push(b[i]);
          }
        }
        return out;
      },
      // query + exact distance filter in one call, sorted nea...
      queryRadius: function (x, z, radius) {
        var near = this.query(x, z, radius);
        var r2 = radius * radius;
        var hit = [];
        for (var i = 0; i < near.length; i++) {
          var dx = near[i].x - x, dz = near[i].z - z;
          var d2 = dx * dx + dz * dz;
          if (d2 <= r2) hit.push({ item: near[i], dist: Math.sqrt(d2) });
        }
        hit.sort(function (a, b) { return a.dist - b.dist; });
        return hit;
      },
      clear: function () { buckets = {}; },
      count: function () {
        var n = 0;
        for (var k in buckets) n += buckets[k].length;
        return n;
      }
    };
  },
  // ---- seeded event scheduler: queue callbacks for a fu...
  createScheduler: function (rng) {
    var queue = [];
    var now = 0;
    return {
      time: 0,
      schedule: function (delay, fn) {
        queue.push({ at: now + Math.max(0, delay), fn: fn });
        return queue.length;
      },
      // schedule with a seeded jitter: delay +/- spread
      scheduleJittered: function (delay, spread, fn) {
        var r = rng ? rng() : Math.random();
        return this.schedule(delay + (r * 2 - 1) * spread, fn);
      },
      // run everything due; call once per frame with the fram...
      update: function (dt) {
        now += dt;
        this.time = now;
        for (var i = queue.length - 1; i >= 0; i--) {
          if (queue[i].at <= now) {
            var job = queue.splice(i, 1)[0];
            try { job.fn(now); } catch (e) {  }
          }
        }
      },
      pending: function () { return queue.length; },
      clear: function () { queue.length = 0; }
    };
  }
};

// SBBus — tiny pub/sub so systems can react without har...
var SBBus = {
  _handlers: {},
  on: function (ev, fn) {
    if (!this._handlers[ev]) this._handlers[ev] = [];
    this._handlers[ev].push(fn);
  },
  // like on(), but the listener removes itself after one...
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
  // drop every listener for one event (or all events when...
  clear: function (ev) {
    if (ev) this._handlers[ev] = [];
    else this._handlers = {};
  },
  // how many listeners are registered for one event (0 wh...
  count: function (ev) {
    var h = this._handlers[ev];
    return h ? h.length : 0;
  },
  // true when at least one listener is registered for the...
  has: function (ev) { return this.count(ev) > 0; },
  emit: function (ev, data) {
    var h = this._handlers[ev];
    if (!h) return;
    var copy = h.slice();
    for (var i = 0; i < copy.length; i++) {
      try { copy[i](data); } catch (e) {  }
    }
  },
  // emit on the next tick, so a listener that registers d...
  emitAsync: function (ev, data) {
    var self = this;
    setTimeout(function () { self.emit(ev, data); }, 0);
  }
};
