// police.js — wanted level, police cars, roadblocks, busted,
// PIT maneuvers, police helicopter at 4+ stars, roadblock-breach reward
var Police = {
  wanted: 0,
  cars: [],
  roadblocks: [], // parked cruisers blocking a road at wanted >= 3
  scene: null,
  spawnTimer: 0,
  decayTimer: 0,
  decayInterval: 6,   // seconds per star lost while laying low
  decayProgress: 0,   // 0..1 toward the next star dropping (HUD bar)
  boxedTimer: 0,
  crimeTimer: 99,
  speedCrimeCd: 0,
  bustedCooldown: 0,
  backupCalled: false, // second wave already sent at this 4-star heat
  time: 0,
  roadCoords: [-180, -120, -60, 0, 60, 120, 180],
  heli: null, // police helicopter: circles above at wanted 4+
  heliAngle: 0,
  heliSpot: null, // spotlight that tracks the player from the heli
  heliCone: null, // translucent light cone under the heli
  heliToastShown: false,

  build: function (scene) { this.scene = scene; },

  setWanted: function (n) {
    this.wanted = SBUtils.clamp(Math.round(n), 0, 5);
    if (n > 0) this.crimeTimer = 0;
  },
  addWanted: function (n) {
    if (n <= 0) return;
    this.wanted = Math.min(5, this.wanted + n);
    this.crimeTimer = 0;
  },
  getWanted: function () { return this.wanted; },
  getDecayProgress: function () { return this.decayProgress; },

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

  // police helicopter: dark body, spinning main rotor, searchlight cone
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
    // searchlight: a spotlight under the nose + a visible cone of light
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
    // cone apex at the heli, wide base on the ground: a searchlight shaft
    cone.position.y = -23;
    g.add(cone);
    g.position.set(x, 46, z);
    this.scene.add(g);
    return { group: g, rotor: rotor, rotor2: rotor2, spot: spot, spotTarget: spotTarget, cone: cone, x: x, z: z };
  },

  _spawnHeli: function (px, pz) {
    this.heli = this._makeHeli(px + 30, pz - 20);
    this.heliAngle = Math.atan2(30, -20);
    this.heliToastShown = true;
    HUD.toast('AIR SUPPORT — the eye in the sky is on you', '#ff4444');
    AudioSys.radioBlip();
    AudioSys.sting();
  },

  _removeHeli: function () {
    if (!this.heli) return;
    this.scene.remove(this.heli.group);
    this.heli = null;
    this.heliToastShown = false;
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
      x: x, z: z, heading: heading, speed: 0, ramCd: 0, pitCd: 0, leaving: false, leaveT: 0
    });
    AudioSys.radioBlip();
  },

  // at 3+ stars the cops throw up a roadblock: two cruisers parked across
  // the road ahead of the player. Cleared when the heat drops below 3.
  _placeRoadblock: function () {
    var px = Vehicle.isDriving() ? Vehicle.drivable.x : Player.x;
    var pz = Vehicle.isDriving() ? Vehicle.drivable.z : Player.z;
    var heading = Vehicle.isDriving() ? Vehicle.drivable.heading : Player.heading;
    var fx = Math.sin(heading), fz = Math.cos(heading);
    var cx = px + fx * 45, cz = pz + fz * 45;
    cx = SBUtils.clamp(cx, -260, 260); cz = SBUtils.clamp(cz, -260, 260);
    // cruisers sit across the road: perpendicular to the player's heading
    var blockHeading = heading + Math.PI / 2;
    var ox = Math.cos(blockHeading) * 3.2, oz = -Math.sin(blockHeading) * 3.2;
    for (var i = 0; i < 2; i++) {
      var s = i === 0 ? -1 : 1;
      var built = this._makePoliceCar(cx + ox * s, cz + oz * s, blockHeading);
      this.roadblocks.push({ group: built.group, lightL: built.lightL, lightR: built.lightR, x: cx + ox * s, z: cz + oz * s, paid: false });
    }
    HUD.toast('Roadblock ahead! The cops sealed the street', '#ff4444');
    AudioSys.radioBlip();
  },

  _clearRoadblocks: function () {
    for (var i = 0; i < this.roadblocks.length; i++) this.scene.remove(this.roadblocks[i].group);
    this.roadblocks = [];
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
    Missions.fail();
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

    // wanted 0: cops drive off and despawn
    if (this.wanted === 0) {
      AudioSys.setSiren(false);
      this._clearRoadblocks();
      this._removeHeli();
      this.decayProgress = 0;
      for (var li = this.cars.length - 1; li >= 0; li--) {
        var lc = this.cars[li];
        lc.leaveT += dt;
        var ax = lc.x - px, az = lc.z - pz;
        var al = Math.max(0.1, Math.sqrt(ax * ax + az * az));
        lc.heading = SBUtils.angleLerp(lc.heading, Math.atan2(ax, az), Math.min(1, dt * 2));
        lc.speed = SBUtils.lerp(lc.speed, 16, Math.min(1, dt * 2));
        lc.x += Math.sin(lc.heading) * lc.speed * dt;
        lc.z += Math.cos(lc.heading) * lc.speed * dt;
        lc.group.position.set(lc.x, 0, lc.z);
        lc.group.rotation.y = lc.heading;
        if (lc.leaveT > 4 || al > 140) {
          this.scene.remove(lc.group);
          this.cars.splice(li, 1);
        }
      }
      return;
    }

    AudioSys.setSiren(true);
    AudioSys.updateSiren(dt);

    // helicopter: at 4+ stars the eye in the sky joins the chase and
    // circles above the player, its searchlight tracking the car
    if (this.wanted >= 4 && !this.heli) this._spawnHeli(px, pz);
    if (this.wanted < 4 && this.heli) this._removeHeli();
    if (this.heli) {
      this.heliAngle += dt * 0.45;
      var hx = px + Math.sin(this.heliAngle) * 30;
      var hz = pz + Math.cos(this.heliAngle) * 30;
      this.heli.x = hx; this.heli.z = hz;
      this.heli.group.position.set(hx, 46, hz);
      this.heli.group.rotation.y = Math.atan2(px - hx, pz - hz);
      this.heli.rotor.rotation.y += dt * 22;
      this.heli.rotor2.rotation.y += dt * 22;
      // spotlight + cone track the player (the SpotLight's target is a
      // child of the heli group, so it follows the heli and aims down)
      this.heli.spotTarget.position.set(px - hx, -46, pz - hz);
    }

    // roadblock management: up at 3 stars, down below 3
    if (this.wanted >= 3 && this.roadblocks.length === 0) this._placeRoadblock();
    if (this.wanted < 3 && this.roadblocks.length > 0) this._clearRoadblocks();
    // roadblock-breach reward: blast through the line at speed and the
    // crew pays $100 for the nerve — once per roadblock
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
    // second wave: the moment heat hits 4 stars, the precinct sends backup
    // at once (instant fill to 4 cruisers) instead of the usual slow trickle
    if (this.wanted >= 4 && !this.backupCalled) {
      this.backupCalled = true;
      var need = Math.min(4, this.wanted) - this.cars.length;
      for (var bw = 0; bw < need; bw++) this._spawnCar();
      if (need > 0) {
        HUD.toast('HEAT LEVEL 4 — THEY CALLED BACKUP', '#ff4444');
        AudioSys.radioBlip();
      }
    }
    if (this.wanted < 4) this.backupCalled = false;
    // flash the roadblock light bars too
    for (var rb3 = 0; rb3 < this.roadblocks.length; rb3++) {
      var on = Math.floor(this.time * 3.5) % 2 === 0;
      this.roadblocks[rb3].lightL.visible = on;
      this.roadblocks[rb3].lightR.visible = !on;
    }

    // spawn up to the wanted-scaled count
    var desired = Math.min(this.wanted, 4);
    if (this.cars.length < desired) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this._spawnCar(); this.spawnTimer = 1.2; }
    }

    // chase + ram + PIT maneuver
    for (var j = 0; j < this.cars.length; j++) {
      var pc = this.cars[j];
      if (pc.ramCd > 0) pc.ramCd -= dt;
      if (pc.pitCd > 0) pc.pitCd -= dt;
      var tx = px - pc.x, tz = pz - pc.z;
      var dist = Math.sqrt(tx * tx + tz * tz);
      var targetHeading = Math.atan2(tx, tz);
      pc.heading = SBUtils.angleLerp(pc.heading, targetHeading, Math.min(1, dt * 2.0));
      var topSpeed = 15 + this.wanted * 1.6;
      pc.speed = SBUtils.lerp(pc.speed, topSpeed, Math.min(1, dt * 1.5));
      var nx = pc.x + Math.sin(pc.heading) * pc.speed * dt;
      var nz = pc.z + Math.cos(pc.heading) * pc.speed * dt;
      var p = { x: nx, z: nz };
      for (var k = 0; k < World.colliders.length; k++) SBUtils.resolveCircleAABB(p, 2.1, World.colliders[k]);
      p.x = SBUtils.clamp(p.x, -288, 288);
      p.z = SBUtils.clamp(p.z, -288, 294);
      pc.x = p.x; pc.z = p.z;
      pc.group.position.set(pc.x, 0, pc.z);
      pc.group.rotation.y = pc.heading;
      // flashing light bar
      var on2 = Math.floor(this.time * 3.5) % 2 === 0;
      pc.lightL.visible = on2;
      pc.lightR.visible = !on2;
      // PIT maneuver: at 2+ stars a cruiser that gets onto the player's
      // rear quarter steers into it, spins the car and kills its speed
      if (driving && this.wanted >= 2 && pc.pitCd <= 0 && dist < 5.5 && dist > 2.5) {
        var pHeading = Vehicle.drivable.heading;
        var relAng = SBUtils.clampAngle(Math.atan2(pc.x - px, pc.z - pz) - pHeading);
        // cruiser is behind the player (rear quarter) and closing fast
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
      }
      // ram the player car, or bust the player on foot
      if (dist < 4.2) {
        if (driving) {
          if (pc.ramCd <= 0) {
            pc.ramCd = 0.8;
            Vehicle.drivable.speed *= 0.55;
            this._damageCar(9, pc.x, pc.z);
            Camera.shake(0.35);
            AudioSys.blip(160);
          }
        } else if (dist < 2.4 && this.bustedCooldown <= 0) {
          this.busted();
          return;
        }
      }
    }

    // boxed in: slow + surrounded at wanted >= 2 for 3s
    if (this.wanted >= 2 && driving && Math.abs(Vehicle.drivable.speed) < 2) {
      var near = false;
      for (var m = 0; m < this.cars.length; m++) {
        if (SBUtils.dist2D(px, pz, this.cars[m].x, this.cars[m].z) < 12) { near = true; break; }
      }
      if (near) {
        this.boxedTimer += dt;
        if (this.boxedTimer > 3 && this.bustedCooldown <= 0) { this.busted(); return; }
      } else this.boxedTimer = 0;
    } else this.boxedTimer = 0;

    // speeding past the cops
    if (driving && Math.abs(Vehicle.drivable.speed) > 20 && this.speedCrimeCd <= 0) {
      var nearest = 9999;
      for (var s = 0; s < this.cars.length; s++) {
        nearest = Math.min(nearest, SBUtils.dist2D(px, pz, this.cars[s].x, this.cars[s].z));
      }
      if (nearest < 25) {
        this.addWanted(1);
        this.speedCrimeCd = 6;
        HUD.toast('Speeding past the cops!  +1 star', '#ff8844');
      }
    }

    // wanted decay when out of sight and laying low; the HUD shows progress.
    // Crouching out of sight (C) cools the heat twice as fast.
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
      }
    } else {
      this.decayTimer = 0;
      this.decayProgress = 0;
    }
  }
};
