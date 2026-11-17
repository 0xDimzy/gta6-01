// audio.js — WebAudio synth only, no audio files:
// engine hum, two-tone siren loop, gunshots, jingles, ambient music,
// tire screech, police radio blips, footsteps, car radio, wanted stings
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
  screechNodes: null, // persistent looping screech (gain follows drift)
  radioNodes: null, // the car radio: 3 procedural stations
  radioStation: 0, // 0 synthwave, 1 jazz, 2 news
  radioOn: false,
  volume: 0.9, // master volume 0..1, set from the settings panel
  started: false,
  RADIO_NAMES: ['BAY FM — synthwave', 'BAY FM — late jazz', 'BAY FM — news'],
  init: function () {
    if (this.started) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      // engine hum: sawtooth through a lowpass, pitch follows speed
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
    } catch (e) { /* audio unavailable: game stays silent */ }
  },
  resume: function () {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  setVolume: function (v) {
    this.volume = SBUtils.clamp01(v);
    if (this.ctx) {
      // master volume rides the music + radio gains; one-shot blips are
      // quiet enough already, so only the loops get scaled here
      if (this.musicNodes) this.musicNodes.master.gain.value = 0.045 * this.volume;
      if (this.radioNodes) this.radioNodes.master.gain.value = 0.05 * this.volume;
    }
  },
  // speed 0..1 (0 = idle, 1 = top speed); driving true when in a car
  setEngine: function (speed01, driving) {
    if (!this.started || !this.ctx) return;
    var t = this.ctx.currentTime;
    var target = driving ? (0.05 + speed01 * 0.06) * this.volume : 0.0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 140, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, t, 0.1);
  },
  // short UI blip
  blip: function (freq) {
    if (!this.started || !this.ctx) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq || 880;
    g.gain.setValueAtTime(0.12 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.2);
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
    g.gain.setValueAtTime(0.05 * this.volume, t);
    g.gain.setValueAtTime(0.05 * this.volume, t + 0.55);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.7);
  },
  // wanted sting: a dissonant hit when the stars go UP, so the player
  // hears the heat rise even without looking at the stars
  sting: function () {
    if (!this.started || !this.ctx) return;
    var t = this.ctx.currentTime;
    var freqs = [220, 233.08, 311.13];
    for (var i = 0; i < freqs.length; i++) {
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = freqs[i];
      g.gain.setValueAtTime(0.07 * this.volume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.55);
    }
  },
  // police siren loop: setSiren(true) while wanted >= 1, updateSiren(dt) each frame
  setSiren: function (on) {
    if (!this.started || !this.ctx) return;
    if (on && !this.sirenOsc) {
      var o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 700;
      var g = this.ctx.createGain();
      g.gain.value = 0.035 * this.volume;
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
    if (!this.started || !this.ctx) return;
    var t = this.ctx.currentTime;
    var len = Math.floor(this.ctx.sampleRate * 0.16);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = this.ctx.createBufferSource();
    src.buffer = buf;
    var bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.7;
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(bp); bp.connect(g); g.connect(this.ctx.destination);
    src.start(t);
  },
  // shotgun: bigger, lower boom than the pistol
  boom: function () {
    if (!this.started || !this.ctx) return;
    var t = this.ctx.currentTime;
    var len = Math.floor(this.ctx.sampleRate * 0.3);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * (1 - i / len);
    var src = this.ctx.createBufferSource();
    src.buffer = buf;
    var bp = this.ctx.createBiquadFilter();
    bp.type = 'lowpass'; bp.frequency.value = 900;
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(0.8 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(bp); bp.connect(g); g.connect(this.ctx.destination);
    src.start(t);
  },
  // mission complete jingle: rising arpeggio
  jingle: function () {
    if (!this.started || !this.ctx) return;
    var notes = [523.25, 659.25, 783.99, 1046.5];
    for (var i = 0; i < notes.length; i++) {
      var t = this.ctx.currentTime + i * 0.12;
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = notes[i];
      g.gain.setValueAtTime(0.14 * this.volume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.32);
    }
  },
  // ---- ambient music: slow synth pad (Am7: A2 C3 E3 G3), low + warm.
  // starts on the first user gesture, M toggles it.
  startMusic: function () {
    if (!this.started || !this.ctx || this.musicNodes) return;
    var t = this.ctx.currentTime;
    var master = this.ctx.createGain();
    master.gain.value = 0.0;
    master.gain.setTargetAtTime(0.045 * this.volume, t, 1.5);
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
  // ---- car radio: three procedural stations, Y cycles them.
  // synthwave: pulsing bass + arpeggio; jazz: swung seventh chords;
  // news: a spoken-word-ish blip pattern over a low bed.
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
    var t = this.ctx.currentTime;
    var master = this.ctx.createGain();
    master.gain.value = 0.05 * this.volume;
    master.connect(this.ctx.destination);
    var oscs = [];
    var timer = null;
    if (idx === 0) {
      // synthwave: driving 8th-note bass + a bright arpeggio on top
      var bassNotes = [55, 55, 65.41, 49];
      var arpNotes = [220, 261.63, 329.63, 440, 329.63, 261.63];
      var step = 0;
      var self = this;
      var tick = function () {
        if (!self.radioNodes || self.radioStation !== 0) return;
        var tt = self.ctx.currentTime;
        var bn = self.ctx.createOscillator();
        var bg = self.ctx.createGain();
        bn.type = 'sawtooth';
        bn.frequency.value = bassNotes[step % bassNotes.length];
        bg.gain.setValueAtTime(0.09 * self.volume, tt);
        bg.gain.exponentialRampToValueAtTime(0.001, tt + 0.22);
        bn.connect(bg); bg.connect(master);
        bn.start(tt); bn.stop(tt + 0.24);
        var an = self.ctx.createOscillator();
        var ag = self.ctx.createGain();
        an.type = 'square';
        an.frequency.value = arpNotes[(step * 2) % arpNotes.length];
        ag.gain.setValueAtTime(0.035 * self.volume, tt);
        ag.gain.exponentialRampToValueAtTime(0.001, tt + 0.16);
        an.connect(ag); ag.connect(master);
        an.start(tt); an.stop(tt + 0.18);
        step++;
      };
      timer = setInterval(tick, 240);
      tick();
    } else if (idx === 1) {
      // jazz: slow swung seventh chords, one per bar
      var chords = [[220, 261.63, 329.63, 415.3], [196, 246.94, 293.66, 369.99], [174.61, 220, 261.63, 349.23], [146.83, 220, 277.18, 329.63]];
      var bar = 0;
      var self2 = this;
      var playBar = function () {
        if (!self2.radioNodes || self2.radioStation !== 1) return;
        var tt = self2.ctx.currentTime;
        var ch = chords[bar % chords.length];
        for (var i = 0; i < ch.length; i++) {
          var o = self2.ctx.createOscillator();
          var g = self2.ctx.createGain();
          o.type = 'sine';
          o.frequency.value = ch[i];
          g.gain.setValueAtTime(0.05 * self2.volume, tt);
          g.gain.setTargetAtTime(0.001, tt + 1.4, 0.4);
          o.connect(g); g.connect(master);
          o.start(tt); o.stop(tt + 2.2);
          oscs.push(o);
        }
        bar++;
      };
      timer = setInterval(playBar, 1600);
      playBar();
    } else {
      // news: low bed + a morse-ish blip pattern, like a station ident
      var bed = this.ctx.createOscillator();
      bed.type = 'sine';
      bed.frequency.value = 98;
      var bg2 = this.ctx.createGain();
      bg2.gain.value = 0.03 * this.volume;
      bed.connect(bg2); bg2.connect(master);
      bed.start();
      oscs.push(bed);
      var self3 = this;
      var pattern = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0];
      var pi = 0;
      var blipTick = function () {
        if (!self3.radioNodes || self3.radioStation !== 2) return;
        if (pattern[pi % pattern.length] === 1) {
          var tt = self3.ctx.currentTime;
          var o = self3.ctx.createOscillator();
          var g = self3.ctx.createGain();
          o.type = 'square';
          o.frequency.value = 880;
          g.gain.setValueAtTime(0.04 * self3.volume, tt);
          g.gain.exponentialRampToValueAtTime(0.001, tt + 0.09);
          o.connect(g); g.connect(master);
          o.start(tt); o.stop(tt + 0.1);
        }
        pi++;
      };
      timer = setInterval(blipTick, 180);
    }
    this.radioNodes = { master: master, oscs: oscs, timer: timer };
    this.radioOn = true;
  },
  setRadio: function (on) {
    if (!this.started || !this.ctx) return;
    if (on) this._startRadioStation(this.radioStation);
    else this._stopRadio();
  },
  // cycle to the next station; returns the station name for the toast.
  // First press turns the radio on at the current station.
  cycleRadio: function () {
    if (!this.radioOn) {
      this.setRadio(true);
      return this.RADIO_NAMES[this.radioStation];
    }
    this.radioStation = (this.radioStation + 1) % 3;
    if (this.radioOn) this._startRadioStation(this.radioStation);
    return this.RADIO_NAMES[this.radioStation];
  },
  radioName: function () { return this.RADIO_NAMES[this.radioStation]; },
  // skid screech that follows drift intensity: one looping bandpassed
  // noise source whose gain tracks 0..1, so a gentle slide whispers and
  // a hard drift wails; call every frame, 0 when not drifting
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
        SBUtils.clamp01(intensity) * 0.12 * this.volume, this.ctx.currentTime, 0.08);
    }
  },
  // car horn: two square-wave tones, short and rude
  horn: function () {
    if (!this.started || !this.ctx) return;
    var t = this.ctx.currentTime;
    for (var i = 0; i < 2; i++) {
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = 'square';
      o.frequency.value = i === 0 ? 370 : 440;
      g.gain.setValueAtTime(0.06 * this.volume, t);
      g.gain.setTargetAtTime(0.001, t + 0.2, 0.03);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.3);
    }
  },
  // cash-register cha-ching on a mission payout
  chaChing: function () {
    if (!this.started || !this.ctx) return;
    var notes = [1567.98, 2093.0, 2637.0];
    for (var i = 0; i < notes.length; i++) {
      var t = this.ctx.currentTime + i * 0.07;
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = notes[i];
      g.gain.setValueAtTime(0.12 * this.volume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.26);
    }
  },
  // police radio: two short squelch beeps when a cruiser joins the chase
  radioBlip: function () {
    if (!this.started || !this.ctx) return;
    for (var i = 0; i < 2; i++) {
      var t = this.ctx.currentTime + i * 0.14;
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = 'square'; o.frequency.value = 1250;
      g.gain.setValueAtTime(0.05 * this.volume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.09);
    }
  },
  // footstep: soft low thud, slightly harder when sprinting
  footstep: function (sprinting) {
    if (!this.started || !this.ctx) return;
    var t = this.ctx.currentTime;
    var len = Math.floor(this.ctx.sampleRate * 0.06);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = this.ctx.createBufferSource();
    src.buffer = buf;
    var lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 320;
    var g = this.ctx.createGain();
    g.gain.setValueAtTime((sprinting ? 0.09 : 0.05) * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    src.connect(lp); lp.connect(g); g.connect(this.ctx.destination);
    src.start(t);
  }
};
