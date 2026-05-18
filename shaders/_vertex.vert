// Common full-screen quad vertex shader
// All fragment shaders in this project use this vertex stage.
// The runner sets up a clip-space quad (-1..1) and passes through
// gl_FragCoord for the fragment stage.

attribute vec2 a_position;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
