// traffic.js — traffic cars + pedestrians + city bus + traffic lights
var Traffic = {
  cars: [],
  peds: [],
  bus: null,
  lights: [], // {x, z, ns, pole, red, yellow, green, timer}
  roadCoords: [-180, -120, -60, 0, 60, 120, 180],
  hitCooldown: 0,
  shotThreat: null, // {x, z, t}

  build: function (scene) {
    this.scene = scene;
    var colors = [0x3a6ea5, 0xb23a48, 0x4a7c59, 0xd9d9d9, 0x222831, 0x8e44ad, 0x2a9d8f, 0xe07b39];
    var i;
    for (i = 0; i < 8; i++) {
      var horizontal = Math.random() < 0.5;
      var coord = SBUtils.choice(this.roadCoords);
      var lane = coord + (Math.random() < 0.5 ? 2.2 : -2.2);
      var dir = Math.random() < 0.5 ? 1 : -1;
      var along = SBUtils.rand(-260, 260);
      var x = horizontal ? along : lane;
      var z = horizontal ? lane : along;
      var heading = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      var car = Vehicle._makeCar(scene, x, z, heading, colors[i % colors.length], false);
      var sp = SBUtils.rand(8, 13);
      car.traffic = { horizontal: horizontal, coord: coord, dir: dir, speed: sp, baseSpeed: sp, pause: SBUtils.rand(0, 1.5), pauseIn: SBUtils.rand(4, 10) };
      this.cars.push(car);
    }
    var shirts = [0xe63946, 0x2a9d8f, 0xe9c46a, 0x4361ee, 0xf72585, 0x80b918, 0xf8f9fa, 0x222222, 0xff9f1c, 0x7209b7, 0x06d6a0, 0xef476f];
    for (i = 0; i < 12; i++) {
      this._spawnPed(scene, shirts[i % shirts.length]);
    }
    this._buildBus(scene);
    this._buildLights(scene);
  },

  // city bus: loops the outer ring road, pauses 3 s at four corner stops
  _buildBus: function (scene) {
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a9d8f });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 8.5), bodyMat);
    body.position.y = 1.5; body.castShadow = true; g.add(body);
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.8, 8.55), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    stripe.position.y = 1.9; g.add(stripe);
    var wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    var wpos = [[-1.15, 2.8], [1.15, 2.8], [-1.15, -2.8], [1.15, -2.8]];
    for (var i = 0; i < 4; i++) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 10), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wpos[i][0], 0.45, wpos[i][1]);
      w.castShadow = true;
      g.add(w);
    }
    g.position.set(-180, 0, -180);
    scene.add(g);
    // ring route: corners of the outer road square, clockwise
    this.bus = {
      group: g, x: -180, z: -180, heading: Math.PI / 2, speed: 9,
      waypoints: [[180, -180], [180, 180], [-180, 180], [-180, -180]],
      wp: 0, stopT: 0
    };
  },

  // two signalised intersections; cars obey the light for their axis
  _buildLights: function (scene) {
    var spots = [
      { x: 0, z: 0 },
      { x: 60, z: -60 }
    ];
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      var pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 5.5, 6),
        new THREE.MeshLambertMaterial({ color: 0x30343a })
      );
      pole.position.set(s.x + 6, 2.75, s.z + 6);
      pole.castShadow = true;
      scene.add(pole);
      var box = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 2.2, 0.9),
        new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
      );
      box.position.set(s.x + 6, 5.4, s.z + 6);
      scene.add(box);
      var mk = function (color, y) {
        var m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: color }));
        m.position.set(s.x + 6, y, s.z + 6.5);
        scene.add(m);
        return m;
      };
      this.lights.push({
        x: s.x, z: s.z, timer: i * 3.1,
        red: mk(0xff2222, 6.1), yellow: mk(0xffd23f, 5.4), green: mk(0x2aff66, 4.7)
      });
    }
  },

  // 12.5 s cycle: NS green 6 s, yellow 1.5 s, then EW green 5 s
  _lightState: function (light) {
    var ph = light.timer % 12.5;
    return { ns: ph < 6 ? 'green' : ph < 7.5 ? 'yellow' : 'red',
             ew: ph < 6 ? 'red' : ph < 7.5 ? 'red' : 'green' };
  },

  // is this car about to run a red light? (checked before it moves)
  _redAhead: function (car) {
    var t = car.traffic;
    for (var i = 0; i < this.lights.length; i++) {
      var L = this.lights[i];
      var st = this._lightState(L);
      var go = t.horizontal ? st.ew : st.ns;
      if (go !== 'red') continue;
      // car approaching the intersection on its road, within stopping range
      var along = t.horizontal ? car.x : car.z;
      var cross = t.horizontal ? L.x : L.z;
      var laneOff = t.horizontal ? Math.abs(car.z - L.z) : Math.abs(car.x - L.x);
      var ahead = (cross - along) * t.dir;
      if (laneOff < 4 && ahead > 0 && ahead < 11) return true;
    }
    return false;
  },

  _sidewalkSpot: function () {
    var horizontal = Math.random() < 0.5;
    var coord = SBUtils.choice(this.roadCoords);
    var off = SBUtils.choice([-7, 7]);
    var along = SBUtils.rand(-270, 270);
    return horizontal
      ? { x: along, z: coord + off, axis: 'x', dir: Math.random() < 0.5 ? 1 : -1 }
      : { x: coord + off, z: along, axis: 'z', dir: Math.random() < 0.5 ? 1 : -1 };
  },

  _spawnPed: function (scene, shirtColor) {
    var spot = this._sidewalkSpot();
    var ped = {
      group: null, legL: null, legR: null,
      x: spot.x, z: spot.z, axis: spot.axis, dir: spot.dir,
      speed: SBUtils.rand(1.0, 2.2), state: 'walk',
      fleeT: 0, fleeX: 0, fleeZ: 0, downT: 0, phase: SBUtils.rand(0, 6)
    };
    var g = new THREE.Group();
    var skin = new THREE.MeshLambertMaterial({ color: SBUtils.choice([0xc98d64, 0x8d5524, 0xe8b98a, 0x6b4423]) });
    var shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
    var pants = new THREE.MeshLambertMaterial({ color: SBUtils.choice([0x2b3a55, 0x333333, 0x5a4632, 0x44503e]) });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.3), shirt);
    torso.position.y = 1.02; torso.castShadow = true; g.add(torso);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skin);
    head.position.y = 1.56; head.castShadow = true; g.add(head);
    ped.legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), pants);
    ped.legL.geometry.translate(0, -0.33, 0);
    ped.legL.position.set(-0.14, 0.68, 0); ped.legL.castShadow = true; g.add(ped.legL);
    ped.legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), pants);
    ped.legR.geometry.translate(0, -0.33, 0);
    ped.legR.position.set(0.14, 0.68, 0); ped.legR.castShadow = true; g.add(ped.legR);
    // link meshes back to the ped record for combat raycasts
    var parts = [torso, head, ped.legL, ped.legR];
    for (var i = 0; i < parts.length; i++) parts[i].userData.ped = ped;
    g.position.set(ped.x, 0, ped.z);
    scene.add(g);
    ped.group = g;
    this.peds.push(ped);
    return ped;
  },

  // pedestrians within range flee from (x, z) — called on gunshots
  onShot: function (x, z) {
    this.shotThreat = { x: x, z: z, t: 2.5 };
  },

  knockDown: function (ped, cause) {
    if (!ped || ped.state !== 'walk') return;
    ped.state = 'down';
    ped.downT = 6;
    ped.group.rotation.z = Math.PI / 2;
    Police.addWanted(1, 'pedestrian');
    HUD.toast('Pedestrian down! The cops saw that  +1 star', '#ff4444');
    AudioSys.blip(180);
  },

  update: function (dt) {
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    if (this.shotThreat) {
      this.shotThreat.t -= dt;
      if (this.shotThreat.t <= 0) this.shotThreat = null;
    }
    var px = Vehicle.isDriving() ? Vehicle.drivable.x : Player.x;
    var pz = Vehicle.isDriving() ? Vehicle.drivable.z : Player.z;

    // ---- traffic lights: advance the cycle, light the lamps ----
    for (var li = 0; li < this.lights.length; li++) {
      var L = this.lights[li];
      L.timer += dt;
      var st = this._lightState(L);
      // NS lamp shows the NS state; EW drivers read the same box in reverse
      L.red.visible = st.ns === 'red';
      L.yellow.visible = st.ns === 'yellow';
      L.green.visible = st.ns === 'green';
    }

    // ---- city bus: follow the ring, dwell 3 s at each corner stop ----
    if (this.bus) {
      var b = this.bus;
      if (b.stopT > 0) {
        b.stopT -= dt;
      } else {
        var wp = b.waypoints[b.wp];
        var dx = wp[0] - b.x, dz = wp[1] - b.z;
        var dist = Math.sqrt(dx * dx + dz * dz);
        var wantHeading = Math.atan2(dx, dz);
        b.heading = SBUtils.angleLerp(b.heading, wantHeading, Math.min(1, dt * 4));
        if (dist < 1.5) {
          b.wp = (b.wp + 1) % b.waypoints.length;
          b.stopT = 3;
        } else {
          b.x += Math.sin(b.heading) * b.speed * dt;
          b.z += Math.cos(b.heading) * b.speed * dt;
        }
        b.group.position.set(b.x, 0, b.z);
        b.group.rotation.y = b.heading;
      }
    }

    // ---- traffic cars ----
    for (var i = 0; i < this.cars.length; i++) {
      var c = this.cars[i], t = c.traffic;
      var speed = 0;
      if (t.pause > 0) {
        t.pause -= dt;
      } else {
        speed = t.baseSpeed;
        // stop at a red light
        if (this._redAhead(c)) speed = 0;
        // slow/stop for the player ahead
        var fx = Math.sin(c.heading), fz = Math.cos(c.heading);
        var dx = px - c.x, dz = pz - c.z;
        var ahead = dx * fx + dz * fz;
        var lat = Math.abs(dx * fz - dz * fx);
        if (ahead > 0 && ahead < 12 && lat < 3.5) speed = 0;
        // slow/stop for another traffic car ahead on the same road + lane
        for (var j = 0; j < this.cars.length; j++) {
          if (j === i) continue;
          var o = this.cars[j], ot = o.traffic;
          if (ot.horizontal !== t.horizontal || ot.coord !== t.coord || ot.dir !== t.dir) continue;
          var odx = o.x - c.x, odz = o.z - c.z;
          var oa = odx * fx + odz * fz;
          var ol = Math.abs(odx * fz - odz * fx);
          if (oa > 0 && oa < 9 && ol < 3) { speed = 0; break; }
        }
        // brief stop at intersections, now and then
        t.pauseIn -= dt;
        if (t.pauseIn <= 0) {
          var along = t.horizontal ? c.x : c.z;
          var nearCross = false;
          for (var k = 0; k < this.roadCoords.length; k++) {
            if (Math.abs(along - this.roadCoords[k]) < 5) { nearCross = true; break; }
          }
          if (nearCross && Math.random() < 0.5) t.pause = SBUtils.rand(0.8, 2.2);
          t.pauseIn = SBUtils.rand(6, 12);
        }
        // move
        var step = speed * dt;
        if (t.horizontal) c.x += t.dir * step; else c.z += t.dir * step;
        var pos = t.horizontal ? c.x : c.z;
        if (pos > 285 || pos < -285) { t.dir *= -1; c.heading += Math.PI; }
        c.group.position.set(c.x, 0, c.z);
        c.group.rotation.y = c.heading;
        for (var w = 0; w < c.wheels.length; w++) c.wheels[w].rotation.x += speed * dt * 0.9;
      }
      // traffic car hits the player on foot
      if (!Vehicle.isDriving() && this.hitCooldown <= 0 &&
          SBUtils.dist2D(c.x, c.z, Player.x, Player.z) < 2.0) {
        this.hitCooldown = 1;
        Game.health = Math.max(0, Game.health - 25);
        var hx = Player.x - c.x, hz = Player.z - c.z;
        var hd = Math.max(0.1, Math.sqrt(hx * hx + hz * hz));
        Player.x += hx / hd * 2.5; Player.z += hz / hd * 2.5;
        Player.group.position.set(Player.x, 0, Player.z);
        AudioSys.blip(120);
        HUD.toast('You got hit by a car!  -25 HP', '#ff8844');
        if (Game.health <= 0) {
          Game.health = 100;
          Game.money = Math.max(0, Game.money - 100);
          Player.x = World.spawnDowntown.x; Player.z = World.spawnDowntown.z;
          Player.group.position.set(Player.x, 0, Player.z);
          HUD.toast('Hospital bill  -$100', '#ff4444');
        }
      }
    }
    // slow health regen when not recently hit
    if (this.hitCooldown <= 0 && Game.health > 0 && Game.health < 100) {
      Game.health = Math.min(100, Game.health + 4 * dt);
    }

    // ---- pedestrians ----
    var driving = Vehicle.isDriving();
    for (var p = 0; p < this.peds.length; p++) {
      var ped = this.peds[p];
      if (ped.state === 'down') {
        ped.downT -= dt;
        if (ped.downT <= 0) {
          var spot = this._sidewalkSpot();
          ped.x = spot.x; ped.z = spot.z; ped.axis = spot.axis; ped.dir = spot.dir;
          ped.state = 'walk';
          ped.group.rotation.z = 0;
          ped.group.position.set(ped.x, 0, ped.z);
        }
        continue;
      }
      // flee from the player car or a gunshot
      var fleeing = false, tx = 0, tz = 0;
      if (driving) {
        var dCar = SBUtils.dist2D(ped.x, ped.z, px, pz);
        if (dCar < 7) { fleeing = true; tx = ped.x - px; tz = ped.z - pz; ped.fleeT = 2.5; }
      }
      if (this.shotThreat && SBUtils.dist2D(ped.x, ped.z, this.shotThreat.x, this.shotThreat.z) < 18) {
        fleeing = true; tx = ped.x - this.shotThreat.x; tz = ped.z - this.shotThreat.z; ped.fleeT = 2.5;
      }
      if (ped.fleeT > 0) {
        ped.fleeT -= dt;
        fleeing = true;
        tx = ped.fleeX; tz = ped.fleeZ;
      }
      if (fleeing) {
        var fl = Math.max(0.1, Math.sqrt(tx * tx + tz * tz));
        ped.fleeX = tx / fl; ped.fleeZ = tz / fl;
        ped.x += ped.fleeX * 5 * dt;
        ped.z += ped.fleeZ * 5 * dt;
        ped.x = SBUtils.clamp(ped.x, -288, 288);
        ped.z = SBUtils.clamp(ped.z, -288, 294);
        ped.group.rotation.y = Math.atan2(ped.fleeX, ped.fleeZ);
        ped.phase += dt * 11;
        ped.legL.rotation.x = Math.sin(ped.phase) * 0.8;
        ped.legR.rotation.x = -Math.sin(ped.phase) * 0.8;
        ped.group.position.set(ped.x, 0, ped.z);
        continue;
      }
      // walk along the sidewalk
      var step2 = ped.speed * dt;
      if (ped.axis === 'x') ped.x += ped.dir * step2; else ped.z += ped.dir * step2;
      var along2 = ped.axis === 'x' ? ped.x : ped.z;
      if (along2 > 285 || along2 < -285) ped.dir *= -1;
      // snap back onto the sidewalk line after fleeing
      if (ped.axis === 'x') {
        var near = this.roadCoords[0], nd = 9999;
        for (var c2 = 0; c2 < this.roadCoords.length; c2++) {
          var dd = Math.abs(ped.z - this.roadCoords[c2]);
          if (dd < nd) { nd = dd; near = this.roadCoords[c2]; }
        }
        var wantZ = near + (ped.z >= near ? 7 : -7);
        ped.z += (wantZ - ped.z) * Math.min(1, dt * 2);
      } else {
        var near2 = this.roadCoords[0], nd2 = 9999;
        for (var c3 = 0; c3 < this.roadCoords.length; c3++) {
          var dd2 = Math.abs(ped.x - this.roadCoords[c3]);
          if (dd2 < nd2) { nd2 = dd2; near2 = this.roadCoords[c3]; }
        }
        var wantX = near2 + (ped.x >= near2 ? 7 : -7);
        ped.x += (wantX - ped.x) * Math.min(1, dt * 2);
      }
      ped.group.rotation.y = ped.axis === 'x' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
      ped.phase += dt * ped.speed * 2.2;
      ped.legL.rotation.x = Math.sin(ped.phase) * 0.6;
      ped.legR.rotation.x = -Math.sin(ped.phase) * 0.6;
      ped.group.position.set(ped.x, 0, ped.z);
      // run over by the player car
      if (driving && SBUtils.dist2D(ped.x, ped.z, px, pz) < 2.2) {
        this.knockDown(ped, 'car');
      }
    }
  }
};
