// ENGINE: Z-fighting — depth buffer precision failure
// SCENE: Two coplanar surfaces at nearly identical depth
//        The GPU cannot decide which pixel belongs to which surface.
//        The result is an aliasing pattern that travels with screen-space coordinates.
// OBSERVER: Slowly rotating camera to change the projection angle
// ARTIFACT: Flickering checkerboard at coplanar boundary;
//            the pattern shifts with camera movement, revealing the depth-buffer lattice

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Depth-buffer precision simulation:
// Two surfaces separated by epsilon; GPU rounds to nearest depth bucket
float depth_fight(vec2 p, float z_offset, float z_precision) {
    // Surface A: flat plane at z=0
    // Surface B: plane at z=epsilon, with slight tilt (real-world cause)
    float z_a = 0.0;
    float z_b = z_offset + (p.x * 0.002 + p.y * 0.001); // tiny tilt

    // Quantise to depth buffer resolution
    float buckets = 1.0 / z_precision;
    float q_a = floor(z_a * buckets) / buckets;
    float q_b = floor(z_b * buckets) / buckets;

    // When quantised values are equal, it's a toss-up (hash decides)
    if (abs(q_a - q_b) < z_precision * 0.5) {
        return step(0.5, hash(p * 300.0 + floor(u_time * 60.0)));
    }
    return step(z_b, z_a); // deterministic winner
}

// Surface A: concrete floor tiles
vec3 surface_a(vec2 p) {
    vec2 tile = fract(p * 6.0);
    float grout = 1.0 - smoothstep(0.03, 0.06, min(tile.x, tile.y));
    float grout2 = 1.0 - smoothstep(0.03, 0.06, min(1.0 - tile.x, 1.0 - tile.y));
    vec3 base = vec3(0.55, 0.52, 0.48);
    base -= (grout + grout2) * 0.12;
    return base;
}

// Surface B: floor decal / painted marking
vec3 surface_b(vec2 p) {
    // Diagonal stripe pattern
    float stripe = fract((p.x + p.y) * 8.0);
    float band = smoothstep(0.3, 0.4, stripe) * (1.0 - smoothstep(0.5, 0.6, stripe));
    vec3 base  = vec3(0.2, 0.18, 0.16);
    base += vec3(0.8, 0.7, 0.1) * band; // yellow stripe
    return base;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;
    st -= vec2(0.5 * u_resolution.x / u_resolution.y, 0.5);

    // Camera slowly rotates, changing projection — the z-fight pattern shifts
    float cam_angle = u_time * 0.15;
    vec2 world = st;
    world.x += sin(cam_angle) * 0.05;
    world.y += cos(cam_angle * 0.7) * 0.03;

    // Z-offset oscillates through the danger zone (near zero)
    float z_eps = 0.0003 + 0.0002 * sin(u_time * 0.8);
    // Precision: simulates a 24-bit depth buffer at typical far plane
    float z_prec = 0.00005;

    // Fight zone: central region where surfaces overlap
    float fight_radius = 0.5;
    float in_fight = 1.0 - smoothstep(fight_radius - 0.05, fight_radius, length(world));

    vec3 col;
    if (in_fight > 0.5) {
        float winner = depth_fight(gl_FragCoord.xy, z_eps, z_prec);
        col = mix(surface_a(world), surface_b(world), winner);
    } else {
        // Outside fight zone: surface A is clearly on top
        col = surface_a(world);
    }

    // Z-fight boundary indicator — the engine's confusion made legible
    float boundary = smoothstep(fight_radius - 0.05, fight_radius, length(world))
                   * (1.0 - smoothstep(fight_radius, fight_radius + 0.03, length(world)));
    col = mix(col, vec3(0.8, 0.2, 0.0), boundary * 0.5);

    // Scanline overlay: reveals the per-pixel depth comparison cadence
    float scanline = sin(gl_FragCoord.y * 3.14159) * 0.04;
    col += scanline * in_fight;

    // Depth readout: subtle gradient showing distance from coplanar threshold
    float depth_vis = 1.0 - smoothstep(0.0, 0.001, abs(z_eps));
    col += vec3(0.0, 0.0, 0.3) * depth_vis * in_fight * 0.3;

    gl_FragColor = vec4(col, 1.0);
}
