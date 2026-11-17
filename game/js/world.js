// world.js — Solmaris Bay: city, roads, buildings, beach, sea,
// harbor/marina district, park, neon signs, rooftop detail,
// Old Town district, pier + ferris wheel, dusk + rain weather
var World = {
  SIZE: 600,          // ground plane size
  ROAD_STEP: 60,      // grid spacing
  ROAD_HALF: 5,       // road half width
  BEACH_Z: 250,       // beach starts here
  SEA_Z: 292,         // sea starts here
  colliders: [],      // building AABBs {minX,maxX,minZ,maxZ}
  buildings: [],      // meshes (for minimap)
  roads: [],          // road centre lines {x or z, horizontal}
  harbor: { x0: 240, x1: 300, z0: -60, z1: 180 },
  park: { x: -90, z: 90, s: 50 },
  oldTown: { x: -240, z: -240 }, // plaza with a statue, NW corner
  spawnDowntown: { x: 4, z: 8 },
  spawnCar: { x: 8, z: 2, heading: Math.PI / 2 },
  scene: null,
  sun: null,
  hemi: null,
  lampMat: null,      // shared streetlamp bulb material (glows at dusk)
  roadMats: [],       // road materials (go wet-dark in the rain)
  raining: false,
  dusk: false,
  duskT: 0,           // 0 = day, 1 = full dusk (lerps)
  rainPoints: null,
  rainPos: null,      // Float32Array of raindrop positions
  ferrisSpin: null,   // the rotating wheel on the pier

  build: function (scene) {
    var U = SBUtils;
    this.scene = scene;
    scene.background = new THREE.Color(0x8ec8e8);
    scene.fog = new THREE.Fog(0x9fc3dd, 200, 560);

    // late-afternoon sun: warmer, lower, longer shadows than noon
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

    // ---- ground ----
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.SIZE, this.SIZE),
      new THREE.MeshLambertMaterial({ color: 0x77806c })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // ---- beach + sea (south edge) ----
    var beach = new THREE.Mesh(
      new THREE.PlaneGeometry(this.SIZE, this.SEA_Z - this.BEACH_Z + 4),
      new THREE.MeshLambertMaterial({ color: 0xd9c08a })
    );
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(0, 0.05, this.BEACH_Z + (this.SEA_Z - this.BEACH_Z) / 2);
    beach.receiveShadow = true;
    scene.add(beach);
    var sea = new THREE.Mesh(
      new THREE.PlaneGeometry(this.SIZE, this.SIZE - this.SEA_Z),
      new THREE.MeshLambertMaterial({ color: 0x2f7fc2 })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.4, this.SEA_Z + (this.SIZE - this.SEA_Z) / 2);
    scene.add(sea);

    // ---- harbor / marina (east edge): inlet water, wooden piers, boats ----
    var hb = this.harbor;
    var harborWater = new THREE.Mesh(
      new THREE.PlaneGeometry(hb.x1 - hb.x0, hb.z1 - hb.z0),
      new THREE.MeshLambertMaterial({ color: 0x2a6ea8 })
    );
    harborWater.rotation.x = -Math.PI / 2;
    harborWater.position.set((hb.x0 + hb.x1) / 2, 0.02, (hb.z0 + hb.z1) / 2);
    harborWater.receiveShadow = true;
    scene.add(harborWater);
    var pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    var pierZs = [-30, 30, 90];
    for (var pi = 0; pi < pierZs.length; pi++) {
      var pier = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 3.5), pierMat);
      pier.position.set(hb.x0 + 4, 0.2, pierZs[pi]);
      pier.castShadow = true; pier.receiveShadow = true;
      scene.add(pier);
    }
    var boatSpots = [[262, -20, 0.4], [270, 40, -0.3], [258, 110, 0.9]];
    for (var bi = 0; bi < boatSpots.length; bi++) {
      this._boat(scene, boatSpots[bi][0], boatSpots[bi][1], boatSpots[bi][2]);
    }

    // ---- road texture (asphalt + dashed centre line) ----
    var roadTex = this._roadTexture();
    var roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    var coords = [-180, -120, -60, 0, 60, 120, 180];
    var i, c;
    for (i = 0; i < coords.length; i++) {
      c = coords[i];
      // north-south road
      this._addRoad(scene, roadMat, c, 0, this.SIZE, false);
      // east-west road (only across the city, beach side has one coastal road)
      this._addRoad(scene, roadMat, 0, c, this.SIZE, true);
      this.roads.push({ v: c, horizontal: false });
      this.roads.push({ v: c, horizontal: true });
    }
    // coastal road along the beach
    this._addRoad(scene, roadMat, 0, 252, this.SIZE, true);

    // ---- sidewalks (light strips flanking each road) ----
    var walkMat = new THREE.MeshLambertMaterial({ color: 0x9a9a92 });
    for (i = 0; i < coords.length; i++) {
      c = coords[i];
      this._addWalk(scene, walkMat, c - 7, 0, false);
      this._addWalk(scene, walkMat, c + 7, 0, false);
      this._addWalk(scene, walkMat, 0, c - 7, true);
      this._addWalk(scene, walkMat, 0, c + 7, true);
    }

    // ---- park (one whole block is green, not buildings) ----
    var pk = this.park;
    var parkGrass = new THREE.Mesh(
      new THREE.PlaneGeometry(pk.s, pk.s),
      new THREE.MeshLambertMaterial({ color: 0x5a8f4a })
    );
    parkGrass.rotation.x = -Math.PI / 2;
    parkGrass.position.set(pk.x, 0.07, pk.z);
    parkGrass.receiveShadow = true;
    scene.add(parkGrass);
    var pond = new THREE.Mesh(
      new THREE.CircleGeometry(8, 20),
      new THREE.MeshLambertMaterial({ color: 0x3f8fd2 })
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(pk.x - 10, 0.09, pk.z + 10);
    scene.add(pond);
    var benchMat = new THREE.MeshLambertMaterial({ color: 0x6b4f2a });
    var benchSpots = [[-72, 72], [-108, 72], [-72, 108], [-108, 108]];
    for (var bn = 0; bn < benchSpots.length; bn++) {
      var bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), benchMat);
      bench.position.set(benchSpots[bn][0], 0.35, benchSpots[bn][1]);
      bench.castShadow = true;
      scene.add(bench);
      var back = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.2), benchMat);
      back.position.set(benchSpots[bn][0], 0.7, benchSpots[bn][1] - 0.5);
      scene.add(back);
    }
    // park fountain: stone rim + still water + centre spout (walk-around)
    var rim = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 0.9, 20), new THREE.MeshLambertMaterial({ color: 0x9a9a92 }));
    rim.position.set(pk.x + 12, 0.45, pk.z - 12);
    rim.castShadow = true; rim.receiveShadow = true;
    scene.add(rim);
    var fwater = new THREE.Mesh(new THREE.CircleGeometry(4.6, 20), new THREE.MeshLambertMaterial({ color: 0x3f8fd2 }));
    fwater.rotation.x = -Math.PI / 2;
    fwater.position.set(pk.x + 12, 0.92, pk.z - 12);
    scene.add(fwater);
    var spout = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 2.2, 10), new THREE.MeshLambertMaterial({ color: 0x9a9a92 }));
    spout.position.set(pk.x + 12, 1.8, pk.z - 12);
    spout.castShadow = true;
    scene.add(spout);
    var spoutTop = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshLambertMaterial({ color: 0x7a7a72 }));
    spoutTop.position.set(pk.x + 12, 3.0, pk.z - 12);
    scene.add(spoutTop);
    this.colliders.push({ minX: pk.x + 12 - 5.4, maxX: pk.x + 12 + 5.4, minZ: pk.z - 12 - 5.4, maxZ: pk.z - 12 + 5.4 });

    // ---- buildings ----
    var facadeTexs = [this._facadeTexture(0x3a4a5a), this._facadeTexture(0x5a4632), this._facadeTexture(0x44503e)];
    var roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4a48 });
    var palette = [0x8fa3b8, 0xb8a58f, 0x9db08f, 0xb08f8f, 0x7f9fb0, 0xc2b49a, 0x6e8a7a];
    var neonWords = ['HOTEL', '24H TACOS', 'BAR', 'CINEMA', 'PIZZA', 'GYM', 'CASINO', 'NIGHTCLUB'];
    var neonColors = ['#ff5d8f', '#ffd23f', '#3fd2ff', '#c04df0', '#7dff9a', '#ff8844', '#ffaa00', '#00ffcc'];
    var neonPlaced = 0;
    var bx, bz, n, k;
    for (bx = -180; bx < 180; bx += 60) {
      for (bz = -180; bz < 240; bz += 60) {
        // park block + harbor strip stay building-free
        if (bx === -120 && bz === 60) continue;
        n = U.randInt(1, 2);
        for (k = 0; k < n; k++) {
          var w = U.rand(13, 24), d = U.rand(13, 24), h = U.rand(8, 38);
          var x = bx + 30 + U.rand(-9, 9);
          var z = bz + 30 + U.rand(-9, 9);
          // keep clear of the coastal road strip
          if (z > 232) continue;
          var tex = U.choice(facadeTexs);
          var mats = [];
          for (var f = 0; f < 4; f++) mats.push(new THREE.MeshLambertMaterial({ map: tex }));
          mats.push(roofMat); mats.push(roofMat);
          var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
          b.position.set(x, h / 2, z);
          b.castShadow = true; b.receiveShadow = true;
          scene.add(b);
          // rooftop box
          var roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 2, d * 0.4), roofMat);
          roof.position.set(x, h + 1, z);
          roof.castShadow = true;
          scene.add(roof);
          // rooftop clutter: AC units + antennas on some roofs
          if (Math.random() < 0.4) {
            var ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.6), new THREE.MeshLambertMaterial({ color: 0x9aa0a6 }));
            ac.position.set(x + w * 0.2, h + 0.45, z - d * 0.2);
            ac.castShadow = true;
            scene.add(ac);
          }
          if (Math.random() < 0.25) {
            var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 5, 6), new THREE.MeshLambertMaterial({ color: 0x30343a }));
            ant.position.set(x - w * 0.25, h + 2.5, z + d * 0.2);
            scene.add(ant);
            var tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
            tip.position.set(x - w * 0.25, h + 5.1, z + d * 0.2);
            scene.add(tip);
          }
          // neon sign on the street-facing side of a few buildings
          if (neonPlaced < neonWords.length && Math.random() < 0.14) {
            this._neonSign(scene, x, h * 0.72, z + d / 2 + 0.15, neonWords[neonPlaced], neonColors[neonPlaced]);
            neonPlaced++;
          }
          this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
          this.buildings.push(b);
        }
      }
    }

    // ---- rooftop billboards: big lit signs on the three tallest roofs ----
    var billTexts = ['CASINO', 'HOTEL', 'SOLMARIS BAY'];
    var tallest = this.buildings.slice().sort(function (a, b) { return b.position.y - a.position.y; });
    for (var bb = 0; bb < 3 && bb < tallest.length; bb++) {
      var tb = tallest[bb];
      var bw = tb.geometry.parameters.width;
      var bh = tb.geometry.parameters.height;
      var bd = tb.geometry.parameters.depth;
      var bcv = document.createElement('canvas');
      bcv.width = 512; bcv.height = 128;
      var bg = bcv.getContext('2d');
      bg.fillStyle = '#10151c'; bg.fillRect(0, 0, 512, 128);
      bg.font = '900 64px Arial, sans-serif';
      bg.textAlign = 'center'; bg.textBaseline = 'middle';
      bg.shadowColor = '#ffb347'; bg.shadowBlur = 24;
      bg.fillStyle = '#ffb347';
      bg.fillText(billTexts[bb], 256, 66);
      var btex = new THREE.CanvasTexture(bcv);
      var board = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(18, bw + 4), 4.5),
        new THREE.MeshBasicMaterial({ map: btex, transparent: true })
      );
      board.position.set(tb.position.x, tb.position.y + bh / 2 + 3.2, tb.position.z + bd / 2 + 0.2);
      scene.add(board);
    }

    // ---- palm trees (roads, beach, park) ----
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    var leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57, side: THREE.DoubleSide });
    var px, pz;
    for (i = 0; i < 46; i++) {
      // along roads or on the beach
      if (Math.random() < 0.6) {
        px = U.choice(coords) + U.choice([-11, 11]) + U.rand(-2, 2);
        pz = U.rand(-180, 245);
      } else {
        px = U.rand(-280, 280);
        pz = U.rand(255, 288);
      }
      this._palm(scene, px, pz, trunkMat, leafMat);
    }
    // park trees
    for (i = 0; i < 8; i++) {
      this._palm(scene, pk.x + U.rand(-22, 22), pk.z + U.rand(-22, 22), trunkMat, leafMat);
    }

    // ---- street props: lamps + hydrants ----
    var poleMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
    var lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554411 });
    this.lampMat = lampMat;
    var hydMat = new THREE.MeshLambertMaterial({ color: 0xc22a22 });
    for (i = 0; i < coords.length; i++) {
      for (var s = -240; s <= 240; s += 60) {
        var lx = coords[i] + 8.5, lz = s;
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), poleMat);
        pole.position.set(lx, 3, lz); pole.castShadow = true; scene.add(pole);
        var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
        lamp.position.set(lx, 6.2, lz); scene.add(lamp);
        if (Math.random() < 0.5) {
          var hy = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.9, 8), hydMat);
          hy.position.set(coords[i] - 8.5, 0.45, s + 20);
          hy.castShadow = true; scene.add(hy);
        }
      }
    }

    // ---- new districts + weather (stage 7) ----
    this._buildOldTown(scene);
    this._buildPierWheel(scene);
    this._buildRain(scene);
  },

  // Old Town (NW corner, off the road grid): narrow streets, arched
  // facades, a stone plaza with a statue in the middle
  _buildOldTown: function (scene) {
    var ot = this.oldTown;
    // stone plaza
    var plaza = new THREE.Mesh(
      new THREE.CircleGeometry(18, 28),
      new THREE.MeshLambertMaterial({ color: 0x9a938a })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(ot.x, 0.06, ot.z);
    plaza.receiveShadow = true;
    scene.add(plaza);
    // narrow streets crossing the plaza (cobble strips)
    var streetMat = new THREE.MeshLambertMaterial({ color: 0x7a756c });
    var st1 = new THREE.Mesh(new THREE.PlaneGeometry(70, 5), streetMat);
    st1.rotation.x = -Math.PI / 2;
    st1.position.set(ot.x, 0.07, ot.z);
    scene.add(st1);
    var st2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 70), streetMat);
    st2.rotation.x = -Math.PI / 2;
    st2.position.set(ot.x, 0.07, ot.z);
    scene.add(st2);
    // the statue: stone pedestal + a robed figure holding a sword skyward
    var stoneMat = new THREE.MeshLambertMaterial({ color: 0x8a8a82 });
    var ped = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 1.6, 10), stoneMat);
    ped.position.set(ot.x, 0.8, ot.z); ped.castShadow = true; scene.add(ped);
    var figure = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 3.4, 8), stoneMat);
    figure.position.set(ot.x, 3.3, ot.z); figure.castShadow = true; scene.add(figure);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), stoneMat);
    head.position.set(ot.x, 5.4, ot.z); head.castShadow = true; scene.add(head);
    var sword = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.2, 0.5), new THREE.MeshLambertMaterial({ color: 0xb8b8b0 }));
    sword.position.set(ot.x + 0.9, 5.6, ot.z); sword.castShadow = true; scene.add(sword);
    this.colliders.push({ minX: ot.x - 2.8, maxX: ot.x + 2.8, minZ: ot.z - 2.8, maxZ: ot.z + 2.8 });
    // arched facades: six old buildings ring the plaza, each with a
    // half-torus arch over a dark doorway
    var facadeColors = [0xb08d6a, 0x9a7a5a, 0x8a6a52, 0xa88a68, 0x96744f, 0xb59a72];
    var archMat = new THREE.MeshLambertMaterial({ color: 0x6b5a48 });
    var doorMat = new THREE.MeshLambertMaterial({ color: 0x1a1410 });
    for (var i = 0; i < 6; i++) {
      var a = i / 6 * Math.PI * 2 + Math.PI / 6;
      var fx = ot.x + Math.cos(a) * 34;
      var fz = ot.z + Math.sin(a) * 34;
      var w = SBUtils.rand(14, 18), d = SBUtils.rand(12, 16), h = SBUtils.rand(10, 16);
      var bmat = new THREE.MeshLambertMaterial({ color: facadeColors[i] });
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bmat);
      b.position.set(fx, h / 2, fz);
      b.castShadow = true; b.receiveShadow = true;
      scene.add(b);
      // barrel roof: a half-cylinder along the building's depth
      var roof = new THREE.Mesh(
        new THREE.CylinderGeometry(w / 2, w / 2, d, 12, 1, false, 0, Math.PI),
        new THREE.MeshLambertMaterial({ color: 0x7a4a3a })
      );
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.position.set(fx, h, fz);
      roof.castShadow = true;
      scene.add(roof);
      // arched doorway facing the plaza: dark box + half-torus arch
      var door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 0.3), doorMat);
      var dx = fx - Math.cos(a) * (d / 2 + 0.1);
      var dz = fz - Math.sin(a) * (d / 2 + 0.1);
      door.position.set(dx, 1.6, dz);
      door.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
      scene.add(door);
      var arch = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.35, 8, 12, Math.PI), archMat);
      arch.position.set(dx, 3.2, dz);
      arch.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
      scene.add(arch);
      this.colliders.push({ minX: fx - w / 2, maxX: fx + w / 2, minZ: fz - d / 2, maxZ: fz + d / 2 });
      this.buildings.push(b);
    }
  },

  // second beach + long pier + ferris wheel silhouette on the harbor
  _buildPierWheel: function (scene) {
    // second beach: a sand cove just south of the harbor inlet
    var cove = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 24),
      new THREE.MeshLambertMaterial({ color: 0xd9c08a })
    );
    cove.rotation.x = -Math.PI / 2;
    cove.position.set(270, 0.05, 192);
    cove.receiveShadow = true;
    scene.add(cove);
    // long pier running east into the harbor water
    var pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    var pier = new THREE.Mesh(new THREE.BoxGeometry(55, 0.5, 4), pierMat);
    pier.position.set(272, 0.3, 150);
    pier.castShadow = true; pier.receiveShadow = true;
    scene.add(pier);
    var postMat = new THREE.MeshLambertMaterial({ color: 0x6b4f2a });
    for (var i = 0; i < 6; i++) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.4, 6), postMat);
      post.position.set(248 + i * 10, -0.6, 148.2);
      scene.add(post);
      var post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.4, 6), postMat);
      post2.position.set(248 + i * 10, -0.6, 151.8);
      scene.add(post2);
    }
    // ferris wheel at the end of the pier: dark silhouette against the sky
    var wheelBase = new THREE.Group();
    var legMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 14, 0.8), legMat);
    legL.position.set(-4, 7, 0); legL.rotation.z = 0.35; legL.castShadow = true;
    wheelBase.add(legL);
    var legR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 14, 0.8), legMat);
    legR.position.set(4, 7, 0); legR.rotation.z = -0.35; legR.castShadow = true;
    wheelBase.add(legR);
    var spin = new THREE.Group();
    spin.position.y = 14;
    var rimMat = new THREE.MeshLambertMaterial({ color: 0x222831 });
    var rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.45, 8, 28), rimMat);
    rim.castShadow = true;
    spin.add(rim);
    var rim2 = new THREE.Mesh(new THREE.TorusGeometry(9, 0.45, 8, 28), rimMat);
    rim2.position.z = 1.2;
    spin.add(rim2);
    // spokes + gondolas around the rim
    var gondolaMat = new THREE.MeshLambertMaterial({ color: 0xff5d8f });
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

  // rain: one Points cloud of 600 drops in a box that follows the player
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

  // rain toggle (U): light rain darkens the sky and makes the roads glossy
  setRain: function (on) {
    this.raining = !!on;
    if (this.rainPoints) this.rainPoints.visible = this.raining;
    for (var i = 0; i < this.roadMats.length; i++) {
      this.roadMats[i].color.setHex(this.raining ? 0x5a6678 : 0xffffff);
    }
    return this.raining;
  },

  // day/night toggle (I): dusk dims the sun, warms the sky, and the
  // streetlamps glow — the transition lerps over ~0.7 s in update()
  setDusk: function (on) {
    this.dusk = !!on;
    return this.dusk;
  },

  // per-frame: rain fall, ferris wheel spin, dusk transition
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
    var hullMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    var hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 8), hullMat);
    hull.position.y = 0.4; hull.castShadow = true; g.add(hull);
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.3, 8.1), new THREE.MeshLambertMaterial({ color: 0x2a6ea8 }));
    stripe.position.y = 0.9; g.add(stripe);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), new THREE.MeshLambertMaterial({ color: 0xd9c08a }));
    cabin.position.set(0, 1.4, -1); cabin.castShadow = true; g.add(cabin);
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), new THREE.MeshLambertMaterial({ color: 0x6b4f2a }));
    mast.position.set(0, 3.5, 1.5); g.add(mast);
    g.position.set(x, 0.1, z);
    g.rotation.y = yaw;
    scene.add(g);
  },

  _neonSign: function (scene, x, y, z, text, color) {
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    var g = cv.getContext('2d');
    g.clearRect(0, 0, 256, 64);
    g.font = '900 38px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 16;
    g.fillStyle = color;
    g.fillText(text, 128, 34);
    g.shadowBlur = 0;
    g.fillStyle = '#ffffff';
    g.fillText(text, 128, 34);
    var tex = new THREE.CanvasTexture(cv);
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 2.25),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    m.position.set(x, y, z);
    scene.add(m);
  },

  _roadTexture: function () {
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    var g = cv.getContext('2d');
    g.fillStyle = '#2e3138'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#33363e';
    for (var i = 0; i < 300; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    g.fillStyle = '#e8e8d8';
    g.fillRect(60, 8, 8, 40); g.fillRect(60, 80, 8, 40); // dashed centre
    g.fillStyle = '#c8c8b8';
    g.fillRect(4, 0, 3, 128); g.fillRect(121, 0, 3, 128); // edge lines
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
  }
};
