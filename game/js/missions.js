// missions.js — 5 missions: beacon, state machine, rewards, story lines,
// mission timers with a fast-finish bonus, fail-and-retry keeps half pay
var Missions = {
  defs: [
    { name: 'First Wheels', reward: 250,
      story: 'Raka owes the Bay Street crew $50,000. One stolen coupe is a start — get it to the drop.' },
    { name: 'Package Run', reward: 500,
      story: 'A sealed package, a blue marker, and no questions. The crew is watching. The cops are too.' },
    { name: 'Heat Escape', reward: 750,
      story: 'Three stars and every cruiser in the bay on your tail. Vanish, or the debt gets collected in a cell.' },
    { name: 'Getaway Driver', reward: 1000,
      story: 'One passenger, ninety seconds, the whole map between you and the harbor. Drive like the money is yours — because it is.' },
    { name: 'Harbor Heist', reward: 1500,
      story: 'The yacht at the marina is worth more than the debt. Take the papers — quiet, on foot — then vanish to the hideout before the harbor wakes up.' }
  ],
  active: -1,
  state: 'none', // none | active | done | failed
  step: 0,
  autoNext: 0,
  time: 0,
  timer: 0, // mission 4 + 5 countdown
  beacon: null,
  beaconMark: null,
  pillarMat: null,
  markMat: null,
  ringMat: null,
  blipHex: 0xffd23f,
  lastPayout: null, // {reward, bonus, total, bonusText} of the last completed job
  halfPayout: false, // a failed job pays half when you retry it
  failedIdx: -1,

  build: function (scene) {
    this.scene = scene;
    var g = new THREE.Group();
    this.pillarMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
    var pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 70, 12, 1, true), this.pillarMat);
    pillar.position.y = 35;
    g.add(pillar);
    this.markMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    var mark = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), this.markMat);
    mark.position.y = 5;
    g.add(mark);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    var ring = new THREE.Mesh(new THREE.RingGeometry(3, 4, 28), this.ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    g.add(ring);
    g.visible = false;
    scene.add(g);
    this.beacon = g;
    this.beaconMark = mark;
  },

  _setBeacon: function (x, z, color) {
    if (x == null) { this.beacon.visible = false; return; }
    this.blipHex = color;
    this.beacon.position.set(x, 0, z);
    this.pillarMat.color.setHex(color);
    this.markMat.color.setHex(color);
    this.ringMat.color.setHex(color);
    this.beacon.visible = true;
  },

  startMission: function (i) {
    this.active = i;
    this.state = 'active';
    this.step = 0;
    this.autoNext = 0;
    this.timer = 0;
    // a failed job pays half on the retry — but only for THAT job; a
    // different job starts clean
    if (this.halfPayout && i !== this.failedIdx) {
      this.halfPayout = false;
      this.failedIdx = -1;
    }
    var def = this.defs[i];
    HUD.showStory(def.story);
    SBBus.emit('mission-start', def);
    if (i === 0) {
      this._setBeacon(120, -120, 0xffd23f);
    } else if (i === 1) {
      this._setBeacon(-120, 120, 0x3f8cff);
    } else if (i === 2) {
      this._setBeacon(null);
      Police.setWanted(3);
      HUD.toast('HEAT 3 stars — lose the cops!', '#ff4444');
    } else if (i === 3) {
      // getaway: pick the passenger up on the far west side first
      this._setBeacon(-180, 180, 0xc04df0);
    } else if (i === 4) {
      // harbor heist: the yacht papers wait on the marina pier
      this._setBeacon(270, 60, 0xff5d8f);
      if (this.halfPayout) HUD.toast('Retry pays half — $750 on the line', '#ffaa00');
    }
    AudioSys.blip(880);
  },

  // E key near a pickup point (mission 2 package, mission 4 passenger,
  // mission 5 yacht papers)
  tryInteract: function () {
    if (this.state === 'active' && this.active === 1 && this.step === 0 && !Vehicle.isDriving()) {
      if (SBUtils.dist2D(Player.x, Player.z, -120, 120) < 3.5) {
        this.step = 1;
        this._setBeacon(180, -60, 0x3fd23f);
        Police.setWanted(2);
        HUD.toast('Package grabbed — it is hot! Cops incoming', '#ffaa00');
        AudioSys.blip(990);
        return true;
      }
    }
    if (this.state === 'active' && this.active === 3 && this.step === 0 && !Vehicle.isDriving()) {
      if (SBUtils.dist2D(Player.x, Player.z, -180, 180) < 3.5) {
        this.step = 1;
        this.timer = 90;
        this._setBeacon(180, -180, 0x3fd23f);
        HUD.toast('Passenger in — 90 seconds to the harbor!', '#ffaa00');
        AudioSys.blip(990);
        return true;
      }
    }
    if (this.state === 'active' && this.active === 4 && this.step === 0 && !Vehicle.isDriving()) {
      if (SBUtils.dist2D(Player.x, Player.z, 270, 60) < 3.5) {
        this.step = 1;
        this.timer = 120;
        this._setBeacon(-240, -240, 0x3fd23f);
        Police.setWanted(2);
        HUD.toast('Yacht papers grabbed — 120 seconds to the hideout!', '#ffaa00');
        AudioSys.blip(990);
        return true;
      }
    }
    return false;
  },

  complete: function () {
    var def = this.defs[this.active];
    // a retried job pays half — the crew already paid for the first try
    var reward = this.halfPayout ? Math.floor(def.reward / 2) : def.reward;
    // clean getaway: finish a job at full health and the crew pays a bonus
    var bonus = Game.health >= 100 ? 50 : 0;
    var bonusParts = [];
    if (bonus > 0) bonusParts.push('clean getaway +$50');
    // fast finish: beat a timed leg with 30+ seconds to spare, +$150
    if (this.timer > 30) {
      bonus += 150;
      bonusParts.push('fast finish +$150');
    }
    var bonusText = bonusParts.length > 0 ? 'Bonus ' + bonusParts.join(' · ') : '';
    Game.money += reward + bonus;
    this.lastPayout = { reward: reward, bonus: bonus, total: reward + bonus, bonusText: bonusText };
    this.state = 'done';
    this.autoNext = 2.5;
    this.halfPayout = false;
    this.failedIdx = -1;
    this._setBeacon(null);
    HUD.toast('Mission complete: ' + def.name + '  +$' + (reward + bonus), '#7dff9a');
    HUD.showSummary(def, Game.money, this.lastPayout);
    SBBus.emit('mission-complete', def);
    AudioSys.jingle();
    AudioSys.chaChing();
  },

  fail: function (reason) {
    if (this.state !== 'active') return;
    this.state = 'failed';
    // the retry keeps half the payout: the crew docks you for the failure
    this.halfPayout = true;
    this.failedIdx = this.active;
    this._setBeacon(null);
    HUD.toast((reason || 'Mission failed') + ' — retry pays half ($' + Math.floor(this.defs[this.active].reward / 2) + ')', '#ff4444');
    SBBus.emit('mission-fail', { mission: this.defs[this.active], reason: reason || 'failed' });
  },

  getObjective: function () {
    if (this.state === 'failed') return 'Mission failed — press R to retry (pays half)';
    if (this.state === 'done') return 'Mission complete! Next job coming up…';
    if (this.state !== 'active') return null;
    if (this.active === 0) {
      return Vehicle.isDriving()
        ? 'Drive to the yellow marker'
        : 'Steal a car — then drive to the yellow marker';
    }
    if (this.active === 1) {
      if (this.step === 0) {
        return Vehicle.isDriving()
          ? 'Get out and walk to the blue marker (E to grab the package)'
          : 'Walk to the blue marker and press E to grab the package';
      }
      return Vehicle.isDriving()
        ? 'Get out and deliver the package on foot'
        : 'Deliver the package to the green marker — the cops are on you';
    }
    if (this.active === 2) return 'Lose the 3-star wanted level — break line of sight';
    if (this.active === 3) {
      if (this.step === 0) {
        return Vehicle.isDriving()
          ? 'Get out at the purple marker and pick up the passenger (E)'
          : 'Walk to the purple marker and press E to pick up the passenger';
      }
      return 'Getaway! Drive the passenger to the green marker — ' + Math.ceil(this.timer) + 's left';
    }
    if (this.active === 4) {
      if (this.step === 0) {
        return Vehicle.isDriving()
          ? 'Get out at the pink marker on the marina pier (E to grab the papers)'
          : 'Walk to the pink marker on the marina pier and press E to grab the yacht papers';
      }
      return 'Escape to the hideout — ' + Math.ceil(this.timer) + 's left';
    }
    return null;
  },

  // minimap blip for the active beacon, or null
  getBlip: function () {
    if (this.state !== 'active' || !this.beacon.visible) return null;
    return {
      x: this.beacon.position.x,
      z: this.beacon.position.z,
      color: '#' + this.blipHex.toString(16).padStart(6, '0')
    };
  },

  update: function (dt) {
    this.time += dt;
    if (this.beacon.visible) {
      this.beaconMark.rotation.y += dt * 1.5;
      this.beaconMark.position.y = 5 + Math.sin(this.time * 2) * 0.6;
      this.pillarMat.opacity = 0.13 + 0.06 * Math.sin(this.time * 3);
    }
    if (this.state === 'done') {
      this.autoNext -= dt;
      if (this.autoNext <= 0) {
        var n = this.active + 1;
        if (n < this.defs.length) this.startMission(n);
        else { this.state = 'none'; this.active = -1; this._setBeacon(null); }
      }
      return;
    }
    if (this.state !== 'active') return;
    var px = Vehicle.isDriving() ? Vehicle.drivable.x : Player.x;
    var pz = Vehicle.isDriving() ? Vehicle.drivable.z : Player.z;
    if (this.active === 0) {
      if (Vehicle.isDriving() && SBUtils.dist2D(px, pz, 120, -120) < 9) this.complete();
    } else if (this.active === 1) {
      if (this.step === 1 && !Vehicle.isDriving() && SBUtils.dist2D(px, pz, 180, -60) < 4) this.complete();
    } else if (this.active === 2) {
      if (Police.getWanted() === 0) this.complete();
    } else if (this.active === 3) {
      if (this.step === 1) {
        this.timer -= dt;
        if (this.timer <= 0) { this.timer = 0; this.fail('Out of time — the passenger walked'); return; }
        if (Vehicle.isDriving() && SBUtils.dist2D(px, pz, 180, -180) < 9) this.complete();
      }
    } else if (this.active === 4) {
      if (this.step === 1) {
        this.timer -= dt;
        if (this.timer <= 0) { this.timer = 0; this.fail('Out of time — the harbor patrol locked the gates'); return; }
        // escape on foot or by car: the hideout takes whoever gets there
        if (SBUtils.dist2D(px, pz, -240, -240) < 9) this.complete();
      }
    }
  }
};
