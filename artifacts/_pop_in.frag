// ENGINE: Entity pop-in — the budget boundary where new objects are instanced
// SCENE: Empty field. As budget opens up, new objects snap into existence.
//        No fade, no transition — just absence, then presence.
// OBSERVER: Slowly orbiting
// ARTIFACT: Hard edge at spawn radius; bounding sphere flash on creation;
//           brief vertex-color diagnostic overlay on newly spawned mesh

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash1(float n) {
    return fract(sin(n) * 43758.5453);
}

// Circle SDF
float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

// Bounding-sphere ring that flashes when an entity is first spawned
float spawn_ring(vec2 p, float r, float age) {
    float ring = abs(length(p) - r);
    float fade = exp(-age * 8.0); // flash decays quickly
    return (1.0 - smoothstep(0.0, 0.015, ring)) * fade;
}

// Simple tree silhouette (same fractal as _observer_effect but fewer branches)
float entity_sdf(vec2 p, float seed) {
    p *= 2.5;
    float d = length(p - vec2(0.0, 0.4)) - 0.04; // trunk
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float a = seed * 6.28 + fi * 1.4;
        float l = 0.25 / (fi + 1.0);
        vec2 b = vec2(cos(a), sin(abs(a))) * l;
        d = min(d, length(p - b) - 0.025 / (fi + 1.0));
    }
    return d;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;
    st -= vec2(0.5 * u_resolution.x / u_resolution.y, 0.5);

    // Camera orbit
    float angle = u_time * 0.12;
    vec2 cam = vec2(cos(angle), sin(angle)) * 0.25;
    vec2 world = st + cam;

    vec3 col = vec3(0.03, 0.04, 0.035); // dim ground

    // Ground plane grid
    vec2 grid = abs(fract(world * 8.0) - 0.5) * 2.0;
    float ground_wire = 1.0 - smoothstep(0.0, 0.04, min(grid.x, grid.y));
    col += vec3(0.08, 0.1, 0.07) * ground_wire;

    // Spawn radius — moves outward over time (streaming budget expanding)
    float spawn_r = 0.3 + 0.25 * sin(u_time * 0.3);

    // Budget boundary circle
    float boundary = abs(length(world) - spawn_r);
    float boundary_line = 1.0 - smoothstep(0.0, 0.008, boundary);
    col += vec3(0.9, 0.3, 0.0) * boundary_line * 0.6; // orange ring = budget edge

    // Grid of entity slots
    vec2 cell  = floor(world * 4.0);
    vec2 local = fract(world * 4.0) - 0.5;
    float seed = hash(cell);

    // Entity only spawns if within spawn radius AND slot is occupied (sparse)
    float dist_from_origin = length((cell + 0.5) / 4.0);
    bool in_budget = dist_from_origin < spawn_r;
    bool slot_used = seed > 0.35;

    if (in_budget && slot_used) {
        // Age: how long since this entity was within the spawn radius
        // Approximate: time-based with slot-specific phase
        float spawn_time = hash(cell + 10.0) * 3.0; // pseudo spawn moment
        float age = max(0.0, mod(u_time * 0.4, 6.0) - spawn_time);

        // Bounding sphere flash on first appearance
        float bsphere_r = 0.18 + seed * 0.04;
        float ring = spawn_ring(local, bsphere_r, age);
        col += vec3(0.3, 0.9, 0.4) * ring;

        // Entity mesh (appears instantly — no fade, this is pop-in)
        float appear = step(0.05, age); // hard cut: 0 then 1
        if (appear > 0.5) {
            float ent = entity_sdf(local, seed);
            float mask = 1.0 - smoothstep(0.0, 0.01, ent);

            // Vertex color diagnostic: new entities show debug overlay briefly
            float diag_fade = 1.0 - smoothstep(0.0, 0.5, age);
            vec3 ent_col = mix(
                vec3(0.2, 0.55, 0.2),     // normal color
                vec3(seed, 1.0 - seed, 0.5), // debug vertex color
                diag_fade
            );
            col += ent_col * mask;
        } else {
            // Pre-spawn: bounding box placeholder outline
            float bb = abs(abs(local.x) - 0.15) + abs(abs(local.y) - 0.18);
            float bb_edge = 1.0 - smoothstep(0.0, 0.015, bb - 0.14);
            col += vec3(0.5, 0.5, 0.6) * bb_edge * 0.4;
        }
    }

    // Entities outside budget: invisible (that's the point)
    // But their bounding box ghost is faintly visible (engine knows they exist)
    if (!in_budget && slot_used) {
        float bb_edge = abs(abs(local.x) - 0.15);
        float bb_mask = 1.0 - smoothstep(0.0, 0.012, bb_edge - 0.14);
        col += vec3(0.2, 0.2, 0.35) * bb_mask * 0.15; // very faint
    }

    gl_FragColor = vec4(col, 1.0);
}
