// combat.js — pistol + shotgun pickups, ammo boxes, shooting
// (raycast, tracer, muzzle flash)
var Combat = {
  armed: false,
  weapon: 'pistol', // pistol | shotgun
  ammo: 0,
  shells: 0,
  hasShotgun: false,
  pickup: null,
  pickupGlow: null,
  pickupTaken: false,
  shotgunPickup: null,
  shotgunGlow: null,
  shotgunTaken: false,
  ammoBoxes: [], // {group, glow, x, z, taken, respawnT}
  tracer: null,
  flash: null,
  flashT: 0,
  shotCd: 0,
  spark: null,
  sparkT: 0,
  prevF: false,
  prevQ: false,
  prevR: false,
  outOfAmmoToast: false,
  hitEl: null, // hit-marker X at screen centre, flashes on a solid hit
  hitT: 0,
  raycaster: null,

  build: function (scene) {
    this.scene = scene;
    // weapon pickup downtown at (20, -20): pistol
    var g = new THREE.Group();
    var box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    box.position.y = 0.4; box.castShadow = true; g.add(box);
    var glow = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshBasicMaterial({ color: 0x7dff9a }));
    glow.position.y = 1.6; g.add(glow);
    g.position.set(20, 0, -20);
    scene.add(g);
    this.pickup = g;
    this.pickupGlow = glow;
    // shotgun pickup by the park at (-140, -100): orange glow, 6 shells
    var sg = new THREE.Group();
    var sgBox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: 0x3a2a1a }));
    sgBox.position.y = 0.4; sgBox.castShadow = true; sg.add(sgBox);
    var sgGlow = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), new THREE.MeshBasicMaterial({ color: 0xff8844 }));
    sgGlow.position.y = 1.6; sg.add(sgGlow);
    sg.position.set(-140, 0, -100);
    scene.add(sg);
    this.shotgunPickup = sg;
    this.shotgunGlow = sgGlow;
    // ammo boxes that respawn: refill pistol +6 / shotgun +3
    var boxSpots = [[60, 60], [-60, -140]];
    for (var i = 0; i < boxSpots.length; i++) {
      var ab = new THREE.Group();
      var crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: 0x5a7c3a }));
      crate.position.y = 0.45; crate.castShadow = true; ab.add(crate);
      var aglow = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      aglow.position.y = 1.5; ab.add(aglow);
      ab.position.set(boxSpots[i][0], 0, boxSpots[i][1]);
      scene.add(ab);
      this.ammoBoxes.push({ group: ab, glow: aglow, x: boxSpots[i][0], z: boxSpots[i][1], taken: false, respawnT: 0 });
    }
    // tracer line (2 points, hidden until a shot)
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
    this.tracer.frustumCulled = false;
    scene.add(this.tracer);
    // muzzle flash light
    this.flash = new THREE.PointLight(0xffcc66, 0, 25);
    scene.add(this.flash);
    // hit spark
    this.spark = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.spark.visible = false;
    scene.add(this.spark);
    // hit marker: white X that flashes at screen centre on a solid hit
    var hm = document.createElement('div');
    hm.id = 'hud-hitmarker';
    hm.textContent = '✕';
    hm.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:34px;font-weight:900;color:#fff;text-shadow:0 0 6px #000,0 0 2px #000;z-index:6;pointer-events:none;opacity:0';
    document.body.appendChild(hm);
    this.hitEl = hm;
    this.raycaster = new THREE.Raycaster();
  },

  _isPoliceGroup: function (obj) {
    var o = obj;
    while (o) {
      if (o.userData && o.userData.police) return true;
      o = o.parent;
    }
    return false;
  },

  _spark: function (point, color) {
    this.spark.position.copy(point);
    this.spark.material.color.setHex(color);
    this.spark.visible = true;
    this.sparkT = 0.12;
  },

  // flash the hit marker for 0.15 s
  showHit: function () {
    if (!this.hitEl) return;
    this.hitEl.style.opacity = '1';
    this.hitT = 0.15;
  },

  // one pellet ray; returns the hit point (or null) and applies its effect
  _firePellet: function (origin, dir, policeStarred) {
    this.raycaster.set(origin, dir);
    this.raycaster.far = 220;
    var targets = [];
    for (var i = 0; i < World.buildings.length; i++) targets.push(World.buildings[i]);
    for (var j = 0; j < Traffic.peds.length; j++) targets.push(Traffic.peds[j].group);
    for (var k = 0; k < Police.cars.length; k++) targets.push(Police.cars[k].group);
    var hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length === 0) return origin.clone().add(dir.clone().multiplyScalar(200));
    var h = hits[0];
    var ped = null;
    var o = h.object;
    while (o) {
      if (o.userData && o.userData.ped) { ped = o.userData.ped; break; }
      o = o.parent;
    }
    if (ped) {
      Traffic.knockDown(ped, 'shot');
      this._spark(h.point, 0xffcc44);
      this.showHit();
    } else if (this._isPoliceGroup(h.object)) {
      if (!policeStarred.hit) {
        policeStarred.hit = true;
        Police.addWanted(1, 'shooting');
        HUD.toast('You shot a cop car!  +1 star', '#ff4444');
      }
      this._spark(h.point, 0xffcc44);
      this.showHit();
    } else {
      this._spark(h.point, 0xffffff);
    }
    return h.point;
  },

  shoot: function () {
    var shotgun = this.weapon === 'shotgun';
    if (shotgun) {
      if (this.shells <= 0) {
        if (!this.outOfAmmoToast) { HUD.toast('Out of shells! (Q to switch)', '#ff8844'); this.outOfAmmoToast = true; }
        this.shotCd = 0.3;
        return;
      }
      this.shells--;
      this.shotCd = 0.7;
      AudioSys.boom();
    } else {
      if (this.ammo <= 0) {
        if (!this.outOfAmmoToast) {
          HUD.toast('Out of ammo!', '#ff8844');
          this.outOfAmmoToast = true;
        }
        this.shotCd = 0.3;
        return;
      }
      this.ammo--;
      this.shotCd = 0.28;
      AudioSys.shot();
    }
    var cam = Game.camera;
    var origin = cam.position.clone();
    var dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    var policeStarred = { hit: false };
    var end;
    if (shotgun) {
      // 5 pellets in a tight cone
      var cam2 = Game.camera;
      var right = new THREE.Vector3().setFromMatrixColumn(cam2.matrix, 0);
      var up = new THREE.Vector3().setFromMatrixColumn(cam2.matrix, 1);
      end = origin.clone();
      for (var p = 0; p < 5; p++) {
        var pd = dir.clone();
        pd.add(right.clone().multiplyScalar((Math.random() - 0.5) * 0.09));
        pd.add(up.clone().multiplyScalar((Math.random() - 0.5) * 0.09));
        pd.normalize();
        var hit = this._firePellet(origin, pd, policeStarred);
        if (p === 0) end = hit;
      }
    } else {
      end = this._firePellet(origin, dir, policeStarred);
    }
    Traffic.onShot(Player.x, Player.z);
    Camera.shake(shotgun ? 0.3 : 0.15);
    // tracer from the gun to the hit point
    var start = new THREE.Vector3(Player.x, 1.4, Player.z);
    var pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, start.x, start.y, start.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    this.tracer.material.opacity = 0.9;
    this.flash.position.set(start.x, start.y, start.z);
    this.flash.intensity = shotgun ? 7 : 4;
    this.flashT = 0.08;
  },

  update: function (dt) {
    if (this.flashT > 0) {
      this.flashT -= dt;
      var f = Math.max(0, this.flashT / 0.08);
      this.flash.intensity = f * (this.weapon === 'shotgun' ? 7 : 4);
      this.tracer.material.opacity = f * 0.9;
      if (this.flashT <= 0) { this.tracer.material.opacity = 0; this.flash.intensity = 0; }
    }
    if (this.sparkT > 0) {
      this.sparkT -= dt;
      if (this.sparkT <= 0) this.spark.visible = false;
    }
    if (this.hitT > 0) {
      this.hitT -= dt;
      if (this.hitT <= 0 && this.hitEl) this.hitEl.style.opacity = '0';
    }
    if (this.shotCd > 0) this.shotCd -= dt;
    if (this.pickupGlow) this.pickupGlow.rotation.y += dt * 2;
    if (this.shotgunGlow) this.shotgunGlow.rotation.y += dt * 2;
    // ammo box respawns (20 s) + glow spin
    for (var ai = 0; ai < this.ammoBoxes.length; ai++) {
      var ab = this.ammoBoxes[ai];
      if (ab.taken) {
        ab.respawnT -= dt;
        if (ab.respawnT <= 0) {
          ab.taken = false;
          ab.group.visible = true;
        }
      } else if (ab.glow) ab.glow.rotation.y += dt * 2;
    }
    // F near a pickup to take it (pistol, shotgun, ammo box)
    var keyF = Input.down('KeyF');
    if (keyF && !this.prevF && !Vehicle.isDriving()) {
      if (!this.pickupTaken && SBUtils.dist2D(Player.x, Player.z, 20, -20) < 3) {
        this.pickupTaken = true;
        this.armed = true;
        this.weapon = 'pistol';
        this.ammo = 12;
        this.outOfAmmoToast = false;
        this.pickup.visible = false;
        HUD.toast('Pistol picked up — click to shoot', '#7dff9a');
        AudioSys.blip(990);
      } else if (!this.shotgunTaken && SBUtils.dist2D(Player.x, Player.z, -140, -100) < 3) {
        this.shotgunTaken = true;
        this.hasShotgun = true;
        this.armed = true;
        this.weapon = 'shotgun';
        this.shells = 6;
        this.outOfAmmoToast = false;
        this.shotgunPickup.visible = false;
        HUD.toast('Shotgun picked up — 6 shells, wide spread (Q to switch)', '#ff8844');
        AudioSys.blip(990);
      } else {
        for (var bi = 0; bi < this.ammoBoxes.length; bi++) {
          var box2 = this.ammoBoxes[bi];
          if (!box2.taken && SBUtils.dist2D(Player.x, Player.z, box2.x, box2.z) < 3) {
            box2.taken = true;
            box2.respawnT = 20;
            box2.group.visible = false;
            this.ammo += 6;
            this.shells += 3;
            this.outOfAmmoToast = false;
            HUD.toast('Ammo restocked  +6 bullets, +3 shells', '#7dff9a');
            AudioSys.blip(990);
            break;
          }
        }
      }
    }
    this.prevF = keyF;
    // Q switches between owned weapons
    var keyQ = Input.down('KeyQ');
    if (keyQ && !this.prevQ && this.armed && this.hasShotgun) {
      this.weapon = this.weapon === 'pistol' ? 'shotgun' : 'pistol';
      HUD.toast(this.weapon === 'shotgun' ? 'Shotgun ready' : 'Pistol ready', '#ffd23f');
      AudioSys.blip(740);
    }
    this.prevQ = keyQ;
    // R reloads the pistol (only when no mission is waiting to be retried —
    // R is the retry key while a mission is failed, main.js owns that case)
    var keyR = Input.down('KeyR');
    if (keyR && !this.prevR && Missions.state !== 'failed' && this.armed && this.weapon === 'pistol' && this.ammo < 12) {
      this.ammo = 12;
      this.outOfAmmoToast = false;
      HUD.toast('Pistol reloaded — 12 rounds', '#7dff9a');
      AudioSys.blip(660);
    }
    this.prevR = keyR;
    // click to shoot (on foot, armed)
    if (this.armed && !Vehicle.isDriving() && Input.takeClick() && this.shotCd <= 0) {
      this.shoot();
    }
  }
};
