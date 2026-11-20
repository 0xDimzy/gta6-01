// traffic.js — traffic cars + pedestrians + city buses...
var Traffic = {
  cars: [],
  peds: [],
  bus: null,
  buses: [],
  busStops: [],
  taxi: null,
  ridingTaxi: false,
  lights: [],
  emergency: [],
  roadCoords: [-180, -120, -60, 0, 60, 120, 180],
  hitCooldown: 0,
  shotThreat: null,
  clockH: 8.0,
  density: 1.0,

  // driver personalities: how fast they go, how close the...
  PERSONALITIES: {
    aggressive: { speedMul: 1.25, follow: 12, overtake: 1.0, honk: 1.5, pauseChance: 0.15 },
    normal:     { speedMul: 1.0,  follow: 9,  overtake: 0.6, honk: 2.5, pauseChance: 0.5 },
    cautious:   { speedMul: 0.8,  follow: 14, overtake: 0.0, honk: 4.0, pauseChance: 0.7 },
    sunday:     { speedMul: 0.65, follow: 16, overtake: 0.0, honk: 6.0, pauseChance: 0.8 }
  },

  // walker kinds: commuters hurry, tourists dawdle and st...
  PED_KINDS: {
    commuter: { speedMin: 1.6, speedMax: 2.4, jayChance: 0.5, pauseChance: 0.0 },
    tourist:  { speedMin: 0.8, speedMax: 1.2, jayChance: 0.2, pauseChance: 0.6 },
    jogger:   { speedMin: 3.2, speedMax: 4.0, jayChance: 0.0, pauseChance: 0.0 },
    worker:   { speedMin: 1.2, speedMax: 1.8, jayChance: 0.4, pauseChance: 0.1 }
  },

  // bus routes: name, colour, start, loop waypoints, dwel...
  BUS_ROUTES: [
    { name: '1 · Downtown Loop', color: 0x2a9d8f, start: [-180, -180], heading: Math.PI / 2, speed: 9,
      waypoints: [[180, -180], [180, 180], [-180, 180], [-180, -180]], dwell: [3, 3, 5, 3],
      stops: ['South Gate', 'Park Corner', 'Old Town', 'Downtown'] },
    { name: '2 · Crosstown', color: 0x3a6ea5, start: [-180, 120], heading: Math.PI / 2, speed: 10,
      waypoints: [[180, 120], [180, -120], [-180, -120], [-180, 120]], dwell: [3, 4, 3, 4],
      stops: ['West Market', 'East Plaza', 'North Gate', 'Old Town'] }
  ],

  // signalised intersections, with a per-light cycle offs...
  LIGHT_SPOTS: [
    { x: 0, z: 0, offset: 0 },
    { x: 60, z: -60, offset: 3.1 },
    { x: 0, z: 120, offset: 6.2 }
  ],

  build: function (scene) {
    this.scene = scene;
    this._buildTrafficCars(scene);
    this._buildTaxi(scene);
    this._buildPeds(scene);
    this._buildBuses(scene);
    this._buildBusStops(scene);
    this._buildLights(scene);
    this._buildEmergency(scene);
  },

  // ten ordinary cars, one per road, each with a personal...
  _buildTrafficCars: function (scene) {
    var colors = [0x3a6ea5, 0xb23a48, 0x4a7c59, 0xd9d9d9, 0x222831, 0x8e44ad, 0x2a9d8f, 0xe07b39, 0xf4d35e, 0x8338ec];
    for (var i = 0; i < 10; i++) {
      var horizontal = Math.random() < 0.5;
      var coord = SBUtils.choice(this.roadCoords);
      var lane = coord + (Math.random() < 0.5 ? 2.2 : -2.2);
      var dir = Math.random() < 0.5 ? 1 : -1;
      var along = SBUtils.rand(-260, 260);
      var x = horizontal ? along : lane;
      var z = horizontal ? lane : along;
      var heading = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      var car = Vehicle._makeCar(scene, x, z, heading, SBUtils.randChoice(colors), false);
      var pr = Math.random();
      var persName = pr < 0.2 ? 'aggressive' : pr < 0.7 ? 'normal' : pr < 0.9 ? 'cautious' : 'sunday';
      var pers = this.PERSONALITIES[persName];
      var sp = SBUtils.rand(8, 13) * pers.speedMul;
      car.traffic = { horizontal: horizontal, coord: coord, dir: dir, speed: sp, baseSpeed: sp,
        pause: SBUtils.rand(0, 1.5), pauseIn: SBUtils.rand(4, 10), honkCd: 0,
        laneOff: lane - coord, laneTarget: lane - coord, overtakeCd: 0, blockedBy: null,
        personality: persName };
      this.cars.push(car);
    }
  },

  // the taxi: yellow cab with a roof sign, cruises the gr...
  _buildTaxi: function (scene) {
    var tg = Vehicle._makeCar(scene, -30, -30, 0, 0xf2c500, false);
    var sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    sign.position.set(0, 1.6, 0); tg.group.add(sign);
    tg.traffic = { horizontal: false, coord: -30, dir: 1, speed: 9, baseSpeed: 9, pause: 0, pauseIn: 8, honkCd: 0,
      laneOff: 0, laneTarget: 0, overtakeCd: 0, blockedBy: null, personality: 'normal' };
    this.taxi = tg;
    this.cars.push(tg);
  },

  _buildPeds: function (scene) {
    var shirts = [0xe63946, 0x2a9d8f, 0xe9c46a, 0x4361ee, 0xf72585, 0x80b918, 0xf8f9fa, 0x222222, 0xff9f1c, 0x7209b7, 0x06d6a0, 0xef476f];
    for (var i = 0; i < 12; i++) {
      this._spawnPed(scene, shirts[i % shirts.length]);
    }
  },

  // one bus per BUS_ROUTES entry, built by the shared mes...
  _buildBuses: function (scene) {
    for (var i = 0; i < this.BUS_ROUTES.length; i++) {
      var route = this.BUS_ROUTES[i];
      var g = this._buildBusMesh(scene, route.color);
      g.position.set(route.start[0], 0, route.start[1]);
      scene.add(g);
      var bus = {
        group: g, x: route.start[0], z: route.start[1], heading: route.heading, speed: route.speed,
        waypoints: route.waypoints, dwell: route.dwell, stops: route.stops, routeName: route.name,
        wp: 0, stopT: 0, stopName: '', doorOpen: false,
        passengers: 4 + i * 3, capacity: 24, lastBoarded: 0, lastAlighted: 0
      };
      this.buses.push(bus);
      if (i === 0) this.bus = bus;
    }
  },

  // a bus body: long box, white stripe, four wheels — col...
  _buildBusMesh: function (scene, color) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 8.5), new THREE.MeshLambertMaterial({ color: color }));
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
    return g;
  },

  // stop signs at every route stop: a pole and a blue boa...
  _buildBusStops: function (scene) {
    for (var r = 0; r < this.BUS_ROUTES.length; r++) {
      var route = this.BUS_ROUTES[r];
      for (var s = 0; s < route.waypoints.length; s++) {
        var wp = route.waypoints[s];
        var pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6),
          new THREE.MeshLambertMaterial({ color: 0x30343a })
        );
        pole.position.set(wp[0] + 7, 1.6, wp[1] + 7);
        pole.castShadow = true;
        scene.add(pole);
        var sign = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.7, 0.1),
          new THREE.MeshLambertMaterial({ color: 0x2a6ac2 })
        );
        sign.position.set(wp[0] + 7, 3.2, wp[1] + 7);
        scene.add(sign);
        this.busStops.push({ x: wp[0] + 7, z: wp[1] + 7, route: route.name, name: route.stops[s] });
      }
    }
  },

  // emergency vehicles: an ambulance and a fire truck loo...
  _buildEmergency: function (scene) {
    // ambulance: white van, red stripe, red/blue light bar...
    var amb = Vehicle._makeCar(scene, -60, -60, 0, 0xf2f2f2, false, 'van');
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.3, 5.45), new THREE.MeshLambertMaterial({ color: 0xcc2222 }));
    stripe.position.y = 1.1; amb.group.add(stripe);
    var ambL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.35), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    ambL.position.set(-0.45, 2.0, -0.2); amb.group.add(ambL);
    var ambR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.35), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    ambR.position.set(0.45, 2.0, -0.2); amb.group.add(ambR);
    // fire truck: red van with a ladder on the roof, loops...
    var fire = Vehicle._makeCar(scene, 60, 60, Math.PI, 0xcc2222, false, 'van');
    var ladder = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 5.0), new THREE.MeshLambertMaterial({ color: 0xc0c0c0 }));
    ladder.position.y = 2.0; fire.group.add(ladder);
    var fireL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.35), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    fireL.position.set(-0.45, 2.0, -0.2); fire.group.add(fireL);
    var fireR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.35), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    fireR.position.set(0.45, 2.0, -0.2); fire.group.add(fireR);
    this.emergency = [
      { car: amb, lightL: ambL, lightR: ambR, speed: 11, waypoints: [[-60, -60], [60, -60], [60, 60], [-60, 60]], wp: 0 },
      { car: fire, lightL: fireL, lightR: fireR, speed: 9, waypoints: [[60, 60], [60, -60], [-60, -60], [-60, 60]], wp: 0 }
    ];
  },

  _buildLights: function (scene) {
    for (var i = 0; i < this.LIGHT_SPOTS.length; i++) {
      var s = this.LIGHT_SPOTS[i];
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
        x: s.x, z: s.z, timer: s.offset,
        red: mk(0xff2222, 6.1), yellow: mk(0xffd23f, 5.4), green: mk(0x2aff66, 4.7)
      });
    }
  },

  // 12.5 s cycle: NS green 6 s, yellow 1.5 s, then EW gre...
  _lightState: function (light) {
    var ph = light.timer % 12.5;
    return { ns: ph < 6 ? 'green' : ph < 7.5 ? 'yellow' : 'red',
             ew: ph < 6 ? 'red' : ph < 7.5 ? 'red' : 'green' };
  },

  // is this car about to run a red light? (checked before...
  _redAhead: function (car) {
    var t = car.traffic;
    for (var i = 0; i < this.lights.length; i++) {
      var L = this.lights[i];
      var st = this._lightState(L);
      var go = t.horizontal ? st.ew : st.ns;
      if (go !== 'red') continue;
      // car approaching the intersection on its road, within...
      var along = t.horizontal ? car.x : car.z;
      var cross = t.horizontal ? L.x : L.z;
      var laneOff = t.horizontal ? Math.abs(car.z - L.z) : Math.abs(car.x - L.x);
      var ahead = (cross - along) * t.dir;
      if (laneOff < 4 && ahead > 0 && ahead < 11) return true;
    }
    return false;
  },

  // the nearest grid road to a coordinate, and how far aw...
  _nearestRoad: function (value) {
    var best = this.roadCoords[0], bd = 1e9;
    for (var i = 0; i < this.roadCoords.length; i++) {
      var dd = Math.abs(this.roadCoords[i] - value);
      if (dd < bd) { bd = dd; best = this.roadCoords[i]; }
    }
    return { coord: best, dist: bd };
  },

  // the clock: one game hour per 30 real seconds. Rush ho...
  _rushFactor: function (h) {
    if (h >= 7 && h < 9) return 1.6;
    if (h >= 17 && h < 19) return 1.5;
    if (h >= 22 || h < 5) return 0.5;
    if (h >= 11 && h < 14) return 1.2;
    return 1.0;
  },

  _updateClock: function (dt) {
    var wasRush = this.density >= 1.5;
    this.clockH = (this.clockH + dt / 30) % 24;
    this.density = this._rushFactor(this.clockH);
    if (this.density >= 1.5 && !wasRush) {
      HUD.toast('Rush hour — traffic is heavy', '#ffd23f');
    }
  },

  // lane-changing AI: a car stuck behind a slower car in...
  _overtake: function (car, dt) {
    var t = car.traffic;
    var pers = this.PERSONALITIES[t.personality || 'normal'];
    if (t.overtakeCd > 0) t.overtakeCd -= dt;
    var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    var ahead = null, aheadD = 1e9;
    for (var i = 0; i < this.cars.length; i++) {
      var o = this.cars[i];
      if (o === car) continue;
      var odx = o.x - car.x, odz = o.z - car.z;
      var along = odx * fx + odz * fz;
      var lat = Math.abs(odx * fz - odz * fx);
      // same direction, same lane, slower, and close ahead
      if (along > 0 && along < 18 && lat < 2.5 && Math.abs(o.heading - car.heading) < 0.3) {
        var oSpeed = o.traffic ? o.traffic.speed : 0;
        if (oSpeed < t.baseSpeed && along < aheadD) { aheadD = along; ahead = o; }
      }
    }
    if (ahead && t.laneTarget === t.laneOff && t.overtakeCd <= 0 && pers.overtake > 0 && Math.random() < pers.overtake) {
      // is the other lane free for the next 14 units?
      var target = t.laneOff >= 0 ? -2.2 : 2.2;
      var blocked = false;
      for (var j = 0; j < this.cars.length; j++) {
        var o2 = this.cars[j];
        if (o2 === car) continue;
        var d2x = o2.x - car.x, d2z = o2.z - car.z;
        var along2 = d2x * fx + d2z * fz;
        var lat2 = d2x * fz - d2z * fx;
        if (along2 > -8 && along2 < 16 && Math.abs(lat2 - target) < 2.5) { blocked = true; break; }
      }
      if (!blocked) {
        t.laneTarget = target;
        t.overtakeCd = 5;
        if (SBUtils.dist2D(car.x, car.z, Player.x, Player.z) < 25) AudioSys.horn();
      }
    } else if (!ahead && t.laneTarget !== t.laneOff) {
      // past the slow car (or it moved on): drift back to the...
      t.laneTarget = t.laneOff;
    }
    // ease the lateral offset toward its target — the visib...
    var cur = t.horizontal ? car.z - t.coord : car.x - t.coord;
    var next = SBUtils.lerp(cur, t.laneTarget, Math.min(1, dt * 1.6));
    if (t.horizontal) car.z = t.coord + next; else car.x = t.coord + next;
    return ahead;
  },

  // taxi ride: press T near the cab ($20). It drives you...
  tryHailTaxi: function (playerX, playerZ) {
    if (this.ridingTaxi || !this.taxi) return false;
    if (SBUtils.dist2D(playerX, playerZ, this.taxi.x, this.taxi.z) > 6) return false;
    if (Game.money < 20) { HUD.toast('Taxi fare is $20 — not enough cash', '#ff4444'); return false; }
    Game.money -= 20;
    this.ridingTaxi = true;
    var blip = Missions.getBlip();
    this.taxi.rideTarget = blip ? { x: blip.x, z: blip.z } : { x: 240, z: 240 };
    HUD.toast('Taxi! Riding to the marker — $20', '#ffd23f');
    AudioSys.blip(880);
    return true;
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

  // a walker: kind first (commuters hurry, tourists dawdl...
  _spawnPed: function (scene, shirtColor) {
    var spot = this._sidewalkSpot();
    var kr = Math.random();
    var kindName = kr < 0.4 ? 'commuter' : kr < 0.6 ? 'tourist' : kr < 0.75 ? 'jogger' : 'worker';
    var kind = this.PED_KINDS[kindName];
    var ped = {
      group: null, legL: null, legR: null,
      x: spot.x, z: spot.z, axis: spot.axis, dir: spot.dir,
      speed: SBUtils.rand(kind.speedMin, kind.speedMax), state: 'walk',
      kind: kindName, pauseT: 0,
      fleeT: 0, fleeX: 0, fleeZ: 0, downT: 0, phase: SBUtils.rand(0, 6),
      jayT: SBUtils.rand(6, 20), crossing: false,
      crossFrom: 0, crossTo: 0, crossAxis: 'x'
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

  // pedestrians within range flee from (x, z) — called on...
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

  // ---- per-frame systems, one helper each ----

  // taxi ride: drive straight at the marker, drop the pla...
  _updateTaxi: function (dt) {
    if (!this.ridingTaxi || !this.taxi) return;
    var cab = this.taxi;
    var tx = cab.rideTarget.x, tz = cab.rideTarget.z;
    var tdx = tx - cab.x, tdz = tz - cab.z;
    var tdist = Math.sqrt(tdx * tdx + tdz * tdz);
    if (tdist < 6) {
      this.ridingTaxi = false;
      Player.x = cab.x + 3; Player.z = cab.z + 3;
      Player.group.position.set(Player.x, 0, Player.z);
      HUD.toast('Taxi dropped you off', '#7dff9a');
      AudioSys.blip(990);
    } else {
      var wantHeading = Math.atan2(tdx, tdz);
      cab.heading = SBUtils.lerpAngle(cab.heading, wantHeading, Math.min(1, dt * 2));
      cab.x += Math.sin(cab.heading) * 13 * dt;
      cab.z += Math.cos(cab.heading) * 13 * dt;
      cab.group.position.set(cab.x, 0, cab.z);
      cab.group.rotation.y = cab.heading;
    }
  },

  // traffic lights: advance the cycle, light the lamps
  _updateLights: function (dt) {
    for (var li = 0; li < this.lights.length; li++) {
      var L = this.lights[li];
      L.timer += dt;
      var st = this._lightState(L);
      // NS lamp shows the NS state; EW drivers read the same...
      L.red.visible = st.ns === 'red';
      L.yellow.visible = st.ns === 'yellow';
      L.green.visible = st.ns === 'green';
    }
  },

  // one bus: dwell at the stop (doors open, passengers sw...
  _updateBus: function (b, dt) {
    if (b.stopT > 0) {
      b.stopT -= dt;
      if (b.stopT <= 0) b.doorOpen = false;
      return;
    }
    var wp = b.waypoints[b.wp];
    var dx = wp[0] - b.x, dz = wp[1] - b.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var wantHeading = Math.atan2(dx, dz);
    b.heading = SBUtils.angleLerp(b.heading, wantHeading, Math.min(1, dt * 4));
    if (dist < 1.5) {
      var arrived = b.wp;
      b.wp = (b.wp + 1) % b.waypoints.length;
      b.stopT = b.dwell[arrived];
      b.stopName = b.stops[arrived];
      b.doorOpen = true;
      // passengers: some alight, some board, capped at capacity
      var alight = Math.floor(Math.random() * (b.passengers + 1));
      var room = b.capacity - (b.passengers - alight);
      var board = Math.floor(Math.random() * (Math.min(6, room) + 1));
      b.passengers = b.passengers - alight + board;
      b.lastAlighted = alight;
      b.lastBoarded = board;
    } else {
      b.x += Math.sin(b.heading) * b.speed * dt;
      b.z += Math.cos(b.heading) * b.speed * dt;
    }
    b.group.position.set(b.x, 0, b.z);
    b.group.rotation.y = b.heading;
  },

  // emergency vehicles: ambulance + fire truck loop their...
  _updateEmergency: function (dt) {
    for (var ei = 0; ei < this.emergency.length; ei++) {
      var ev = this.emergency[ei];
      var car = ev.car;
      var ewp = ev.waypoints[ev.wp];
      var edx = ewp[0] - car.x, edz = ewp[1] - car.z;
      var edist = Math.sqrt(edx * edx + edz * edz);
      var ewant = Math.atan2(edx, edz);
      car.heading = SBUtils.angleLerp(car.heading, ewant, Math.min(1, dt * 3));
      if (edist < 2) {
        ev.wp = (ev.wp + 1) % ev.waypoints.length;
      } else {
        car.x += Math.sin(car.heading) * ev.speed * dt;
        car.z += Math.cos(car.heading) * ev.speed * dt;
      }
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
      // light bars flash red/blue, alternating every half second
      var eon = Math.floor(performance.now() / 500) % 2 === 0;
      ev.lightL.visible = eon;
      ev.lightR.visible = !eon;
    }
  },

  // one traffic car: pause timer, red lights, the player...
  _updateTrafficCar: function (c, dt, px, pz) {
    var t = c.traffic;
    if (c === this.taxi && this.ridingTaxi) return;
    if (t.honkCd > 0) t.honkCd -= dt;
    var pers = this.PERSONALITIES[t.personality || 'normal'];
    var speed = 0;
    if (t.pause > 0) {
      t.pause -= dt;
    } else {
      speed = t.baseSpeed * (this.density > 1.2 ? 0.8 : 1.0);
      // stop at a red light
      if (this._redAhead(c)) speed = 0;
      // slow/stop for the player ahead — and honk if the play...
      var fx = Math.sin(c.heading), fz = Math.cos(c.heading);
      var dx = px - c.x, dz = pz - c.z;
      var ahead = dx * fx + dz * fz;
      var lat = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 12 && lat < 3.5) {
        speed = 0;
        if (t.honkCd <= 0) { t.honkCd = pers.honk; AudioSys.horn(); }
      }
      // slow/stop for another traffic car ahead on the same r...
      var blockedBy = null;
      for (var j = 0; j < this.cars.length; j++) {
        if (this.cars[j] === c) continue;
        var o = this.cars[j], ot = o.traffic;
        if (ot.horizontal !== t.horizontal || ot.coord !== t.coord || ot.dir !== t.dir) continue;
        var odx = o.x - c.x, odz = o.z - c.z;
        var oa = odx * fx + odz * fz;
        var ol = Math.abs(odx * fz - odz * fx);
        if (oa > 0 && oa < pers.follow && ol < 3) { speed = 0; blockedBy = o; break; }
      }
      // a jaywalker crossing ahead: brake, do not run them over
      for (var pj = 0; pj < this.peds.length; pj++) {
        var pdj = this.peds[pj];
        if (!pdj.crossing) continue;
        var dcx = pdj.x - c.x, dcz = pdj.z - c.z;
        var alongC = dcx * fx + dcz * fz;
        var latC = Math.abs(dcx * fz - dcz * fx);
        if (alongC > 0 && alongC < 12 && latC < 4) { speed = 0; break; }
      }
      // emergency vehicle bearing down behind you with lights...
      for (var ei2 = 0; ei2 < this.emergency.length; ei2++) {
        var ev2 = this.emergency[ei2].car;
        var evdx = ev2.x - c.x, evdz = ev2.z - c.z;
        var evalong = evdx * fx + evdz * fz;
        var evlat = Math.abs(evdx * fz - evdz * fx);
        if (evalong > -16 && evalong < 4 && evlat < 4) { speed = 0; break; }
      }
      // lane-changing AI: if a slow car blocks the lane, swin...
      if (blockedBy) this._overtake(c, dt);
      else if (t.laneTarget !== t.laneOff) this._overtake(c, dt);
      // brief stop at intersections, now and then — likelier...
      t.pauseIn -= dt;
      if (t.pauseIn <= 0) {
        var along = t.horizontal ? c.x : c.z;
        var nearCross = false;
        for (var k = 0; k < this.roadCoords.length; k++) {
          if (Math.abs(along - this.roadCoords[k]) < 5) { nearCross = true; break; }
        }
        if (nearCross && Math.random() < pers.pauseChance) t.pause = SBUtils.rand(0.8, 2.2);
        t.pauseIn = SBUtils.rand(6, 12) / this.density;
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
    // traffic car hits the player on foot — never while mid...
    if (!Vehicle.isDriving() && !this.ridingTaxi && !Player.rolling && this.hitCooldown <= 0 &&
        SBUtils.dist2D(c.x, c.z, Player.x, Player.z) < 2.0) {
      this.hitCooldown = 1;
      Game.health = Math.max(0, Game.health - 25);
      var hx = Player.x - c.x, hz = Player.z - c.z;
      var hd = Math.max(0.1, Math.sqrt(hx * hx + hz * hz));
      Player.x += hx / hd * 2.5; Player.z += hz / hd * 2.5;
      Player.group.position.set(Player.x, 0, Player.z);
      HUD.damageFrom(c.x, c.z);
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
  },

  // one pedestrian: downed walkers respawn, everyone flee...
  _updatePed: function (ped, dt, driving, px, pz) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) {
        var spot = this._sidewalkSpot();
        ped.x = spot.x; ped.z = spot.z; ped.axis = spot.axis; ped.dir = spot.dir;
        ped.state = 'walk';
        ped.group.rotation.z = 0;
        ped.group.position.set(ped.x, 0, ped.z);
      }
      return;
    }
    // flee from the player car or a gunshot
    var fleeing = false, tx2 = 0, tz2 = 0;
    if (driving) {
      var dCar = SBUtils.dist2D(ped.x, ped.z, px, pz);
      if (dCar < 7) { fleeing = true; tx2 = ped.x - px; tz2 = ped.z - pz; ped.fleeT = 2.5; }
    }
    if (this.shotThreat && SBUtils.dist2D(ped.x, ped.z, this.shotThreat.x, this.shotThreat.z) < 18) {
      fleeing = true; tx2 = ped.x - this.shotThreat.x; tz2 = ped.z - this.shotThreat.z; ped.fleeT = 2.5;
    }
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      fleeing = true;
      tx2 = ped.fleeX; tz2 = ped.fleeZ;
    }
    if (fleeing) {
      var fl = Math.max(0.1, Math.sqrt(tx2 * tx2 + tz2 * tz2));
      ped.fleeX = tx2 / fl; ped.fleeZ = tz2 / fl;
      ped.x += ped.fleeX * 5 * dt;
      ped.z += ped.fleeZ * 5 * dt;
      ped.x = SBUtils.clamp(ped.x, -288, 288);
      ped.z = SBUtils.clamp(ped.z, -288, 294);
      ped.group.rotation.y = Math.atan2(ped.fleeX, ped.fleeZ);
      ped.phase += dt * 11;
      ped.legL.rotation.x = Math.sin(ped.phase) * 0.8;
      ped.legR.rotation.x = -Math.sin(ped.phase) * 0.8;
      ped.group.position.set(ped.x, 0, ped.z);
      return;
    }
    // tourists stop to look around: stand still, turn slowl...
    if (ped.pauseT > 0) {
      ped.pauseT -= dt;
      ped.group.rotation.y += dt * 0.8;
      ped.legL.rotation.x = 0;
      ped.legR.rotation.x = 0;
      return;
    }
    // jaywalking: every so often a walker crosses the neare...
    if (ped.crossing) {
      var crossSpeed = 2.4;
      if (ped.crossAxis === 'x') {
        ped.x += Math.sign(ped.crossTo - ped.crossFrom) * crossSpeed * dt;
        if (Math.abs(ped.x - ped.crossTo) < 0.5) { ped.crossing = false; }
      } else {
        ped.z += Math.sign(ped.crossTo - ped.crossFrom) * crossSpeed * dt;
        if (Math.abs(ped.z - ped.crossTo) < 0.5) { ped.crossing = false; }
      }
      ped.group.rotation.y = ped.crossAxis === 'x'
        ? (ped.crossTo > ped.crossFrom ? Math.PI / 2 : -Math.PI / 2)
        : (ped.crossTo > ped.crossFrom ? 0 : Math.PI);
      ped.phase += dt * ped.speed * 2.2;
      ped.legL.rotation.x = Math.sin(ped.phase) * 0.6;
      ped.legR.rotation.x = -Math.sin(ped.phase) * 0.6;
      ped.group.position.set(ped.x, 0, ped.z);
      return;
    }
    ped.jayT -= dt;
    if (ped.jayT <= 0) {
      ped.jayT = SBUtils.rand(10, 26);
      var kind = this.PED_KINDS[ped.kind || 'commuter'];
      // tourists mostly stop to look instead of crossing
      if (Math.random() < kind.pauseChance) {
        ped.pauseT = SBUtils.rand(2, 5);
      } else if (Math.random() < kind.jayChance) {
        var near = this._nearestRoad(ped.z);
        if (near.dist < 40) {
          ped.crossing = true;
          ped.crossAxis = 'z';
          ped.crossFrom = ped.z;
          ped.crossTo = near.coord + (ped.z < near.coord ? 12 : -12);
        }
      }
    }
    // walk along the sidewalk
    var step2 = ped.speed * dt;
    if (ped.axis === 'x') ped.x += ped.dir * step2; else ped.z += ped.dir * step2;
    var along2 = ped.axis === 'x' ? ped.x : ped.z;
    if (along2 > 285 || along2 < -285) ped.dir *= -1;
    // snap back onto the sidewalk line after fleeing
    if (ped.axis === 'x') {
      var nearZ = this._nearestRoad(ped.z);
      var wantZ = nearZ.coord + (ped.z >= nearZ.coord ? 7 : -7);
      ped.z += (wantZ - ped.z) * Math.min(1, dt * 2);
    } else {
      var nearX = this._nearestRoad(ped.x);
      var wantX = nearX.coord + (ped.x >= nearX.coord ? 7 : -7);
      ped.x += (wantX - ped.x) * Math.min(1, dt * 2);
    }
    ped.group.rotation.y = ped.axis === 'x' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
    ped.phase += dt * ped.speed * 2.2;
    // joggers pump their legs harder than walkers
    var swing = ped.kind === 'jogger' ? 0.9 : 0.6;
    ped.legL.rotation.x = Math.sin(ped.phase) * swing;
    ped.legR.rotation.x = -Math.sin(ped.phase) * swing;
    ped.group.position.set(ped.x, 0, ped.z);
    // run over by the player car
    if (driving && SBUtils.dist2D(ped.x, ped.z, px, pz) < 2.2) {
      this.knockDown(ped, 'car');
    }
  },

  update: function (dt) {
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    if (this.shotThreat) {
      this.shotThreat.t -= dt;
      if (this.shotThreat.t <= 0) this.shotThreat = null;
    }
    this._updateClock(dt);
    var px = Vehicle.isDriving() ? Vehicle.drivable.x : Player.x;
    var pz = Vehicle.isDriving() ? Vehicle.drivable.z : Player.z;
    this._updateTaxi(dt);
    this._updateLights(dt);
    for (var bi = 0; bi < this.buses.length; bi++) this._updateBus(this.buses[bi], dt);
    this._updateEmergency(dt);
    for (var i = 0; i < this.cars.length; i++) this._updateTrafficCar(this.cars[i], dt, px, pz);
    // slow health regen when not recently hit
    if (this.hitCooldown <= 0 && Game.health > 0 && Game.health < 100) {
      Game.health = Math.min(100, Game.health + 4 * dt);
    }
    var driving = Vehicle.isDriving();
    for (var p = 0; p < this.peds.length; p++) this._updatePed(this.peds[p], dt, driving, px, pz);
  }
};
