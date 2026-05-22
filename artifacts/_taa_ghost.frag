// ENGINE: Temporal Anti-Aliasing ghosting — the accumulation buffer refusing to let go
// SCENE: Moving objects. TAA blends current frame with history buffer.
//        Fast motion exceeds the reprojection tolerance — ghost trails appear.
// OBSERVER: Static camera, objects in motion
// ARTIFACT: Ghost images persist 2-4 frames behind fast objects;
//            the history weight is visible as colour-shifted echoes;
//            disocclusion zones (newly revealed background) flash with history error

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

#define TAA_BLEND 0.1       // weight of current frame (1-0.1 = 0.9 history)
#define HISTORY_FRAMES 8    // how many ghost echoes to accumulate

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// A moving disc — represents any fast-moving object
float disc(vec2 p, vec2 center, float r) {
    return length(p - center) - r;
}

// Object position at time t (fast circular orbit)
vec2 obj_pos(float t, float orbit_r, float speed, float phase) {
    return vec2(cos(t * speed + phase), sin(t * speed + phase)) * orbit_r;
}

// Render a single frame's object contribution
vec3 render_frame(vec2 st, float t) {
    vec3 col = vec3(0.0);

    // Object 1: fast orbit
    vec2 p1 = obj_pos(t, 0.22, 4.0, 0.0);
    float d1 = disc(st, p1, 0.045);
    col += vec3(0.9, 0.7, 0.2) * (1.0 - smoothstep(0.0, 0.01, d1));

    // Object 2: slower, elliptical
    vec2 p2 = vec2(cos(t * 1.8) * 0.35, sin(t * 2.5) * 0.15);
    float d2 = disc(st, p2, 0.03);
    col += vec3(0.3, 0.6, 1.0) * (1.0 - smoothstep(0.0, 0.01, d2));

    // Object 3: very fast, small
    vec2 p3 = obj_pos(t, 0.3, 7.0, 2.1);
    float d3 = disc(st, p3, 0.02);
    col += vec3(0.9, 0.2, 0.5) * (1.0 - smoothstep(0.0, 0.008, d3));

    return col;
}

// Background: static checkerboard that shows disocclusion artifacts
vec3 background(vec2 p) {
    vec2 tile = floor(p * 10.0);
    float checker = mod(tile.x + tile.y, 2.0);
    return mix(vec3(0.08, 0.08, 0.09), vec3(0.12, 0.12, 0.13), checker);
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;
    st -= vec2(0.5 * u_resolution.x / u_resolution.y, 0.5);

    vec3 bg = background(st);

    // Current frame
    vec3 current = render_frame(st, u_time);

    // TAA accumulation: blend history frames with exponential decay
    // Simulates a real TAA implementation that blends 0.1 current + 0.9 history
    vec3 accumulated = current * TAA_BLEND;
    float weight = 1.0 - TAA_BLEND;
    float dt = 1.0 / 60.0; // simulated 60fps frame dt

    for (int i = 1; i <= HISTORY_FRAMES; i++) {
        float fi = float(i);
        float t_hist = u_time - dt * fi;
        vec3 hist_frame = render_frame(st, t_hist);
        accumulated += hist_frame * weight * TAA_BLEND;
        weight *= (1.0 - TAA_BLEND);
    }

    // Full TAA result over background
    vec3 has_object = step(vec3(0.01), accumulated);
    float obj_mask = max(has_object.r, max(has_object.g, has_object.b));
    vec3 col = mix(bg, accumulated, obj_mask);

    // Disocclusion flash: zones where background is newly revealed (history is wrong)
    // Approximate: areas where current frame is empty but previous frame had object
    vec3 prev = render_frame(st, u_time - dt * 2.0);
    float prev_mask = max(step(0.01, prev.r), max(step(0.01, prev.g), step(0.01, prev.b)));
    float cur_mask  = max(step(0.01, current.r), max(step(0.01, current.g), step(0.01, current.b)));
    float disocclusion = prev_mask * (1.0 - cur_mask);
    col += vec3(0.8, 0.1, 0.5) * disocclusion * 0.4; // magenta flash on disocclusion

    // Ghost trail visibility enhancement: show accumulated differently from current
    float ghost = max(0.0, obj_mask - cur_mask);
    col = mix(col, accumulated * 1.5, ghost * 0.6);

    // Subtle velocity overlay: colour-shifted echo shows direction of movement
    vec3 shifted = render_frame(st + vec2(0.01, 0.0), u_time - dt * 3.0);
    float shift_mask = max(shifted.r, max(shifted.g, shifted.b));
    col += vec3(0.0, 0.3, 0.7) * shift_mask * 0.15;

    gl_FragColor = vec4(col, 1.0);
}
