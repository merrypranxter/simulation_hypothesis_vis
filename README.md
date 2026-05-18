# simulation_hypothesis_vis

A creative coding project visualizing the simulation hypothesis — the art of rendering reality's backend visible.

## What This Is

Not "cyberpunk" or "glitch aesthetic." This project treats Nick Bostrom's simulation hypothesis as **art direction**: what does a reality engine look like when it's under pressure, when the observer turns, when the LOD transitions are exposed?

The artifacts of real-time rendering — culling, z-fighting, texture streaming, temporal aliasing — become the subject matter.

## Project Structure

```
index.html           # WebGL runner — open this in a browser (requires HTTP server)
shaders/             # GLSL fragment shaders — each renders a specific engine state
  _vertex.vert         # Shared full-screen-quad vertex shader
  _memory_pressure.frag
  _observer_effect.frag
  _physics_misalign.frag
  _portal_occlusion.frag
  _void_state.frag
scenes/              # Scene configuration manifests (JSON)
  city.json
  nature.json
  interior.json
  void.json
artifacts/           # Post-processing artifact shaders
  _lod_pop.frag        # LOD transition seam
  _pop_in.frag         # Entity budget-boundary spawn
  _z_fight.frag        # Depth-buffer precision failure
  _taa_ghost.frag      # Temporal Anti-Aliasing accumulation bleed
diagnostics/         # Debug-overlay shaders
  _debug_overlay.frag  # Wireframe + normals + UV seams + vertex colour
```

## Running

Shaders are loaded at runtime via `fetch()`, so you need a local HTTP server:

```bash
# Python 3
python -m http.server 8080

# Node (npx)
npx serve .
```

Then open `http://localhost:8080` in any WebGL-capable browser.

The UI sidebar lets you switch between all shaders. Keyboard shortcuts: `1`–`9` select scenes in order. Move the mouse in `_observer_effect` to steer the observer's gaze.

## Scenes

| File | Artifact | Description |
|------|----------|-------------|
| `_memory_pressure` | LOD · texture streaming · pop-in | Dense city, orbiting camera, VRAM pressure |
| `_observer_effect` | Frustum culling · foveated rendering | Forest that only exists when observed |
| `_physics_misalign` | Timestep stutter · tunneling · TAA | Rigid-body stack with render/physics desync |
| `_portal_occlusion` | Portal rendering · draw-call budget | Corridor; rooms stop existing outside portal view |
| `_void_state` | BVH · spatial partition · pre-load | The simulation before any assets stream in |

## Artifacts

| File | Artifact |
|------|----------|
| `_lod_pop` | Hard geometry snap at LOD thresholds; seam boundary flash |
| `_pop_in` | Entities instantiating at the streaming-budget boundary |
| `_z_fight` | Depth-buffer aliasing between coplanar surfaces |
| `_taa_ghost` | TAA accumulation bleed; disocclusion flash |

## Uniform Convention

All shaders use the standard Shadertoy-compatible uniform set:

```glsl
uniform vec2  u_resolution;   // viewport size in pixels
uniform float u_time;         // elapsed seconds
uniform vec2  u_mouse;        // mouse position in pixels (origin bottom-left)
```

## References

- Bostrom, N. (2003). "Are You Living in a Computer Simulation?" *Philosophical Quarterly*, 53(211), 243–255.
- Akenine-Möller, T. et al. *Real-Time Rendering* (4th ed.), A K Peters/CRC Press.
- Jimenez, J. (2016). "Filmic SMAA + Temporal Super-Sampling." *SIGGRAPH 2016 Advances in Real-Time Rendering*.

---

*The world looks real because the engine is good. The engine is the art.*
