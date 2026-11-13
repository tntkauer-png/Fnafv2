import * as THREE from '../vendor/three.module.min.js';

/* Full-screen post pipeline: HDR scene -> bright pass -> separable blur -> filmic composite.
   Runs without any external example modules, so it stays a single-file static build. */

const VERT = /* glsl */`
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const BRIGHT = /* glsl */`
uniform sampler2D tDiffuse;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float knee = max(uKnee, 0.0001);
  float soft = clamp(l - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 0.0001);
  float contrib = max(soft, l - uThreshold) / max(l, 0.0001);
  gl_FragColor = vec4(c * contrib, 1.0);
}`;

const BLUR = /* glsl */`
uniform sampler2D tDiffuse;
uniform vec2 uDir;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
  c += texture2D(tDiffuse, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tDiffuse, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tDiffuse, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tDiffuse, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

const COMPOSITE = /* glsl */`
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uTime;
uniform float uExposure;
uniform float uBloom;
uniform float uVignette;
uniform float uGrain;
uniform float uAberration;
uniform float uDamage;
uniform float uDesat;
uniform float uFlash;
uniform float uDark;
uniform float uScan;
uniform float uWarp;
varying vec2 vUv;

float hash(vec2 p){
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
vec3 aces(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
void main(){
  vec2 uv = vUv;
  vec2 cc = uv - 0.5;
  float r2 = dot(cc, cc);

  // subtle lens warp
  uv = 0.5 + cc * (1.0 + r2 * uWarp);

  float ab = uAberration * (0.35 + r2 * 1.6) * 0.012;
  vec2 dir = normalize(cc + 0.00001) * ab;

  vec3 col;
  col.r = texture2D(tScene, uv + dir).r;
  col.g = texture2D(tScene, uv).g;
  col.b = texture2D(tScene, uv - dir).b;

  vec3 bloom = texture2D(tBloom, uv).rgb;
  col += bloom * uBloom;
  col *= uExposure;
  col = aces(col);

  // teal-shadows / warm-highlights grade
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, col * vec3(1.055, 1.0, 0.935), 0.5);
  col += vec3(0.012, 0.028, 0.036) * (1.0 - smoothstep(0.0, 0.55, lum));
  col = mix(col, vec3(lum), uDesat);

  // blood / alarm grade
  col = mix(col, col * vec3(1.22, 0.4, 0.34) + vec3(0.14, 0.0, 0.0), uDamage * 0.85);
  col *= uDark;

  // vignette
  float vig = smoothstep(0.95, 0.22, length(cc) * 1.32);
  col *= mix(1.0, 0.22 + vig * 0.78, uVignette);

  // scanlines, very subtle
  col *= 1.0 - uScan * (0.5 + 0.5 * sin(uv.y * 1100.0));

  // film grain
  float g = hash(uv * 1024.0 + fract(uTime) * 173.0) - 0.5;
  col += g * uGrain * (0.35 + 0.65 * (1.0 - lum));

  col += uFlash;
  gl_FragColor = vec4(max(col, 0.0), 1.0);

  #include <colorspace_fragment>
}`;

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.ok = false;
    this.enabled = true;
    this.time = 0;
    this._w = 1; this._h = 1; this._pr = 1;

    try {
      const half = THREE.HalfFloatType;
      const opts = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: half,
        depthBuffer: true,
        stencilBuffer: false,
        samples: 2
      };
      this.sceneRT = new THREE.WebGLRenderTarget(1, 1, opts);
      this.sceneRT.texture.colorSpace = THREE.LinearSRGBColorSpace;
      this.bloomRT = new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, type: half, depthBuffer: false
      });
      this.blurRT = new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, type: half, depthBuffer: false
      });

      this.brightMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: BRIGHT,
        uniforms: {
          tDiffuse: { value: this.sceneRT.texture },
          uThreshold: { value: 1.18 },
          uKnee: { value: 0.55 }
        },
        depthTest: false, depthWrite: false
      });
      this.blurMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: BLUR,
        uniforms: {
          tDiffuse: { value: this.bloomRT.texture },
          uDir: { value: new THREE.Vector2() }
        },
        depthTest: false, depthWrite: false
      });
      this.compositeMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: COMPOSITE,
        uniforms: {
          tScene: { value: this.sceneRT.texture },
          tBloom: { value: this.bloomRT.texture },
          uTime: { value: 0 },
          uExposure: { value: 1.0 },
          uBloom: { value: 0.4 },
          uVignette: { value: 0.72 },
          uGrain: { value: 0.026 },
          uAberration: { value: 0.16 },
          uDamage: { value: 0 },
          uDesat: { value: 0 },
          uFlash: { value: 0 },
          uDark: { value: 1 },
          uScan: { value: 0.008 },
          uWarp: { value: 0.0025 }
        },
        depthTest: false, depthWrite: false
      });

      this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.compositeMat);
      this.quad.frustumCulled = false;
      this.quadScene = new THREE.Scene();
      this.quadScene.add(this.quad);
      this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.ok = true;
    } catch (e) {
      console.warn('[postfx] disabled:', e);
      this.enabled = false;
    }
  }

  resize(w, h, pixelRatio = 1) {
    this._w = Math.max(2, Math.floor(w * pixelRatio));
    this._h = Math.max(2, Math.floor(h * pixelRatio));
    this._pr = pixelRatio;
    if (!this.ok) return;
    this.sceneRT.setSize(this._w, this._h);
    const bw = Math.max(2, Math.floor(this._w * 0.5));
    const bh = Math.max(2, Math.floor(this._h * 0.5));
    this.bloomRT.setSize(bw, bh);
    this.blurRT.setSize(bw, bh);
    this._bw = bw; this._bh = bh;
  }

  setParams(p = {}) {
    if (!this.ok) return;
    const u = this.compositeMat.uniforms;
    for (const k in p) if (u['u' + k]) u['u' + k].value = p[k];
  }

  flash(amount = 0.4) {
    if (!this.ok) return;
    this.compositeMat.uniforms.uFlash.value = amount;
  }

  render(scene, camera, dt = 0.016) {
    this.time += dt;
    if (!this.ok || !this.enabled) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }
    const r = this.renderer;
    const u = this.compositeMat.uniforms;
    u.uTime.value = this.time;
    // decay transient flash / damage so callers can just poke them
    u.uFlash.value *= Math.pow(0.001, dt);
    if (u.uFlash.value < 0.002) u.uFlash.value = 0;

    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);

    r.setRenderTarget(this.bloomRT);
    r.clear();
    this.quad.material = this.brightMat;
    r.render(this.quadScene, this.quadCam);

    // horizontal blur -> blurRT
    this.quad.material = this.blurMat;
    this.blurMat.uniforms.tDiffuse.value = this.bloomRT.texture;
    this.blurMat.uniforms.uDir.value.set(1 / this._bw, 0);
    r.setRenderTarget(this.blurRT);
    r.clear();
    r.render(this.quadScene, this.quadCam);

    // vertical blur -> bloomRT
    this.blurMat.uniforms.tDiffuse.value = this.blurRT.texture;
    this.blurMat.uniforms.uDir.value.set(0, 1 / this._bh);
    r.setRenderTarget(this.bloomRT);
    r.clear();
    r.render(this.quadScene, this.quadCam);

    r.setRenderTarget(null);
    this.quad.material = this.compositeMat;
    r.render(this.quadScene, this.quadCam);
  }

  dispose() {
    if (!this.ok) return;
    this.sceneRT.dispose(); this.bloomRT.dispose(); this.blurRT.dispose();
    this.brightMat.dispose(); this.blurMat.dispose(); this.compositeMat.dispose();
    this.quad.geometry.dispose();
  }
}
