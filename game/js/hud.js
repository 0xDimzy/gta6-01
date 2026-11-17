// hud.js — owns all HUD updates: money, health, stamina, wanted stars,
// wanted-decay bar, speed + gauge needle, mission timer, objective,
// story subtitle, hints, ammo, crosshair, toasts, summary + busted
// screens, minimap blips, cash ticker, heat-meter arc, damage direction
var HUD = {
  moneyEl: null,
  healthFill: null,
  staminaFill: null,
  starsEl: null,
  decayFill: null,
  objEl: null,
  hintEl: null,
  speedEl: null,
  needleEl: null,
  timerEl: null,
  storyEl: null,
  storyTimer: 0,
  ammoEl: null,
  crossEl: null,
  toastEl: null,
  toastTimer: 0,
  summaryEl: null,
  summaryTimer: 0,
  bustedEl: null,
  bustedTimer: 0,
  vignetteEl: null, // low-health red pulse overlay
  zoomEl: null,     // minimap zoom readout
  dmgEl: null,      // damage-direction arrow (points at the last hit source)
  dmgT: 0,          // seconds the damage arrow stays visible
  dmgX: 0, dmgZ: 0, // world position of the last damage source
  displayedMoney: 1250, // cash ticker: counts toward Game.money
  time: 0,

  init: function () {
    this.moneyEl = document.getElementById('hud-money');
    this.healthFill = document.getElementById('hud-health-fill');
    this.staminaFill = document.getElementById('hud-stamina-fill');
    this.starsEl = document.getElementById('hud-stars');
    this.decayFill = document.getElementById('hud-decay-fill');
    this.objEl = document.getElementById('hud-objective');
    this.hintEl = document.getElementById('hud-hint');
    this.speedEl = document.getElementById('hud-speed');
    this.needleEl = document.getElementById('hud-needle');
    this.timerEl = document.getElementById('hud-timer');
    this.storyEl = document.getElementById('hud-story');
    this.summaryEl = document.getElementById('mission-screen');
    this.bustedEl = document.getElementById('busted-screen');
    this.vignetteEl = document.getElementById('hud-vignette');
    this.zoomEl = document.getElementById('hud-zoom');
    // ammo readout (created dynamically)
    var ammo = document.createElement('div');
    ammo.id = 'hud-ammo';
    ammo.style.cssText = 'position:absolute;right:18px;bottom:212px;font-size:19px;font-weight:800;color:#ffd23f;text-shadow:0 1px 3px rgba(0,0,0,.8);z-index:5;pointer-events:none;display:none';
    document.body.appendChild(ammo);
    this.ammoEl = ammo;
    // crosshair (created dynamically)
    var cross = document.createElement('div');
    cross.id = 'hud-crosshair';
    cross.textContent = '+';
    cross.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:26px;font-weight:900;color:#fff;text-shadow:0 0 4px #000;z-index:5;pointer-events:none;display:none';
    document.body.appendChild(cross);
    this.crossEl = cross;
    // toast banner (created dynamically)
    var toast = document.createElement('div');
    toast.id = 'hud-toast';
    toast.style.cssText = 'position:absolute;left:50%;top:18%;transform:translateX(-50%);font-size:22px;font-weight:800;color:#fff;background:rgba(0,0,0,.65);padding:10px 22px;border-radius:8px;z-index:6;pointer-events:none;opacity:0;transition:opacity .25s;text-shadow:0 1px 3px #000;white-space:nowrap';
    document.body.appendChild(toast);
    this.toastEl = toast;
    // damage-direction arrow: a red chevron that sits on a ring around
    // the screen centre and points at whatever just hurt you
    var dmg = document.createElement('div');
    dmg.id = 'hud-damage';
    dmg.textContent = '➤';
    dmg.style.cssText = 'position:absolute;left:50%;top:50%;font-size:34px;font-weight:900;color:#ff4444;text-shadow:0 0 8px #ff0000,0 0 2px #000;z-index:6;pointer-events:none;opacity:0;transform:translate(-50%,-50%)';
    document.body.appendChild(dmg);
    this.dmgEl = dmg;
    // react to mission events via the bus (story + summary are also
    // driven directly by Missions, this keeps the wiring explicit)
    var self = this;
    SBBus.on('mission-complete', function (def) { self.showSummary(def, Game.money, Missions.lastPayout); });
  },

  toast: function (msg, color) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.style.borderLeft = '4px solid ' + (color || '#ff7b00');
    this.toastEl.style.opacity = '1';
    this.toastTimer = 2.6;
  },

  // remember where the last hit came from so the arrow can point at it;
  // police rams and traffic hits call this with the attacker's position
  damageFrom: function (x, z) {
    this.dmgX = x; this.dmgZ = z;
    this.dmgT = 1.5;
    if (this.dmgEl) this.dmgEl.style.opacity = '1';
  },

  // story subtitle: one line of the Raka storyline, shown at mission start
  showStory: function (msg) {
    if (!this.storyEl) return;
    this.storyEl.textContent = msg;
    this.storyEl.style.opacity = '1';
    this.storyTimer = 5;
  },

  // mission-complete summary card: job, payout breakdown, running total
  showSummary: function (def, money, payout) {
    if (!this.summaryEl) return;
    var name = this.summaryEl.querySelector('.sum-name');
    var reward = this.summaryEl.querySelector('.sum-reward');
    var total = this.summaryEl.querySelector('.sum-total');
    var bonus = this.summaryEl.querySelector('.sum-bonus');
    if (name) name.textContent = def.name;
    if (reward) reward.textContent = '+$' + (payout ? payout.total : def.reward).toLocaleString('en-US');
    if (bonus) {
      if (payout && payout.bonus > 0) {
        bonus.textContent = payout.bonusText || ('Clean getaway bonus +$' + payout.bonus + ' — finished at full health');
        bonus.style.display = 'block';
      } else bonus.style.display = 'none';
    }
    if (total) total.textContent = 'Total cash: ' + SBUtils.formatMoney(money);
    this.summaryEl.style.display = 'flex';
    this.summaryTimer = 2.5;
  },

  // full-screen BUSTED card when the cops catch Raka
  showBusted: function () {
    if (!this.bustedEl) return;
    this.bustedEl.style.display = 'flex';
    this.bustedTimer = 2.2;
  },

  update: function (dt) {
    this.time += dt;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.style.opacity = '0';
    }
    if (this.storyTimer > 0) {
      this.storyTimer -= dt;
      if (this.storyTimer <= 0) this.storyEl.style.opacity = '0';
    }
    if (this.summaryTimer > 0) {
      this.summaryTimer -= dt;
      if (this.summaryTimer <= 0) this.summaryEl.style.display = 'none';
    }
    if (this.bustedTimer > 0) {
      this.bustedTimer -= dt;
      if (this.bustedTimer <= 0) this.bustedEl.style.display = 'none';
    }
    // cash ticker: the money count rolls toward the real total instead
    // of jumping, so payouts feel like money landing
    var target = Game.money;
    if (this.displayedMoney !== target) {
      var diff = target - this.displayedMoney;
      this.displayedMoney += diff * Math.min(1, dt * 8);
      if (Math.abs(target - this.displayedMoney) < 1) this.displayedMoney = target;
      this.moneyEl.textContent = SBUtils.formatMoney(Math.round(this.displayedMoney));
    }
    // damage-direction arrow: angle from the player to the hit source,
    // relative to where the camera is looking; the arrow rides a ring
    // around the screen centre and points outward at the threat
    if (this.dmgT > 0) {
      this.dmgT -= dt;
      if (this.dmgEl) {
        var dx = this.dmgX - Player.x, dz = this.dmgZ - Player.z;
        var worldAng = Math.atan2(dx, dz);
        // camera forward in world space: camera sits behind the orbit yaw
        var fwdAng = Camera.yaw + Math.PI;
        var rel = SBUtils.clampAngle(worldAng - fwdAng);
        // screen ring: 38% of the smaller screen dimension out from centre
        var rx = Math.sin(rel) * 38, ry = -Math.cos(rel) * 38;
        this.dmgEl.style.left = (50 + rx * 0.9) + '%';
        this.dmgEl.style.top = (50 + ry * 0.9) + '%';
        // the chevron glyph points right at 0deg; rotate so it points
        // outward along the ring (rel 0 = ahead = up on screen)
        var deg = rel * 180 / Math.PI - 90;
        this.dmgEl.style.transform = 'translate(-50%,-50%) rotate(' + deg + 'deg)';
        this.dmgEl.style.opacity = String(SBUtils.clamp01(this.dmgT / 0.5));
        if (this.dmgT <= 0) this.dmgEl.style.opacity = '0';
      }
    }
    this.healthFill.style.width = SBUtils.clamp(Game.health, 0, 100) + '%';
    // low-health vignette: red pulse closing in under 30 HP
    if (this.vignetteEl) {
      if (Game.health < 30 && Game.health > 0) {
        this.vignetteEl.style.opacity = String(0.22 + 0.13 * Math.sin(this.time * 6));
      } else this.vignetteEl.style.opacity = '0';
    }
    // minimap zoom readout (N cycles x1 / x2 / x4)
    if (this.zoomEl) {
      var z = Game.mapZoom || 0;
      this.zoomEl.textContent = 'MAP ×' + (z === 0 ? 1 : z === 1 ? 2 : 4);
    }
    // stamina bar: green while fresh, orange when winded
    if (this.staminaFill) {
      this.staminaFill.style.width = SBUtils.clamp(Player.stamina, 0, 100) + '%';
      this.staminaFill.style.background = Player.exhausted ? '#ff8844' : '#7dff9a';
    }
    var w = Police.getWanted(), stars = '';
    for (var i = 0; i < 5; i++) stars += i < w ? '★' : '☆';
    this.starsEl.textContent = stars;
    // wanted-decay bar: fills as the heat cools off, one star at a time
    if (this.decayFill) {
      this.decayFill.style.width = Math.round(Police.getDecayProgress() * 100) + '%';
      this.decayFill.parentNode.style.opacity = w > 0 ? '1' : '0.25';
    }
    var car = Vehicle.current || Vehicle.drivable;
    var sp = Vehicle.isDriving() ? Math.abs(car.speed) * 3.6 : Player.speed * 3.6;
    this.speedEl.textContent = Math.round(sp) + ' km/h';
    // speedometer needle: 0..140 km/h sweeps -120..+120 degrees
    if (this.needleEl) {
      var ang = -120 + SBUtils.clamp(sp / 140, 0, 1) * 240;
      this.needleEl.style.transform = 'rotate(' + ang + 'deg)';
    }
    // mission timer, during the timed legs (Getaway Driver + Harbor Heist)
    if (this.timerEl) {
      var timed = Missions.state === 'active' && Missions.step === 1 && (Missions.active === 3 || Missions.active === 4);
      if (timed) {
        this.timerEl.style.display = 'block';
        var t = Math.max(0, Math.ceil(Missions.timer));
        this.timerEl.textContent = '⏱ ' + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
        this.timerEl.style.color = t <= 15 ? '#ff4444' : '#ffd23f';
      } else {
        this.timerEl.style.display = 'none';
      }
    }
    this.objEl.textContent = Game.objective;
    this.hintEl.textContent = Vehicle.isDriving()
      ? 'W/S drive · A/D steer · Space handbrake · Shift nitro · E exit · H horn · B roof · Esc pause'
      : (Combat.armed
        ? 'WASD move · Shift run · C crouch · V shove · E enter car · F weapon · Q switch · Click shoot · T taxi · P photo · Esc pause'
        : 'WASD move · Shift run · C crouch · E enter car · T taxi · P photo · Esc pause');
    if (Combat.armed && !Vehicle.isDriving()) {
      this.ammoEl.style.display = 'block';
      var label = Combat.weapon === 'shotgun'
        ? '🔫 SHOTGUN ' + Combat.shells + ' shells'
        : '🔫 PISTOL ' + Combat.ammo + ' / 12';
      this.ammoEl.textContent = label + (Combat.hasShotgun ? '  (Q switch)' : '');
      this.crossEl.style.display = 'block';
      // crosshair sway: it drifts with movement and kicks up on every shot
      var swayX = Math.sin(this.time * 2.2) * (Player.moving ? 5 : 2);
      var swayY = Math.cos(this.time * 1.7) * (Player.moving ? 4 : 2) - Combat.recoil * 22;
      this.crossEl.style.transform = 'translate(-50%,-50%) translate(' + swayX.toFixed(1) + 'px,' + swayY.toFixed(1) + 'px)';
    } else {
      this.ammoEl.style.display = 'none';
      this.crossEl.style.display = 'none';
    }
  },

  // mission + police + pickup blips, drawn on top of the base minimap.
  // k is px per world unit; (x0, z0) is the world-space top-left of the
  // current minimap view (changes with the N-key zoom, main.js owns it).
  drawBlips: function (ctx, k, x0, z0) {
    var mx = function (x) { return (x - x0) * k; };
    var mz = function (z) { return (z - z0) * k; };
    var blip = Missions.getBlip();
    if (blip) {
      var pulse = 4 + Math.sin(Missions.time * 4) * 1.5;
      ctx.fillStyle = blip.color;
      ctx.beginPath();
      ctx.arc(mx(blip.x), mz(blip.z), pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx(blip.x), mz(blip.z), pulse + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    // police cars: flashing blue/red dots
    for (var i = 0; i < Police.cars.length; i++) {
      var c = Police.cars[i];
      ctx.fillStyle = (Math.floor(Police.time * 3.5) % 2 === 0) ? '#3f8cff' : '#ff4444';
      ctx.beginPath();
      ctx.arc(mx(c.x), mz(c.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // police helicopter: a white dot with a ring, high above the chase
    if (Police.heli) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(mx(Police.heli.x), mz(Police.heli.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mx(Police.heli.x), mz(Police.heli.z), 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    // roadblock cruisers: red squares
    for (var r = 0; r < Police.roadblocks.length; r++) {
      var rb = Police.roadblocks[r];
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(mx(rb.x) - 3, mz(rb.z) - 3, 6, 6);
    }
    // weapon pickup
    if (!Combat.pickupTaken) {
      ctx.fillStyle = '#7dff9a';
      ctx.beginPath();
      ctx.arc(mx(20), mz(-20), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // shotgun pickup
    if (!Combat.shotgunTaken) {
      ctx.fillStyle = '#ff8844';
      ctx.beginPath();
      ctx.arc(mx(-140), mz(-100), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // ammo boxes (only while available)
    for (var a = 0; a < Combat.ammoBoxes.length; a++) {
      var ab = Combat.ammoBoxes[a];
      if (ab.taken) continue;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(mx(ab.x), mz(ab.z), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // city bus: teal dot
    if (Traffic.bus) {
      ctx.fillStyle = '#2a9d8f';
      ctx.beginPath();
      ctx.arc(mx(Traffic.bus.x), mz(Traffic.bus.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // taxi: yellow dot
    if (Traffic.taxi) {
      ctx.fillStyle = '#f2c500';
      ctx.beginPath();
      ctx.arc(mx(Traffic.taxi.x), mz(Traffic.taxi.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // heat-meter arc around the minimap edge: a red ring that fills with
    // the wanted level, so the heat is visible without reading the stars
    var S = ctx.canvas.width;
    var cx = S / 2, cy = S / 2, rad = S / 2 - 2;
    var w = Police.getWanted();
    if (w > 0) {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + (w / 5) * Math.PI * 2);
      ctx.stroke();
      // inner arc: heat-cooling progress toward dropping the next star
      var prog = Police.getDecayProgress();
      if (prog > 0) {
        ctx.strokeStyle = '#3f8cff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, rad - 5, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        ctx.stroke();
      }
    }
  }
};
