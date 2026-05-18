// ENGINE: Portal rendering + occlusion culling + draw-call budget
// SCENE: Infinite corridor of rooms, each room only rendered through its portal
// OBSERVER: Camera orbiting through doorways
// ARTIFACT: Rooms pop out of existence when portal clips out of view; 
//            draw-call budget starves rooms at depth > 4

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

#define PI 3.14159265
#define PORTAL_FADE 0.05
#define MAX_ROOMS 6

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Axis-aligned slab SDF: signed distance to a rectangle
float sdRect(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Portal: a vertical opening in a wall
float portal(vec2 p, float wall_x) {
    float wall = abs(p.x - wall_x) - 0.01;
    float aperture = abs(p.y) - 0.25; // door height ±0.25
    return max(wall, -aperture);       // carve aperture from wall
}

// Room interior floor/ceiling/wall shading
vec3 room_shade(vec2 local, int depth, float seed) {
    float fi = float(depth);
    // Floor line
    float floor_line = abs(local.y + 0.35) - 0.01;
    float ceil_line  = abs(local.y - 0.35) - 0.01;
    float surface    = min(floor_line, ceil_line);
    float surface_m  = 1.0 - smoothstep(0.0, 0.008, surface);

    // Wall at far end
    float far_wall   = abs(local.x - 0.5) - 0.01;
    float wall_m     = 1.0 - smoothstep(0.0, 0.008, far_wall);

    // Room tint darkens with depth — simulation budget constraint
    float budget_fade = 1.0 / (fi * 0.6 + 1.0);
    vec3 tint = mix(
        vec3(0.55, 0.5, 0.45),
        vec3(0.2, 0.22, 0.28),
        fi / float(MAX_ROOMS)
    );

    // Overhead light fixture per room
    float light_x = 0.0;
    float light_y = 0.3;
    float lamp    = 1.0 - smoothstep(0.0, 0.04, length(local - vec2(light_x, light_y)));
    vec3 lamp_col = vec3(0.9, 0.85, 0.65) * lamp;

    // Floor grid (UV evidence)
    vec2 tiles = fract(local * 8.0);
    float grout = 1.0 - smoothstep(0.0, 0.03, min(tiles.x, tiles.y));

    vec3 col = tint * budget_fade;
    col += vec3(0.8, 0.75, 0.7) * surface_m * budget_fade;
    col += tint * 0.5 * wall_m * budget_fade;
    col -= vec3(0.08) * grout;
    col += lamp_col * budget_fade;
    return col;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;
    st -= vec2(0.5 * u_resolution.x / u_resolution.y, 0.5);

    // Slow horizontal drift — simulated camera walk
    float cam_x = sin(u_time * 0.12) * 0.3;
    float cam_y = sin(u_time * 0.07) * 0.1;
    vec2 cam = vec2(cam_x, cam_y);
    vec2 world = st + cam;

    vec3 col = vec3(0.01, 0.01, 0.015);

    // Render rooms from back to front so portals gate correctly
    for (int d = MAX_ROOMS - 1; d >= 0; d--) {
        float fd = float(d);
        float room_offset_x = fd * 1.1;  // each room pushed down corridor

        // Local coordinate inside this room slice
        vec2 local = world - vec2(room_offset_x, 0.0);

        // Room bounds: [-0.5, 0.5] x [-0.4, 0.4]
        float in_room = 1.0 - step(0.5, abs(local.x));
        in_room      *= 1.0 - step(0.4, abs(local.y));

        if (in_room < 0.5) continue;

        float seed = hash(vec2(fd, 3.7));

        // Portal clip: room d is only visible through the portal at x = -0.5
        // (the wall between room d-1 and room d).
        // Compute how much of the portal opening is in view.
        float portal_y = local.y; // in room-local coords, portal is at x=-0.5
        float visible_through_portal = 1.0 - smoothstep(0.2, 0.25 + PORTAL_FADE, abs(portal_y));

        // Draw-call budget: rooms beyond depth 4 are culled
        float budget = 1.0 - step(4.5, fd);

        float contrib = visible_through_portal * budget;
        if (contrib < 0.01) continue;

        vec3 room_col = room_shade(local, d, seed);

        // Portal edge: brief bright frame where the wall is
        float wall_edge = 1.0 - smoothstep(0.0, 0.015, abs(abs(local.x) - 0.49));
        room_col += vec3(0.6, 0.55, 0.4) * wall_edge * 0.4;

        col = mix(col, room_col, contrib * in_room);
    }

    // Occlusion boundary: thin white line where the draw call is cut
    float cull_depth_x = 4.0 * 1.1 - cam.x;
    float cull_line    = 1.0 - smoothstep(0.0, 0.008, abs(world.x - cull_depth_x));
    col += vec3(0.9, 0.2, 0.1) * cull_line * 0.5; // red culling boundary

    // Depth-of-field haze — simulates the engine's forward renderer pass count
    float fog = smoothstep(0.0, 1.5, abs(world.x));
    col = mix(col, vec3(0.01, 0.01, 0.015), fog * 0.6);

    gl_FragColor = vec4(col, 1.0);
}
