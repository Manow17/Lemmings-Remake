'use strict';
/* ============================================================
   LEMMINGS (fan recreation) - graphics module
   Everything is drawn procedurally: sprites are hand-built pixel
   art, textures are generated from noise. Nothing is ripped from
   the original game.
   ============================================================ */
var LM = window.LM = window.LM || {};
LM.W = 320;           // logical screen width  (Amiga lo-res)
LM.H = 200;           // logical screen height (160 play area + 40 panel)

/* ---------- small utilities ---------- */
LM.mk = function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
LM.hash = function (x, y, s) {
  var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 2147483629)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
LM.vnoise = function (x, y, s) {
  var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  var a = LM.hash(xi, yi, s), b = LM.hash(xi + 1, yi, s), c = LM.hash(xi, yi + 1, s), d = LM.hash(xi + 1, yi + 1, s);
  xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
};
LM.rgb = function (hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
LM.rand = (function () { var s = 12345; return function () { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();

/* ============================================================
   BITMAP FONT  (5x7 source glyphs, restyled per use)
   ============================================================ */
LM.GLYPHS = {};
(function () {
  var s = {
    'A': '.###./#...#/#...#/#####/#...#/#...#/#...#', 'B': '####./#...#/#...#/####./#...#/#...#/####.',
    'C': '.###./#...#/#..../#..../#..../#...#/.###.', 'D': '####./#...#/#...#/#...#/#...#/#...#/####.',
    'E': '#####/#..../#..../####./#..../#..../#####', 'F': '#####/#..../#..../####./#..../#..../#....',
    'G': '.###./#...#/#..../#.###/#...#/#...#/.###.', 'H': '#...#/#...#/#...#/#####/#...#/#...#/#...#',
    'I': '.###./..#../..#../..#../..#../..#../.###.', 'J': '..###/...#./...#./...#./...#./#..#./.##..',
    'K': '#...#/#..#./#.#../##.../#.#../#..#./#...#', 'L': '#..../#..../#..../#..../#..../#..../#####',
    'M': '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', 'N': '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
    'O': '.###./#...#/#...#/#...#/#...#/#...#/.###.', 'P': '####./#...#/#...#/####./#..../#..../#....',
    'Q': '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', 'R': '####./#...#/#...#/####./#.#../#..#./#...#',
    'S': '.####/#..../#..../.###./....#/....#/####.', 'T': '#####/..#../..#../..#../..#../..#../..#..',
    'U': '#...#/#...#/#...#/#...#/#...#/#...#/.###.', 'V': '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
    'W': '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', 'X': '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    'Y': '#...#/#...#/.#.#./..#../..#../..#../..#..', 'Z': '#####/....#/...#./..#../.#.../#..../#####',
    '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', '1': '..#../.##../..#../..#../..#../..#../.###.',
    '2': '.###./#...#/....#/...#./..#../.#.../#####', '3': '####./....#/....#/.###./....#/....#/####.',
    '4': '...#./..##./.#.#./#..#./#####/...#./...#.', '5': '#####/#..../####./....#/....#/#...#/.###.',
    '6': '.###./#..../#..../####./#...#/#...#/.###.', '7': '#####/....#/...#./..#../.#.../.#.../.#...',
    '8': '.###./#...#/#...#/.###./#...#/#...#/.###.', '9': '.###./#...#/#...#/.####/....#/....#/.###.',
    ' ': '...../...../...../...../...../...../.....', '%': '##..#/##..#/...#./..#../.#.../#..##/#..##',
    '-': '...../...../...../#####/...../...../.....', ':': '...../..#../..#../...../..#../..#../.....',
    '!': '..#../..#../..#../..#../..#../...../..#..', '.': '...../...../...../...../...../.##../.##..',
    ',': '...../...../...../...../.##../..#../.#...', "'": '..#../..#../.#.../...../...../...../.....',
    '?': '.###./#...#/....#/...#./..#../...../..#..', '+': '...../..#../..#../#####/..#../..#../.....',
    '/': '....#/....#/...#./..#../.#.../#..../#....', '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
    ')': '.#.../..#../...#./...#./...#./..#../.#...', '=': '...../...../#####/...../#####/...../.....',
    '<': '...#./..#../.#.../#..../.#.../..#../...#.', '>': '.#.../..#../...#./....#/...#./..#../.#...',
    '*': '...../#.#.#/.###./#####/.###./#.#.#/.....', '"': '.#.#./.#.#./...../...../...../...../.....',
    /* lowercase */
    'a': '...../...../.###./....#/.####/#...#/.####', 'b': '#..../#..../#.##./##..#/#...#/#...#/####.',
    'c': '...../...../.###./#..../#..../#...#/.###.', 'd': '....#/....#/.##.#/#..##/#...#/#...#/.####',
    'e': '...../...../.###./#...#/#####/#..../.###.', 'f': '..##./.#..#/.#.../###../.#.../.#.../.#...',
    'g': '...../.####/#...#/#...#/.####/....#/.###.', 'h': '#..../#..../#.##./##..#/#...#/#...#/#...#',
    'i': '..#../...../.##../..#../..#../..#../.###.', 'j': '...#./...../..##./...#./...#./#..#./.##..',
    'k': '#..../#..../#..#./#.#../##.../#.#../#..#.', 'l': '.##../..#../..#../..#../..#../..#../.###.',
    'm': '...../...../##.#./#.#.#/#.#.#/#...#/#...#', 'n': '...../...../#.##./##..#/#...#/#...#/#...#',
    'o': '...../...../.###./#...#/#...#/#...#/.###.', 'p': '...../####./#...#/#...#/####./#..../#....',
    'q': '...../.####/#...#/#...#/.####/....#/....#', 'r': '...../...../#.##./##..#/#..../#..../#....',
    's': '...../...../.####/#..../.###./....#/####.', 't': '.#.../.#.../###../.#.../.#.../.#..#/..##.',
    'u': '...../...../#...#/#...#/#...#/#..##/.##.#', 'v': '...../...../#...#/#...#/#...#/.#.#./..#..',
    'w': '...../...../#...#/#...#/#.#.#/#.#.#/.#.#.', 'x': '...../...../#...#/.#.#./..#../.#.#./#...#',
    'y': '...../#...#/#...#/.####/....#/....#/.###.', 'z': '...../...../#####/...#./..#../.#.../#####'
  };
  for (var k in s) LM.GLYPHS[k] = s[k].split('/');
})();

/* font factory.  o = {colW:[5], rowH:[7], adv, grad:function(y,h)->css, outline, shadow, dilate} */
LM.makeFont = function (o) {
  var cw = 0, ch = 0, i;
  for (i = 0; i < o.colW.length; i++) cw += o.colW[i];
  for (i = 0; i < o.rowH.length; i++) ch += o.rowH[i];
  var pad = (o.outline ? 1 : 0), extra = (o.dilate ? 1 : 0) + (o.shadow ? 1 : 0);
  var GW = cw + extra + pad * 2, GH = ch + (o.shadow ? 1 : 0) + pad * 2;
  var font = { adv: o.adv, w: GW, h: GH, glyphs: {}, pad: pad };
  function paint(x, offx, offy, fn) {
    var gl = LM.GLYPHS[x]; if (!gl) return;
    var yy = 0;
    for (var r = 0; r < 7; r++) {
      var xx = 0;
      for (var c = 0; c < 5; c++) {
        if (gl[r][c] === '#') fn(xx + offx, yy + offy, o.colW[c] + (o.dilate ? 1 : 0), o.rowH[r], yy);
        xx += o.colW[c];
      }
      yy += o.rowH[r];
    }
  }
  for (var k in LM.GLYPHS) {
    var cv = LM.mk(GW, GH), g = cv.getContext('2d');
    if (o.shadow) { g.fillStyle = o.shadow; paint(k, pad + 1, pad + 1, function (x, y, w, h) { g.fillRect(x, y, w, h); }); }
    if (o.outline) {
      g.fillStyle = o.outline;
      for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) if (dx || dy)
        paint(k, pad + dx, pad + dy, function (x, y, w, h) { g.fillRect(x, y, w, h); });
    }
    paint(k, pad, pad, function (x, y, w, h, yy) {
      for (var j = 0; j < h; j++) { g.fillStyle = o.grad(yy + j, ch); g.fillRect(x, y + j, w, 1); }
    });
    font.glyphs[k] = cv;
  }
  return font;
};
LM.drawText = function (ctx, font, str, x, y) {
  for (var i = 0; i < str.length; i++) {
    var gl = font.glyphs[str[i]] || font.glyphs['?'];
    ctx.drawImage(gl, x - font.pad, y - font.pad); x += font.adv;
  }
};
LM.textW = function (font, str) { return str.length * font.adv; };
LM.drawTextC = function (ctx, font, str, cx, y) { LM.drawText(ctx, font, str, Math.round(cx - LM.textW(font, str) / 2), y); };

/* the three fonts we need (created lazily) */
LM.fonts = {};
LM.initFonts = function () {
  /* HUD font: chunky green, 8px advance, 14px tall */
  LM.fonts.hud = LM.makeFont({
    colW: [1, 1, 1, 1, 1], rowH: [2, 2, 2, 2, 2, 2, 2], adv: 8, dilate: true,
    grad: function (y) { return y < 3 ? '#9cf89c' : y < 8 ? '#20c820' : '#0c8a0c'; }
  });
  /* menu font: thin, tall, used with various colours */
  LM.menuFont = function (top, bot, shadow) {
    var key = top + bot + (shadow || '');
    if (!LM.fonts[key]) LM.fonts[key] = LM.makeFont({
      colW: [1, 2, 1, 2, 1], rowH: [2, 2, 1, 2, 1, 2, 2], adv: 8, shadow: shadow || '#000000',
      grad: function (y, h) { return y < h / 2 ? top : bot; }
    });
    return LM.fonts[key];
  };
  /* big font for headlines (2x) */
  LM.fonts.big = LM.makeFont({
    colW: [2, 2, 2, 2, 2], rowH: [3, 3, 3, 3, 3, 3, 3], adv: 12, dilate: true, outline: '#003000',
    grad: function (y, h) { return y < h * 0.35 ? '#c8ffc8' : y < h * 0.7 ? '#30d030' : '#108010'; }
  });
};

/* tiny 3x5 digits (panel number plates, bomb countdown) */
LM.DIG = {
  '0': '###/#.#/#.#/#.#/###', '1': '.#./##./.#./.#./###', '2': '###/..#/###/#../###', '3': '###/..#/###/..#/###',
  '4': '#.#/#.#/###/..#/..#', '5': '###/#../###/..#/###', '6': '###/#../###/#.#/###', '7': '###/..#/..#/..#/..#',
  '8': '###/#.#/###/#.#/###', '9': '###/#.#/###/..#/###', ' ': '.../.../.../.../...'
};
LM.drawDigits = function (ctx, str, x, y, col, sx) {
  sx = sx || 1; ctx.fillStyle = col;
  for (var i = 0; i < str.length; i++) {
    var rows = LM.DIG[str[i]].split('/');
    for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++) if (rows[r][c] === '#') ctx.fillRect(x + c * sx, y + r, sx, 1);
    x += 3 * sx + 1;
  }
};

/* ============================================================
   LEMMING SPRITES  (hand-built, right-facing; flipped for left)
   cell 25x26, anchor = (12, 21) = centre of feet row
   ============================================================ */
LM.SPR = {};
(function () {
  var CW = 25, CH = 26, AX = 12, AY = 21;
  var C = {
    G: '#18c84c', g: '#0a8a30', S: '#f8cab8', s: '#d6957a', E: '#14143c', B: '#3c3cf0', b: '#2222b4',
    F: '#e8a878', W: '#ffffff', Y: '#f8e020', y: '#c89c00', O: '#f08010', R: '#e02010', N: '#8a4a20',
    K: '#101010', L: '#c0c8d8', l: '#7a8498', D: '#a85c28', d: '#6a3412', P: '#f060a0', Q: '#e8b070', q: '#fcd8a0'
  };
  LM.LEMCOL = C;

  /* draw ascii art with top-left at (x0,y0) relative to the anchor */
  function art(P, x0, y0, rows) {
    for (var r = 0; r < rows.length; r++) for (var c = 0; c < rows[r].length; c++) {
      var ch = rows[r][c]; if (ch !== '.' && ch !== ' ') P(x0 + c, y0 + r, ch);
    }
  }
  var HEAD  = ['.GGG..', 'GGGGS.', 'ggSSES', '.gSSS.'];
  var HEADF = ['.GGGG.', 'GGGGGG', 'GESSEG', '.SSSS.'];
  var HEADO = ['.GGGG.', 'GGGGGG', 'GESSEG', '.SKKS.'];     /* mouth open */
  var BODY  = ['.BBB.', 'bBBBB', 'bBBBB', 'bbBBB'];
  var BODYF = ['.BBBB.', 'BBBBBB', 'BBBBBB', 'bBBBBb'];

  function leg(P, x, lift) {
    if (!lift) { P(x, -1, 's'); P(x, 0, 'F'); P(x + 1, 0, 'F'); }
    else { P(x, -1, 'F'); P(x + 1, -1, 'F'); }
  }
  function std(P) { art(P, -2, -9, HEAD); art(P, -2, -5, BODY); }
  function stdLegs(P) { leg(P, -1, 0); leg(P, 1, 0); }
  function legsF(P, a) { P(-2 + a, -1, 's'); P(-2 + a, 0, 'F'); P(-3 + a, 0, 'F'); P(1 - a, -1, 's'); P(1 - a, 0, 'F'); P(2 - a, 0, 'F'); }

  var A = {};   /* name -> {n, draw(i,P)} */

  A.walk = { n: 8, draw: function (i, P) {
    var s = Math.sin(i / 8 * Math.PI * 2);
    std(P);
    P(1, -4, 'S'); P(1 + Math.round(1.4 * s), -3, 'S');
    leg(P, Math.round(-0.5 + 1.5 * s), s > 0.45 ? 1 : 0);
    leg(P, Math.round(0.5 - 1.5 * s), -s > 0.45 ? 1 : 0);
  } };
  A.fall = { n: 4, draw: function (i, P) {
    var f = i & 1;
    art(P, -2, -9, HEAD);
    if (f) { P(-2, -10, 'G'); }
    art(P, -2, -5, BODY);
    P(-3, -8 - f, 'S'); P(-3, -9 - f, 'S'); P(-3, -10 - f, 'S'); P(-3, -7, 'b');
    P(3, -8 - (1 - f), 'S'); P(3, -9 - (1 - f), 'S'); P(3, -10 - (1 - f), 'S'); P(3, -7, 'B');
    P(-1, -1, 's'); P(1, -1, 's'); P(-1, 0, 'F'); P(0, 0, 'F'); P(1, 0, 'F'); P(2, 0, 'F');
  } };
  function canopy(P, k) {
    /* k = 0..3 opening stages, >=3 fully open */
    var yb = -16;
    if (k === 0) { art(P, -1, -15, ['.Y.', 'YyY', 'YyY', '.Y.']); }
    else if (k === 1) { art(P, -3, yb + 1, ['..YYY..', '.YYyYY.', 'YyY.YyY']); }
    else if (k === 2) { art(P, -4, yb, ['..YYYYY..', '.YYyYyYY.', 'YYyYYYyYY', 'Y.Y.Y.Y.Y']); }
    else { art(P, -5, yb, ['...YYYYY...', '.YYYyYyYYY.', 'YYyYYYYYyYY', 'Y.Y..Y..Y.Y']); }
  }
  A.float = { n: 8, draw: function (i, P) {
    var k = i < 4 ? i : 3, sway = (i >= 4 && (i & 1)) ? 1 : 0;
    canopy(P, k);
    if (k > 0) { P(0, -12, 'N'); P(0, -11, 'N'); }
    art(P, -2 + sway * 0, -9, HEAD);
    art(P, -2, -5, BODY);
    P(-2, -9, 'g');
    P(-1, -10, 'S'); P(1, -10, 'S'); P(-2, -8, 'S'); P(3, -8, 'S');
    P(-1, -1, 's'); P(1, -1, 's'); P(-1, 0, 'F'); P(0, 0, 'F'); P(1, 0, 'F'); P(2, 0, 'F');
    if (sway) { P(0, -1, 'F'); }
  } };
  A.climb = { n: 8, draw: function (i, P) {
    var up = (i >> 1) & 1, ph = i & 1;
    art(P, -3, -9, HEAD);
    art(P, -3, -5, BODY);
    /* arms reaching up the wall (on the right) */
    P(1, -9, 'G'); P(2, -9 - 0, 'G');
    var ay = up ? -11 : -8;
    P(2, ay, 'S'); P(2, ay + 1, 'S'); P(2, ay + 2, 'S');
    var by = up ? -8 : -11;
    P(1, by, 'S'); P(1, by + 1, 'S');
    /* legs bent against the wall */
    P(-1, -1, 's'); P(-1, 0, 'F'); P(0, 0, 'F');
    P(1, -2 - ph, 'F'); P(1, -3 - ph, 's'); P(2, -2 - ph, 'F');
  } };
  A.hoist = { n: 8, draw: function (i, P) {
    var k = i < 4 ? 0 : 1;
    if (k === 0) {
      art(P, -3, -7, HEAD); art(P, -3, -3, ['.BBB.', 'bBBBB', 'bBBBB']);
      P(2, -8, 'S'); P(3, -8, 'S'); P(3, -7, 'S'); P(1, -9, 'S'); P(2, -9, 'S');
      P(-1, -1, 'F'); P(0, -1, 'F'); P(-2, 0, 'F');
    } else {
      art(P, -2, -8, HEAD); art(P, -2, -4, ['.BBB.', 'bBBBB', 'bBBBB', 'bbBBB']);
      P(2, -2, 'S'); P(3, -2, 'S'); P(-1, 0, 'F'); P(0, 0, 'F'); P(1, 0, 'F'); P(2, 0, 'F');
    }
  } };
  A.dig = { n: 16, draw: function (i, P) {
    var k = (i >> 1) & 3;
    art(P, -3, -9, HEADF); art(P, -3, -5, BODYF);
    legsF(P, 0);
    var a = (k === 0 || k === 3) ? 0 : 1;
    P(-4, -4, 'S'); P(-4, -3 + a, 'S'); P(-4, -2 + a, 'S');
    P(4, -4, 'S'); P(4, -3 + (1 - a), 'S'); P(4, -2 + (1 - a), 'S');
    /* shovel dirt */
    P(-5 + a * 2, 1, 'D'); P(5 - a * 2, 1, 'd'); P(a ? -2 : 3, 1, 'D');
  } };
  function brickBlock(P, x, y) { P(x, y, 'q'); P(x + 1, y, 'q'); P(x + 2, y, 'Q'); P(x, y + 1, 'Q'); P(x + 1, y + 1, 'Q'); P(x + 2, y + 1, 'D'); }
  A.build = { n: 16, draw: function (i, P) {
    var lay = i >= 9 && i <= 12, bob = (i & 1) && !lay ? 0 : 0;
    if (!lay) {
      std(P); P(1, -4, 'S'); P(2, -3, 'S'); if (i < 9 || i > 12) brickBlock(P, 2, -5);
      leg(P, -1, 0); leg(P, 1, 0);
    } else {
      art(P, -1, -8, HEAD); art(P, -2, -4, ['.BBBB', 'bBBBB', 'bBBBB', 'bbBBB']);
      P(2, -4, 'S'); P(3, -3, 'S'); P(3, -2, 'S');
      leg(P, -1, 0); leg(P, 1, 0);
      brickBlock(P, 3, -1 + 0);
    }
  } };
  A.shrug = { n: 8, draw: function (i, P) {
    var k = (i >> 1) & 1;
    art(P, -2 + k, -9, HEAD); art(P, -2, -5, BODY);
    P(-3, -5, 'S'); P(-4, -6, 'S'); P(3, -5, 'S'); P(4, -6, 'S');
    stdLegs(P);
  } };
  A.bash = { n: 8, draw: function (i, P) {
    var p = (i & 7) < 4 ? 0 : 1;
    if (p === 0) {
      art(P, -3, -9, HEAD); art(P, -3, -5, BODY);
      P(-4, -4, 'S'); P(-4, -3, 'S'); P(1, -3, 'S');
      leg(P, -2, 0); leg(P, 0, 0);
    } else {
      art(P, -1, -9, HEAD); art(P, -2, -5, ['.BBB.', 'bBBBB', 'bBBBB', 'bbBBB']);
      P(2, -5, 'S'); P(3, -5, 'S'); P(4, -5, 'S'); P(4, -4, 'S');
      leg(P, -2, 0); leg(P, 0, 0);
    }
  } };
  A.mine = { n: 8, draw: function (i, P) {
    var up = (i & 7) < 4;
    art(P, -2, -9, HEAD); art(P, -2, -5, BODY);
    leg(P, -1, 0); leg(P, 1, 0);
    if (up) {
      P(2, -6, 'S'); P(2, -7, 'S'); P(3, -8, 'N'); P(3, -9, 'N'); P(4, -10, 'N'); P(4, -11, 'L'); P(5, -11, 'L'); P(3, -11, 'l'); P(2, -11, 'l');
    } else {
      P(2, -4, 'S'); P(3, -3, 'N'); P(4, -2, 'N'); P(5, -1, 'N'); P(5, 0, 'L'); P(6, 0, 'L'); P(6, -2, 'l'); P(4, -1, 'l');
    }
  } };
  A.block = { n: 16, draw: function (i, P) {
    var k = (i >> 2) & 1;
    art(P, -3, -9, HEADF); art(P, -3, -5, BODYF);
    legsF(P, 0);
    P(-4, -5, 'S'); P(-5, -5, 'S'); P(-6, -5 - k, 'S');
    P(4, -5, 'S'); P(5, -5, 'S'); P(6, -5 - (1 - k), 'S');
  } };
  A.ohno = { n: 16, draw: function (i, P) {
    var k = (i >> 1) & 1;
    art(P, -3, -9, HEADO); art(P, -3, -5, BODYF);
    legsF(P, k);
    P(-4, -5, 'S'); P(-4, -6, 'S'); P(-4, -7 - k, 'S'); P(-4, -8 - k, 'S');
    P(4, -5, 'S'); P(4, -6, 'S'); P(4, -7 - (1 - k), 'S'); P(4, -8 - (1 - k), 'S');
  } };
  A.splat = { n: 16, draw: function (i, P) {
    var cols = ['S', 'B', 'G', 'B', 'S', 'b', 'G', 'F'];
    var spread = Math.min(i, 7), h = Math.max(0, 5 - (i >> 1));
    for (var k = 0; k < 14; k++) {
      var dx = Math.round((LM.hash(k, 1, 7) - 0.5) * (4 + spread));
      var dy = -Math.round(LM.hash(k, 2, 7) * h);
      P(dx, dy, cols[k & 7]);
    }
    for (var x = -3; x <= 3; x++) P(x, 0, (x & 1) ? 'B' : 'b');
    P(-1, -1, 'G'); P(0, -1, 'S');
  } };
  A.exit = { n: 8, draw: function (i, P) {
    var k = (i >> 1) & 1;
    art(P, -3, -9 - k, HEADF); art(P, -3, -5 - k, BODYF);
    P(-4, -8 - k, 'S'); P(-4, -9 - k, 'S'); P(4, -8 - k, 'S'); P(4, -9 - k, 'S'); P(-4, -10 - k, 'S'); P(4, -10 - k, 'S');
    legsF(P, 0);
  } };
  A.drown = { n: 16, draw: function (i, P) {
    var s = i > 9 ? i - 9 : 0;
    if (i < 12) {
      var k = i & 1;
      art(P, -2, -4 + s, ['.GGG..', 'GGGGS.', 'ggSSES']);
      P(-3, -5 + s - k, 'S'); P(-3, -6 + s - k, 'S'); P(3, -5 + s - (1 - k), 'S'); P(3, -6 + s - (1 - k), 'S');
    } else { P(-1, -1 + (i - 12), 'G'); P(0, -1 + (i - 12), 'G'); }
    P(-5, -2 - (i & 3), 'L'); P(4, -4 - ((i + 2) & 3), 'W'); P(2, -6 - (i & 3), 'L');
  } };
  A.burn = { n: 14, draw: function (i, P) {
    var fire = ['#f8f060', '#f8a020', '#e04010', '#f8d020'];
    function F(x, y, c) { P(x, y, fire[(c + i) & 3]); }
    if (i < 10) {
      var k = i & 1;
      for (var r = 0; r < 4; r++) for (var c = 0; c < 6; c++) F(-2 + c, -9 + r, r + c);
      for (r = 0; r < 4; r++) for (c = 0; c < 5; c++) F(-2 + c, -5 + r, r * 2 + c);
      P(-3, -9 - k, '#f8a020'); P(3, -9 - (1 - k), '#f8a020'); P(-4, -7 - k, '#f8f060'); P(4, -7 - (1 - k), '#f8f060');
      P(-1, -1, '#e04010'); P(1, -1, '#e04010'); P(-1, 0, '#101010'); P(0, 0, '#101010'); P(1, 0, '#101010'); P(2, 0, '#101010');
      P(-1, -10 - k, '#f8f060'); P(1, -11 - k, '#f8a020'); P(0, -12, '#e04010');
    } else {
      P(-1, 0, '#101010'); P(0, 0, '#303030'); P(1, 0, '#101010'); P(0, -1 - (i - 10), '#808080'); P(1, -2 - (i - 10), '#606060');
    }
  } };

  /* bake every animation, right + left variants */
  function bake(fn, i) {
    var c = LM.mk(CW, CH), x = c.getContext('2d');
    var P = function (dx, dy, col) { x.fillStyle = C[col] || col; x.fillRect(AX + dx, AY + dy, 1, 1); };
    fn(i, P);
    var l = LM.mk(CW, CH), lx = l.getContext('2d');
    lx.translate(CW, 0); lx.scale(-1, 1); lx.drawImage(c, 0, 0);
    return [c, l];
  }
  LM.SPR.ax = AX; LM.SPR.ay = AY; LM.SPR.cw = CW; LM.SPR.ch = CH;
  for (var name in A) {
    var frames = [];
    for (var i = 0; i < A[name].n; i++) frames.push(bake(A[name].draw, i));
    LM.SPR[name] = frames;
  }
  /* draw a baked frame so the lemming's feet-anchor lands on (x,y) */
  LM.blitSpr = function (ctx, name, frame, dir, x, y) {
    var f = LM.SPR[name]; if (!f) return;
    var fr = f[frame % f.length][dir < 0 ? 1 : 0];
    ctx.drawImage(fr, Math.round(x) - AX, Math.round(y) - AY);
  };
})();

/* ============================================================
   SKILL / PANEL ICONS  (16x16, drawn on a dark ground)
   ============================================================ */
LM.ICON = {};
LM.makeIcons = function () {
  var BG = '#241414';
  function base() { var c = LM.mk(16, 16), g = c.getContext('2d'); g.fillStyle = BG; g.fillRect(0, 0, 16, 16); return [c, g]; }
  function put(g, name, frame, dir, ax, ay) {
    var fr = LM.SPR[name][frame][dir < 0 ? 1 : 0]; g.drawImage(fr, ax - LM.SPR.ax, ay - LM.SPR.ay);
  }
  var r, c, g;
  r = base(); c = r[0]; g = r[1];                                   /* climber */
  g.fillStyle = '#6c7488'; g.fillRect(11, 0, 4, 16); g.fillStyle = '#9aa4b8'; g.fillRect(11, 0, 1, 16);
  put(g, 'climb', 2, 1, 9, 15); LM.ICON.climber = c;
  r = base(); c = r[0]; g = r[1];                                   /* floater */
  put(g, 'float', 5, 1, 8, 15); LM.ICON.floater = c;
  r = base(); c = r[0]; g = r[1];                                   /* bomber (starburst) */
  var cx = 8, cy = 8, i, a;
  for (i = 0; i < 16; i++) {
    a = i / 16 * Math.PI * 2; var len = (i & 1) ? 4 : 7;
    for (var k = 1; k <= len; k++) { g.fillStyle = k > len - 2 ? '#f8e020' : (k > 3 ? '#f08010' : '#e02010'); g.fillRect(Math.round(cx + Math.cos(a) * k), Math.round(cy + Math.sin(a) * k), 1, 1); }
  }
  g.fillStyle = '#f8f8a0'; g.fillRect(7, 7, 2, 2);
  LM.ICON.bomber = c;
  r = base(); c = r[0]; g = r[1];                                   /* blocker */
  put(g, 'block', 0, 1, 8, 15); LM.ICON.blocker = c;
  r = base(); c = r[0]; g = r[1];                                   /* builder */
  g.fillStyle = '#e0a060'; g.fillRect(1, 14, 6, 2); g.fillRect(5, 12, 6, 2); g.fillRect(9, 10, 6, 2);
  g.fillStyle = '#fcd8a0'; g.fillRect(1, 14, 6, 1); g.fillRect(5, 12, 6, 1); g.fillRect(9, 10, 6, 1);
  put(g, 'build', 0, 1, 9, 9); LM.ICON.builder = c;
  r = base(); c = r[0]; g = r[1];                                   /* basher */
  g.fillStyle = '#a85c28'; g.fillRect(11, 1, 5, 15); g.fillStyle = '#d07830'; g.fillRect(11, 1, 2, 15);
  g.fillStyle = '#6a3412'; g.fillRect(13, 4, 3, 2); g.fillRect(12, 9, 3, 2);
  put(g, 'bash', 5, 1, 6, 15); LM.ICON.basher = c;
  r = base(); c = r[0]; g = r[1];                                   /* miner */
  g.fillStyle = '#a85c28'; g.fillRect(0, 12, 16, 4); g.fillStyle = '#d07830'; g.fillRect(0, 12, 16, 1);
  g.fillStyle = BG; g.fillRect(8, 13, 8, 3);
  put(g, 'mine', 5, 1, 5, 12); LM.ICON.miner = c;
  r = base(); c = r[0]; g = r[1];                                   /* digger */
  g.fillStyle = '#a85c28'; g.fillRect(0, 12, 16, 4); g.fillStyle = '#d07830'; g.fillRect(0, 12, 16, 1);
  g.fillStyle = BG; g.fillRect(5, 13, 6, 3);
  put(g, 'dig', 3, 1, 8, 13); LM.ICON.digger = c;
  r = base(); c = r[0]; g = r[1];                                   /* release rate - */
  g.fillStyle = '#0a6a14'; g.fillRect(4, 9, 9, 3); g.fillStyle = '#28e040'; g.fillRect(3, 8, 9, 3); LM.ICON.rrminus = c;
  r = base(); c = r[0]; g = r[1];                                   /* release rate + */
  g.fillStyle = '#0a6a14'; g.fillRect(4, 8, 9, 3); g.fillRect(7, 5, 3, 9);
  g.fillStyle = '#28e040'; g.fillRect(3, 7, 9, 3); g.fillRect(6, 4, 3, 9); LM.ICON.rrplus = c;
  r = base(); c = r[0]; g = r[1];                                   /* pause: paw prints */
  function paw(px, py) {
    g.fillStyle = '#080404'; g.fillRect(px + 1, py + 3, 4, 3); g.fillRect(px, py + 4, 6, 2);
    g.fillRect(px, py + 1, 1, 2); g.fillRect(px + 2, py, 2, 2); g.fillRect(px + 5, py + 1, 1, 2);
  }
  g.fillStyle = '#7a4a34'; g.fillRect(0, 0, 16, 16);
  paw(1, 1); paw(8, 8); LM.ICON.pause = c;
  r = base(); c = r[0]; g = r[1];                                   /* nuke: mushroom cloud */
  g.fillStyle = '#7a1c10'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#c03010'; g.fillRect(6, 8, 4, 8);
  g.fillStyle = '#f08010'; g.fillRect(3, 3, 10, 5); g.fillRect(2, 5, 12, 3);
  g.fillStyle = '#f8e020'; g.fillRect(4, 2, 8, 3); g.fillRect(5, 5, 6, 2);
  g.fillStyle = '#fff8b0'; g.fillRect(6, 3, 3, 2);
  g.fillStyle = '#e02010'; g.fillRect(7, 8, 2, 8); g.fillRect(4, 14, 8, 2);
  LM.ICON.nuke = c;
};

/* ============================================================
   MOUSE CURSORS
   ============================================================ */
LM.makeCursors = function () {
  var c = LM.mk(15, 15), g = c.getContext('2d');
  g.fillStyle = '#20e020';
  [[0, 7, 5, 1], [10, 7, 5, 1], [7, 0, 1, 5], [7, 10, 1, 5]].forEach(function (r) { g.fillRect(r[0], r[1], r[2], r[3]); });
  g.fillStyle = '#f8f020'; g.fillRect(7, 7, 1, 1);
  LM.curCross = c;
  var b = LM.mk(15, 15); g = b.getContext('2d'); g.fillStyle = '#20e020';
  for (var i = 0; i < 15; i++) if (i % 4 < 2) { g.fillRect(i, 0, 1, 1); g.fillRect(i, 14, 1, 1); g.fillRect(0, i, 1, 1); g.fillRect(14, i, 1, 1); }
  LM.curBox = b;
};

/* ============================================================
   WORLD OBJECTS
   ============================================================ */
LM.OBJ = {};
LM.makeObjects = function () {
  /* ----- entrance hatch: 4 frames (closed -> open), 40x14 ----- */
  var fr = [];
  for (var f = 0; f < 4; f++) {
    var c = LM.mk(40, 14), g = c.getContext('2d');
    g.fillStyle = '#3c1c08'; g.fillRect(0, 0, 40, 14);
    g.fillStyle = '#8c5020'; g.fillRect(1, 1, 38, 12);
    g.fillStyle = '#c88040'; g.fillRect(1, 1, 38, 1); g.fillRect(1, 1, 1, 12);
    g.fillStyle = '#5a2c10'; g.fillRect(1, 12, 38, 1); g.fillRect(38, 1, 1, 12);
    var ix = 5, iy = 3, iw = 30, ih = 8;
    if (f === 0) {                                  /* closed: sky-blue panel with a green hill */
      g.fillStyle = '#2a86c8'; g.fillRect(ix, iy, iw, ih);
      g.fillStyle = '#78c0f0'; g.fillRect(ix, iy, iw, 2);
      g.fillStyle = '#ffffff'; g.fillRect(ix + 4, iy + 1, 5, 1); g.fillRect(ix + 18, iy + 2, 6, 1);
      g.fillStyle = '#30a030'; g.fillRect(ix, iy + 6, iw, 2); g.fillRect(ix + 8, iy + 5, 12, 1);
      g.fillStyle = '#20701c'; g.fillRect(ix, iy + 7, iw, 1);
    } else {                                        /* opening: dark hole widens */
      g.fillStyle = '#2a86c8'; g.fillRect(ix, iy, iw, ih);
      var half = [0, 7, 11, 15][f];
      g.fillStyle = '#0a0a2a'; g.fillRect(ix + 15 - half, iy, half * 2, ih);
      g.fillStyle = '#5a2c10'; g.fillRect(ix + 15 - half - 1, iy, 1, ih); g.fillRect(ix + 15 + half, iy, 1, ih);
    }
    g.fillStyle = '#3c1c08'; g.fillRect(ix - 1, iy - 1, iw + 2, 1); g.fillRect(ix - 1, iy + ih, iw + 2, 1);
    g.fillStyle = '#e0b060'; g.fillRect(3, 3, 1, 1); g.fillRect(36, 3, 1, 1); g.fillRect(3, 10, 1, 1); g.fillRect(36, 10, 1, 1);
    fr.push(c);
  }
  LM.OBJ.entrance = fr;

  /* ----- exits: one per tileset, 4 flame frames, 32x26 ----- */
  LM.OBJ.exit = {};
  var STY = {
    dirt: ['#b86418', '#e89838', '#7a3a10'], marble: ['#c89018', '#f8d058', '#8a5c10'],
    brick: ['#d87890', '#f8b0c4', '#9a4860'], crystal: ['#4a84a8', '#a8dcf0', '#24506c']
  };
  Object.keys(STY).forEach(function (sty) {
    var P = STY[sty], frames = [];
    for (var f = 0; f < 4; f++) {
      var c = LM.mk(32, 26), g = c.getContext('2d');
      /* body (trapezoid) */
      for (var y = 6; y < 26; y++) {
        var t = (y - 6) / 19, half = 9 + Math.round(t * 5);
        g.fillStyle = P[0]; g.fillRect(16 - half, y, half * 2, 1);
        g.fillStyle = P[1]; g.fillRect(16 - half, y, 2, 1);
        g.fillStyle = P[2]; g.fillRect(16 + half - 2, y, 2, 1);
      }
      g.fillStyle = P[1]; g.fillRect(6, 6, 20, 2);
      g.fillStyle = P[2]; g.fillRect(6, 8, 20, 1);
      /* doorway */
      g.fillStyle = '#04043c'; g.fillRect(10, 12, 12, 14);
      g.fillStyle = '#1010a0'; g.fillRect(11, 13, 10, 12);
      g.fillStyle = '#3030e0'; g.fillRect(12, 20, 8, 5); g.fillStyle = '#6060ff'; g.fillRect(13, 22, 6, 3);
      g.fillStyle = '#04043c'; g.fillRect(10, 11, 12, 1);
      /* torches */
      [[5, 2], [26, 2]].forEach(function (t) {
        g.fillStyle = '#6a3412'; g.fillRect(t[0], 4, 2, 5);
        var fc = ['#f8f060', '#f8a020', '#e04010'];
        g.fillStyle = fc[(f + 0) % 3]; g.fillRect(t[0] - 1, t[1] + 1, 4, 3);
        g.fillStyle = fc[(f + 1) % 3]; g.fillRect(t[0], t[1] - (f & 1), 2, 3);
        g.fillStyle = '#fff8b0'; g.fillRect(t[0], t[1] + 2, 2, 1);
      });
      frames.push(c);
    }
    LM.OBJ.exit[sty] = frames;
  });

  /* ----- fire trap: 4 frames, 16x16 ----- */
  var ff = [];
  for (var k = 0; k < 4; k++) {
    var c2 = LM.mk(16, 16), g2 = c2.getContext('2d');
    g2.fillStyle = '#4a4a5c'; g2.fillRect(1, 12, 14, 4); g2.fillStyle = '#8a8aa0'; g2.fillRect(1, 12, 14, 1);
    g2.fillStyle = '#20202c'; g2.fillRect(1, 15, 14, 1);
    var cols = ['#e02010', '#f08010', '#f8e020', '#fff8b0'];
    for (var x = 2; x < 14; x++) {
      var h = 4 + Math.floor(LM.hash(x, k, 11) * 8); if (x < 4 || x > 11) h -= 3;
      for (var j = 0; j < h; j++) {
        var ci = Math.min(3, Math.floor(j / h * 3.6)); g2.fillStyle = cols[3 - ci]; g2.fillRect(x, 12 - j, 1, 1);
      }
    }
    ff.push(c2);
  }
  LM.OBJ.fire = ff;
};

/* ============================================================
   TERRAIN TEXTURES  (return [r,g,b] for world pixel x,y)
   ============================================================ */
(function () {
  function mix(pal, v) { var i = Math.min(pal.length - 1, Math.max(0, Math.floor(v * pal.length))); return pal[i]; }
  var DIRT = ['#5c1e0c', '#7e2c10', '#a8481a', '#c8641c', '#d87c24', '#ec9c40'].map(LM.rgb);
  var MARB = ['#7c4608', '#a8680e', '#c88a18', '#e0a424', '#f0c040', '#fcdc70'].map(LM.rgb);
  var CRYS = ['#10283e', '#1c4060', '#2e5c80', '#4a84a8', '#80b8d4', '#b8e0f0'].map(LM.rgb);
  var PILL = ['#fcdc70', '#f0c040', '#e0a424', '#c88a18', '#a8680e', '#c88a18', '#e0a424', '#f0c040'].map(LM.rgb);
  var STEEL = { base: LM.rgb('#7e8ca0'), hi: LM.rgb('#c8d4e0'), lo: LM.rgb('#3e4a5c'), rivet: LM.rgb('#e8eef4') };
  var BRK = { fill: ['#e890a4', '#ec9cb0', '#f0a8bc', '#e484a0'].map(LM.rgb), mortar: LM.rgb('#a85470'), hi: LM.rgb('#fcc8d8'), lo: LM.rgb('#c4607c') };
  LM.TEX = {
    dirt: function (x, y) {
      var v = LM.vnoise(x / 5, y / 4, 1) * 0.55 + LM.vnoise(x / 2, y / 2, 2) * 0.3 + LM.hash(x, y, 3) * 0.3;
      return mix(DIRT, (v - 0.12) / 0.95);
    },
    marble: function (x, y) {
      var v = LM.vnoise(x / 14, y / 2.4, 4) * 0.55 + LM.vnoise(x / 3, y / 3, 5) * 0.25 + LM.hash(x, y, 6) * 0.25;
      return mix(MARB, (v - 0.1) / 0.95);
    },
    crystal: function (x, y) {
      var v = LM.vnoise(x / 6 + y / 9, y / 4, 7) * 0.65 + LM.hash(x, y, 8) * 0.28;
      return mix(CRYS, (v - 0.04) / 0.95);
    },
    pillar: function (x, y) { var c = PILL[((x % 8) + 8) % 8]; if (LM.hash(x, y, 9) < 0.08) c = PILL[3]; return c; },
    brick: function (x, y) {
      var row = Math.floor(y / 8), bx = x + (row & 1 ? 8 : 0), cx = ((bx % 16) + 16) % 16, cy = ((y % 8) + 8) % 8;
      if (cy === 7 || cx === 15) return BRK.mortar;
      if (cy === 0 || cx === 0) return BRK.hi;
      if (cy === 6 || cx === 14) return BRK.lo;
      return BRK.fill[Math.floor(LM.hash(Math.floor(bx / 16), row, 10) * 4)];
    },
    steel: function (x, y) {
      var cx = ((x % 8) + 8) % 8, cy = ((y % 8) + 8) % 8;
      if (cx === 0 || cy === 0) return STEEL.hi;
      if (cx === 7 || cy === 7) return STEEL.lo;
      if ((cx === 2 || cx === 5) && (cy === 2 || cy === 5)) return STEEL.rivet;
      return STEEL.base;
    }
  };
  /* surface colours used by the edge pass, per style */
  LM.EDGE = {
    dirt:    { top: ['#2c9a1c', '#48c030', '#1c7414'].map(LM.rgb), sub: LM.rgb('#1c6a14') },
    marble:  { top: ['#fce890', '#f8d860', '#fcf0b0'].map(LM.rgb), sub: LM.rgb('#d89a18') },
    brick:   { top: ['#fcdce8', '#f8c8d8', '#fce8f0'].map(LM.rgb), sub: LM.rgb('#e890a4') },
    crystal: { top: ['#d8f4ff', '#b8e4f8', '#e8fbff'].map(LM.rgb), sub: LM.rgb('#6a9cc0') }
  };
  LM.BG = '#0a0a3a';
})();

LM.initGfx = function () { LM.initFonts(); LM.makeIcons(); LM.makeCursors(); LM.makeObjects(); };
