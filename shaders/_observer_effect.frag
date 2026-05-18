// ENGINE: Frustum culling + observer-dependent rendering + quantum pop-in
// SCENE: Sparse forest, entities exist only when observed
// OBSERVER: First-person with mouse-controlled gaze
// ARTIFACT: Trees pop into existence at edge of vision, simplify when not looked at directly

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define MAX_ITER 60
#define PI 3.14159265

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Tree as fractal branch system
float tree_sdf(vec2 p, float seed) {
    p *= 3.0;
    float d = length(p - vec2(0.0, 0.5)) - 0.05; // trunk
    
    // Branches: recursive reduction
    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float angle = hash(vec2(seed, fi)) * PI * 2.0;
        float len = 0.3 / (fi + 1.0);
        vec2 branch = vec2(cos(angle), sin(angle)) * len;
        vec2 bp = p - branch * 0.5;
        d = min(d, length(bp) - 0.02 / (fi + 1.0));
    }
    
    return d;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;
    
    // Observer gaze direction
    vec2 gaze = (u_mouse / u_resolution - 0.5) * 2.0;
    gaze.x *= u_resolution.x / u_resolution.y;
    
    // World
    vec2 world = st * 4.0;
    vec2 cell = floor(world);
    vec2 local = fract(world) - 0.5;
    
    float seed = hash(cell);
    vec3 col = vec3(0.01, 0.02, 0.03); // void
    
    // Frustum: cone of attention
    vec2 to_entity = cell + 0.5 - world;
    float entity_angle = atan(to_entity.y, to_entity.x);
    float gaze_angle = atan(gaze.y, gaze.x);
    float angle_diff = abs(mod(entity_angle - gaze_angle + PI, 2.0 * PI) - PI);
    
    // Field of view: 90 degrees
    float in_frustum = 1.0 - smoothstep(PI * 0.25, PI * 0.4, angle_diff);
    
    // Fovea: highest detail at center of gaze
    float foveal_dist = length(to_entity);
    float fovea = 1.0 - smoothstep(0.5, 2.0, foveal_dist);
    
    // Quantum rendering: not observed = low-res or absent
    float detail_level = in_frustum * fovea;
    
    // Culling: beyond frustum, entities do not exist
    float exists = in_frustum * step(0.1, hash(cell + 100.0));
    
    if (exists > 0.5) {
        // LOD based on foveal distance
        float tree = tree_sdf(local, seed);
        
        // Far = proxy (no branches)
        float proxy = length(local - vec2(0.0, 0.3)) - 0.15;
        tree = mix(proxy, tree, detail_level);
        
        float mask = 1.0 - smoothstep(0.0, 0.01, tree);
        
        // Color: alive when observed, ghostly when peripheral
        vec3 trunk = vec3(0.3, 0.2, 0.15) * detail_level;
        vec3 leaves = vec3(0.1, 0.4 + seed * 0.2, 0.15) * detail_level;
        vec3 tree_col = mix(trunk, leaves, smoothstep(0.0, 0.1, local.y));
        
        // Quantum uncertainty: peripheral entities flicker
        float flicker = sin(u_time * 20.0 + seed * 100.0) * 0.5 + 0.5;
        float peripheral = 1.0 - fovea;
        tree_col *= 1.0 - peripheral * flicker * 0.5;
        
        col += tree_col * mask;
    }
    
    // Frustum boundary visualization: subtle blue line at edge of perception
    float frustum_edge = smoothstep(PI * 0.22, PI * 0.25, angle_diff) 
                       * smoothstep(PI * 0.4, PI * 0.35, angle_diff);
    col += vec3(0.0, 0.1, 0.3) * frustum_edge * 0.3;
    
    // Fovea center marker (subtle)
    float fovea_center = 1.0 - smoothstep(0.0, 0.05, length(st - 0.5 - gaze * 0.5));
    col += vec3(0.05, 0.0, 0.0) * fovea_center;
    
    gl_FragColor = vec4(col, 1.0);
}
