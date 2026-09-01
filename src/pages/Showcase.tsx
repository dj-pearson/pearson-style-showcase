import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import './Showcase.css';

/* ======================================================================
 *  Advanced Web Design Showcase
 *  A single-page experience that demonstrates the techniques it describes:
 *  hand-written WebGL2 / GLSL shaders, scroll-driven CSS animations,
 *  container queries, :has(), OKLCH + color-mix(), @property gradients,
 *  3D pointer tilt, magnetic buttons and a blend-mode custom cursor.
 *
 *  No 3D framework is used — every canvas is raw WebGL2 so the shader
 *  pipeline is fully transparent and dependency-free.
 * ==================================================================== */

/* ---- Shared GLSL -------------------------------------------------- */

// Fullscreen triangle — no vertex buffer, positions derived from gl_VertexID.
const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Common header + noise/palette helpers prepended to every fragment snippet.
const FRAG_HEADER = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2  u_resolution;
uniform vec2  u_mouse;      // 0..1, y up
uniform float u_time;
uniform float u_enter;      // 0..1 reveal ramp

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
vec2 hash22(vec2 p){
  float n = sin(dot(p, vec2(41.0, 289.0)));
  return fract(vec2(262144.0, 32768.0) * n);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), u.x),
             mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 6; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}
// Inigo Quilez cosine palette
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){
  return a + b * cos(6.28318 * (c * t + d));
}
`;

// ---- Hero: domain-warped iridescent nebula, pointer-reactive ----
const HERO_FRAG =
  FRAG_HEADER +
  `
void main(){
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  vec2 m  = (u_mouse * 2.0 - 1.0);
  m.x *= u_resolution.x / u_resolution.y;

  float t = u_time * 0.045;
  // two-step domain warp
  vec2 q = vec2(fbm(uv + t), fbm(uv + vec2(5.2, 1.3) - t));
  vec2 r = vec2(
    fbm(uv + 2.0 * q + vec2(1.7, 9.2) + 0.15 * t),
    fbm(uv + 2.0 * q + vec2(8.3, 2.8) - 0.13 * t)
  );
  float f = fbm(uv + 2.4 * r + m * 0.28);

  vec3 col = pal(f + t * 0.6,
    vec3(0.5), vec3(0.5),
    vec3(1.0, 1.0, 1.0),
    vec3(0.0, 0.33, 0.66));      // cyan → violet → magenta sweep
  col = mix(vec3(0.04, 0.05, 0.10), col, smoothstep(0.1, 0.9, f));
  col += 0.14 * pal(length(r) + t, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.15, 0.3));

  // pointer light
  float d = length(uv - m);
  col += vec3(0.28, 0.5, 0.9) * (0.05 / (d * d + 0.12));

  // subtle scanline energy
  col += 0.02 * sin((uv.y + t) * 220.0);
  col *= 0.55 + 0.45 * u_enter;
  col = pow(max(col, 0.0), vec3(0.82));
  fragColor = vec4(col, 1.0);
}`;

// ---- Gallery 1: raymarched SDF (rounded torus-knot-ish) ----
const SDF_FRAG =
  FRAG_HEADER +
  `
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float sdf(vec3 p){
  p.xz *= rot(u_time * 0.3);
  p.xy *= rot(u_time * 0.22);
  float r = length(p.xz) - 1.1;
  vec2 t = vec2(r, p.y);
  float tor = length(t) - 0.42;
  float b = length(max(abs(p) - 0.9, 0.0)) - 0.15;
  return mix(tor, b, 0.35 + 0.35 * sin(u_time * 0.5));
}
vec3 nrm(vec3 p){
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    sdf(p+e.xyy)-sdf(p-e.xyy),
    sdf(p+e.yxy)-sdf(p-e.yxy),
    sdf(p+e.yyx)-sdf(p-e.yyx)));
}
void main(){
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  vec2 m = (u_mouse - 0.5);
  vec3 ro = vec3(0.0, 0.0, 4.0);
  vec3 rd = normalize(vec3(uv + m * 0.4, -1.6));
  float dO = 0.0; float hit = 0.0;
  for (int i = 0; i < 80; i++){
    vec3 p = ro + rd * dO;
    float ds = sdf(p);
    if (ds < 0.001){ hit = 1.0; break; }
    dO += ds;
    if (dO > 12.0) break;
  }
  vec3 col = vec3(0.03, 0.04, 0.07);
  if (hit > 0.5){
    vec3 p = ro + rd * dO;
    vec3 n = nrm(p);
    vec3 l = normalize(vec3(0.8, 0.9, 0.6));
    float diff = clamp(dot(n, l), 0.0, 1.0);
    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);
    vec3 base = pal(dot(n, vec3(0.3)) + u_time * 0.1,
      vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.66));
    col = base * (0.25 + diff) + fres * vec3(0.6, 0.85, 1.0);
    col += pow(diff, 24.0);
  }
  col *= 0.4 + 0.6 * u_enter;
  fragColor = vec4(pow(col, vec3(0.85)), 1.0);
}`;

// ---- Gallery 2: animated Voronoi / cellular ----
const VORONOI_FRAG =
  FRAG_HEADER +
  `
void main(){
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  uv *= 3.0;
  uv += vec2(u_mouse - 0.5) * 2.0;
  vec2 g = floor(uv), f = fract(uv);
  float md = 8.0; vec2 mr = vec2(0.0);
  for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++){
    vec2 o = vec2(float(x), float(y));
    vec2 p = 0.5 + 0.5 * sin(u_time * 0.7 + 6.28 * hash22(g + o));
    vec2 diff = o + p - f;
    float d = dot(diff, diff);
    if (d < md){ md = d; mr = g + o; }
  }
  float edge = sqrt(md);
  vec3 col = pal(hash21(mr) + u_time * 0.05,
    vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.2, 0.5));
  col *= 0.35 + edge;
  col = mix(vec3(0.02,0.03,0.06), col, smoothstep(0.02, 0.4, edge));
  col += smoothstep(0.06, 0.0, edge) * vec3(0.7, 0.9, 1.0); // cell nuclei glow
  col *= 0.4 + 0.6 * u_enter;
  fragColor = vec4(pow(col, vec3(0.85)), 1.0);
}`;

// ---- Gallery 3: polar plasma tunnel ----
const TUNNEL_FRAG =
  FRAG_HEADER +
  `
void main(){
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  uv += (u_mouse - 0.5) * 0.6;
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float t = u_time * 0.4;
  float tunnel = 0.25 / (r + 0.05) + t;
  float bands = fbm(vec2(a * 3.0 + sin(t), tunnel * 2.0));
  vec3 col = pal(bands + tunnel * 0.15,
    vec3(0.5), vec3(0.5), vec3(1.0, 1.0, 1.0), vec3(0.0, 0.33, 0.67));
  col *= smoothstep(0.0, 0.4, r);                 // dark core
  col += smoothstep(0.35, 0.0, r) * vec3(0.9, 0.7, 1.0);
  col *= 0.4 + 0.6 * u_enter;
  fragColor = vec4(pow(max(col,0.0), vec3(0.85)), 1.0);
}`;

/* ---- WebGL runner ------------------------------------------------- */

interface ShaderHandle {
  destroy: () => void;
  setActive: (v: boolean) => void;
}

function runShader(canvas: HTMLCanvasElement, frag: string): ShaderHandle | null {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      // Surface shader errors only in dev to aid iteration.
      if (import.meta.env.DEV) console.warn(gl.getShaderInfoLog(sh), src);
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    if (import.meta.env.DEV) console.warn(gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uEnter = gl.getUniformLocation(prog, 'u_enter');

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

  const resize = () => {
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = (e.clientX - r.left) / r.width;
    mouse.ty = 1 - (e.clientY - r.top) / r.height;
  };
  canvas.addEventListener('pointermove', onMove, { passive: true });

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  let active = true;
  let enter = 0;
  const start = performance.now();

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (!active) return;
    // ease pointer + reveal ramp
    mouse.x += (mouse.tx - mouse.x) * 0.08;
    mouse.y += (mouse.ty - mouse.y) * 0.08;
    enter += (1 - enter) * 0.03;
    const t = (now - start) / 1000;
    // Throttle to ~40fps for background-y shaders when reduced motion off is fine;
    // keep full rate but skip if tab hidden.
    if (document.hidden) return;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uTime, reduce ? 0.6 : t);
    gl.uniform1f(uEnter, reduce ? 1 : enter);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  raf = requestAnimationFrame(loop);
  // Render one static frame immediately for reduced motion users.
  if (reduce) {
    active = true;
  }

  return {
    destroy: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      const ext = gl.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    },
    setActive: (v: boolean) => {
      active = v;
    },
  };
}

/* ---- React hook: mount a shader, pause when offscreen ------------- */

function useShaderCanvas(frag: string) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const handle = runShader(canvas, frag);
    if (!handle) {
      setFailed(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => handle.setActive(entry.isIntersecting), {
      threshold: 0.05,
    });
    io.observe(canvas);
    return () => {
      io.disconnect();
      handle.destroy();
    };
  }, [frag]);

  return { ref, failed };
}

/* ---- Small building blocks --------------------------------------- */

function ShaderCard({
  frag,
  idx,
  name,
  desc,
}: {
  frag: string;
  idx: string;
  name: string;
  desc: string;
}) {
  const { ref, failed } = useShaderCanvas(frag);
  return (
    <article className="sx-shader sx-reveal sx-reveal--native" data-magnetic="soft">
      <canvas ref={ref} aria-hidden="true" />
      {failed && <div className="sx-shader__fallback" aria-hidden="true" />}
      <div className="sx-shader__meta">
        <span className="sx-shader__idx">{idx}</span>
        <span className="sx-shader__name">{name}</span>
        <span className="sx-shader__desc">{desc}</span>
      </div>
    </article>
  );
}

/* Animated count-up that runs once when scrolled into view. */
function Counter({
  to,
  suffix = '',
  decimals = 0,
}: {
  to: number;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.textContent = to.toFixed(decimals) + suffix;
      return;
    }
    let raf = 0;
    let started = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || started) return;
        started = true;
        const dur = 1600;
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = (to * eased).toFixed(decimals) + suffix;
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, suffix, decimals]);
  return (
    <span ref={ref} className="sx-metric__num">
      0{suffix}
    </span>
  );
}

/* ---- Page --------------------------------------------------------- */

const CAPABILITIES = [
  {
    icon: '◑',
    title: 'OKLCH + color-mix()',
    code: 'color-mix(in oklch, …)',
    body: 'Perceptually-uniform colour, mixed live in the browser. These swatches interpolate cyan→magenta in OKLCH — no banding, wide-gamut on capable displays.',
    kind: 'swatches' as const,
  },
  {
    icon: '⤢',
    title: 'Container Queries',
    code: '@container (min-width…)',
    body: 'Components respond to their own size, not the viewport. Drag the handle to resize the box below — the layout restyles itself past 260px.',
    kind: 'container' as const,
  },
  {
    icon: '◎',
    title: 'Scroll-Driven Animation',
    code: 'animation-timeline: view()',
    body: 'The progress rail at the top and every reveal on this page are driven by the scroll timeline directly in CSS — zero scroll listeners, running off the compositor.',
    kind: 'text' as const,
  },
  {
    icon: '⌾',
    title: ':has() Relational',
    code: '.card:has(:checked)',
    body: 'The parent restyles based on a descendant. Toggle the switch — this card reacts through the :has() selector with no JavaScript involved.',
    kind: 'has' as const,
  },
  {
    icon: '✦',
    title: '@property Gradients',
    code: '@property --angle',
    body: 'Registered custom properties are typed and therefore animatable. Hover any card — the conic border angle tweens because the browser knows it is an <angle>.',
    kind: 'text' as const,
  },
  {
    icon: '⬡',
    title: 'Raw WebGL2 / GLSL',
    code: '#version 300 es',
    body: 'Every moving surface above is a fragment shader compiled at runtime — domain-warped noise, raymarched SDFs and cellular fields, hand-written, no 3D library.',
    kind: 'text' as const,
  },
];

const SWATCH_STEPS = Array.from({ length: 8 }, (_, i) => {
  const pct = Math.round((i / 7) * 100);
  return `color-mix(in oklch, var(--magenta) ${pct}%, var(--cyan))`;
});

const TIMELINE = [
  {
    year: '2023',
    title: 'The container query era begins',
    desc: 'Components finally became responsive to their own context instead of the viewport, ending a decade of media-query gymnastics.',
    tags: ['@container', ':has()', 'cqi units'],
  },
  {
    year: '2024',
    title: 'Colour goes wide-gamut',
    desc: 'OKLCH, color-mix() and relative color syntax reached baseline. Design systems moved to perceptual colour spaces for accessible, gamut-safe palettes.',
    tags: ['oklch()', 'color-mix()', 'light-dark()'],
  },
  {
    year: '2025',
    title: 'Motion leaves the main thread',
    desc: 'Scroll-driven and view-transition APIs let rich motion run on the compositor. Cross-document view transitions made MPAs feel like SPAs.',
    tags: ['scroll()', 'view()', '@view-transition'],
  },
  {
    year: '2026',
    title: 'Layout gets anchored & typed',
    desc: 'Anchor positioning, @property everywhere and WebGPU compute in production put shader-grade visuals and tether-free tooltips within reach of every site.',
    tags: ['anchor()', 'WebGPU', '@property'],
  },
];

const TECH_MARQUEE = [
  'WebGL2',
  'GLSL',
  'OKLCH',
  'color-mix()',
  'Container Queries',
  ':has()',
  'Scroll-Driven Animation',
  'View Transitions',
  '@property',
  'Anchor Positioning',
  'WebGPU',
  'Subgrid',
];

const Showcase = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const hero = useShaderCanvas(HERO_FRAG);

  /* Custom cursor + magnetic + tilt + reveal fallback + hover detection */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;

    // --- Custom cursor (dot + trailing ring) ---
    let dot: HTMLDivElement | null = null;
    let ring: HTMLDivElement | null = null;
    let raf = 0;
    let removeCursorListeners: (() => void) | null = null;
    const pos = { x: innerWidth / 2, y: innerHeight / 2 };
    const ringPos = { x: pos.x, y: pos.y };

    if (fine) {
      dot = document.createElement('div');
      dot.className = 'sx-cursor';
      ring = document.createElement('div');
      ring.className = 'sx-cursor sx-cursor--ring';
      root.append(dot, ring);

      const onMove = (e: PointerEvent) => {
        pos.x = e.clientX;
        pos.y = e.clientY;
        if (dot) dot.style.translate = `${pos.x}px ${pos.y}px`;
      };
      const overInteractive = (e: PointerEvent) => {
        const t = e.target as HTMLElement;
        const hit = t.closest('a, button, input, label, [data-magnetic], .sx-shader, .sx-tilt');
        root.dataset.hovering = hit ? 'true' : 'false';
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerover', overInteractive, { passive: true });
      removeCursorListeners = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerover', overInteractive);
      };

      const trail = () => {
        raf = requestAnimationFrame(trail);
        ringPos.x += (pos.x - ringPos.x) * 0.18;
        ringPos.y += (pos.y - ringPos.y) * 0.18;
        if (ring) ring.style.translate = `${ringPos.x}px ${ringPos.y}px`;
      };
      trail();

      root.dataset.cursorInit = 'true';
    }

    // --- Magnetic buttons ---
    const magnets = Array.from(root.querySelectorAll<HTMLElement>('[data-magnetic]'));
    const magnetHandlers: Array<() => void> = [];
    if (fine && !reduce) {
      magnets.forEach((el) => {
        const strength = el.dataset.magnetic === 'soft' ? 0.12 : 0.32;
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const mx = e.clientX - (r.left + r.width / 2);
          const my = e.clientY - (r.top + r.height / 2);
          el.style.transform = `translate(${mx * strength}px, ${my * strength}px)`;
        };
        const leave = () => {
          el.style.transform = '';
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerleave', leave);
        magnetHandlers.push(() => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerleave', leave);
        });
      });
    }

    // --- 3D tilt + spotlight ---
    const tilts = Array.from(root.querySelectorAll<HTMLElement>('.sx-tilt'));
    const tiltHandlers: Array<() => void> = [];
    if (fine && !reduce) {
      tilts.forEach((el) => {
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          el.style.transform = `perspective(900px) rotateY(${(px - 0.5) * 12}deg) rotateX(${(0.5 - py) * 12}deg)`;
          el.style.setProperty('--mx', `${px * 100}%`);
          el.style.setProperty('--my', `${py * 100}%`);
        };
        const leave = () => {
          el.style.transform = '';
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerleave', leave);
        tiltHandlers.push(() => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerleave', leave);
        });
      });
    }

    // --- Reveal fallback (for engines without animation-timeline: view()) ---
    const supportsSDA = typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: view()');
    let revealIO: IntersectionObserver | null = null;
    if (!supportsSDA) {
      const reveals = root.querySelectorAll('.sx-reveal');
      revealIO = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('is-in');
              revealIO?.unobserve(e.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
      );
      reveals.forEach((r) => revealIO?.observe(r));
    }

    return () => {
      cancelAnimationFrame(raf);
      dot?.remove();
      ring?.remove();
      magnetHandlers.forEach((fn) => fn());
      tiltHandlers.forEach((fn) => fn());
      revealIO?.disconnect();
      removeCursorListeners?.();
      root.dataset.cursorInit = '';
    };
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="showcase-root" ref={rootRef}>
      <SEO
        title="The Living Canvas — Advanced Web Design Showcase"
        description="A single-page experience pushing the 2026 web platform to its limits: hand-written WebGL2 shaders, scroll-driven animations, container queries, OKLCH color and more."
        keywords="WebGL, GLSL shaders, scroll-driven animations, container queries, OKLCH, color-mix, advanced CSS, creative web design 2026"
        type="website"
      />

      <div className="sx-progress" aria-hidden="true" />
      <Link to="/" className="sx-back">
        ← Back to portfolio
      </Link>

      {/* ============================ HERO ============================ */}
      <header className="sx-hero">
        <canvas ref={hero.ref} className="sx-hero__canvas" aria-hidden="true" />
        <div className="sx-hero__grain" aria-hidden="true" />
        <div className="sx-hero__vignette" aria-hidden="true" />

        <div className="sx-shell sx-hero__inner">
          <span className="sx-badge">
            <span className="sx-badge__dot" />
            Built with the July 2026 web platform
          </span>

          <h1 className="sx-title">
            <span className="sx-title__line">
              <span className="sx-title__reveal">The Web Is</span>
            </span>
            <span className="sx-title__line">
              <span className="sx-title__reveal">
                <span className="sx-title__grad">a Living Canvas</span>
              </span>
            </span>
          </h1>

          <p className="sx-hero__sub">
            Real-time shaders, scroll-driven motion and perceptual colour — every pixel below is
            computed in your browser, right now, with no images and no 3D framework.
          </p>

          <div className="sx-hero__cta">
            <button className="sx-btn" data-magnetic="strong" onClick={() => scrollTo('gallery')}>
              <span className="sx-btn__sheen" />
              Explore the shaders
            </button>
            <button
              className="sx-btn sx-btn--ghost"
              data-magnetic="strong"
              onClick={() => scrollTo('capabilities')}
            >
              See the CSS ↓
            </button>
          </div>
        </div>

        <div className="sx-scrollcue" aria-hidden="true">
          <span>Scroll</span>
          <span className="sx-scrollcue__line" />
        </div>
      </header>

      {/* ========================= MARQUEE ========================= */}
      <div className="sx-marquee" aria-hidden="true">
        <div className="sx-marquee__track">
          {[...TECH_MARQUEE, ...TECH_MARQUEE].map((t, i) => (
            <span className="sx-marquee__item" key={i}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* ========================= GALLERY ========================= */}
      <section className="sx-section" id="gallery">
        <div className="sx-shell">
          <span className="sx-secnum" aria-hidden="true">
            01
          </span>
          <div className="sx-reveal sx-reveal--native">
            <span className="sx-eyebrow">Real-time GPU</span>
            <h2 className="sx-h2">Four shaders, zero images.</h2>
            <p className="sx-lead">
              Each panel is a WebGL2 fragment program compiled when the page loads. They react to
              your pointer, pause when scrolled out of view, and fall back gracefully when the GPU
              says no. Move your cursor across them.
            </p>
          </div>

          <div className="sx-gallery">
            <ShaderCard
              frag={HERO_FRAG}
              idx="S · 01"
              name="Domain-Warped Noise"
              desc="Two-pass fbm warping produces a flowing iridescent nebula."
            />
            <ShaderCard
              frag={SDF_FRAG}
              idx="S · 02"
              name="Raymarched SDF"
              desc="A signed-distance solid, lit and marched 80 steps per pixel."
            />
            <ShaderCard
              frag={VORONOI_FRAG}
              idx="S · 03"
              name="Cellular / Voronoi"
              desc="Animated nearest-point field with glowing cell nuclei."
            />
            <ShaderCard
              frag={TUNNEL_FRAG}
              idx="S · 04"
              name="Polar Plasma Tunnel"
              desc="Polar coordinates + noise bands create infinite depth."
            />
          </div>
        </div>
      </section>

      {/* ======================= CAPABILITIES ======================= */}
      <section className="sx-section" id="capabilities">
        <div className="sx-shell">
          <span className="sx-secnum" aria-hidden="true">
            02
          </span>
          <div className="sx-reveal sx-reveal--native">
            <span className="sx-eyebrow">The 2026 CSS toolbox</span>
            <h2 className="sx-h2">Interfaces that style themselves.</h2>
            <p className="sx-lead">
              Modern CSS handles logic that used to demand JavaScript — relational selectors,
              self-aware components, typed animatable properties and perceptual colour. Poke the
              live demos below.
            </p>
          </div>

          <div className="sx-features">
            {CAPABILITIES.map((cap, i) => (
              <article className="sx-card sx-reveal sx-reveal--native" key={i}>
                <div className="sx-card__icon" aria-hidden="true">
                  {cap.icon}
                </div>
                <h3 className="sx-card__title">{cap.title}</h3>
                <code className="sx-card__code">{cap.code}</code>
                <p className="sx-card__body">{cap.body}</p>

                {cap.kind === 'swatches' && (
                  <div className="sx-demo sx-swatches" aria-hidden="true">
                    {SWATCH_STEPS.map((bg, s) => (
                      <i key={s} style={{ background: bg }} />
                    ))}
                  </div>
                )}

                {cap.kind === 'container' && (
                  <div className="sx-demo sx-cq">
                    <div className="sx-cq__inner">
                      <span className="sx-cq__dot" />
                      <span className="sx-cq__txt">
                        <b>Resize me →</b>
                      </span>
                    </div>
                  </div>
                )}

                {cap.kind === 'has' && (
                  <>
                    <input
                      type="checkbox"
                      className="sx-toggle"
                      id={`toggle-${i}`}
                      defaultChecked
                    />
                    <label className="sx-toggle-label" htmlFor={`toggle-${i}`}>
                      <span className="sx-switch" />
                      Toggle — watch the border react
                    </label>
                  </>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ========================= METRICS ========================= */}
      <section className="sx-section">
        <div className="sx-shell">
          <div className="sx-reveal sx-reveal--native">
            <span className="sx-eyebrow">Rendered live</span>
            <h2 className="sx-h2">Numbers that count themselves up.</h2>
          </div>
          <div className="sx-metrics">
            <div className="sx-metric sx-reveal sx-reveal--native">
              <Counter to={5} />
              <div className="sx-metric__label">
                WebGL2 shader programs compiled in-browser at load
              </div>
            </div>
            <div className="sx-metric sx-reveal sx-reveal--native">
              <Counter to={60} suffix="fps" />
              <div className="sx-metric__label">
                Target frame rate, driven on the compositor thread
              </div>
            </div>
            <div className="sx-metric sx-reveal sx-reveal--native">
              <Counter to={0} suffix=" kb" />
              <div className="sx-metric__label">Raster images used for any visual on this page</div>
            </div>
            <div className="sx-metric sx-reveal sx-reveal--native">
              <Counter to={100} suffix="%" />
              <div className="sx-metric__label">Motion respects prefers-reduced-motion</div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================= TIMELINE ======================== */}
      <section className="sx-section">
        <div className="sx-shell">
          <span className="sx-secnum" aria-hidden="true">
            03
          </span>
          <div className="sx-reveal sx-reveal--native">
            <span className="sx-eyebrow">How we got here</span>
            <h2 className="sx-h2">Four years that rebuilt the front end.</h2>
            <p className="sx-lead">
              The techniques on this page did not exist as baseline a few years ago. Here is the
              short history of the platform capabilities powering it.
            </p>
          </div>

          <div className="sx-timeline">
            {TIMELINE.map((t) => (
              <div className="sx-tl sx-reveal sx-reveal--native" key={t.year}>
                <div className="sx-tl__year">{t.year}</div>
                <div>
                  <h3 className="sx-tl__title">{t.title}</h3>
                  <p className="sx-tl__desc">{t.desc}</p>
                  <div className="sx-tl__tags">
                    {t.tags.map((tag) => (
                      <span className="sx-chip" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================== TILT =========================== */}
      <section className="sx-section">
        <div className="sx-shell">
          <div className="sx-reveal sx-reveal--native">
            <span className="sx-eyebrow">Tactile depth</span>
            <h2 className="sx-h2">Surfaces that respond to you.</h2>
            <p className="sx-lead">
              Pointer-driven 3D tilt and a spotlight that tracks the cursor — built from CSS
              transforms and a radial gradient anchored to pointer coordinates. Hover the panels.
            </p>
          </div>
          <div className="sx-gallery" style={{ marginTop: '2.5rem' }}>
            <div className="sx-tilt sx-reveal sx-reveal--native">
              <div className="sx-tilt__inner">
                <h3 className="sx-card__title">Compositor-first</h3>
                <p className="sx-card__body">
                  Transforms, opacity and filters animate off the main thread, so scrolling stays
                  smooth even while four shaders render.
                </p>
              </div>
            </div>
            <div className="sx-tilt sx-reveal sx-reveal--native">
              <div className="sx-tilt__inner">
                <h3 className="sx-card__title">Progressive by design</h3>
                <p className="sx-card__body">
                  Every advanced feature is wrapped in @supports or a JS fallback. Older engines get
                  a clean, static, fully-readable page.
                </p>
              </div>
            </div>
            <div className="sx-tilt sx-reveal sx-reveal--native">
              <div className="sx-tilt__inner">
                <h3 className="sx-card__title">Accessible motion</h3>
                <p className="sx-card__body">
                  A single prefers-reduced-motion query calms every animation, freezes the shaders
                  and turns off the counters.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================== CTA =========================== */}
      <section className="sx-section">
        <div className="sx-shell">
          <div className="sx-cta-final sx-reveal sx-reveal--native">
            <span className="sx-eyebrow" style={{ justifyContent: 'center' }}>
              Made by hand
            </span>
            <h2 className="sx-h2" style={{ maxWidth: '18ch', margin: '0 auto 1rem' }}>
              This is what the browser can do in 2026.
            </h2>
            <p className="sx-lead" style={{ margin: '0 auto 2rem' }}>
              No canvas library, no image assets, no build-time magic — just the open web platform
              pushed to its edges.
            </p>
            <div className="sx-hero__cta" style={{ opacity: 1, animation: 'none' }}>
              <Link className="sx-btn" to="/projects" data-magnetic="strong">
                <span className="sx-btn__sheen" />
                View more work
              </Link>
              <Link className="sx-btn sx-btn--ghost" to="/connect" data-magnetic="strong">
                Get in touch
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="sx-footer">
        <div className="sx-shell">
          <p>
            Crafted with WebGL2, GLSL and the modern CSS platform.
            <br />
            Part of the <Link to="/">Dan Pearson portfolio</Link> · Best viewed in a current
            Chromium, Firefox or Safari.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Showcase;
