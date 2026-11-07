'use strict';
/* ============================================================
   LEVELS  (original layouts built in the spirit of the classics;
   the first five carry the original Fun-level names)
   Coordinates: x across the level, y 0..159 down.  A lemming's
   foot-row is (surface - 1), so exit y = floorSurface - 1.
   ============================================================ */
var LM = window.LM = window.LM || {};

function ceiling(P, W, skipX) {
  P.rect(0, 0, W, 9);
  for (var x = 44; x < W - 24; x += 57) {
    if (skipX !== undefined && Math.abs(x - skipX) < 34) continue;
    P.ell(x, 9, 7 + ((x * 7) % 9), 5 + ((x * 3) % 9));
  }
}
function walls(P, W, top) { P.rect(0, top, 20, 160 - top); P.rect(W - 20, top, 20, 160 - top); }
function pit(P, x, y, w, depth) {          /* water-filled pit in the floor */
  P.cut(x, y, w, depth);
  P.rect(x, 152, w, 8);
  P.water(x, 142, w, 18);
}

LM.LEVELS = [
  /* ---------------------------------------------------- FUN 1 */
  { title: 'Just dig!', rating: 'Fun', style: 'dirt', width: 640, num: 10, save: 10, rate: 50, time: 5,
    skills: { digger: 10 }, entrance: [100, 16], exit: [430, 140],
    build: function (P) {
      ceiling(P, 640, 100);
      P.ground([[20, 84], [120, 83], [200, 86], [300, 84], [400, 86], [540, 84]], 108);
      P.rect(0, 0, 24, 160); P.rect(540, 0, 100, 160);
      P.ground([[24, 142], [200, 141], [330, 143], [430, 141], [540, 141]], 160);
      P.ell(160, 109, 12, 9); P.ell(290, 109, 9, 7); P.ell(500, 109, 14, 9); P.ell(80, 109, 10, 8);
    } },
  /* ---------------------------------------------------- FUN 2 */
  { title: 'Only floaters can survive this', rating: 'Fun', style: 'dirt', width: 800, num: 20, save: 40, rate: 50, time: 5,
    skills: { floater: 10 }, entrance: [80, 18], exit: [650, 147],
    build: function (P) {
      ceiling(P, 800, 80);
      P.rect(0, 0, 20, 160);
      P.ground([[20, 60], [250, 60]], 160);
      P.ground([[250, 148], [800, 148]], 160);
      P.rect(780, 0, 20, 160);
      P.ell(400, 98, 30, 7); P.ell(520, 112, 22, 6); P.ell(600, 84, 16, 5);
    } },
  /* ---------------------------------------------------- FUN 3 */
  { title: 'Tailor-made for blockers', rating: 'Fun', style: 'marble', width: 800, num: 20, save: 80, rate: 50, time: 5,
    skills: { blocker: 2 }, entrance: [110, 22], exit: [50, 91],
    build: function (P) {
      ceiling(P, 800, 110);
      P.rect(0, 0, 20, 160);
      P.ground([[20, 92], [440, 92]], 160);
      P.rect(440, 150, 200, 10); P.water(440, 140, 200, 20);
      P.ground([[640, 92], [800, 92]], 160);
      P.rect(780, 0, 20, 160);
    } },
  /* ---------------------------------------------------- FUN 4 */
  { title: 'Now use miners and climbers', rating: 'Fun', style: 'dirt', width: 860, num: 20, save: 50, rate: 50, time: 5,
    skills: { climber: 10, miner: 5 }, entrance: [80, 26], exit: [730, 149],
    build: function (P) {
      ceiling(P, 860, 80);
      P.rect(0, 0, 20, 160);
      P.ground([[20, 100], [860, 100]], 160);
      P.cut(470, 128, 330, 22);
      P.rect(250, 45, 28, 55);
      P.rect(840, 0, 20, 160);
      P.rect(20, 78, 12, 8); P.rect(828, 78, 12, 8);     /* overhangs: stop climbers scaling the boundary walls */
      P.ell(620, 128, 18, 7); P.ell(700, 128, 12, 5);
    } },
  /* ---------------------------------------------------- FUN 5 */
  { title: 'You need bashers this time', rating: 'Fun', style: 'dirt', width: 900, num: 20, save: 60, rate: 50, time: 5,
    skills: { basher: 5 }, entrance: [80, 26], exit: [760, 99],
    build: function (P) {
      ceiling(P, 900, 80);
      P.rect(0, 0, 20, 160);
      P.ground([[20, 100], [880, 100]], 160);
      P.rect(280, 40, 60, 60);
      P.rect(520, 60, 26, 40);
      P.rect(880, 0, 20, 160);
      P.ell(310, 40, 28, 6);
    } },
  /* ---------------------------------------------------- TRICKY 1 */
  { title: 'Mind the gap', rating: 'Tricky', style: 'brick', width: 900, num: 20, save: 60, rate: 45, time: 5,
    skills: { builder: 3, blocker: 2, bomber: 2 }, entrance: [80, 26], exit: [800, 99],
    build: function (P) {
      ceiling(P, 900, 80);
      P.rect(0, 0, 20, 160);
      P.ground([[20, 100], [880, 100]], 160);
      pit(P, 300, 100, 20, 52);
      pit(P, 520, 100, 22, 52);
      P.rect(880, 0, 20, 160);
    } },
  /* ---------------------------------------------------- TRICKY 2 */
  { title: 'Steel yourself', rating: 'Tricky', style: 'crystal', width: 900, num: 20, save: 50, rate: 45, time: 6,
    skills: { basher: 3, builder: 2 }, entrance: [80, 26], exit: [800, 99],
    build: function (P) {
      ceiling(P, 900, 80);
      P.rect(0, 0, 20, 160);
      P.ground([[20, 100], [880, 100]], 160);
      P.steel(300, 40, 60, 35);
      P.rect(300, 75, 60, 25);
      P.oneway(300, 75, 60, 25, 1);
      pit(P, 560, 100, 20, 52);
      P.rect(880, 0, 20, 160);
    } },
  /* ---------------------------------------------------- TRICKY 3 */
  { title: 'A fiery welcome', rating: 'Tricky', style: 'marble', width: 900, num: 20, save: 50, rate: 45, time: 6,
    skills: { builder: 5, blocker: 2, bomber: 2 }, entrance: [80, 26], exit: [800, 99],
    build: function (P) {
      ceiling(P, 900, 80);
      P.rect(0, 0, 20, 160);
      P.ground([[20, 100], [880, 100]], 160);
      P.fire(330, 84);
      P.rect(880, 0, 20, 160);
    } }
];

/* rating groups for the title-screen sign */
LM.RATINGS = ['Fun', 'Tricky'];
LM.levelsOf = function (rating) {
  var a = []; for (var i = 0; i < LM.LEVELS.length; i++) if (LM.LEVELS[i].rating === rating) a.push(i); return a;
};

/* ---- access codes ---- */
LM.levelCode = function (i) {
  var h = ((i + 1) * 2654435761) >>> 0, s = '';
  for (var k = 0; k < 10; k++) { h = (Math.imul(h ^ (h >>> 15), 2246822519) + k * 374761393) >>> 0; s += String.fromCharCode(65 + h % 26); }
  return s;
};
LM.codeToLevel = function (code) {
  code = (code || '').toUpperCase().replace(/[^A-Z]/g, '');
  for (var i = 0; i < LM.LEVELS.length; i++) if (LM.levelCode(i) === code) return i;
  return -1;
};
