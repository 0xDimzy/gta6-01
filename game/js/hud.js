// hud.js — owns all HUD updates: money, health, stamina, wanted stars,
// wanted-decay bar, speed + gauge needle, mission timer, objective,
// story subtitle, hints, ammo, crosshair, toasts, summary + busted
// screens, minimap blips
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
    // react to mission events via the bus (story + summary are also
    // driven directly by Missions, this keeps the wiring explicit)
    var self = this;
    SBBus.on('mission-complete', function (def) { self.showSummary(def, Game.money); });
  },

  toast: function (msg, color) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.style.borderLeft = '4px solid ' + (color || '#ff7b00');
    this.toastEl.style.opacity = '1';
    this.toastTimer = 2.6;
  },

  // story subtitle: one line of the Raka storyline, shown at mission start
  showStory: function (msg) {
    if (!this.storyEl) return;
    this.storyEl.textContent = msg;
    this.storyEl.style.opacity = '1';
    this.storyTimer = 5;
  },

  // mission-complete summary card: job, reward, running total
  showSummary: function (def, money) {
    if (!this.summaryEl) return;
    var name = this.summaryEl.querySelector('.sum-name');
    var reward = this.summaryEl.querySelector('.sum-reward');
    var total = this.summaryEl.querySelector('.sum-total');
    if (name) name.textContent = def.name;
    if (reward) reward.textContent = '+$' + def.reward.toLocaleString('en-US');
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
    this.moneyEl.textContent = SBUtils.formatMoney(Game.money);
    this.healthFill.style.width = SBUtils.clamp(Game.health, 0, 100) + '%';
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
    // getaway timer, only during mission 4's delivery leg
    if (this.timerEl) {
      if (Missions.state === 'active' && Missions.active === 3 && Missions.step === 1) {
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
      ? 'W/S drive · A/D steer · Space handbrake · E exit · Esc pause'
      : (Combat.armed
        ? 'WASD move · Shift run · E enter car · F weapon · Q switch · Click shoot · Esc pause'
        : 'WASD move · Shift run · E enter car · Esc pause');
    if (Combat.armed && !Vehicle.isDriving()) {
      this.ammoEl.style.display = 'block';
      var label = Combat.weapon === 'shotgun'
        ? '🔫 SHOTGUN ' + Combat.shells + ' shells'
        : '🔫 PISTOL ' + Combat.ammo + ' / 12';
      this.ammoEl.textContent = label + (Combat.hasShotgun ? '  (Q switch)' : '');
      this.crossEl.style.display = 'block';
    } else {
      this.ammoEl.style.display = 'none';
      this.crossEl.style.display = 'none';
    }
  },

  // mission + police + pickup blips, drawn on top of the base minimap
  drawBlips: function (ctx, k) {
    var blip = Missions.getBlip();
    if (blip) {
      var pulse = 4 + Math.sin(Missions.time * 4) * 1.5;
      ctx.fillStyle = blip.color;
      ctx.beginPath();
      ctx.arc((blip.x + 300) * k, (blip.z + 300) * k, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc((blip.x + 300) * k, (blip.z + 300) * k, pulse + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    // police cars: flashing blue/red dots
    for (var i = 0; i < Police.cars.length; i++) {
      var c = Police.cars[i];
      ctx.fillStyle = (Math.floor(Police.time * 3.5) % 2 === 0) ? '#3f8cff' : '#ff4444';
      ctx.beginPath();
      ctx.arc((c.x + 300) * k, (c.z + 300) * k, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // roadblock cruisers: red squares
    for (var r = 0; r < Police.roadblocks.length; r++) {
      var rb = Police.roadblocks[r];
      ctx.fillStyle = '#ff4444';
      ctx.fillRect((rb.x + 300) * k - 3, (rb.z + 300) * k - 3, 6, 6);
    }
    // weapon pickup
    if (!Combat.pickupTaken) {
      ctx.fillStyle = '#7dff9a';
      ctx.beginPath();
      ctx.arc((20 + 300) * k, (-20 + 300) * k, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // shotgun pickup
    if (!Combat.shotgunTaken) {
      ctx.fillStyle = '#ff8844';
      ctx.beginPath();
      ctx.arc((-140 + 300) * k, (-100 + 300) * k, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // ammo boxes (only while available)
    for (var a = 0; a < Combat.ammoBoxes.length; a++) {
      var ab = Combat.ammoBoxes[a];
      if (ab.taken) continue;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc((ab.x + 300) * k, (ab.z + 300) * k, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // city bus: teal dot
    if (Traffic.bus) {
      ctx.fillStyle = '#2a9d8f';
      ctx.beginPath();
      ctx.arc((Traffic.bus.x + 300) * k, (Traffic.bus.z + 300) * k, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};
