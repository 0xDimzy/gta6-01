// audio.js — WebAudio synth only, no audio files:
var AudioSys = {
  ctx: null,
  engineOsc: null,
  engineGain: null,
  engineFilter: null,
  sirenOsc: null,
  sirenGain: null,
  sirenPhase: 0,
  sirenOn: false,
  musicNodes: null,
  musicOn: false,
  screechNodes: null,
  radioNodes: null,
  radioStation: 0,
  radioOn: false,
  volume: 0.9,
  muted: false,
  started: false,
  engineBase: 60,
  ambientOn: false,
  ambientNodes: null,
  RADIO_NAMES: ['BAY FM — synthwave', 'BAY FM — late jazz', 'BAY FM — news'],
  // ---- radio stations as data: name, bpm, root note, sc...
  STATIONS: [
    {
      name: 'BAY FM — synthwave', genre: 'synthwave', bpm: 112, root: 55,
      scale: [0, 3, 5, 7, 10], bassWave: 'sawtooth', leadWave: 'square',
      bassSteps: [0, 0, 2, -1, 0, 0, 3, 1],
      leadSteps: [4, -1, 2, 3, 4, 3, 2, -1],
      bassGain: 0.09, leadGain: 0.035
    },
    {
      name: 'BAY FM — late jazz', genre: 'jazz', bpm: 76, root: 110,
      scale: [0, 3, 5, 7, 10], bassWave: 'sine', leadWave: 'sine',
      bassSteps: [0, -1, 4, -1, 2, -1, 3, -1],
      leadSteps: [2, 4, 3, 4, 6, 4, 3, 2],
      bassGain: 0.06, leadGain: 0.05
    },
    {
      name: 'BAY FM — news', genre: 'news', bpm: 96, root: 98,
      scale: [0, 0, 0, 0], bassWave: 'sine', leadWave: 'square',
      bassSteps: [0, 0, 0, 0],
      leadSteps: [0, -1, 0, 0, -1, 0, -1, -1],
      bassGain: 0.03, leadGain: 0.04
    }
  ],
  // ---- engine profiles as data: base note, filter floor...
  ENGINE_PROFILES: {
    bike: { base: 95, filter: 500, rev: 190 },
    van: { base: 45, filter: 260, rev: 110 },
    pickup: { base: 52, filter: 320, rev: 130 },
    sports: { base: 72, filter: 420, rev: 170 },
    coupe: { base: 60, filter: 400, rev: 140 },
    convertible: { base: 66, filter: 430, rev: 150 },
    boat: { base: 50, filter: 300, rev: 90 }
  },
  init: function () {
    if (this.started) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      // engine hum: sawtooth through a lowpass, pitch follows...
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 400;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      this.started = true;
    } catch (e) {  }
  },
  resume: function () {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  // effective volume after mute: every gain in the file s...
  _vol: function () { return this.muted ? 0 : this.volume; },
  setVolume: function (v) {
    this.volume = SBUtils.clamp01(v);
    if (this.ctx) {
      // master volume rides the music + radio gains; one-shot...
      if (this.musicNodes) this.musicNodes.master.gain.value = 0.045 * this._vol();
      if (this.radioNodes) this.radioNodes.master.gain.value = 0.05 * this._vol();
    }
  },
  // master mute: silences every loop at once (one-shots c...
  setMuted: function (m) {
    this.muted = !!m;
    this.setVolume(this.volume);
    if (this.engineGain) this.engineGain.gain.value = this.muted ? 0 : this.engineGain.gain.value;
    return this.muted;
  },
  toggleMuted: function () { return this.setMuted(!this.muted); },
  // duck the music + radio under a sting/jingle, then bri...
  duckMusic: function (factor, seconds) {
    if (!this.ctx) return;
    var self = this;
    var apply = function (node, base) {
      if (!node) return;
      node.gain.setTargetAtTime(base * factor * self._vol(), self.ctx.currentTime, 0.05);
      setTimeout(function () {
        node.gain.setTargetAtTime(base * self._vol(), self.ctx.currentTime, 0.3);
      }, (seconds || 1.2) * 1000);
    };
    if (this.musicNodes) apply(this.musicNodes.master, 0.045);
    if (this.radioNodes) apply(this.radioNodes.master, 0.05);
  },
  // ---- one-shot helpers: _tone builds a short oscillato...
  _tone: function (opts) {
    if (!this.started || !this.ctx) return null;
    var t = opts.at !== undefined ? opts.at : this.ctx.currentTime;
    var o = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(opts.freq || 440, t);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t + (opts.dur || 0.2));
    g.gain.setValueAtTime((opts.gain || 0.1) * this._vol(), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (opts.dur || 0.2));
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + (opts.dur || 0.2) + 0.05);
    return o;
  },
  _noiseHit: function (opts) {
    if (!this.started || !this.ctx) return null;
    var t = opts.at !== undefined ? opts.at : this.ctx.currentTime;
    var dur = opts.dur || 0.16;
    var len = Math.floor(this.ctx.sampleRate * dur);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = buf.getChannelData(0);
    var power = opts.power || 1;
    for (var i = 0; i < len; i++) {
      var env = 1 - i / len;
      d[i] = (Math.random() * 2 - 1) * env * (power === 1 ? env : Math.pow(env, power));
    }
    var src = this.ctx.createBufferSource();
    src.buffer = buf;
    var node = src;
    if (opts.filter) {
      var f = this.ctx.createBiquadFilter();
      f.type = opts.filter; f.frequency.value = opts.freq || 1200; f.Q.value = opts.q || 0.7;
      src.connect(f); node = f;
    }
    var g = this.ctx.createGain();
    g.gain.setValueAtTime((opts.gain || 0.5) * this._vol(), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    node.connect(g); g.connect(this.ctx.destination);
    src.start(t);
    return src;
  },
  // speed 0..1 (0 = idle, 1 = top speed); driving true wh...
  setEngine: function (speed01, driving) {
    if (!this.started || !this.ctx) return;
    var t = this.ctx.currentTime;
    var profile = this.ENGINE_PROFILES[this._engineType || 'coupe'] || this.ENGINE_PROFILES.coupe;
    var target = driving ? (0.05 + speed01 * 0.06) * this._vol() : 0.0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(this.engineBase + speed01 * profile.rev, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(profile.filter + speed01 * 900, t, 0.1);
  },
  // per-vehicle engine note: each drivable sounds differe...
  setEngineNote: function (type) {
    var profile = this.ENGINE_PROFILES[type];
    this._engineType = profile ? type : 'coupe';
    this.engineBase = profile ? profile.base : 60;
  },
  // ambient city noise: a low looped rumble (brown noise...
  startAmbient: function () {
    if (!this.started || !this.ctx || this.ambientOn) return;
    this.ambientOn = true;
    var len = this.ctx.sampleRate * 2;
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var data = buf.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      var white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    var src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    var filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    var gain = this.ctx.createGain();
    gain.gain.value = 0.018 * this._vol();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
    this.ambientNodes = { src: src, gain: gain };
    var self = this;
    var tick = function () {
      if (!self.ambientOn) return;
      if (Math.random() < 0.5) self.distantSiren();
      else self.distantHorn();
      setTimeout(tick, 18000 + Math.random() * 12000);
    };
    setTimeout(tick, 12000);
  },
  // a siren two blocks away: quiet, slow, and gone before...
  distantSiren: function () {
    if (!this.started || !this.ctx) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(650, t);
    o.frequency.setValueAtTime(850, t + 0.7);
    o.frequency.setValueAtTime(650, t + 1.4);
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.02 * this._vol(), t + 0.3);
    g.gain.linearRampToValueAtTime(0.0, t + 1.6);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 1.7);
  },
  // a car horn far down the street: one short, dull beep
  distantHorn: function () {
    this._tone({ type: 'square', freq: 220, gain: 0.015, dur: 0.4 });
  },
  // short UI blip
  blip: function (freq) {
    this._tone({ type: 'sine', freq: freq || 880, gain: 0.12, dur: 0.18 });
  },
  // two-tone siren placeholder (called by later stages)
  siren: function () {
    if (!this.started || !this.ctx) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(700, t);
    o.frequency.setValueAtTime(950, t + 0.3);
    o.frequency.setValueAtTime(700, t + 0.6);
    g.gain.setValueAtTime(0.05 * this._vol(), t);
    g.gain.setValueAtTime(0.05 * this._vol(), t + 0.55);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.7);
  },
  // wanted sting: a dissonant hit when the stars go UP, s...
  sting: function () {
    if (!this.started || !this.ctx) return;
    var freqs = [220, 233.08, 311.13];
    for (var i = 0; i < freqs.length; i++) {
      this._tone({ type: 'sawtooth', freq: freqs[i], gain: 0.07, dur: 0.5 });
    }
    this.duckMusic(0.4, 0.8);
  },
  // mission failed: a low descending two-note sigh, the o...
  missionFail: function () {
    if (!this.started || !this.ctx) return;
    var t = this.ctx.currentTime;
    this._tone({ type: 'triangle', freq: 392, gain: 0.12, dur: 0.35, at: t });
    this._tone({ type: 'triangle', freq: 311.13, gain: 0.12, dur: 0.6, at: t + 0.3 });
    this.duckMusic(0.4, 1.0);
  },
  // police siren loop: setSiren(true) while wanted >= 1,...
  setSiren: function (on) {
    if (!this.started || !this.ctx) return;
    if (on && !this.sirenOsc) {
      var o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 700;
      var g = this.ctx.createGain();
      g.gain.value = 0.035 * this._vol();
      o.connect(g); g.connect(this.ctx.destination);
      o.start();
      this.sirenOsc = o; this.sirenGain = g; this.sirenOn = true;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch (e) {}
      this.sirenOsc = null; this.sirenGain = null; this.sirenOn = false;
    }
  },
  updateSiren: function (dt) {
    if (!this.sirenOn || !this.sirenOsc) return;
    this.sirenPhase += dt;
    var f = (this.sirenPhase % 0.8) < 0.4 ? 700 : 950;
    this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
  },
  // gunshot: short filtered noise burst
  shot: function () {
    this._noiseHit({ filter: 'bandpass', freq: 1600, q: 0.7, gain: 0.5, dur: 0.16 });
  },
  // shotgun: bigger, lower boom than the pistol
  boom: function () {
    this._noiseHit({ filter: 'lowpass', freq: 900, gain: 0.8, dur: 0.3, power: 2 });
  },
  // explosion: deep boom + a rumble tail, for a car blowi...
  explosion: function () {
    this._noiseHit({ filter: 'lowpass', freq: 420, gain: 1.0, dur: 0.9, power: 2 });
    this._tone({ type: 'sine', freq: 70, slideTo: 32, gain: 0.5, dur: 0.8 });
  },
  // splash: Raka hits the water at the beach — a short br...
  splash: function () {
    this._noiseHit({ filter: 'bandpass', freq: 2400, q: 0.5, gain: 0.35, dur: 0.35 });
  },
  // tyre burst: a spike strip shreds a tyre — a sharp cra...
  tireBurst: function () {
    this._noiseHit({ filter: 'highpass', freq: 1800, gain: 0.4, dur: 0.12 });
    this._tone({ type: 'sawtooth', freq: 300, slideTo: 90, gain: 0.12, dur: 0.5 });
  },
  // pickup: a bright two-note chime when Raka grabs a wea...
  pickup: function () {
    if (!this.started || !this.ctx) return;
    var t = this.ctx.currentTime;
    this._tone({ type: 'sine', freq: 880, gain: 0.1, dur: 0.12, at: t });
    this._tone({ type: 'sine', freq: 1318.5, gain: 0.1, dur: 0.2, at: t + 0.08 });
  },
  // reload: a short metallic click-click while the pistol...
  reload: function () {
    if (!this.started || !this.ctx) return;
    var t = this.ctx.currentTime;
    this._tone({ type: 'square', freq: 1900, gain: 0.05, dur: 0.05, at: t });
    this._tone({ type: 'square', freq: 1500, gain: 0.05, dur: 0.05, at: t + 0.14 });
  },
  // door slam: getting into a car — a dull low thud
  doorSlam: function () {
    this._tone({ type: 'sine', freq: 120, slideTo: 60, gain: 0.25, dur: 0.18 });
    this._noiseHit({ filter: 'lowpass', freq: 500, gain: 0.2, dur: 0.1 });
  },
  // helicopter wash: the rotor chop overhead while the he...
  heliWash: function () {
    if (!this.started || !this.ctx) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = 13;
    g.gain.setValueAtTime(0.06 * this._vol(), t);
    g.gain.linearRampToValueAtTime(0.0, t + 0.7);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.75);
  },
  // mission complete jingle: rising arpeggio
  jingle: function () {
    if (!this.started || !this.ctx) return;
    var notes = [523.25, 659.25, 783.99, 1046.5];
    for (var i = 0; i < notes.length; i++) {
      this._tone({ type: 'sine', freq: notes[i], gain: 0.14, dur: 0.3, at: this.ctx.currentTime + i * 0.12 });
    }
    this.duckMusic(0.5, 1.0);
  },
  // ---- ambient music: slow synth pad (Am7: A2 C3 E3 G3)...
  startMusic: function () {
    if (!this.started || !this.ctx || this.musicNodes) return;
    var t = this.ctx.currentTime;
    var master = this.ctx.createGain();
    master.gain.value = 0.0;
    master.gain.setTargetAtTime(0.045 * this._vol(), t, 1.5);
    var lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700;
    lp.connect(master); master.connect(this.ctx.destination);
    // slow swell: LFO on the master gain
    var lfo = this.ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.07;
    var lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain); lfoGain.connect(master.gain);
    lfo.start();
    var freqs = [110, 130.81, 164.81, 196.0];
    var oscs = [];
    for (var i = 0; i < freqs.length; i++) {
      var o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freqs[i];
      o.detune.value = (i % 2 === 0 ? 4 : -4);
      o.connect(lp);
      o.start();
      oscs.push(o);
    }
    this.musicNodes = { master: master, oscs: oscs, lfo: lfo };
    this.musicOn = true;
  },
  setMusic: function (on) {
    if (!this.started || !this.ctx) return;
    if (on && !this.musicNodes) { this.startMusic(); return; }
    if (!on && this.musicNodes) {
      var n = this.musicNodes;
      try { n.lfo.stop(); for (var i = 0; i < n.oscs.length; i++) n.oscs[i].stop(); } catch (e) {}
      try { n.master.disconnect(); } catch (e) {}
      this.musicNodes = null;
      this.musicOn = false;
    }
  },
  toggleMusic: function () {
    this.setMusic(!this.musicOn);
    return this.musicOn;
  },
  // ---- car radio: the stations table (STATIONS) drives...
  _stationFreq: function (station, degree) {
    var scale = station.scale;
    var oct = Math.floor(degree / scale.length);
    var step = scale[degree % scale.length];
    return station.root * Math.pow(2, (step + oct * 12) / 12);
  },
  _radioStep: function () {
    if (!this.radioNodes || !this.radioOn) return;
    var station = this.STATIONS[this.radioStation];
    var step = this.radioNodes.step++;
    var tt = this.ctx.currentTime;
    var bassDeg = station.bassSteps[step % station.bassSteps.length];
    if (bassDeg >= 0) {
      var bn = this.ctx.createOscillator();
      var bg = this.ctx.createGain();
      bn.type = station.bassWave;
      bn.frequency.value = this._stationFreq(station, bassDeg);
      bg.gain.setValueAtTime(station.bassGain * this._vol(), tt);
      bg.gain.exponentialRampToValueAtTime(0.001, tt + 0.22);
      bn.connect(bg); bg.connect(this.radioNodes.master);
      bn.start(tt); bn.stop(tt + 0.24);
    }
    var leadDeg = station.leadSteps[step % station.leadSteps.length];
    if (leadDeg >= 0) {
      var an = this.ctx.createOscillator();
      var ag = this.ctx.createGain();
      an.type = station.leadWave;
      an.frequency.value = this._stationFreq(station, leadDeg + 4);
      ag.gain.setValueAtTime(station.leadGain * this._vol(), tt);
      ag.gain.exponentialRampToValueAtTime(0.001, tt + 0.16);
      an.connect(ag); ag.connect(this.radioNodes.master);
      an.start(tt); an.stop(tt + 0.18);
    }
  },
  _stopRadio: function () {
    if (!this.radioNodes) return;
    var n = this.radioNodes;
    try {
      for (var i = 0; i < n.oscs.length; i++) n.oscs[i].stop();
      if (n.timer) clearInterval(n.timer);
      n.master.disconnect();
    } catch (e) {}
    this.radioNodes = null;
    this.radioOn = false;
  },
  _startRadioStation: function (idx) {
    if (!this.started || !this.ctx) return;
    this._stopRadio();
    var station = this.STATIONS[idx % this.STATIONS.length];
    var master = this.ctx.createGain();
    master.gain.value = 0.05 * this._vol();
    master.connect(this.ctx.destination);
    var self = this;
    var stepMs = 60000 / station.bpm / 2;
    var timer = setInterval(function () { self._radioStep(); }, stepMs);
    this.radioNodes = { master: master, oscs: [], timer: timer, step: 0 };
    this.radioOn = true;
    this._radioStep();
  },
  setRadio: function (on) {
    if (!this.started || !this.ctx) return;
    if (on) this._startRadioStation(this.radioStation);
    else this._stopRadio();
  },
  // cycle to the next station; returns the station name f...
  cycleRadio: function () {
    if (!this.radioOn) {
      this.setRadio(true);
      return this.RADIO_NAMES[this.radioStation];
    }
    this.radioStation = (this.radioStation + 1) % this.STATIONS.length;
    if (this.radioOn) this._startRadioStation(this.radioStation);
    return this.RADIO_NAMES[this.radioStation];
  },
  radioName: function () { return this.RADIO_NAMES[this.radioStation]; },
  // how many stations the radio has (the help panel lists...
  stationCount: function () { return this.STATIONS.length; },
  // skid screech that follows drift intensity: one loopin...
  setScreech: function (intensity) {
    if (!this.started || !this.ctx) return;
    if (intensity > 0 && !this.screechNodes) {
      var len = this.ctx.sampleRate;
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      var bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.2;
      var g = this.ctx.createGain(); g.gain.value = 0;
      src.connect(bp); bp.connect(g); g.connect(this.ctx.destination);
      src.start();
      this.screechNodes = { src: src, gain: g };
    }
    if (this.screechNodes) {
      this.screechNodes.gain.gain.setTargetAtTime(
        SBUtils.clamp01(intensity) * 0.12 * this._vol(), this.ctx.currentTime, 0.08);
    }
  },
  // car horn: two square-wave tones, short and rude
  horn: function () {
    if (!this.started || !this.ctx) return;
    var t = this.ctx.currentTime;
    for (var i = 0; i < 2; i++) {
      this._tone({ type: 'square', freq: i === 0 ? 370 : 440, gain: 0.06, dur: 0.28, at: t });
    }
  },
  // cash-register cha-ching on a mission payout
  chaChing: function () {
    if (!this.started || !this.ctx) return;
    var notes = [1567.98, 2093.0, 2637.0];
    for (var i = 0; i < notes.length; i++) {
      this._tone({ type: 'sine', freq: notes[i], gain: 0.12, dur: 0.25, at: this.ctx.currentTime + i * 0.07 });
    }
  },
  // police radio: two short squelch beeps when a cruiser...
  radioBlip: function () {
    if (!this.started || !this.ctx) return;
    for (var i = 0; i < 2; i++) {
      this._tone({ type: 'square', freq: 1250, gain: 0.05, dur: 0.08, at: this.ctx.currentTime + i * 0.14 });
    }
  },
  // footstep: soft low thud, slightly harder when sprinting
  footstep: function (sprinting) {
    this._noiseHit({
      filter: 'lowpass', freq: 320,
      gain: (sprinting ? 0.09 : 0.05), dur: 0.06
    });
  }
};
