'use strict';
/* ============================================================
   LEMMINGS (fan recreation) - screens, layout, input, main loop

   Layouts (the page always fills the whole window, no bars):
     menu      320x200 "virtual screen" centred on a tiled background
     desktop   world canvas + classic canvas panel (wide windows, mouse)
     portrait  HUD + world + minimap on top, big touch buttons below
     landscape HUD + world (+minimap) left, big touch buttons right
   ============================================================ */
var LM = window.LM = window.LM || {};

LM.app = (function () {
  var app = {};
  var W = 320, H = 200, HUDH = 32;                 /* virtual menu screen / HUD band height */
  var cv, ctx, pcv, pctx, mcv, mctx, stage, left, minibox, tpanel;
  var touchMode = false, layDirty = true, layKind = '';
  var lay = { mode: 'menu', LW: 320, LH: 200, ox: 0, oy: 0, worldY: 0, kcss: 1, K: 1, dpr: 1 };
  var mouse = { x: 0, y: 0, over: false }, keys = {}, screen = 'title', game = null, levelIdx = 0, ratingIdx = 0, fade = null;
  var bgTitle, bgLeaf, bgW = 0, bgH = 0, logo, introPrev, result = null, codeBuf = '', codeMsg = '';
  var lastT = 0, acc = 0, frameN = 0, quitConfirm = false, ff = false, rdrag = null, mapDrag = false, arrowDir = 0, gest = null;
  var audioStarted = false, curNow = '', CUR = {}, dom = { btn: {} }, fsTried = false;

  /* ---------- colour presets for the menu font ---------- */
  var COL = {
    red: ['#ffa0a0', '#d82020'], blue: ['#a8c4ff', '#2848e8'], green: ['#a8ffa8', '#12a020'], orange: ['#fcd8a0', '#c87820'],
    cyan: ['#a8f8f8', '#10a8c0'], magenta: ['#fcb0fc', '#b820b8'], white: ['#ffffff', '#c0c4e0'], teal: ['#b0f8f0', '#20a89c'], grey: ['#a0a0b0', '#606070']
  };
  function mf(c) { return LM.menuFont(COL[c][0], COL[c][1]); }
  function txt(s, x, y, c) { LM.drawText(ctx, mf(c), s, x, y); }
  function txtC(s, y, c, cx) { LM.drawTextC(ctx, mf(c), s, cx === undefined ? W / 2 : cx, y); }

  /* ---------- backgrounds (generated to fill the whole canvas) ---------- */
  function makeBg(fn, w, h) {
    var c = LM.mk(w, h), g = c.getContext('2d'), id = g.createImageData(w, h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var col = fn(x, y), o = (y * w + x) * 4; id.data[o] = col[0]; id.data[o + 1] = col[1]; id.data[o + 2] = col[2]; id.data[o + 3] = 255;
    }
    g.putImageData(id, 0, 0); return c;
  }
  function pick(pal, v) { return pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v * pal.length)))]; }
  function makeBackgrounds(w, h) {
    bgW = w; bgH = h;
    var earth = ['#2a0e06', '#3e1a0c', '#561f0e', '#6e2c14', '#8a3c1c'].map(LM.rgb);
    bgTitle = makeBg(function (x, y) { return pick(earth, LM.vnoise(x / 4, y / 3, 31) * 0.6 + LM.hash(x, y, 32) * 0.4); }, w, h);
    var leaf = ['#07220f', '#0c3a1a', '#145a2a', '#1c7a38', '#0a2c14'].map(LM.rgb);
    bgLeaf = makeBg(function (x, y) {
      var v = LM.vnoise(x / 3.2, y / 3.2, 41) * 0.65 + LM.vnoise(x / 9, y / 7, 42) * 0.3 + LM.hash(x, y, 43) * 0.15;
      return pick(leaf, (v - 0.1) / 0.85);
    }, w, h);
  }
  function makeLogo() {
    var c = LM.mk(156, 44), g = c.getContext('2d');
    g.font = 'italic 900 29px "Arial Black", Impact, "Segoe UI Black", sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
    var tw = g.measureText('Lemmings').width; if (tw > 142) g.font = 'italic 900 ' + Math.floor(29 * 142 / tw) + 'px "Arial Black", Impact, "Segoe UI Black", sans-serif';
    g.lineJoin = 'round'; g.strokeStyle = '#f0e020'; g.lineWidth = 5; g.strokeText('Lemmings', 78, 23);
    var gr = g.createLinearGradient(0, 6, 0, 40); gr.addColorStop(0, '#58e060'); gr.addColorStop(0.5, '#1ea030'); gr.addColorStop(1, '#0c6a1c');
    g.fillStyle = gr; g.fillText('Lemmings', 78, 23);
    var id = g.getImageData(0, 0, 156, 44), d = id.data;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 130) { d[i + 3] = 0; continue; } d[i + 3] = 255;
      d[i] = Math.round(d[i] / 24) * 24; d[i + 1] = Math.round(d[i + 1] / 24) * 24; d[i + 2] = Math.round(d[i + 2] / 24) * 24;
    }
    g.putImageData(id, 0, 0); logo = c;
  }
  function sprScaled(name, frame, dir, x, y, s) {
    var fr = LM.SPR[name][frame][dir < 0 ? 1 : 0];
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fr, Math.round(x - LM.SPR.ax * s), Math.round(y - LM.SPR.ay * s), fr.width * s, fr.height * s);
  }

  /* ---------- fade / screen transitions ---------- */
  function go(fn) { if (fade) return; fade = { t: 0, dir: 1, fn: fn }; }
  function updFade() {
    if (!fade) return;
    fade.t += 1;
    if (fade.dir === 1 && fade.t >= 9) { fade.fn(); fade.dir = -1; fade.t = 0; }
    else if (fade.dir === -1 && fade.t >= 9) fade = null;
  }
  function drawFade() {
    if (!fade) return;
    var a = fade.dir === 1 ? fade.t / 9 : 1 - fade.t / 9;
    ctx.fillStyle = 'rgba(0,0,0,' + Math.max(0, Math.min(1, a)) + ')'; ctx.fillRect(0, 0, lay.LW, lay.LH);
  }

  /* ---------- screen switching ---------- */
  function toTitle() { screen = 'title'; game = null; quitConfirm = false; ff = false; gest = null; if (audioStarted) LM.snd.startMusic(2); LM.snd.cancelSpeech(); }
  function showIntro(i) {
    levelIdx = i; game = new LM.Game(LM.LEVELS[i]); screen = 'intro';
    var pw = Math.min(220, Math.floor(game.W / 6)), ph = Math.round(160 / 6);
    introPrev = game.preview(pw, ph);
    if (audioStarted) LM.snd.stopMusic();
  }
  function startPlay() { screen = 'play'; acc = 0; ff = false; quitConfirm = false; gest = null; if (audioStarted) LM.snd.startMusic(levelIdx % 3); }
  function finishLevel() {
    result = game.result(); screen = 'result'; gest = null;
    LM.snd.stopMusic(); LM.snd.cancelSpeech(); LM.snd.play(result.ok ? 'win' : 'lose');
  }

  /* ---------- result messages ---------- */
  function resultText(r) {
    var p = r.pct, n = r.needPct;
    if (r.ok) {
      if (p >= 100) return ['Superb! You rescued every lemming', 'on that level. Can you do it again....'];
      if (p === n) return ['SPOT ON. You can\'t get much closer', 'than that. Let\'s try the next....'];
      if (p - n >= 25) return ['That level seemed no problem to you on', 'that attempt. Onto the next....'];
      return ['Well done. You scraped through that', 'one. Let\'s see how you do on the next....'];
    }
    if (r.saved === 0) return ['ROCK BOTTOM! I hope for your sake', 'that you nuked that level.'];
    if (p < n / 2) return ['Better rethink your strategy before', 'you try this level again!'];
    if (p < n - 10) return ['A little more practice on this level', 'is definitely recommended.'];
    return ['ARRGHH! So close! Just a few more', 'lemmings and that would have done it.'];
  }

  /* ---------- menu screens (drawn in 320x200 virtual coordinates) ---------- */
  var SIGNS = [
    { id: 'play', cx: 32, col: ['#1c8a2c', '#2cc040'] }, { id: 'help', cx: 96, col: ['#14806c', '#20c0a8'] },
    { id: 'code', cx: 160, col: ['#2848c8', '#5078f0'] }, { id: 'music', cx: 224, col: ['#c8b018', '#f8e040'] },
    { id: 'rating', cx: 288, col: ['#8a4a20', '#c88040'] }
  ];
  var SY = 134, SW = 56, SH = 46;
  function signAt(x, y) {
    for (var i = 0; i < SIGNS.length; i++) if (x >= SIGNS[i].cx - SW / 2 && x < SIGNS[i].cx + SW / 2 && y >= SY - 22 && y < SY + SH) return SIGNS[i];
    return null;
  }
  function drawTitle() {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(logo, 8, 6, 304, 88);
    sprScaled('fall', 0, 1, 40, 94, 3); sprScaled('walk', 1, -1, 168, 62, 3); sprScaled('exit', 2, 1, 276, 60, 3);
    var hov = (!touchMode && mouse.over) ? signAt(mouse.x - lay.ox, mouse.y - lay.oy) : null;
    SIGNS.forEach(function (s) {
      var bx = s.cx - SW / 2, by = SY + (hov === s ? -2 : 0);
      sprScaled('block', 0, 1, s.cx, by + 8, 3);
      ctx.fillStyle = '#f8cab8'; ctx.fillRect(bx - 4, by - 2, 5, 6); ctx.fillRect(bx + SW - 1, by - 2, 5, 6);
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, SW + 2, SH + 2);
      ctx.fillStyle = s.col[0]; ctx.fillRect(bx, by, SW, SH);
      ctx.fillStyle = s.col[1]; ctx.fillRect(bx, by, SW, 2); ctx.fillRect(bx, by, 2, SH);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(bx, by + SH - 2, SW, 2); ctx.fillRect(bx + SW - 2, by, 2, SH);
      if (hov === s) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(bx, by, SW, SH); }
      var f = mf('white');
      if (s.id === 'play') { ctx.drawImage(f.glyphs['1'], bx + 6, by + 5, f.glyphs['1'].width * 2, f.glyphs['1'].height * 2); LM.drawText(ctx, f, 'PLAYER', bx + 4, by + 30); }
      else if (s.id === 'help') { LM.drawTextC(ctx, f, 'HOW TO', s.cx, by + 8); LM.drawTextC(ctx, f, 'PLAY', s.cx, by + 26); }
      else if (s.id === 'code') { LM.drawTextC(ctx, f, 'NEW', s.cx, by + 8); LM.drawTextC(ctx, f, 'LEVEL', s.cx, by + 26); }
      else if (s.id === 'music') {
        ctx.fillStyle = '#101010'; ctx.fillRect(bx + 22, by + 6, 3, 18); ctx.fillRect(bx + 28, by + 4, 3, 18); ctx.fillRect(bx + 22, by + 6, 9, 3);
        ctx.fillRect(bx + 16, by + 21, 8, 5); ctx.fillRect(bx + 22, by + 19, 8, 5);
        LM.drawTextC(ctx, mf('white'), LM.snd.musicOn() ? 'ON' : 'OFF', s.cx, by + 30);
      } else {
        LM.drawTextC(ctx, f, LM.RATINGS[ratingIdx].toUpperCase(), s.cx, by + 28);
        ctx.fillStyle = '#f8f8ff';
        ctx.beginPath(); ctx.moveTo(s.cx, by + 5); ctx.lineTo(s.cx + 7, by + 15); ctx.lineTo(s.cx - 7, by + 15); ctx.fill();
      }
    });
    txtC('Fan recreation - not the original', 184, 'grey');
  }
  function drawIntro() {
    var L = LM.LEVELS[levelIdx];
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(introPrev, Math.round((W - introPrev.width) / 2), Math.round((54 - introPrev.height) / 2));
    txt('Level ' + (levelIdx + 1), 8, 66, 'red'); txt(L.title, 76, 66, 'red');
    var y = 98, x = 62;
    txt('Number of Lemmings ' + L.num, x, y, 'blue');
    txt(L.save + '% To Be Saved', x, y + 16, 'green');
    txt('Release Rate ' + L.rate, x, y + 32, 'orange');
    txt('Time    ' + L.time + ' Minutes', x, y + 48, 'cyan');
    txt('Rating  ' + L.rating, x, y + 64, 'magenta');
    txtC(touchMode ? 'Tap to continue' : 'Press mouse button to continue', 184, 'blue');
    ctx.fillStyle = '#c02020'; ctx.fillRect(268, 176, 30, 10); ctx.fillStyle = '#f0f0f0'; ctx.fillRect(268, 172, 8, 5);
    LM.blitSpr(ctx, 'shrug', 0, 1, 284, 175); txt('z', 258, 166, 'blue'); txt('Z', 250, 158, 'blue');
  }
  function drawResult() {
    var r = result;
    txtC(r.reason === 'time' ? 'Your time is up!' : 'All lemmings accounted for.', 12, 'teal');
    txtC('You needed ' + r.needPct + '%', 46, 'magenta', 130); txtC('You rescued ' + r.pct + '%', 62, 'magenta', 130);
    var m = resultText(r);
    txtC(m[0], 90, 'red'); txtC(m[1], 106, 'red');
    if (r.ok && levelIdx + 1 < LM.LEVELS.length) {
      txtC('Your access code for Level ' + (levelIdx + 2), 130, 'orange'); txtC('is ' + LM.levelCode(levelIdx + 1), 146, 'orange');
    } else if (r.ok) { txtC('You have completed every level!', 138, 'orange'); }
    if (touchMode) { txtC(r.ok ? 'Tap to continue' : 'Tap to retry', 166, 'cyan'); txtC('[ Menu ]', 182, 'cyan'); }
    else { txtC(r.ok ? 'Press left mouse button to continue' : 'Press left mouse button to retry', 166, 'cyan'); txtC('Press right mouse button for menu', 182, 'cyan'); }
    ctx.fillStyle = '#2832c8'; ctx.fillRect(262, 30, 12, 14); ctx.fillStyle = '#4858f0'; ctx.fillRect(262, 30, 3, 14);
    ctx.fillStyle = '#f0a0b0'; ctx.fillRect(258, 44, 20, 12); ctx.fillRect(254, 50, 10, 8); ctx.fillStyle = '#fcc8d0'; ctx.fillRect(260, 45, 12, 2);
  }
  function drawHelp() {
    txtC('HOW TO PLAY', 8, 'red');
    var L = touchMode ? [
      ['Guide the lemmings from the hatch', 'green'], ['to the exit. Save enough to win!', 'green'],
      ['1. Tap a skill button.', 'cyan'], ['2. Tap a lemming to give it the skill.', 'cyan'],
      ['Drag the level or the map to scroll.', 'cyan'], ['PAUSE and FAST are the big buttons.', 'orange'],
      ['Tap NUKE twice to blow them all up.', 'orange'], ['Climber and Floater stay for good.', 'blue'],
      ['Bomber: 5 second fuse. Blocker turns', 'blue'], ['the others around. MENU quits.', 'blue']
    ] : [
      ['Guide the lemmings from the hatch', 'green'], ['to the exit. Save enough to win!', 'green'],
      ['Pick a skill in the panel, then click', 'cyan'], ['a lemming to give it that skill.', 'cyan'],
      ['Climber and Floater stay for good.', 'orange'], ['Bomber: 5 second fuse.  Blocker', 'orange'], ['turns others around.', 'orange'],
      ['Scroll: screen edge / right drag /', 'blue'], ['wheel / arrow keys / minimap.', 'blue'],
      ['Keys: 1-8 skills  SPACE pause', 'magenta'], ['+ - speed  F fast-forward', 'magenta'], ['N N nuke  M music  ESC quit', 'magenta']];
    L.forEach(function (l, i) { txtC(l[0], 26 + i * 12, l[1]); });
    txtC(touchMode ? 'Tap to go back' : 'Press mouse button to go back', 182, 'white');
  }
  function drawCode() {
    txtC('Enter your access code', 40, 'cyan');
    var shown = codeBuf + ((frameN >> 4) & 1 ? '_' : ' ');
    ctx.fillStyle = '#000'; ctx.fillRect(60, 80, 200, 26); ctx.fillStyle = '#2848c8'; ctx.fillRect(61, 81, 198, 24); ctx.fillStyle = '#000'; ctx.fillRect(63, 83, 194, 20);
    txtC(shown, 87, 'white');
    if (codeMsg) txtC(codeMsg, 120, 'red');
    txtC('Type the letters and press ENTER', 150, 'green');
    txtC('ESC or right-click to go back', 166, 'grey');
  }

  /* ---------- system cursors (crosshair / bracket / arrow) ---------- */
  var ARROW = ['X..........', 'XX.........', 'X#X........', 'X##X.......', 'X###X......', 'X####X.....', 'X#####X....', 'X######X...', 'X#####XX...', 'X##X##X....', 'X#X.X##X...', 'XX..X##X...', 'X....X##X..', '.....X##X..', '......XX...'];
  function makeCursors() {
    var a = LM.mk(11, 15), g = a.getContext('2d');
    for (var r = 0; r < ARROW.length; r++) for (var c = 0; c < 11; c++) {
      var ch = ARROW[r][c]; if (ch === '.') continue; g.fillStyle = ch === 'X' ? '#000' : '#fff'; g.fillRect(c, r, 1, 1);
    }
    CUR.arrow = LM.cursorCSS(a, 2, 0, 0, 'default');
    CUR.cross = LM.cursorCSS(LM.curCross, 2, 7, 7, 'crosshair');
    CUR.box = LM.cursorCSS(LM.curBox, 2, 7, 7, 'crosshair');
  }
  function setCursor(c) { if (curNow !== c) { curNow = c; cv.style.cursor = c; pcv.style.cursor = c; } }

  /* ============================================================
     LAYOUT - choose an integer pixel scale and fill the window
     ============================================================ */
  function setSize(el, w, h) { el.style.width = w + 'px'; el.style.height = h + 'px'; }
  function applyLayout() {
    layDirty = false;
    var dpr = window.devicePixelRatio || 1, vp = window.visualViewport;
    var vw = Math.max(120, Math.floor(vp ? vp.width : window.innerWidth)), vh = Math.max(120, Math.floor(vp ? vp.height : window.innerHeight));
    var vwD = Math.round(vw * dpr), vhD = Math.round(vh * dpr), L = { dpr: dpr, vw: vw, vh: vh, ox: 0, oy: 0, worldY: 0 };
    var playing = screen === 'play' && !!game;
    layKind = playing ? 'play' : 'menu';
    if (!playing) {
      /* small screens: use the exact fractional scale so the menu fills the width; big screens: crisp integer scale */
      var kf = Math.min(vwD / W, vhD / H);
      L.mode = 'menu'; L.K = Math.max(1, kf >= 4 ? Math.floor(kf) : Math.floor(kf * 100) / 100);
      L.LW = Math.ceil(vwD / L.K); L.LH = Math.ceil(vhD / L.K);
      L.ox = Math.floor((L.LW - W) / 2); L.oy = Math.floor((L.LH - H) / 2);
    } else {
      var Kd = Math.max(1, Math.floor(vhD / 200));
      if (!touchMode && vw >= vh * 0.9 && Math.ceil(vwD / Kd) >= 320) L.mode = 'desktop';
      else L.mode = vw >= vh ? 'landscape' : 'portrait';
      if (L.mode === 'desktop') {
        L.K = Kd; L.LW = Math.ceil(vwD / Kd); L.LH = 160; L.PW = L.LW; L.PH = Math.ceil(vhD / Kd) - 160;
      } else if (L.mode === 'portrait') {
        /* biggest scale that still shows >=170 world pixels across and leaves >=250 css px for the buttons */
        var best = 0, kk;
        for (kk = 1; kk <= 40; kk++) if (Math.ceil(vwD / kk) >= 170 && (HUDH + 160) * kk / dpr + 56 + 250 <= vh) best = kk;
        if (!best) best = Math.max(1, Math.floor(Math.min(vwD / 170, vhD * 0.45 / (HUDH + 160))));
        L.K = best; L.LW = Math.ceil(vwD / best); L.LH = HUDH + 160; L.worldY = HUDH;
      } else {
        var k2 = Math.max(1, Math.floor(vhD / (HUDH + 160))), lw2 = Math.floor((vwD - 230 * dpr) / k2);
        while (lw2 < 200 && k2 > 1) { k2--; lw2 = Math.floor((vwD - 230 * dpr) / k2); }
        L.K = k2; L.LW = Math.max(160, lw2); L.LH = HUDH + 160; L.worldY = HUDH;
      }
    }
    L.kcss = L.K / dpr;
    lay = L;
    document.body.className = 'm-' + L.mode;
    if (cv.width !== L.LW) cv.width = L.LW;
    if (cv.height !== L.LH) cv.height = L.LH;
    setSize(cv, L.LW * L.kcss, L.LH * L.kcss);
    if (L.mode === 'desktop') {
      if (pcv.width !== L.PW) pcv.width = L.PW;
      if (pcv.height !== L.PH) pcv.height = L.PH;
      setSize(pcv, L.PW * L.kcss, L.PH * L.kcss);
    }
    left.style.width = L.mode === 'landscape' ? (L.LW * L.kcss) + 'px' : '';
    if (playing) { game.viewW = L.LW; game.scrollBy(0); sizeMini(); }
    curNow = '';
  }
  function sizeMini() {
    if (lay.mode !== 'portrait' && lay.mode !== 'landscape') return;
    var r = minibox.getBoundingClientRect(), p = 2;       /* 2 css px per minimap pixel */
    var w = Math.max(60, Math.floor((r.width - 8) / p)), h = Math.max(16, Math.min(56, Math.floor((r.height - 8) / p)));
    if (mcv.width !== w) mcv.width = w;
    if (mcv.height !== h) mcv.height = h;
    setSize(mcv, w * p, h * p);
  }

  /* ============================================================
     TOUCH PANEL (DOM): big, labelled buttons
     ============================================================ */
  var SKL = { climber: 'CLIMB', floater: 'FLOAT', bomber: 'BOMB', blocker: 'BLOCK', builder: 'BUILD', basher: 'BASH', miner: 'MINE', digger: 'DIG' };
  function drawPlate(c, s) {
    var g = c.getContext('2d'); g.fillStyle = '#d4d4de'; g.fillRect(0, 0, 14, 7);
    if (s) { if (s.length === 1) s = ' ' + s; LM.drawDigits(g, s, 1, 1, '#101018', 2); }
  }
  function mkBtn(id, icon, label, plate) {
    var d = document.createElement('div'); d.className = 'btn'; d.id = 'b-' + id; d.setAttribute('role', 'button'); d.setAttribute('aria-label', label);
    var b = { el: d, v: null, l: label, c: {} };
    if (plate) { b.plate = document.createElement('canvas'); b.plate.width = 14; b.plate.height = 7; b.plate.className = 'plate'; d.appendChild(b.plate); }
    var im = new Image(); im.className = 'ico'; im.draggable = false; im.src = LM.ICON[icon].toDataURL(); d.appendChild(im);
    b.lbl = document.createElement('span'); b.lbl.className = 'lbl'; b.lbl.textContent = label; d.appendChild(b.lbl);
    d.addEventListener('pointerdown', function (e) {
      e.preventDefault(); noteTouch(e); startAudio(); if (fade || !game || screen !== 'play') return;
      d.classList.add('down'); doAction(id);
    });
    dom.btn[id] = b; return d;
  }
  function buildDom() {
    tpanel.innerHTML = '';
    var sk = document.createElement('div'); sk.id = 'skills'; sk.className = 'grid';
    var ct = document.createElement('div'); ct.id = 'ctrls'; ct.className = 'grid';
    LM.SKILLS.forEach(function (s) { sk.appendChild(mkBtn(s, s, SKL[s], true)); });
    [['rrminus', 'rrminus', 'RATE -', true], ['rrplus', 'rrplus', 'RATE +', true], ['pause', 'pausebars', 'PAUSE', false],
     ['ff', 'ff', 'FAST', false], ['nuke', 'nuke', 'NUKE', false], ['quit', 'quit', 'MENU', false]].forEach(function (c) { ct.appendChild(mkBtn(c[0], c[1], c[2], c[3])); });
    tpanel.appendChild(sk); tpanel.appendChild(ct);
  }
  function setCls(b, cls, on) { if (b.c[cls] !== on) { b.el.classList.toggle(cls, on); b.c[cls] = on; } }
  function setLbl(b, s) { if (b.l !== s) { b.lbl.textContent = s; b.l = s; } }
  function updateDom() {
    var g = game, b;
    LM.SKILLS.forEach(function (s) {
      b = dom.btn[s]; var v = g.skills[s];
      if (b.v !== v) { drawPlate(b.plate, v === 0 ? '' : String(v)); b.v = v; }
      setCls(b, 'zero', v === 0); setCls(b, 'sel', g.sel === s);
    });
    ['rrminus', 'rrplus'].forEach(function (id) { b = dom.btn[id]; if (b.v !== g.rate) { drawPlate(b.plate, String(g.rate)); b.v = g.rate; } });
    b = dom.btn.pause; setCls(b, 'on', g.paused); setLbl(b, g.paused ? 'RESUME' : 'PAUSE');
    b = dom.btn.ff; setCls(b, 'on', ff);
    b = dom.btn.nuke; setCls(b, 'on', g.nuked || g.nukeArm > 0); setLbl(b, g.nuked ? 'NUKING' : g.nukeArm > 0 ? 'SURE?' : 'NUKE');
    b = dom.btn.quit; setCls(b, 'on', quitConfirm); setLbl(b, quitConfirm ? 'QUIT?' : 'MENU');
    mctx.imageSmoothingEnabled = false; mctx.fillStyle = '#0b0806'; mctx.fillRect(0, 0, mcv.width, mcv.height);
    g.drawMiniWidget(mctx, 0, 0, mcv.width, mcv.height);
  }

  /* ---------- actions shared by canvas panel, touch panel and keyboard ---------- */
  function nukeTap() { if (!game || game.nuked) return; if (game.nukeArm > 0) { game.nuke(); game.nukeArm = 0; } else game.nukeArm = 110; }
  function doAction(id) {
    if (!game) return;
    if (id !== 'quit') quitConfirm = false;
    if (id === 'rrminus') { game.rrHold = -1; game.rrT = 0; }
    else if (id === 'rrplus') { game.rrHold = 1; game.rrT = 0; }
    else if (id === 'pause') { game.paused = !game.paused; LM.snd.play('click'); }
    else if (id === 'ff') { ff = !ff; LM.snd.play('click'); }
    else if (id === 'nuke') nukeTap();
    else if (id === 'quit') { if (quitConfirm) go(toTitle); else quitConfirm = true; }
    else { game.sel = id; LM.snd.play('click'); }
  }
  var PANEL_IDS = ['rrminus', 'rrplus'].concat(LM.SKILLS).concat(['pause', 'nuke']);
  function miniPress(x) {
    var m = game.miniRect; if (!m) return;
    if (x < m.wx + m.aw) arrowDir = -1; else if (x >= m.wx + m.ww - m.aw) arrowDir = 1;
    else { mapDrag = true; game.scrollTo(((x - m.x) / m.w) * game.W - game.viewW / 2); }
  }
  function miniMove(x) { var m = game.miniRect; if (mapDrag && m) game.scrollTo(((x - m.x) / m.w) * game.W - game.viewW / 2); }

  /* ---------- rendering ---------- */
  function renderMenu() {
    if (bgW !== lay.LW || bgH !== lay.LH) makeBackgrounds(lay.LW, lay.LH);
    ctx.drawImage(screen === 'title' ? bgTitle : bgLeaf, 0, 0);
    if (screen === 'intro') { ctx.fillStyle = LM.BG; ctx.fillRect(0, 0, lay.LW, lay.oy + 54); ctx.fillStyle = '#000'; ctx.fillRect(0, lay.oy + 54, lay.LW, 1); }
    ctx.save(); ctx.translate(lay.ox, lay.oy);
    switch (screen) {
      case 'title': drawTitle(); break; case 'help': drawHelp(); break; case 'code': drawCode(); break;
      case 'intro': drawIntro(); break; case 'result': drawResult(); break;
    }
    ctx.restore();
    setCursor(CUR.arrow);
  }
  function ovC(s, y, c) { LM.drawTextC(ctx, mf(c), s, lay.LW / 2, y); }
  function renderPlay() {
    var desk = lay.mode === 'desktop', hov = null;
    if (desk && mouse.over && !quitConfirm) hov = game.pick(mouse.x + Math.round(game.scrollX), mouse.y, 2);
    if (!desk) game.drawInfoCompact(ctx, lay.LW);
    ctx.save(); ctx.translate(0, lay.worldY);
    game.drawWorld(ctx, lay.LW);
    if (ff) LM.drawText(ctx, mf('red'), '>>', lay.LW - 18, 2);
    if (game.paused && !quitConfirm) ovC('PAUSED', 70, 'white');
    if (quitConfirm) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 50, lay.LW, 56);
      ovC('Quit this level?', 58, 'red'); ovC(touchMode ? 'Tap MENU again to quit' : 'ESC again = quit, any key = resume', 78, 'white');
    }
    ctx.restore();
    if (desk) { pctx.imageSmoothingEnabled = false; game.drawPanelCanvas(pctx, lay.PW, lay.PH, game.hoverText(hov)); setCursor(hov ? CUR.box : CUR.cross); }
    else updateDom();
  }
  function render() {
    ctx.imageSmoothingEnabled = false;
    if (lay.mode === 'menu') renderMenu(); else renderPlay();
    drawFade();
  }

  /* ---------- update / main loop ---------- */
  function update(dt) {
    frameN++;
    updFade();
    if (screen !== 'play' || !game) return;
    var sd = arrowDir;
    if (!sd && lay.mode === 'desktop' && mouse.over && !mapDrag && !rdrag) { if (mouse.x <= 2) sd = -1; else if (mouse.x >= lay.LW - 3) sd = 1; }
    if (keys.ArrowLeft) sd = -1; if (keys.ArrowRight) sd = 1;
    game.frame({ scrollDir: sd, fast: keys.Shift });
    if (game.paused || quitConfirm || game.over) acc = 0;
    else {
      acc += dt * (ff ? 4 : 1); var n = 0;
      while (acc >= LM.TICK_MS && n < 12) { game.tick(); acc -= LM.TICK_MS; n++; }
      if (n >= 12) acc = 0;
    }
    if (game.over && game.overT > 36 && !fade) go(finishLevel);
  }
  function stepFrame(dt) {
    update(dt);                                    /* may switch screens (level end, quit...) */
    if (((screen === 'play' && game) ? 'play' : 'menu') !== layKind) layDirty = true;
    if (layDirty) applyLayout();                   /* so re-check the layout before drawing */
    render();
  }
  function loop(ts) {
    requestAnimationFrame(loop);                   /* first, so one bad frame can't stop the game */
    var dt = Math.min(100, ts - lastT); lastT = ts;
    stepFrame(dt);
  }

  /* ---------- input ---------- */
  function canvasPos(e, el, w, h) { var r = el.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * w, y: (e.clientY - r.top) / r.height * h }; }
  function noteTouch(e) { if (e.pointerType === 'touch' && !touchMode) { touchMode = true; layDirty = true; } }
  function startAudio() {
    if (!audioStarted) { LM.snd.init(); audioStarted = true; if (screen === 'title') LM.snd.startMusic(2); } else LM.snd.init();
  }
  function tryFullscreen() {
    if (fsTried || !touchMode) return; fsTried = true;
    try { var el = document.documentElement; if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(function () { }); } catch (e) { }
  }
  function tapRad() { return Math.max(8, Math.round(26 / lay.kcss)); }       /* ~26 css px of finger slop */
  function assignAt(vx, vy, rad) {
    if (vy < 0 || !game) return false;
    var L = game.pick(vx + Math.round(game.scrollX), vy, rad);
    if (L && game.assign(L, game.sel)) {
      game.flashL = L; game.flashT = 12;
      if (touchMode && navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { } }
      return true;
    }
    return false;
  }
  function resultAction(menu) {
    if (menu) go(toTitle);
    else if (result.ok) { if (levelIdx + 1 < LM.LEVELS.length) go(function () { showIntro(levelIdx + 1); }); else go(toTitle); }
    else go(function () { showIntro(levelIdx); });
  }
  function promptCode() {
    var c = window.prompt('Enter your 10-letter access code:', ''); if (c === null) return;
    var i = LM.codeToLevel(c); if (i >= 0) go(function () { showIntro(i); }); else window.alert('Unknown access code');
  }
  function menuDown(vx, vy, e) {
    if (screen === 'title') {
      var s = signAt(vx, vy); if (!s) return; LM.snd.play('click');
      if (s.id === 'play') { tryFullscreen(); var lv = LM.levelsOf(LM.RATINGS[ratingIdx])[0]; go(function () { showIntro(lv); }); }
      else if (s.id === 'help') go(function () { screen = 'help'; });
      else if (s.id === 'code') { if (touchMode) setTimeout(promptCode, 30); else go(function () { screen = 'code'; codeBuf = ''; codeMsg = ''; }); }
      else if (s.id === 'music') { if (LM.snd.toggleMusic()) LM.snd.startMusic(2); }
      else if (s.id === 'rating') ratingIdx = (ratingIdx + (e.button === 2 ? LM.RATINGS.length - 1 : 1)) % LM.RATINGS.length;
    } else if (screen === 'help') go(toTitle);
    else if (screen === 'code') { if (e.button === 2) go(toTitle); }
    else if (screen === 'intro') go(startPlay);
    else if (screen === 'result') resultAction(e.button === 2 || (touchMode && vy >= 174));
  }

  function onCvDown(e) {
    noteTouch(e); startAudio();
    if (fade) return;
    var p = canvasPos(e, cv, lay.LW, lay.LH); mouse.x = p.x; mouse.y = p.y; mouse.over = true;
    if (screen !== 'play' || !game) { menuDown(p.x - lay.ox, p.y - lay.oy, e); return; }
    if (quitConfirm) { quitConfirm = false; return; }
    if (e.pointerType === 'mouse') {
      if (e.button === 2) { rdrag = { x: p.x, sx: game.scrollX }; return; }
      if (e.button !== 0) return;
      assignAt(p.x, p.y - lay.worldY, 3);
    } else {
      gest = { id: e.pointerId, cx: e.clientX, cy: e.clientY, sx: game.scrollX, moved: false, px: p.x, py: p.y };
      try { cv.setPointerCapture(e.pointerId); } catch (err) { }
    }
  }
  function onCvMove(e) {
    var p = canvasPos(e, cv, lay.LW, lay.LH);
    if (e.pointerType === 'mouse') { mouse.x = p.x; mouse.y = p.y; mouse.over = true; }
    if (screen !== 'play' || !game) return;
    if (rdrag) game.scrollTo(rdrag.sx - (p.x - rdrag.x));
    if (gest && e.pointerId === gest.id) {
      var dx = e.clientX - gest.cx, dy = e.clientY - gest.cy;
      if (!gest.moved && Math.sqrt(dx * dx + dy * dy) > 9) gest.moved = true;
      if (gest.moved) game.scrollTo(gest.sx - dx / lay.kcss);       /* drag the level */
    }
  }
  function onWinUp(e) {
    if (gest && e.pointerId === gest.id) {
      /* a tap lands where the finger went DOWN (it can drift while lifting) */
      if (!gest.moved && game && screen === 'play' && e.type === 'pointerup') assignAt(gest.px, gest.py - lay.worldY, tapRad());
      gest = null;
    }
    rdrag = null; mapDrag = false; arrowDir = 0;
    if (game) game.rrHold = 0;
    for (var k in dom.btn) dom.btn[k].el.classList.remove('down');
    if (e.type === 'pointerup') startAudio();
  }
  function onPanelDown(e) {
    noteTouch(e); startAudio(); if (fade || screen !== 'play' || !game) return;
    var p = canvasPos(e, pcv, lay.PW, lay.PH); e.preventDefault();
    try { pcv.setPointerCapture(e.pointerId); } catch (err) { }
    if (p.y >= 16 && p.x < 192) doAction(PANEL_IDS[Math.floor(p.x / 16)]);
    else if (p.y >= 16) miniPress(p.x);
  }
  function onPanelMove(e) { if (mapDrag && game) miniMove(canvasPos(e, pcv, lay.PW, lay.PH).x); }
  function onMiniDown(e) {
    noteTouch(e); startAudio(); if (fade || screen !== 'play' || !game) return;
    e.preventDefault(); try { mcv.setPointerCapture(e.pointerId); } catch (err) { }
    miniPress(canvasPos(e, mcv, mcv.width, mcv.height).x);
  }
  function onMiniMove(e) { if (mapDrag && game) miniMove(canvasPos(e, mcv, mcv.width, mcv.height).x); }

  function onKey(e) {
    startAudio(); keys[e.key] = true;
    var k = e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].indexOf(k) >= 0) e.preventDefault();
    if (fade) return;
    if (screen === 'code') {
      if (k === 'Escape') go(toTitle);
      else if (k === 'Enter') {
        var i = LM.codeToLevel(codeBuf);
        if (i >= 0) go(function () { showIntro(i); }); else { codeMsg = 'Unknown access code'; LM.snd.play('lose'); }
      } else if (k === 'Backspace') { codeBuf = codeBuf.slice(0, -1); codeMsg = ''; }
      else if (/^[a-zA-Z]$/.test(k) && codeBuf.length < 10) { codeBuf += k.toUpperCase(); codeMsg = ''; }
      return;
    }
    if (screen === 'help' && (k === 'Escape' || k === 'Enter' || k === ' ')) { go(toTitle); return; }
    if (screen === 'intro' && (k === 'Enter' || k === ' ')) { go(startPlay); return; }
    if (screen === 'result' && (k === 'Enter' || k === ' ')) { resultAction(false); return; }
    if (screen !== 'play' || !game) return;
    if (quitConfirm) { if (k === 'Escape') go(toTitle); quitConfirm = false; return; }
    if (k === 'Escape') { quitConfirm = true; return; }
    if (k >= '1' && k <= '8') { game.sel = LM.SKILLS[+k - 1]; LM.snd.play('click'); }
    else if (k === ' ' || k === 'p' || k === 'P') game.paused = !game.paused;
    else if (k === '+' || k === '=') game.setRate(game.rate + 5);
    else if (k === '-' || k === '_') game.setRate(game.rate - 5);
    else if (k === 'f' || k === 'F') ff = !ff;
    else if (k === 'n' || k === 'N') nukeTap();
    else if (k === 'm' || k === 'M') { if (LM.snd.toggleMusic()) LM.snd.startMusic(levelIdx % 3); }
  }
  function onKeyUp(e) { keys[e.key] = false; }
  function autoPause() { keys = {}; if (game && screen === 'play') game.paused = true; }

  app.init = function () {
    cv = document.getElementById('screen'); ctx = cv.getContext('2d');
    pcv = document.getElementById('panel'); pctx = pcv.getContext('2d');
    mcv = document.getElementById('tmini'); mctx = mcv.getContext('2d');
    stage = document.getElementById('stage'); left = document.getElementById('left');
    minibox = document.getElementById('minibox'); tpanel = document.getElementById('tpanel');
    var q = location.search;
    touchMode = /[?&]touch=1/.test(q) ? true : /[?&]touch=0/.test(q) ? false :
      !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    LM.initGfx(); makeCursors(); makeLogo(); buildDom();
    var relayout = function () { layDirty = true; };
    window.addEventListener('resize', relayout); window.addEventListener('orientationchange', relayout);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', relayout);
    cv.addEventListener('pointerdown', onCvDown); cv.addEventListener('pointermove', onCvMove);
    cv.addEventListener('wheel', function (e) { if (screen === 'play' && game) { e.preventDefault(); game.scrollBy((e.deltaX || e.deltaY) > 0 ? 40 : -40); } }, { passive: false });
    pcv.addEventListener('pointerdown', onPanelDown); pcv.addEventListener('pointermove', onPanelMove);
    mcv.addEventListener('pointerdown', onMiniDown); mcv.addEventListener('pointermove', onMiniMove);
    window.addEventListener('pointerup', onWinUp); window.addEventListener('pointercancel', onWinUp);
    cv.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') mouse.over = false; });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', function () { if (document.hidden) autoPause(); });
    applyLayout();
    requestAnimationFrame(function (t) { lastT = t; loop(t); });
  };
  /* test hooks */
  app._dbg = {
    get game() { return game; }, get screen() { return screen; }, get lay() { return lay; }, get touch() { return touchMode; },
    showIntro: showIntro, startPlay: startPlay, go: go, finishLevel: finishLevel, toTitle: toTitle,
    setScreen: function (s) { screen = s; }, setTouch: function (v) { touchMode = v; layDirty = true; }, relayout: function () { layDirty = true; },
    get quitConfirm() { return quitConfirm; }, get ff() { return ff; }, tapRad: tapRad,
    /* run one loop iteration by hand (lets tests drive frames when requestAnimationFrame is throttled) */
    step: function (dt) { stepFrame(dt || 16); }
  };
  return app;
})();
