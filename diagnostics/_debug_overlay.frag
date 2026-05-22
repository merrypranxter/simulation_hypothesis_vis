// ENGINE: Debug visualization — wireframe + normals + UV seams
// SCENE: Procedural geometry under diagnostic overlay
// OBSERVER: Orbiting camera
// ARTIFACT: The machine's internal understanding of form made visible

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

#define PI 3.14159265

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Procedural terrain height
float terrain(vec2 p) {
    float h = 0.0;
    float amp = 0.5;
    float freq = 2.0;
    for (int i = 0; i < 4; i++) {
        h += sin(p.x * freq + u_time * 0.1) * cos(p.y * freq * 0.7) * amp;
        freq *= 2.0;
        amp *= 0.5;
    }
    return h;
}

// Normal from terrain (central differences)
vec3 terrain_normal(vec2 p) {
    float eps = 0.01;
    float dx = terrain(p + vec2(eps, 0.0)) - terrain(p - vec2(eps, 0.0));
    float dy = terrain(p + vec2(0.0, eps)) - terrain(p - vec2(0.0, eps));
    return normalize(vec3(-dx, -dy, 2.0 * eps));
}

// Wireframe: triangle edges visible
float wireframe(vec2 p, float scale) {
    vec2 grid = fract(p * scale);
    float edge = min(min(grid.x, grid.y), min(1.0 - grid.x, 1.0 - grid.y));
    return 1.0 - smoothstep(0.0, 0.02, edge);
}

// UV seam visualization: discontinuities in texture coordinates
float uv_seam(vec2 p, float scale) {
    vec2 grid = fract(p * scale);
    float seam_x = abs(grid.x - 0.5) * 2.0;
    float seam_y = abs(grid.y - 0.5) * 2.0;
    return smoothstep(0.45, 0.5, max(seam_x, seam_y));
}

// Vertex color: debug channel data
vec3 vertex_color(vec2 p, float scale) {
    float h = terrain(p);
    vec3 debug = vec3(0.0);
    // R channel: height
    debug.r = h * 0.5 + 0.5;
    // G channel: slope
    vec3 n = terrain_normal(p);
    debug.g = 1.0 - n.z;
    // B channel: curvature (approx)
    debug.b = abs(terrain(p + vec2(0.02, 0.0)) - 2.0 * h + terrain(p - vec2(0.02, 0.0))) * 10.0;
    return debug;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;
    
    // Camera orbit
    float cam_angle = u_time * 0.15;
    vec2 cam_pos = vec2(sin(cam_angle), cos(cam_angle)) * 0.5;
    
    vec2 world = st + cam_pos;
    
    vec3 col = vec3(0.02, 0.03, 0.04);
    
    // Terrain height
    float h = terrain(world);
    
    // Mode: wireframe overlay
    float wire = wireframe(world, 5.0);
    
    // Mode: normal visualization
    vec3 n = terrain_normal(world);
    vec3 normal_vis = n * 0.5 + 0.5;
    
    // Mode: UV seam
    float seam = uv_seam(world, 3.0);
    
    // Mode: vertex color debug
    vec3 vcolor = vertex_color(world, 5.0);
    
    // Layered diagnostic view
    vec3 terrain_shaded = vec3(0.3 + h * 0.3, 0.35 + h * 0.25, 0.25 + h * 0.2);
    
    // Wireframe on shaded
    col = mix(terrain_shaded, vec3(0.0, 0.8, 0.2), wire * 0.7);
    
    // Normal overlay (subtle, at grazing angles)
    float grazing = 1.0 - abs(n.z);
    col = mix(col, normal_vis, grazing * 0.3);
    
    // UV seam highlight
    col += vec3(0.8, 0.0, 0.0) * seam * 0.5;
    
    // Vertex color in corners (debug mode trigger zones)
    float corner = step(0.85, st.x) * step(0.85, st.y);
    col = mix(col, vcolor, corner * 0.8);
    
    // Bounding box visualization: world-space grid
    vec2 bbox = abs(fract(world) - 0.5) * 2.0;
    float bbox_edge = max(bbox.x, bbox.y);
    float bbox_vis = smoothstep(0.95, 1.0, bbox_edge);
    col += vec3(0.3, 0.5, 0.8) * bbox_vis * 0.3;
    
    gl_FragColor = vec4(col, 1.0);
}
