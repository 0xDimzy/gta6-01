// world.js — Solmaris Bay: city, roads, buildings, beach, sea,
// harbor/marina district, park, neon signs, rooftop detail
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
  spawnDowntown: { x: 4, z: 8 },
  spawnCar: { x: 8, z: 2, heading: Math.PI / 2 },

  build: function (scene) {
    var U = SBUtils;
    scene.background = new THREE.Color(0x8ec8e8);
    scene.fog = new THREE.Fog(0x9fc3dd, 200, 560);

    // late-afternoon sun: warmer, lower, longer shadows than noon
    var hemi = new THREE.HemisphereLight(0xbfd9ff, 0x5a5a48, 0.8);
    scene.add(hemi);
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
