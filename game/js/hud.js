// hud.js — owns all HUD updates: money, health, stamina...
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
  vignetteEl: null,
  zoomEl: null,
  dmgEl: null,
  dmgT: 0,
  dmgX: 0, dmgZ: 0,
  radioEl: null,
  timerBarEl: null,
  timerBarFill: null,
  legendEl: null,
  displayedMoney: 1250,
  time: 0,
  fpsEl: null,
  fpsValue: 0,
  objDetailEl: null,
  streakEl: null,
  streak: 0,
  streakTimer: 0,
  flashEl: null,
  flashTimer: 0,
  flashColor: '#ff2222',
  lastWanted: 0,
  starPopT: 0,

  // ---- panel pipeline: [name, fn]. update() runs them i...
  PANELS: [
    'timers', 'money', 'damage', 'health', 'stamina', 'stars',
    'speed', 'timer', 'radio', 'objective', 'hints', 'ammo',
    'fps', 'streak', 'flash'
  ],

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
    // damage-direction arrow: a red chevron that sits on a...
    var dmg = document.createElement('div');
    dmg.id = 'hud-damage';
    dmg.textContent = '➤';
    dmg.style.cssText = 'position:absolute;left:50%;top:50%;font-size:34px;font-weight:900;color:#ff4444;text-shadow:0 0 8px #ff0000,0 0 2px #000;z-index:6;pointer-events:none;opacity:0;transform:translate(-50%,-50%)';
    document.body.appendChild(dmg);
    this.dmgEl = dmg;
    // radio station chip: shows which BAY FM station is pla...
    var radio = document.createElement('div');
    radio.id = 'hud-radio';
    radio.style.cssText = 'position:absolute;right:18px;top:96px;font-size:15px;font-weight:700;color:#cfe8ff;background:rgba(0,0,0,.55);padding:5px 10px;border-radius:6px;z-index:5;pointer-events:none;display:none;text-shadow:0 1px 2px #000';
    document.body.appendChild(radio);
    this.radioEl = radio;
    // mission timer bar: a thin bar under the timer text th...
    var tbar = document.createElement('div');
    tbar.id = 'hud-timerbar';
    tbar.style.cssText = 'position:absolute;left:50%;top:118px;transform:translateX(-50%);width:140px;height:6px;background:rgba(0,0,0,.55);border-radius:3px;z-index:5;pointer-events:none;display:none';
    var tfill = document.createElement('div');
    tfill.id = 'hud-timerbar-fill';
    tfill.style.cssText = 'height:100%;width:100%;background:#ffd23f;border-radius:3px';
    tbar.appendChild(tfill);
    document.body.appendChild(tbar);
    this.timerBarEl = tbar;
    this.timerBarFill = tfill;
    // minimap legend: a one-line key under the minimap so a...
    var legend = document.createElement('div');
    legend.id = 'hud-legend';
    legend.textContent = '● mission  ● police  ○ heli  ■ roadblock  ● bus  ● taxi  ● boat  ● sniper';
    legend.style.cssText = 'position:absolute;right:18px;top:130px;font-size:11px;color:rgba(255,255,255,.75);text-shadow:0 1px 2px #000;z-index:5;pointer-events:none;text-align:right';
    document.body.appendChild(legend);
    this.legendEl = legend;
    // FPS readout: owned by main.js (it creates #hud-fps an...
    this.fpsEl = null;
    // objective detail: live distance to the mission beacon...
    var objDetail = document.createElement('div');
    objDetail.id = 'hud-obj-detail';
    objDetail.style.cssText = 'position:absolute;left:16px;bottom:92px;font-size:12px;color:#ffd23f;text-shadow:0 1px 2px #000;z-index:5;pointer-events:none;display:none';
    document.body.appendChild(objDetail);
    this.objDetailEl = objDetail;
    // payout streak chip: consecutive clean jobs in a row,...
    var streak = document.createElement('div');
    streak.id = 'hud-streak';
    streak.style.cssText = 'position:absolute;left:16px;top:96px;font-size:15px;font-weight:800;color:#7dff9a;background:rgba(0,0,0,.55);padding:5px 10px;border-radius:6px;z-index:5;pointer-events:none;display:none;text-shadow:0 1px 2px #000';
    document.body.appendChild(streak);
    this.streakEl = streak;
    // full-screen flash: red on a hard hit, green on a payo...
    var flash = document.createElement('div');
    flash.id = 'hud-flash';
    flash.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:4;opacity:0;background:#ff2222';
    document.body.appendChild(flash);
    this.flashEl = flash;
    // react to mission events via the bus (story + summary...
    var self = this;
    SBBus.on('mission-complete', function (def) { self._onMissionComplete(def); });
    SBBus.on('mission-fail', function () { self.streak = 0; });
  },

  toast: function (msg, color) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.style.borderLeft = '4px solid ' + (color || '#ff7b00');
    this.toastEl.style.opacity = '1';
    this.toastTimer = 2.6;
  },

  // remember where the last hit came from so the arrow ca...
  damageFrom: function (x, z) {
    this.dmgX = x; this.dmgZ = z;
    this.dmgT = 1.5;
    if (this.dmgEl) this.dmgEl.style.opacity = '1';
    this.flash('#ff2222', 0.35);
  },

  // full-screen colour wash for a fixed time: red on dama...
  flash: function (color, seconds) {
    if (!this.flashEl) return;
    this.flashColor = color || '#ff2222';
    this.flashEl.style.background = this.flashColor;
    this.flashTimer = seconds || 0.3;
    this.flashEl.style.opacity = '0.28';
  },

  // main.js calls this once a second with the measured fr...
  setFps: function (fps) {
    this.fpsValue = Math.round(fps);
  },

  // mission-complete bookkeeping: clean jobs grow the str...
  _onMissionComplete: function (def) {
    if (Game.health >= 100) {
      this.streak += 1;
      this.streakTimer = 4;
      if (this.streakEl) {
        this.streakEl.textContent = '🔥 ' + this.streak + ' clean job' + (this.streak > 1 ? 's' : '') + ' in a row';
        this.streakEl.style.display = 'block';
      }
    } else {
      this.streak = 0;
      if (this.streakEl) this.streakEl.style.display = 'none';
    }
    this.flash('#2aff7a', 0.3);
  },

  // story subtitle: one line of the Raka storyline, shown...
  showStory: function (msg) {
    if (!this.storyEl) return;
    this.storyEl.textContent = msg;
    this.storyEl.style.opacity = '1';
    this.storyTimer = 5;
  },

  // mission-complete summary card: job, payout breakdown,...
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
    this.streak = 0;
    if (this.streakEl) this.streakEl.style.display = 'none';
  },

  // ---- panel functions: one per visible element. update...
  _panelTimers: function (dt) {
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
    if (this.streakTimer > 0) {
      this.streakTimer -= dt;
      if (this.streakTimer <= 0 && this.streakEl) this.streakEl.style.display = 'none';
    }
  },
  _panelMoney: function (dt) {
    // cash ticker: the money count rolls toward the real to...
    var target = Game.money;
    if (this.displayedMoney !== target) {
      var diff = target - this.displayedMoney;
      this.displayedMoney += diff * Math.min(1, dt * 8);
      if (Math.abs(target - this.displayedMoney) < 1) this.displayedMoney = target;
      this.moneyEl.textContent = SBUtils.formatMoney(Math.round(this.displayedMoney));
    }
  },
  _panelDamage: function (dt) {
    // damage-direction arrow: angle from the player to the...
    if (this.dmgT > 0) {
      this.dmgT -= dt;
      if (this.dmgEl) {
        var dx = this.dmgX - Player.x, dz = this.dmgZ - Player.z;
        var worldAng = Math.atan2(dx, dz);
        // camera forward in world space: camera sits behind the...
        var fwdAng = Camera.yaw + Math.PI;
        var rel = SBUtils.clampAngle(worldAng - fwdAng);
        // screen ring: 38% of the smaller screen dimension out...
        var rx = Math.sin(rel) * 38, ry = -Math.cos(rel) * 38;
        this.dmgEl.style.left = (50 + rx * 0.9) + '%';
        this.dmgEl.style.top = (50 + ry * 0.9) + '%';
        // the chevron glyph points right at 0deg; rotate so it...
        var deg = rel * 180 / Math.PI - 90;
        this.dmgEl.style.transform = 'translate(-50%,-50%) rotate(' + deg + 'deg)';
        this.dmgEl.style.opacity = String(SBUtils.clamp01(this.dmgT / 0.5));
        if (this.dmgT <= 0) this.dmgEl.style.opacity = '0';
      }
    }
  },
  _panelHealth: function (dt) {
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
  },
  _panelStamina: function (dt) {
    // stamina bar: green while fresh, orange when winded
    if (this.staminaFill) {
      this.staminaFill.style.width = SBUtils.clamp(Player.stamina, 0, 100) + '%';
      this.staminaFill.style.background = Player.exhausted ? '#ff8844' : '#7dff9a';
    }
  },
  _panelStars: function (dt) {
    var w = Police.getWanted(), stars = '';
    for (var i = 0; i < 5; i++) stars += i < w ? '★' : '☆';
    this.starsEl.textContent = stars;
    // star pop: the stars scale up briefly whenever the hea...
    if (w !== this.lastWanted) {
      this.lastWanted = w;
      this.starPopT = 0.35;
    }
    if (this.starPopT > 0) {
      this.starPopT -= dt;
      var pop = 1 + 0.25 * SBUtils.ease('outBack', SBUtils.clamp01(this.starPopT / 0.35));
      this.starsEl.style.transform = 'scale(' + pop.toFixed(2) + ')';
      this.starsEl.style.display = 'inline-block';
      if (this.starPopT <= 0) this.starsEl.style.transform = '';
    }
    // wanted-decay bar: fills as the heat cools off, one st...
    if (this.decayFill) {
      this.decayFill.style.width = Math.round(Police.getDecayProgress() * 100) + '%';
      this.decayFill.parentNode.style.opacity = w > 0 ? '1' : '0.25';
    }
  },
  _panelSpeed: function (dt) {
    var car = Vehicle.current || Vehicle.drivable;
    var sp = Vehicle.isDriving() ? Math.abs(car.speed) * 3.6 : Player.speed * 3.6;
    this.speedEl.textContent = Math.round(sp) + ' km/h';
    // speedometer needle: 0..140 km/h sweeps -120..+120 deg...
    if (this.needleEl) {
      var ang = -120 + SBUtils.clamp(sp / 140, 0, 1) * 240;
      this.needleEl.style.transform = 'rotate(' + ang + 'deg)';
    }
  },
  _panelTimer: function (dt) {
    // mission timer, during the timed legs (Getaway Driver...
    if (!this.timerEl) return;
    var timed = Missions.state === 'active' && Missions.step === 1 && (Missions.active === 3 || Missions.active === 4 || Missions.active === 5);
    if (timed) {
      this.timerEl.style.display = 'block';
      var t = Math.max(0, Math.ceil(Missions.timer));
      this.timerEl.textContent = '⏱ ' + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
      this.timerEl.style.color = t <= 15 ? '#ff4444' : '#ffd23f';
      // timer bar: the mission's full length is 90 / 120 / 150 s
      if (this.timerBarEl && this.timerBarFill) {
        var tmax = Missions.active === 3 ? 90 : Missions.active === 4 ? 120 : 150;
        var frac = SBUtils.clamp01(Missions.timer / tmax);
        this.timerBarEl.style.display = 'block';
        this.timerBarFill.style.width = Math.round(frac * 100) + '%';
        this.timerBarFill.style.background = t <= 15 ? '#ff4444' : '#ffd23f';
      }
    } else {
      this.timerEl.style.display = 'none';
      if (this.timerBarEl) this.timerBarEl.style.display = 'none';
    }
  },
  _panelRadio: function (dt) {
    // radio chip: which BAY FM station is playing, while th...
    if (this.radioEl) {
      if (AudioSys.radioOn) {
        this.radioEl.style.display = 'block';
        this.radioEl.textContent = '📻 ' + AudioSys.radioName();
      } else {
        this.radioEl.style.display = 'none';
      }
    }
  },
  _panelObjective: function (dt) {
    this.objEl.textContent = Game.objective;
    // live distance to the mission beacon, when one is active
    if (this.objDetailEl) {
      var blip = Missions.getBlip ? Missions.getBlip() : null;
      if (blip) {
        var d = Math.round(SBUtils.dist2D(Player.x, Player.z, blip.x, blip.z));
        this.objDetailEl.style.display = 'block';
        this.objDetailEl.textContent = '▸ ' + d + 'm to the beacon';
      } else {
        this.objDetailEl.style.display = 'none';
      }
    }
  },
  _panelHints: function (dt) {
    this.hintEl.textContent = Vehicle.isDriving()
      ? 'W/S drive · A/D steer · Space handbrake · Shift nitro · E exit · H horn · B roof · Esc pause'
      : (Combat.armed
        ? 'WASD move · Shift run · C crouch · V shove · E enter car · F weapon · Q switch · Click shoot · T taxi · P photo · Esc pause'
        : 'WASD move · Shift run · C crouch · E enter car · T taxi · P photo · Esc pause');
  },
  _panelAmmo: function (dt) {
    if (Combat.armed && !Vehicle.isDriving()) {
      this.ammoEl.style.display = 'block';
      var label = Combat.weapon === 'shotgun'
        ? '🔫 SHOTGUN ' + Combat.shells + ' shells'
        : Combat.weapon === 'sniper'
          ? '🎯 SNIPER ' + Combat.sniperAmmo + ' rounds'
          : '🔫 PISTOL ' + Combat.ammo + ' / 12';
      this.ammoEl.textContent = label + ((Combat.hasShotgun || Combat.hasSniper) ? '  (Q switch)' : '');
      // low-ammo warning: the readout pulses red at 2 rounds...
      var low = (Combat.weapon === 'shotgun' && Combat.shells <= 2) ||
        (Combat.weapon === 'sniper' && Combat.sniperAmmo <= 1) ||
        (Combat.weapon === 'pistol' && Combat.ammo <= 2);
      this.ammoEl.style.color = low ? '#ff6666' : '#ffd23f';
      this.ammoEl.style.opacity = low ? String(0.6 + 0.4 * Math.sin(this.time * 8)) : '1';
      this.crossEl.style.display = 'block';
      // crosshair sway: it drifts with movement and kicks up...
      var swayX = Math.sin(this.time * 2.2) * (Player.moving ? 5 : 2);
      var swayY = Math.cos(this.time * 1.7) * (Player.moving ? 4 : 2) - Combat.recoil * 22;
      this.crossEl.style.transform = 'translate(-50%,-50%) translate(' + swayX.toFixed(1) + 'px,' + swayY.toFixed(1) + 'px)';
    } else {
      this.ammoEl.style.display = 'none';
      this.crossEl.style.display = 'none';
    }
  },
  _panelFps: function (dt) {
    // no-op: the FPS readout is owned by main.js (see init)...
  },
  _panelStreak: function (dt) {
    // the streak chip is driven by _onMissionComplete / tim...
    if (this.streak === 0 && this.streakEl) this.streakEl.style.display = 'none';
  },
  _panelFlash: function (dt) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashEl) {
        this.flashEl.style.opacity = String(Math.max(0, this.flashTimer) * 0.9);
        if (this.flashTimer <= 0) this.flashEl.style.opacity = '0';
      }
    }
  },

  update: function (dt) {
    this.time += dt;
    // run the panel pipeline in order; a panel that throws...
    for (var i = 0; i < this.PANELS.length; i++) {
      var fn = this['_panel' + this.PANELS[i].charAt(0).toUpperCase() + this.PANELS[i].slice(1)];
      if (!fn) continue;
      try { fn.call(this, dt); } catch (e) {  }
    }
  },

  // mission + police + pickup blips, drawn on top of the...
  BLIP_DEFS: [
    { id: 'mission', color: null, radius: 0, ring: true, pulse: true,
      get: function () { return Missions.getBlip(); } },
    { id: 'pickup-pistol', color: '#7dff9a', radius: 3, ring: false,
      get: function () { return Combat.pickupTaken ? null : { x: 20, z: -20 }; } },
    { id: 'pickup-shotgun', color: '#ff8844', radius: 3, ring: false,
      get: function () { return Combat.shotgunTaken ? null : { x: -140, z: -100 }; } },
    { id: 'pickup-sniper', color: '#c04df0', radius: 3, ring: false,
      get: function () { return Combat.sniperTaken ? null : { x: -240, z: -240 }; } },
    { id: 'pickup-smg', color: '#3f8cff', radius: 3, ring: false,
      get: function () { return Combat.smgTaken ? null : { x: 140, z: 140 }; } },
    { id: 'boat', color: '#ffffff', radius: 3, ring: true,
      get: function () { return (Vehicle.boat && !Vehicle.isDriving()) ? Vehicle.boat : null; } },
    { id: 'bus', color: '#2a9d8f', radius: 3, ring: false,
      get: function () { return Traffic.bus || null; } },
    { id: 'taxi', color: '#f2c500', radius: 3, ring: false,
      get: function () { return Traffic.taxi || null; } },
    { id: 'race', color: '#ff7b00', radius: 3, ring: true,
      get: function () { return (typeof Races !== 'undefined' && Races.getBlip) ? Races.getBlip() : null; } }
  ],

  // draw one data-driven blip from BLIP_DEFS (mission bli...
  _drawDefBlip: function (ctx, mx, mz, def) {
    var pos = def.get();
    if (!pos) return;
    var r = def.radius;
    if (def.id === 'mission') {
      r = 4 + Math.sin(Missions.time * 4) * 1.5;
      ctx.fillStyle = pos.color;
      ctx.beginPath();
      ctx.arc(mx(pos.x), mz(pos.z), r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx(pos.x), mz(pos.z), r + 2, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(mx(pos.x), mz(pos.z), r, 0, Math.PI * 2);
    ctx.fill();
    if (def.ring) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mx(pos.x), mz(pos.z), r + 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  drawBlips: function (ctx, k, x0, z0) {
    var mx = function (x) { return (x - x0) * k; };
    var mz = function (z) { return (z - z0) * k; };
    // data-driven blips: mission, pickups, boat, bus, taxi
    for (var d = 0; d < this.BLIP_DEFS.length; d++) {
      this._drawDefBlip(ctx, mx, mz, this.BLIP_DEFS[d]);
    }
    // police cars: flashing blue/red dots
    for (var i = 0; i < Police.cars.length; i++) {
      var c = Police.cars[i];
      ctx.fillStyle = (Math.floor(Police.time * 3.5) % 2 === 0) ? '#3f8cff' : '#ff4444';
      ctx.beginPath();
      ctx.arc(mx(c.x), mz(c.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // police helicopter: a white dot with a ring, high abov...
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
    // ammo boxes (only while available)
    for (var a = 0; a < Combat.ammoBoxes.length; a++) {
      var ab = Combat.ammoBoxes[a];
      if (ab.taken) continue;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(mx(ab.x), mz(ab.z), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // heat-meter arc around the minimap edge: a red ring th...
    var S = ctx.canvas.width;
    var cx = S / 2, cy = S / 2, rad = S / 2 - 2;
    var w = Police.getWanted();
    if (w > 0) {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + (w / 5) * Math.PI * 2);
      ctx.stroke();
      // inner arc: heat-cooling progress toward dropping the...
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
