// Waterlight aperture mapping; dimensions and gain belong to this scene.
export const disturbedSurfaceSlopeGLSL = /* glsl */ `
  vec2 surfaceSlope(vec2 xz){
    vec2 slope=oceanSlope(xz,uTime);
    if(uUseSimulation>.5){
      vec2 uv=clamp(vec2(xz.x/3.6+.5,.5-(xz.y+.2)/3.6),0.,1.),e=uWaveTexel;
      slope+=3.*vec2(texture2D(uWaves,clamp(uv+vec2(e.x,0.),0.,1.)).r-texture2D(uWaves,clamp(uv-vec2(e.x,0.),0.,1.)).r,-(texture2D(uWaves,clamp(uv+vec2(0.,e.y),0.,1.)).r-texture2D(uWaves,clamp(uv-vec2(0.,e.y),0.,1.)).r))/(2.*3.6*e);
    }
    return slope;
  }
`;

export const disturbedSurfaceGLSL = /* glsl */ `
  float disturbanceHeight(vec2 xz){
    vec2 uv=clamp(vec2(xz.x/3.6+.5,.5-(xz.y+.2)/3.6),0.,1.);
    return uUseSimulation>.5?texture2D(uWaves,uv).r*3.:0.;
  }
` + disturbedSurfaceSlopeGLSL;
