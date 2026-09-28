# Shared audio toggle fix

The main playback defect predates Moon racing and is in the shared `audio.js`
module used by both soccer and Moon. Each volume fade previously kept its own
animation loop. A quick off/on could leave the old fade-out running until it
paused a track that had already been switched back on. Late play/load callbacks
could also restore volume or retry playback after mute, and `ensureAudio()` could
restart a muted player.

The live reproduction showed music enabled in storage and “Sound on” on screen,
but the native media player paused at volume 0.38 after toggling off/on 40 ms apart.
Moon also had a separate UI defect: its single Sound button reported only the
effects preference while changing both preferences. With music on and effects
off, the label incorrectly said Sound off.

## Changes

- One cancellable fade per music player. A new play request cancels an older
  fade-out immediately, before the playback promise settles.
- Playback/retry callbacks must match the current track, mute choice and request.
  Muting silences both sides of an in-progress crossfade. Audio unlock respects mute.
- A healthy music stream keeps playing when the fallback fetch finishes, instead
  of unnecessarily restarting from a new blob URL.
- Effects share a master gain, so mute also silences voices already playing.
- Moon's pause menu has independent Music and Sound effects buttons, each with its
  own saved state and accessible pressed state. Soccer retains its existing controls.

## Validation

`node --test tests/audio.test.mjs` covers eight regression cases, including races
between fades and promises, delayed loading, track transitions, muted unlock,
rapid stop/restart, and active effects. All eight failed against the old code and
pass with the fix.

`node tests/audio-browser.mjs` runs soccer, Moon desktop, phone, landscape and a
deliberately delayed music response. It checks actual native media playback and
advancing playback time; samples a sustained effect through a Web Audio analyser
before and after mute; checks independent preferences, pause/resume, reload and
the next Moon heat. Only local tests accelerate the heat through an intercepted
module response. No test controls are added to production code. Public runs omit
that acceleration and the artificial network delay.

Evidence is saved under `output/playwright/moon-audio`. The initial live
reproduction is `reproduction.json`; fixed browser checks are `results.json`.
