// input.js — keyboard + mouse + gamepad, action binding...
var Input = {
  keys: {},
  // mouse orbit deltas accumulated since last frame
  orbitDX: 0,
  orbitDY: 0,
  invertY: false,
  lookSensitivity: 1.0,
  // smoothed orbit values actually handed out (kills mous...
  _smoothX: 0,
  _smoothY: 0,
  dragging: false,
  clicked: false,
  _pressed: {},
  _lastWTap: 0,
  _dtRun: false,
  _pad: null,
  _padPrev: {},
  _padIndex: -1,
  _padName: '',
  // ---- binding definitions: one row per action. keys ar...
  BINDING_DEFS: [
    { action: 'up', keys: ['KeyW', 'ArrowUp'], pad: [], label: 'W / ↑', category: 'move' },
    { action: 'down', keys: ['KeyS', 'ArrowDown'], pad: [], label: 'S / ↓', category: 'move' },
    { action: 'left', keys: ['KeyA', 'ArrowLeft'], pad: [], label: 'A / ←', category: 'move' },
    { action: 'right', keys: ['KeyD', 'ArrowRight'], pad: [], label: 'D / →', category: 'move' },
    { action: 'run', keys: ['ShiftLeft', 'ShiftRight'], pad: [], label: 'Shift', category: 'move' },
    { action: 'interact', keys: ['KeyE'], pad: [0], label: 'E', category: 'world' },
    { action: 'brake', keys: ['Space'], pad: [6], label: 'Space', category: 'vehicle' },
    { action: 'weapon', keys: ['KeyF'], pad: [2], label: 'F', category: 'combat' },
    { action: 'switchWeapon', keys: ['KeyQ'], pad: [5], label: 'Q', category: 'combat' },
    { action: 'retry', keys: ['KeyR'], pad: [], label: 'R', category: 'world' },
    { action: 'pause', keys: ['Escape'], pad: [9], label: 'Esc', category: 'world' },
    { action: 'help', keys: ['KeyH'], pad: [8], label: 'H', category: 'world' },
    { action: 'music', keys: ['KeyM'], pad: [], label: 'M', category: 'world' },
    { action: 'mapZoom', keys: ['KeyN'], pad: [], label: 'N', category: 'camera' },
    { action: 'crouch', keys: ['KeyC'], pad: [4], label: 'C', category: 'move' },
    { action: 'shove', keys: ['KeyV'], pad: [1], label: 'V', category: 'combat' },
    { action: 'photo', keys: ['KeyP'], pad: [], label: 'P', category: 'camera' },
    { action: 'radio', keys: ['KeyY'], pad: [3], label: 'Y', category: 'vehicle' },
    { action: 'taxi', keys: ['KeyT'], pad: [], label: 'T', category: 'world' },
    { action: 'nitro', keys: ['ShiftLeft', 'ShiftRight'], pad: [7], label: 'Shift', category: 'vehicle' },
    { action: 'roof', keys: ['KeyB'], pad: [], label: 'B', category: 'vehicle' },
    { action: 'rain', keys: ['KeyU'], pad: [], label: 'U', category: 'world' },
    { action: 'dusk', keys: ['KeyI'], pad: [], label: 'I', category: 'world' },
    { action: 'roll', keys: ['KeyG'], pad: [], label: 'G', category: 'move' },
    { action: 'scope', keys: ['KeyX'], pad: [], label: 'X', category: 'combat' },
    { action: 'drone', keys: ['KeyO'], pad: [], label: 'O', category: 'camera' }
  ],
  // action -> key codes. Rebindable: Input.rebind('intera...
  BINDINGS: {},
  // human-readable key names for the help panel / setting...
  KEYS: {},
  // gamepad button map (standard mapping): A enter/shoot,...
  PAD_ACTIONS: {},
  // per-stick dead zones and response curves. A stick ins...
  PAD_DEADZONE: { left: 0.18, right: 0.18, trigger: 0.12 },
  PAD_CURVE: { left: 'squared', right: 'linear', trigger: 'linear' },
  // display name for one action, e.g. keyName('interact')...
  keyName: function (action) {
    return this.KEYS[action] || action;
  },
  // every binding as a row for a settings / help table:
  listBindings: function () {
    var rows = [];
    var names = Object.keys(this.BINDINGS);
    for (var i = 0; i < names.length; i++) {
      var a = names[i];
      rows.push({ action: a, code: this.BINDINGS[a][0], name: this.keyName(a) });
    }
    return rows;
  },
  // bindings grouped by category for the settings screen:
  bindingsByCategory: function () {
    var out = {};
    for (var i = 0; i < this.BINDING_DEFS.length; i++) {
      var def = this.BINDING_DEFS[i];
      if (!out[def.category]) out[def.category] = [];
      out[def.category].push({
        action: def.action,
        code: (this.BINDINGS[def.action] || [])[0] || '',
        name: this.keyName(def.action),
        pad: (this.PAD_ACTIONS[def.action] !== undefined) ? this.PAD_ACTIONS[def.action] : -1
      });
    }
    return out;
  },
  // does this action exist in the bindings table?
  hasBinding: function (action) { return !!this.BINDINGS[action]; },
  // one-line summary of every binding, for the help panel...
  bindingSummary: function () {
    var rows = this.listBindings();
    var parts = [];
    for (var i = 0; i < rows.length; i++) {
      parts.push(rows[i].action + ' ' + rows[i].name);
    }
    return parts.join(' · ');
  },
  // shape a raw stick/trigger value: dead zone first, the...
  _shapeAxis: function (v, deadZone, curve) {
    var a = Math.abs(v);
    if (a < deadZone) return 0;
    var t = (a - deadZone) / (1 - deadZone);
    if (curve === 'squared') t = t * t;
    else if (curve === 'cubic') t = t * t * t;
    return (v < 0 ? -1 : 1) * SBUtils.clamp01(t);
  },
  // gamepad button held for an action (index per the stan...
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
  // right stick, dead-zoned + curved — the camera orbit r...
  padStickRight: function () {
    if (!this._pad || !this._pad.axes || this._pad.axes.length < 4) return { x: 0, y: 0 };
    var dz = this.PAD_DEADZONE.right;
    var curve = this.PAD_CURVE.right;
    return {
      x: this._shapeAxis(this._pad.axes[2], dz, curve),
      y: this._shapeAxis(this._pad.axes[3], dz, curve)
    };
  },
  // left trigger / right trigger as analog 0..1 (standard...
  padTrigger: function (which) {
    if (!this._pad) return 0;
    var btnIdx = which === 'left' ? 6 : 7;
    var btn = this._pad.buttons[btnIdx];
    if (btn !== undefined) {
      // buttons[] here holds booleans; the analog value lives...
      var v = this._pad.values ? this._pad.values[btnIdx] : (btn ? 1 : 0);
      return this._shapeAxis(v, this.PAD_DEADZONE.trigger, this.PAD_CURVE.trigger);
    }
    if (this._pad.axes && this._pad.axes.length > 5) {
      var ax = this._pad.axes[which === 'left' ? 4 : 5];
      return this._shapeAxis((ax + 1) / 2, this.PAD_DEADZONE.trigger, this.PAD_CURVE.trigger);
    }
    return 0;
  },
  // is any gamepad connected right now?
  padConnected: function () { return !!this._pad; },
  // human name of the connected pad ('' when none) — the...
  padName: function () { return this._padName || ''; },
  // rumble the connected pad: intensity 0..1, duration in...
  padRumble: function (intensity, durationMs) {
    try {
      var pads = navigator.getGamepads ? navigator.getGamepads() : null;
      if (!pads) return false;
      for (var i = 0; i < pads.length; i++) {
        var gp = pads[i];
        if (gp && gp.connected && gp.vibrationActuator && gp.vibrationActuator.playEffect) {
          gp.vibrationActuator.playEffect('dual-rumble', {
            duration: durationMs || 120,
            strongMagnitude: SBUtils.clamp01(intensity),
            weakMagnitude: SBUtils.clamp01(intensity) * 0.6
          });
          return true;
        }
      }
    } catch (e) {  }
    return false;
  },
  init: function () {
    var self = this;
    // build the live tables from the definitions, then rest...
    this._buildTables();
    this.loadBindings();
    window.addEventListener('keydown', function (e) {
      if (!self.keys[e.code]) {
        self._pressed[e.code] = true;
        // double-tap W/Up = sprint without holding Shift: two t...
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
    // track pad connect/disconnect so the help panel can na...
    window.addEventListener('gamepadconnected', function (e) {
      self._padIndex = e.gamepad.index;
      self._padName = e.gamepad.id || 'gamepad';
    });
    window.addEventListener('gamepaddisconnected', function (e) {
      if (e.gamepad.index === self._padIndex) { self._padIndex = -1; self._padName = ''; self._pad = null; }
    });
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
  // rebuild BINDINGS / KEYS / PAD_ACTIONS from BINDING_DE...
  _buildTables: function () {
    this.BINDINGS = {};
    this.KEYS = {};
    this.PAD_ACTIONS = {};
    for (var i = 0; i < this.BINDING_DEFS.length; i++) {
      var def = this.BINDING_DEFS[i];
      this.BINDINGS[def.action] = def.keys.slice();
      this.KEYS[def.action] = def.label;
      if (def.pad && def.pad.length > 0) this.PAD_ACTIONS[def.action] = def.pad[0];
    }
  },
  // persist rebinds to localStorage so a player's keys su...
  saveBindings: function () {
    try {
      var diffs = {};
      for (var i = 0; i < this.BINDING_DEFS.length; i++) {
        var def = this.BINDING_DEFS[i];
        var cur = this.BINDINGS[def.action];
        if (cur && (cur.length !== def.keys.length || cur[0] !== def.keys[0])) {
          diffs[def.action] = cur[0];
        }
      }
      window.localStorage.setItem('solmaris-bindings', JSON.stringify(diffs));
      return true;
    } catch (e) { return false; }
  },
  // restore saved rebinds (called from init). Unknown act...
  loadBindings: function () {
    try {
      var raw = window.localStorage.getItem('solmaris-bindings');
      if (!raw) return false;
      var diffs = JSON.parse(raw);
      for (var action in diffs) {
        if (this.BINDINGS[action]) this.BINDINGS[action] = [diffs[action]];
      }
      return true;
    } catch (e) { return false; }
  },
  // restore every binding to its default and clear the sa...
  resetBindings: function () {
    this._buildTables();
    try { window.localStorage.removeItem('solmaris-bindings'); } catch (e) {}
    return true;
  },
  // poll the first connected gamepad once per frame; call...
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
    this._padIndex = gp.index;
    this._padName = gp.id || 'gamepad';
    var btns = {};
    var vals = {};
    for (var b = 0; b < gp.buttons.length; b++) {
      btns[b] = !!gp.buttons[b].pressed;
      vals[b] = gp.buttons[b].value;
    }
    this._pad = { axes: gp.axes.slice(), buttons: btns, values: vals };
    return true;
  },
  // gamepad button held (index per the standard mapping:...
  padDown: function (idx) {
    return !!(this._pad && this._pad.buttons[idx]);
  },
  // gamepad button pressed this frame (edge)
  padPressed: function (idx) {
    return this.padDown(idx) && !this._padPrev[idx];
  },
  // left stick, dead-zoned + curved to [-1, 1] on each axis
  padStick: function () {
    if (!this._pad || !this._pad.axes || this._pad.axes.length < 2) return { x: 0, y: 0 };
    var dz = this.PAD_DEADZONE.left;
    var curve = this.PAD_CURVE.left;
    return {
      x: this._shapeAxis(this._pad.axes[0], dz, curve),
      y: this._shapeAxis(this._pad.axes[1], dz, curve)
    };
  },
  down: function (code) { return !!this.keys[code]; },
  // true once per physical key press; reading it consumes...
  pressed: function (code) {
    var p = !!this._pressed[code];
    if (p) this._pressed[code] = false;
    return p;
  },
  // keyboard edge OR gamepad edge for an action (either i...
  pressedAction: function (action) {
    var codes = this.BINDINGS[action] || [];
    for (var i = 0; i < codes.length; i++) {
      if (this.pressed(codes[i])) return true;
    }
    if (this.padActionPressed(action)) return true;
    return false;
  },
  // keyboard held OR gamepad held for an action
  actionDown: function (action) {
    var codes = this.BINDINGS[action] || [];
    for (var i = 0; i < codes.length; i++) {
      if (this.keys[codes[i]]) return true;
    }
    if (this.padActionDown(action)) return true;
    return false;
  },
  // true when any of the given key codes was pressed this...
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
  // keyboard axis blended with the left stick (stick wins...
  axisMixed: function (negAction, posAction) {
    var k = this.axisAction(negAction, posAction);
    var s = this.padStick();
    if (posAction === 'up') {
      if (k !== 0) return k;
      if (s.y !== 0) return -s.y;
      return this.padTrigger('right') > 0.2 ? 1 : 0;
    }
    if (posAction === 'right') return k !== 0 ? k : s.x;
    return k;
  },
  // rebind an action to a new key code. Returns {ok, conf...
  rebind: function (action, code) {
    if (!this.BINDINGS[action]) return false;
    for (var other in this.BINDINGS) {
      if (other === action) continue;
      var codes = this.BINDINGS[other];
      for (var i = 0; i < codes.length; i++) {
        if (codes[i] === code) return { ok: false, conflict: other };
      }
    }
    this.BINDINGS[action] = [code];
    this.KEYS[action] = code.replace('Key', '').replace('Arrow', '');
    this.saveBindings();
    return { ok: true, conflict: null };
  },
  // consume accumulated orbit deltas, exponentially smoot...
  takeOrbit: function () {
    var rs = this.padStickRight();
    this.orbitDX += rs.x * 14;
    this.orbitDY += rs.y * 10;
    // sensitivity scales both axes; invertY flips the verti...
    var dx = this.orbitDX * this.lookSensitivity;
    var dy = this.orbitDY * (this.invertY ? -1 : 1) * this.lookSensitivity;
    this._smoothX = SBUtils.lerp(this._smoothX, dx, 0.45);
    this._smoothY = SBUtils.lerp(this._smoothY, dy, 0.45);
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

// populate the live tables at script load (init() rebui...
Input._buildTables();
