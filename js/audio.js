'use strict';
/* ============================================================
   LEMMINGS (fan recreation) - audio
   All sound effects are synthesised with WebAudio; music is a tiny
   chiptune sequencer playing public-domain tunes.
   ============================================================ */
var LM = window.LM = window.LM || {};

LM.snd = (function () {
  var ctx = null, master = null, last = {}, musicOn = true, fxOn = true, voiceOn = true;
  var seqTimer = null, seqTrack = 0, seqPos = 0, seqNext = 0, playing = false;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    /* iOS/Safari only unlock audio from inside a gesture: play one silent sample */
    try { var sb = ctx.createBuffer(1, 1, 22050), ss = ctx.createBufferSource(); ss.buffer = sb; ss.connect(ctx.destination); ss.start(0); } catch (e) { }
  }
  function tone(f, dur, type, vol, slideTo, delay) {
    if (!ctx) return; var t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  var noiseBuf = null;
  function noise(dur, vol, freq, q, type, delay) {
    if (!ctx) return;
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var t = ctx.currentTime + (delay || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type || 'lowpass'; f.frequency.value = freq || 1000; f.Q.value = q || 1;
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function say(text, pitch, rate) {
    if (!voiceOn || !('speechSynthesis' in window)) return false;
    try {
      if (window.speechSynthesis.speaking) return true;
      var u = new SpeechSynthesisUtterance(text); u.pitch = pitch || 2; u.rate = rate || 1.25; u.volume = 0.9;
      window.speechSynthesis.speak(u); return true;
    } catch (e) { return false; }
  }

  var FX = {
    click: function () { tone(880, 0.04, 'square', 0.08); },
    assign: function () { tone(660, 0.05, 'square', 0.09); tone(990, 0.07, 'square', 0.09, 0, 0.05); },
    door: function () { noise(0.35, 0.18, 400, 1, 'lowpass'); tone(110, 0.3, 'sawtooth', 0.1, 70); if (!say("Let's go!", 2, 1.1)) { tone(500, 0.1, 'square', 0.1, 0, 0.3); tone(750, 0.15, 'square', 0.1, 0, 0.4); } },
    ohno: function () { if (!say('Oh no!', 2, 1.3)) tone(800, 0.5, 'triangle', 0.18, 180); },
    pop: function () { noise(0.45, 0.35, 900, 0.7, 'lowpass'); tone(220, 0.4, 'sawtooth', 0.18, 35); },
    splat: function () { noise(0.18, 0.28, 420, 1, 'lowpass'); tone(110, 0.15, 'square', 0.15, 45); },
    yippee: function () { [620, 830, 1040, 1380].forEach(function (f, i) { tone(f, 0.07, 'square', 0.08, 0, i * 0.055); }); },
    dig: function () { noise(0.05, 0.1, 1800, 2, 'bandpass'); },
    bash: function () { noise(0.07, 0.16, 700, 1, 'lowpass'); tone(130, 0.06, 'square', 0.08, 80); },
    mine: function () { noise(0.07, 0.14, 1200, 2, 'bandpass'); tone(180, 0.06, 'square', 0.07, 100); },
    chink: function () { tone(2200, 0.06, 'square', 0.1); tone(3100, 0.08, 'square', 0.07, 0, 0.03); },
    plink: function () { tone(1250, 0.03, 'square', 0.05); },
    ping: function () { tone(1760, 0.16, 'sine', 0.18); },
    drown: function () { tone(280, 0.25, 'sine', 0.15, 700); tone(340, 0.2, 'sine', 0.1, 800, 0.12); },
    fire: function () { noise(0.45, 0.22, 2200, 0.6, 'bandpass'); tone(300, 0.4, 'sawtooth', 0.06, 120); },
    win: function () { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(f, 0.16, 'square', 0.1, 0, i * 0.14); }); },
    lose: function () { [392, 349, 311, 262].forEach(function (f, i) { tone(f, 0.24, 'triangle', 0.18, 0, i * 0.2); }); }
  };

  /* ---------- music: [midi, beats] ---------- */
  var TUNES = [
    { bpm: 132, notes: [   /* Ode to Joy (Beethoven) */
      [64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1], [60, 1], [60, 1], [62, 1], [64, 1], [64, 1.5], [62, 0.5], [62, 2],
      [64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1], [60, 1], [60, 1], [62, 1], [64, 1], [62, 1.5], [60, 0.5], [60, 2],
      [62, 1], [62, 1], [64, 1], [60, 1], [62, 1], [64, 0.5], [65, 0.5], [64, 1], [60, 1], [62, 1], [64, 0.5], [65, 0.5], [64, 1], [62, 1], [60, 1], [62, 1], [55, 2]] },
    { bpm: 150, notes: [   /* Fur Elise (Beethoven) */
      [76, 0.5], [75, 0.5], [76, 0.5], [75, 0.5], [76, 0.5], [71, 0.5], [74, 0.5], [72, 0.5], [69, 1.5], [0, 0.5],
      [60, 0.5], [64, 0.5], [69, 0.5], [71, 1.5], [0, 0.5], [64, 0.5], [68, 0.5], [71, 0.5], [72, 1.5], [0, 0.5],
      [64, 0.5], [76, 0.5], [75, 0.5], [76, 0.5], [75, 0.5], [76, 0.5], [71, 0.5], [74, 0.5], [72, 0.5], [69, 1.5], [0, 0.5],
      [60, 0.5], [64, 0.5], [69, 0.5], [71, 1.5], [0, 0.5], [64, 0.5], [72, 0.5], [71, 0.5], [69, 2], [0, 1]] },
    { bpm: 156, notes: [   /* original little march */
      [60, 0.5], [64, 0.5], [67, 0.5], [64, 0.5], [60, 0.5], [64, 0.5], [67, 1], [65, 0.5], [69, 0.5], [72, 0.5], [69, 0.5], [65, 0.5], [69, 0.5], [72, 1],
      [67, 0.5], [71, 0.5], [74, 0.5], [71, 0.5], [67, 0.5], [71, 0.5], [74, 1], [72, 0.5], [67, 0.5], [64, 0.5], [67, 0.5], [60, 2]] }
  ];
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function sched() {
    if (!ctx || !playing) return;
    var tune = TUNES[seqTrack % TUNES.length], spb = 60 / tune.bpm;
    if (seqNext < ctx.currentTime) seqNext = ctx.currentTime + 0.05;
    while (seqNext < ctx.currentTime + 0.4) {
      var n = tune.notes[seqPos], dur = n[1] * spb;
      if (n[0] > 0) {
        var t = seqNext, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'square'; o.frequency.value = mtof(n[0] + 12); f.type = 'lowpass'; f.frequency.value = 2400;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.92);
        o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
        var b = ctx.createOscillator(), bg = ctx.createGain();
        b.type = 'triangle'; b.frequency.value = mtof(n[0] - 12);
        bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(0.06, t + 0.01); bg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.9);
        b.connect(bg); bg.connect(master); b.start(t); b.stop(t + dur);
      }
      seqNext += dur; seqPos++;
      if (seqPos >= tune.notes.length) { seqPos = 0; }
    }
  }

  return {
    init: init,
    play: function (name) {
      if (!ctx || !fxOn) return;
      var now = ctx.currentTime, gap = { dig: 0.07, bash: 0.07, mine: 0.07, plink: 0.05, ohno: 0.3, pop: 0.05, chink: 0.08, assign: 0.04 }[name] || 0.02;
      if (last[name] && now - last[name] < gap) return;
      last[name] = now;
      if (FX[name]) FX[name]();
    },
    startMusic: function (track) {
      if (!ctx) return; playing = musicOn; seqTrack = track || 0; seqPos = 0; seqNext = 0;
      clearInterval(seqTimer); if (playing) seqTimer = setInterval(sched, 100);
    },
    stopMusic: function () { playing = false; clearInterval(seqTimer); },
    toggleMusic: function () {
      musicOn = !musicOn; if (!musicOn) this.stopMusic();
      return musicOn;
    },
    musicOn: function () { return musicOn; },
    setFx: function (v) { fxOn = v; },
    cancelSpeech: function () { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { } }
  };
})();
