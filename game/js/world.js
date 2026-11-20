// world.js — Solmaris Bay: the city itself.
var World = {
  SIZE: 600,
  ROAD_STEP: 60,
  ROAD_HALF: 5,
  BEACH_Z: 250,
  SEA_Z: 292,
  colliders: [],
  buildings: [],
  roads: [],
  harbor: { x0: 240, x1: 300, z0: -60, z1: 180 },
  park: { x: -90, z: 90, s: 50 },
  oldTown: { x: -240, z: -240 },
  airport: { x: -260, z: 30 },
  stadium: { x: 240, z: -240, w: 96, d: 76 },
  campus: { x: 240, z: 222, w: 96, d: 52 },
  construction: [
    { x: -30, z: -90, s: 44 },
    { x: 150, z: 210, s: 44 }
  ],
  parking: [
    { x: 90, z: 30, w: 28, d: 20 },
    { x: -90, z: -90, w: 28, d: 20 }
  ],
  spawnDowntown: { x: 4, z: 8 },
  spawnCar: { x: 8, z: 2, heading: Math.PI / 2 },
  scene: null,
  sun: null,
  hemi: null,
  lampMat: null,
  roadMats: [],
  raining: false,
  dusk: false,
  duskT: 0,
  rainPoints: null,
  rainPos: null,
  ferrisSpin: null,
  cranes: [],
  districts: [],
  gasStation: null,

  // Every special area in one table. build() walks it, ca...
  DISTRICTS: [
    { id: 'old-town', name: 'Old Town', x: -240, z: -240, w: 76, d: 76, seed: 11, builder: '_buildOldTown' },
    { id: 'pier', name: 'Pier & Wheel', x: 272, z: 150, w: 70, d: 80, seed: 23, builder: '_buildPierWheel' },
    { id: 'airport', name: 'Solmaris Airfield', x: -260, z: 30, w: 90, d: 160, seed: 37, builder: '_buildAirport' },
    { id: 'stadium', name: 'Bay Stadium', x: 240, z: -240, w: 96, d: 76, seed: 51, builder: '_buildStadium' },
    { id: 'campus', name: 'Solmaris University', x: 240, z: 222, w: 96, d: 52, seed: 67, builder: '_buildCampus' },
    { id: 'construction-1', name: 'Construction Site', x: -30, z: -90, w: 44, d: 44, seed: 83, builder: '_buildConstruction' },
    { id: 'construction-2', name: 'Construction Site', x: 150, z: 210, w: 44, d: 44, seed: 97, builder: '_buildConstruction' },
    { id: 'parking-1', name: 'Car Park', x: 90, z: 30, w: 28, d: 20, seed: 113, builder: '_buildParking' },
    { id: 'parking-2', name: 'Car Park', x: -90, z: -90, w: 28, d: 20, seed: 127, builder: '_buildParking' },
    { id: 'gas', name: 'Gas Station', x: 150, z: -30, w: 44, d: 44, seed: 139, builder: '_buildGasStation' }
  ],

  build: function (scene) {
    this.scene = scene;
    this._buildSky(scene);
    this._buildGround(scene);
    this._buildBeachSea(scene);
    this._buildHarbor(scene);
    this._buildRoads(scene);
    this._buildSidewalks(scene);
    this._buildPark(scene);
    this._buildBuildings(scene);
    this._buildBillboards(scene);
    this._buildPalms(scene);
    this._buildStreetProps(scene);
    this._buildDistricts(scene);
    this._buildRain(scene);
  },

  // ---- sky + lights -----------------------------------...
  _buildSky: function (scene) {
    scene.background = new THREE.Color(0x8ec8e8);
    scene.fog = new THREE.Fog(0x9fc3dd, 200, 560);
    // late-afternoon sun: warmer, lower, longer shadows tha...
    var hemi = new THREE.HemisphereLight(0xbfd9ff, 0x5a5a48, 0.8);
    scene.add(hemi);
    this.hemi = hemi;
    var sun = new THREE.DirectionalLight(0xffe7c0, 1.7);
    sun.position.set(170, 165, 70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
    sun.shadow.camera.far = 600;
    sun.shadow.bias = -0.0015;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;
  },

  // ---- ground plane -----------------------------------...
  _buildGround: function (scene) {
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.SIZE, this.SIZE),
      this._mat(0x77806c)
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
  },

  // ---- beach + sea (south edge) -----------------------...
  _buildBeachSea: function (scene) {
    var beachLen = this.SEA_Z - this.BEACH_Z + 4;
    var beach = this._slab(scene, this._mat(0xd9c08a), this.SIZE, beachLen,
      0, 0.05, this.BEACH_Z + (this.SEA_Z - this.BEACH_Z) / 2);
    beach.receiveShadow = true;
    this._slab(scene, this._mat(0x2f7fc2), this.SIZE, this.SIZE - this.SEA_Z,
      0, -0.4, this.SEA_Z + (this.SIZE - this.SEA_Z) / 2);
  },

  // ---- harbor / marina (east edge) --------------------...
  _buildHarbor: function (scene) {
    var hb = this.harbor;
    var water = this._slab(scene, this._mat(0x2a6ea8), hb.x1 - hb.x0, hb.z1 - hb.z0,
      (hb.x0 + hb.x1) / 2, 0.02, (hb.z0 + hb.z1) / 2);
    water.receiveShadow = true;
    var pierMat = this._mat(0x8a6f4d);
    var pierZs = [-30, 30, 90];
    for (var pi = 0; pi < pierZs.length; pi++) {
      this._box(scene, pierMat, 10, 0.4, 3.5, hb.x0 + 4, 0.2, pierZs[pi], true);
    }
    var boatSpots = [[262, -20, 0.4], [270, 40, -0.3], [258, 110, 0.9]];
    for (var bi = 0; bi < boatSpots.length; bi++) {
      this._boat(scene, boatSpots[bi][0], boatSpots[bi][1], boatSpots[bi][2]);
    }
  },

  // ---- roads ------------------------------------------...
  _buildRoads: function (scene) {
    var roadTex = this._roadTexture();
    var roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    var coords = [-180, -120, -60, 0, 60, 120, 180];
    for (var i = 0; i < coords.length; i++) {
      var c = coords[i];
      this._addRoad(scene, roadMat, c, 0, this.SIZE, false);
      this._addRoad(scene, roadMat, 0, c, this.SIZE, true);
      this.roads.push({ v: c, horizontal: false });
      this.roads.push({ v: c, horizontal: true });
    }
    // coastal road along the beach
    this._addRoad(scene, roadMat, 0, 252, this.SIZE, true);
  },

  // ---- sidewalks (light strips flanking each road) ----...
  _buildSidewalks: function (scene) {
    var walkMat = this._mat(0x9a9a92);
    var coords = [-180, -120, -60, 0, 60, 120, 180];
    for (var i = 0; i < coords.length; i++) {
      var c = coords[i];
      this._addWalk(scene, walkMat, c - 7, 0, false);
      this._addWalk(scene, walkMat, c + 7, 0, false);
      this._addWalk(scene, walkMat, 0, c - 7, true);
      this._addWalk(scene, walkMat, 0, c + 7, true);
    }
  },

  // ---- park (one whole block is green, not buildings) -...
  _buildPark: function (scene) {
    var pk = this.park;
    var grass = this._slab(scene, this._mat(0x5a8f4a), pk.s, pk.s, pk.x, 0.07, pk.z);
    grass.receiveShadow = true;
    var pond = new THREE.Mesh(
      new THREE.CircleGeometry(8, 20),
      this._mat(0x3f8fd2)
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(pk.x - 10, 0.09, pk.z + 10);
    scene.add(pond);
    // benches around the pond, two facing each other on eac...
    var benchMat = this._mat(0x6b4f2a);
    var benchSpots = [[-72, 72], [-108, 72], [-72, 108], [-108, 108]];
    for (var bn = 0; bn < benchSpots.length; bn++) {
      var bx = benchSpots[bn][0], bz = benchSpots[bn][1];
      this._box(scene, benchMat, 3, 0.5, 1, bx, 0.35, bz, true);
      this._box(scene, benchMat, 3, 1, 0.2, bx, 0.7, bz - 0.5, false);
    }
    // fountain: stone rim + still water + centre spout (wal...
    var fx = pk.x + 12, fz = pk.z - 12;
    var rim = this._cyl(scene, this._mat(0x9a9a92), 5, 5.4, 0.9, 20, fx, 0.45, fz, true);
    rim.receiveShadow = true;
    var fwater = new THREE.Mesh(
      new THREE.CircleGeometry(4.6, 20),
      this._mat(0x3f8fd2)
    );
    fwater.rotation.x = -Math.PI / 2;
    fwater.position.set(fx, 0.92, fz);
    scene.add(fwater);
    this._cyl(scene, this._mat(0x9a9a92), 0.5, 0.7, 2.2, 10, fx, 1.8, fz, true);
    this._sphere(scene, this._mat(0x7a7a72), 0.7, 10, 8, fx, 3.0, fz);
    this.colliders.push({ minX: fx - 5.4, maxX: fx + 5.4, minZ: fz - 5.4, maxZ: fz + 5.4 });
  },

  // ---- generic downtown buildings ---------------------...
  _buildBuildings: function (scene) {
    var facadeTexs = [this._facadeTexture(0x3a4a5a), this._facadeTexture(0x5a4632), this._facadeTexture(0x44503e)];
    var roofMat = this._mat(0x4a4a48);
    var palette = [0x8fa3b8, 0xb8a58f, 0x9db08f, 0xb08f8f, 0x7f9fb0, 0xc2b49a, 0x6e8a7a];
    var neon = {
      words: ['HOTEL', '24H TACOS', 'BAR', 'CINEMA', 'PIZZA', 'GYM', 'CASINO', 'NIGHTCLUB'],
      colors: ['#ff5d8f', '#ffd23f', '#3fd2ff', '#c04df0', '#7dff9a', '#ff8844', '#ffaa00', '#00ffcc'],
      placed: 0
    };
    for (var bx = -180; bx < 180; bx += 60) {
      for (var bz = -180; bz < 240; bz += 60) {
        if (this._blockReserved(bx, bz)) continue;
        var n = SBUtils.randInt(1, 2);
        for (var k = 0; k < n; k++) {
          this._placeBuilding(scene, bx, bz, facadeTexs, roofMat, palette, neon);
        }
      }
    }
  },

  // one downtown tower: random footprint/height, rooftop...
  _placeBuilding: function (scene, bx, bz, facadeTexs, roofMat, palette, neon) {
    var w = SBUtils.rand(13, 24), d = SBUtils.rand(13, 24), h = SBUtils.rand(8, 38);
    var x = bx + 30 + SBUtils.rand(-9, 9);
    var z = bz + 30 + SBUtils.rand(-9, 9);
    if (z > 232) return;
    var tex = SBUtils.choice(facadeTexs);
    var mats = [];
    for (var f = 0; f < 4; f++) mats.push(new THREE.MeshLambertMaterial({ map: tex }));
    mats.push(roofMat); mats.push(roofMat);
    var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    b.position.set(x, h / 2, z);
    b.castShadow = true; b.receiveShadow = true;
    scene.add(b);
    // rooftop box
    this._box(scene, roofMat, w * 0.4, 2, d * 0.4, x, h + 1, z, true);
    // rooftop clutter: AC units + antennas on some roofs
    if (Math.random() < 0.4) {
      this._box(scene, this._mat(0x9aa0a6), 1.6, 0.9, 1.6, x + w * 0.2, h + 0.45, z - d * 0.2, true);
    }
    if (Math.random() < 0.25) {
      this._cyl(scene, this._mat(0x30343a), 0.06, 0.1, 5, 6, x - w * 0.25, h + 2.5, z + d * 0.2, false);
      this._sphere(scene, new THREE.MeshBasicMaterial({ color: 0xff4444 }), 0.22, 8, 6, x - w * 0.25, h + 5.1, z + d * 0.2);
    }
    // neon sign on the street-facing side of a few buildings
    if (neon.placed < neon.words.length && Math.random() < 0.14) {
      this._neonSign(scene, x, h * 0.72, z + d / 2 + 0.15, neon.words[neon.placed], neon.colors[neon.placed]);
      neon.placed++;
    }
    this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    this.buildings.push(b);
  },

  // is this grid block (bx, bz) reserved for the park or...
  _blockReserved: function (bx, bz) {
    var cx = bx + 30, cz = bz + 30;
    var pk = this.park;
    if (Math.abs(cx - pk.x) < pk.s / 2 + 6 && Math.abs(cz - pk.z) < pk.s / 2 + 6) return true;
    for (var i = 0; i < this.DISTRICTS.length; i++) {
      var d = this.DISTRICTS[i];
      if (Math.abs(cx - d.x) < d.w / 2 && Math.abs(cz - d.z) < d.d / 2) return true;
    }
    return false;
  },

  // is a world point inside a named district? Missions an...
  _districtAt: function (x, z) {
    for (var i = 0; i < this.DISTRICTS.length; i++) {
      var d = this.DISTRICTS[i];
      if (Math.abs(x - d.x) < d.w / 2 && Math.abs(z - d.z) < d.d / 2) return d.id;
    }
    return null;
  },

  // deterministic rng for one district, so its dressing i...
  _seededFor: function (id) {
    return SBUtils.seeded(SBUtils.seedFromString(id));
  },

  // ---- rooftop billboards: big lit signs on the three t...
  _buildBillboards: function (scene) {
    var billTexts = ['CASINO', 'HOTEL', 'SOLMARIS BAY'];
    var tallest = this.buildings.slice().sort(function (a, b) { return b.position.y - a.position.y; });
    for (var bb = 0; bb < 3 && bb < tallest.length; bb++) {
      var tb = tallest[bb];
      var bw = tb.geometry.parameters.width;
      var bh = tb.geometry.parameters.height;
      var bd = tb.geometry.parameters.depth;
      var board = this._textPlane(scene, billTexts[bb], Math.min(18, bw + 4), 4.5,
        tb.position.x, tb.position.y + bh / 2 + 3.2, tb.position.z + bd / 2 + 0.2,
        '#ffb347', '#10151c', '#ffb347');
      board.material.transparent = true;
    }
  },

  // ---- palm trees (roads, beach, park) ----------------...
  _buildPalms: function (scene) {
    var trunkMat = this._mat(0x8a6f4d);
    var leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57, side: THREE.DoubleSide });
    var coords = [-180, -120, -60, 0, 60, 120, 180];
    for (var i = 0; i < 46; i++) {
      var px, pz;
      if (Math.random() < 0.6) {
        // along roads
        px = SBUtils.choice(coords) + SBUtils.choice([-11, 11]) + SBUtils.rand(-2, 2);
        pz = SBUtils.rand(-180, 245);
      } else {
        // on the beach
        px = SBUtils.rand(-280, 280);
        pz = SBUtils.rand(255, 288);
      }
      this._palm(scene, px, pz, trunkMat, leafMat);
    }
    // park trees
    var pk = this.park;
    for (var j = 0; j < 8; j++) {
      this._palm(scene, pk.x + SBUtils.rand(-22, 22), pk.z + SBUtils.rand(-22, 22), trunkMat, leafMat);
    }
  },

  // ---- street props: lamps + hydrants -----------------...
  _buildStreetProps: function (scene) {
    var poleMat = this._mat(0x30343a);
    var lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554411 });
    this.lampMat = lampMat;
    var hydMat = this._mat(0xc22a22);
    var coords = [-180, -120, -60, 0, 60, 120, 180];
    for (var i = 0; i < coords.length; i++) {
      for (var s = -240; s <= 240; s += 60) {
        var lx = coords[i] + 8.5, lz = s;
        this._cyl(scene, poleMat, 0.12, 0.16, 6, 6, lx, 3, lz, true);
        this._sphere(scene, lampMat, 0.5, 8, 6, lx, 6.2, lz);
        if (Math.random() < 0.5) {
          this._cyl(scene, hydMat, 0.35, 0.4, 0.9, 8, coords[i] - 8.5, 0.45, s + 20, true);
        }
      }
    }
  },

  // ---- district registry: walk DISTRICTS, build each on...
  _buildDistricts: function (scene) {
    for (var i = 0; i < this.DISTRICTS.length; i++) {
      var def = this.DISTRICTS[i];
      this[def.builder](scene, def);
      this.districts.push({ id: def.id, name: def.name, x: def.x, z: def.z, w: def.w, d: def.d });
    }
  },

  // Old Town (NW corner, off the road grid): narrow stree...
  _buildOldTown: function (scene, def) {
    var ot = this.oldTown;
    // stone plaza
    var plaza = new THREE.Mesh(
      new THREE.CircleGeometry(18, 28),
      this._mat(0x9a938a)
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(ot.x, 0.06, ot.z);
    plaza.receiveShadow = true;
    scene.add(plaza);
    // narrow streets crossing the plaza (cobble strips)
    var streetMat = this._mat(0x7a756c);
    this._slab(scene, streetMat, 70, 5, ot.x, 0.07, ot.z);
    this._slab(scene, streetMat, 5, 70, ot.x, 0.07, ot.z);
    // the statue: stone pedestal + a robed figure holding a...
    var stoneMat = this._mat(0x8a8a82);
    this._cyl(scene, stoneMat, 2.2, 2.8, 1.6, 10, ot.x, 0.8, ot.z, true);
    this._cyl(scene, stoneMat, 0.7, 1.1, 3.4, 8, ot.x, 3.3, ot.z, true);
    this._sphere(scene, stoneMat, 0.6, 10, 8, ot.x, 5.4, ot.z);
    var sword = this._box(scene, this._mat(0xb8b8b0), 0.18, 3.2, 0.5, ot.x + 0.9, 5.6, ot.z, true);
    sword.castShadow = true;
    this.colliders.push({ minX: ot.x - 2.8, maxX: ot.x + 2.8, minZ: ot.z - 2.8, maxZ: ot.z + 2.8 });
    // arched facades: six old buildings ring the plaza, eac...
    var facadeColors = [0xb08d6a, 0x9a7a5a, 0x8a6a52, 0xa88a68, 0x96744f, 0xb59a72];
    var archMat = this._mat(0x6b5a48);
    var doorMat = this._mat(0x1a1410);
    for (var i = 0; i < 6; i++) {
      var a = i / 6 * Math.PI * 2 + Math.PI / 6;
      var fx = ot.x + Math.cos(a) * 34;
      var fz = ot.z + Math.sin(a) * 34;
      var w = SBUtils.rand(14, 18), d = SBUtils.rand(12, 16), h = SBUtils.rand(10, 16);
      var b = this._box(scene, this._mat(facadeColors[i]), w, h, d, fx, h / 2, fz, true);
      b.receiveShadow = true;
      // barrel roof: a half-cylinder along the building's depth
      var roof = new THREE.Mesh(
        new THREE.CylinderGeometry(w / 2, w / 2, d, 12, 1, false, 0, Math.PI),
        this._mat(0x7a4a3a)
      );
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.position.set(fx, h, fz);
      roof.castShadow = true;
      scene.add(roof);
      // arched doorway facing the plaza: dark box + half-toru...
      var dx = fx - Math.cos(a) * (d / 2 + 0.1);
      var dz = fz - Math.sin(a) * (d / 2 + 0.1);
      var door = this._box(scene, doorMat, 2.4, 3.2, 0.3, dx, 1.6, dz, false);
      door.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
      var arch = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.35, 8, 12, Math.PI), archMat);
      arch.position.set(dx, 3.2, dz);
      arch.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
      scene.add(arch);
      this.colliders.push({ minX: fx - w / 2, maxX: fx + w / 2, minZ: fz - d / 2, maxZ: fz + d / 2 });
      this.buildings.push(b);
    }
  },

  // second beach + long pier + ferris wheel silhouette on...
  _buildPierWheel: function (scene, def) {
    // second beach: a sand cove just south of the harbor inlet
    var cove = this._slab(scene, this._mat(0xd9c08a), 60, 24, 270, 0.05, 192);
    cove.receiveShadow = true;
    // long pier running east into the harbor water
    var pierMat = this._mat(0x8a6f4d);
    var pier = this._box(scene, pierMat, 55, 0.5, 4, 272, 0.3, 150, true);
    pier.receiveShadow = true;
    var postMat = this._mat(0x6b4f2a);
    for (var i = 0; i < 6; i++) {
      this._cyl(scene, postMat, 0.25, 0.25, 2.4, 6, 248 + i * 10, -0.6, 148.2, false);
      this._cyl(scene, postMat, 0.25, 0.25, 2.4, 6, 248 + i * 10, -0.6, 151.8, false);
    }
    // ferris wheel at the end of the pier: dark silhouette...
    var wheelBase = new THREE.Group();
    var legMat = this._mat(0x30343a);
    var legL = this._box(wheelBase, legMat, 0.8, 14, 0.8, -4, 7, 0, true);
    legL.rotation.z = 0.35;
    var legR = this._box(wheelBase, legMat, 0.8, 14, 0.8, 4, 7, 0, true);
    legR.rotation.z = -0.35;
    var spin = new THREE.Group();
    spin.position.y = 14;
    var rimMat = this._mat(0x222831);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.45, 8, 28), rimMat);
    rim.castShadow = true;
    spin.add(rim);
    var rim2 = new THREE.Mesh(new THREE.TorusGeometry(9, 0.45, 8, 28), rimMat);
    rim2.position.z = 1.2;
    spin.add(rim2);
    // spokes + gondolas around the rim
    var gondolaMat = this._mat(0xff5d8f);
    for (var s = 0; s < 8; s++) {
      var ang = s / 8 * Math.PI * 2;
      var spoke = new THREE.Mesh(new THREE.BoxGeometry(0.3, 18, 0.3), rimMat);
      spoke.rotation.z = ang;
      spin.add(spoke);
      var gondola = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.2), gondolaMat);
      gondola.position.set(Math.cos(ang) * 9, Math.sin(ang) * 9, 0.6);
      gondola.castShadow = true;
      spin.add(gondola);
    }
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 10), legMat);
    hub.rotation.x = Math.PI / 2;
    spin.add(hub);
    wheelBase.add(spin);
    // face the wheel toward the city (its plane looks west)
    wheelBase.rotation.y = Math.PI / 2;
    wheelBase.position.set(288, 0, 150);
    scene.add(wheelBase);
    this.ferrisSpin = spin;
  },

  // rain: one Points cloud of 600 drops in a box that fol...
  _buildRain: function (scene) {
    var N = 600;
    this.rainPos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      this.rainPos[i * 3] = SBUtils.rand(-70, 70);
      this.rainPos[i * 3 + 1] = SBUtils.rand(0, 50);
      this.rainPos[i * 3 + 2] = SBUtils.rand(-70, 70);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    var mat = new THREE.PointsMaterial({ color: 0xaac4dd, size: 0.35, transparent: true, opacity: 0.6 });
    var points = new THREE.Points(geo, mat);
    points.visible = false;
    points.frustumCulled = false;
    scene.add(points);
    this.rainPoints = points;
  },

  // airport district: a working strip on the west margin —
  _buildAirport: function (scene, def) {
    var ax = this.airport.x, az = this.airport.z;
    // runway: dark asphalt strip, 26 wide, 150 long, runnin...
    var runway = this._slab(scene, this._mat(0x2e3138), 26, 150, ax, 0.03, az);
    runway.receiveShadow = true;
    // centreline dashes, one every 10 units down the middle...
    var dashMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
    for (var i = 0; i < 12; i++) {
      this._slab(scene, dashMat, 1, 5, ax, 0.05, az - 65 + i * 12);
    }
    // runway edge lights: small warm beacons down both long...
    var lightMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    for (var j = 0; j < 10; j++) {
      var lz = az - 60 + j * 14;
      this._sphere(scene, lightMat, 0.35, 6, 6, ax - 13.5, 0.4, lz);
      this._sphere(scene, lightMat, 0.35, 6, 6, ax + 13.5, 0.4, lz);
    }
    // control tower: concrete shaft with a glass cab on top...
    this._cyl(scene, this._mat(0xb8b0a0), 3, 4, 26, 8, ax - 22, 13, az - 62, true);
    this._box(scene, this._mat(0x2a4a6a), 8, 3.5, 8, ax - 22, 27.5, az - 62, true);
    this.colliders.push({ minX: ax - 27, maxX: ax - 17, minZ: az - 67, maxZ: az - 57 });
    // two hangars: big boxes with arched roofs, doors facin...
    var hangMat = this._mat(0x8a94a0);
    for (var h = 0; h < 2; h++) {
      var hz = az + 18 + h * 34;
      this._box(scene, hangMat, 20, 10, 24, ax - 30, 5, hz, true);
      var roof = new THREE.Mesh(
        new THREE.CylinderGeometry(10, 10, 24, 10, 1, false, 0, Math.PI),
        this._mat(0x6a747f)
      );
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.position.set(ax - 30, 10, hz);
      roof.castShadow = true;
      scene.add(roof);
      this.colliders.push({ minX: ax - 41, maxX: ax - 19, minZ: hz - 13, maxZ: hz + 13 });
    }
    // two parked planes on the apron: fuselage + wings + ta...
    var planePos = [[ax + 2, az - 30], [ax + 2, az + 42]];
    for (var p = 0; p < 2; p++) {
      var pg = new THREE.Group();
      var fus = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 14, 10),
        this._mat(0xe8e8e8)
      );
      fus.rotation.x = Math.PI / 2;
      fus.position.y = 2.2;
      fus.castShadow = true;
      pg.add(fus);
      var wing = new THREE.Mesh(new THREE.BoxGeometry(20, 0.3, 2.6), this._mat(0x2a6a9a));
      wing.position.y = 2.0;
      wing.castShadow = true;
      pg.add(wing);
      var tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 2.4), this._mat(0xcc3333));
      tail.position.set(0, 4.2, -6.2);
      pg.add(tail);
      pg.position.set(planePos[p][0], 0, planePos[p][1]);
      scene.add(pg);
      this.colliders.push({ minX: planePos[p][0] - 4, maxX: planePos[p][0] + 4, minZ: planePos[p][1] - 8, maxZ: planePos[p][1] + 8 });
    }
    // windsock: a pole with an orange cone that always poin...
    this._cyl(scene, this._mat(0x888888), 0.15, 0.15, 7, 6, ax + 18, 3.5, az - 48, false);
    var sock = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 8), this._mat(0xff6600));
    sock.rotation.z = Math.PI / 2;
    sock.position.set(ax + 19.8, 6.4, az - 48);
    scene.add(sock);
  },

  // ---- NEW: Bay Stadium (NE corner) -------------------...
  _buildStadium: function (scene, def) {
    var st = this.stadium;
    var rng = this._seededFor(def.id);
    // pitch: mown stripes in two greens, alternating bands
    var bands = 8;
    for (var b = 0; b < bands; b++) {
      var bandColor = b % 2 === 0 ? 0x4a9a3a : 0x3f8a32;
      this._slab(scene, this._mat(bandColor), 60 / bands, 40,
        st.x - 30 + (b + 0.5) * 60 / bands, 0.05, st.z);
    }
    // chalk lines: touchlines + halfway line + centre circle
    var chalkMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
    this._slab(scene, chalkMat, 60, 0.4, st.x, 0.07, st.z - 20);
    this._slab(scene, chalkMat, 60, 0.4, st.x, 0.07, st.z + 20);
    this._slab(scene, chalkMat, 0.4, 40, st.x - 30, 0.07, st.z);
    this._slab(scene, chalkMat, 0.4, 40, st.x + 30, 0.07, st.z);
    this._slab(scene, chalkMat, 0.4, 40, st.x, 0.07, st.z);
    var circle = new THREE.Mesh(new THREE.RingGeometry(5.4, 5.8, 24), chalkMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(st.x, 0.07, st.z);
    scene.add(circle);
    // goals: white frames at each end
    var goalMat = this._mat(0xf2f2f2);
    var goalEnds = [-20, 20];
    for (var g = 0; g < goalEnds.length; g++) {
      var gz = st.z + goalEnds[g];
      this._box(scene, goalMat, 0.25, 2.4, 7, st.x - 3.5, 1.2, gz, false);
      this._box(scene, goalMat, 0.25, 2.4, 7, st.x + 3.5, 1.2, gz, false);
      this._box(scene, goalMat, 7.25, 0.25, 0.25, st.x, 2.4, gz, false);
    }
    // grandstands: north + east + west full length, south s...
    var standMat = this._mat(0x5a6a7a);
    var standTop = this._mat(0x8a94a0);
    var stands = [
      { x: st.x, z: st.z - 30, w: 84, d: 10 },
      { x: st.x - 40, z: st.z, w: 10, d: 56 },
      { x: st.x + 40, z: st.z, w: 10, d: 56 },
      { x: st.x - 26, z: st.z + 30, w: 32, d: 10 },
      { x: st.x + 26, z: st.z + 30, w: 32, d: 10 }
    ];
    for (var s = 0; s < stands.length; s++) {
      var sd = stands[s];
      var stand = this._box(scene, standMat, sd.w, 9, sd.d, sd.x, 4.5, sd.z, true);
      stand.receiveShadow = true;
      // stepped seating: three receding rows on the pitch-fac...
      for (var r = 0; r < 3; r++) {
        var rowW = sd.w > sd.d ? sd.w - 4 : 2.5;
        var rowD = sd.w > sd.d ? 2.5 : sd.d - 4;
        var rowX = sd.w > sd.d ? sd.x : sd.x + (sd.x < st.x ? 2.5 + r * 2.5 : -2.5 - r * 2.5);
        var rowZ = sd.w > sd.d ? sd.z + (sd.z < st.z ? 2.5 + r * 2.5 : -2.5 - r * 2.5) : sd.z;
        this._box(scene, standTop, rowW, 1.2, rowD, rowX, 9.4 + r * 1.1, rowZ, false);
      }
      this.colliders.push({ minX: sd.x - sd.w / 2, maxX: sd.x + sd.w / 2, minZ: sd.z - sd.d / 2, maxZ: sd.z + sd.d / 2 });
    }
    // floodlight masts on the four corners: tall poles, emi...
    var poleMat = this._mat(0x30343a);
    var headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
    var corners = [[-46, -36], [46, -36], [-46, 36], [46, 36]];
    for (var c = 0; c < corners.length; c++) {
      var cx = st.x + corners[c][0], cz = st.z + corners[c][1];
      this._cyl(scene, poleMat, 0.3, 0.45, 22, 6, cx, 11, cz, true);
      this._box(scene, headMat, 4, 1.6, 1, cx, 22.5, cz, false);
    }
    // scoreboard over the north stand: "SOLMARIS FC 2 - 1 B...
    var board = this._textPlane(scene, 'SOLMARIS FC  2 - 1  BAY UTD', 20, 4,
      st.x, 13.5, st.z - 34, '#7dff9a', '#10151c', '#7dff9a');
    board.material.transparent = true;
    // turnstiles at the gate: two small booths flanking the...
    var boothMat = this._mat(0x2a6a9a);
    this._box(scene, boothMat, 3, 3, 3, st.x - 8, 1.5, st.z + 36, true);
    this._box(scene, boothMat, 3, 3, 3, st.x + 8, 1.5, st.z + 36, true);
    // crowd dots: a few hundred coloured specks on the stan...
    var crowdColors = [0xe63946, 0x2a9d8f, 0xe9c46a, 0x4361ee, 0xf72585, 0xf8f9fa];
    for (var cr = 0; cr < 120; cr++) {
      var side = Math.floor(rng() * 4);
      var ccx, ccz;
      if (side === 0) { ccx = st.x + (rng() - 0.5) * 76; ccz = st.z - 30 + (rng() - 0.5) * 6; }
      else if (side === 1) { ccx = st.x + (rng() - 0.5) * 76; ccz = st.z + 30 + (rng() - 0.5) * 6; }
      else if (side === 2) { ccx = st.x - 40 + (rng() - 0.5) * 6; ccz = st.z + (rng() - 0.5) * 48; }
      else { ccx = st.x + 40 + (rng() - 0.5) * 6; ccz = st.z + (rng() - 0.5) * 48; }
      var dot = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5),
        this._mat(crowdColors[Math.floor(rng() * crowdColors.length)]));
      dot.position.set(ccx, 9.8 + rng() * 2, ccz);
      scene.add(dot);
    }
  },

  // ---- NEW: Solmaris University (east edge, by the beac...
  _buildCampus: function (scene, def) {
    var cp = this.campus;
    var rng = this._seededFor(def.id);
    // quad lawn + crossing paths
    var lawn = this._slab(scene, this._mat(0x5a8f4a), cp.w, cp.d, cp.x, 0.06, cp.z);
    lawn.receiveShadow = true;
    var pathMat = this._mat(0x9a938a);
    this._slab(scene, pathMat, cp.w, 4, cp.x, 0.07, cp.z);
    this._slab(scene, pathMat, 4, cp.d, cp.x, 0.07, cp.z);
    // central fountain, smaller twin of the park one
    var fx = cp.x, fz = cp.z;
    this._cyl(scene, this._mat(0x9a9a92), 3.5, 3.9, 0.8, 16, fx, 0.4, fz, true);
    var fwater = new THREE.Mesh(new THREE.CircleGeometry(3.2, 16), this._mat(0x3f8fd2));
    fwater.rotation.x = -Math.PI / 2;
    fwater.position.set(fx, 0.82, fz);
    scene.add(fwater);
    this._cyl(scene, this._mat(0x9a9a92), 0.35, 0.5, 1.6, 8, fx, 1.4, fz, true);
    this.colliders.push({ minX: fx - 3.9, maxX: fx + 3.9, minZ: fz - 3.9, maxZ: fz + 3.9 });
    // lecture halls: brick boxes, columned fronts, sloped s...
    var hallDefs = [
      { dx: -30, dz: -14, w: 22, h: 9, d: 14, color: 0x9a6a52, name: 'HALL A' },
      { dx: -30, dz: 14, w: 22, h: 9, d: 14, color: 0x8a5a48, name: 'HALL B' },
      { dx: 30, dz: -14, w: 22, h: 11, d: 14, color: 0xa88a68, name: 'HALL C' }
    ];
    for (var h = 0; h < hallDefs.length; h++) {
      var hd = hallDefs[h];
      var hx = cp.x + hd.dx, hz = cp.z + hd.dz;
      var hall = this._box(scene, this._mat(hd.color), hd.w, hd.h, hd.d, hx, hd.h / 2, hz, true);
      hall.receiveShadow = true;
      // sloped roof slab
      var roof = this._box(scene, this._mat(0x4a4a48), hd.w + 1, 0.5, hd.d + 1, hx, hd.h + 0.6, hz, false);
      roof.rotation.x = 0.12;
      // columns along the quad-facing side
      var colMat = this._mat(0xd9d2c2);
      var faceZ = hz + (hd.dz < 0 ? hd.d / 2 + 0.8 : -hd.d / 2 - 0.8);
      for (var col = -2; col <= 2; col++) {
        this._cyl(scene, colMat, 0.35, 0.35, hd.h - 1, 8, hx + col * 4, (hd.h - 1) / 2, faceZ, true);
      }
      // hall name board over the door
      var sign = this._textPlane(scene, hd.name, 7, 1.6, hx, hd.h - 1.2,
        hz + (hd.dz < 0 ? hd.d / 2 + 0.2 : -hd.d / 2 - 0.2), '#ffd23f', '#10151c', '#ffd23f');
      sign.material.transparent = true;
      this.colliders.push({ minX: hx - hd.w / 2, maxX: hx + hd.w / 2, minZ: hz - hd.d / 2, maxZ: hz + hd.d / 2 });
      this.buildings.push(hall);
    }
    // library: taller glass-fronted block on the east side
    var libX = cp.x + 30, libZ = cp.z + 14;
    var lib = this._box(scene, this._mat(0x6a7a8a), 22, 16, 14, libX, 8, libZ, true);
    lib.receiveShadow = true;
    var glass = new THREE.Mesh(new THREE.PlaneGeometry(18, 12),
      new THREE.MeshLambertMaterial({ color: 0x2a4a6a }));
    glass.position.set(libX, 8, libZ - 7.2);
    glass.rotation.y = Math.PI;
    scene.add(glass);
    this.colliders.push({ minX: libX - 11, maxX: libX + 11, minZ: libZ - 7, maxZ: libZ + 7 });
    this.buildings.push(lib);
    // palms lining the quad paths, seeded positions
    var trunkMat = this._mat(0x8a6f4d);
    var leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57, side: THREE.DoubleSide });
    for (var t = 0; t < 10; t++) {
      var tx = cp.x + (rng() < 0.5 ? -1 : 1) * (8 + rng() * 30);
      var tz = cp.z + (rng() - 0.5) * (cp.d - 8);
      this._palm(scene, tx, tz, trunkMat, leafMat);
    }
    // benches for students between lectures
    var benchMat = this._mat(0x6b4f2a);
    var benchSpots = [[cp.x - 8, cp.z - 8], [cp.x + 8, cp.z - 8], [cp.x - 8, cp.z + 8], [cp.x + 8, cp.z + 8]];
    for (var bn = 0; bn < benchSpots.length; bn++) {
      this._box(scene, benchMat, 3, 0.5, 1, benchSpots[bn][0], 0.35, benchSpots[bn][1], true);
    }
  },

  // ---- NEW: construction sites (two fenced lots in the...
  _buildConstruction: function (scene, def) {
    var cx = def.x, cz = def.z, s = def.w;
    var half = s / 2;
    // fence: four thin panels with a gate gap on the south...
    var fenceMat = this._mat(0xc2b49a);
    var fenceH = 2.2;
    var fenceSegs = [
      { w: s, d: 0.4, x: cx, z: cz - half },
      { w: 0.4, d: s, x: cx - half, z: cz },
      { w: 0.4, d: s, x: cx + half, z: cz },
      { w: half - 4, d: 0.4, x: cx - half / 2 - 2, z: cz + half },
      { w: half - 4, d: 0.4, x: cx + half / 2 + 2, z: cz + half }
    ];
    for (var f = 0; f < fenceSegs.length; f++) {
      var fs = fenceSegs[f];
      this._box(scene, fenceMat, fs.w, fenceH, fs.d, fs.x, fenceH / 2, fs.z, true);
      this.colliders.push({ minX: fs.x - fs.w / 2, maxX: fs.x + fs.w / 2, minZ: fs.z - fs.d / 2, maxZ: fs.z + fs.d / 2 });
    }
    // foundation slab + rebar stubs poking out of the concrete
    var slab = this._slab(scene, this._mat(0x8a8a82), s - 8, s - 8, cx, 0.08, cz);
    slab.receiveShadow = true;
    var rebarMat = this._mat(0x5a4a3a);
    for (var r = 0; r < 12; r++) {
      var rx = cx + (r % 4) * 6 - 9;
      var rz = cz + Math.floor(r / 4) * 6 - 6;
      this._cyl(scene, rebarMat, 0.08, 0.08, 2.4, 5, rx, 1.2, rz, false);
    }
    this.colliders.push({ minX: cx - (s - 8) / 2, maxX: cx + (s - 8) / 2, minZ: cz - (s - 8) / 2, maxZ: cz + (s - 8) / 2 });
    // tower crane: lattice tower, a rotating jib, counter-j...
    var craneMat = this._mat(0xffb347);
    var darkMat = this._mat(0x30343a);
    var tx = cx - 12, tz = cz - 12;
    // tower: three stacked lattice-looking boxes
    for (var seg = 0; seg < 3; seg++) {
      this._box(scene, craneMat, 2, 8, 2, tx, 4 + seg * 8, tz, true);
    }
    // cab + jib assembly: the jib group rotates around the...
    var jibGroup = new THREE.Group();
    jibGroup.position.set(tx, 25, tz);
    var jib = new THREE.Mesh(new THREE.BoxGeometry(22, 0.8, 0.8), craneMat);
    jib.position.set(11, 0, 0);
    jib.castShadow = true;
    jibGroup.add(jib);
    var counterJib = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 0.8), craneMat);
    counterJib.position.set(-4, 0, 0);
    jibGroup.add(counterJib);
    var weight = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), darkMat);
    weight.position.set(-8, -1.5, 0);
    jibGroup.add(weight);
    // hook cable + block hanging from the jib tip
    var cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7, 5), darkMat);
    cable.position.set(20, -3.5, 0);
    jibGroup.add(cable);
    var hook = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), darkMat);
    hook.position.set(20, -7.4, 0);
    jibGroup.add(hook);
    scene.add(jibGroup);
    this.cranes.push({ jib: jibGroup, speed: 0.12 + Math.random() * 0.1 });
    this.colliders.push({ minX: tx - 1.5, maxX: tx + 1.5, minZ: tz - 1.5, maxZ: tz + 1.5 });
    // stacked shipping containers in the corner
    var contColors = [0x2a6a9a, 0xcc3333, 0x2a9d8f];
    var contSpots = [[cx + 12, cz + 12, 0], [cx + 12, cz + 12, 2.6], [cx + 12, cz - 12, 0]];
    for (var c = 0; c < contSpots.length; c++) {
      var cs = contSpots[c];
      this._box(scene, this._mat(contColors[c % contColors.length]), 6, 2.6, 2.6, cs[0], cs[2] + 1.3, cs[1], true);
    }
    // scaffolding: a frame of thin poles against the founda...
    var scafMat = this._mat(0xc0c0c0);
    for (var sc = 0; sc < 4; sc++) {
      this._cyl(scene, scafMat, 0.08, 0.08, 7, 5, cx - 6 + sc * 4, 3.5, cz + half - 3, false);
    }
    this._box(scene, scafMat, 14, 0.3, 2, cx, 7, cz + half - 3, false);
    // site sign: "SOLMARIS TOWER — COMING SOON"
    var sign = this._textPlane(scene, 'SOLMARIS TOWER — COMING SOON', 12, 2.4,
      cx, 3.2, cz + half + 0.3, '#ffd23f', '#10151c', '#ffd23f');
    sign.material.transparent = true;
  },

  // ---- NEW: multi-storey car parks (two, one block each...
  _buildParking: function (scene, def) {
    var gx = def.x, gz = def.z, w = def.w, d = def.d;
    var deckH = 3.3;
    var slabMat = this._mat(0x8a8a82);
    var colMat = this._mat(0x6a6a62);
    // three decks
    for (var deck = 0; deck < 3; deck++) {
      var y = 0.1 + deck * deckH;
      var slab = this._slab(scene, slabMat, w, d, gx, y, gz);
      slab.receiveShadow = true;
      // columns at the corners + mid-span
      var colXs = [-w / 2 + 1, 0, w / 2 - 1];
      var colZs = [-d / 2 + 1, d / 2 - 1];
      for (var ci = 0; ci < colXs.length; ci++) {
        for (var zi = 0; zi < colZs.length; zi++) {
          if (deck < 2) {
            this._cyl(scene, colMat, 0.4, 0.4, deckH, 8, gx + colXs[ci], y + deckH / 2, gz + colZs[zi], true);
          }
        }
      }
      // parked cars on this deck: two rows, nose-in
      var carColors = [0x3a6ea5, 0xb23a48, 0xd9d9d9, 0x2a9d8f, 0xe07b39];
      for (var pc = 0; pc < 4; pc++) {
        var pcx = gx - w / 2 + 4 + pc * 6.5;
        var pcz = gz + (pc % 2 === 0 ? -d / 2 + 3.5 : d / 2 - 3.5);
        this._parkedCar(scene, pcx, y + 0.55, pcz, carColors[(deck * 4 + pc) % carColors.length]);
      }
    }
    // ramp up the side: a sloped slab from the street to de...
    var ramp = this._box(scene, slabMat, 6, 0.4, 12, gx + w / 2 + 3, 1.7, gz, true);
    ramp.rotation.z = -0.28;
    // top-deck railing so the edge reads from the street
    var railMat = this._mat(0x30343a);
    this._box(scene, railMat, w, 0.3, 0.3, gx, 0.1 + 2 * deckH + 1.1, gz - d / 2 + 0.15, false);
    this._box(scene, railMat, w, 0.3, 0.3, gx, 0.1 + 2 * deckH + 1.1, gz + d / 2 - 0.15, false);
    // PARK sign on the front face
    var sign = this._textPlane(scene, 'PARK', 8, 2.6, gx, 0.1 + 2 * deckH + 2.4, gz - d / 2 - 0.3,
      '#3fd2ff', '#10151c', '#3fd2ff');
    sign.material.transparent = true;
    // the whole garage is solid: one AABB around the footprint
    this.colliders.push({ minX: gx - w / 2, maxX: gx + w / 2, minZ: gz - d / 2, maxZ: gz + d / 2 });
  },

  // gas station: forecourt, canopy on four posts, two pum...
  _buildGasStation: function (scene, def) {
    var gx = def.x, gz = def.z, w = def.w, d = def.d;
    // forecourt: dark asphalt, a shade lighter than the roads
    var court = this._slab(scene, this._mat(0x3a3f45), w, d, gx, 0.05, gz);
    court.receiveShadow = true;
    // canopy: four steel posts and a flat roof with a red s...
    var postMat = this._mat(0x8a8f96);
    var postXs = [-12, 12];
    var postZs = [-8, 8];
    for (var pi = 0; pi < postXs.length; pi++) {
      for (var pj = 0; pj < postZs.length; pj++) {
        this._cyl(scene, postMat, 0.25, 0.25, 5.2, 8, gx + postXs[pi], 2.6, gz + postZs[pj], true);
      }
    }
    var roof = this._box(scene, this._mat(0xe8e8e8), 30, 0.5, 22, gx, 5.4, gz, true);
    roof.castShadow = true;
    this._box(scene, this._mat(0xcc2222), 30.2, 0.3, 22.2, gx, 5.1, gz, false);
    // pump islands: a low concrete island + the pump itself...
    var pumpXs = [-6, 6];
    for (var k = 0; k < pumpXs.length; k++) {
      var px = gx + pumpXs[k];
      this._box(scene, this._mat(0x9a9a92), 2.2, 0.25, 5, px, 0.18, gz, false);
      var pump = this._box(scene, this._mat(0xf2f2f2), 1.1, 1.7, 0.7, px, 1.1, gz, true);
      pump.castShadow = true;
      this._box(scene, this._mat(0xcc2222), 1.15, 0.3, 0.75, px, 1.5, gz, false);
      this.colliders.push({ minX: px - 1.1, maxX: px + 1.1, minZ: gz - 2.5, maxZ: gz + 2.5 });
    }
    // kiosk: snacks, smokes and the till, on the north edge...
    var kiosk = this._box(scene, this._mat(0xd9c9a8), 8, 3, 5, gx, 1.5, gz - d / 2 + 3.5, true);
    kiosk.castShadow = true;
    this._box(scene, this._mat(0x2a6ac2), 8.2, 0.5, 5.2, gx, 3.1, gz - d / 2 + 3.5, false);
    this.colliders.push({ minX: gx - 4, maxX: gx + 4, minZ: gz - d / 2 + 1, maxZ: gz - d / 2 + 6 });
    // price board on a pole by the road, facing west toward...
    this._cyl(scene, postMat, 0.15, 0.2, 6.5, 8, gx - w / 2 - 1, 3.25, gz + 10, true);
    var board = this._textPlane(scene, 'GAS $2.99', 9, 2.4, gx - w / 2 - 1, 7.2, gz + 10,
      '#7dff9a', '#10151c', '#7dff9a');
    board.material.transparent = true;
    board.rotation.y = Math.PI / 2;
    // the refuel zone is the whole lot — Vehicle checks thi...
    this.gasStation = { minX: gx - w / 2, maxX: gx + w / 2, minZ: gz - d / 2, maxZ: gz + d / 2 };
  },

  // a static parked car for the car-park decks: body + ca...
  _parkedCar: function (scene, x, y, z, color) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.2), this._mat(color));
    body.position.y = 0.28; body.castShadow = true; g.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.1), this._mat(0x18202a));
    cabin.position.set(0, 0.75, -0.2); g.add(cabin);
    var wheelMat = this._mat(0x141414);
    var wpos = [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]];
    for (var i = 0; i < 4; i++) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wpos[i][0], 0.34, wpos[i][1]);
      g.add(w);
    }
    g.position.set(x, y, z);
    scene.add(g);
    return g;
  },

  // rain toggle (U): light rain darkens the sky and makes...
  setRain: function (on) {
    this.raining = !!on;
    if (this.rainPoints) this.rainPoints.visible = this.raining;
    for (var i = 0; i < this.roadMats.length; i++) {
      this.roadMats[i].color.setHex(this.raining ? 0x5a6678 : 0xffffff);
    }
    return this.raining;
  },

  // day/night toggle (I): dusk dims the sun, warms the sk...
  setDusk: function (on) {
    this.dusk = !!on;
    return this.dusk;
  },

  // per-frame: rain fall, ferris wheel spin, crane jibs,...
  update: function (dt) {
    if (this.rainPoints && this.raining) {
      // the rain box follows the player so it never runs out
      this.rainPoints.position.set(Player.x, 0, Player.z);
      for (var i = 0; i < this.rainPos.length; i += 3) {
        this.rainPos[i + 1] -= 45 * dt;
        if (this.rainPos[i + 1] < 0) this.rainPos[i + 1] = 50;
      }
      this.rainPoints.geometry.attributes.position.needsUpdate = true;
    }
    if (this.ferrisSpin) this.ferrisSpin.rotation.z += dt * 0.12;
    // construction cranes slew their jibs slowly, all day
    for (var c = 0; c < this.cranes.length; c++) {
      this.cranes[c].jib.rotation.y += this.cranes[c].speed * dt;
    }
    // dusk transition: 0 = day, 1 = full dusk
    var target = this.dusk ? 1 : 0;
    if (this.duskT !== target) {
      this.duskT = SBUtils.clamp(this.duskT + (this.dusk ? dt * 1.5 : -dt * 1.5), 0, 1);
      var t = this.duskT;
      if (this.sun) this.sun.intensity = SBUtils.lerp(1.7, 0.45, t);
      if (this.hemi) this.hemi.intensity = SBUtils.lerp(0.8, 0.35, t);
      if (this.scene) {
        var dayBg = new THREE.Color(0x8ec8e8), duskBg = new THREE.Color(0x35304a);
        var dayFog = new THREE.Color(0x9fc3dd), duskFog = new THREE.Color(0x2a2438);
        this.scene.background.lerpColors(dayBg, duskBg, t);
        this.scene.fog.color.lerpColors(dayFog, duskFog, t);
      }
      if (this.lampMat) {
        var dayLamp = new THREE.Color(0x554411), duskLamp = new THREE.Color(0xffc855);
        this.lampMat.emissive.lerpColors(dayLamp, duskLamp, t);
      }
    }
  },

  _boat: function (scene, x, z, yaw) {
    var g = new THREE.Group();
    var hullMat = this._mat(0xf2f2f2);
    var hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 8), hullMat);
    hull.position.y = 0.4; hull.castShadow = true; g.add(hull);
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.3, 8.1), this._mat(0x2a6ea8));
    stripe.position.y = 0.9; g.add(stripe);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), this._mat(0xd9c08a));
    cabin.position.set(0, 1.4, -1); cabin.castShadow = true; g.add(cabin);
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), this._mat(0x6b4f2a));
    mast.position.set(0, 3.5, 1.5); g.add(mast);
    g.position.set(x, 0.1, z);
    g.rotation.y = yaw;
    scene.add(g);
  },

  _neonSign: function (scene, x, y, z, text, color) {
    var m = this._textPlane(scene, text, 9, 2.25, x, y, z, color, null, color);
    m.material.transparent = true;
    return m;
  },

  // canvas text on a plane: billboards, hall names, site...
  _textPlane: function (scene, text, w, h, x, y, z, fg, bg, glow) {
    var cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    var g = cv.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 512, 128); }
    else g.clearRect(0, 0, 512, 128);
    g.font = '900 64px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (glow) { g.shadowColor = glow; g.shadowBlur = 24; }
    g.fillStyle = fg;
    // shrink the font until the text fits the canvas
    var size = 64;
    while (g.measureText(text).width > 480 && size > 18) {
      size -= 4;
      g.font = '900 ' + size + 'px Arial, sans-serif';
    }
    g.fillText(text, 256, 66);
    if (glow && !bg) {
      // neon double-pass: a white core over the coloured glow
      g.shadowBlur = 0;
      g.fillStyle = '#ffffff';
      g.fillText(text, 256, 66);
    }
    var tex = new THREE.CanvasTexture(cv);
    var mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  },

  _roadTexture: function () {
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    var g = cv.getContext('2d');
    g.fillStyle = '#2e3138'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#33363e';
    for (var i = 0; i < 300; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    g.fillStyle = '#e8e8d8';
    g.fillRect(60, 8, 8, 40); g.fillRect(60, 80, 8, 40);
    g.fillStyle = '#c8c8b8';
    g.fillRect(4, 0, 3, 128); g.fillRect(121, 0, 3, 128);
    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  },

  _facadeTexture: function (base) {
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 256;
    var g = cv.getContext('2d');
    g.fillStyle = '#' + base.toString(16).padStart(6, '0');
    g.fillRect(0, 0, 128, 256);
    for (var y = 12; y < 248; y += 24) {
      for (var x = 10; x < 120; x += 22) {
        g.fillStyle = Math.random() < 0.25 ? '#ffd97a' : '#1c2733';
        g.fillRect(x, y, 12, 14);
      }
    }
    var tex = new THREE.CanvasTexture(cv);
    return tex;
  },

  _addRoad: function (scene, mat, cx, cz, len, horizontal) {
    var tex = mat.map.clone();
    tex.needsUpdate = true;
    // tile along the road's length, not across its width
    if (horizontal) tex.repeat.set(len / 10, 1);
    else tex.repeat.set(1, len / 10);
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(horizontal ? len : 10, horizontal ? 10 : len),
      new THREE.MeshLambertMaterial({ map: tex })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, 0.06, cz);
    m.receiveShadow = true;
    scene.add(m);
    this.roadMats.push(m.material);
  },

  _addWalk: function (scene, mat, cx, cz, horizontal) {
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(horizontal ? this.SIZE : 3.5, horizontal ? 3.5 : this.SIZE),
      mat
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, 0.04, cz);
    m.receiveShadow = true;
    scene.add(m);
  },

  _palm: function (scene, x, z, trunkMat, leafMat) {
    var g = new THREE.Group();
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 7, 6), trunkMat);
    trunk.position.y = 3.5; trunk.castShadow = true;
    g.add(trunk);
    for (var i = 0; i < 6; i++) {
      var leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 4), leafMat);
      var a = i / 6 * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.6, 7.2, Math.sin(a) * 1.6);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      leaf.castShadow = true;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    scene.add(g);
  },

  // ---- tiny mesh helpers: every placement in this file...
  _mat: function (color) { return new THREE.MeshLambertMaterial({ color: color }); },

  _box: function (scene, mat, w, h, d, x, y, z, shadow) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (shadow) m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  },

  _slab: function (scene, mat, w, d, x, y, z) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  },

  _cyl: function (scene, mat, rTop, rBot, h, seg, x, y, z, shadow) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
    m.position.set(x, y, z);
    if (shadow) m.castShadow = true;
    scene.add(m);
    return m;
  },

  _sphere: function (scene, mat, r, ws, hs, x, y, z) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }
};
