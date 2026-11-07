'use strict';
/* ============================================================
   LEMMINGS (fan recreation) - game engine
   terrain painter, lemming state machine, skills, HUD / panel
   ============================================================ */
var LM = window.LM = window.LM || {};
LM.TPS = 17;                         /* game ticks per second */
LM.TICK_MS = 1000 / LM.TPS;
LM.SKILLS = ['climber', 'floater', 'bomber', 'blocker', 'builder', 'basher', 'miner', 'digger'];
LM.ST = { FALL: 0, WALK: 1, CLIMB: 2, HOIST: 3, FLOAT: 4, DIG: 5, BUILD: 6, SHRUG: 7, BASH: 8, MINE: 9, BLOCK: 10,
          OHNO: 11, SPLAT: 12, EXIT: 13, DROWN: 14, BURN: 15, DEAD: 16 };

/* ============================================================
   TERRAIN PAINTER  - level scripts draw with this
   ============================================================ */
LM.Painter = function (style, W, H) {
  this.style = style; this.W = W; this.H = H;
  this.T = new Uint8Array(W * H);          /* 0 air, 1 diggable, 2 steel */
  this.OW = new Uint8Array(W * H);         /* one-way: 1 = right only, 2 = left only */
  this.NE = new Uint8Array(W * H);         /* no edge-styling flag */
  this.rgb = new Uint8ClampedArray(W * H * 4);
  this.waters = []; this.traps = [];
};
LM.Painter.prototype = {
  _set: function (x, y, v, col, ne) {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    var i = y * this.W + x; this.T[i] = v; this.NE[i] = ne ? 1 : 0; this.OW[i] = 0;
    i *= 4; this.rgb[i] = col[0]; this.rgb[i + 1] = col[1]; this.rgb[i + 2] = col[2]; this.rgb[i + 3] = 255;
  },
  _erase: function (x, y) {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    var i = y * this.W + x; this.T[i] = 0; this.OW[i] = 0; this.rgb[i * 4 + 3] = 0;
  },
  _apply: function (x, y, o) {
    if (o.erase) { this._erase(x, y); return; }
    if (o.steel) { this._set(x, y, 2, LM.TEX.steel(x, y), true); return; }
    var tex = o.tex || this.style;
    this._set(x, y, 1, LM.TEX[tex](x, y), tex !== this.style);
  },
  rect: function (x, y, w, h, o) {
    o = o || {};
    for (var yy = y; yy < y + h; yy++) for (var xx = x; xx < x + w; xx++) this._apply(xx, yy, o);
    return this;
  },
  ell: function (cx, cy, rx, ry, o) {
    o = o || {};
    for (var yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++)
      for (var xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
        var dx = (xx - cx) / rx, dy = (yy - cy) / ry;
        if (dx * dx + dy * dy <= 1) this._apply(xx, yy, o);
      }
    return this;
  },
  poly: function (pts, o) {
    o = o || {}; var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, i, j;
    for (i = 0; i < pts.length; i++) { x0 = Math.min(x0, pts[i][0]); x1 = Math.max(x1, pts[i][0]); y0 = Math.min(y0, pts[i][1]); y1 = Math.max(y1, pts[i][1]); }
    for (var y = Math.floor(y0); y <= y1; y++) for (var x = Math.floor(x0); x <= x1; x++) {
      var inside = false;
      for (i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
      }
      if (inside) this._apply(x, y, o);
    }
    return this;
  },
  /* terrain strip: top surface follows polyline pts, filled down to `bottom` */
  ground: function (pts, bottom, o) {
    o = o || {};
    for (var s = 0; s < pts.length - 1; s++) {
      var a = pts[s], b = pts[s + 1];
      for (var x = a[0]; x < b[0]; x++) {
        var t = (x - a[0]) / (b[0] - a[0]), top = Math.round(a[1] + (b[1] - a[1]) * t);
        for (var y = top; y < bottom; y++) this._apply(x, y, o);
      }
    }
    return this;
  },
  steel: function (x, y, w, h) { return this.rect(x, y, w, h, { steel: true }); },
  cut: function (x, y, w, h) { return this.rect(x, y, w, h, { erase: true }); },
  cutEll: function (cx, cy, rx, ry) { return this.ell(cx, cy, rx, ry, { erase: true }); },
  oneway: function (x, y, w, h, dir) {          /* dir: 1 = right, -1 = left */
    for (var yy = y; yy < y + h; yy++) for (var xx = x; xx < x + w; xx++) {
      if (xx < 0 || yy < 0 || xx >= this.W || yy >= this.H) continue;
      var i = yy * this.W + xx; if (this.T[i] === 1) this.OW[i] = dir > 0 ? 1 : 2;
    }
    return this;
  },
  water: function (x, y, w, h) { this.waters.push({ x: x, y: y, w: w, h: h }); return this; },
  fire: function (x, y) { this.traps.push({ type: 'fire', x: x, y: y }); return this; },
  /* final styling pass: surface highlights, shading, one-way arrows */
  finish: function () {
    var W = this.W, H = this.H, T = this.T, rgb = this.rgb, E = LM.EDGE[this.style], x, y, i, p;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      i = y * W + x; if (T[i] !== 1 || this.NE[i]) continue;
      p = i * 4;
      var up1 = y > 0 ? T[i - W] : 0, up2 = y > 1 ? T[i - 2 * W] : 0;
      if (!up1) { var c = E.top[Math.floor(LM.hash(x, y, 21) * E.top.length)]; rgb[p] = c[0]; rgb[p + 1] = c[1]; rgb[p + 2] = c[2]; }
      else if (!up2 && LM.hash(x, y, 22) < 0.75) { rgb[p] = E.sub[0]; rgb[p + 1] = E.sub[1]; rgb[p + 2] = E.sub[2]; }
      else if (y < H - 1 && !T[i + W]) { rgb[p] = rgb[p] * 0.72; rgb[p + 1] = rgb[p + 1] * 0.72; rgb[p + 2] = rgb[p + 2] * 0.72; }
    }
    /* one-way arrows */
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      i = y * W + x; if (!this.OW[i]) continue; p = i * 4;
      rgb[p] *= 0.5; rgb[p + 1] *= 0.5; rgb[p + 2] *= 0.5;
      var u = x % 14, v = y % 10, dd = Math.abs(v - 4), right = this.OW[i] === 1;
      if (!right) u = 13 - u;
      if ((v === 4 && u >= 1 && u <= 9) || (u >= 7 && u <= 10 && dd <= 10 - u)) { rgb[p] = 248; rgb[p + 1] = 96; rgb[p + 2] = 168; }
    }
    for (i = 0; i < W * H; i++) rgb[i * 4 + 3] = T[i] ? 255 : 0;
  }
};

/* ============================================================
   GAME
   ============================================================ */
LM.BRICK = { dirt: '#e0a060', marble: '#f0d890', brick: '#f8d0dc', crystal: '#c8ecf8' };

LM.Game = function (lvl) {
  var W = lvl.width || 960, H = 160;
  this.lvl = lvl; this.W = W; this.H = H; this.style = lvl.style;
  var P = new LM.Painter(lvl.style, W, H);
  lvl.build(P); P.finish();
  this.T = P.T; this.OW = P.OW; this.waters = P.waters; this.traps = P.traps;
  this.img = new ImageData(P.rgb, W, H);
  this.tcv = LM.mk(W, H); this.tctx = this.tcv.getContext('2d'); this.tctx.putImageData(this.img, 0, 0);
  this.dirty = null;
  this.ent = { x: lvl.entrance[0], y: lvl.entrance[1] };
  this.exit = { x: lvl.exit[0], y: lvl.exit[1] };
  this.brickRGB = LM.rgb(LM.BRICK[lvl.style]);
  this.lems = []; this.parts = []; this.blockers = [];
  this.t = 0; this.relCount = 0; this.lastRel = -999;
  this.rate = lvl.rate; this.minRate = lvl.rate;
  this.skills = {}; var self = this;
  LM.SKILLS.forEach(function (s) { self.skills[s] = (lvl.skills && lvl.skills[s]) || 0; });
  this.sel = 'digger'; for (var k = LM.SKILLS.length - 1; k >= 0; k--) if (this.skills[LM.SKILLS[k]] > 0) this.sel = LM.SKILLS[k];
  this.saved = 0; this.lost = 0;
  this.timeLeft = lvl.time * 60 * LM.TPS;
  this.paused = false; this.nuked = false; this.nukeIdx = 0; this.nukeArm = 0;
  this.over = false; this.overT = 0; this.reason = '';
  this.entFrame = 0; this.scrollX = lvl.scroll || 0; this.rrHold = 0; this.rrT = 0;
  this.mini = LM.mk(Math.ceil(W / 16), 20); this.miniDirty = true;
  this.ff = false; this.stats = {};
};

LM.Game.prototype = {
  /* ---------- terrain access ---------- */
  at: function (x, y) { return (x < 0 || y < 0 || x >= this.W || y >= this.H) ? 0 : this.T[y * this.W + x]; },
  solid: function (x, y) { return (x < 0 || y < 0 || x >= this.W || y >= this.H) ? false : this.T[y * this.W + x] !== 0; },
  _touch: function (x0, y0, x1, y1) {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(this.W - 1, x1); y1 = Math.min(this.H - 1, y1);
    if (x1 < x0 || y1 < y0) return;
    var d = this.dirty; if (!d) this.dirty = { x0: x0, y0: y0, x1: x1, y1: y1 };
    else { d.x0 = Math.min(d.x0, x0); d.y0 = Math.min(d.y0, y0); d.x1 = Math.max(d.x1, x1); d.y1 = Math.max(d.y1, y1); }
    this.miniDirty = true;
  },
  clearPx: function (x, y) {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    var i = y * this.W + x; if (this.T[i] !== 1) return;
    this.T[i] = 0; this.OW[i] = 0; this.img.data[i * 4 + 3] = 0;
  },
  clearRect: function (x, y, w, h) {
    for (var yy = y; yy < y + h; yy++) for (var xx = x; xx < x + w; xx++) this.clearPx(xx, yy);
    this._touch(x, y, x + w, y + h);
  },
  clearEllipse: function (cx, cy, rx, ry) {
    for (var yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++)
      for (var xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
        var dx = (xx - cx) / rx, dy = (yy - cy) / ry; if (dx * dx + dy * dy <= 1) this.clearPx(xx, yy);
      }
    this._touch(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1);
  },
  addPx: function (x, y, col) {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    var i = y * this.W + x; if (this.T[i]) return;
    this.T[i] = 1; var p = i * 4, d = this.img.data;
    d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255;
  },
  /* look at a region: any diggable? any steel? any wrong-way one-way wall? */
  scan: function (x0, y0, w, h, dir) {
    var r = { any: false, steel: false, wrong: false };
    for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) {
      var v = this.at(x, y); if (!v) continue;
      if (v === 2) { r.steel = true; continue; }
      r.any = true;
      var ow = this.OW[y * this.W + x]; if (ow && ow !== (dir > 0 ? 1 : 2)) r.wrong = true;
    }
    return r;
  },
  scanEll: function (cx, cy, rx, ry, dir) {
    var r = { any: false, steel: false, wrong: false };
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      var dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy > 1) continue;
      var v = this.at(x, y); if (!v) continue;
      if (v === 2) { r.steel = true; continue; }
      r.any = true;
      var ow = this.OW[y * this.W + x]; if (ow && ow !== (dir > 0 ? 1 : 2)) r.wrong = true;
    }
    return r;
  },
  flush: function () {
    var d = this.dirty; if (!d) return;
    this.tctx.putImageData(this.img, 0, 0, d.x0, d.y0, d.x1 - d.x0 + 1, d.y1 - d.y0 + 1);
    this.dirty = null;
  },

  /* ---------- lemming lifecycle ---------- */
  release: function () {
    var L = { id: this.relCount, x: this.ent.x, y: this.ent.y + 14, dir: 1, st: LM.ST.FALL, f: 0, fall: 0,
              climber: false, floater: false, bomb: -1, bricks: 0, hoistY: 0 };
    this.relCount++; this.lems.push(L);
  },
  startFall: function (L) { L.st = LM.ST.FALL; L.fall = 0; L.f = 0; },
  die: function (L) { L.st = LM.ST.DEAD; this.lost++; },
  groundOK: function (L) {                       /* returns false if the lemming started to fall */
    if (this.solid(L.x, L.y + 1)) return true;
    for (var k = 1; k <= 3; k++) if (this.solid(L.x, L.y + 1 + k)) { L.y += k; return true; }
    this.startFall(L); return false;
  },
  blockerAhead: function (L) {
    for (var i = 0; i < this.blockers.length; i++) {
      var B = this.blockers[i]; if (B === L || Math.abs(B.y - L.y) > 5) continue;
      var dx = B.x - L.x;
      if (dx === 0 || (L.dir > 0 && dx > 0 && dx <= 6) || (L.dir < 0 && dx < 0 && dx >= -6)) return true;
    }
    return false;
  },

  tick: function () {
    if (this.over) return;
    var ST = LM.ST, i, L;
    this.t++;
    this.entFrame = this.t < 6 ? 0 : this.t < 12 ? 1 : this.t < 18 ? 2 : 3;
    if (this.t === 1) LM.snd && LM.snd.play('door');
    this.timeLeft--;
    /* release */
    if (!this.nuked && this.relCount < this.lvl.num && this.t >= 30) {
      var iv = Math.ceil((103 - this.rate) / 2);
      if (this.t - this.lastRel >= iv) { this.release(); this.lastRel = this.t; }
    }
    /* nuke: hand every lemming a bomb timer, a couple per tick */
    if (this.nuked) {
      for (var n = 0; n < 2 && this.nukeIdx < this.lems.length; n++) {
        L = this.lems[this.nukeIdx++]; if (L.bomb < 0 && L.st < ST.OHNO) L.bomb = 5 * LM.TPS - ((L.id * 7) % 14);
      }
    }
    this.blockers = [];
    for (i = 0; i < this.lems.length; i++) if (this.lems[i].st === ST.BLOCK) this.blockers.push(this.lems[i]);
    var anyDead = false;
    for (i = 0; i < this.lems.length; i++) {
      L = this.lems[i]; if (L.st === ST.DEAD) continue;
      this.updLem(L);
      if (L.st === ST.DEAD) anyDead = true;
    }
    if (anyDead) this.lems = this.lems.filter(function (l) { return l.st !== ST.DEAD; });
    this.updParts();
    this.flush();
    /* level end checks */
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.over = true; this.reason = 'time'; }
    else if ((this.relCount >= this.lvl.num || this.nuked) && this.lems.length === 0) { this.over = true; this.reason = this.nuked ? 'nuke' : 'done'; }
  },

  updLem: function (L) {
    var ST = LM.ST;
    /* bomb countdown */
    if (L.bomb >= 0 && L.st < ST.OHNO) {
      L.bomb--;
      if (L.bomb <= 0) { L.bomb = -1; L.st = ST.OHNO; L.f = 0; LM.snd && LM.snd.play('ohno'); return; }
    }
    switch (L.st) {
      case ST.WALK: this.doWalk(L); break;
      case ST.FALL: this.doFall(L); break;
      case ST.FLOAT: this.doFloat(L); break;
      case ST.CLIMB: this.doClimb(L); break;
      case ST.HOIST: this.doHoist(L); break;
      case ST.DIG: this.doDig(L); break;
      case ST.BUILD: this.doBuild(L); break;
      case ST.SHRUG: if (++L.f >= 8) { L.st = ST.WALK; L.f = 0; } break;
      case ST.BASH: this.doBash(L); break;
      case ST.MINE: this.doMine(L); break;
      case ST.BLOCK: L.f = (L.f + 1) & 15; if (!this.solid(L.x, L.y + 1)) this.startFall(L); break;
      case ST.OHNO: if (++L.f >= 16) this.explode(L); break;
      case ST.SPLAT: if (++L.f >= 16) L.st = ST.DEAD; break;
      case ST.EXIT: if (++L.f >= 16) { L.st = ST.DEAD; this.saved++; } break;
      case ST.DROWN: if (++L.f >= 16) L.st = ST.DEAD; break;
      case ST.BURN: if (++L.f >= 14) L.st = ST.DEAD; break;
    }
    if (L.st < ST.OHNO || L.st === ST.OHNO) this.checkObjects(L);
  },

  checkObjects: function (L) {
    var ST = LM.ST, i;
    if (L.x < -4 || L.x > this.W + 4 || L.y > this.H + 12) { this.die(L); return; }
    if (L.st === ST.OHNO) return;
    if (L.st !== ST.BLOCK && Math.abs(L.x - this.exit.x) <= 3 && L.y >= this.exit.y - 6 && L.y <= this.exit.y + 3) {
      L.st = ST.EXIT; L.f = 0; L.bomb = -1; LM.snd && LM.snd.play('yippee'); return;
    }
    for (i = 0; i < this.waters.length; i++) {
      var w = this.waters[i];
      if (L.x >= w.x && L.x < w.x + w.w && L.y >= w.y + 2 && L.y <= w.y + w.h) {
        L.st = ST.DROWN; L.f = 0; L.bomb = -1; L.y = w.y + 4; this.lost++; LM.snd && LM.snd.play('drown'); return;
      }
    }
    for (i = 0; i < this.traps.length; i++) {
      var tr = this.traps[i];
      if (L.x >= tr.x + 3 && L.x <= tr.x + 12 && L.y >= tr.y + 6 && L.y <= tr.y + 18) {
        L.st = ST.BURN; L.f = 0; L.bomb = -1; this.lost++; LM.snd && LM.snd.play('fire'); return;
      }
    }
  },

  doWalk: function (L) {
    var ST = LM.ST;
    L.f = (L.f + 1) & 7;
    if (!this.groundOK(L)) return;
    if (this.blockerAhead(L)) { L.dir = -L.dir; return; }
    var nx = L.x + L.dir, h = 0;
    while (h < 7 && this.solid(nx, L.y - h)) h++;
    if (h === 0) { L.x = nx; }
    else if (h < 7) {
      if (this.solid(nx, L.y - h - 8) || this.solid(nx, L.y - h - 9)) { L.dir = -L.dir; return; }
      L.x = nx; L.y -= h;
    } else {
      if (L.climber) { L.st = ST.CLIMB; L.f = 0; return; }
      L.dir = -L.dir;
    }
  },
  doFall: function (L) {
    var ST = LM.ST; L.f++;
    if (L.floater && L.fall >= 12) { L.st = ST.FLOAT; L.f = 0; return; }
    for (var i = 0; i < 3; i++) {
      if (this.solid(L.x, L.y + 1)) {
        if (L.fall > 63 && !L.floater) { L.st = ST.SPLAT; L.f = 0; L.bomb = -1; this.lost++; LM.snd && LM.snd.play('splat'); }
        else { L.st = ST.WALK; L.f = 0; }
        L.fall = 0; return;
      }
      L.y++; L.fall++;
      if (L.y > this.H + 10) { this.die(L); return; }
    }
  },
  doFloat: function (L) {
    var ST = LM.ST; L.f++;
    for (var i = 0; i < 2; i++) {
      if (this.solid(L.x, L.y + 1)) { L.st = ST.WALK; L.f = 0; L.fall = 0; return; }
      L.y++; if (L.y > this.H + 10) { this.die(L); return; }
    }
  },
  doClimb: function (L) {
    var ST = LM.ST, d = L.dir; L.f++;
    if (this.solid(L.x, L.y - 10)) { L.dir = -d; L.st = ST.FALL; L.fall = 0; L.f = 0; return; }
    if (!this.solid(L.x + d, L.y - 9)) {
      var r = L.y - 9; while (r < L.y && !this.solid(L.x + d, r + 1)) r++;
      L.hoistY = r; L.st = ST.HOIST; L.f = 0; return;
    }
    L.y--;
  },
  doHoist: function (L) {
    var ST = LM.ST; L.f++;
    if (L.y > L.hoistY) L.y = Math.max(L.hoistY, L.y - 2);
    if (L.f >= 8) { L.x += L.dir; L.y = L.hoistY; L.st = ST.WALK; L.f = 0; }
  },
  doDig: function (L) {
    var ST = LM.ST, f = L.f; L.f = (L.f + 1) & 15;
    if (!this.solid(L.x, L.y + 1)) { this.startFall(L); return; }
    if (f === 0 || f === 8) {
      var y = L.y + 1, x0 = L.x - 4, steel = false;
      for (var x = x0; x < x0 + 9; x++) if (this.at(x, y) === 2) steel = true;
      if (steel) { LM.snd && LM.snd.play('chink'); L.st = ST.WALK; L.f = 0; return; }
      this.clearRect(x0, y, 9, 1); L.y++;
      LM.snd && LM.snd.play('dig');
      if (!this.solid(L.x, L.y + 1)) this.startFall(L);
    }
  },
  doBuild: function (L) {
    var ST = LM.ST, f = L.f, d = L.dir; L.f++;
    if (f === 9) {
      var x0 = d > 0 ? L.x + 1 : L.x - 6, b = this.brickRGB;
      for (var i = 0; i < 6; i++) {
        var c = (i === 0 || i === 5) ? [b[0] * 0.8, b[1] * 0.8, b[2] * 0.8] : b;
        if (!this.at(x0 + i, L.y)) this.addPx(x0 + i, L.y, c);
      }
      this._touch(x0, L.y, x0 + 6, L.y);
      L.bricks--;
      LM.snd && LM.snd.play(L.bricks < 3 ? 'ping' : 'plink');
    }
    if (f === 15) {
      L.f = 0;
      var nx = L.x + 2 * d, ny = L.y - 1;
      if (this.solid(nx, ny) || this.solid(nx + d, ny) || this.solid(nx + d, ny - 4) || this.solid(nx, ny - 9)) {
        L.dir = -d; L.st = ST.WALK; L.f = 0; return;
      }
      L.x = nx; L.y = ny;
      if (L.bricks <= 0) { L.st = ST.SHRUG; L.f = 0; }
    }
  },
  doBash: function (L) {
    var ST = LM.ST, f = L.f, h = f & 15, d = L.dir; L.f = (L.f + 1) & 31;
    if (!this.groundOK(L)) return;
    if (h === 2) {
      var x0 = d > 0 ? L.x + 1 : L.x - 6, s = this.scan(x0, L.y - 9, 6, 10, d);
      if (s.steel || s.wrong) { LM.snd && LM.snd.play('chink'); L.dir = -d; L.st = ST.WALK; L.f = 0; return; }
      if (!s.any) { L.st = ST.WALK; L.f = 0; return; }
      this.clearRect(x0, L.y - 9, 6, 10);
      LM.snd && LM.snd.play('bash');
      this.dust(x0 + (d > 0 ? 5 : 0), L.y - 4, 3);
    }
    if (h >= 6 && h <= 10) {
      var nx = L.x + d; if (!this.solid(nx, L.y) && !this.solid(nx, L.y - 4)) L.x = nx;
    }
  },
  doMine: function (L) {
    var ST = LM.ST, f = L.f, d = L.dir; L.f = (L.f + 1) % 24;
    if (!this.groundOK(L)) return;
    if (f === 1 || f === 13) {
      var cx = L.x + 2 * d, cy = L.y - 4, s = this.scanEll(cx, cy, 5, 5.5, d);
      if (s.steel || s.wrong) { LM.snd && LM.snd.play('chink'); L.dir = -d; L.st = ST.WALK; L.f = 0; return; }
      if (!s.any) { L.st = ST.WALK; L.f = 0; return; }
      this.clearEllipse(cx, cy, 5, 5.5);
      LM.snd && LM.snd.play('mine');
      this.dust(cx + d * 3, cy + 3, 3);
    }
    if (f === 3 || f === 15) {
      L.x += 2 * d; L.y += 1;
      if (!this.solid(L.x, L.y + 1)) this.startFall(L);
    }
  },
  explode: function (L) {
    var cols = ['#18c84c', '#3c3cf0', '#f8cab8', '#2222b4', '#18c84c', '#e8a878'];
    this.clearEllipse(L.x, L.y - 5, 8, 8.5);
    for (var k = 0; k < 70; k++) {
      var a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 3.2;
      this.parts.push({ x: L.x, y: L.y - 5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.8, c: cols[k % 6], life: 22 + Math.random() * 22 });
    }
    LM.snd && LM.snd.play('pop');
    L.st = LM.ST.DEAD; L.bomb = -1; this.lost++;
    this.flush();
  },
  dust: function (x, y, n) {
    for (var k = 0; k < n; k++) this.parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 1.6, c: '#a8481a', life: 6 + Math.random() * 6 });
  },
  updParts: function () {
    var ps = this.parts, j = 0;
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i]; p.vy += 0.34; p.x += p.vx; p.y += p.vy; p.life--;
      if (p.life > 0 && p.y < this.H + 20) ps[j++] = p;
    }
    ps.length = j;
  },

  /* ---------- player actions ---------- */
  canAssign: function (L, skill) {
    var ST = LM.ST; if (L.st >= ST.OHNO) return false;
    if (this.skills[skill] <= 0) return false;
    switch (skill) {
      case 'climber': return !L.climber;
      case 'floater': return !L.floater;
      case 'bomber': return L.bomb < 0;
      case 'blocker': return L.st === ST.WALK;
      case 'builder': return L.st === ST.WALK || L.st === ST.DIG || L.st === ST.BASH || L.st === ST.MINE;
      case 'basher': return L.st === ST.WALK || L.st === ST.DIG || L.st === ST.BUILD || L.st === ST.MINE;
      case 'miner': return L.st === ST.WALK || L.st === ST.DIG || L.st === ST.BUILD || L.st === ST.BASH;
      case 'digger': return L.st === ST.WALK || L.st === ST.BUILD || L.st === ST.BASH || L.st === ST.MINE;
    }
    return false;
  },
  assign: function (L, skill) {
    var ST = LM.ST;
    if (!this.canAssign(L, skill)) return false;
    switch (skill) {
      case 'climber': L.climber = true; break;
      case 'floater': L.floater = true; break;
      case 'bomber': L.bomb = 5 * LM.TPS; break;
      case 'blocker': L.st = ST.BLOCK; L.f = 0; break;
      case 'builder': L.st = ST.BUILD; L.f = 0; L.bricks = 12; break;
      case 'basher': L.st = ST.BASH; L.f = 0; break;
      case 'miner': L.st = ST.MINE; L.f = 0; break;
      case 'digger': L.st = ST.DIG; L.f = 0; break;
    }
    this.skills[skill]--;
    LM.snd && LM.snd.play('assign');
    return true;
  },
  pick: function (wx, wy) {
    var best = null, bd = 1e9, bestOk = false, ST = LM.ST;
    for (var i = 0; i < this.lems.length; i++) {
      var L = this.lems[i]; if (L.st >= ST.OHNO) continue;
      var dx = wx - L.x, dy = wy - (L.y - 5);
      if (Math.abs(dx) > 6 || dy < -8 || dy > 8) continue;
      var ok = this.canAssign(L, this.sel), d = dx * dx + dy * dy;
      if ((ok && !bestOk) || (ok === bestOk && d < bd)) { best = L; bd = d; bestOk = ok; }
    }
    return best;
  },
  nameOf: function (L) {
    var ST = LM.ST;
    switch (L.st) {
      case ST.BLOCK: return 'BLOCKER'; case ST.DIG: return 'DIGGER'; case ST.BUILD: case ST.SHRUG: return 'BUILDER';
      case ST.BASH: return 'BASHER'; case ST.MINE: return 'MINER'; case ST.CLIMB: case ST.HOIST: return 'CLIMBER';
    }
    if (L.climber && L.floater) return 'ATHLETE';
    if (L.floater) return 'FLOATER';
    if (L.climber) return 'CLIMBER';
    if (L.bomb >= 0) return 'BOMBER';
    return L.st === ST.FALL ? 'FALLER' : 'WALKER';
  },
  countName: function (n) { var c = 0; for (var i = 0; i < this.lems.length; i++) if (this.lems[i].st < LM.ST.OHNO && this.nameOf(this.lems[i]) === n) c++; return c; },
  setRate: function (r) {
    this.rate = Math.max(this.minRate, Math.min(99, r));
  },
  nuke: function () { if (this.nuked) return; this.nuked = true; this.nukeIdx = 0; LM.snd && LM.snd.play('ohno'); },
  scrollBy: function (dx) { this.scrollX = Math.max(0, Math.min(this.W - LM.W, this.scrollX + dx)); },
  scrollTo: function (x) { this.scrollX = Math.max(0, Math.min(this.W - LM.W, x)); },
  outCount: function () { var c = 0; for (var i = 0; i < this.lems.length; i++) if (this.lems[i].st < LM.ST.SPLAT) c++; return c; },
  pct: function () { return Math.floor(this.saved * 100 / this.lvl.num); },
  result: function () {
    var need = Math.ceil(this.lvl.num * this.lvl.save / 100);
    return { saved: this.saved, total: this.lvl.num, needPct: this.lvl.save, needCount: need, pct: this.pct(), ok: this.saved >= need, reason: this.reason };
  },

  /* per-frame housekeeping (called every animation frame) */
  frame: function (input) {
    if (this.over) this.overT++;
    this.updMini();
    if (this.nukeArm > 0) this.nukeArm--;
    /* held release-rate buttons repeat */
    if (this.rrHold) { if (this.rrT === 0 || (this.rrT > 14 && this.rrT % 2 === 0)) this.setRate(this.rate + this.rrHold); this.rrT++; }
    var sp = input.fast ? 5 : 2.5;
    if (input.scrollDir) this.scrollBy(input.scrollDir * sp);
    if (this.over) { this.updParts(); this.flush(); }
  },

  updMini: function () {
    if (!this.miniDirty) return; this.miniDirty = false;
    var g = this.mini.getContext('2d'), mw = this.mini.width;
    g.clearRect(0, 0, mw, 20);
    for (var my = 0; my < 20; my++) for (var mx = 0; mx < mw; mx++) {
      var any = 0;
      for (var yy = 0; yy < 8 && !any; yy += 2) for (var xx = 0; xx < 16; xx += 3) if (this.T[(my * 8 + yy) * this.W + Math.min(this.W - 1, mx * 16 + xx)]) { any = 1; break; }
      if (any) { g.fillStyle = (my > 0 && !this.T[Math.max(0, (my * 8 - 2)) * this.W + mx * 16 + 8]) ? '#58e058' : '#139013'; g.fillRect(mx, my, 1, 1); }
    }
  },

  /* ---------- drawing ---------- */
  draw: function (ctx, mouse) {
    var sx = Math.round(this.scrollX), t = this.t, ST = LM.ST, i, L;
    ctx.fillStyle = LM.BG; ctx.fillRect(0, 0, LM.W, 160);
    ctx.drawImage(this.tcv, sx, 0, LM.W, 160, 0, 0, LM.W, 160);
    /* exit */
    ctx.drawImage(LM.OBJ.exit[this.style][(t >> 2) & 3], this.exit.x - 16 - sx, this.exit.y - 25);
    /* entrance */
    ctx.drawImage(LM.OBJ.entrance[this.entFrame], this.ent.x - 20 - sx, this.ent.y);
    /* fire traps */
    for (i = 0; i < this.traps.length; i++) ctx.drawImage(LM.OBJ.fire[(t >> 1) & 3], this.traps[i].x - sx, this.traps[i].y);
    /* lemmings */
    for (i = 0; i < this.lems.length; i++) {
      L = this.lems[i]; var x = L.x - sx;
      if (x < -20 || x > LM.W + 20) continue;
      var nm, fr;
      switch (L.st) {
        case ST.WALK: nm = 'walk'; fr = L.f; break; case ST.FALL: nm = 'fall'; fr = L.f >> 1; break;
        case ST.FLOAT: nm = 'float'; fr = L.f < 4 ? L.f : 4 + ((L.f >> 1) & 3); break;
        case ST.CLIMB: nm = 'climb'; fr = L.f; break; case ST.HOIST: nm = 'hoist'; fr = L.f; break;
        case ST.DIG: nm = 'dig'; fr = L.f; break; case ST.BUILD: nm = 'build'; fr = L.f; break;
        case ST.SHRUG: nm = 'shrug'; fr = L.f; break; case ST.BASH: nm = 'bash'; fr = L.f & 7; break;
        case ST.MINE: nm = 'mine'; fr = L.f & 7; break; case ST.BLOCK: nm = 'block'; fr = L.f; break;
        case ST.OHNO: nm = 'ohno'; fr = L.f; break; case ST.SPLAT: nm = 'splat'; fr = L.f; break;
        case ST.EXIT: nm = 'exit'; fr = L.f >> 1; break; case ST.DROWN: nm = 'drown'; fr = L.f; break;
        case ST.BURN: nm = 'burn'; fr = L.f; break; default: continue;
      }
      LM.blitSpr(ctx, nm, fr, L.dir, x, L.y);
      if (L.bomb > 0 && L.st < ST.OHNO) {
        var n = String(Math.ceil(L.bomb / LM.TPS));
        LM.drawDigits(ctx, n, x - 1, L.y - 19, '#000', 1); LM.drawDigits(ctx, n, x - 2, L.y - 20, '#fff', 1);
      }
    }
    /* water on top so drowning lemmings sink behind it */
    for (i = 0; i < this.waters.length; i++) this.drawWater(ctx, this.waters[i], sx);
    /* particles */
    for (i = 0; i < this.parts.length; i++) {
      var p = this.parts[i]; ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x - sx), Math.round(p.y), 1, 1);
    }
    this.drawPanel(ctx, mouse);
  },

  drawWater: function (ctx, w, sx) {
    var x0 = Math.max(w.x, sx), x1 = Math.min(w.x + w.w, sx + LM.W), t = this.t;
    if (x1 <= x0) return;
    ctx.fillStyle = '#1830c0'; ctx.fillRect(x0 - sx, w.y + 2, x1 - x0, w.h - 2);
    ctx.fillStyle = '#2c58e8'; ctx.fillRect(x0 - sx, w.y + 4, x1 - x0, 2);
    for (var x = x0; x < x1; x++) {
      var wob = (((x + (t >> 1)) >> 1) & 1);
      ctx.fillStyle = '#a8c8ff'; ctx.fillRect(x - sx, w.y + wob, 1, 2);
      ctx.fillStyle = '#5c88f8'; ctx.fillRect(x - sx, w.y + 2 + wob, 1, 1);
    }
  },

  drawPanel: function (ctx, mouse) {
    var ST = LM.ST, hud = LM.fonts.hud, i, x;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 160, LM.W, 40);
    /* info row */
    var hov = mouse && mouse.inView ? this.pick(mouse.x + Math.round(this.scrollX), mouse.y) : null;
    var txt = '';
    if (hov) txt = this.nameOf(hov) + ' ' + this.countName(this.nameOf(hov));
    LM.drawText(ctx, hud, txt, 0, 161);
    LM.drawText(ctx, hud, 'OUT ' + this.outCount(), 112, 161);
    LM.drawText(ctx, hud, 'IN ' + (this.pct() < 10 ? '0' : '') + this.pct() + '%', 184, 161);
    var secs = Math.ceil(this.timeLeft / LM.TPS), mm = Math.floor(secs / 60), ss = secs % 60;
    LM.drawText(ctx, hud, 'TIME ' + mm + '-' + (ss < 10 ? '0' : '') + ss, 248, 161);
    /* buttons */
    var names = ['rrminus', 'rrplus'].concat(LM.SKILLS).concat(['pause', 'nuke']);
    for (i = 0; i < 12; i++) {
      x = i * 16;
      ctx.fillStyle = '#7a3c30'; ctx.fillRect(x, 176, 16, 24);
      ctx.fillStyle = '#c88068'; ctx.fillRect(x, 176, 16, 1); ctx.fillRect(x, 176, 1, 24);
      ctx.fillStyle = '#3a1810'; ctx.fillRect(x, 199, 16, 1); ctx.fillRect(x + 15, 176, 1, 24);
      if (i < 10) {
        ctx.fillStyle = '#d4d4de'; ctx.fillRect(x + 1, 177, 14, 7);
        var val = i === 0 ? this.minRate : i === 1 ? this.rate : this.skills[LM.SKILLS[i - 2]];
        var s = (i >= 2 && val === 0) ? '' : String(val);
        if (s.length === 1) s = ' ' + s;
        if (s) LM.drawDigits(ctx, s, x + 2, 178, '#101018', 2);
        ctx.drawImage(LM.ICON[names[i]], x, 184);
      } else {
        ctx.drawImage(LM.ICON[names[i]], x, 180);
      }
    }
    /* selected skill / pressed buttons */
    var si = LM.SKILLS.indexOf(this.sel);
    ctx.strokeStyle = '#f8e820'; ctx.lineWidth = 1; ctx.strokeRect((si + 2) * 16 + 0.5, 176.5, 15, 23);
    if (this.paused) ctx.strokeRect(10 * 16 + 0.5, 176.5, 15, 23);
    if (this.nuked || this.nukeArm > 0) { ctx.strokeStyle = this.nuked ? '#f8e820' : '#ffffff'; ctx.strokeRect(11 * 16 + 0.5, 176.5, 15, 23); }
    /* minimap */
    ctx.fillStyle = '#c0383c';
    ctx.beginPath(); ctx.moveTo(193, 188); ctx.lineTo(201, 181); ctx.lineTo(201, 195); ctx.fill();
    ctx.beginPath(); ctx.moveTo(318, 188); ctx.lineTo(310, 181); ctx.lineTo(310, 195); ctx.fill();
    ctx.fillStyle = '#7a3c30'; ctx.fillRect(204, 176, 104, 24);
    ctx.fillStyle = '#050508'; ctx.fillRect(205, 177, 102, 22);
    var mw = this.mini.width, ox = 206 + Math.floor((100 - mw) / 2);
    ctx.drawImage(this.mini, ox, 178);
    ctx.fillStyle = '#f0f8f0';
    for (i = 0; i < this.lems.length; i++) {
      var Lm = this.lems[i]; if (Lm.st >= ST.SPLAT) continue;
      ctx.fillRect(ox + Math.floor(Lm.x / 16), 178 + Math.min(19, Math.floor(Lm.y / 8)), 1, 1);
    }
    ctx.strokeStyle = '#a8f8a8'; ctx.strokeRect(ox + Math.floor(this.scrollX / 16) + 0.5, 178.5, 19, 19);
  },

  /* scaled-down picture of the whole level (intro screen) */
  preview: function (pw, ph) {
    var c = LM.mk(pw, ph), g = c.getContext('2d');
    g.imageSmoothingEnabled = false; g.fillStyle = LM.BG; g.fillRect(0, 0, pw, ph);
    g.drawImage(this.tcv, 0, 0, this.W, this.H, 0, 0, pw, ph);
    return c;
  }
};
