// main.js — bootstrap, loop, state machine, HUD, minimap,
// photo mode, radio, taxi rides, rain/dusk toggles, gamepad, slow-mo
var Game = {
  state: 'title', // title | playing | paused
  renderer: null,
  scene: null,
  camera: null,
  clock: null,
  prevE: false,
  prevEsc: false,
  prevR: false,
  prevP: false,
  prevY: false,
  prevT: false,
  prevU: false,
  prevI: false,
  money: 1250,
  health: 100,
  wanted: 0,
  objective: 'Steal a car — walk to the yellow coupe and press E',
  minimap: null,
  mmapCtx: null,
  demoMode: '',
  mapZoom: 0, // minimap zoom level: 0 = whole city, 1 = x2, 2 = x4 (N cycles)

  init: function () {
    var params = new URLSearchParams(window.location.search);
    var demo = params.get('demo') || '';
    this.demoMode = demo;

    Input.init();
    this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(0, 8, -14);
    this.clock = new THREE.Clock();
    Camera.init(this.camera);

    World.build(this.scene);
    Player.build(this.scene, World.spawnDowntown);
    Vehicle.build(this.scene);
    Vehicle.drivable.hp = 100;
    Vehicle.drivable.wrecked = false;
    Traffic.build(this.scene);
    Police.build(this.scene);
    Missions.build(this.scene);
    Combat.build(this.scene);
    HUD.init();

    // demo modes skip the title screen
    if (demo === 'drive' || demo === 'chase') {
      Vehicle.current = Vehicle.drivable;
      Player.group.visible = false;
      Player.x = Vehicle.drivable.x; Player.z = Vehicle.drivable.z;
      this.state = 'playing';
      document.getElementById('title-screen').style.display = 'none';
      Camera.yaw = Vehicle.drivable.heading + Math.PI;
      if (demo === 'drive') {
        Missions.startMission(0);
      } else {
        Police.setWanted(3);
        Police.forceSpawn(2);
        // put the chase in frame: both cruisers ahead on the same road, facing the player
        var cx = Vehicle.drivable.x, cz = Vehicle.drivable.z;
        if (Police.cars[0]) {
          Police.cars[0].x = cx + 30; Police.cars[0].z = 2.2; Police.cars[0].heading = -Math.PI / 2;
          Police.cars[0].group.position.set(cx + 30, 0, 2.2);
          Police.cars[0].group.rotation.y = -Math.PI / 2;
        }
        if (Police.cars[1]) {
          Police.cars[1].x = cx + 48; Police.cars[1].z = -2.2; Police.cars[1].heading = -Math.PI / 2;
          Police.cars[1].group.position.set(cx + 48, 0, -2.2);
          Police.cars[1].group.rotation.y = -Math.PI / 2;
        }
      }
    } else if (demo === 'foot') {
      this.state = 'playing';
      document.getElementById('title-screen').style.display = 'none';
      Missions.startMission(0);
    } else if (demo === 'mission') {
      this.state = 'playing';
      document.getElementById('title-screen').style.display = 'none';
      Player.x = 100; Player.z = -100;
      Player.group.position.set(100, 0, -100);
      Missions.startMission(0);
    }
    // snap camera behind the target on the first frame
    var t = Vehicle.isDriving() ? Vehicle.drivable : Player;
    var yaw = Vehicle.isDriving() ? Vehicle.drivable.heading + Math.PI : 0;
    Camera.yaw = yaw;
    this.camera.position.set(
      t.x + Math.sin(yaw) * 9, 5.5, t.z + Math.cos(yaw) * 9
    );

    this.minimap = document.getElementById('minimap');
    this.mmapCtx = this.minimap.getContext('2d');

    var self = this;
    document.getElementById('title-screen').addEventListener('click', function () {
      AudioSys.init(); AudioSys.resume(); AudioSys.startMusic();
      document.getElementById('title-screen').style.display = 'none';
      self.state = 'playing';
      Camera.startSweep();
      if (Missions.state === 'none') Missions.startMission(0);
    });
    // pause menu: restart the current mission without leaving the game
    var restartBtn = document.getElementById('pause-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', function () {
        var idx = Missions.active >= 0 ? Missions.active : 0;
        Missions.halfPayout = false;
        Missions.failedIdx = -1;
        Missions.startMission(idx);
        document.getElementById('pause-screen').style.display = 'none';
        self.state = 'playing';
        HUD.toast('Mission restarted: ' + Missions.defs[idx].name, '#ffd23f');
      });
    }
    // settings panel (in the pause menu): volume, rain, dusk, map size
    var vol = document.getElementById('set-volume');
    if (vol) {
      vol.addEventListener('input', function () {
        AudioSys.setVolume(vol.value / 100);
      });
    }
    var rain = document.getElementById('set-rain');
    if (rain) {
      rain.addEventListener('change', function () {
        var on = World.setRain(rain.checked);
        HUD.toast(on ? 'Rain rolling in — roads are slick' : 'Rain stopped', '#3f8cff');
      });
    }
    var dusk = document.getElementById('set-dusk');
    if (dusk) {
      dusk.addEventListener('change', function () {
        var on = World.setDusk(dusk.checked);
        HUD.toast(on ? 'Dusk — the lamps are coming on' : 'Back to daylight', '#ffd23f');
      });
    }
    var mapSize = document.getElementById('set-map-size');
    if (mapSize) {
      mapSize.addEventListener('change', function () {
        var mm = document.getElementById('minimap');
        var px = mapSize.value === 'small' ? 120 : mapSize.value === 'large' ? 200 : 150;
        mm.style.width = px + 'px';
        mm.style.height = px + 'px';
      });
    }
    window.addEventListener('resize', function () {
      self.camera.aspect = window.innerWidth / window.innerHeight;
      self.camera.updateProjectionMatrix();
      self.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    window.addEventListener('keydown', function () { AudioSys.init(); AudioSys.resume(); });
    window.addEventListener('pointerdown', function () { AudioSys.init(); AudioSys.resume(); });

    this.loop();
  },

  computeObjective: function () {
    var mo = Missions.getObjective();
    if (mo) return mo;
    if (this.demoMode === 'chase') return 'Lose the heat — break line of sight from the police';
    if (Vehicle.isDriving() && Vehicle.drivable.wrecked) return 'Your car is wrecked — press E to get out';
    return Vehicle.isDriving()
      ? 'Drive the coupe — WASD to drive, Space to handbrake'
      : 'On foot — find your next ride, press E near a car';
  },

  loop: function () {
    var self = this;
    requestAnimationFrame(function () { self.loop(); });
    // last-stand slow-mo: the whole world runs at half speed while it lasts
    var rawDt = Math.min(this.clock.getDelta(), 0.05);
    var dt = rawDt * (Combat.timeScale || 1);

    if (this.state === 'title') {
      // cinematic orbit over the city behind the title screen
      Camera.intro(dt);
      Traffic.update(dt);
      World.update(dt);
      this.renderer.render(this.scene, this.camera);
      if (!window.__shotReady) window.__shotReady = true;
      return;
    }

    if (this.state === 'playing') {
      // gamepad: poll once per frame so sticks + buttons stay fresh
      Input.pollPad();
      // pause toggle (edge)
      var esc = Input.down('Escape');
      if (esc && !this.prevEsc) {
        this.state = 'paused';
        document.getElementById('pause-screen').style.display = 'flex';
      }
      this.prevEsc = esc;

      // photo mode (edge, P): freezes the world, free-orbit camera.
      // While photo mode is on, the simulation is skipped entirely.
      var p = Input.actionDown('photo');
      if (p && !this.prevP) {
        var photoOn = Camera.togglePhoto();
        HUD.toast(photoOn ? 'Photo mode — drag to orbit, Esc to exit' : 'Photo mode off', '#ffd23f');
      }
      this.prevP = p;
      if (Camera.photo) {
        var target = Vehicle.isDriving() ? Vehicle.drivable : Player;
        Camera.update(dt, target, Vehicle.isDriving());
        this.updateHUD(dt);
        this.drawMinimap();
        this.renderer.render(this.scene, this.camera);
        if (!window.__shotReady) window.__shotReady = true;
        return;
      }

      // help panel toggle (edge, H) — only on foot; H is the horn in a car
      if (!Vehicle.isDriving() && Input.pressedAction('help')) {
        var hp = document.getElementById('help-panel');
        if (hp) hp.style.display = hp.style.display === 'none' ? 'block' : 'none';
      }
      // music toggle (edge, M)
      if (Input.pressedAction('music')) {
        var on = AudioSys.toggleMusic();
        HUD.toast(on ? 'Music on' : 'Music off', '#ffd23f');
      }
      // car radio (edge, Y): first press turns it on, then cycles stations
      var y = Input.actionDown('radio');
      if (y && !this.prevY) {
        var station = AudioSys.cycleRadio();
        HUD.toast('📻 ' + station, '#ffd23f');
      }
      this.prevY = y;
      // hail a taxi (edge, T) — on foot only, $20 a ride
      var tk = Input.actionDown('taxi');
      if (tk && !this.prevT && !Vehicle.isDriving()) {
        Traffic.tryHailTaxi(Player.x, Player.z);
      }
      this.prevT = tk;
      // rain toggle (edge, U)
      var u = Input.actionDown('rain');
      if (u && !this.prevU) {
        var rainOn = World.setRain(!World.raining);
        HUD.toast(rainOn ? 'Rain rolling in — roads are slick' : 'Rain stopped', '#3f8cff');
      }
      this.prevU = u;
      // day/night toggle (edge, I)
      var ik = Input.actionDown('dusk');
      if (ik && !this.prevI) {
        var duskOn = World.setDusk(!World.dusk);
        HUD.toast(duskOn ? 'Dusk — the lamps are coming on' : 'Back to daylight', '#ffd23f');
      }
      this.prevI = ik;
      // minimap zoom (edge, N): full city -> x2 -> x4 around the player
      if (Input.pressedAction('mapZoom')) {
        this.mapZoom = (this.mapZoom + 1) % 3;
        var zv = this.mapZoom === 0 ? 1 : this.mapZoom === 1 ? 2 : 4;
        HUD.toast('Map zoom ×' + zv, '#ffd23f');
      }

      // enter/exit car (edge)
      var e = Input.down('KeyE');
      if (e && !this.prevE) {
        var res = Vehicle.tryToggle(Player.x, Player.z);
        if (res) {
          if (res.entered) {
            Player.group.visible = false;
            AudioSys.blip(990);
            Police.onSteal();
          } else if (res.exited) {
            Player.x = res.x; Player.z = res.z;
            Player.y = 0; Player.vy = 0; Player.grounded = true;
            Player.group.position.set(res.x, 0, res.z);
            Player.group.visible = true;
            AudioSys.setEngine(0, false);
            AudioSys.blip(520);
          }
        } else {
          // E near a mission pickup (package / passenger / yacht papers)
          Missions.tryInteract();
        }
      }
      this.prevE = e;

      // retry a failed mission (edge)
      var r = Input.down('KeyR');
      if (r && !this.prevR && Missions.state === 'failed') Missions.startMission(Missions.active);
      this.prevR = r;

      // riding a taxi: the cab drives, Raka just rides along
      if (Traffic.ridingTaxi && Traffic.taxi) {
        Player.x = Traffic.taxi.x; Player.z = Traffic.taxi.z;
        Player.group.position.set(Player.x, 0, Player.z);
        AudioSys.setEngine(0.4, true);
      } else if (Vehicle.isDriving()) {
        if (!Vehicle.drivable.wrecked) Vehicle.update(dt, World.colliders);
        else { Vehicle.drivable.speed = 0; AudioSys.setEngine(0, false); }
        Player.x = Vehicle.drivable.x; Player.z = Vehicle.drivable.z;
      } else {
        Player.update(dt, Camera.yaw, World.colliders);
        AudioSys.setEngine(0, false);
      }
      Traffic.update(dt);
      Police.update(dt);
      Missions.update(dt);
      Combat.update(dt);
      World.update(dt);
      this.objective = this.computeObjective();
      var target2 = Vehicle.isDriving() ? Vehicle.drivable : Player;
      Camera.update(dt, target2, Vehicle.isDriving());
      this.updateHUD(dt);
      this.drawMinimap();
    } else if (this.state === 'paused') {
      var esc2 = Input.down('Escape');
      if (esc2 && !this.prevEsc) {
        this.state = 'playing';
        document.getElementById('pause-screen').style.display = 'none';
      }
      this.prevEsc = esc2;
    }

    this.renderer.render(this.scene, this.camera);
    if (!window.__shotReady) window.__shotReady = true;
  },

  updateHUD: function (dt) {
    HUD.update(dt);
  },

  drawMinimap: function () {
    var ctx = this.mmapCtx, S = 150;
    // view window: zoom 0 = the whole 600x600 city; zoom 1 = 300 units and
    // zoom 2 = 150 units, both centred on the player (N cycles the zoom)
    var span = this.mapZoom === 0 ? 600 : this.mapZoom === 1 ? 300 : 150;
    var k = S / span;
    var x0 = this.mapZoom === 0 ? -300 : Player.x - span / 2;
    var z0 = this.mapZoom === 0 ? -300 : Player.z - span / 2;
    var mx = function (x) { return (x - x0) * k; };
    var mz = function (z) { return (z - z0) * k; };
    ctx.fillStyle = '#10151c';
    ctx.fillRect(0, 0, S, S);
    // sea + beach
    ctx.fillStyle = '#2f7fc2';
    ctx.fillRect(0, mz(World.SEA_Z), S, S);
    ctx.fillStyle = '#d9c08a';
    ctx.fillRect(0, mz(World.BEACH_Z), S, (World.SEA_Z - World.BEACH_Z) * k);
    // harbor inlet (east edge)
    ctx.fillStyle = '#2a6ea8';
    ctx.fillRect(mx(World.harbor.x0), mz(World.harbor.z0),
      (World.harbor.x1 - World.harbor.x0) * k, (World.harbor.z1 - World.harbor.z0) * k);
    // park (green block)
    ctx.fillStyle = '#5a8f4a';
    ctx.fillRect(mx(World.park.x - World.park.s / 2), mz(World.park.z - World.park.s / 2),
      World.park.s * k, World.park.s * k);
    // old town plaza (stone circle, NW corner)
    ctx.fillStyle = '#9a938a';
    ctx.beginPath();
    ctx.arc(mx(World.oldTown.x), mz(World.oldTown.z), Math.max(2, 18 * k), 0, Math.PI * 2);
    ctx.fill();
    // pier + ferris wheel (harbor)
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(mx(245), mz(148), 55 * k, 4 * k);
    ctx.fillStyle = '#ff5d8f';
    ctx.beginPath();
    ctx.arc(mx(288), mz(150), 3, 0, Math.PI * 2);
    ctx.fill();
    // roads
    ctx.strokeStyle = '#555a63'; ctx.lineWidth = 2.5;
    var r;
    for (var i = 0; i < World.roads.length; i++) {
      r = World.roads[i];
      ctx.beginPath();
      if (r.horizontal) { ctx.moveTo(0, mz(r.v)); ctx.lineTo(S, mz(r.v)); }
      else { ctx.moveTo(mx(r.v), 0); ctx.lineTo(mx(r.v), S); }
      ctx.stroke();
    }
    // buildings
    ctx.fillStyle = '#8fa3b8';
    for (var j = 0; j < World.buildings.length; j++) {
      var b = World.buildings[j];
      var w = b.geometry.parameters.width, d = b.geometry.parameters.depth;
      ctx.fillRect(mx(b.position.x - w / 2), mz(b.position.z - d / 2), Math.max(1, w * k), Math.max(1, d * k));
    }
    // cars
    ctx.fillStyle = '#ffd23f';
    for (var c = 0; c < Vehicle.cars.length; c++) {
      var car = Vehicle.cars[c];
      ctx.beginPath();
      ctx.arc(mx(car.x), mz(car.z), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // player
    ctx.fillStyle = '#ff7b00';
    ctx.beginPath();
    ctx.arc(mx(Player.x), mz(Player.z), 3.5, 0, Math.PI * 2);
    ctx.fill();
    // mission / police / pickup blips (same view window)
    HUD.drawBlips(ctx, k, x0, z0);
    // north tick
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('N', 4, 12);
  }
};

window.addEventListener('load', function () { Game.init(); });
