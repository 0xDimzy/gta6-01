// input.js — keyboard + mouse state, action bindings, smoothed orbit
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
  // action -> key codes. Rebindable: Input.rebind('interact', 'KeyX').
  // gameplay code should use actionDown()/axisAction() so a rebind works
  // everywhere; the raw down()/axis() helpers stay for menus + demos.
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
    music: ['KeyM']
  },
  init: function () {
    var self = this;
    window.addEventListener('keydown', function (e) {
      if (!self.keys[e.code]) self._pressed[e.code] = true;
      self.keys[e.code] = true;
      if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
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
  axis: function (neg, pos) {
    return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0);
  },
  // binding-aware axis: e.g. axisAction('down', 'up')
  axisAction: function (negAction, posAction) {
    return (this.actionDown(posAction) ? 1 : 0) - (this.actionDown(negAction) ? 1 : 0);
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
