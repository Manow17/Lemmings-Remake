# Lemmings (fan recreation)

A browser recreation of the classic 1991 Lemmings, styled after Amiga screenshots:
320x200 lo-res screen, the green HUD font, the icon panel with minimap, tilesets,
title signposts, level-intro and results screens.

**To play:** Open the link in the about section.

Every sprite, texture and sound is generated in code. Nothing is ripped from the
original game, and the level layouts are original (the first five use the original
Fun-level names). This is an unofficial fan project.

## Controls

| Input | Action |
|---|---|
| Click a panel icon, or keys `1`-`8` | Select skill: climber, floater, bomber, blocker, builder, basher, miner, digger |
| Click a lemming | Give it the selected skill |
| `-` / `+` icons, or `-` `+` keys | Release rate (can't go below the level's starting rate) |
| Paw icon, `Space` or `P` | Pause |
| Mushroom-cloud icon, or `N` | Nuke: press twice to confirm |
| Screen edge, right-drag, arrow keys, minimap | Scroll the level (hold Shift for fast arrow-key scroll) |
| `F` | Fast-forward |
| `M` | Music on/off |
| `Esc` | Quit level (asks to confirm) |

Title screen: **1 PLAYER** starts the selected rating, **HOW TO PLAY**, **NEW LEVEL**
takes a 10-letter access code (shown on the results screen after each level you win),
the note sign toggles music, and the right-hand sign switches rating (Fun / Tricky).

## Levels

1. Just dig!  2. Only floaters can survive this  3. Tailor-made for blockers
4. Now use miners and climbers  5. You need bashers this time  (Fun)
6. Mind the gap  7. Steel yourself  8. A fiery welcome  (Tricky)

Level 8 needs two chained builders to clear the fire trap; a blocker holds the crowd
back while you build and a bomber removes it afterwards.

## Source layout

- `js/gfx.js`    bitmap font, lemming sprites, icons, tile textures
- `js/audio.js`  WebAudio sound effects and chiptune music (public-domain tunes)
- `js/levels.js` level scripts and access codes
- `js/game.js`   terrain painter, lemming state machine, skills, HUD and minimap
- `js/ui.js`     title, intro, results, help and code screens; input; main loop
