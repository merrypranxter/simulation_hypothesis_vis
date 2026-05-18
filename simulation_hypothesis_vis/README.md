# simulation_hypothesis_vis

A creative coding project visualizing the simulation hypothesis — the art of rendering reality's backend visible.

## What This Is

Not "cyberpunk" or "glitch aesthetic." This project treats Nick Bostrom's simulation hypothesis as **art direction**: what does a reality engine look like when it's under pressure, when the observer turns, when the LOD transitions are exposed?

The artifacts of real-time rendering — culling, z-fighting, texture streaming, temporal aliasing — become the subject matter.

## Project Structure

```
shaders/          # GLSL fragments — each renders a specific engine artifact
scenes/           # Scene configurations (city, nature, interior, void)
artifacts/        # Post-processing: LOD, pop-in, z-fight, TAA ghosts
diagnostics/      # Debug visualizations: wireframe, normals, UVs, gizmos
```

## Running

Shaders are self-contained GLSL fragment shaders. Run in any WebGL environment (Shadertoy, Three.js, custom setup).

## Current Scenes

- [ ] _memory_pressure — texture streaming, LOD drops, entity pop-in
- [ ] _observer_effect — foveated rendering, frustum culling, quantum unrender
- [ ] _physics_misalign — timestep stutter, tunneling, jitter artifacts

## References

- Bostrom, N. (2003). "Are You Living in a Computer Simulation?" *Philosophical Quarterly*, 53(211), 243-255.
- Hocking, N. & Wyman, C. (Unreal Engine). *Real-Time Rendering* (4th ed.), A K Peters/CRC Press.

---

*The world looks real because the engine is good. The engine is the art.*
