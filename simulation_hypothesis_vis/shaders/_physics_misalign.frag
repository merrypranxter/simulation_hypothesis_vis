// ENGINE: Physics timestep misalignment vs render framerate
// SCENE: Stack of rigid bodies, unstable equilibrium
// OBSERVER: Slow-moving camera, time dilation effect
// ARTIFACT: Stutter, tunneling, objects jumping between states

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

#define PHYSICS_TICK 0.016  // 60Hz physics
#define RENDER_DT 0.011     // ~90Hz render (mismatched!)
#define STACK_HEIGHT 5

float hash(float n) {
    return fract(sin(n) * 43758.5453);
}

// Box SDF
float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Physics tick: discrete, fixed timestep
vec2 physics_position(float object_id, float time) {
    // Each object has slightly different physics error
    float error = hash(object_id) * 0.02;
    
    // Discrete physics ticks
    float ticks = floor(time / PHYSICS_TICK);
    float tick_time = ticks * PHYSICS_TICK;
    
    // Gravity + bounce (very simplified)
    float y = abs(sin(tick_time * 2.0 + object_id)) * (0.5 - object_id * 0.08);
    y += error * sin(ticks * 3.0); // tick-dependent jitter
    
    // Tunneling artifact: object jumps through floor briefly
    float tunnel = step(0.95, hash(ticks + object_id * 10.0));
    y -= tunnel * 0.05;
    
    return vec2(0.0, y);
}

// Render position: interpolated but misaligned
vec2 render_position(float object_id, float time) {
    vec2 phys = physics_position(object_id, time);
    
    // Interpolation between physics ticks creates smear
    float alpha = mod(time, PHYSICS_TICK) / PHYSICS_TICK;
    vec2 next_phys = physics_position(object_id, time + PHYSICS_TICK);
    
    // Linear interpolation = the stutter
    vec2 interp = mix(phys, next_phys, alpha);
    
    // TAA ghost: previous frame bleeds through
    float prev_blend = 0.3;
    vec2 prev = physics_position(object_id, time - RENDER_DT);
    interp = mix(interp, prev, prev_blend);
    
    return interp;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;
    
    vec3 col = vec3(0.05, 0.05, 0.06);
    
    // Ground plane
    float ground = sdBox(st - vec2(0.0, -0.4), vec2(2.0, 0.01));
    float ground_mask = 1.0 - smoothstep(0.0, 0.005, ground);
    col += vec3(0.3, 0.3, 0.35) * ground_mask;
    
    // Stack of boxes
    for (float i = 0.0; i < float(STACK_HEIGHT); i++) {
        vec2 pos = render_position(i, u_time);
        pos.y += i * 0.12; // stack offset
        
        float box = sdBox(st - pos, vec2(0.08, 0.05));
        float mask = 1.0 - smoothstep(0.0, 0.005, box);
        
        // Color: warmer = more error
        float error = hash(i) * 0.02;
        vec3 box_col = mix(
            vec3(0.6, 0.55, 0.5),
            vec3(0.8, 0.3, 0.2),
            error * 50.0
        );
        
        // TAA ghost trail
        vec2 prev_pos = render_position(i, u_time - RENDER_DT);
        prev_pos.y += i * 0.12;
        float trail = sdBox(st - prev_pos, vec2(0.08, 0.05));
        float trail_mask = 1.0 - smoothstep(0.0, 0.02, trail);
        col += box_col * trail_mask * 0.3;
        
        col = mix(col, box_col, mask);
    }
    
    // Physics tick indicator: subtle vertical lines at tick boundaries
    float tick_line = step(0.98, fract(st.x * 20.0 + u_time * 2.0));
    col += vec3(0.0, 0.05, 0.0) * tick_line * 0.2;
    
    gl_FragColor = vec4(col, 1.0);
}
