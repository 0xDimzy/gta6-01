// vehicle.js — cars: parked + six drivable types, arcade physics,
// skid marks when drifting, damage smoke/fire/explosion, nitro boost,
// convertible roof, headlights, horn, motorcycle, drivable boat and
// jet ski, plus a fuel gauge — run dry and you limp to the gas station
// on the reserve tank; run the reserve dry too and the car stalls dead.
//
// Handling is data, not code: TYPES holds a spec per vehicle — top
// speed, launch, weight, grip, brakes, how drifty it is and how fast
// it turns. The physics in update() reads the spec, so tuning a car
// is one table row. Damage runs in stages (0 healthy .. 3 burning):
// each stage caps top speed, and stage 3 makes the steering wobble.
// Fuel drains with the throttle and refills at the gas station lot.
var Vehicle = {
  cars: [],        // {group, x, z, heading, speed, drivable, wheels[]}
  drivables: [],  // cars the player can steal
  current: null,  // the car being driven
  radius: 2.1,
  // drivable specs: top speed / launch / size / weight / grip /
  // brake force / driftiness / turn rate. grip 1.0 is a normal car;
  // higher grips harder, lower slides more.
  TYPES: {
    coupe:       { maxFwd: 30, accel: 14, len: 4.4, w: 2.0, bodyH: 0.62, cabinH: 0.6,  mass: 1.2, grip: 1.0,  brake: 30, drift: 0.8, steerRate: 0.55 },
    sports:      { maxFwd: 38, accel: 18, len: 4.2, w: 1.9, bodyH: 0.5,  cabinH: 0.5,  mass: 1.0, grip: 1.15, brake: 34, drift: 0.6, steerRate: 0.62 },
    van:         { maxFwd: 22, accel: 10, len: 5.4, w: 2.2, bodyH: 0.95, cabinH: 0.9,  mass: 2.4, grip: 0.9,  brake: 24, drift: 0.4, steerRate: 0.45 },
    convertible: { maxFwd: 34, accel: 16, len: 4.3, w: 1.95, bodyH: 0.55, cabinH: 0.45, mass: 1.1, grip: 1.05, brake: 30, drift: 0.9, steerRate: 0.58 },
    bike:        { maxFwd: 34, accel: 20, len: 2.6, w: 0.9, bodyH: 0.5,  cabinH: 0.3,  mass: 0.5, grip: 1.3,  brake: 36, drift: 1.4, steerRate: 0.75 },
    boat:        { maxFwd: 14, accel: 8,  len: 8.0, w: 2.6, bodyH: 1.0,  cabinH: 0.8,  mass: 1.8, grip: 0.6,  brake: 9,  drift: 0.2, steerRate: 0.35 },
    jetski:      { maxFwd: 26, accel: 22, len: 3.0, w: 1.2, bodyH: 0.4,  cabinH: 0.3,  mass: 0.4, grip: 1.2,  brake: 20, drift: 1.2, steerRate: 0.9 },
    pickup:      { maxFwd: 26, accel: 12, len: 5.0, w: 2.1, bodyH: 0.8,  cabinH: 0.85, mass: 2.2, grip: 0.85, brake: 26, drift: 0.5, steerRate: 0.5 }
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
  boat: null, // the drivable boat moored in the harbor (see _makeBoat)
  jetSki: null, // the drivable jet ski beached at the waterline (see _makeJetSki)
  nitroFxT: 0, // throttle for the nitro exhaust-flame puffs

  build: function (scene) {
    this.scene = scene;
    // every car in town, parked or stealable, in one table
    var spawns = [
      { x: -14, z: -6, h: 0.3, color: 0x2f6fb2, drivable: false },
      { x: 26, z: 34, h: -1.2, color: 0xb22f2f, drivable: false },
      { x: World.spawnCar.x, z: World.spawnCar.z, h: World.spawnCar.heading, color: 0xf2a007, drivable: true, type: 'coupe', first: true },
      { x: 62, z: -62, h: Math.PI / 2, color: 0xc22a22, drivable: true, type: 'sports' },
      { x: -62, z: 122, h: 0, color: 0xe8e8e8, drivable: true, type: 'van' },
      { x: -120, z: 262, h: Math.PI, color: 0xff5d8f, drivable: true, type: 'convertible', roof: true },
      { x: -28, z: -118, h: 0, color: 0x3a6ea5, drivable: true, type: 'pickup' }
    ];
    for (var i = 0; i < spawns.length; i++) {
      var s = spawns[i];
      var car = this._makeCar(scene, s.x, s.z, s.h, s.color, s.drivable, s.type);
      if (s.first) this.drivable = car;
      if (s.roof) car.roof = this._makeRoof(scene, car);
    }
    // the motorcycle: a teal bike downtown, two wheels, 34 top speed and
    // the fastest launch in the game — narrow enough to thread traffic
    this._makeBike(scene, 16, 14, Math.PI / 2, 0x2a9d8f);
    // the boat: a white speedboat moored in the harbor at (262, 120),
    // board it with E from the pier and drive the whole inlet
    this.boat = this._makeBoat(scene, 262, 120, 0.5);
    // the jet ski: a yellow personal watercraft beached at the waterline
    // east of downtown — board it with E and tear up the bay
    this.jetSki = this._makeJetSki(scene, 180, 289, -0.4);
    // decal + particle pools, built by one helper each
    this.skidPool = this._makePool(scene, 60, function () {
      return new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 1.4),
        new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false })
      );
    }, function (m) { m.rotation.x = -Math.PI / 2; m.position.y = 0.08; });
    this.smokePool = this._makePool(scene, 24, function () {
      return new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5, depthWrite: false })
      );
    }, null);
    this.firePool = this._makePool(scene, 16, function () {
      return new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.75, depthWrite: false })
      );
    }, null);
    // headlights: one spotlight, re-aimed at the driven car every frame
    this.headlight = new THREE.SpotLight(0xfff2c0, 0, 45, 0.55, 0.4, 1.2);
    scene.add(this.headlight);
    this.headlightTarget = new THREE.Object3D();
    scene.add(this.headlightTarget);
    this.headlight.target = this.headlightTarget;
    return this.drivable;
  },

  // a pool of reusable meshes: each entry is {mesh, life}. The caller
  // fills one in (position, scale, opacity) and sets life > 0; the
  // per-frame _updateDecals ages them out again.
  _makePool: function (scene, count, makeMesh, place) {
    var pool = [];
    for (var i = 0; i < count; i++) {
      var m = makeMesh();
      if (place) place(m);
      m.visible = false;
      scene.add(m);
      pool.push({ mesh: m, life: 0 });
    }
    return pool;
  },

  // the convertible's soft roof: a canvas-topped box that hides/shows
  _makeRoof: function (scene, car) {
    var spec = this.TYPES[car.type];
    var roof = new THREE.Mesh(
      new THREE.BoxGeometry(spec.w - 0.2, 0.18, spec.len * 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    roof.position.set(0, 0.55 + spec.bodyH / 2 + spec.cabinH - 0.1, -spec.len * 0.05);
    roof.castShadow = true;
    car.group.add(roof);
    return roof;
  },

  // body + cabin + lights for a car, from its spec
  _buildCarBody: function (g, type, color) {
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
  },

  // four wheels at the corners of the chassis, from the spec
  _buildWheelSet: function (g, type) {
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
    return wheels;
  },

  // the car record every system reads: position, heading, speed, the
  // spec fields copied flat for the physics, and the damage state
  _carRecord: function (group, wheels, x, z, heading, drivable, typeName, type) {
    return {
      group: group, x: x, z: z, heading: heading, speed: 0, steer: 0,
      drivable: drivable, wheels: wheels, type: typeName,
      maxFwd: type.maxFwd, accel: type.accel, len: type.len,
      mass: type.mass, grip: type.grip, brake: type.brake,
      drift: type.drift, steerRate: type.steerRate,
      slip: 0, damageStage: 0, wobble: 0,
      fuel: 100, fuelMax: 100, fuelWarned: 0, // 0 none, 1 low warned, 2 empty warned
      reserve: 8, reserveMax: 8, // reserve tank: kicks in when the main tank runs dry
      reserveActive: false, reserveToasted: false, // reserve engaged / bone-dry warned once
      hp: 100, wrecked: false,
      flatTires: 0, // seconds of shredded tyres left (spike strip) — top speed halves
      roof: null, roofUp: true, spawnX: x, spawnZ: z, spawnHeading: heading
    };
  },

  _makeCar: function (scene, x, z, heading, color, drivable, typeName) {
    var type = this.TYPES[typeName || 'coupe'];
    var g = new THREE.Group();
    this._buildCarBody(g, type, color);
    var wheels = this._buildWheelSet(g, type);
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    scene.add(g);
    var car = this._carRecord(g, wheels, x, z, heading, drivable, typeName || 'coupe', type);
    this.cars.push(car);
    if (drivable) this.drivables.push(car);
    return car;
  },

  // motorcycle: a slim two-wheeler, same record shape as a car so the
  // driving code, the minimap and the HUD all treat it like any other
  // drivable — only the body and the wheel count differ
  _makeBike: function (scene, x, z, heading, color) {
    var type = this.TYPES.bike;
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: color });
    var darkMat = new THREE.MeshLambertMaterial({ color: 0x18202a });
    var tank = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 1.4), bodyMat);
    tank.position.y = 0.75; tank.castShadow = true; g.add(tank);
    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.9), darkMat);
    seat.position.set(0, 0.85, -0.6); g.add(seat);
    var bars = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), darkMat);
    bars.position.set(0, 1.05, 0.9); g.add(bars);
    var wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    var wheels = [];
    var wpos = [[0, 1.05], [0, -1.05]];
    for (var i = 0; i < 2; i++) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.22, 10), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wpos[i][0], 0.38, wpos[i][1]);
      w.castShadow = true;
      g.add(w); wheels.push(w);
    }
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    scene.add(g);
    var bike = this._carRecord(g, wheels, x, z, heading, true, 'bike', type);
    bike.isBike = true;
    this.cars.push(bike);
    this.drivables.push(bike);
    return bike;
  },

  // speedboat: hull + cabin + mast, moored in the harbor. It is NOT a
  // car — _updateBoat drives it, and tryToggle boards it from the pier.
  _makeBoat: function (scene, x, z, heading) {
    var g = new THREE.Group();
    var hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 8.0), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    hull.position.y = 0.6; hull.castShadow = true; g.add(hull);
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.25, 8.05), new THREE.MeshLambertMaterial({ color: 0x2a6a9a }));
    stripe.position.y = 0.9; g.add(stripe);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 2.4), new THREE.MeshLambertMaterial({ color: 0x18202a }));
    cabin.position.set(0, 1.45, -0.8); cabin.castShadow = true; g.add(cabin);
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), new THREE.MeshLambertMaterial({ color: 0x888888 }));
    mast.position.set(0, 2.4, 0.8); g.add(mast);
    var outboard = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    outboard.position.set(0, 0.5, -4.2); g.add(outboard);
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    scene.add(g);
    var boat = this._carRecord(g, [], x, z, heading, true, 'boat', this.TYPES.boat);
    boat.isBoat = true;
    this.cars.push(boat);
    return boat;
  },

  // jet ski: a small yellow personal watercraft — hull, seat, handlebars.
  // It is NOT a car and NOT the boat: _updateJetSki drives it, and
  // tryToggle boards it from the beach at the waterline.
  _makeJetSki: function (scene, x, z, heading) {
    var g = new THREE.Group();
    var hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 3.0), new THREE.MeshLambertMaterial({ color: 0xf2c500 }));
    hull.position.y = 0.35; hull.castShadow = true; g.add(hull);
    var nose = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 0.9), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    nose.position.set(0, 0.4, 1.5); g.add(nose);
    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 1.3), new THREE.MeshLambertMaterial({ color: 0x18202a }));
    seat.position.set(0, 0.65, -0.5); g.add(seat);
    var bars = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.08), new THREE.MeshLambertMaterial({ color: 0x888888 }));
    bars.position.set(0, 0.85, 0.7); g.add(bars);
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    scene.add(g);
    var ski = this._carRecord(g, [], x, z, heading, true, 'jetski', this.TYPES.jetski);
    ski.isJetSki = true;
    this.cars.push(ski);
    return ski;
  },

  // jet-ski physics: a boat that turns like a bike — fast launch, tight
  // steering, and it slides wide if you throw it hard into a turn. It
  // runs the bay from the beach (z 250) out to the open water (z 340)
  // and back; the hull bobs and the wake is the smoke pool as spray.
  _updateJetSki: function (dt) {
    var s = this.current;
    var throttle = Input.axisAction('down', 'up');
    var steerIn = Input.axisAction('left', 'right');
    var spec = this.TYPES.jetski;
    if (throttle > 0) s.speed += s.accel * dt;
    else if (throttle < 0) s.speed -= spec.brake * dt;
    else s.speed -= s.speed * 0.8 * dt; // a ski coasts shorter than a boat
    s.speed = SBUtils.clamp(s.speed, -5, s.maxFwd);
    if (Math.abs(s.speed) < 0.05 && throttle === 0) s.speed = 0;
    // tight steering that bites harder the faster you go, and a slide:
    // hard steering at speed kicks the tail out sideways
    s.steer = SBUtils.lerp(s.steer, steerIn, Math.min(1, dt * 5));
    s.heading += s.steer * dt * 1.6 * Math.sign(s.speed) * SBUtils.clamp(Math.abs(s.speed) / 12, 0.3, 1);
    if (Math.abs(steerIn) > 0.7 && Math.abs(s.speed) > 14) {
      s.slip = SBUtils.lerp(s.slip, steerIn * 4, Math.min(1, dt * 3));
    } else {
      s.slip = SBUtils.lerp(s.slip, 0, Math.min(1, dt * 2));
    }
    var fx = Math.sin(s.heading), fz = Math.cos(s.heading);
    s.x += (fx * s.speed + fz * s.slip) * dt;
    s.z += (fz * s.speed - fx * s.slip) * dt;
    // stay in the bay: beach on the north side, open water to the south
    s.x = SBUtils.clamp(s.x, -280, 280);
    s.z = SBUtils.clamp(s.z, 250, 340);
    s.group.position.set(s.x, 0, s.z);
    s.group.rotation.y = s.heading;
    // choppy bob — a ski bounces harder than the boat
    s.group.position.y = Math.sin(performance.now() * 0.004) * 0.12;
    s.group.rotation.z = Math.sin(performance.now() * 0.003) * 0.06;
    if (Math.abs(s.speed) > 8) {
      var wx = s.x - Math.sin(s.heading) * 1.8;
      var wz = s.z - Math.cos(s.heading) * 1.8;
      this._puffSmoke(wx, 0.3, wz);
    }
    AudioSys.setEngine(SBUtils.clamp(Math.abs(s.speed) / s.maxFwd, 0, 1), true);
  },

  // try to enter/exit with E; call once per frame from main.
  // entering picks the NEAREST drivable car, so all six types are stealable.
  tryToggle: function (playerX, playerZ) {
    if (this.current) {
      // exit: drop the player beside the car — off a boat, onto the pier;
      // off a jet ski, onto the beach just north of it
      var c = this.current;
      this.current = null;
      if (c.isBoat) return { exited: true, x: 272, z: 118 };
      if (c.isJetSki) return { exited: true, x: c.x, z: c.z - 4 };
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
      AudioSys.setEngineNote(best.type);
      AudioSys.blip(660);
      return { entered: true, car: best };
    }
    // no car close — but the boat is moored at the pier, board it instead
    if (this.boat && !this.boat.wrecked &&
        SBUtils.dist2D(playerX, playerZ, this.boat.x, this.boat.z) < 4.5) {
      this.current = this.boat;
      this.drivable = this.boat;
      AudioSys.setEngineNote('boat');
      AudioSys.blip(660);
      return { entered: true, car: this.boat };
    }
    // no boat either — but the jet ski is beached at the waterline
    if (this.jetSki && !this.jetSki.wrecked &&
        SBUtils.dist2D(playerX, playerZ, this.jetSki.x, this.jetSki.z) < 4.5) {
      this.current = this.jetSki;
      this.drivable = this.jetSki;
      AudioSys.setEngineNote('jetski');
      AudioSys.blip(660);
      return { entered: true, car: this.jetSki };
    }
    return null;
  },

  isDriving: function () { return !!this.current; },

  // damage stages from HP: 0 healthy, 1 scuffed, 2 smoking, 3 burning.
  // update() reads the stage to cap top speed and wobble the steering.
  _damageStageFor: function (hp) {
    if (hp >= 60) return 0;
    if (hp >= 40) return 1;
    if (hp >= 25) return 2;
    return 3;
  },

  // public read of a car's stage, for the HUD damage meter
  damageStageOf: function (car) {
    if (!car) return 0;
    return this._damageStageFor(car.hp);
  },

  // public read of a car's fuel state, for the HUD fuel chip: 'ok' while
  // the main tank has fuel, 'low' under 20, 'reserve' while the reserve
  // tank is carrying the car, 'empty' when both tanks are dry.
  fuelState: function (car) {
    if (!car) return 'ok';
    if (car.fuel > 20) return 'ok';
    if (car.fuel > 0) return 'low';
    if (car.reserve > 0) return 'reserve';
    return 'empty';
  },

  // restore a car to showroom state: full HP, no flat tyres, no slip.
  // The wreck-respawn path uses this after moving the car home.
  repairCar: function (car) {
    car.hp = 100;
    car.wrecked = false;
    car.flatTires = 0;
    car.slip = 0;
    car.damageStage = 0;
    car.speed = 0;
    car.steer = 0;
    car.fuel = car.fuelMax;
    car.fuelWarned = 0;
    car.reserve = car.reserveMax;
    car.reserveActive = false;
    car.reserveToasted = false;
  },

  // a wrecked car burns for 3 s, then respawns at its spawn point with
  // full HP — minus a $200 repair bill taken from the player
  _explode: function (car) {
    car.wrecked = true;
    car.speed = 0;
    car.slip = 0;
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

  // lay one skid-mark decal under a rear wheel
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

  // one grey smoke puff, rising and growing (see _updateDecals)
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

  // one orange fire puff, faster and shorter-lived than smoke
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

  // age every decal/particle: skid marks fade, smoke and fire rise,
  // grow and fade out. Shared by cars and the boat's wake.
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

  // boat physics: throttle and steer like a car, but on water — slower
  // to turn, no brakes to speak of, and the hull stays inside the
  // harbor inlet (x 242..298, z -58..178). The wake is the smoke pool,
  // re-used as white spray at the stern.
  _updateBoat: function (dt) {
    var b = this.current;
    var throttle = Input.axisAction('down', 'up');
    var steerIn = Input.axisAction('left', 'right');
    var spec = this.TYPES.boat;
    if (throttle > 0) b.speed += b.accel * dt;
    else if (throttle < 0) b.speed -= spec.brake * dt;
    else b.speed -= b.speed * 0.6 * dt; // water drag: a boat coasts long
    b.speed = SBUtils.clamp(b.speed, -6, b.maxFwd);
    if (Math.abs(b.speed) < 0.05 && throttle === 0) b.speed = 0;
    // boats turn slower than cars, and only while moving
    b.steer = SBUtils.lerp(b.steer, steerIn, Math.min(1, dt * 3));
    b.heading += b.steer * dt * 0.9 * Math.sign(b.speed);
    b.x += Math.sin(b.heading) * b.speed * dt;
    b.z += Math.cos(b.heading) * b.speed * dt;
    // stay inside the harbor inlet — the sea wall pushes you back
    var hb = World.harbor;
    b.x = SBUtils.clamp(b.x, hb.x0 + 2, hb.x1 - 2);
    b.z = SBUtils.clamp(b.z, hb.z0 + 2, hb.z1 - 2);
    b.group.position.set(b.x, 0, b.z);
    b.group.rotation.y = b.heading;
    // gentle bob on the water
    b.group.position.y = Math.sin(performance.now() * 0.002) * 0.08;
    b.group.rotation.z = Math.sin(performance.now() * 0.0015) * 0.03;
    // wake: white spray at the stern while moving at speed
    if (Math.abs(b.speed) > 5) {
      var wx = b.x - Math.sin(b.heading) * 4;
      var wz = b.z - Math.cos(b.heading) * 4;
      this._puffSmoke(wx, 0.4, wz);
    }
    AudioSys.setEngine(SBUtils.clamp(Math.abs(b.speed) / b.maxFwd, 0, 1), true);
  },

  update: function (dt, colliders) {
    var c = this.current;
    this._updateDecals(dt);
    if (this.hornCd > 0) this.hornCd -= dt;
    // the boat has its own physics — no wheels, no road, just water
    if (c && c.isBoat) { this._updateBoat(dt); return; }
    // the jet ski has its own physics too — fast, twitchy, all water
    if (c && c.isJetSki) { this._updateJetSki(dt); return; }
    // wrecked-car burn timer: respawn the car at its spawn point
    if (this.explosionCar) {
      this.explosionT -= dt;
      if (this.explosionT <= 0) {
        var ec = this.explosionCar;
        ec.x = ec.spawnX; ec.z = ec.spawnZ; ec.heading = ec.spawnHeading;
        ec.group.position.set(ec.x, 0, ec.z);
        ec.group.rotation.y = ec.heading;
        this.repairCar(ec);
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
    // damage stage this frame: caps top speed and wobbles the wheel
    c.damageStage = this._damageStageFor(c.hp);
    var stageCap = c.damageStage === 2 ? 0.85 : c.damageStage === 3 ? 0.7 : 1;
    var throttle = Input.axisAction('down', 'up');
    var steerIn = Input.axisAction('left', 'right');
    var brake = Input.actionDown('brake');
    // nitro: Shift while driving burns the meter for +40% top speed
    var wantNitro = Input.actionDown('nitro') && this.nitro > 0 && throttle > 0;
    if (wantNitro) this.nitro = Math.max(0, this.nitro - 30 * dt);
    else this.nitro = Math.min(this.nitroMax, this.nitro + 10 * dt);
    var maxFwd = c.maxFwd * stageCap * (wantNitro ? 1.4 : 1), maxRev = 9;
    // fuel: the throttle drinks it, nitro drinks it twice as fast. The
    // main tank (100) feeds a small reserve tank (8 units): when the main
    // tank runs dry the car switches to reserve — limp mode gets slower
    // (12% instead of 20%) and the reserve sips at 60% burn, so you get
    // one last chance to crawl to the pump. When the reserve is gone too
    // the car stalls dead and will not move until refuelled. Park inside
    // the gas station lot (World.gasStation) nearly stopped and the pump
    // refills the tank, $1 per 5 units at 25 units a second, main tank
    // first then the reserve, until you drive off or both are full.
    // fuelState() exposes the state ('ok' | 'low' | 'reserve' | 'empty')
    // for the HUD fuel chip. Warnings fire once per tank, and reset on refill.
    var burn = (throttle > 0 ? 0.35 : 0.08) * (wantNitro ? 2 : 1);
    if (c.fuel > 0) {
      c.fuel = Math.max(0, c.fuel - burn * dt);
      if (c.fuel <= 0 && c.reserve > 0 && !c.reserveActive) {
        c.reserveActive = true;
        HUD.toast('Main tank dry — running on the reserve!', '#ffd23f');
      }
    } else if (c.reserve > 0) {
      c.reserve = Math.max(0, c.reserve - burn * 0.6 * dt);
      if (c.reserve <= 0 && !c.reserveToasted) {
        c.reserveToasted = true;
        HUD.toast('Tank bone dry — the car is dead. Walk to the pump!', '#ff4444');
      }
    }
    if (c.fuel > 25) { c.fuelWarned = 0; c.reserveToasted = false; }
    var gs = World.gasStation;
    if (gs && (c.fuel < c.fuelMax || c.reserve < c.reserveMax) && Math.abs(c.speed) < 2 &&
        c.x > gs.minX && c.x < gs.maxX && c.z > gs.minZ && c.z < gs.maxZ) {
      c.fuelFrac = (c.fuelFrac || 0) + 25 * dt;
      while (c.fuelFrac >= 5 && Game.money >= 1 && (c.fuel < c.fuelMax || c.reserve < c.reserveMax)) {
        c.fuelFrac -= 5;
        if (c.fuel < c.fuelMax) c.fuel = Math.min(c.fuelMax, c.fuel + 5);
        else c.reserve = Math.min(c.reserveMax, c.reserve + 5);
        Game.money -= 1;
      }
      if (c.fuel > 0) c.reserveActive = false;
      if (c.fuel >= c.fuelMax && c.reserve >= c.reserveMax) c.fuelFrac = 0;
    } else {
      c.fuelFrac = 0;
    }
    if (c.fuel <= 0 && c.reserve <= 0 && c.fuelWarned < 2) {
      c.fuelWarned = 2;
      HUD.toast('Out of fuel — the car is dead!', '#ff4444');
    } else if (c.fuel < 20 && c.fuel > 0 && c.fuelWarned < 1) {
      c.fuelWarned = 1;
      HUD.toast('Low fuel — find a gas station', '#ffd23f');
    }
    if (c.fuel <= 0 && c.reserve > 0) maxFwd *= 0.12; // reserve limp: slower than main-tank limp
    else if (c.fuel <= 0) { maxFwd = 0; maxRev = 0; } // bone dry: stalled, no drive at all
    // sand: the beach (z past the 250 line) drags — top speed drops and
    // the car slides more, so the dunes are for showing off, not escaping
    var onSand = c.z > World.BEACH_Z - 4;
    if (onSand) maxFwd *= 0.6;
    // nitro flames: orange puffs from the exhaust while the boost burns
    if (wantNitro) {
      this.nitroFxT -= dt;
      if (this.nitroFxT <= 0) {
        this.nitroFxT = 0.12;
        var ex = c.x - Math.sin(c.heading) * c.len * 0.5;
        var ez = c.z - Math.cos(c.heading) * c.len * 0.5;
        this._puffFire(ex, 0.7, ez);
      }
    }
    // shredded tyres (spike strip): top speed halves while the timer runs
    if (c.flatTires > 0) { c.flatTires -= dt; maxFwd = Math.min(maxFwd, 12); }
    if (throttle > 0) c.speed += c.accel * dt;
    else if (throttle < 0) c.speed -= (c.speed > 0.5 ? c.brake : 9) * dt;
    else c.speed -= c.speed * 1.2 * dt; // drag
    if (brake) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), c.brake * dt);
    c.speed = SBUtils.clamp(c.speed, -maxRev, maxFwd);
    if (Math.abs(c.speed) < 0.05 && throttle === 0) c.speed = 0;
    // drifting: handbrake at speed, or hard steering at speed, lays rubber.
    // A drifty spec (bike, convertible) breaks loose easier and slides more.
    var driftEase = c.drift * SBUtils.clamp(Math.abs(c.speed) / maxFwd, 0, 1);
    var drifting = (brake && Math.abs(c.speed) > 10) ||
      (Math.abs(steerIn) > 0.7 && Math.abs(c.speed) > maxFwd * 0.55);
    // slip: lateral velocity across the heading. Drifting feeds it, grip
    // bleeds it off; while slipping the car slides sideways and the
    // steering bites less, which is what a drift feels like.
    var slipTarget = drifting ? steerIn * Math.abs(c.speed) * 0.35 * c.drift : 0;
    var slipRate = (drifting ? 4 : 2.2 * c.grip) * (onSand ? 0.6 : 1);
    c.slip = SBUtils.lerp(c.slip, slipTarget, Math.min(1, dt * slipRate));
    // screech follows drift intensity: gentle slide whispers, hard drift wails
    AudioSys.setScreech(drifting ? SBUtils.clamp(Math.abs(c.speed) / maxFwd, 0, 1) : 0);
    if (drifting || Math.abs(c.slip) > 4) {
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
    // steering scales with speed and with the spec's turn rate, reverses
    // when backing up, and goes soft while the car is sliding sideways
    var steerTarget = steerIn * c.steerRate * SBUtils.clamp(Math.abs(c.speed) / 8, 0, 1);
    c.steer = SBUtils.lerp(c.steer, steerTarget, Math.min(1, dt * 6 * c.grip));
    var steerAuthority = 1 - Math.min(0.5, Math.abs(c.slip) / 20);
    c.heading += c.steer * (c.speed / 9) * dt * steerAuthority * (c.speed >= 0 ? 1 : -1);
    // stage-3 wobble: a burning car pulls left and right on its own
    if (c.damageStage === 3) {
      c.wobble += dt;
      c.heading += Math.sin(c.wobble * 9) * 0.06 * dt * SBUtils.clamp(Math.abs(c.speed) / 10, 0, 1);
    }
    // move: forward along the heading plus the sideways slip vector
    var fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    var rx = fz, rz = -fx; // right vector, perpendicular to the heading
    var nx = c.x + (fx * c.speed + rx * c.slip) * dt;
    var nz = c.z + (fz * c.speed + rz * c.slip) * dt;
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
      // heavier cars shrug off a bump better than light ones
      c.speed *= SBUtils.clamp(0.35 + 0.1 * (c.mass - 1), 0.25, 0.6);
      c.slip *= 0.4;
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
        var sx = c.x + Math.sin(c.heading) * c.len * 0.4;
        var sz = c.z + Math.cos(c.heading) * c.len * 0.4;
        this._puffSmoke(sx, 1.1, sz);
        if (c.hp < 25) this._puffFire(sx, 1.3, sz);
      }
    }
    // wheel spin + front steer visual
    for (var k = 0; k < c.wheels.length; k++) {
      c.wheels[k].rotation.x += c.speed * dt * 0.9;
    }
    if (c.wheels.length >= 2) {
      c.wheels[0].rotation.y = c.steer * 0.5;
      c.wheels[1].rotation.y = c.steer * 0.5;
    }
    AudioSys.setEngine(Math.abs(c.speed) / maxFwd, true);
  }
};
