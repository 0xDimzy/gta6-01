// main.js — Solmaris Bay entry point: renderer, wiring, and the game
// state machine.
//
// States are data, not branches: STATES maps every state to its enter
// hook and its per-frame update, so adding a state means adding a row.
// title -> playing -> paused -> playing, playing -> busted -> playing,
// playing -> mission-complete -> playing. The world only simulates in
// the states that say so: busted freezes it behind the BUSTED card,
// mission-complete keeps it running behind the summary card.
var Game = {
  // the state machine: enter runs once on arrival, update every frame
  STATES: {
    title: { enter: null, update: '_updateTitle', exit: null },
    playing: { enter: '_enterPlaying', update: '_updatePlaying', exit: null },
    paused: { enter: '_enterPaused', update: '_updatePaused', exit: '_exitPaused' },
    busted: { enter: '_enterBusted', update: '_updateBusted', exit: null },
    'mission-complete': { enter: '_enterMissionComplete', update: '_updateMissionComplete', exit: null }
  },
  state: 'title', // title | playing | paused | busted | mission-complete
  bustedT: 0, // seconds left on the BUSTED card before play resumes
  // difficulty rows: the longer the session runs, the harder the city
  // pushes back — cruisers get faster and arrive sooner, payouts grow
  DIFFICULTY: [
    { name: 'Rookie', fromMissions: 0, policeSpeed: 1.0, spawnScale: 1.0, payout: 1.0 },
    { name: 'Street', fromMissions: 2, policeSpeed: 1.08, spawnScale: 0.9, payout: 1.1 },
    { name: 'Veteran', fromMissions: 5, policeSpeed: 1.18, spawnScale: 0.78, payout: 1.25 }
  ],
  difficultyName: 'Rookie',
  difficultyTimer: 0, // re-apply the difficulty row once a second
  // auto quality ladder: if the frame rate sags, step the pixel ratio
  // down (and kill shadows at the bottom); if it recovers, step back up
  QUALITY_STEPS: [2, 1.5, 1.25, 1],
  qualityStep: 0,
  qualityBadT: 0, // consecutive slow seconds
  qualityGoodT: 0, // consecutive fast seconds
  // minimap districts: every rectangular feature on the map is one row
  // here — a new district is a new row, not a new block of canvas code
  MINIMAP_DISTRICTS: [
    { kind: 'rect', color: '#5a8f4a', get: function () { return [World.park.x - World.park.s / 2, World.park.z - World.park.s / 2, World.park.s, World.park.s]; } },
    { kind: 'rect', color: '#2e3138', get: function () { return [World.airport.x - 13, World.airport.z - 75, 26, 150]; } },
    { kind: 'rect', color: '#8a6f4d', get: function () { return [245, 148, 55, 4]; } },
    { kind: 'circle', color: '#9a938a', get: function () { return [World.oldTown.x, World.oldTown.z, 18]; } },
    { kind: 'circle', color: '#ffd23f', get: function () { return [World.airport.x - 22, World.airport.z - 62, 3]; } },
    { kind: 'circle', color: '#ff5d8f', get: function () { return [288, 150, 3]; } }
  ],
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
  prevO: false, // drone-camera edge (O)
  fpsFrames: 0, // frames counted in the current FPS window
  fpsT: 0, // seconds accumulated in the current FPS window
  fpsEl: null, // FPS counter readout, top-left under the objective
  statsEl: null, // session-stats readout inside the pause screen
  money: 1250,
  health: 100,
  wanted: 0,
  objective: 'Steal a car — walk to the yellow coupe and press E',
  minimap: null,
  mmapCtx: null,
  demoMode: '',
  mapZoom: 0, // minimap zoom level: 0 = whole city, 1 = x2, 2 = x4 (N cycles)
  // session stats: the run's own ledger — other systems write into it
  // (Combat counts shots, Missions counts jobs and cash, Police counts
  // arrests) and the pause screen reads it back
  stats: { startedAt: 0, playTime: 0, shotsFired: 0, missionsDone: 0, cashEarned: 0, arrests: 0, carsStolen: 0, distanceDriven: 0 },

  // move to a new state: exit hook, switch, enter hook — never assign
  // this.state directly outside this function
  _setState: function (next) {
    if (next === this.state) return;
    var cur = this.STATES[this.state];
    if (cur && cur.exit) this[cur.exit]();
    this.state = next;
    var row = this.STATES[next];
    if (row && row.enter) this[row.enter]();
  },

  // called by Police.busted(): the cops caught Raka — freeze the world
  // behind the BUSTED card for 2.2 s, then drop back into the city
  onBusted: function () {
    this._setState('busted');
  },

  _enterPlaying: function () {
    // clear every edge latch so a key held through the transition does
    // not fire twice on the first frame back
    this.prevE = this.prevEsc = this.prevR = this.prevP = false;
    this.prevY = this.prevT = this.prevU = this.prevI = this.prevO = false;
  },

  _enterPaused: function () {
    document.getElementById('pause-screen').style.display = 'flex';
    this._renderStats();
  },

  _exitPaused: function () {
    document.getElementById('pause-screen').style.display = 'none';
  },

  _enterBusted: function () {
    this.bustedT = 2.2; // matches the HUD BUSTED card's own timer
    this._enterPlaying(); // clear edge latches for the resume
  },

  _enterMissionComplete: function () {
    // the summary card is already up (HUD showed it on completion);
    // this state just owns the 2.5 s the card stays on screen
  },

  // the difficulty row for this session, from missions completed — and
  // push it into the systems that feel it: cruiser speed, spawn rate,
  // mission payouts. A rank-up gets a toast so the player feels it.
  _applyDifficulty: function () {
    var done = this.stats.missionsDone;
    var row = this.DIFFICULTY[0];
    for (var i = 0; i < this.DIFFICULTY.length; i++) {
      if (done >= this.DIFFICULTY[i].fromMissions) row = this.DIFFICULTY[i];
    }
    if (row.name !== this.difficultyName) {
      this.difficultyName = row.name;
      HUD.toast('Heat rising — the city plays ' + row.name + ' now', '#ff8844');
    }
    Police.difficultyScale = row.policeSpeed;
    Police.spawnScale = row.spawnScale;
    Missions.payoutScale = row.payout;
  },

  // auto quality: three slow seconds step the pixel ratio down, ten fast
  // seconds step it back up. Shadows die at the bottom step only.
  _autoQuality: function (fps) {
    if (fps < 30) {
      this.qualityBadT += 1;
      this.qualityGoodT = 0;
      if (this.qualityBadT >= 3 && this.qualityStep < this.QUALITY_STEPS.length - 1) {
        this.qualityBadT = 0;
        this._setQualityStep(this.qualityStep + 1);
      }
    } else if (fps > 55) {
      this.qualityGoodT += 1;
      this.qualityBadT = 0;
      if (this.qualityGoodT >= 10 && this.qualityStep > 0) {
        this.qualityGoodT = 0;
        this._setQualityStep(this.qualityStep - 1);
      }
    } else {
      this.qualityBadT = 0;
      this.qualityGoodT = 0;
    }
  },

  _setQualityStep: function (step) {
    this.qualityStep = step;
    var ratio = this.QUALITY_STEPS[step];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, ratio));
    var shadows = step < this.QUALITY_STEPS.length - 1;
    if (this.renderer.shadowMap.enabled !== shadows) {
      this.renderer.shadowMap.enabled = shadows;
      this.scene.traverse(function (obj) {
        if (obj.material) obj.material.needsUpdate = true;
      });
    }
    HUD.toast(shadows ? 'Quality stepped up' : 'Quality stepped down to keep it smooth', '#ffd23f');
  },

  // write the session ledger into the pause screen
  _renderStats: function () {
    if (!this.statsEl) return;
    var s = this.stats;
    var mins = Math.floor(s.playTime / 60);
    var secs = Math.floor(s.playTime % 60);
    this.statsEl.innerHTML =
      'SESSION — ' + mins + ':' + (secs < 10 ? '0' : '') + secs +
      ' &nbsp;·&nbsp; ' + s.missionsDone + ' jobs &nbsp;·&nbsp; $' + s.cashEarned.toLocaleString() + ' earned' +
      '<br>' + s.shotsFired + ' shots &nbsp;·&nbsp; ' + s.arrests + ' arrests &nbsp;·&nbsp; ' +
      s.carsStolen + ' cars &nbsp;·&nbsp; ' + Math.round(s.distanceDriven) + ' m driven' +
      '<br>Difficulty: ' + this.difficultyName;
  },

  init: function () {
    var params = new URLSearchParams(window.location.search);
    var demo = params.get('demo') || '';
    this.demoMode = demo;
    this.stats.startedAt = Date.now();

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

    this._setupDemo(demo);
    this._setupUI();

    this.minimap = document.getElementById('minimap');
    this.mmapCtx = this.minimap.getContext('2d');

    // FPS counter: a small readout under the objective, updated once a
    // second — the honest way to tell whether the city is too heavy
    var fps = document.createElement('div');
    fps.id = 'hud-fps';
    fps.textContent = '-- FPS';
    fps.style.cssText = 'position:absolute;left:18px;top:120px;font-size:14px;font-weight:700;color:rgba(255,255,255,.8);text-shadow:0 1px 2px #000;z-index:5;pointer-events:none';
    document.body.appendChild(fps);
    this.fpsEl = fps;

    this.loop();
  },

  // demo modes skip the title screen — one branch per screenshot mode
  _setupDemo: function (demo) {
    if (demo === 'drive' || demo === 'chase') {
      Vehicle.current = Vehicle.drivable;
      Player.group.visible = false;
      Player.x = Vehicle.drivable.x; Player.z = Vehicle.drivable.z;
      this._setState('playing');
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
      this._setState('playing');
      document.getElementById('title-screen').style.display = 'none';
      Missions.startMission(0);
    } else if (demo === 'mission') {
      this._setState('playing');
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
  },

  // all DOM wiring: title click, pause restart, settings, resize, audio
  _setupUI: function () {
    var self = this;
    document.getElementById('title-screen').addEventListener('click', function () {
      AudioSys.init(); AudioSys.resume(); AudioSys.startMusic(); AudioSys.startAmbient();
      document.getElementById('title-screen').style.display = 'none';
      self._setState('playing');
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
        self._setState('playing');
        HUD.toast('Mission restarted: ' + Missions.defs[idx].name, '#ffd23f');
      });
    }
    // session stats live inside the pause screen, under the buttons
    var pauseScreen = document.getElementById('pause-screen');
    if (pauseScreen) {
      var stats = document.createElement('div');
      stats.id = 'session-stats';
      stats.style.cssText = 'margin-top:18px;font-size:14px;line-height:1.8;color:rgba(255,255,255,.75);text-align:center';
      pauseScreen.appendChild(stats);
      this.statsEl = stats;
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
  },

  computeObjective: function () {
    var mo = Missions.getObjective();
    if (mo) return mo;
    if (this.demoMode === 'chase') return 'Lose the heat — break line of sight from the police';
    if (Vehicle.isDriving() && Vehicle.drivable.wrecked) return 'Your car is wrecked — press E to get out';
    if (Vehicle.isDriving()) return 'Drive the coupe — WASD to drive, Space to handbrake';
    return 'On foot — find your next ride, press E near a car';
  },

  loop: function () {
    var self = this;
    requestAnimationFrame(function () { self.loop(); });
    // last-stand slow-mo: the whole world runs at half speed while it lasts
    var rawDt = Math.min(this.clock.getDelta(), 0.05);
    var dt = rawDt * (Combat.timeScale || 1);
    // FPS counter: count every frame, report once a second, and feed the
    // auto-quality ladder with the same number
    this.fpsFrames++;
    this.fpsT += rawDt;
    if (this.fpsT >= 1) {
      var fps = this.fpsFrames / this.fpsT;
      if (this.fpsEl) this.fpsEl.textContent = Math.round(fps) + ' FPS';
      this.fpsFrames = 0;
      this.fpsT = 0;
      this._autoQuality(fps);
    }
    // dispatch to the current state's update — the state machine owns
    // what runs each frame, this loop only owns the clock and the render
    var st = this.STATES[this.state];
    if (st && st.update) this[st.update](dt);
    this.renderer.render(this.scene, this.camera);
    if (!window.__shotReady) window.__shotReady = true;
  },

  // title: a cinematic orbit over the city behind the title screen
  _updateTitle: function (dt) {
    Camera.intro(dt);
    Traffic.update(dt);
    World.update(dt);
  },

  // the one shared simulation step: move the player or the car, then
  // every system in dependency order, then camera + HUD + minimap
  _updateWorld: function (dt) {
    // riding a taxi: the cab drives, Raka just rides along
    if (Traffic.ridingTaxi && Traffic.taxi) {
      Player.x = Traffic.taxi.x; Player.z = Traffic.taxi.z;
      Player.group.position.set(Player.x, 0, Player.z);
      AudioSys.setEngine(0.4, true);
    } else if (Vehicle.isDriving()) {
      if (!Vehicle.drivable.wrecked) Vehicle.update(dt, World.colliders);
      else { Vehicle.drivable.speed = 0; AudioSys.setEngine(0, false); }
      Player.x = Vehicle.drivable.x; Player.z = Vehicle.drivable.z;
      this.stats.distanceDriven += Math.abs(Vehicle.drivable.speed) * dt;
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
    var target = Vehicle.isDriving() ? Vehicle.drivable : Player;
    Camera.update(dt, target, Vehicle.isDriving());
    this.updateHUD(dt);
    this.drawMinimap();
    // difficulty re-applies once a second, from missions completed
    this.difficultyTimer += dt;
    if (this.difficultyTimer >= 1) {
      this.difficultyTimer = 0;
      this._applyDifficulty();
    }
  },

  // playing: every edge-triggered toggle lives here, then the world step
  _updatePlaying: function (dt) {
    this.stats.playTime += dt;
    // gamepad: poll once per frame so sticks + buttons stay fresh
    Input.pollPad();
    // pause toggle (edge)
    var esc = Input.down('Escape');
    if (esc && !this.prevEsc) this._setState('paused');
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
      return;
    }

    // drone camera (edge, O): a high bird's-eye orbit over the action —
    // the world keeps running, you just watch it from above
    var od = Input.actionDown('drone');
    if (od && !this.prevO) {
      var droneOn = Camera.toggleDrone();
      HUD.toast(droneOn ? 'Drone cam — the whole bay from above' : 'Drone cam off', '#3f8cff');
    }
    this.prevO = od;

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
          this.stats.carsStolen++;
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

    this._updateWorld(dt);
    // a finished mission hands the game to the summary state
    if (Missions.state === 'done') this._setState('mission-complete');
  },

  // paused: only Esc resumes — the world is frozen behind the menu
  _updatePaused: function (dt) {
    var esc = Input.down('Escape');
    if (esc && !this.prevEsc) this._setState('playing');
    this.prevEsc = esc;
  },

  // busted: the world stays frozen behind the BUSTED card; when the
  // card's timer runs out, Raka is back on the street downtown
  _updateBusted: function (dt) {
    this.bustedT -= dt;
    if (this.bustedT <= 0) this._setState('playing');
  },

  // mission-complete: the world keeps running behind the summary card;
  // when the mission engine moves on to the next job, play resumes
  _updateMissionComplete: function (dt) {
    this._updateWorld(dt);
    if (Missions.state !== 'done') this._setState('playing');
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
    // sea + beach + harbor inlet (east edge)
    ctx.fillStyle = '#2f7fc2';
    ctx.fillRect(0, mz(World.SEA_Z), S, S);
    ctx.fillStyle = '#d9c08a';
    ctx.fillRect(0, mz(World.BEACH_Z), S, (World.SEA_Z - World.BEACH_Z) * k);
    ctx.fillStyle = '#2a6ea8';
    ctx.fillRect(mx(World.harbor.x0), mz(World.harbor.z0),
      (World.harbor.x1 - World.harbor.x0) * k, (World.harbor.z1 - World.harbor.z0) * k);
    // districts from the table: park, runway, pier, old-town plaza,
    // control tower, ferris wheel — one row each, drawn by kind
    for (var d = 0; d < this.MINIMAP_DISTRICTS.length; d++) {
      var dist = this.MINIMAP_DISTRICTS[d];
      var box = dist.get();
      ctx.fillStyle = dist.color;
      if (dist.kind === 'rect') {
        ctx.fillRect(mx(box[0]), mz(box[1]), Math.max(1, box[2] * k), Math.max(1, box[3] * k));
      } else {
        ctx.beginPath();
        ctx.arc(mx(box[0]), mz(box[1]), Math.max(2, box[2] * k), 0, Math.PI * 2);
        ctx.fill();
      }
    }
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
      var w = b.geometry.parameters.width, dep = b.geometry.parameters.depth;
      ctx.fillRect(mx(b.position.x - w / 2), mz(b.position.z - dep / 2), Math.max(1, w * k), Math.max(1, dep * k));
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
