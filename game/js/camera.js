// camera.js — the camera director: one follow camera wi...
var Camera = {
  cam: null,
  yaw: 0,
  pitch: 0.32,
  dist: 9,
  introYaw: 0,
  shakeT: 0,
  shakeAmp: 0,
  kickPitch: 0,
  photo: false,
  photoYaw: 0,
  photoPitch: 0.5,
  photoDist: 14,
  drone: false,
  droneYaw: 0,
  droneH: 55,
  introSweepT: -1,
  // ---- director state (new in this pass) ----
  trauma: 0,
  fovBase: 62,
  fovKick: 0,
  preset: 'normal',
  roll: 0,
  lookAhead: 0,
  mode: 'follow',
  shakeDecay: 1.6,
  shakeX: 0, shakeY: 0,
  focusX: 0, focusZ: 0,
  // distance presets: how far the camera sits in each fra...
  PRESETS: {
    close:     { dist: 6.5,  pitch: 0.26, height: 1.3, fov: 66, blend: 6,   shakeScale: 0.8 },
    normal:    { dist: 9,    pitch: 0.32, height: 1.6, fov: 62, blend: 5,   shakeScale: 1.0 },
    far:       { dist: 13.5, pitch: 0.4,  height: 1.9, fov: 58, blend: 4,   shakeScale: 1.1 },
    cinematic: { dist: 18,   pitch: 0.18, height: 2.4, fov: 50, blend: 2.5, shakeScale: 0.3 },
    topdown:   { dist: 26,   pitch: 1.25, height: 8,   fov: 48, blend: 4,   shakeScale: 0.2 }
  },
  // switch framing; unknown names are ignored so a typo c...
  setPreset: function (name) {
    var p = this.PRESETS[name];
    if (!p) return false;
    this.preset = name;
    this.pitch = p.pitch;
    if (this.cam) {
      this.fovBase = p.fov;
      if (this.cam.fov !== undefined) {
        this.cam.fov = p.fov + this.fovKick;
        if (this.cam.updateProjectionMatrix) this.cam.updateProjectionMatrix();
      }
    }
    return true;
  },
  // cycle close -> normal -> far -> cinematic -> topdown...
  cyclePreset: function () {
    var order = ['close', 'normal', 'far', 'cinematic', 'topdown'];
    var i = order.indexOf(this.preset);
    return this.setPreset(order[(i + 1) % order.length]) ? this.preset : this.preset;
  },
  // unified mode setter: 'follow' | 'photo' | 'drone' | '...
  setMode: function (m) {
    if (m === 'photo') {
      if (!this.photo) this.togglePhoto();
      return this.mode;
    }
    if (m === 'drone') {
      if (!this.drone) this.toggleDrone();
      return this.mode;
    }
    if (this.photo) this.togglePhoto();
    if (this.drone) this.toggleDrone();
    this.mode = (m === 'title') ? 'title' : 'follow';
    return this.mode;
  },
  init: function (camera) {
    this.cam = camera;
    if (camera && camera.fov !== undefined) this.fovBase = camera.fov;
  },
  // add impact trauma: 0.2 = a nudge, 0.6 = a hard crash,...
  addTrauma: function (amt) {
    this.trauma = SBUtils.clamp01(this.trauma + amt);
    this.shakeAmp = Math.max(this.shakeAmp, amt);
    this.shakeT = 0.35;
  },
  // kick the camera: collisions call shake(0.35), gunshot...
  shake: function (amp) {
    this.addTrauma(amp === undefined ? 0.25 : amp);
  },
  // alias for the same pool, for callers that think in "s...
  addShake: function (amount) {
    this.addTrauma(amount || 0.3);
  },
  // recoil kick: a quick upward pitch jolt that settles back
  kick: function (amt) {
    this.kickPitch = Math.min(0.09, this.kickPitch + (amt || 0.03));
  },
  // nitro FOV kick: call every frame with 1 while nitro i...
  setFovKick: function (on01) {
    this.fovKick = SBUtils.damp(this.fovKick, on01 ? 8 : 0, 4, 0.016);
    if (!this.cam) return;
    var want = this.fovBase + this.fovKick;
    if (Math.abs(this.cam.fov - want) > 0.05) {
      this.cam.fov = want;
      if (this.cam.updateProjectionMatrix) this.cam.updateProjectionMatrix();
    }
  },
  // a one-off FOV bump (sprint start, landing a jump): ad...
  addFovKick: function (amount) {
    this.fovKick = SBUtils.clamp(this.fovKick + (amount || 6), 0, 14);
  },
  // ---- title solver: a slow cinematic orbit over the ci...
  _solveTitle: function (dt) {
    this.introYaw += dt * 0.045;
    var r = 95, h = 34;
    return {
      x: Math.sin(this.introYaw) * r, y: h, z: Math.cos(this.introYaw) * r,
      lookX: 0, lookY: 2, lookZ: 0, yaw: this.introYaw
    };
  },
  // slow cinematic orbit over the city while the title sc...
  intro: function (dt) {
    this.mode = 'title';
    var s = this._solveTitle(dt);
    this.cam.position.set(s.x, s.y, s.z);
    this.cam.lookAt(s.lookX, s.lookY, s.lookZ);
    this.focusX = s.lookX; this.focusZ = s.lookZ;
  },
  // opening sweep: when a run starts, the camera flies fr...
  startSweep: function () {
    this.introSweepT = 0;
  },
  togglePhoto: function () {
    this.photo = !this.photo;
    this.mode = this.photo ? 'photo' : 'follow';
    if (this.photo) {
      this.photoYaw = this.yaw;
      this.photoPitch = this.pitch;
      this.photoDist = this.dist;
    }
    return this.photo;
  },
  // while frozen in photo mode, orbit the shot directly (...
  photoOrbit: function (dx, dy) {
    if (!this.photo) return;
    this.photoYaw -= dx * 0.005;
    this.photoPitch = SBUtils.clamp(this.photoPitch + dy * 0.004, 0.05, 1.35);
  },
  // drone camera (O): a high bird's-eye view that slowly...
  toggleDrone: function () {
    this.drone = !this.drone;
    this.mode = this.drone ? 'drone' : 'follow';
    if (this.drone) {
      this.droneYaw = this.yaw;
      this.droneH = 55;
    }
    return this.drone;
  },
  // ---- per-mode camera solvers: each returns {x, y, z,...
  _solveFollow: function (dt, target, driving) {
    var orbit = Input.takeOrbit();
    this.yaw -= orbit.x * 0.005;
    this.pitch = SBUtils.clamp(this.pitch + orbit.y * 0.004, 0.08, 1.1);
    var preset = this.PRESETS[this.preset] || this.PRESETS.normal;
    var wantDist = driving ? preset.dist + 4.5 : preset.dist;
    this.dist = SBUtils.damp(this.dist, wantDist, preset.blend, dt);
    var tx = target.x, tz = target.z;
    var ty = driving ? preset.height - 0.2 : preset.height;
    // velocity look-ahead: at speed the camera leans forwar...
    var vx = target.vx || 0, vz = target.vz || 0;
    var spd = Math.sqrt(vx * vx + vz * vz);
    var wantLook = SBUtils.clamp(spd * 0.35, 0, 6);
    this.lookAhead = SBUtils.damp(this.lookAhead, wantLook, 2.5, dt);
    if (spd > 0.5) {
      tx += (vx / spd) * this.lookAhead;
      tz += (vz / spd) * this.lookAhead;
    }
    // camera sits behind the orbit yaw; when driving, bias...
    var baseYaw = this.yaw;
    if (driving) {
      // blend orbit yaw toward behind-car so the view follows...
      var behind = target.heading + Math.PI;
      baseYaw = SBUtils.lerpAngle(baseYaw, behind, Math.min(1, dt * 1.2));
      this.yaw = baseYaw;
    }
    var cx = tx + Math.sin(baseYaw) * Math.cos(this.pitch) * this.dist;
    var cz = tz + Math.cos(baseYaw) * Math.cos(this.pitch) * this.dist;
    var cy = ty + Math.sin(this.pitch) * this.dist;
    // horizon tilt: lean the horizon into a hard drift so t...
    var lean = target.driftLean || 0;
    this.roll = SBUtils.damp(this.roll, SBUtils.clamp(lean * 0.12, -0.14, 0.14), 4, dt);
    return { x: cx, y: cy, z: cz, lookX: tx, lookY: ty - this.kickPitch * 8, lookZ: tz, yaw: baseYaw };
  },
  _solvePhoto: function (dt, target) {
    var orbit = Input.takeOrbit();
    this.photoYaw -= orbit.x * 0.005;
    this.photoPitch = SBUtils.clamp(this.photoPitch + orbit.y * 0.004, 0.05, 1.35);
    var tx = target.x, tz = target.z;
    var px = tx + Math.sin(this.photoYaw) * Math.cos(this.photoPitch) * this.photoDist;
    var pz = tz + Math.cos(this.photoYaw) * Math.cos(this.photoPitch) * this.photoDist;
    var py = 1.6 + Math.sin(this.photoPitch) * this.photoDist;
    return { x: px, y: Math.max(1.2, py), z: pz, lookX: tx, lookY: 1.6, lookZ: tz, yaw: this.photoYaw };
  },
  _solveDrone: function (dt, target) {
    this.droneYaw += dt * 0.05;
    var dh = this.droneH;
    var dx = target.x + Math.sin(this.droneYaw) * 55;
    var dz = target.z + Math.cos(this.droneYaw) * 55;
    return { x: dx, y: dh, z: dz, lookX: target.x, lookY: 0, lookZ: target.z, yaw: this.droneYaw };
  },
  // pull a desired camera point out of buildings: walk it...
  _pullOutOfBuildings: function (cx, cy, cz, tx, ty, tz) {
    var pos = { x: cx, y: cy, z: cz };
    var guard = 0;
    while (guard++ < 8) {
      var inside = false;
      for (var i = 0; i < World.colliders.length; i++) {
        var b = World.colliders[i];
        if (pos.x > b.minX - 0.4 && pos.x < b.maxX + 0.4 && pos.z > b.minZ - 0.4 && pos.z < b.maxZ + 0.4) { inside = true; break; }
      }
      if (!inside) break;
      var f = 0.85;
      pos.x = tx + (pos.x - tx) * f;
      pos.z = tz + (pos.z - tz) * f;
      pos.y = ty + (pos.y - ty) * f;
    }
    return pos;
  },
  // lamp-post dodge: a pole dead-centre between camera an...
  _dodgeLampPosts: function (cx, cy, cz, tx, tz, driving) {
    var vdx = tx - cx, vdz = tz - cz;
    var vlen = Math.max(0.1, Math.sqrt(vdx * vdx + vdz * vdz));
    var latX = -vdz / vlen, latZ = vdx / vlen;
    var lampCoords = [-180, -120, -60, 0, 60, 120, 180];
    for (var li = 0; li < lampCoords.length; li++) {
      for (var ls = -240; ls <= 240; ls += 60) {
        var lampX = lampCoords[li] + 8.5, lampZ = ls;
        var ddx = lampX - cx, ddz = lampZ - cz;
        var along = ddx * (vdx / vlen) + ddz * (vdz / vlen);
        var lat = ddx * latX + ddz * latZ;
        if (along > 0 && along < vlen && Math.abs(lat) < 1.6) {
          var side = lat >= 0 ? -1 : 1;
          cx += latX * 2.4 * side;
          cz += latZ * 2.4 * side;
          return { x: cx, y: cy + (driving ? 1.0 : 0), z: cz };
        }
      }
    }
    return { x: cx, y: cy + (driving ? 1.0 : 0), z: cz };
  },
  // ---- shake step: trauma decays, amplitude is trauma^2...
  _applyShake: function (dt, preset) {
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * this.shakeDecay);
    }
    var scale = preset ? preset.shakeScale : 1;
    var amp = this.trauma * this.trauma * 1.1 * scale;
    var t = performance.now() / 1000;
    this.shakeX = amp * (Math.sin(t * 47.3) * 0.6 + Math.sin(t * 23.1) * 0.4);
    this.shakeY = amp * (Math.cos(t * 39.7) * 0.6 + Math.sin(t * 31.3) * 0.4);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
    return { x: this.shakeX, y: this.shakeY };
  },
  // ---- opening-sweep step: lerp the solved camera from...
  _applySweep: function (dt, cx, cy, cz) {
    if (this.introSweepT < 0) return { x: cx, y: cy, z: cz };
    this.introSweepT += dt;
    var k = SBUtils.clamp01(this.introSweepT / 2.5);
    var e = SBUtils.ease('outCubic', k);
    var sx = 270, sz = 40, sy = 60;
    var out = {
      x: SBUtils.lerp(sx, cx, e),
      y: SBUtils.lerp(sy, cy, e),
      z: SBUtils.lerp(sz, cz, e)
    };
    if (k >= 1) this.introSweepT = -1;
    return out;
  },
  update: function (dt, target, driving) {
    // photo mode: freeze the world (main.js skips simulatio...
    if (this.photo) {
      var solved = this._solvePhoto(dt, target);
      this.cam.position.set(solved.x, solved.y, solved.z);
      this.cam.lookAt(solved.lookX, solved.lookY, solved.lookZ);
      this.focusX = solved.lookX; this.focusZ = solved.lookZ;
      return solved.yaw;
    }
    // drone mode: a slow 55-unit-high orbit over the action...
    if (this.drone) {
      var droneSolved = this._solveDrone(dt, target);
      this.cam.position.set(droneSolved.x, droneSolved.y, droneSolved.z);
      this.cam.lookAt(droneSolved.lookX, droneSolved.lookY, droneSolved.lookZ);
      this.focusX = droneSolved.lookX; this.focusZ = droneSolved.lookZ;
      return droneSolved.yaw;
    }
    var follow = this._solveFollow(dt, target, driving);
    var tx = follow.lookX, ty = follow.lookY, tz = follow.lookZ;
    // pipeline: sweep -> pull out of buildings -> dodge lam...
    var swept = this._applySweep(dt, follow.x, follow.y, follow.z);
    var cx = swept.x, cy = swept.y, cz = swept.z;
    var pulled = this._pullOutOfBuildings(cx, cy, cz, tx, ty, tz);
    cx = pulled.x; cy = pulled.y; cz = pulled.z;
    if (cy < 1.2) cy = 1.2;
    var dodged = this._dodgeLampPosts(cx, cy, cz, tx, tz, driving);
    cx = dodged.x; cy = dodged.y; cz = dodged.z;
    // recoil kick decays; impact shake: trauma squared, dec...
    if (this.kickPitch > 0) this.kickPitch = Math.max(0, this.kickPitch - dt * 0.25);
    var preset = this.PRESETS[this.preset] || this.PRESETS.normal;
    var sh = this._applyShake(dt, preset);
    cx += sh.x;
    cy += sh.y * 0.6;
    cz += (Math.random() - 0.5) * this.trauma * this.trauma * 1.1 * preset.shakeScale;
    var cp = this.cam.position;
    cp.x = SBUtils.damp(cp.x, cx, 7, dt);
    cp.y = SBUtils.damp(cp.y, cy, 7, dt);
    cp.z = SBUtils.damp(cp.z, cz, 7, dt);
    this.focusX = tx; this.focusZ = tz;
    this.cam.lookAt(tx, ty, tz);
    // horizon roll: rotate the camera around its view axis...
    if (this.roll !== 0 && this.cam.rotateZ) this.cam.rotateZ(this.roll * 0.25);
    return follow.yaw;
  }
};
