// player.js — Raka on foot (box-built figure), sprint stamina,
// lean-into-turns animation, footstep sounds
var Player = {
  group: null,
  torso: null,
  legL: null, legR: null, armL: null, armR: null,
  x: 0, z: 0, heading: 0, speed: 0,
  walkSpeed: 4.2, runSpeed: 8.0,
  radius: 0.6,
  walkPhase: 0,
  moving: false,
  // sprint stamina: drains while sprinting, regens otherwise; hitting 0
  // leaves Raka winded (no sprint until stamina recovers past 30)
  stamina: 100,
  staminaMax: 100,
  exhausted: false,
  _prevStep: 0,
  _lean: 0,
  // jump: vertical hop state; y is height above the ground
  y: 0,
  vy: 0,
  grounded: true,
  dustPool: [],

  build: function (scene, spawn) {
    this.x = spawn.x; this.z = spawn.z; this.heading = 0;
    var g = new THREE.Group();
    var skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    var shirt = new THREE.MeshLambertMaterial({ color: 0xe8590c }); // orange shirt
    var pants = new THREE.MeshLambertMaterial({ color: 0x2b3a55 });
    var hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
    torso.position.y = 1.08; torso.castShadow = true; g.add(torso);
    this.torso = torso;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), skin);
    head.position.y = 1.68; head.castShadow = true; g.add(head);
    var cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.42), hair);
    cap.position.y = 1.9; g.add(cap);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
    this.legL.geometry.translate(0, -0.36, 0);
    this.legL.position.set(-0.16, 0.72, 0); this.legL.castShadow = true; g.add(this.legL);
    this.legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
    this.legR.geometry.translate(0, -0.36, 0);
    this.legR.position.set(0.16, 0.72, 0); this.legR.castShadow = true; g.add(this.legR);
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
    this.armL.geometry.translate(0, -0.31, 0);
    this.armL.position.set(-0.42, 1.4, 0); this.armL.castShadow = true; g.add(this.armL);
    this.armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
    this.armR.geometry.translate(0, -0.31, 0);
    this.armR.position.set(0.42, 1.4, 0); this.armR.castShadow = true; g.add(this.armR);

    g.position.set(this.x, 0, this.z);
    scene.add(g);
    this.group = g;
    // landing dust: small grey puffs, reused from a pool
    var dustMat = new THREE.MeshBasicMaterial({ color: 0x9a9a8a, transparent: true, opacity: 0.5, depthWrite: false });
    for (var di = 0; di < 6; di++) {
      var d = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), dustMat.clone());
      d.visible = false;
      scene.add(d);
      this.dustPool.push({ mesh: d, life: 0 });
    }
  },

  _landDust: function () {
    // three puffs around the feet when a jump lands hard
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < this.dustPool.length; j++) {
        var p = this.dustPool[j];
        if (p.life <= 0) {
          p.life = 0.6;
          p.mesh.visible = true;
          p.mesh.position.set(this.x + SBUtils.rand(-0.8, 0.8), 0.25, this.z + SBUtils.rand(-0.8, 0.8));
          p.mesh.scale.set(0.5, 0.5, 0.5);
          p.mesh.material.opacity = 0.5;
          break;
        }
      }
    }
  },

  update: function (dt, camYaw, colliders) {
    // jump: Space on foot, edge-triggered, only from the ground
    if (Input.pressed('Space') && this.grounded) {
      this.vy = 5.4;
      this.grounded = false;
      AudioSys.blip(300);
    }
    // gravity + landing (runs every frame, even while standing still)
    if (!this.grounded) {
      this.vy -= 16 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        if (this.vy < -3.5) { this._landDust(); AudioSys.footstep(false); }
        this.vy = 0;
        this.grounded = true;
      }
    }
    // landing dust puffs fade and swell
    for (var di = 0; di < this.dustPool.length; di++) {
      var dp = this.dustPool[di];
      if (dp.life > 0) {
        dp.life -= dt;
        var sc = 0.5 + (0.6 - dp.life) * 1.4;
        dp.mesh.scale.set(sc, sc, sc);
        dp.mesh.material.opacity = Math.max(0, dp.life / 0.6 * 0.5);
        if (dp.life <= 0) dp.mesh.visible = false;
      }
    }
    var fwd = Input.axisAction('down', 'up');
    var str = Input.axisAction('left', 'right');
    var wantRun = Input.sprintDown();
    // sprint only while stamina lasts; winded until it recovers past 30
    var sprinting = wantRun && !this.exhausted && this.stamina > 0;
    var mag = Math.sqrt(fwd * fwd + str * str);
    this.moving = mag > 0.1;
    if (!this.moving) {
      this.speed = 0;
      this.legL.rotation.x = 0; this.legR.rotation.x = 0;
      this.armL.rotation.x = 0; this.armR.rotation.x = 0;
      this.torso.rotation.x = 0;
      this._lean = SBUtils.lerp(this._lean, 0, Math.min(1, dt * 6));
      this.group.rotation.z = this._lean;
      this.group.position.set(this.x, this.y, this.z);
      // catch breath faster when standing still
      this.stamina = Math.min(this.staminaMax, this.stamina + 14 * dt);
      if (this.exhausted && this.stamina > 30) this.exhausted = false;
      return;
    }
    fwd /= mag; str /= mag;
    var targetSpeed = sprinting ? this.runSpeed : this.walkSpeed;
    this.speed = SBUtils.lerp(this.speed, targetSpeed, Math.min(1, dt * 8));
    // stamina: sprint drains 22/s, walking regens 8/s
    if (sprinting) {
      this.stamina -= 22 * dt;
      if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; }
    } else {
      this.stamina = Math.min(this.staminaMax, this.stamina + 8 * dt);
      if (this.exhausted && this.stamina > 30) this.exhausted = false;
    }
    // movement relative to camera yaw
    var sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    var mx = -sin * fwd + cos * str;
    var mz = -cos * fwd - sin * str;
    var p = { x: this.x + mx * this.speed * dt, z: this.z + mz * this.speed * dt };
    // collide against buildings
    for (var i = 0; i < colliders.length; i++) {
      SBUtils.resolveCircleAABB(p, this.radius, colliders[i]);
    }
    // world bounds
    p.x = SBUtils.clamp(p.x, -290, 290);
    p.z = SBUtils.clamp(p.z, -290, 295);
    this.x = p.x; this.z = p.z;
    var targetHeading = Math.atan2(mx, mz);
    var prevHeading = this.heading;
    this.heading = SBUtils.lerpAngle(this.heading, targetHeading, Math.min(1, dt * 12));
    // lean into the turn: bank the whole figure a little, proportional
    // to how fast the heading is changing
    var turnRate = (this.heading - prevHeading) / Math.max(dt, 0.001);
    this._lean = SBUtils.lerp(this._lean, SBUtils.clamp(-turnRate * 0.03, -0.14, 0.14), Math.min(1, dt * 8));
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.heading;
    this.group.rotation.z = this._lean;
    // sprint: lean the torso forward, swing the arms harder
    this.torso.rotation.x = sprinting ? 0.14 : 0;
    // mid-air: tuck the legs, arms out (walk cycle paused while airborne)
    if (!this.grounded) {
      this.legL.rotation.x = -0.5; this.legR.rotation.x = 0.35;
      this.armL.rotation.x = -1.1; this.armR.rotation.x = -1.1;
      this.torso.rotation.x = -0.08;
      return;
    }
    var swing = sprinting ? 0.85 : 0.5;
    // walk cycle
    this.walkPhase += dt * this.speed * 1.6;
    var s = Math.sin(this.walkPhase);
    this.legL.rotation.x = s * 0.7;
    this.legR.rotation.x = -s * 0.7;
    this.armL.rotation.x = -s * swing;
    this.armR.rotation.x = s * swing;
    // footstep sound on each half-cycle crossing
    var step = Math.floor(this.walkPhase / Math.PI);
    if (step !== this._prevStep) {
      this._prevStep = step;
      AudioSys.footstep(sprinting);
    }
  }
};
