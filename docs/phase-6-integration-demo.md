# Phase 6 — Integration, Testing & Demo Prep

**Owner:** both of you, together — this phase is deliberately not parallelizable. **Depends on:** everything.

## Scope

Wire all phases together end-to-end, stress-test the actual demo path, and prepare the viva presentation and report figures.

## Integration checklist

- [ ] Phase 1 features feed Phase 3 inference with the correct, frozen column order.
- [ ] Phase 3's smoothed `EmotionState` feeds Phase 4's `find_track` target selection.
- [ ] Phase 4 successfully plays a track on both providers from a live inferred state, not just hardcoded test values.
- [ ] Phase 5 dashboard reflects real state changes with no visible lag beyond the inference timer interval.
- [ ] Tray icon updates correctly across a full session of normal use.
- [ ] Self-report popup still works correctly after all other phases are wired in (regression-check it — easy to break by accident during integration).

## Testing beyond "it runs once"

- Run a full session (30+ minutes) of normal computer use and confirm no crashes, no memory growth, no hook drop-outs.
- Deliberately vary behavior (fast erratic mouse movement vs. still/idle vs. rapid clicking) and confirm the tray icon and dashboard visibly respond in the expected direction — this is your live proof that the pipeline actually works, independent of model accuracy numbers.
- Test both providers' failure paths: Spotify with no Premium/no open session, YouTube with a bad/expired token — confirm the app surfaces a clear message instead of silently doing nothing.

## Report/viva assets to prepare here

- Predicted-vs-actual scatter plots for arousal and valence (from Phase 2).
- Feature importance chart (from Phase 2).
- Architecture diagram (reuse/clean up the one in `PLAN.md`).
- A short honest limitations slide: per-user calibration only, valence is experimental, mouse-only signal has known ceiling in the literature. Presenting this proactively reads as rigor, not weakness.
- Live demo script (see `PLAN.md` §9) rehearsed at least twice beforehand — timing matters, don't let it run long or drag during the actual viva slot.

## Definition of done

- Full pipeline runs unattended for a real session and produces a sensible track choice at the end without manual intervention.
- All report figures generated from real data, not placeholders.
- Demo script rehearsed and timed.
