// vehicle.js — cars: parked + three drivable types, arcade physics,
// skid marks when drifting, damage smoke when the car is nearly wrecked
var Vehicle = {
  cars: [],        // {group, x, z, heading, speed, drivable, wheels[]}
  drivables: [],  // cars the player can steal
  current: null,  // the car being driven
  radius: 2.1,
  // drivable types: top speed / acceleration / size
  TYPES: {
    coupe:  { maxFwd: 30, accel: 14, len: 4.4, w: 2.0, bodyH: 0.62, cabinH: 0.6 },
    sports: { maxFwd: 38, accel: 18, len: 4.2, w: 1.9, bodyH: 0.5, cabinH: 0.5 },
    van:    { maxFwd: 22, accel: 10, len: 5.4, w: 2.2, bodyH: 0.95, cabinH: 0.9 }
  },
  skidPool: [],
  smokePool: [],
  smokeT: 0,
  scene: null,

  build: function (scene) {
    this.scene = scene;
    // two parked cars downtown
    this._makeCar(scene, -14, -6, 0.3, 0x2f6fb2, false);
    this._makeCar(scene, 26, 34, -1.2, 0xb22f2f, false);
    // the drivable cars: yellow coupe by the downtown spawn, red sports
    // car across town, slow white van near the park
    var c = this._makeCar(scene, World.spawnCar.x, World.spawnCar.z, World.spawnCar.heading, 0xf2a007, true, 'coupe');
    this.drivable = c;
    this._makeCar(scene, 62, -62, Math.PI / 2, 0xc22a22, true, 'sports');
    this._makeCar(scene, -62, 122, 0, 0xe8e8e8, true, 'van');
    // skid-mark decals (flat dark quads, reused from a pool)
    var skidMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false });
    for (var i = 0; i < 60; i++) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 1.4), skidMat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.08;
      m.visible = false;
      scene.add(m);
      this.skidPool.push({ mesh: m, life: 0 });
    }
    // damage smoke puffs (grey spheres, reused from a pool)
    var smokeMat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5, depthWrite: false });
    for (var j = 0; j < 24; j++) {
      var s = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), smokeMat.clone());
      s.visible = false;
      scene.add(s);
      this.smokePool.push({ mesh: s, life: 0 });
    }
    return c;
  },

  _makeCar: function (scene, x, z, heading, color, drivable, typeName) {
    var type = this.TYPES[typeName || 'coupe'];
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: color });
    var darkMat = new THREE.MeshLambertMaterial({ color: 0x18202a });
    var body = new THREE.Mesh(new THREE.BoxGeometry(type.w, type.bodyH, type.len), bodyMat);
    body.position.y = 0.55; body.castShadow = true; g.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(type.w - 0.3, type.cabinH, type.len * 0.5), darkMat);
    cabin.position.set(0, 0.55 + type.bodyH / 2 + type.cabinH / 2 - 0.15, -type.len * 0.05); cabin.castShadow = true; g.add(cabin);
    // headlights + taillights
    var lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6c0, emissive: 0x555533 });
    var tailMat = new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0x440000 });
    var hl = new THREE.Mesh(new THREE.BoxGeometry(type.w - 0.3, 0.16, 0.1), lightMat);
    hl.position.set(0, 0.62, type.len / 2 + 0.02); g.add(hl);
    var tl = new THREE.Mesh(new THREE.BoxGeometry(type.w - 0.3, 0.16, 0.1), tailMat);
    tl.position.set(0, 0.62, -type.len / 2 - 0.02); g.add(tl);
    // wheels
    var wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    var wheels = [];
    var hz = type.len / 2 - 0.75;
    var wpos = [[-type.w / 2, hz], [type.w / 2, hz], [-type.w / 2, -hz], [type.w / 2, -hz]];
    for (var i = 0; i < 4; i++) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wpos[i][0], 0.38, wpos[i][1]);
      w.castShadow = true;
      g.add(w); wheels.push(w);
    }
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    scene.add(g);
    var car = {
      group: g, x: x, z: z, heading: heading, speed: 0, steer: 0,
      drivable: drivable, wheels: wheels, type: typeName || 'coupe',
      maxFwd: type.maxFwd, accel: type.accel, len: type.len, hp: 100, wrecked: false
    };
    this.cars.push(car);
    if (drivable) this.drivables.push(car);
    return car;
  },

  // try to enter/exit with E; call once per frame from main.
  // entering picks the NEAREST drivable car, so all three types are stealable.
  tryToggle: function (playerX, playerZ) {
    if (this.current) {
      // exit: drop the player beside the car
      var c = this.current;
      this.current = null;
      return { exited: true, x: c.x + Math.cos(c.heading) * 3, z: c.z - Math.sin(c.heading) * 3 };
    }
    var best = null, bestD = 4.5;
    for (var i = 0; i < this.drivables.length; i++) {
      var d = SBUtils.dist2D(playerX, playerZ, this.drivables[i].x, this.drivables[i].z);
      if (d < bestD && !this.drivables[i].wrecked) { bestD = d; best = this.drivables[i]; }
    }
    if (best) {
      this.current = best;
      this.drivable = best;
      AudioSys.blip(660);
      return { entered: true, car: best };
    }
    return null;
  },

  isDriving: function () { return !!this.current; },

  _dropSkid: function (x, z, heading) {
    for (var i = 0; i < this.skidPool.length; i++) {
      var s = this.skidPool[i];
      if (s.life <= 0) {
        s.life = 6;
        s.mesh.visible = true;
        s.mesh.position.set(x, 0.08, z);
        s.mesh.rotation.z = heading;
        s.mesh.material.opacity = 0.55;
        return;
      }
    }
  },

  _puffSmoke: function (x, y, z) {
    for (var i = 0; i < this.smokePool.length; i++) {
      var s = this.smokePool[i];
      if (s.life <= 0) {
        s.life = 1.1;
        s.mesh.visible = true;
        s.mesh.position.set(x, y, z);
        s.mesh.scale.set(0.6, 0.6, 0.6);
        s.mesh.material.opacity = 0.5;
        return;
      }
    }
  },

  _updateDecals: function (dt) {
    for (var i = 0; i < this.skidPool.length; i++) {
      var s = this.skidPool[i];
      if (s.life > 0) {
        s.life -= dt;
        s.mesh.material.opacity = Math.max(0, s.life / 6 * 0.55);
        if (s.life <= 0) s.mesh.visible = false;
      }
    }
    for (var j = 0; j < this.smokePool.length; j++) {
      var p = this.smokePool[j];
      if (p.life > 0) {
        p.life -= dt;
        p.mesh.position.y += dt * 1.6;
        var sc = 0.6 + (1.1 - p.life) * 1.1;
        p.mesh.scale.set(sc, sc, sc);
        p.mesh.material.opacity = Math.max(0, p.life / 1.1 * 0.5);
        if (p.life <= 0) p.mesh.visible = false;
      }
    }
  },

  update: function (dt, colliders) {
    var c = this.current;
    this._updateDecals(dt);
    AudioSys.tickScreechCd(dt);
    if (!c) return;
    var throttle = Input.axisAction('down', 'up');
    var steerIn = Input.axisAction('left', 'right');
    var brake = Input.actionDown('brake');
    var maxFwd = c.maxFwd, maxRev = 9;
    if (throttle > 0) c.speed += c.accel * dt;
    else if (throttle < 0) c.speed -= (c.speed > 0.5 ? 22 : 9) * dt;
    else c.speed -= c.speed * 1.2 * dt; // drag
    if (brake) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 30 * dt);
    c.speed = SBUtils.clamp(c.speed, -maxRev, maxFwd);
    if (Math.abs(c.speed) < 0.05 && throttle === 0) c.speed = 0;
    // drifting: handbrake at speed, or hard steering at speed, lays rubber
    var drifting = (brake && Math.abs(c.speed) > 10) ||
      (Math.abs(steerIn) > 0.7 && Math.abs(c.speed) > maxFwd * 0.55);
    if (drifting) {
      AudioSys.screech();
      var bx = c.x - Math.sin(c.heading) * c.len * 0.32;
      var bz = c.z - Math.cos(c.heading) * c.len * 0.32;
      this._dropSkid(bx - Math.cos(c.heading) * 0.9, bz + Math.sin(c.heading) * 0.9, c.heading);
      this._dropSkid(bx + Math.cos(c.heading) * 0.9, bz - Math.sin(c.heading) * 0.9, c.heading);
    }
    // steering scales with speed, reverses when backing up
    var steerTarget = steerIn * 0.55 * SBUtils.clamp(Math.abs(c.speed) / 8, 0, 1);
    c.steer = SBUtils.lerp(c.steer, steerTarget, Math.min(1, dt * 6));
    c.heading += c.steer * (c.speed / 9) * dt * (c.speed >= 0 ? 1 : -1);
    var nx = c.x + Math.sin(c.heading) * c.speed * dt;
    var nz = c.z + Math.cos(c.heading) * c.speed * dt;
    // collide against buildings (circle approx) and parked cars
    var p = { x: nx, z: nz };
    var hit = false;
    for (var i = 0; i < colliders.length; i++) {
      if (SBUtils.resolveCircleAABB(p, this.radius, colliders[i])) hit = true;
    }
    for (var j = 0; j < this.cars.length; j++) {
      var o = this.cars[j];
      if (o === c) continue;
      if (SBUtils.circleHitsAABB(o.x, o.z, this.radius + 1.6, { minX: p.x - 0.1, maxX: p.x + 0.1, minZ: p.z - 0.1, maxZ: p.z + 0.1 })) {
        // simple car-car bump: stop
        hit = true;
      }
    }
    if (hit) {
      if (Math.abs(c.speed) > 12) Camera.shake(0.3);
      c.speed *= 0.35;
    }
    // world bounds
    p.x = SBUtils.clamp(p.x, -288, 288);
    p.z = SBUtils.clamp(p.z, -288, 294);
    c.x = p.x; c.z = p.z;
    c.group.position.set(c.x, 0, c.z);
    c.group.rotation.y = c.heading;
    // damage smoke: a car under 40 HP pours smoke from the hood
    if (c.hp < 40 && !c.wrecked) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = c.hp < 20 ? 0.08 : 0.16;
        var hx = c.x + Math.sin(c.heading) * c.len * 0.4;
        var hz = c.z + Math.cos(c.heading) * c.len * 0.4;
        this._puffSmoke(hx, 1.1, hz);
      }
    }
    // wheel spin + front steer visual
    for (var k = 0; k < c.wheels.length; k++) {
      c.wheels[k].rotation.x += c.speed * dt * 0.9;
    }
    c.wheels[0].rotation.y = c.steer * 0.5;
    c.wheels[1].rotation.y = c.steer * 0.5;
    AudioSys.setEngine(Math.abs(c.speed) / maxFwd, true);
  }
};
