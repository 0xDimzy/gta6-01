// camera.js — third-person follow + orbit, chase cam in car,
// cinematic title pan + impact shake
var Camera = {
  cam: null,
  yaw: 0,          // orbit yaw around the target
  pitch: 0.32,     // orbit pitch (radians)
  dist: 9,
  introYaw: 0,     // title-screen pan angle
  shakeT: 0,       // remaining shake time
  shakeAmp: 0,     // shake strength
  init: function (camera) {
    this.cam = camera;
  },
  // kick the camera: collisions call shake(0.35), gunshots shake(0.15)
  shake: function (amp) {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = 0.35;
  },
  // slow cinematic orbit over the city while the title screen is up
  intro: function (dt) {
    this.introYaw += dt * 0.045;
    var r = 95, h = 34;
    var cx = Math.sin(this.introYaw) * r;
    var cz = Math.cos(this.introYaw) * r;
    this.cam.position.set(cx, h, cz);
    this.cam.lookAt(0, 2, 0);
  },
  update: function (dt, target, driving) {
    var orbit = Input.takeOrbit();
    this.yaw -= orbit.x * 0.005;
    this.pitch = SBUtils.clamp(this.pitch + orbit.y * 0.004, 0.08, 1.1);
    var wantDist = driving ? 12.5 : 9;
    this.dist = SBUtils.lerp(this.dist, wantDist, Math.min(1, dt * 3));
    var tx = target.x, tz = target.z;
    var ty = driving ? 1.4 : 1.6;
    // camera sits behind the orbit yaw; when driving, bias behind the car heading
    var baseYaw = this.yaw;
    if (driving) {
      // blend orbit yaw toward behind-car so the view follows the road
      var behind = target.heading + Math.PI;
      baseYaw = SBUtils.angleLerp(baseYaw, behind, Math.min(1, dt * 1.2));
      this.yaw = baseYaw;
    }
    var cx = tx + Math.sin(baseYaw) * Math.cos(this.pitch) * this.dist;
    var cz = tz + Math.cos(baseYaw) * Math.cos(this.pitch) * this.dist;
    var cy = ty + Math.sin(this.pitch) * this.dist;
    // collision-lite: if the camera point is inside a building, pull it in
    var pos = { x: cx, z: cz };
    var guard = 0;
    while (guard++ < 8) {
      var inside = false;
      for (var i = 0; i < World.colliders.length; i++) {
        var b = World.colliders[i];
        if (pos.x > b.minX - 0.4 && pos.x < b.maxX + 0.4 && pos.z > b.minZ - 0.4 && pos.z < b.maxZ + 0.4) { inside = true; break; }
      }
      if (!inside) break;
      var f = 0.85;
      pos.x = tx + (pos.x - tx) * f;
      pos.z = tz + (pos.z - tz) * f;
      cy = ty + (cy - ty) * f;
    }
    cx = pos.x; cz = pos.z;
    if (cy < 1.2) cy = 1.2;
    // impact shake: decaying random offset, strongest right after the hit
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      var k = this.shakeAmp * SBUtils.clamp01(this.shakeT / 0.35);
      cx += (Math.random() - 0.5) * k;
      cy += (Math.random() - 0.5) * k * 0.6;
      cz += (Math.random() - 0.5) * k;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
    var cp = this.cam.position;
    cp.x = SBUtils.lerp(cp.x, cx, Math.min(1, dt * 7));
    cp.y = SBUtils.lerp(cp.y, cy, Math.min(1, dt * 7));
    cp.z = SBUtils.lerp(cp.z, cz, Math.min(1, dt * 7));
    this.cam.lookAt(tx, ty, tz);
    return baseYaw;
  }
};
