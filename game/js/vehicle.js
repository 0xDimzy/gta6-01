// vehicle.js — cars: parked + four drivable types, arcade physics,
// skid marks when drifting, damage smoke/fire/explosion, nitro boost,
// convertible roof, headlights, horn
var Vehicle = {
  cars: [],        // {group, x, z, heading, speed, drivable, wheels[]}
  drivables: [],  // cars the player can steal
  current: null,  // the car being driven
  radius: 2.1,
  // drivable types: top speed / acceleration / size
  TYPES: {
    coupe:  { maxFwd: 30, accel: 14, len: 4.4, w: 2.0, bodyH: 0.62, cabinH: 0.6 },
    sports: { maxFwd: 38, accel: 18, len: 4.2, w: 1.9, bodyH: 0.5, cabinH: 0.5 },
    van:    { maxFwd: 22, accel: 10, len: 5.4, w: 2.2, bodyH: 0.95, cabinH: 0.9 },
    convertible: { maxFwd: 34, accel: 16, len: 4.3, w: 1.95, bodyH: 0.55, cabinH: 0.45 }
  },
  skidPool: [],
  smokePool: [],
  firePool: [], // orange fire puffs when a car is nearly dead
  smokeT: 0,
  scene: null,
  headlight: null,      // spotlight on the driven car's nose
  headlightTarget: null,
  hornCd: 0,
  nitro: 100, // nitro meter 0..100; Shift burns it, it regens off-throttle
  nitroMax: 100,
  explosionT: 0, // counts down while a wrecked car burns before respawn
  explosionCar: null,

  build: function (scene) {
    this.scene = scene;
    // two parked cars downtown
    this._makeCar(scene, -14, -6, 0.3, 0x2f6fb2, false);
    this._makeCar(scene, 26, 34, -1.2, 0xb22f2f, false);
    // the drivable cars: yellow coupe by the downtown spawn, red sports
    // car across town, slow white van near the park, pink convertible
    // parked by the beach with a working roof (B toggles it)
    var c = this._makeCar(scene, World.spawnCar.x, World.spawnCar.z, World.spawnCar.heading, 0xf2a007, true, 'coupe');
    this.drivable = c;
    this._makeCar(scene, 62, -62, Math.PI / 2, 0xc22a22, true, 'sports');
    this._makeCar(scene, -62, 122, 0, 0xe8e8e8, true, 'van');
    var conv = this._makeCar(scene, -120, 262, Math.PI, 0xff5d8f, true, 'convertible');
    conv.roof = this._makeRoof(scene, conv);
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
    // fire puffs (orange spheres, reused from a pool) for a car under 25 HP
    var fireMat = new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.75, depthWrite: false });
    for (var k = 0; k < 16; k++) {
      var f = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), fireMat.clone());
      f.visible = false;
      scene.add(f);
      this.firePool.push({ mesh: f, life: 0 });
    }
    // headlights: one spotlight, re-aimed at the driven car every frame
    this.headlight = new THREE.SpotLight(0xfff2c0, 0, 45, 0.55, 0.4, 1.2);
    scene.add(this.headlight);
    this.headlightTarget = new THREE.Object3D();
    scene.add(this.headlightTarget);
    this.headlight.target = this.headlightTarget;
    return c;
  },

  // the convertible's soft roof: a canvas-topped box that hides/shows
  _makeRoof: function (scene, car) {
    var roof = new THREE.Mesh(
      new THREE.BoxGeometry(car.type.w - 0.2, 0.18, car.type.len * 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    roof.position.set(0, 0.55 + car.type.bodyH / 2 + car.type.cabinH - 0.1, -car.type.len * 0.05);
    roof.castShadow = true;
    car.group.add(roof);
    return roof;
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
      maxFwd: type.maxFwd, accel: type.accel, len: type.len, hp: 100, wrecked: false,
      roof: null, roofUp: true, spawnX: x, spawnZ: z, spawnHeading: heading
    };
    this.cars.push(car);
    if (drivable) this.drivables.push(car);
    return car;
  },

  // try to enter/exit with E; call once per frame from main.
  // entering picks the NEAREST drivable car, so all four types are stealable.
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

  // a wrecked car burns for 3 s, then respawns at its spawn point with
  // full HP — minus a $200 repair bill taken from the player
  _explode: function (car) {
    car.wrecked = true;
    car.speed = 0;
    this.explosionCar = car;
    this.explosionT = 3;
    Camera.shake(0.6);
    AudioSys.boom();
    HUD.toast('Your car blew up! Repair -$200', '#ff4444');
    Game.money = Math.max(0, Game.money - 200);
    // big orange flash at the wreck
    for (var i = 0; i < this.firePool.length; i++) {
      var f = this.firePool[i];
      if (f.life <= 0) {
        f.life = 1.4;
        f.mesh.visible = true;
        f.mesh.position.set(car.x + SBUtils.rand(-1.5, 1.5), 1.2, car.z + SBUtils.rand(-1.5, 1.5));
        f.mesh.scale.set(2.2, 2.2, 2.2);
        f.mesh.material.opacity = 0.85;
      }
    }
  },

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

  _puffFire: function (x, y, z) {
    for (var i = 0; i < this.firePool.length; i++) {
      var f = this.firePool[i];
      if (f.life <= 0) {
        f.life = 0.7;
        f.mesh.visible = true;
        f.mesh.position.set(x, y, z);
        f.mesh.scale.set(0.8, 0.8, 0.8);
        f.mesh.material.opacity = 0.75;
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
    for (var k = 0; k < this.firePool.length; k++) {
      var f = this.firePool[k];
      if (f.life > 0) {
        f.life -= dt;
        f.mesh.position.y += dt * 2.4;
        var sc2 = 0.8 + (0.7 - f.life) * 1.6;
        f.mesh.scale.set(sc2, sc2, sc2);
        f.mesh.material.opacity = Math.max(0, f.life / 0.7 * 0.75);
        if (f.life <= 0) f.mesh.visible = false;
      }
    }
  },

  update: function (dt, colliders) {
    var c = this.current;
    this._updateDecals(dt);
    if (this.hornCd > 0) this.hornCd -= dt;
    // wrecked-car burn timer: respawn the car at its spawn point
    if (this.explosionCar) {
      this.explosionT -= dt;
      if (this.explosionT <= 0) {
        var ec = this.explosionCar;
        ec.x = ec.spawnX; ec.z = ec.spawnZ; ec.heading = ec.spawnHeading;
        ec.speed = 0; ec.hp = 100; ec.wrecked = false;
        ec.group.position.set(ec.x, 0, ec.z);
        ec.group.rotation.y = ec.heading;
        this.explosionCar = null;
        HUD.toast('Car repaired — back on the road', '#7dff9a');
      }
    }
    if (!c) {
      AudioSys.setScreech(0);
      if (this.headlight) this.headlight.intensity = 0;
      return;
    }
    // car HP hits 0 while driving: it explodes (and the mission fails)
    if (c.hp <= 0 && !c.wrecked) {
      this._explode(c);
      Missions.fail('Your car blew up');
      return;
    }
    var throttle = Input.axisAction('down', 'up');
    var steerIn = Input.axisAction('left', 'right');
    var brake = Input.actionDown('brake');
    // nitro: Shift while driving burns the meter for +40% top speed
    var wantNitro = Input.actionDown('nitro') && this.nitro > 0 && throttle > 0;
    if (wantNitro) this.nitro = Math.max(0, this.nitro - 30 * dt);
    else this.nitro = Math.min(this.nitroMax, this.nitro + 10 * dt);
    var maxFwd = c.maxFwd * (wantNitro ? 1.4 : 1), maxRev = 9;
    if (throttle > 0) c.speed += c.accel * dt;
    else if (throttle < 0) c.speed -= (c.speed > 0.5 ? 22 : 9) * dt;
    else c.speed -= c.speed * 1.2 * dt; // drag
    if (brake) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 30 * dt);
    c.speed = SBUtils.clamp(c.speed, -maxRev, maxFwd);
    if (Math.abs(c.speed) < 0.05 && throttle === 0) c.speed = 0;
    // drifting: handbrake at speed, or hard steering at speed, lays rubber
    var drifting = (brake && Math.abs(c.speed) > 10) ||
      (Math.abs(steerIn) > 0.7 && Math.abs(c.speed) > maxFwd * 0.55);
    // screech follows drift intensity: gentle slide whispers, hard drift wails
    AudioSys.setScreech(drifting ? SBUtils.clamp(Math.abs(c.speed) / maxFwd, 0, 1) : 0);
    if (drifting) {
      var bx = c.x - Math.sin(c.heading) * c.len * 0.32;
      var bz = c.z - Math.cos(c.heading) * c.len * 0.32;
      this._dropSkid(bx - Math.cos(c.heading) * 0.9, bz + Math.sin(c.heading) * 0.9, c.heading);
      this._dropSkid(bx + Math.cos(c.heading) * 0.9, bz - Math.sin(c.heading) * 0.9, c.heading);
    }
    // horn (H) while driving: beep, and nearby pedestrians step aside
    if (Input.pressedAction('help') && this.hornCd <= 0) {
      this.hornCd = 0.6;
      AudioSys.horn();
      for (var pi = 0; pi < Traffic.peds.length; pi++) {
        var pd = Traffic.peds[pi];
        if (pd.state === 'walk' && SBUtils.dist2D(pd.x, pd.z, c.x, c.z) < 10) {
          var hx = pd.x - c.x, hz = pd.z - c.z;
          var hl = Math.max(0.1, Math.sqrt(hx * hx + hz * hz));
          pd.fleeX = hx / hl; pd.fleeZ = hz / hl; pd.fleeT = 1.5;
        }
      }
    }
    // convertible roof (B): fold the soft top down / put it back up
    if (c.type === 'convertible' && c.roof && Input.pressedAction('roof')) {
      c.roofUp = !c.roofUp;
      c.roof.visible = c.roofUp;
      HUD.toast(c.roofUp ? 'Roof up' : 'Roof down — wind in your hair', '#ffd23f');
      AudioSys.blip(520);
    }
    // headlights: spotlight rides on the nose, aimed 26 units ahead
    if (this.headlight) {
      var hx2 = c.x + Math.sin(c.heading) * c.len * 0.5;
      var hz2 = c.z + Math.cos(c.heading) * c.len * 0.5;
      this.headlight.position.set(hx2, 1.0, hz2);
      this.headlightTarget.position.set(c.x + Math.sin(c.heading) * 26, 0.4, c.z + Math.cos(c.heading) * 26);
      this.headlight.intensity = 90;
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
    // damage model: smoke under 40 HP, fire under 25 HP, explosion at 0
    if (c.hp < 40 && !c.wrecked) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = c.hp < 20 ? 0.08 : 0.16;
        var hx = c.x + Math.sin(c.heading) * c.len * 0.4;
        var hz = c.z + Math.cos(c.heading) * c.len * 0.4;
        this._puffSmoke(hx, 1.1, hz);
        if (c.hp < 25) this._puffFire(hx, 1.3, hz);
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
