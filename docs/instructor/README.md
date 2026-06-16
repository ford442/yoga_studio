# Instructor Guide Layer — Phase-Synced Video

The instructor video is a **living mirror of the breath**, not an ambient loop.
A silhouette raises on the inhale, holds overhead, lowers on the exhale, and
rests still — locked to the same `currentPhase` / `phaseProgress` that drive the
shader figure and the central countdown.

## Clip manifest

`app/data/instructorVideos.ts` defines **styles → phase → clip**:

```
InstructorStyle { id, label, clips: { inhale, hold1, exhale, hold2 } }
InstructorPhaseClip { src (mp4), webm, duration, label }
```

- Each clip is a **full-phase performance**: movement runs cleanly from progress
  0 (first frame) to 1 (last frame).
- `duration` is the intrinsic authored length; the engine stretches/compresses it
  to the live phase.
- The default `serene` style is shared by every mode. `STYLE_BY_POSE` maps a
  shader `figurePose` to a bespoke style for advanced modes — no engine change
  needed to add one.

Current placeholder clips (`public/instructor/`):

| file | phase | duration |
|------|-------|----------|
| `inhale-raise-01.{mp4,webm}` | inhale | 4.0s |
| `hold1-arms-high-01.{mp4,webm}` | hold1 | 3.0s |
| `exhale-lower-01.{mp4,webm}` | exhale | 4.0s |
| `hold2-still-01.{mp4,webm}` | hold2 | 3.0s |

## Sync engine (`app/components/InstructorVideoGuide.tsx`)

- **Two stacked `<video>` layers.** On phase change the new clip mounts on the
  front layer and fades up (`instructor-fade-in`, 320ms) over the outgoing clip
  for a seamless hand-off; webm is preferred, mp4 is the fallback `<source>`.
- **Lockstep via a velocity control loop** (rAF):
  `target = (phaseProgress + lead) × clipDuration`, then
  `playbackRate = clamp(clipDuration/phaseDuration + GAIN·drift, 0.1, 3.0)`.
  The clip always moves forward and converges on the countdown — no backward
  re-seek stutter. A hard seek only recovers from a real stall (tab backgrounded
  / buffering, drift > 0.5s).
  - A **10s inhale over a 4s clip** plays at ~0.4–0.7× (arms rise slowly to fill
    the phase) and lands on the last frame exactly at 0; simulated max drift
    ≈ 0.07s.
- **Anticipation:** the target leads the numeric countdown by
  `ANTICIPATION_LEAD_SEC` (0.2s) so movement feels human rather than reactive.
- **Free-form / paused:** when no phase is advancing the front clip falls back to
  a gentle natural-rate loop. (Free-form *practice* still runs the breath timer,
  so it stays fully phase-synced.)
- **Intensity** gently brightens the figure (`brightness 0.9–1.08`) so the body
  feels alive with the breath.
- Audio stays muted unless `audioEnabled` and not overridden by voice guidance.

## Regenerating the placeholder clips

```bash
python3 assets/instructor/generate.py
```

Renders silhouette frames (Pillow) over a phase-tinted glow and encodes mp4
(h264) + webm (vp9) with ffmpeg. Requires `numpy`, `Pillow`, `ffmpeg`.

## Producing real instructor footage

Author clips as **full-phase performances** matching the phase semantics above
and keep the `inhale/hold1/exhale/hold2` naming so the manifest keeps working.
Filming guidance:

- Frame portrait (≈3:4), centered figure, calm even lighting, plain dark
  backdrop so it blends in the PiP / underlay.
- One clean continuous movement per clip, starting and ending on the rest pose
  so loops and cross-fades are seamless.
- Inhale: arms rise from sides to overhead. Hold1: held overhead, near-still.
  Exhale: arms lower to sides. Hold2: seated stillness with a soft breath bob.
- Export mp4 (h264, yuv420p, faststart) + webm (vp9); keep clips short and light.
- Update each clip's `duration` in `instructorVideos.ts` to the authored length.
