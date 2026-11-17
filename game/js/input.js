// input.js — keyboard + mouse + gamepad, action bindings, smoothed orbit.
// Gameplay code should use actionDown()/pressedAction() so a rebind works
// everywhere; the raw down()/axis() helpers stay for menus + demos.
var Input = {
  keys: {},
  // mouse orbit deltas accumulated since last frame
  orbitDX: 0,
  orbitDY: 0,
  // smoothed orbit values actually handed out (kills mouse jitter)
  _smoothX: 0,
  _smoothY: 0,
  dragging: false,
  clicked: false,
  _pressed: {}, // edge-triggered keys, consumed by pressed()
  _lastWTap: 0, // timestamp of the last W/Up tap (double-tap = sprint)
  _dtRun: false, // true while a double-tapped W is still held
  _pad: null, // last polled gamepad snapshot {axes, buttons}
  _padPrev: {}, // previous frame's pad buttons, for edge detection
  // action -> key codes. Rebindable: Input.rebind('interact', 'KeyX').
  BINDINGS: {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    run: ['ShiftLeft', 'ShiftRight'],
    interact: ['KeyE'],
    brake: ['Space'],
    weapon: ['KeyF'],
    switchWeapon: ['KeyQ'],
    retry: ['KeyR'],
    pause: ['Escape'],
    help: ['KeyH'],
    music: ['KeyM'],
    mapZoom: ['KeyN'],
    crouch: ['KeyC'],
    shove: ['KeyV'],
    photo: ['KeyP'],
    radio: ['KeyY'],
    taxi: ['KeyT'],
    nitro: ['ShiftLeft', 'ShiftRight'],
    roof: ['KeyB'],
    rain: ['KeyU'],
    dusk: ['KeyI']
  },
  // human-readable key names for the help panel / settings screen.
  // Every action in BINDINGS has a display name here; HUD and the pause
  // menu read these instead of hard-coding key labels.
  KEYS: {
    up: 'W / ↑', down: 'S / ↓', left: 'A / ←', right: 'D / →',
    run: 'Shift', interact: 'E', brake: 'Space', weapon: 'F',
    switchWeapon: 'Q', retry: 'R', pause: 'Esc', help: 'H',
    music: 'M', mapZoom: 'N', crouch: 'C', shove: 'V',
    photo: 'P', radio: 'Y', taxi: 'T', nitro: 'Shift',
    roof: 'B', rain: 'U', dusk: 'I'
  },
  // display name for one action, e.g. keyName('interact') -> 'E'
  keyName: function (action) {
    return this.KEYS[action] || action;
  },
  // every binding as a row for a settings / help table:
  // [{action, code, name}] — code is the first bound key
  listBindings: function () {
    var rows = [];
    var names = Object.keys(this.BINDINGS);
    for (var i = 0; i < names.length; i++) {
      var a = names[i];
      rows.push({ action: a, code: this.BINDINGS[a][0], name: this.keyName(a) });
    }
    return rows;
  },
  // gamepad button map (standard mapping): A enter/shoot, B exit, X weapon,
  // Y radio, LB/RB switch weapon, LT brake, RT nitro, Start pause, Back help.
  // Left stick drives/moves (padStick), right stick orbits the camera.
  PAD_ACTIONS: {
    interact: 0, brake: 6, nitro: 7, weapon: 2, switchWeapon: 5,
    pause: 9, help: 8, radio: 3, shove: 1, photo: 4
  },
  // gamepad button held for an action (index per the standard mapping)
  padActionDown: function (action) {
    var idx = this.PAD_ACTIONS[action];
    if (idx === undefined) return false;
    return this.padDown(idx);
  },
  // gamepad button pressed this frame for an action
  padActionPressed: function (action) {
    var idx = this.PAD_ACTIONS[action];
    if (idx === undefined) return false;
    return this.padPressed(idx);
  },
  // right stick, dead-zoned — the camera orbit reads this in photo mode
  padStickRight: function () {
    if (!this._pad || !this._pad.axes || this._pad.axes.length < 4) return { x: 0, y: 0 };
    var dz = function (v) { return Math.abs(v) < 0.18 ? 0 : v; };
    return { x: dz(this._pad.axes[2]), y: dz(this._pad.axes[3]) };
  },
  init: function () {
    var self = this;
    window.addEventListener('keydown', function (e) {
      if (!self.keys[e.code]) {
        self._pressed[e.code] = true;
        // double-tap W/Up = sprint without holding Shift: two taps within
        // 280 ms latch the sprint until the key comes back up
        if (e.code === 'KeyW' || e.code === 'ArrowUp') {
          var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
          if (now - self._lastWTap < 280) self._dtRun = true;
          self._lastWTap = now;
        }
      }
      self.keys[e.code] = true;
      if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) {
      self.keys[e.code] = false;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        if (!self.keys['KeyW'] && !self.keys['ArrowUp']) self._dtRun = false;
      }
    });
    window.addEventListener('blur', function () { self.keys = {}; self._pressed = {}; });
    var canvas = document.getElementById('game-canvas');
    if (canvas) {
      canvas.addEventListener('mousedown', function (e) {
        self.dragging = true;
        self.clicked = true;
        self._lx = e.clientX; self._ly = e.clientY;
      });
      window.addEventListener('mouseup', function () { self.dragging = false; });
      window.addEventListener('mousemove', function (e) {
        if (!self.dragging) return;
        self.orbitDX += e.clientX - self._lx;
        self.orbitDY += e.clientY - self._ly;
        self._lx = e.clientX; self._ly = e.clientY;
      });
    }
  },
  // poll the first connected gamepad once per frame; call from the loop
  pollPad: function () {
    var pads = null;
    try { pads = navigator.getGamepads ? navigator.getGamepads() : null; } catch (e) { pads = null; }
    var gp = null;
    if (pads) {
      for (var i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
      }
    }
    this._padPrev = this._pad ? this._pad.buttons : {};
    if (!gp) { this._pad = null; return false; }
    var btns = {};
    for (var b = 0; b < gp.buttons.length; b++) btns[b] = !!gp.buttons[b].pressed;
    this._pad = { axes: gp.axes.slice(), buttons: btns };
    return true;
  },
  // gamepad button held (index per the standard mapping: 0=A, 1=B, 2=X,
  // 3=Y, 4=LB, 5=RB, 6=LT, 7=RT, 9=start)
  padDown: function (idx) {
    return !!(this._pad && this._pad.buttons[idx]);
  },
  // gamepad button pressed this frame (edge)
  padPressed: function (idx) {
    return this.padDown(idx) && !this._padPrev[idx];
  },
  // left stick, dead-zoned to [-1, 1] on each axis
  padStick: function () {
    if (!this._pad || !this._pad.axes || this._pad.axes.length < 2) return { x: 0, y: 0 };
    var dz = function (v) { return Math.abs(v) < 0.18 ? 0 : v; };
    return { x: dz(this._pad.axes[0]), y: dz(this._pad.axes[1]) };
  },
  down: function (code) { return !!this.keys[code]; },
  // true once per physical key press; reading it consumes the edge
  pressed: function (code) {
    var p = !!this._pressed[code];
    if (p) this._pressed[code] = false;
    return p;
  },
  pressedAction: function (action) {
    var codes = this.BINDINGS[action] || [];
    for (var i = 0; i < codes.length; i++) {
      if (this.pressed(codes[i])) return true;
    }
    return false;
  },
  actionDown: function (action) {
    var codes = this.BINDINGS[action] || [];
    for (var i = 0; i < codes.length; i++) {
      if (this.keys[codes[i]]) return true;
    }
    return false;
  },
  // true when any of the given key codes was pressed this frame
  anyPressed: function (codes) {
    for (var i = 0; i < codes.length; i++) {
      if (this.pressed(codes[i])) return true;
    }
    return false;
  },
  // sprint: Shift held, or a double-tapped W still held down
  sprintDown: function () {
    return this.actionDown('run') || !!this._dtRun;
  },
  axis: function (neg, pos) {
    return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0);
  },
  // binding-aware axis: e.g. axisAction('down', 'up')
  axisAction: function (negAction, posAction) {
    return (this.actionDown(posAction) ? 1 : 0) - (this.actionDown(negAction) ? 1 : 0);
  },
  // keyboard axis blended with the left stick (stick wins when moved)
  axisMixed: function (negAction, posAction) {
    var k = this.axisAction(negAction, posAction);
    var s = this.padStick();
    if (posAction === 'up') return k !== 0 ? k : -s.y;
    if (posAction === 'right') return k !== 0 ? k : s.x;
    return k;
  },
  rebind: function (action, code) {
    if (!this.BINDINGS[action]) return false;
    this.BINDINGS[action] = [code];
    return true;
  },
  // consume accumulated orbit deltas, exponentially smoothed so a shaky
  // hand does not whip the camera around
  takeOrbit: function () {
    this._smoothX = SBUtils.lerp(this._smoothX, this.orbitDX, 0.45);
    this._smoothY = SBUtils.lerp(this._smoothY, this.orbitDY, 0.45);
    var d = { x: this._smoothX, y: this._smoothY };
    this.orbitDX = 0; this.orbitDY = 0;
    this._smoothX *= 0.4; this._smoothY *= 0.4;
    return d;
  },
  takeClick: function () {
    var c = this.clicked;
    this.clicked = false;
    return c;
  }
};
