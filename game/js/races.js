// races.js — street race side activity: drive to a start ring, beat the checkpoints.
var Races = {
  defs: [
    { name: 'Harbor Sprint', reward: 500, points: [[180, 60], [120, 120], [60, 60], [120, -60]] },
    { name: 'Downtown Loop', reward: 800, points: [[0, 0], [120, 0], [120, 120], [0, 120], [-120, 60]] },
    { name: 'Airport Run', reward: 1200, points: [[-180, -60], [-120, 0], [-60, 120], [60, 180], [180, 60]] }
  ],
  active: false,
  race: -1,
  checkpoint: 0,
  state: 'idle',
  cdT: 0,
  cdShown: 0,
  time: 0,
  beacon: null,
  startRings: [],
  scene: null,

  init: function (scene) {
    this.scene = scene;
    var g = new THREE.Group();
    var pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 70, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff7b00, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    pillar.position.y = 35;
    g.add(pillar);
    var ring = new THREE.Mesh(new THREE.RingGeometry(3, 4, 28),
      new THREE.MeshBasicMaterial({ color: 0xff7b00, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    g.add(ring);
    g.visible = false;
    scene.add(g);
    this.beacon = g;
    for (var i = 0; i < this.defs.length; i++) {
      var s = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 28),
        new THREE.MeshBasicMaterial({ color: 0xff7b00, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      s.rotation.x = -Math.PI / 2;
      s.position.set(this.defs[i].points[0][0], 0.12, this.defs[i].points[0][1]);
      scene.add(s);
      this.startRings.push(s);
    }
  },

  _best: function () {
    try { return JSON.parse(localStorage.getItem('solmaris.raceBest') || '{}'); } catch (e) { return {}; }
  },

  startRace: function (i) {
    if (this.active || i < 0 || i >= this.defs.length) return;
    this.active = true;
    this.race = i;
    this.checkpoint = 1;
    this.state = 'countdown';
    this.cdT = 3;
    this.cdShown = 4;
    this.time = 0;
    this._pointBeacon();
    HUD.toast(this.defs[i].name + ' — get ready!', '#ff7b00');
    AudioSys.blip(660);
  },

  _pointBeacon: function () {
    var p = this.defs[this.race].points[this.checkpoint];
    this.beacon.position.set(p[0], 0, p[1]);
    this.beacon.visible = true;
  },

  _finish: function () {
    var def = this.defs[this.race];
    var best = this._best();
    var t = Math.round(this.time * 10) / 10;
    var isBest = !best[def.name] || t < best[def.name];
    if (isBest) {
      best[def.name] = t;
      try { localStorage.setItem('solmaris.raceBest', JSON.stringify(best)); } catch (e) {}
    }
    Game.money += def.reward;
    if (Game.stats) Game.stats.cashEarned += def.reward;
    HUD.toast(def.name + ' finished in ' + t.toFixed(1) + 's — +$' + def.reward + (isBest ? ' (new best!)' : ' (best ' + best[def.name].toFixed(1) + 's)'), '#7dff9a');
    AudioSys.chaChing();
    this.active = false;
    this.state = 'idle';
    this.beacon.visible = false;
  },

  _cancel: function (why) {
    HUD.toast('Race cancelled — ' + why, '#ff8844');
    this.active = false;
    this.state = 'idle';
    this.beacon.visible = false;
  },

  getBlip: function () {
    if (!this.active) return null;
    var p = this.defs[this.race].points[this.checkpoint];
    return { x: p[0], z: p[1], color: '#ff7b00' };
  },

  update: function (dt) {
    if (!this.beacon) return;
    var driving = Vehicle.isDriving();
    var px = driving ? Vehicle.drivable.x : Player.x;
    var pz = driving ? Vehicle.drivable.z : Player.z;
    if (!this.active) {
      if (!driving) return;
      for (var i = 0; i < this.defs.length; i++) {
        var s = this.defs[i].points[0];
        if (SBUtils.dist2D(px, pz, s[0], s[1]) < 6) { this.startRace(i); return; }
      }
      return;
    }
    if (this.state === 'countdown') {
      this.cdT -= dt;
      var n = Math.ceil(this.cdT);
      if (n !== this.cdShown && n > 0) {
        this.cdShown = n;
        HUD.toast(String(n), '#ffd23f');
        AudioSys.blip(440);
      }
      if (this.cdT <= 0) {
        this.state = 'racing';
        HUD.toast('GO!', '#7dff9a');
        AudioSys.blip(990);
      }
      return;
    }
    if (!driving) { this._cancel('you left the car'); return; }
    this.time += dt;
    var p = this.defs[this.race].points[this.checkpoint];
    if (SBUtils.dist2D(px, pz, p[0], p[1]) < 9) {
      this.checkpoint++;
      if (this.checkpoint >= this.defs[this.race].points.length) { this._finish(); return; }
      this._pointBeacon();
      HUD.toast('Checkpoint ' + this.checkpoint + '/' + (this.defs[this.race].points.length - 1) + ' — ' + this.time.toFixed(1) + 's', '#ff7b00');
      AudioSys.blip(880);
    }
  }
};
