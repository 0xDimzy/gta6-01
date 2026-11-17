// player.js — Raka on foot (box-built figure), sprint stamina,
// lean-into-turns animation, footstep sounds, jump, crouch, swimming,
// sprint burst
var Player = {
  group: null,
  torso: null,
  legL: null, legR: null, armL: null, armR: null,
  x: 0, z: 0, heading: 0, speed: 0,
  walkSpeed: 4.2, runSpeed: 8.0,
  crouchSpeed: 2.0, // crouched: slow, but the heat drops faster
  swimSpeed: 2.4, // paddling in the sea: slow, and you cannot drown
  burstSpeed: 13.0, // sprint burst: 2x-ish, drains stamina hard
  radius: 0.6,
  walkPhase: 0,
  moving: false,
  crouched: false,
  swimming: false,
  burstT: 0, // remaining burst time
  burstCd: 0, // burst cooldown
  _wasSprinting: false, // true while the previous frame was a sprint
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

  // in the sea (past the beach, z > SEA_Z): paddling, waist-deep bob
  _inWater: function () {
    return this.z > World.SEA_Z;
  },

  update: function (dt, camYaw, colliders) {
    if (this.burstCd > 0) this.burstCd -= dt;
    // sprint burst: press Shift AGAIN while already sprinting for a
    // 1.5 s burst at ~13 u/s; drains 40 stamina/s, 5 s cooldown
    if (Input.pressedAction('run') && this._wasSprinting && this.stamina > 25 && this.burstCd <= 0 && this.burstT <= 0) {
      this.burstT = 1.5;
      this.burstCd = 5;
      AudioSys.blip(1200);
    }
    if (this.burstT > 0) this.burstT -= dt;
    // crouch (C, hold): half speed, low profile — the heat cools twice
    // as fast while crouched out of sight (Police reads Player.crouched)
    this.crouched = Input.actionDown('crouch') && this.grounded;
    this.swimming = this._inWater();
    // jump: Space on foot, edge-triggered, only from the ground (not in water)
    if (Input.pressed('Space') && this.grounded && !this.swimming) {
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
    // gamepad left stick blends in when the keyboard is idle
    if (fwd === 0 && str === 0) {
      var stick = Input.padStick();
      if (Math.abs(stick.x) > 0.05 || Math.abs(stick.y) > 0.05) {
        fwd = -stick.y;
        str = stick.x;
      }
    }
    var wantRun = Input.sprintDown();
    // sprint only while stamina lasts; winded until it recovers past 30
    var sprinting = wantRun && !this.exhausted && this.stamina > 0;
    var bursting = this.burstT > 0 && sprinting;
    this._wasSprinting = sprinting || bursting;
    var mag = Math.sqrt(fwd * fwd + str * str);
    this.moving = mag > 0.1;
    if (!this.moving) {
      this.speed = 0;
      this._wasSprinting = false;
      this.legL.rotation.x = 0; this.legR.rotation.x = 0;
      this.armL.rotation.x = 0; this.armR.rotation.x = 0;
      this.torso.rotation.x = this.crouched ? 0.35 : 0;
      this._lean = SBUtils.lerp(this._lean, 0, Math.min(1, dt * 6));
      this.group.rotation.z = this._lean;
      // swimming idle: bob gently at the waterline
      var idleY = this.swimming ? 0.15 + Math.sin(performance.now() * 0.004) * 0.08 : this.y;
      this.group.position.set(this.x, idleY, this.z);
      // crouch lowers the figure; swim keeps the torso low too
      var targetScaleY = (this.crouched || this.swimming) ? 0.78 : 1;
      this.group.scale.y = SBUtils.lerp(this.group.scale.y, targetScaleY, Math.min(1, dt * 8));
      // catch breath faster when standing still
      this.stamina = Math.min(this.staminaMax, this.stamina + 14 * dt);
      if (this.exhausted && this.stamina > 30) this.exhausted = false;
      return;
    }
    fwd /= mag; str /= mag;
    var targetSpeed = this.swimming ? this.swimSpeed
      : this.crouched ? this.crouchSpeed
      : bursting ? this.burstSpeed
      : sprinting ? this.runSpeed : this.walkSpeed;
    this.speed = SBUtils.lerp(this.speed, targetSpeed, Math.min(1, dt * 8));
    // stamina: sprint drains 22/s, burst drains 40/s, walking regens 8/s
    if (bursting) {
      this.stamina -= 40 * dt;
      if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; this.burstT = 0; }
    } else if (sprinting) {
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
    // collide against buildings (not while swimming — the sea is open)
    if (!this.swimming) {
      for (var i = 0; i < colliders.length; i++) {
        SBUtils.resolveCircleAABB(p, this.radius, colliders[i]);
      }
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
    // crouch / swim posture: low torso, legs tucked
    var targetScaleY2 = (this.crouched || this.swimming) ? 0.78 : 1;
    this.group.scale.y = SBUtils.lerp(this.group.scale.y, targetScaleY2, Math.min(1, dt * 8));
    // sprint: lean the torso forward, swing the arms harder
    this.torso.rotation.x = this.crouched ? 0.35 : sprinting ? 0.14 : 0;
    // mid-air: tuck the legs, arms out (walk cycle paused while airborne)
    if (!this.grounded) {
      this.legL.rotation.x = -0.5; this.legR.rotation.x = 0.35;
      this.armL.rotation.x = -1.1; this.armR.rotation.x = -1.1;
      this.torso.rotation.x = -0.08;
      return;
    }
    // swimming: slow paddle — arms sweep, legs kick gently
    if (this.swimming) {
      var paddle = Math.sin(this.walkPhase * 0.8) * 0.9;
      this.armL.rotation.x = paddle;
      this.armR.rotation.x = -paddle;
      this.legL.rotation.x = Math.sin(this.walkPhase * 0.8) * 0.3;
      this.legR.rotation.x = -Math.sin(this.walkPhase * 0.8) * 0.3;
      this.walkPhase += dt * this.speed * 1.2;
      return;
    }
    var swing = bursting ? 1.1 : sprinting ? 0.85 : 0.5;
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
      AudioSys.footstep(sprinting || bursting);
    }
  }
};
