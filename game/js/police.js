// police.js — the wanted system.
var Police = {
  // the heat table: what each star buys the precinct
  HEAT: [
    { maxCars: 0, topSpeed: 0, spawnEvery: 0, pit: false, roadblock: false, heli: false, swat: false, spikes: false, backup: 0, k9: false },
    { maxCars: 1, topSpeed: 16.6, spawnEvery: 1.6, pit: false, roadblock: false, heli: false, swat: false, spikes: false, backup: 0, k9: false },
    { maxCars: 2, topSpeed: 18.2, spawnEvery: 1.4, pit: true, roadblock: false, heli: false, swat: false, spikes: false, backup: 0, k9: true },
    { maxCars: 3, topSpeed: 19.8, spawnEvery: 1.2, pit: true, roadblock: true, heli: false, swat: false, spikes: false, backup: 0, k9: true },
    { maxCars: 4, topSpeed: 21.4, spawnEvery: 1.0, pit: true, roadblock: true, heli: true, swat: false, spikes: true, backup: 4, k9: true },
    { maxCars: 4, topSpeed: 23.0, spawnEvery: 0.9, pit: true, roadblock: true, heli: true, swat: true, spikes: true, backup: 4, k9: true }
  ],
  wanted: 0,
  difficultyScale: 1,
  spawnScale: 1,
  cars: [],
  roadblocks: [],
  scene: null,
  spawnTimer: 0,
  decayTimer: 0,
  decayInterval: 6,
  decayProgress: 0,
  boxedTimer: 0,
  crimeTimer: 99,
  speedCrimeCd: 0,
  bustedCooldown: 0,
  backupCalled: false,
  time: 0,
  roadCoords: [-180, -120, -60, 0, 60, 120, 180],
  heli: null,
  heliAngle: 0,
  swat: null,
  spikeStrip: null,
  heliSpot: null,
  heliCone: null,
  heliToastShown: false,
  k9: null,
  k9Cd: 0,
  lastDispatchAt: -99,
  dispatchUnit: 0,

  build: function (scene) { this.scene = scene; },

  // the heat row for the current wanted level
  _heat: function () { return this.HEAT[this.wanted]; },

  setWanted: function (n) {
    var prev = this.wanted;
    this.wanted = SBUtils.clamp(Math.round(n), 0, 5);
    if (n > 0) this.crimeTimer = 0;
    if (this.wanted > prev) this.dispatch('suspect escalating — wanted level ' + this.wanted + ', all units converge');
    else if (this.wanted < prev) this.dispatch(this.wanted === 0 ? 'suspect lost — all units stand down' : 'suspect cooling off — wanted level ' + this.wanted + ', keep searching');
  },
  addWanted: function (n) {
    if (n <= 0) return;
    var prev = this.wanted;
    this.wanted = Math.min(5, this.wanted + n);
    this.crimeTimer = 0;
    if (this.wanted > prev) this.dispatch('suspect escalating — wanted level ' + this.wanted + ', all units converge');
  },
  getWanted: function () { return this.wanted; },
  getDecayProgress: function () { return this.decayProgress; },

  dispatch: function (msg) {
    if (this.time - this.lastDispatchAt < 6) return;
    this.lastDispatchAt = this.time;
    var units = ['Unit 7', 'Unit 12', 'Unit 3', 'Unit 21', 'Unit 9'];
    var unit = units[this.dispatchUnit % units.length];
    this.dispatchUnit++;
    var heading = Vehicle.isDriving() ? Vehicle.drivable.heading : Player.heading;
    var dirs = ['north', 'east', 'south', 'west'];
    var dir = dirs[((Math.round(heading / (Math.PI / 2)) % 4) + 4) % 4];
    HUD.toast('SBPD Dispatch: ' + unit + ', suspect last seen heading ' + dir + ' — ' + msg, '#9fc3dd');
  },

  // stealing a car only draws heat if someone saw it
  onSteal: function () {
    var witnessed = false;
    for (var i = 0; i < this.cars.length; i++) {
      if (SBUtils.dist2D(Player.x, Player.z, this.cars[i].x, this.cars[i].z) < 45) { witnessed = true; break; }
    }
    if (!witnessed) {
      for (var j = 0; j < Traffic.peds.length; j++) {
        var ped = Traffic.peds[j];
        if (ped.state === 'walk' && SBUtils.dist2D(Player.x, Player.z, ped.x, ped.z) < 8) { witnessed = true; break; }
      }
    }
    if (witnessed) {
      this.addWanted(1);
      HUD.toast('Someone saw you steal that car!  +1 star', '#ff8844');
    }
  },

  forceSpawn: function (n) {
    for (var i = 0; i < n; i++) this._spawnCar();
  },

  _makePoliceCar: function (x, z, heading) {
    var g = new THREE.Group();
    var white = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    var black = new THREE.MeshLambertMaterial({ color: 0x14181d });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), white);
    body.position.y = 0.55; body.castShadow = true; g.add(body);
    var hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 1.0), black);
    hood.position.set(0, 0.9, 1.6); g.add(hood);
    var trunk = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.9), black);
    trunk.position.set(0, 0.9, -1.7); g.add(trunk);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), black);
    cabin.position.set(0, 1.1, -0.2); cabin.castShadow = true; g.add(cabin);
    // light bar: red left, blue right
    var redMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    var blueMat = new THREE.MeshBasicMaterial({ color: 0x2244ff });
    var lightL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.35), redMat);
    lightL.position.set(-0.45, 1.52, -0.2); g.add(lightL);
    var lightR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.35), blueMat);
    lightR.position.set(0.45, 1.52, -0.2); g.add(lightR);
    var wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    var wpos = [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]];
    for (var i = 0; i < 4; i++) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wpos[i][0], 0.38, wpos[i][1]);
      w.castShadow = true;
      g.add(w);
    }
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    g.userData.police = true;
    this.scene.add(g);
    return { group: g, lightL: lightL, lightR: lightR };
  },

  // police helicopter: dark body, spinning main rotor, se...
  _makeSwatVan: function (x, z, heading) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 6.5), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    body.position.y = 1.6; body.castShadow = true; g.add(body);
    var cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 1.4), new THREE.MeshLambertMaterial({ color: 0x222831 }));
    cab.position.set(0, 2.9, 1.8); g.add(cab);
    var bar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 0.5), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    bar.position.set(0, 3.1, -0.5); g.add(bar);
    var lightL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.28, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    lightL.position.set(-0.6, 3.3, -0.5); g.add(lightL);
    var lightR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.28, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    lightR.position.set(0.6, 3.3, -0.5); g.add(lightR);
    var wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    var wpos = [[-1.25, 2.2], [1.25, 2.2], [-1.25, -2.2], [1.25, -2.2]];
    for (var i = 0; i < 4; i++) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 10), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wpos[i][0], 0.5, wpos[i][1]);
      w.castShadow = true;
      g.add(w);
    }
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    this.scene.add(g);
    return { group: g, lightL: lightL, lightR: lightR };
  },

  _makeHeli: function (x, z) {
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2430 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 6.5), bodyMat);
    body.position.y = 0; body.castShadow = true; g.add(body);
    var nose = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 1.6), new THREE.MeshLambertMaterial({ color: 0x2a3a4a }));
    nose.position.set(0, -0.1, 3.6); g.add(nose);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 5), bodyMat);
    tail.position.set(0, 0.3, -5.2); g.add(tail);
    var rotor = new THREE.Mesh(new THREE.BoxGeometry(13, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 1.3; g.add(rotor);
    var rotor2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 13), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor2.position.y = 1.3; g.add(rotor2);
    // searchlight: a spotlight under the nose + a visible c...
    var spot = new THREE.SpotLight(0xfff2c0, 260, 70, 0.32, 0.5, 1.0);
    spot.position.set(0, -0.8, 2.5);
    g.add(spot);
    var spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, -45, 0);
    g.add(spotTarget);
    spot.target = spotTarget;
    var cone = new THREE.Mesh(
      new THREE.ConeGeometry(9, 44, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })
    );
    // cone apex at the heli, wide base on the ground: a sea...
    cone.position.y = -23;
    g.add(cone);
    g.position.set(x, 46, z);
    this.scene.add(g);
    return { group: g, rotor: rotor, rotor2: rotor2, spot: spot, spotTarget: spotTarget, cone: cone, x: x, z: z };
  },

  // K9: a police dog — dark brown, low to the ground, fas...
  _makeK9: function (x, z) {
    var g = new THREE.Group();
    var fur = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 1.1), fur);
    body.position.y = 0.55; body.castShadow = true; g.add(body);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.45), fur);
    head.position.set(0, 0.75, 0.65); g.add(head);
    var snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.3), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    snout.position.set(0, 0.68, 0.95); g.add(snout);
    var legMat = new THREE.MeshLambertMaterial({ color: 0x2a1e12 });
    var legs = [[-0.18, 0.45], [0.18, 0.45], [-0.18, -0.45], [0.18, -0.45]];
    for (var i = 0; i < 4; i++) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), legMat);
      leg.position.set(legs[i][0], 0.25, legs[i][1]);
      g.add(leg);
    }
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.5), fur);
    tail.position.set(0, 0.7, -0.75); tail.rotation.x = -0.5; g.add(tail);
    g.position.set(x, 0, z);
    this.scene.add(g);
    return g;
  },

  _spawnHeli: function (px, pz) {
    this.heli = this._makeHeli(px + 30, pz - 20);
    this.heliAngle = Math.atan2(30, -20);
    this.heliToastShown = true;
    HUD.toast('AIR SUPPORT — the eye in the sky is on you', '#ff4444');
    this.dispatch('air support overhead — suspect in view from above');
    AudioSys.radioBlip();
    AudioSys.sting();
  },

  _removeHeli: function () {
    if (!this.heli) return;
    this.scene.remove(this.heli.group);
    this.heli = null;
    this.heliToastShown = false;
  },

  _spawnK9: function (px, pz) {
    var g = this._makeK9(px + 12, pz + 8);
    this.k9 = { group: g, x: px + 12, z: pz + 8, heading: 0, speed: 0, giveUpT: 0 };
    HUD.toast('K9 UNIT — the dog is on your trail', '#ff8844');
    AudioSys.radioBlip();
  },

  _removeK9: function () {
    if (!this.k9) return;
    this.scene.remove(this.k9.group);
    this.k9 = null;
  },

  _spawnCar: function () {
    var px = Vehicle.isDriving() ? Vehicle.drivable.x : Player.x;
    var pz = Vehicle.isDriving() ? Vehicle.drivable.z : Player.z;
    var horizontal = Math.random() < 0.5;
    var coord = SBUtils.randChoice(this.roadCoords);
    var along = SBUtils.clamp((horizontal ? px : pz) + SBUtils.randChoice([-1, 1]) * SBUtils.rand(55, 80), -270, 270);
    var x = horizontal ? along : coord + 2.2;
    var z = horizontal ? coord + 2.2 : along;
    var heading = Math.atan2(px - x, pz - z);
    var built = this._makePoliceCar(x, z, heading);
    this.cars.push({
      group: built.group, lightL: built.lightL, lightR: built.lightR,
      x: x, z: z, heading: heading, speed: 0, ramCd: 0, pitCd: 0,
      leaving: false, leaveT: 0,
      state: 'pursue', stateT: 0, searchT: 0,
      lastSeenX: px, lastSeenZ: pz,
      hp: null, disabled: false
    });
    AudioSys.radioBlip();
  },

  // at 3+ stars the cops throw up a roadblock: two cruise...
  _placeRoadblock: function () {
    var px = Vehicle.isDriving() ? Vehicle.drivable.x : Player.x;
    var pz = Vehicle.isDriving() ? Vehicle.drivable.z : Player.z;
    var heading = Vehicle.isDriving() ? Vehicle.drivable.heading : Player.heading;
    var fx = Math.sin(heading), fz = Math.cos(heading);
    var cx = px + fx * 45, cz = pz + fz * 45;
    cx = SBUtils.clamp(cx, -260, 260); cz = SBUtils.clamp(cz, -260, 260);
    // cruisers sit across the road: perpendicular to the pl...
    var blockHeading = heading + Math.PI / 2;
    var ox = Math.cos(blockHeading) * 3.2, oz = -Math.sin(blockHeading) * 3.2;
    for (var i = 0; i < 2; i++) {
      var s = i === 0 ? -1 : 1;
      var built = this._makePoliceCar(cx + ox * s, cz + oz * s, blockHeading);
      this.roadblocks.push({ group: built.group, lightL: built.lightL, lightR: built.lightR, x: cx + ox * s, z: cz + oz * s, paid: false });
    }
    HUD.toast('Roadblock ahead! The cops sealed the street', '#ff4444');
    this.dispatch('roadblock set — street sealed ahead of suspect');
    AudioSys.radioBlip();
  },

  _clearRoadblocks: function () {
    for (var i = 0; i < this.roadblocks.length; i++) this.scene.remove(this.roadblocks[i].group);
    this.roadblocks = [];
  },

  // spike strip: at 4+ stars the cops drop a strip of tyr...
  _placeSpikes: function () {
    var px = Vehicle.isDriving() ? Vehicle.drivable.x : Player.x;
    var pz = Vehicle.isDriving() ? Vehicle.drivable.z : Player.z;
    var heading = Vehicle.isDriving() ? Vehicle.drivable.heading : Player.heading;
    // lay it 30 units ahead of the player's direction of tr...
    var sx = px + Math.sin(heading) * 30;
    var sz = pz + Math.cos(heading) * 30;
    var g = new THREE.Group();
    var strip = new THREE.Mesh(new THREE.BoxGeometry(9, 0.18, 1.2), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    strip.position.y = 0.09; g.add(strip);
    var spikeMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
    for (var i = 0; i < 7; i++) {
      var spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 4), spikeMat);
      spike.position.set(-4 + i * 1.35, 0.5, 0);
      g.add(spike);
    }
    g.position.set(sx, 0, sz);
    g.rotation.y = heading;
    this.scene.add(g);
    this.spikeStrip = { group: g, x: sx, z: sz, hit: false };
  },

  _clearSpikes: function () {
    if (!this.spikeStrip) return;
    this.scene.remove(this.spikeStrip.group);
    this.spikeStrip = null;
  },

  _damageCar: function (n, fromX, fromZ) {
    var c = Vehicle.current || Vehicle.drivable;
    if (!c) return;
    if (c.hp == null) c.hp = 100;
    c.hp -= n;
    if (fromX !== undefined) HUD.damageFrom(fromX, fromZ);
    if (c.hp <= 0 && !c.wrecked) {
      c.wrecked = true;
      c.speed = 0;
      HUD.toast('Your car is wrecked!', '#ff4444');
      AudioSys.blip(120);
      Missions.fail();
    }
  },

  _onRoad: function (x, z) {
    for (var i = 0; i < this.roadCoords.length; i++) {
      if (Math.abs(x - this.roadCoords[i]) < 6 || Math.abs(z - this.roadCoords[i]) < 6) return true;
    }
    return false;
  },

  // steer one cruiser toward a point and move it there, c...
  _driveTo: function (pc, tx, tz, topSpeed, dt) {
    var dx = tx - pc.x, dz = tz - pc.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var targetHeading = Math.atan2(dx, dz);
    pc.heading = SBUtils.angleLerp(pc.heading, targetHeading, Math.min(1, dt * 2.0));
    pc.speed = SBUtils.lerp(pc.speed, topSpeed, Math.min(1, dt * 1.5));
    var p = { x: pc.x + Math.sin(pc.heading) * pc.speed * dt, z: pc.z + Math.cos(pc.heading) * pc.speed * dt };
    for (var k = 0; k < World.colliders.length; k++) SBUtils.resolveCircleAABB(p, 2.1, World.colliders[k]);
    p.x = SBUtils.clamp(p.x, -288, 288);
    p.z = SBUtils.clamp(p.z, -288, 294);
    pc.x = p.x; pc.z = p.z;
    pc.group.position.set(pc.x, 0, pc.z);
    pc.group.rotation.y = pc.heading;
    return Math.sqrt((tx - pc.x) * (tx - pc.x) + (tz - pc.z) * (tz - pc.z));
  },

  // flash a cruiser's light bar, red/blue alternating wit...
  _flashBar: function (pc) {
    var on = Math.floor(this.time * 3.5) % 2 === 0;
    pc.lightL.visible = on;
    pc.lightR.visible = !on;
  },

  // PIT maneuver: at 2+ stars a cruiser that gets onto th...
  _tryPit: function (pc, px, pz, dist, dt) {
    if (!Vehicle.isDriving() || this.wanted < 2 || pc.pitCd > 0) return;
    if (dist >= 5.5 || dist <= 2.5) return;
    var pHeading = Vehicle.drivable.heading;
    var relAng = SBUtils.clampAngle(Math.atan2(pc.x - px, pc.z - pz) - pHeading);
    // cruiser is behind the player (rear quarter) and closi...
    if (Math.abs(relAng) > 2.2 && Math.abs(Vehicle.drivable.speed) > 8) {
      pc.pitCd = 4;
      var side = relAng > 0 ? 1 : -1;
      Vehicle.drivable.heading += 0.35 * side;
      Vehicle.drivable.speed *= 0.45;
      Camera.shake(0.5);
      HUD.damageFrom(pc.x, pc.z);
      HUD.toast('PIT maneuver! The cruiser spun you', '#ff4444');
      AudioSys.blip(120);
      this._damageCar(6, pc.x, pc.z);
    }
  },

  // ramming: a close cruiser hits the car (or busts the p...
  _tryRam: function (pc, px, pz, dist, driving) {
    if (dist >= 4.2) return false;
    if (driving) {
      if (pc.ramCd <= 0) {
        pc.ramCd = 0.8;
        Vehicle.drivable.speed *= 0.55;
        this._damageCar(pc.swat ? 14 : 9, pc.x, pc.z);
        Camera.shake(0.35);
        AudioSys.blip(160);
      }
    } else if (dist < 2.4 && this.bustedCooldown <= 0) {
      this.busted();
      return true;
    }
    return false;
  },

  // one cruiser's brain, run every frame: a state machine...
  _updateCar: function (pc, dt, px, pz, driving, heat) {
    if (pc.ramCd > 0) pc.ramCd -= dt;
    if (pc.pitCd > 0) pc.pitCd -= dt;
    pc.stateT += dt;
    var dist = SBUtils.dist2D(px, pz, pc.x, pc.z);

    if (pc.state === 'disabled') {
      // shot up: it sits where it died, lights dark, speed bl...
      pc.speed = SBUtils.lerp(pc.speed, 0, Math.min(1, dt * 3));
      pc.group.position.set(pc.x, 0, pc.z);
      return;
    }

    if (pc.state === 'leave') {
      // heat is gone: drive away from the player and despawn
      pc.leaveT += dt;
      var ax = pc.x - px, az = pc.z - pz;
      var al = Math.max(0.1, Math.sqrt(ax * ax + az * az));
      pc.heading = SBUtils.angleLerp(pc.heading, Math.atan2(ax, az), Math.min(1, dt * 2));
      pc.speed = SBUtils.lerp(pc.speed, 16, Math.min(1, dt * 2));
      pc.x += Math.sin(pc.heading) * pc.speed * dt;
      pc.z += Math.cos(pc.heading) * pc.speed * dt;
      pc.group.position.set(pc.x, 0, pc.z);
      pc.group.rotation.y = pc.heading;
      if (pc.leaveT > 4 || al > 140) {
        this.scene.remove(pc.group);
        this.cars.splice(this.cars.indexOf(pc), 1);
      }
      return;
    }

    if (pc.disabled) { pc.state = 'disabled'; pc.stateT = 0; return; }

    if (pc.state === 'search') {
      // drive to the last place the player was seen; if they...
      if (dist < 40) {
        pc.state = 'pursue';
        pc.stateT = 0;
        pc.searchT = 0;
        return;
      }
      var left = this._driveTo(pc, pc.lastSeenX, pc.lastSeenZ, heat.topSpeed * 0.8 * (this.difficultyScale || 1), dt);
      this._flashBar(pc);
      if (left < 6 || pc.stateT > 10) {
        // swept the spot and found nothing: pick a nearby road...
        pc.lastSeenX = SBUtils.clamp(pc.lastSeenX + SBUtils.rand(-40, 40), -270, 270);
        pc.lastSeenZ = SBUtils.clamp(pc.lastSeenZ + SBUtils.rand(-40, 40), -270, 270);
        pc.stateT = 0;
      }
      return;
    }

    // state 'pursue': chase, ram, PIT — and lose the trail...
    if (dist > 55) {
      pc.searchT += dt;
      if (pc.searchT > 6) {
        pc.state = 'search';
        pc.stateT = 0;
        pc.lastSeenX = px;
        pc.lastSeenZ = pz;
        return;
      }
    } else {
      pc.searchT = 0;
      pc.lastSeenX = px;
      pc.lastSeenZ = pz;
    }
    this._driveTo(pc, px, pz, heat.topSpeed * (this.difficultyScale || 1), dt);
    this._flashBar(pc);
    this._tryPit(pc, px, pz, dist, dt);
    if (this._tryRam(pc, px, pz, dist, driving)) return;
  },

  // the K9's brain: it runs the player down on foot and o...
  _updateK9: function (dt, px, pz, driving) {
    var dog = this.k9;
    if (!dog) return;
    if (driving) {
      dog.giveUpT += dt;
      if (dog.giveUpT > 2) this._removeK9();
      return;
    }
    dog.giveUpT = 0;
    var dx = px - dog.x, dz = pz - dog.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    dog.heading = SBUtils.angleLerp(dog.heading, Math.atan2(dx, dz), Math.min(1, dt * 4));
    dog.speed = SBUtils.lerp(dog.speed, 7.5, Math.min(1, dt * 2));
    dog.x += Math.sin(dog.heading) * dog.speed * dt;
    dog.z += Math.cos(dog.heading) * dog.speed * dt;
    dog.group.position.set(dog.x, 0, dog.z);
    dog.group.rotation.y = dog.heading;
    // the dog's legs paddle while it runs (a cheap bob read...
    dog.group.position.y = Math.abs(Math.sin(this.time * 14)) * 0.12;
    if (dist < 1.5 && this.bustedCooldown <= 0) {
      HUD.toast('The K9 brought you down!', '#ff4444');
      this.busted();
    }
  },

  busted: function () {
    if (this.bustedCooldown > 0) return;
    this.bustedCooldown = 2;
    this.wanted = 0;
    Game.wanted = 0;
    this.decayTimer = 0;
    this.decayProgress = 0;
    this.boxedTimer = 0;
    for (var i = 0; i < this.cars.length; i++) this.scene.remove(this.cars[i].group);
    this.cars = [];
    this._clearRoadblocks();
    this._removeHeli();
    this._removeK9();
    AudioSys.setSiren(false);
    Game.money = Math.max(0, Game.money - 150);
    Game.health = Math.max(Game.health, 60);
    if (Vehicle.current) Vehicle.current = null;
    Player.x = World.spawnDowntown.x;
    Player.z = World.spawnDowntown.z;
    Player.group.position.set(Player.x, 0, Player.z);
    Player.group.visible = true;
    if (Vehicle.drivable) {
      Vehicle.drivable.hp = 100;
      Vehicle.drivable.wrecked = false;
      Vehicle.drivable.speed = 0;
    }
    AudioSys.setEngine(0, false);
    HUD.toast('BUSTED! The cops took $150', '#ff4444');
    HUD.showBusted();
    AudioSys.blip(140);
    if (Game.stats) Game.stats.arrests++;
    Game.onBusted();
    Missions.fail();
  },

  // wanted 0: the precinct stands down — sirens off, toys...
  _standDown: function (dt, px, pz) {
    AudioSys.setSiren(false);
    this._clearRoadblocks();
    this._removeHeli();
    this._clearSpikes();
    this._removeK9();
    if (this.swat) this.swat = null;
    this.decayProgress = 0;
    for (var li = this.cars.length - 1; li >= 0; li--) {
      var lc = this.cars[li];
      if (lc.state !== 'leave') { lc.state = 'leave'; lc.stateT = 0; lc.leaveT = 0; }
      this._updateCar(lc, dt, px, pz, false, this.HEAT[0]);
    }
  },

  // the helicopter circles the player while the heat hold...
  _updateHeli: function (dt, px, pz, heat) {
    if (heat.heli && !this.heli) this._spawnHeli(px, pz);
    if (!heat.heli && this.heli) this._removeHeli();
    if (!this.heli) return;
    this.heliAngle += dt * 0.45;
    var hx = px + Math.sin(this.heliAngle) * 30;
    var hz = pz + Math.cos(this.heliAngle) * 30;
    this.heli.x = hx; this.heli.z = hz;
    this.heli.group.position.set(hx, 46, hz);
    this.heli.group.rotation.y = Math.atan2(px - hx, pz - hz);
    this.heli.rotor.rotation.y += dt * 22;
    this.heli.rotor2.rotation.y += dt * 22;
    // spotlight + cone track the player (the SpotLight's ta...
    this.heli.spotTarget.position.set(px - hx, -46, pz - hz);
  },

  // roadblocks, SWAT van, spike strips and the K9 all com...
  _updateToys: function (dt, px, pz, driving, heat) {
    if (heat.roadblock && this.roadblocks.length === 0) this._placeRoadblock();
    if (!heat.roadblock && this.roadblocks.length > 0) this._clearRoadblocks();
    // flash the roadblock light bars too
    for (var rb3 = 0; rb3 < this.roadblocks.length; rb3++) {
      var on = Math.floor(this.time * 3.5) % 2 === 0;
      this.roadblocks[rb3].lightL.visible = on;
      this.roadblocks[rb3].lightR.visible = !on;
    }
    // SWAT van: at 5 stars the precinct sends one heavy uni...
    if (heat.swat && !this.swat) {
      var sb = this._makeSwatVan(px + 40, pz, Math.atan2(px - (px + 40), pz - pz));
      this.swat = { group: sb.group, lightL: sb.lightL, lightR: sb.lightR, x: px + 40, z: pz, heading: 0, speed: 0, ramCd: 0, pitCd: 0, leaving: false, leaveT: 0, state: 'pursue', stateT: 0, searchT: 0, lastSeenX: px, lastSeenZ: pz, hp: null, disabled: false, swat: true };
      this.cars.push(this.swat);
      HUD.toast('SWAT VAN — the heavy unit is on you', '#ff4444');
      this.dispatch('SWAT rolling — heavy unit en route to suspect');
      AudioSys.radioBlip();
    }
    if (!heat.swat && this.swat) {
      var si = this.cars.indexOf(this.swat);
      if (si >= 0) this.cars.splice(si, 1);
      this.scene.remove(this.swat.group);
      this.swat = null;
    }
    // spike strip: at 4+ stars the cops lay one across the...
    if (heat.spikes && !this.spikeStrip) this._placeSpikes();
    if (!heat.spikes && this.spikeStrip) this._clearSpikes();
    if (this.spikeStrip && driving && !this.spikeStrip.hit &&
        SBUtils.dist2D(px, pz, this.spikeStrip.x, this.spikeStrip.z) < 3.5) {
      this.spikeStrip.hit = true;
      Vehicle.drivable.speed *= 0.3;
      Vehicle.drivable.flatTires = 6;
      this._damageCar(5, this.spikeStrip.x, this.spikeStrip.z);
      Camera.shake(0.4);
      HUD.toast('SPIKE STRIP — your tyres are shredded, top speed halved', '#ff8844');
      AudioSys.blip(100);
    }
    // roadblock-breach reward: blast through the line at sp...
    if (driving) {
      var pSpeed = Math.abs(Vehicle.drivable.speed);
      for (var rb2 = 0; rb2 < this.roadblocks.length; rb2++) {
        var rb = this.roadblocks[rb2];
        if (!rb.paid && pSpeed > 12 && SBUtils.dist2D(px, pz, rb.x, rb.z) < 7) {
          rb.paid = true;
          Game.money += 100;
          HUD.toast('Broke the line! +$100', '#7dff9a');
          AudioSys.chaChing();
        }
      }
    }
    // K9: at 2+ stars the precinct sends a dog after the pl...
    if (heat.k9 && !this.k9 && !driving && this.k9Cd <= 0) {
      this._spawnK9(px, pz);
      this.k9Cd = 20;
    }
    if (this.k9Cd > 0) this.k9Cd -= dt;
    this._updateK9(dt, px, pz, driving);
  },

  // second wave: the moment heat hits 4 stars, the precin...
  _updateBackup: function (heat) {
    if (heat.backup > 0 && !this.backupCalled) {
      this.backupCalled = true;
      var need = Math.min(heat.backup, heat.maxCars) - this.cars.length;
      for (var bw = 0; bw < need; bw++) this._spawnCar();
      if (need > 0) {
        HUD.toast('HEAT LEVEL 4 — THEY CALLED BACKUP', '#ff4444');
        AudioSys.radioBlip();
      }
    }
    if (heat.backup === 0) this.backupCalled = false;
  },

  // boxed in: slow + surrounded at wanted >= 2 for 3s
  _updateBoxed: function (dt, px, pz, driving) {
    if (this.wanted >= 2 && driving && Math.abs(Vehicle.drivable.speed) < 2) {
      var near = false;
      for (var m = 0; m < this.cars.length; m++) {
        if (SBUtils.dist2D(px, pz, this.cars[m].x, this.cars[m].z) < 12) { near = true; break; }
      }
      if (near) {
        this.boxedTimer += dt;
        if (this.boxedTimer > 3 && this.bustedCooldown <= 0) { this.busted(); return true; }
      } else this.boxedTimer = 0;
    } else this.boxedTimer = 0;
    return false;
  },

  // speeding past the cops
  _updateSpeeding: function (driving, px, pz) {
    if (!driving || Math.abs(Vehicle.drivable.speed) <= 20 || this.speedCrimeCd > 0) return;
    var nearest = 9999;
    for (var s = 0; s < this.cars.length; s++) {
      nearest = Math.min(nearest, SBUtils.dist2D(px, pz, this.cars[s].x, this.cars[s].z));
    }
    if (nearest < 25) {
      this.addWanted(1);
      this.speedCrimeCd = 6;
      HUD.toast('Speeding past the cops!  +1 star', '#ff8844');
    }
  },

  // wanted decay when out of sight and laying low; the HU...
  _updateDecay: function (dt, px, pz, driving) {
    var nearest2 = 9999;
    for (var n = 0; n < this.cars.length; n++) {
      nearest2 = Math.min(nearest2, SBUtils.dist2D(px, pz, this.cars[n].x, this.cars[n].z));
    }
    if (nearest2 > 40 && this.crimeTimer > 5) {
      var hiding = (pz > 260) || !this._onRoad(px, pz);
      this.decayInterval = hiding ? 3 : 6;
      if (!driving && Player.crouched) this.decayInterval /= 2;
      this.decayTimer += dt;
      this.decayProgress = SBUtils.clamp01(this.decayTimer / this.decayInterval);
      if (this.decayTimer >= this.decayInterval) {
        this.wanted = Math.max(0, this.wanted - 1);
        this.decayTimer = 0;
        this.decayProgress = 0;
        HUD.toast('Heat dropping… ' + this.wanted + ' star' + (this.wanted === 1 ? '' : 's'), '#7dff9a');
        this.dispatch(this.wanted === 0 ? 'suspect lost — all units stand down' : 'suspect cooling off — wanted level ' + this.wanted + ', keep searching');
      }
    } else {
      this.decayTimer = 0;
      this.decayProgress = 0;
    }
  },

  update: function (dt) {
    this.time += dt;
    this.crimeTimer += dt;
    if (this.bustedCooldown > 0) this.bustedCooldown -= dt;
    if (this.speedCrimeCd > 0) this.speedCrimeCd -= dt;
    Game.wanted = this.wanted;

    var px = Vehicle.isDriving() ? Vehicle.drivable.x : Player.x;
    var pz = Vehicle.isDriving() ? Vehicle.drivable.z : Player.z;
    var driving = Vehicle.isDriving();

    // wanted 0: the precinct stands down
    if (this.wanted === 0) {
      this._standDown(dt, px, pz);
      return;
    }

    AudioSys.setSiren(true);
    AudioSys.updateSiren(dt);
    var heat = this._heat();

    this._updateHeli(dt, px, pz, heat);
    this._updateToys(dt, px, pz, driving, heat);
    this._updateBackup(heat);

    // spawn up to the wanted-scaled count from the heat table
    if (this.cars.length < heat.maxCars) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this._spawnCar(); this.spawnTimer = heat.spawnEvery * (this.spawnScale || 1); }
    }

    // every cruiser runs its own state machine
    for (var j = this.cars.length - 1; j >= 0; j--) {
      this._updateCar(this.cars[j], dt, px, pz, driving, heat);
      if (this.bustedCooldown > 0 && this.wanted === 0) return;
    }

    if (this._updateBoxed(dt, px, pz, driving)) return;
    this._updateSpeeding(driving, px, pz);
    this._updateDecay(dt, px, pz, driving);
  }
};
