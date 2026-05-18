// ENGINE: Texture streaming + LOD transitions + entity pop-in under memory pressure
// SCENE: Dense procedural city, 100k+ instanced buildings
// OBSERVER: Orbiting camera, continuous movement
// ARTIFACT: Distant buildings render as low-res proxies, snap to detail as camera approaches

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

#define MAX_BUILDINGS 8
#define LOD_DISTANCE_1 0.15
#define LOD_DISTANCE_2 0.35
#define STREAM_SPEED 4.0

// Hash for deterministic "world seed"
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Building footprint
float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// LOD proxy: low-poly block
vec3 lod0(vec2 uv, float dist) {
    // No texture, flat shading, bounding box only
    float box = sdBox(uv, vec2(0.08, 0.12));
    float mask = 1.0 - smoothstep(0.0, 0.01, box);
    
    // Flat color per building ID
    float h = hash(floor(uv * 20.0));
    vec3 col = vec3(0.5 + 0.2 * h, 0.5 + 0.15 * h, 0.55 + 0.1 * h);
    col *= 0.6; // deliberately low-res, no detail
    
    return col * mask * (1.0 - dist * 0.5); // fog culling
}

// LOD1: textured facade, no interior
vec3 lod1(vec2 uv, float dist, float seed) {
    float box = sdBox(uv, vec2(0.08, 0.12));
    float mask = 1.0 - smoothstep(0.0, 0.005, box);
    
    // Streaming texture: starts blurry, sharpens
    float stream = clamp((u_time * STREAM_SPEED - dist * 10.0), 0.0, 1.0);
    float detail = mix(0.05, 0.01, stream); // pixel size proxy
    
    // Facade grid
    vec2 grid = abs(fract(uv / detail) - 0.5) * 2.0;
    float window = smoothstep(0.3, 0.5, max(grid.x, grid.y));
    
    vec3 concrete = vec3(0.65, 0.62, 0.58);
    vec3 glass = vec3(0.25, 0.35, 0.45) * (0.5 + 0.5 * sin(seed * 10.0 + u_time));
    vec3 facade = mix(concrete, glass, window * 0.4);
    
    // Pop-in: scale from 0 to 1 over a few frames
    float pop = smoothstep(0.0, 0.05, stream);
    facade *= pop;
    
    return facade * mask * (1.0 - dist * 0.3);
}

// LOD2: full detail, interior lights, specular
vec3 lod2(vec2 uv, float dist, float seed) {
    float box = sdBox(uv, vec2(0.08, 0.12));
    float mask = 1.0 - smoothstep(0.0, 0.002, box);
    
    float stream = clamp((u_time * STREAM_SPEED - dist * 15.0), 0.0, 1.0);
    float pop = smoothstep(0.0, 0.03, stream);
    
    // Fine facade detail
    vec2 fine = uv * 50.0;
    vec2 grid = abs(fract(fine) - 0.5) * 2.0;
    float window = 1.0 - smoothstep(0.2, 0.3, max(grid.x, grid.y));
    
    // Interior lights: some on, some off, deterministic per window
    vec2 win_id = floor(fine);
    float lit = step(0.6, hash(win_id + seed));
    float flicker = step(0.95, hash(win_id + seed + 100.0)) * sin(u_time * 10.0);
    lit += flicker * 0.3;
    
    vec3 concrete = vec3(0.6, 0.58, 0.55);
    vec3 warm_light = vec3(0.95, 0.75, 0.35) * lit;
    vec3 cool_glass = vec3(0.2, 0.3, 0.4);
    
    vec3 facade = mix(concrete, mix(cool_glass, warm_light, lit * 0.7), window);
    
    // Specular highlight on building edge
    float edge = smoothstep(0.0, 0.01, abs(abs(uv.x) - 0.08));
    facade += vec3(0.4) * edge * window;
    
    return facade * mask * pop * (1.0 - dist * 0.2);
}

vec3 render_building(vec2 uv, float dist, float seed) {
    // LOD selection based on distance
    vec3 col = vec3(0.0);
    
    // LOD0: very far, just a block
    if (dist > LOD_DISTANCE_2) {
        col = lod0(uv, dist);
    }
    // LOD1: mid distance, facades but no interior
    else if (dist > LOD_DISTANCE_1) {
        // LOD pop: transition from LOD0 to LOD1
        float lod_blend = smoothstep(LOD_DISTANCE_2, LOD_DISTANCE_1, dist);
        col = mix(lod1(uv, dist, seed), lod0(uv, dist), lod_blend);
    }
    // LOD2: close, full detail
    else {
        float lod_blend = smoothstep(LOD_DISTANCE_1, 0.05, dist);
        col = mix(lod2(uv, dist, seed), lod1(uv, dist, seed), lod_blend);
    }
    
    return col;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;
    
    // Camera orbit
    float cam_angle = u_time * 0.1;
    vec2 cam_pos = vec2(sin(cam_angle), cos(cam_angle)) * 0.3;
    
    // World space
    vec2 world = st + cam_pos;
    
    vec3 col = vec3(0.02, 0.025, 0.03); // void background
    
    // Grid of buildings
    vec2 grid_uv = world * 6.0;
    vec2 cell = floor(grid_uv);
    vec2 local = fract(grid_uv) - 0.5;
    
    float dist_from_cam = length(cell / 6.0 - cam_pos);
    float seed = hash(cell);
    
    // Entity culling: don't render if too far (simulation budget exceeded)
    float cull = step(dist_from_cam, 0.6);
    
    // Pop-in: buildings appear as camera approaches
    float pop_threshold = 0.55 + 0.05 * sin(seed * 20.0);
    float pop = smoothstep(pop_threshold, pop_threshold - 0.05, dist_from_cam);
    
    if (cull > 0.5 && pop > 0.01) {
        vec3 bcol = render_building(local, dist_from_cam, seed);
        col += bcol * pop;
    }
    
    // Memory pressure indicator: subtle red vignette when many entities loaded
    float entity_count = smoothstep(0.0, 0.5, dist_from_cam);
    float pressure = (1.0 - entity_count) * 0.15;
    col += vec3(pressure * 0.8, 0.0, 0.0) * (1.0 - length(st));
    
    // Z-fighting simulation on distant LOD boundaries
    float zfight = sin(gl_FragCoord.x * 0.5 + u_time * 60.0) * 0.5 + 0.5;
    float zregion = smoothstep(LOD_DISTANCE_1 - 0.01, LOD_DISTANCE_1, dist_from_cam);
    col *= 1.0 - zregion * zfight * 0.15;
    
    gl_FragColor = vec4(col, 1.0);
}
