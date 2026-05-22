// ENGINE: LOD transition — the seam between detail budgets
// SCENE: Terrain viewed from a camera that slowly crosses the LOD boundary
// OBSERVER: Slow zoom, crosses LOD0 → LOD1 → LOD2 thresholds
// ARTIFACT: Hard geometry snap at each threshold; the "pop" visualized 
//           as a ripple in the surface normal field

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

#define LOD0_DIST 0.7
#define LOD1_DIST 0.4
#define LOD2_DIST 0.15

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Terrain at a given detail level (polygon count proxy via frequency)
float terrain_lod(vec2 p, int lod) {
    float h = 0.0;
    int taps = 1 + lod * 2; // LOD0=1, LOD1=3, LOD2=5
    float amp  = 0.4;
    float freq = 2.0;
    for (int i = 0; i < 5; i++) {
        if (i >= taps) break;
        h += sin(p.x * freq + 1.3) * cos(p.y * freq * 0.7 + 0.9) * amp;
        freq *= 2.1;
        amp  *= 0.5;
    }
    return h;
}

// Wireframe density scales with LOD
float wireframe(vec2 p, float scale) {
    vec2 g = fract(p * scale);
    float edge = min(min(g.x, g.y), min(1.0 - g.x, 1.0 - g.y));
    return 1.0 - smoothstep(0.0, 0.03, edge);
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;
    st -= vec2(0.5 * u_resolution.x / u_resolution.y, 0.5);

    // Camera slowly zooms in — dist decreases over time, crosses LOD boundaries
    float cam_dist = 0.5 + 0.45 * sin(u_time * 0.25);
    vec2 world = st * (cam_dist + 0.2);

    // Determine LOD for this fragment (distance from camera origin proxy = length(world))
    float frag_dist = length(world) * 0.5 + cam_dist * 0.5;

    int lod;
    if (frag_dist > LOD0_DIST)      lod = 0;
    else if (frag_dist > LOD1_DIST) lod = 1;
    else                             lod = 2;

    float h = terrain_lod(world, lod);

    // Shading
    vec3 lod0_col = vec3(0.25, 0.22, 0.2);
    vec3 lod1_col = vec3(0.45, 0.42, 0.38);
    vec3 lod2_col = vec3(0.6,  0.57, 0.5);
    vec3 base;
    if (lod == 0)      base = lod0_col;
    else if (lod == 1) base = lod1_col;
    else               base = lod2_col;

    base += h * 0.2;

    // Wireframe: coarser at LOD0, dense at LOD2
    float wf_scale = (lod == 0) ? 3.0 : (lod == 1) ? 6.0 : 14.0;
    float wf = wireframe(world, wf_scale);
    vec3 wire_col = (lod == 0) ? vec3(0.3, 0.5, 0.8) : 
                    (lod == 1) ? vec3(0.2, 0.8, 0.4) :
                                 vec3(0.9, 0.85, 0.3);
    vec3 col = mix(base, wire_col, wf * 0.55);

    // LOD boundary seam — the pop made visible as a bright edge
    float seam01 = (1.0 - smoothstep(LOD0_DIST, LOD0_DIST + 0.01, frag_dist))
                 * smoothstep(LOD0_DIST - 0.02, LOD0_DIST, frag_dist);
    float seam12 = (1.0 - smoothstep(LOD1_DIST, LOD1_DIST + 0.01, frag_dist))
                 * smoothstep(LOD1_DIST - 0.02, LOD1_DIST, frag_dist);

    // Pop flash: brief bright band that propagates outward at the moment of snap
    float snap01 = smoothstep(0.0, 0.03, seam01) * 1.5;
    float snap12 = smoothstep(0.0, 0.03, seam12) * 1.5;
    col += vec3(0.8, 0.4, 0.0) * seam01 * snap01;
    col += vec3(0.0, 0.6, 1.0) * seam12 * snap12;

    // Subtle LOD region label tint (amber = LOD0, green = LOD1, blue = LOD2)
    vec3 region_tint = (lod == 0) ? vec3(0.15, 0.05, 0.0) :
                       (lod == 1) ? vec3(0.0, 0.08, 0.0) :
                                    vec3(0.0, 0.0, 0.1);
    col += region_tint;

    gl_FragColor = vec4(col, 1.0);
}
