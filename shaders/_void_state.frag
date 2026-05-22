// ENGINE: Spatial partitioning structures — before any assets load
// SCENE: The simulation pre-boot. Empty BVH/octree nodes, uninstantiated 
//        bounding volumes, axis-aligned partitions with nothing inside them.
// OBSERVER: Drifting through the lattice
// ARTIFACT: The world-space grid reveals itself; address-space pulses 
//           propagate from origin; ghost AABB outlines mark where 
//           entities will eventually stream in

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

#define GRID_SCALE 8.0
#define PULSE_SPEED 0.4
#define PI 3.14159265

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash1(float n) {
    return fract(sin(n) * 43758.5453);
}

// Axis-aligned grid lines
float grid(vec2 p, float scale, float thickness) {
    vec2 g = abs(fract(p * scale) - 0.5) * 2.0;
    float edge = max(g.x, g.y);
    return smoothstep(1.0 - thickness, 1.0, edge);
}

// Bounding-box outline (AABB ghost) for an uninstantiated entity slot
float aabb(vec2 p, vec2 center, vec2 half_ext) {
    vec2 local = abs(p - center) - half_ext;
    // Outline only: negative interior
    float inner = max(local.x, local.y);
    float outer_x = abs(p.x - center.x) - half_ext.x - 0.004;
    float outer_y = abs(p.y - center.y) - half_ext.y - 0.004;
    float outline = max(-inner, -max(outer_x, outer_y));
    return clamp(outline, 0.0, 1.0);
}

// Propagating ring — address-space scan from origin
float scan_ring(vec2 p, float t, float speed, float width) {
    float r = length(p);
    float wave_r = mod(t * speed, 2.5);
    return 1.0 - smoothstep(0.0, width, abs(r - wave_r));
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;
    st -= vec2(0.5 * u_resolution.x / u_resolution.y, 0.5);

    // Slow drift through the void
    float drift_x = sin(u_time * PULSE_SPEED * 0.3) * 0.2;
    float drift_y = cos(u_time * PULSE_SPEED * 0.2) * 0.15;
    vec2 world = st - vec2(drift_x, drift_y);

    // Base: deep black — the unrendered void
    vec3 col = vec3(0.0, 0.0, 0.005);

    // ----- Octree subdivision grid (3 levels) -----
    // Level 0: coarse world partitions (cyan, very faint)
    float g0 = grid(world, 1.0, 0.04);
    col += vec3(0.0, 0.25, 0.3) * g0 * 0.15;

    // Level 1: cell subdivisions (green, faint)
    float g1 = grid(world, 4.0, 0.03);
    col += vec3(0.0, 0.4, 0.1) * g1 * 0.08;

    // Level 2: leaf-node resolution (bright, very thin)
    float g2 = grid(world, GRID_SCALE, 0.015);
    col += vec3(0.0, 0.7, 0.3) * g2 * 0.12;

    // ----- Origin axis -----
    float axis_x = 1.0 - smoothstep(0.0, 0.003, abs(world.y));
    float axis_y = 1.0 - smoothstep(0.0, 0.003, abs(world.x));
    col += vec3(0.1, 0.6, 0.9) * axis_x * 0.35;
    col += vec3(0.9, 0.2, 0.1) * axis_y * 0.35;

    // ----- Address-space scan rings from origin -----
    float ring1 = scan_ring(world, u_time, PULSE_SPEED,        0.025);
    float ring2 = scan_ring(world, u_time, PULSE_SPEED * 0.6,  0.018);
    float ring3 = scan_ring(world, u_time, PULSE_SPEED * 1.5,  0.01);
    col += vec3(0.0, 0.5, 1.0) * ring1 * 0.4;
    col += vec3(0.3, 0.0, 0.8) * ring2 * 0.25;
    col += vec3(0.0, 1.0, 0.5) * ring3 * 0.2;

    // ----- Uninstantiated AABB ghost slots -----
    // Seeded grid of entity slots — bounding boxes with nothing loaded
    vec2 cell    = floor(world * 3.0);
    vec2 local   = fract(world * 3.0) - 0.5;
    float seed   = hash(cell);

    // Only some slots are allocated (sparse allocation)
    float allocated = step(0.4, seed);
    if (allocated > 0.5) {
        // Each slot has a random-ish AABB size
        float w = 0.1 + seed * 0.12;
        float h = 0.08 + hash(cell + 0.5) * 0.1;

        // Pulse: the slot activates periodically (streaming schedule)
        float phase    = hash(cell + 1.0) * 10.0;
        float pulse    = sin(u_time * 1.5 + phase) * 0.5 + 0.5;
        float activate = smoothstep(0.6, 0.85, pulse);

        float box = aabb(local, vec2(0.0), vec2(w, h));

        // Color: dim magenta when dormant, bright white-blue when activating
        vec3 dormant  = vec3(0.4, 0.0, 0.6) * 0.3;
        vec3 active   = vec3(0.6, 0.9, 1.0);
        col += mix(dormant, active, activate) * box * 0.9;

        // Type label placeholder: tiny square at top-left of box (simulates entity type tag)
        float tag = aabb(local, vec2(-w + 0.02, h - 0.02), vec2(0.015));
        col += vec3(0.5, 1.0, 0.4) * tag * activate;
    }

    // ----- Depth fog: clarity falls off from origin -----
    float radial_fog = smoothstep(0.3, 1.2, length(world));
    col = mix(col, vec3(0.0), radial_fog * 0.7);

    // ----- Vignette -----
    float vignette = 1.0 - smoothstep(0.5, 1.5, length(st));
    col *= vignette;

    gl_FragColor = vec4(col, 1.0);
}
