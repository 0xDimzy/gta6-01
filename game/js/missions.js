// missions.js — story jobs for Raka, driven by objectiv...
var Missions = {
  defs: [
    { name: 'First Wheels', reward: 250,
      story: 'Raka owes the Bay Street crew $50,000. One stolen coupe is a start — get it to the drop.',
      chain: [
        { kind: 'driveTo', x: 120, z: -120, color: 0xffd23f,
          text: 'Steal a car — then drive to the yellow marker',
          textDriving: 'Drive to the yellow marker' }
      ] },
    { name: 'Package Run', reward: 500,
      story: 'A sealed package, a blue marker, and no questions. The crew is watching. The cops are too.',
      chain: [
        { kind: 'interact', x: -120, z: 120, color: 0x3f8cff,
          text: 'Walk to the blue marker and press E to grab the package',
          textDriving: 'Get out and walk to the blue marker (E to grab the package)',
          heat: 2, grabToast: 'Package grabbed — it is hot! Cops incoming',
          next: { x: 180, z: -60, color: 0x3fd23f } },
        { kind: 'walkTo', x: 180, z: -60, color: 0x3fd23f,
          text: 'Deliver the package to the green marker — the cops are on you',
          textDriving: 'Get out and deliver the package on foot' }
      ] },
    { name: 'Heat Escape', reward: 750,
      story: 'Three stars and every cruiser in the bay on your tail. Vanish, or the debt gets collected in a cell.',
      startHeat: 3, startToast: 'HEAT 3 stars — lose the cops!',
      chain: [
        { kind: 'loseHeat',
          text: 'Lose the 3-star wanted level — break line of sight' }
      ] },
    { name: 'Getaway Driver', reward: 1000,
      story: 'One passenger, ninety seconds, the whole map between you and the harbor. Drive like the money is yours — because it is.',
      chain: [
        { kind: 'interact', x: -180, z: 180, color: 0xc04df0,
          text: 'Walk to the purple marker and press E to pick up the passenger',
          textDriving: 'Get out at the purple marker and pick up the passenger (E)',
          timerForNext: true, timer: 90, grabToast: 'Passenger in — 90 seconds to the harbor!',
          next: { x: 180, z: -180, color: 0x3fd23f } },
        { kind: 'timedDrive', x: 180, z: -180, color: 0x3fd23f,
          text: 'Getaway! Drive the passenger to the green marker',
          failText: 'Out of time — the passenger walked' }
      ] },
    { name: 'Harbor Heist', reward: 1500,
      story: 'The yacht at the marina is worth more than the debt. Take the papers — quiet, on foot — then vanish to the hideout before the harbor wakes up.',
      chain: [
        { kind: 'interact', x: 270, z: 60, color: 0xff5d8f,
          text: 'Walk to the pink marker on the marina pier and press E to grab the yacht papers',
          textDriving: 'Get out at the pink marker on the marina pier (E to grab the papers)',
          heat: 2, timerForNext: true, timer: 120, grabToast: 'Yacht papers grabbed — 120 seconds to the hideout!',
          next: { x: -240, z: -240, color: 0x3fd23f } },
        { kind: 'timedMove', x: -240, z: -240, color: 0x3fd23f,
          text: 'Escape to the hideout',
          failText: 'Out of time — the harbor patrol locked the gates' }
      ] },
    { name: 'Airport Getaway', reward: 2000,
      story: 'The flight manifest at the airport tower names every smuggler in the bay. Grab it, then run the whole map to the buyer on the yacht — 150 seconds, no excuses.',
      chain: [
        { kind: 'interact', x: -282, z: -32, color: 0xff8844,
          text: 'Walk to the orange marker by the airport control tower and press E to grab the flight manifest',
          textDriving: 'Get out at the orange marker by the airport control tower (E to grab the manifest)',
          heat: 2, timerForNext: true, timer: 150, grabToast: 'Flight manifest grabbed — 150 seconds to the buyer on the yacht!',
          next: { x: 270, z: 60, color: 0x3fd23f } },
        { kind: 'timedMove', x: 270, z: 60, color: 0x3fd23f,
          text: 'Run the manifest to the buyer on the yacht',
          failText: 'Out of time — the buyer sailed without you' }
      ] },
    { name: 'Bay Street Payback', reward: 2500,
      story: 'The casino skim is sitting in a duffel behind the old-town arcade. The crew wants it back tonight — and the north hideout is a long, hot drive away.',
      chain: [
        { kind: 'interact', x: -180, z: -180, color: 0xffd23f,
          text: 'Walk to the gold marker behind the arcade and press E to lift the duffel',
          textDriving: 'Get out at the gold marker behind the arcade (E to lift the duffel)',
          heat: 1, timerForNext: true, timer: 120, grabToast: 'Duffel lifted — 120 seconds to the north hideout!',
          next: { x: 60, z: -260, color: 0x3fd23f } },
        { kind: 'timedDrive', x: 60, z: -260, color: 0x3fd23f,
          text: 'Outrun the crew to the north hideout',
          failText: 'Out of time — the crew collected the duffel themselves' }
      ] },
    { name: 'The Last Ferry', reward: 3000,
      story: 'The last ferry out of Solmaris Bay leaves at dawn and the manifest money is on it. Beat the clock to the pier, then get aboard before it casts off.',
      chain: [
        { kind: 'timedDrive', x: 245, z: 150, color: 0x3f8cff, timer: 100,
          text: 'Drive to the harbor pier — the ferry leaves soon',
          failText: 'Out of time — the ferry left without the money' },
        { kind: 'interact', x: 270, z: 60, color: 0xffd23f, timer: 60,
          text: 'Board the ferry — press E at the gangway',
          textDriving: 'Get out at the gangway and press E to board',
          failText: 'Out of time — the gangway is up' }
      ] },
    { name: 'Harbor Smuggle', reward: 3500,
      story: 'The ferry money bought Raka one night of trust — now the crew wants a hot cargo run across the harbor before the patrols change shift.',
      startHeat: 3, startToast: 'HEAT 3 stars — the harbor patrol is awake!',
      chain: [
        { kind: 'timedDrive', x: 180, z: 60, color: 0x3f8cff, timer: 90,
          text: 'Smuggle run — drive the cargo to the east pier',
          failText: 'Out of time — the patrol sealed the pier' },
        { kind: 'timedDrive', x: -60, z: 180, color: 0x3f8cff, timer: 90,
          text: 'Second drop — north warehouse, keep moving',
          failText: 'Out of time — the buyer walked' },
        { kind: 'timedDrive', x: -180, z: -60, color: 0x3fd23f, timer: 100,
          text: 'Last drop — west hideout, then you are clear',
          failText: 'Out of time — the crew cut you loose' }
      ] },
    { name: 'Midnight Circuit', reward: 4000,
      story: 'The Bay Street crew runs a midnight street circuit and Raka is the entry fee — three markers, one clock, no brakes.',
      chain: [
        { kind: 'timedDrive', x: 120, z: 120, color: 0xffd23f, timer: 60,
          text: 'Midnight Circuit — hit the first marker',
          failText: 'Out of time — the circuit left without you' },
        { kind: 'timedDrive', x: -120, z: 120, color: 0xffd23f, timer: 60,
          text: 'Second marker — keep the line clean',
          failText: 'Out of time — the crew took the pot' },
        { kind: 'timedDrive', x: -120, z: -120, color: 0x3fd23f, timer: 70,
          text: 'Final marker — bring it home',
          failText: 'Out of time — the pot is gone' }
      ] },
    { name: 'Escort Ambush', reward: 4500,
      story: 'A crew courier got jumped downtown and the payoff case is sitting in the open — grab it, then vanish before four stars bury you.',
      chain: [
        { kind: 'interact', x: 60, z: 60, color: 0xff5d8f,
          text: 'Walk to the pink marker and press E to grab the payoff case',
          textDriving: 'Get out at the pink marker (E to grab the case)',
          heat: 4, grabToast: 'Case grabbed — HEAT 4 stars, ambush incoming!',
          next: { x: -180, z: 180, color: 0x3fd23f } },
        { kind: 'loseHeat',
          text: 'Lose the 4-star wanted level — break line of sight and stay dark' }
      ] },
    { name: 'Syndicate Payoff', reward: 6000,
      story: 'One last score clears the $50,000 for good: lift the syndicate ledger, run it across the bay, then disappear like you were never here.',
      chain: [
        { kind: 'interact', x: 0, z: -120, color: 0xff8844,
          text: 'Walk to the orange marker and press E to lift the syndicate ledger',
          textDriving: 'Get out at the orange marker (E to lift the ledger)',
          heat: 3, timerForNext: true, timer: 120, grabToast: 'Ledger lifted — 120 seconds to the drop, cops incoming!',
          next: { x: 180, z: 120, color: 0x3fd23f } },
        { kind: 'timedDrive', x: 180, z: 120, color: 0x3fd23f,
          text: 'Run the ledger to the harbor drop',
          failText: 'Out of time — the syndicate collected instead' },
        { kind: 'loseHeat',
          text: 'Lose the heat — vanish and the debt is paid' }
      ] }
  ],
  active: -1,
  state: 'none',
  step: 0,
  autoNext: 0,
  time: 0,
  timer: 0,
  beacon: null,
  beaconMark: null,
  pillarMat: null,
  markMat: null,
  ringMat: null,
  blipHex: 0xffd23f,
  lastPayout: null,
  halfPayout: false,
  failedIdx: -1,
  payoutScale: 1,

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

  // the step currently running, or null when no job is ac...
  _currentStep: function () {
    if (this.state !== 'active' || this.active < 0) return null;
    var chain = this.defs[this.active].chain;
    return this.step < chain.length ? chain[this.step] : null;
  },

  // point the beacon at a step (or at its `next` override...
  _enterStep: function (step) {
    if (!step) return;
    if (step.x != null) this._setBeacon(step.x, step.z, step.color);
    else if (step.next) this._setBeacon(step.next.x, step.next.z, step.next.color);
    else this._setBeacon(null);
    if (step.timer && !step.timerForNext) this.timer = step.timer;
  },

  startMission: function (i) {
    this.active = i;
    this.state = 'active';
    this.step = 0;
    this.autoNext = 0;
    this.timer = 0;
    // a failed job pays half on the retry — but only for TH...
    if (this.halfPayout && i !== this.failedIdx) {
      this.halfPayout = false;
      this.failedIdx = -1;
    }
    var def = this.defs[i];
    HUD.showStory(def.story);
    SBBus.emit('mission-start', def);
    if (def.startHeat) {
      Police.setWanted(def.startHeat);
      if (def.startToast) HUD.toast(def.startToast, '#ff4444');
    }
    if (this.halfPayout) {
      HUD.toast('Retry pays half — $' + Math.floor(def.reward / 2) + ' on the line', '#ffaa00');
    }
    this._enterStep(def.chain[0]);
    AudioSys.blip(880);
  },

  // advance to the next step of the chain; finish the job...
  _advance: function () {
    this.step++;
    var def = this.defs[this.active];
    if (this.step >= def.chain.length) { this.complete(); return; }
    var step = def.chain[this.step];
    this._enterStep(step);
    if (step.text) HUD.toast(step.text, '#ffd23f');
    AudioSys.blip(990);
  },

  // E key: take the current step when it is an interact s...
  tryInteract: function () {
    var step = this._currentStep();
    if (!step || step.kind !== 'interact') return false;
    if (Vehicle.isDriving()) return false;
    if (SBUtils.dist2D(Player.x, Player.z, step.x, step.z) >= 3.5) return false;
    if (step.heat) Police.setWanted(step.heat);
    if (step.grabToast) HUD.toast(step.grabToast, '#ffaa00');
    AudioSys.blip(990);
    this._advance();
    // the grab's clock starts now and runs through the esca...
    if (step.timerForNext && step.timer) this.timer = step.timer;
    return true;
  },

  complete: function () {
    var def = this.defs[this.active];
    var scale = this.payoutScale || 1;
    // a retried job pays half — the crew already paid for t...
    var reward = this.halfPayout ? Math.floor(def.reward * scale / 2) : Math.round(def.reward * scale);
    // clean getaway: finish a job at full health and the cr...
    var bonus = Game.health >= 100 ? Math.round(50 * scale) : 0;
    var bonusParts = [];
    if (bonus > 0) bonusParts.push('clean getaway +$' + bonus);
    // fast finish: beat a timed leg with 30+ seconds to spa...
    if (this.timer > 30) {
      bonus += 150;
      bonusParts.push('fast finish +$150');
    }
    var bonusText = bonusParts.length > 0 ? 'Bonus ' + bonusParts.join(' · ') : '';
    Game.money += reward + bonus;
    if (Game.stats) {
      Game.stats.missionsDone++;
      Game.stats.cashEarned += reward + bonus;
    }
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
    // the retry keeps half the payout: the crew docks you f...
    this.halfPayout = true;
    this.failedIdx = this.active;
    this._setBeacon(null);
    HUD.toast((reason || 'Mission failed') + ' — retry pays half ($' + Math.floor(this.defs[this.active].reward / 2) + ')', '#ff4444');
    SBBus.emit('mission-fail', { mission: this.defs[this.active], reason: reason || 'failed' });
  },

  getObjective: function () {
    if (this.state === 'failed') return 'Mission failed — press R to retry (pays half)';
    if (this.state === 'done') return 'Mission complete! Next job coming up…';
    var step = this._currentStep();
    if (!step) return null;
    var driving = Vehicle.isDriving();
    var text = (driving && step.textDriving) ? step.textDriving : step.text;
    if (this.timer > 0) text += ' — ' + Math.ceil(this.timer) + 's left';
    return text;
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

  // one step's win condition, checked every frame while a...
  _stepDone: function (step, px, pz, driving) {
    var reach = step.kind === 'driveTo' || step.kind === 'timedDrive' ? 9 : 4;
    switch (step.kind) {
      case 'driveTo':
        return driving && SBUtils.dist2D(px, pz, step.x, step.z) < reach;
      case 'walkTo':
        return !driving && SBUtils.dist2D(px, pz, step.x, step.z) < reach;
      case 'timedDrive':
        return driving && SBUtils.dist2D(px, pz, step.x, step.z) < reach;
      case 'timedMove':
        return SBUtils.dist2D(px, pz, step.x, step.z) < 9;
      case 'loseHeat':
        return Police.getWanted() === 0;
      case 'interact':
        return false;
      default:
        return false;
    }
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
    var step = this._currentStep();
    if (!step) return;
    // timed steps run their clock down; zero means the job...
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0;
        this.fail(step.failText || 'Out of time');
        return;
      }
    }
    var px = Vehicle.isDriving() ? Vehicle.drivable.x : Player.x;
    var pz = Vehicle.isDriving() ? Vehicle.drivable.z : Player.z;
    if (this._stepDone(step, px, pz, Vehicle.isDriving())) this._advance();
  }
};
