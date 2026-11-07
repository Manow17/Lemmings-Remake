'use strict';
/* ============================================================
   LEMMINGS (fan recreation) - screens, input and main loop
   ============================================================ */
var LM = window.LM = window.LM || {};

LM.app = (function () {
  var app = {};
  var cv, ctx, W = LM.W, H = LM.H;
  var mouse = { x: 160, y: 100, inView: false, down: false, onCanvas: false };
  var keys = {}, screen = 'title', game = null, levelIdx = 0, ratingIdx = 0, fade = null;
  var bgTitle, bgLeaf, logo, introPrev, result = null, codeBuf = '', codeMsg = '';
  var lastT = 0, acc = 0, frameN = 0, quitConfirm = false, ff = false, rdrag = null, mapDrag = false, arrowDir = 0;
  var audioStarted = false;

  /* ---------- colour presets for the menu font ---------- */
  var COL = {
    red: ['#ffa0a0', '#d82020'], blue: ['#a8c4ff', '#2848e8'], green: ['#a8ffa8', '#12a020'], orange: ['#fcd8a0', '#c87820'],
    cyan: ['#a8f8f8', '#10a8c0'], magenta: ['#fcb0fc', '#b820b8'], white: ['#ffffff', '#c0c4e0'], teal: ['#b0f8f0', '#20a89c'], grey: ['#a0a0b0', '#606070']
  };
  function mf(c) { return LM.menuFont(COL[c][0], COL[c][1]); }
  function txt(s, x, y, c) { LM.drawText(ctx, mf(c), s, x, y); }
  function txtC(s, y, c, cx) { LM.drawTextC(ctx, mf(c), s, cx === undefined ? W / 2 : cx, y); }

  /* ---------- backgrounds ---------- */
  function makeBg(fn) {
    var c = LM.mk(W, H), g = c.getContext('2d'), id = g.createImageData(W, H);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var col = fn(x, y), o = (y * W + x) * 4; id.data[o] = col[0]; id.data[o + 1] = col[1]; id.data[o + 2] = col[2]; id.data[o + 3] = 255;
    }
    g.putImageData(id, 0, 0); return c;
  }
  function pick(pal, v) { return pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v * pal.length)))]; }
  function makeBackgrounds() {
    var earth = ['#2a0e06', '#3e1a0c', '#561f0e', '#6e2c14', '#8a3c1c'].map(LM.rgb);
    bgTitle = makeBg(function (x, y) { return pick(earth, LM.vnoise(x / 4, y / 3, 31) * 0.6 + LM.hash(x, y, 32) * 0.4); });
    var leaf = ['#07220f', '#0c3a1a', '#145a2a', '#1c7a38', '#0a2c14'].map(LM.rgb);
    bgLeaf = makeBg(function (x, y) {
      var v = LM.vnoise(x / 3.2, y / 3.2, 41) * 0.65 + LM.vnoise(x / 9, y / 7, 42) * 0.3 + LM.hash(x, y, 43) * 0.15;
      return pick(leaf, (v - 0.1) / 0.85);
    });
  }
  function makeLogo() {
    var c = LM.mk(156, 44), g = c.getContext('2d');
    g.font = 'italic 900 29px "Arial Black", Impact, "Segoe UI Black", sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
    /* shrink to fit if the system font is wider than expected */
    var tw = g.measureText('Lemmings').width; if (tw > 142) g.font = 'italic 900 ' + Math.floor(29 * 142 / tw) + 'px "Arial Black", Impact, "Segoe UI Black", sans-serif';
    g.lineJoin = 'round'; g.strokeStyle = '#f0e020'; g.lineWidth = 5; g.strokeText('Lemmings', 78, 23);
    var gr = g.createLinearGradient(0, 6, 0, 40); gr.addColorStop(0, '#58e060'); gr.addColorStop(0.5, '#1ea030'); gr.addColorStop(1, '#0c6a1c');
    g.fillStyle = gr; g.fillText('Lemmings', 78, 23);
    var id = g.getImageData(0, 0, 156, 44), d = id.data;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 130) { d[i + 3] = 0; continue; } d[i + 3] = 255;
      /* posterise a little for the chunky pixel look */
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
    ctx.fillStyle = 'rgba(0,0,0,' + Math.max(0, Math.min(1, a)) + ')'; ctx.fillRect(0, 0, W, H);
  }

  /* ---------- screen switching ---------- */
  function toTitle() { screen = 'title'; game = null; quitConfirm = false; ff = false; if (audioStarted) LM.snd.startMusic(2); LM.snd.cancelSpeech(); }
  function showIntro(i) {
    levelIdx = i; game = new LM.Game(LM.LEVELS[i]); screen = 'intro';
    var pw = Math.min(220, Math.floor(game.W / 6)), ph = Math.round(160 / 6);
    introPrev = game.preview(pw, ph);
    if (audioStarted) LM.snd.stopMusic();
  }
  function startPlay() { screen = 'play'; acc = 0; ff = false; quitConfirm = false; if (audioStarted) LM.snd.startMusic(levelIdx % 3); }
  function finishLevel() {
    result = game.result(); screen = 'result';
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

  /* ---------- drawing: title ---------- */
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
    ctx.drawImage(bgTitle, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(logo, 8, 6, 304, 88);
    /* three peeking lemmings around the logo */
    sprScaled('fall', 0, 1, 40, 94, 3); sprScaled('walk', 1, -1, 168, 62, 3); sprScaled('exit', 2, 1, 276, 60, 3);
    var hov = signAt(mouse.x, mouse.y), t = frameN;
    SIGNS.forEach(function (s, i) {
      var bx = s.cx - SW / 2, by = SY + (hov === s ? -2 : 0);
      /* lemming holding the sign */
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

  /* ---------- drawing: intro ---------- */
  function drawIntro() {
    var L = LM.LEVELS[levelIdx];
    ctx.drawImage(bgLeaf, 0, 0);
    ctx.fillStyle = LM.BG; ctx.fillRect(0, 0, W, 54);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 54, W, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(introPrev, Math.round((W - introPrev.width) / 2), Math.round((54 - introPrev.height) / 2));
    txt('Level ' + (levelIdx + 1), 8, 66, 'red'); txt(L.title, 76, 66, 'red');
    var y = 98, x = 62;
    txt('Number of Lemmings ' + L.num, x, y, 'blue');
    txt(L.save + '% To Be Saved', x, y + 16, 'green');
    txt('Release Rate ' + L.rate, x, y + 32, 'orange');
    txt('Time    ' + L.time + ' Minutes', x, y + 48, 'cyan');
    txt('Rating  ' + L.rating, x, y + 64, 'magenta');
    txtC('Press mouse button to continue', 184, 'blue');
    /* sleepy lemming on a bed */
    ctx.fillStyle = '#c02020'; ctx.fillRect(268, 176, 30, 10); ctx.fillStyle = '#f0f0f0'; ctx.fillRect(268, 172, 8, 5);
    LM.blitSpr(ctx, 'shrug', 0, 1, 284, 175); txt('z', 258, 166, 'blue'); txt('Z', 250, 158, 'blue');
  }

  /* ---------- drawing: result ---------- */
  function drawResult() {
    var r = result;
    ctx.drawImage(bgLeaf, 0, 0);
    txtC(r.reason === 'time' ? 'Your time is up!' : 'All lemmings accounted for.', 12, 'teal');
    txtC('You needed ' + r.needPct + '%', 46, 'magenta', 130); txtC('You rescued ' + r.pct + '%', 62, 'magenta', 130);
    var m = resultText(r);
    txtC(m[0], 90, 'red'); txtC(m[1], 106, 'red');
    if (r.ok && levelIdx + 1 < LM.LEVELS.length) {
      txtC('Your access code for Level ' + (levelIdx + 2), 130, 'orange'); txtC('is ' + LM.levelCode(levelIdx + 1), 146, 'orange');
    } else if (r.ok) { txtC('You have completed every level!', 138, 'orange'); }
    txtC(r.ok ? 'Press left mouse button to continue' : 'Press left mouse button to retry', 166, 'cyan');
    txtC('Press right mouse button for menu', 182, 'cyan');
    /* a boot on the right */
    ctx.fillStyle = '#2832c8'; ctx.fillRect(262, 30, 12, 14); ctx.fillStyle = '#4858f0'; ctx.fillRect(262, 30, 3, 14);
    ctx.fillStyle = '#f0a0b0'; ctx.fillRect(258, 44, 20, 12); ctx.fillRect(254, 50, 10, 8); ctx.fillStyle = '#fcc8d0'; ctx.fillRect(260, 45, 12, 2);
  }

  function drawHelp() {
    ctx.drawImage(bgLeaf, 0, 0);
    txtC('HOW TO PLAY', 8, 'red');
    var L = [['Guide the lemmings from the hatch', 'green'], ['to the exit. Save enough to win!', 'green'],
      ['Pick a skill in the panel, then click', 'cyan'], ['a lemming to give it that skill.', 'cyan'],
      ['Climber and Floater stay for good.', 'orange'], ['Bomber: 5 second fuse.  Blocker', 'orange'], ['turns others around.', 'orange'],
      ['Scroll: screen edge / right drag /', 'blue'], ['arrow keys / click the minimap.', 'blue'],
      ['Keys: 1-8 skills  SPACE pause', 'magenta'], ['+ - speed  F fast-forward', 'magenta'], ['N N nuke  M music  ESC quit', 'magenta']];
    L.forEach(function (l, i) { txtC(l[0], 26 + i * 12, l[1]); });
    txtC('Press mouse button to go back', 182, 'white');
  }
  function drawCode() {
    ctx.drawImage(bgLeaf, 0, 0);
    txtC('Enter your access code', 40, 'cyan');
    var s = codeBuf, shown = s + ((frameN >> 4) & 1 ? '_' : ' ');
    ctx.fillStyle = '#000'; ctx.fillRect(60, 80, 200, 26); ctx.fillStyle = '#2848c8'; ctx.fillRect(61, 81, 198, 24); ctx.fillStyle = '#000'; ctx.fillRect(63, 83, 194, 20);
    txtC(shown, 87, 'white');
    if (codeMsg) txtC(codeMsg, 120, 'red');
    txtC('Type the letters and press ENTER', 150, 'green');
    txtC('ESC or right-click to go back', 166, 'grey');
  }

  /* ---------- cursors ---------- */
  var ARROW = ['X..........', 'XX.........', 'X#X........', 'X##X.......', 'X###X......', 'X####X.....', 'X#####X....', 'X######X...', 'X#####XX...', 'X##X##X....', 'X#X.X##X...', 'XX..X##X...', 'X....X##X..', '.....X##X..', '......XX...'];
  function drawArrow(x, y) {
    for (var r = 0; r < ARROW.length; r++) for (var c = 0; c < 11; c++) {
      var ch = ARROW[r][c]; if (ch === '.') continue;
      ctx.fillStyle = ch === 'X' ? '#000' : '#fff'; ctx.fillRect(x + c, y + r, 1, 1);
    }
  }
  function drawCursor() {
    if (!mouse.onCanvas) return;
    var mx = Math.round(mouse.x), my = Math.round(mouse.y);
    if (screen === 'play') {
      var hov = null;
      if (mouse.inView && !quitConfirm) hov = game.pick(mouse.x + Math.round(game.scrollX), mouse.y);
      if (hov) ctx.drawImage(LM.curBox, Math.round(hov.x - Math.round(game.scrollX)) - 7, Math.round(hov.y - 5) - 7);
      else ctx.drawImage(LM.curCross, mx - 7, my - 7);
    } else drawArrow(mx, my);
  }

  /* ---------- update / render ---------- */
  function update(dt) {
    frameN++;
    updFade();
    if (screen !== 'play' || !game) return;
    var sd = arrowDir;
    if (!sd && mouse.onCanvas && mouse.inView && !mapDrag && !rdrag) { if (mouse.x <= 2) sd = -1; else if (mouse.x >= W - 3) sd = 1; }
    if (keys.ArrowLeft) sd = -1; if (keys.ArrowRight) sd = 1;
    game.frame({ scrollDir: sd, fast: keys.Shift });
    if (game.paused || quitConfirm || game.over) { acc = 0; }
    else {
      acc += dt * (ff ? 4 : 1); var n = 0;
      while (acc >= LM.TICK_MS && n < 12) { game.tick(); acc -= LM.TICK_MS; n++; }
      if (n >= 12) acc = 0;
    }
    if (game.over && game.overT > 36 && !fade) go(finishLevel);
  }
  function render() {
    ctx.imageSmoothingEnabled = false;
    switch (screen) {
      case 'title': drawTitle(); break;
      case 'help': drawHelp(); break;
      case 'code': drawCode(); break;
      case 'intro': drawIntro(); break;
      case 'result': drawResult(); break;
      case 'play':
        game.draw(ctx, { x: mouse.x, y: mouse.y, inView: mouse.inView && mouse.onCanvas });
        if (ff) { LM.drawText(ctx, mf('red'), '>>', 304, 2); }
        if (game.paused && !quitConfirm) txtC('PAUSED', 70, 'white');
        if (quitConfirm) {
          ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 50, W, 56);
          txtC('Quit this level?', 58, 'red'); txtC('ESC again = quit, any key = resume', 78, 'white');
        }
        break;
    }
    drawCursor();
    drawFade();
  }
  function loop(ts) {
    var dt = Math.min(100, ts - lastT); lastT = ts;
    update(dt); render(); requestAnimationFrame(loop);
  }

  /* ---------- input ---------- */
  function toLogical(e) {
    var r = cv.getBoundingClientRect();
    mouse.x = Math.max(0, Math.min(W - 1, (e.clientX - r.left) / r.width * W));
    mouse.y = Math.max(0, Math.min(H - 1, (e.clientY - r.top) / r.height * H));
    mouse.inView = mouse.y < 160;
  }
  function startAudio() { if (!audioStarted) { LM.snd.init(); audioStarted = true; if (screen === 'title') LM.snd.startMusic(2); } else LM.snd.init(); }
  function miniX() { return 206 + Math.floor((100 - game.mini.width) / 2); }
  function panelDown(x, y) {
    if (y >= 176 && x < 192) {
      var i = Math.floor(x / 16);
      if (i === 0) { game.rrHold = -1; game.rrT = 0; }
      else if (i === 1) { game.rrHold = 1; game.rrT = 0; }
      else if (i <= 9) { game.sel = LM.SKILLS[i - 2]; LM.snd.play('click'); }
      else if (i === 10) { game.paused = !game.paused; LM.snd.play('click'); }
      else if (i === 11) { if (game.nukeArm > 0) { game.nuke(); game.nukeArm = 0; } else game.nukeArm = 80; }
    } else if (x >= 192 && x < 204 && y >= 176) { arrowDir = -1; }
    else if (x >= 306 && y >= 176) { arrowDir = 1; }
    else if (x >= 204 && x < 308 && y >= 176) { mapDrag = true; game.scrollTo((x - miniX()) * 16 - W / 2); }
  }
  function resultClick(button) {
    if (button === 2) go(toTitle);
    else if (result.ok) { if (levelIdx + 1 < LM.LEVELS.length) go(function () { showIntro(levelIdx + 1); }); else go(toTitle); }
    else go(function () { showIntro(levelIdx); });
  }
  function onDown(e) {
    startAudio(); toLogical(e); mouse.down = true;
    if (fade) return;
    if (screen === 'title') {
      var s = signAt(mouse.x, mouse.y); if (!s) return; LM.snd.play('click');
      if (s.id === 'play') { var lv = LM.levelsOf(LM.RATINGS[ratingIdx])[0]; go(function () { showIntro(lv); }); }
      else if (s.id === 'help') go(function () { screen = 'help'; });
      else if (s.id === 'code') go(function () { screen = 'code'; codeBuf = ''; codeMsg = ''; });
      else if (s.id === 'music') { if (LM.snd.toggleMusic()) LM.snd.startMusic(2); }
      else if (s.id === 'rating') ratingIdx = (ratingIdx + (e.button === 2 ? LM.RATINGS.length - 1 : 1)) % LM.RATINGS.length;
    } else if (screen === 'help') go(toTitle);
    else if (screen === 'code') { if (e.button === 2) go(toTitle); }
    else if (screen === 'intro') go(startPlay);
    else if (screen === 'result') resultClick(e.button);
    else if (screen === 'play') {
      if (quitConfirm) { quitConfirm = false; return; }
      if (e.button === 2) { rdrag = { x: mouse.x, sx: game.scrollX }; return; }
      if (mouse.y >= 160) panelDown(mouse.x, mouse.y);
      else {
        var L = game.pick(mouse.x + Math.round(game.scrollX), mouse.y);
        if (L) game.assign(L, game.sel);
      }
    }
  }
  function onUp(e) { mouse.down = false; rdrag = null; mapDrag = false; arrowDir = 0; if (game) game.rrHold = 0; }
  function onMove(e) {
    toLogical(e); mouse.onCanvas = true;
    if (screen !== 'play' || !game) return;
    if (mapDrag) game.scrollTo((mouse.x - miniX()) * 16 - W / 2);
    if (rdrag) game.scrollTo(rdrag.sx - (mouse.x - rdrag.x));
  }
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
    if (screen === 'result' && (k === 'Enter' || k === ' ')) { resultClick(0); return; }
    if (screen !== 'play' || !game) return;
    if (quitConfirm) { if (k === 'Escape') { go(toTitle); } quitConfirm = false; return; }
    if (k === 'Escape') { quitConfirm = true; return; }
    if (k >= '1' && k <= '8') { game.sel = LM.SKILLS[+k - 1]; LM.snd.play('click'); }
    else if (k === ' ' || k === 'p' || k === 'P') game.paused = !game.paused;
    else if (k === '+' || k === '=') game.setRate(game.rate + 5);
    else if (k === '-' || k === '_') game.setRate(game.rate - 5);
    else if (k === 'f' || k === 'F') ff = !ff;
    else if (k === 'n' || k === 'N') { if (game.nukeArm > 0) { game.nuke(); game.nukeArm = 0; } else game.nukeArm = 80; }
    else if (k === 'm' || k === 'M') { if (LM.snd.toggleMusic()) LM.snd.startMusic(levelIdx % 3); }
  }
  function onKeyUp(e) { keys[e.key] = false; }

  function resize() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var s = Math.min(vw / W, vh / (H * 1.2));
    if (s >= 2) s = Math.floor(s);
    cv.style.width = Math.floor(W * s) + 'px'; cv.style.height = Math.floor(H * s * 1.2) + 'px';
  }

  app.init = function () {
    cv = document.getElementById('screen'); ctx = cv.getContext('2d');
    LM.initGfx(); makeBackgrounds(); makeLogo();
    window.addEventListener('resize', resize); resize();
    cv.addEventListener('mousedown', onDown); window.addEventListener('mouseup', onUp);
    cv.addEventListener('mousemove', onMove); cv.addEventListener('mouseleave', function () { mouse.onCanvas = false; mouse.inView = false; });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', function () { keys = {}; if (game && screen === 'play') game.paused = true; });
    requestAnimationFrame(function (t) { lastT = t; loop(t); });
  };
  /* test hooks */
  app._dbg = { get game() { return game; }, get screen() { return screen; }, showIntro: showIntro, startPlay: startPlay, go: go, finishLevel: finishLevel,
    setScreen: function (s) { screen = s; }, toTitle: toTitle };
  return app;
})();
