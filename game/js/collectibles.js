// collectibles.js — 12 hidden Bay packages scattered at city landmarks.
var Collectibles = {
  spots: [
    [245, 150], [270, 60], [-282, -32], [-240, -80], [20, -20], [-240, -240],
    [-62, 122], [-120, 262], [120, -120], [60, -260], [62, -62], [150, 255]
  ],
  meshes: [],
  found: {},
  count: 0,
  time: 0,
  scene: null,

  init: function (scene) {
    this.scene = scene;
    try {
      var saved = JSON.parse(localStorage.getItem('solmaris.packages') || '[]');
      for (var s = 0; s < saved.length; s++) this.found[saved[s]] = true;
    } catch (e) {}
    this.count = Object.keys(this.found).length;
    var mat = new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0xffaa00 });
    for (var i = 0; i < this.spots.length; i++) {
      if (this.found[i]) { this.meshes.push(null); continue; }
      var m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), mat);
      m.position.set(this.spots[i][0], 1, this.spots[i][1]);
      scene.add(m);
      this.meshes.push(m);
    }
  },

  _save: function () {
    try { localStorage.setItem('solmaris.packages', JSON.stringify(Object.keys(this.found).map(Number))); } catch (e) {}
  },

  update: function (dt) {
    if (!this.scene) return;
    this.time += dt;
    var driving = Vehicle.isDriving();
    var px = driving ? Vehicle.drivable.x : Player.x;
    var pz = driving ? Vehicle.drivable.z : Player.z;
    for (var i = 0; i < this.meshes.length; i++) {
      var m = this.meshes[i];
      if (!m) continue;
      m.rotation.y += dt * 1.5;
      m.position.y = 1 + Math.sin(this.time * 2 + i) * 0.2;
      if (SBUtils.dist2D(px, pz, this.spots[i][0], this.spots[i][1]) < 3) {
        this.scene.remove(m);
        this.meshes[i] = null;
        this.found[i] = true;
        this.count++;
        this._save();
        Game.money += 100;
        if (Game.stats) Game.stats.cashEarned += 100;
        HUD.toast('Bay package found (' + this.count + '/12) +$100', '#ffd23f');
        AudioSys.chaChing();
        if (this.count >= 12) {
          Game.money += 2500;
          if (Game.stats) Game.stats.cashEarned += 2500;
          HUD.toast('All 12 Bay packages found — +$2500 bonus!', '#7dff9a');
        }
      }
    }
  }
};
