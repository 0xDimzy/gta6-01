// combat.js — shooting in Solmaris Bay.
var Combat = {
  // the weapon table: damage is per pellet, range in worl...
  WEAPONS: {
    pistol: { label: 'Pistol', damage: 12, range: 120, cooldown: 0.28, pellets: 1, spread: 0.0, kick: 0.03, recoil: 0.6, flash: 4, mag: 12, reserveMax: 48, sound: 'shot', color: 0x7dff9a, pickup: [20, -20] },
    shotgun: { label: 'Shotgun', damage: 9, range: 45, cooldown: 0.7, pellets: 5, spread: 0.09, kick: 0.06, recoil: 1.0, flash: 7, mag: 6, reserveMax: 18, sound: 'boom', color: 0xff8844, pickup: [-140, -100] },
    sniper: { label: 'Sniper rifle', damage: 60, range: 220, cooldown: 1.2, pellets: 1, spread: 0.0, kick: 0.09, recoil: 1.0, flash: 9, mag: 5, reserveMax: 10, sound: 'boom', color: 0xc04df0, pickup: [-240, -240] },
    smg: { label: 'SMG', damage: 6, range: 70, cooldown: 0.09, pellets: 1, spread: 0.05, kick: 0.02, recoil: 0.35, flash: 3, mag: 24, reserveMax: 96, sound: 'shot', color: 0x3f8cff, pickup: [140, 140] }
  },
  armed: false,
  weapon: 'pistol',
  ammo: 0,
  shells: 0,
  sniperAmmo: 0,
  smgAmmo: 0,
  // reserve pool per weapon: R reloads the gun in hand fr...
  reserve: { pistol: 24, shotgun: 6, sniper: 5, smg: 48 },
  hasShotgun: false,
  hasSniper: false,
  hasSmg: false,
  scoped: false,
  prevX: false,
  pickup: null,
  pickupGlow: null,
  pickupTaken: false,
  shotgunPickup: null,
  shotgunGlow: null,
  shotgunTaken: false,
  sniperPickup: null,
  sniperGlow: null,
  sniperTaken: false,
  smgPickup: null,
  smgGlow: null,
  smgTaken: false,
  ammoBoxes: [],
  tracer: null,
  flash: null,
  flashT: 0,
  shotCd: 0,
  spark: null,
  sparkT: 0,
  prevF: false,
  prevQ: false,
  prevR: false,
  prevV: false,
  outOfAmmoToast: false,
  hitEl: null,
  hitT: 0,
  raycaster: null,
  recoil: 0,
  shoveCd: 0,
  lastStandT: 0,
  lastStandUsed: false,
  timeScale: 1,

  build: function (scene) {
    this.scene = scene;
    // one pickup per weapon, built from the same table that...
    var defs = [
      { key: 'pistol', field: 'pickup', glowField: 'pickupGlow', boxColor: 0x222222, boxW: 0.9, boxH: 0.3, boxD: 0.3 },
      { key: 'shotgun', field: 'shotgunPickup', glowField: 'shotgunGlow', boxColor: 0x3a2a1a, boxW: 1.1, boxH: 0.3, boxD: 0.3 },
      { key: 'sniper', field: 'sniperPickup', glowField: 'sniperGlow', boxColor: 0x1a1a2e, boxW: 1.4, boxH: 0.3, boxD: 0.25 },
      { key: 'smg', field: 'smgPickup', glowField: 'smgGlow', boxColor: 0x1a2e3a, boxW: 1.0, boxH: 0.3, boxD: 0.3 }
    ];
    for (var d = 0; d < defs.length; d++) {
      var spec = defs[d];
      var wdef = this.WEAPONS[spec.key];
      var g = new THREE.Group();
      var box = new THREE.Mesh(new THREE.BoxGeometry(spec.boxW, spec.boxH, spec.boxD), new THREE.MeshLambertMaterial({ color: spec.boxColor }));
      box.position.y = 0.4; box.castShadow = true; g.add(box);
      var glow = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), new THREE.MeshBasicMaterial({ color: wdef.color }));
      glow.position.y = 1.6; g.add(glow);
      g.position.set(wdef.pickup[0], 0, wdef.pickup[1]);
      scene.add(g);
      this[spec.field] = g;
      this[spec.glowField] = glow;
    }
    // ammo boxes that respawn: refill the reserves, not the...
    var boxSpots = [[60, 60], [-60, -140]];
    for (var i = 0; i < boxSpots.length; i++) {
      var ab = new THREE.Group();
      var crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: 0x5a7c3a }));
      crate.position.y = 0.45; crate.castShadow = true; ab.add(crate);
      var aglow = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      aglow.position.y = 1.5; ab.add(aglow);
      ab.position.set(boxSpots[i][0], 0, boxSpots[i][1]);
      scene.add(ab);
      this.ammoBoxes.push({ group: ab, glow: aglow, x: boxSpots[i][0], z: boxSpots[i][1], taken: false, respawnT: 0 });
    }
    // tracer line (2 points, hidden until a shot)
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
    this.tracer.frustumCulled = false;
    scene.add(this.tracer);
    // muzzle flash light
    this.flash = new THREE.PointLight(0xffcc66, 0, 25);
    scene.add(this.flash);
    // hit spark
    this.spark = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.spark.visible = false;
    scene.add(this.spark);
    // hit marker: white X that flashes at screen centre on...
    var hm = document.createElement('div');
    hm.id = 'hud-hitmarker';
    hm.textContent = '✕';
    hm.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:34px;font-weight:900;color:#fff;text-shadow:0 0 6px #000,0 0 2px #000;z-index:6;pointer-events:none;opacity:0';
    document.body.appendChild(hm);
    this.hitEl = hm;
    this.raycaster = new THREE.Raycaster();
  },

  _isPoliceGroup: function (obj) {
    var o = obj;
    while (o) {
      if (o.userData && o.userData.police) return true;
      o = o.parent;
    }
    return false;
  },

  _spark: function (point, color) {
    this.spark.position.copy(point);
    this.spark.material.color.setHex(color);
    this.spark.visible = true;
    this.sparkT = 0.12;
  },

  // flash the hit marker for 0.15 s
  showHit: function () {
    if (!this.hitEl) return;
    this.hitEl.style.opacity = '1';
    this.hitT = 0.15;
  },

  // rounds left in the magazine of the gun in hand
  _magAmmo: function () {
    if (this.weapon === 'shotgun') return this.shells;
    if (this.weapon === 'sniper') return this.sniperAmmo;
    if (this.weapon === 'smg') return this.smgAmmo;
    return this.ammo;
  },

  // write a magazine count back to the per-weapon field (...
  _setMagAmmo: function (n) {
    if (this.weapon === 'shotgun') this.shells = n;
    else if (this.weapon === 'sniper') this.sniperAmmo = n;
    else if (this.weapon === 'smg') this.smgAmmo = n;
    else this.ammo = n;
  },

  // reload the gun in hand from its reserve pool (R)
  reload: function () {
    var wdef = this.WEAPONS[this.weapon];
    var have = this._magAmmo();
    var need = wdef.mag - have;
    if (need <= 0) return false;
    var pool = this.reserve[this.weapon];
    if (pool <= 0) {
      HUD.toast('No reserve ammo for the ' + wdef.label + '!', '#ff8844');
      return false;
    }
    var moved = Math.min(need, pool);
    this.reserve[this.weapon] = pool - moved;
    this._setMagAmmo(have + moved);
    this.outOfAmmoToast = false;
    HUD.toast(wdef.label + ' reloaded — ' + (have + moved) + ' rounds', '#7dff9a');
    AudioSys.blip(660);
    return true;
  },

  // a pedestrian takes a hit: heavier guns knock them dow...
  _hitPed: function (ped, weapon, point) {
    var wdef = this.WEAPONS[weapon];
    Traffic.knockDown(ped, 'shot');
    if (wdef.damage >= 30) {
      // sniper: the ped goes down hard and stays down
      ped.downT = Math.max(ped.downT || 0, 4);
    } else if (wdef.damage >= 9) {
      ped.downT = Math.max(ped.downT || 0, 2.5);
    }
    this._spark(point, 0xffcc44);
    this.showHit();
  },

  // a police cruiser takes a hit: cruisers carry 100 HP,...
  _hitCruiser: function (car, weapon, point, policeStarred) {
    var wdef = this.WEAPONS[weapon];
    if (car.hp == null) car.hp = 100;
    car.hp -= wdef.damage;
    if (!policeStarred.hit) {
      policeStarred.hit = true;
      Police.addWanted(1, 'shooting');
      HUD.toast('You shot a cop car!  +1 star', '#ff4444');
    }
    this._spark(point, 0xffcc44);
    this.showHit();
    if (car.hp <= 0 && !car.disabled) {
      car.disabled = true;
      car.speed = 0;
      car.lightL.visible = false;
      car.lightR.visible = false;
      HUD.toast('Cruiser disabled!', '#7dff9a');
      AudioSys.blip(180);
    }
  },

  // one pellet ray; returns the hit point (or null) and a...
  _firePellet: function (origin, dir, policeStarred) {
    this.raycaster.set(origin, dir);
    this.raycaster.far = this.WEAPONS[this.weapon].range;
    var targets = [];
    for (var i = 0; i < World.buildings.length; i++) targets.push(World.buildings[i]);
    for (var j = 0; j < Traffic.peds.length; j++) targets.push(Traffic.peds[j].group);
    for (var k = 0; k < Police.cars.length; k++) targets.push(Police.cars[k].group);
    var hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length === 0) return origin.clone().add(dir.clone().multiplyScalar(this.WEAPONS[this.weapon].range));
    var h = hits[0];
    var ped = null;
    var o = h.object;
    while (o) {
      if (o.userData && o.userData.ped) { ped = o.userData.ped; break; }
      o = o.parent;
    }
    if (ped) {
      this._hitPed(ped, this.weapon, h.point);
    } else if (this._isPoliceGroup(h.object)) {
      // find which cruiser record owns this mesh: walk up the...
      var car = null;
      var anc = h.object;
      while (anc && !car) {
        for (var c = 0; c < Police.cars.length; c++) {
          if (Police.cars[c].group === anc) { car = Police.cars[c]; break; }
        }
        anc = anc.parent;
      }
      if (car && !car.disabled) this._hitCruiser(car, this.weapon, h.point, policeStarred);
      else { this._spark(h.point, 0xffcc44); this.showHit(); }
    } else {
      this._spark(h.point, 0xffffff);
    }
    return h.point;
  },

  shoot: function () {
    var wdef = this.WEAPONS[this.weapon];
    if (this._magAmmo() <= 0) {
      if (!this.outOfAmmoToast) {
        HUD.toast('Out of ' + wdef.label.toLowerCase() + ' ammo! (R to reload, Q to switch)', '#ff8844');
        this.outOfAmmoToast = true;
      }
      this.shotCd = 0.3;
      return;
    }
    this._setMagAmmo(this._magAmmo() - 1);
    this.shotCd = wdef.cooldown;
    if (wdef.sound === 'boom') AudioSys.boom();
    else AudioSys.shot();
    if (Game.stats) Game.stats.shotsFired++;
    // recoil: the camera kicks up and the crosshair jumps —...
    this.recoil = wdef.recoil;
    Camera.kick(wdef.kick);
    var cam = Game.camera;
    var origin = cam.position.clone();
    var dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    var policeStarred = { hit: false };
    var end;
    if (wdef.pellets > 1) {
      // a spread gun fires a cone of pellets around the aim line
      var right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0);
      var up = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1);
      end = origin.clone();
      for (var p = 0; p < wdef.pellets; p++) {
        var pd = dir.clone();
        pd.add(right.clone().multiplyScalar((Math.random() - 0.5) * wdef.spread * 2));
        pd.add(up.clone().multiplyScalar((Math.random() - 0.5) * wdef.spread * 2));
        pd.normalize();
        var hit = this._firePellet(origin, pd, policeStarred);
        if (p === 0) end = hit;
      }
    } else {
      // a scoped sniper fires dead straight — no spread at all
      end = this._firePellet(origin, dir, policeStarred);
    }
    Traffic.onShot(Player.x, Player.z);
    Camera.shake(wdef.kick * 4);
    // tracer from the gun to the hit point
    var start = new THREE.Vector3(Player.x, 1.4, Player.z);
    var pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, start.x, start.y, start.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    this.tracer.material.opacity = 0.9;
    this.flash.position.set(start.x, start.y, start.z);
    this.flash.intensity = wdef.flash;
    this.flashT = 0.08;
  },

  // melee shove (V): knock the nearest pedestrian back 3...
  shove: function () {
    if (this.shoveCd > 0) return;
    var best = null, bestD = 2.5;
    for (var i = 0; i < Traffic.peds.length; i++) {
      var ped = Traffic.peds[i];
      if (ped.state !== 'walk') continue;
      var d = SBUtils.dist2D(Player.x, Player.z, ped.x, ped.z);
      if (d < bestD) { bestD = d; best = ped; }
    }
    if (!best) return;
    this.shoveCd = 0.6;
    var dx = best.x - Player.x, dz = best.z - Player.z;
    var dl = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
    best.x += dx / dl * 3;
    best.z += dz / dl * 3;
    best.x = SBUtils.clamp(best.x, -288, 288);
    best.z = SBUtils.clamp(best.z, -288, 294);
    best.state = 'down';
    best.downT = 1.5;
    best.group.rotation.z = Math.PI / 2;
    best.group.position.set(best.x, 0, best.z);
    Camera.shake(0.12);
    AudioSys.blip(200);
  },

  // F near a pickup: take the weapon, load its magazine,...
  _tryPickup: function () {
    var spots = [
      { key: 'pistol', taken: 'pickupTaken', group: 'pickup', own: null, msg: 'Pistol picked up — click to shoot' },
      { key: 'shotgun', taken: 'shotgunTaken', group: 'shotgunPickup', own: 'hasShotgun', msg: 'Shotgun picked up — 6 shells, wide spread (Q to switch)' },
      { key: 'sniper', taken: 'sniperTaken', group: 'sniperPickup', own: 'hasSniper', msg: 'Sniper rifle picked up — 5 rounds, long range (X to scope)' },
      { key: 'smg', taken: 'smgTaken', group: 'smgPickup', own: 'hasSmg', msg: 'SMG picked up — 24 rounds, hold the trigger (Q to switch)' }
    ];
    for (var s = 0; s < spots.length; s++) {
      var spot = spots[s];
      var wdef = this.WEAPONS[spot.key];
      if (!this[spot.taken] && SBUtils.dist2D(Player.x, Player.z, wdef.pickup[0], wdef.pickup[1]) < 3) {
        this[spot.taken] = true;
        if (spot.own) this[spot.own] = true;
        this.armed = true;
        this.weapon = spot.key;
        this._setMagAmmo(wdef.mag);
        this.outOfAmmoToast = false;
        this[spot.group].visible = false;
        HUD.toast(spot.msg, '#7dff9a');
        AudioSys.blip(990);
        return true;
      }
    }
    // ammo box: tops up every reserve pool at once
    for (var bi = 0; bi < this.ammoBoxes.length; bi++) {
      var box2 = this.ammoBoxes[bi];
      if (!box2.taken && SBUtils.dist2D(Player.x, Player.z, box2.x, box2.z) < 3) {
        box2.taken = true;
        box2.respawnT = 20;
        box2.group.visible = false;
        this.reserve.pistol = Math.min(this.WEAPONS.pistol.reserveMax, this.reserve.pistol + 12);
        this.reserve.shotgun = Math.min(this.WEAPONS.shotgun.reserveMax, this.reserve.shotgun + 6);
        this.reserve.sniper = Math.min(this.WEAPONS.sniper.reserveMax, this.reserve.sniper + 4);
        this.reserve.smg = Math.min(this.WEAPONS.smg.reserveMax, this.reserve.smg + 24);
        this.outOfAmmoToast = false;
        HUD.toast('Ammo restocked — reserves topped up', '#7dff9a');
        AudioSys.blip(990);
        return true;
      }
    }
    return false;
  },

  update: function (dt) {
    // recoil settles back fast; the HUD reads it for the cr...
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 4);
    if (this.shoveCd > 0) this.shoveCd -= dt;
    // last stand: the first time health drops to 10 or belo...
    if (Game.health <= 10 && Game.health > 0 && !this.lastStandUsed) {
      this.lastStandUsed = true;
      this.lastStandT = 3;
      this.timeScale = 0.5;
      HUD.toast('LAST STAND — everything slows down', '#ff4444');
      AudioSys.sting();
    }
    if (this.lastStandT > 0) {
      this.lastStandT -= dt;
      if (this.lastStandT <= 0) this.timeScale = 1;
    }
    if (this.lastStandUsed && Game.health > 30) this.lastStandUsed = false;
    if (this.flashT > 0) {
      this.flashT -= dt;
      var f = Math.max(0, this.flashT / 0.08);
      this.flash.intensity = f * this.WEAPONS[this.weapon].flash;
      this.tracer.material.opacity = f * 0.9;
      if (this.flashT <= 0) { this.tracer.material.opacity = 0; this.flash.intensity = 0; }
    }
    if (this.sparkT > 0) {
      this.sparkT -= dt;
      if (this.sparkT <= 0) this.spark.visible = false;
    }
    if (this.hitT > 0) {
      this.hitT -= dt;
      if (this.hitT <= 0 && this.hitEl) this.hitEl.style.opacity = '0';
    }
    if (this.shotCd > 0) this.shotCd -= dt;
    if (this.pickupGlow) this.pickupGlow.rotation.y += dt * 2;
    if (this.shotgunGlow) this.shotgunGlow.rotation.y += dt * 2;
    if (this.sniperGlow) this.sniperGlow.rotation.y += dt * 2;
    if (this.smgGlow) this.smgGlow.rotation.y += dt * 2;
    // ammo box respawns (20 s) + glow spin
    for (var ai = 0; ai < this.ammoBoxes.length; ai++) {
      var ab = this.ammoBoxes[ai];
      if (ab.taken) {
        ab.respawnT -= dt;
        if (ab.respawnT <= 0) {
          ab.taken = false;
          ab.group.visible = true;
        }
      } else if (ab.glow) ab.glow.rotation.y += dt * 2;
    }
    // F near a pickup to take it (any weapon, or an ammo box)
    var keyF = Input.down('KeyF');
    if (keyF && !this.prevF && !Vehicle.isDriving()) this._tryPickup();
    this.prevF = keyF;
    // Q cycles through every weapon you own — pistol, shotg...
    var keyQ = Input.down('KeyQ');
    if (keyQ && !this.prevQ && this.armed) {
      var owned = ['pistol'];
      if (this.hasShotgun) owned.push('shotgun');
      if (this.hasSniper) owned.push('sniper');
      if (this.hasSmg) owned.push('smg');
      var cur = owned.indexOf(this.weapon);
      this.weapon = owned[(cur + 1) % owned.length];
      HUD.toast(this.WEAPONS[this.weapon].label + ' ready' + (this.weapon === 'sniper' ? ' — X to scope' : ''), '#ffd23f');
      AudioSys.blip(740);
    }
    this.prevQ = keyQ;
    // X toggles the sniper scope: a 2.5x zoom that narrows...
    var keyX = Input.down('KeyX');
    if (keyX && !this.prevX && this.armed && this.weapon === 'sniper' && !Vehicle.isDriving()) {
      this.scoped = !this.scoped;
      Game.camera.fov = this.scoped ? 25 : 62;
      Game.camera.updateProjectionMatrix();
      HUD.toast(this.scoped ? 'Scope on — hold still' : 'Scope off', '#c04df0');
    }
    this.prevX = keyX;
    if (this.scoped && (!this.armed || this.weapon !== 'sniper' || Vehicle.isDriving())) {
      this.scoped = false;
      Game.camera.fov = 62;
      Game.camera.updateProjectionMatrix();
    }
    // R reloads the gun in hand from its reserve (never whi...
    var keyR = Input.down('KeyR');
    if (keyR && !this.prevR && Missions.state !== 'failed' && this.armed) this.reload();
    this.prevR = keyR;
    // V shoves the nearest pedestrian (on foot only)
    var keyV = Input.actionDown('shove');
    if (keyV && !this.prevV && !Vehicle.isDriving()) this.shove();
    this.prevV = keyV;
    // click to shoot (on foot, armed)
    if (this.armed && !Vehicle.isDriving() && Input.takeClick() && this.shotCd <= 0) {
      this.shoot();
    }
  }
};
