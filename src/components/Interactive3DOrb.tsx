import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Plain three.js, no react-three-fiber. R3F pulled react-reconciler, fiber and
// three-stdlib into three-vendor and registered the whole THREE namespace, so
// nothing in three could tree-shake. The scene below matches the R3F version:
// same counts, colors, sizes, speeds, camera, controls, tone mapping and
// pointer repulsion.

const CAMERA_FOV = 60;
const CAMERA_DISTANCE = 8;
const NETWORK_RADIUS = 5;
const CONNECTION_DISTANCE_SQ = 1.5 * 1.5;
const MAX_DPR = 2;

interface Particle {
  position: Vector3;
  velocity: Vector3;
}

/** Background stars: a slow-turning shell of cyan, purple and white points. */
function createStars(count: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = [new Color('#00d4ff'), new Color('#8a2be2'), new Color('#ffffff')];

  for (let i = 0; i < count; i++) {
    const r = 12 + Math.random() * 10;
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const color = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  const material = new PointsMaterial({
    size: 0.05,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
    blending: AdditiveBlending,
  });
  return { points: new Points(geometry, material), geometry, material };
}

/** Drifting network nodes plus the lines drawn between nearby pairs. */
function createNetwork(count: number, radius: number) {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      position: new Vector3(
        (Math.random() - 0.5) * radius * 2,
        (Math.random() - 0.5) * radius * 2,
        (Math.random() - 0.5) * radius * 2
      ),
      velocity: new Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      ),
    });
  }

  // Node colors never change; only positions are rewritten each frame.
  const nodeColors = new Float32Array(count * 3);
  const cyan = new Color('#00d4ff');
  const coral = new Color('#ff7f50');
  for (let i = 0; i < count; i++) {
    const c = i % 2 === 0 ? cyan : coral;
    nodeColors[i * 3] = c.r;
    nodeColors[i * 3 + 1] = c.g;
    nodeColors[i * 3 + 2] = c.b;
  }
  const pointGeometry = new BufferGeometry();
  const nodePositions = new BufferAttribute(new Float32Array(count * 3), 3);
  nodePositions.setUsage(DynamicDrawUsage);
  pointGeometry.setAttribute('position', nodePositions);
  pointGeometry.setAttribute('color', new BufferAttribute(nodeColors, 3));

  const maxFloats = ((count * (count - 1)) / 2) * 6;
  const lineGeometry = new BufferGeometry();
  const linePositions = new BufferAttribute(new Float32Array(maxFloats), 3);
  const lineColors = new BufferAttribute(new Float32Array(maxFloats), 3);
  linePositions.setUsage(DynamicDrawUsage);
  lineColors.setUsage(DynamicDrawUsage);
  lineGeometry.setAttribute('position', linePositions);
  lineGeometry.setAttribute('color', lineColors);
  lineGeometry.setDrawRange(0, 0);

  const pointMaterial = new PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
    blending: AdditiveBlending,
  });
  const lineMaterial = new LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.4,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  const points = new Points(pointGeometry, pointMaterial);
  const lines = new LineSegments(lineGeometry, lineMaterial);
  // Both geometries change every frame, so a bounding sphere computed once
  // would be stale. The whole network always sits inside the view anyway.
  points.frustumCulled = false;
  lines.frustumCulled = false;

  const repulsion = new Vector3();

  /** Advance one frame. pointer is in the same units as particle positions. */
  const step = (time: number, pointer: Vector3) => {
    const positions = nodePositions.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const p = particles[i].position;
      p.add(particles[i].velocity);

      if (p.lengthSq() > radius * radius) {
        particles[i].velocity.multiplyScalar(-1);
      }

      if (p.distanceToSquared(pointer) < 9) {
        repulsion.subVectors(p, pointer).normalize().multiplyScalar(0.05);
        p.add(repulsion);
      }

      p.y += Math.sin(time + p.x) * 0.002;

      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }
    nodePositions.needsUpdate = true;

    const linePos = linePositions.array as Float32Array;
    const lineCol = lineColors.array as Float32Array;
    let vertCount = 0;
    for (let i = 0; i < count; i++) {
      const a = particles[i].position;
      for (let j = i + 1; j < count; j++) {
        const b = particles[j].position;
        if (a.distanceToSquared(b) < CONNECTION_DISTANCE_SQ) {
          const idx = vertCount * 3;
          linePos[idx] = a.x;
          linePos[idx + 1] = a.y;
          linePos[idx + 2] = a.z;
          linePos[idx + 3] = b.x;
          linePos[idx + 4] = b.y;
          linePos[idx + 5] = b.z;

          lineCol[idx] = nodeColors[i * 3];
          lineCol[idx + 1] = nodeColors[i * 3 + 1];
          lineCol[idx + 2] = nodeColors[i * 3 + 2];
          lineCol[idx + 3] = nodeColors[j * 3];
          lineCol[idx + 4] = nodeColors[j * 3 + 1];
          lineCol[idx + 5] = nodeColors[j * 3 + 2];

          vertCount += 2;
        }
      }
    }

    // Upload only the used prefix of the line buffers.
    const usedFloats = vertCount * 3;
    linePositions.clearUpdateRanges();
    lineColors.clearUpdateRanges();
    if (usedFloats > 0) {
      linePositions.addUpdateRange(0, usedFloats);
      lineColors.addUpdateRange(0, usedFloats);
      linePositions.needsUpdate = true;
      lineColors.needsUpdate = true;
    }
    lineGeometry.setDrawRange(0, vertCount);
  };

  return {
    points,
    lines,
    step,
    dispose: () => {
      pointGeometry.dispose();
      lineGeometry.dispose();
      pointMaterial.dispose();
      lineMaterial.dispose();
    },
  };
}

interface Interactive3DOrbProps {
  width?: string;
  height?: string;
  className?: string;
  /** Number of background stars (default: adaptive based on device) */
  starCount?: number;
  /** Number of network nodes (default: adaptive based on device) */
  nodeCount?: number;
  /** Stop the render loop (hero off-screen or tab hidden). */
  paused?: boolean;
}

interface NavigatorHints {
  connection?: { saveData?: boolean; effectiveType?: string };
  deviceMemory?: number;
}

/**
 * Gets adaptive particle counts based on device capabilities.
 * Called once on mount to avoid re-renders.
 */
function getAdaptiveSettings(): { stars: number; nodes: number; dpr: [number, number] } {
  if (typeof window === 'undefined') {
    return { stars: 800, nodes: 60, dpr: [1, 1.5] };
  }

  const hints = navigator as Navigator & NavigatorHints;
  const connection = hints.connection;
  const deviceMemory = hints.deviceMemory ?? 8;
  const cpuCores = navigator.hardwareConcurrency ?? 4;
  const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSlowConnection =
    connection?.saveData ||
    connection?.effectiveType === 'slow-2g' ||
    connection?.effectiveType === '2g';

  // Low performance: minimal particles
  if (prefersReducedMotion || isSlowConnection || cpuCores <= 2 || deviceMemory < 4) {
    return { stars: 300, nodes: 25, dpr: [1, 1] };
  }

  // Mobile: reduced particles
  if (isMobile) {
    return { stars: 500, nodes: 40, dpr: [1, 1.5] };
  }

  // Mid-range: moderate particles
  if (cpuCores <= 4 || deviceMemory < 8) {
    return { stars: 800, nodes: 60, dpr: [1, 1.5] };
  }

  // High-end: full particles
  return { stars: 1200, nodes: 80, dpr: [1, 2] };
}

export const Interactive3DOrb: React.FC<Interactive3DOrbProps> = ({
  width = '100%',
  height = '100%',
  className = '',
  starCount,
  nodeCount,
  paused = false,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Bumped after a lost WebGL context is restored, which rebuilds the scene on
  // a fresh canvas.
  const [generation, setGeneration] = useState(0);

  const pausedRef = useRef(paused);
  const syncLoopRef = useRef<() => void>(() => {});

  const adaptiveSettings = useMemo(() => getAdaptiveSettings(), []);
  const finalStarCount = starCount ?? adaptiveSettings.stars;
  const finalNodeCount = nodeCount ?? adaptiveSettings.nodes;
  const [minDpr, maxDpr] = adaptiveSettings.dpr;

  useEffect(() => {
    pausedRef.current = paused;
    syncLoopRef.current();
  }, [paused]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas,
        antialias: !maxDpr || maxDpr <= 1.5,
        alpha: true,
        powerPreference: 'low-power',
        failIfMajorPerformanceCaveat: true,
      });
    } catch {
      // No usable WebGL (or only a slow software fallback): leave the
      // background empty rather than burn the CPU.
      return;
    }
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 0);

    const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.1, 1000);
    camera.position.set(0, 0, CAMERA_DISTANCE);
    camera.lookAt(0, 0, 0);

    const scene = new Scene();
    const group = new Group();
    group.rotation.set(0, 0, Math.PI / 4);
    scene.add(group);

    const network = createNetwork(finalNodeCount, NETWORK_RADIUS);
    const stars = createStars(finalStarCount);
    group.add(network.points, network.lines, stars.points);

    const controls = new OrbitControls(camera, wrapper);
    controls.enableDamping = true;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableRotate = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.maxPolarAngle = Math.PI;
    controls.minPolarAngle = 0;

    // Pointer in normalized device coordinates, centered until the first move.
    const pointerNdc = { x: 0, y: 0 };
    const pointerWorld = new Vector3();
    const viewport = { width: 1, height: 1 };

    const resize = () => {
      const w = wrapper.clientWidth;
      const h = wrapper.clientHeight;
      if (w === 0 || h === 0) return;
      const dpr = Math.min(Math.max(minDpr, window.devicePixelRatio || 1), maxDpr, MAX_DPR);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Visible world size at the orbit target, used to map the pointer.
      const distance = camera.position.length();
      viewport.height = 2 * Math.tan(MathUtils.degToRad(CAMERA_FOV / 2)) * distance;
      viewport.width = viewport.height * camera.aspect;
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = wrapper.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const start = performance.now();
    const renderFrame = () => {
      const time = (performance.now() - start) / 1000;
      controls.update();
      pointerWorld.set(
        (pointerNdc.x * viewport.width) / 2,
        (pointerNdc.y * viewport.height) / 2,
        0
      );
      network.step(time, pointerWorld);
      stars.points.rotation.y = time * 0.05;
      renderer.render(scene, camera);
    };

    let frameId: number | null = null;
    let onScreen = true;
    let contextLost = false;
    const tick = () => {
      frameId = requestAnimationFrame(tick);
      renderFrame();
    };
    const syncLoop = () => {
      const shouldRun = !pausedRef.current && !document.hidden && onScreen && !contextLost;
      if (shouldRun && frameId === null) {
        frameId = requestAnimationFrame(tick);
      } else if (!shouldRun && frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };
    syncLoopRef.current = syncLoop;

    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      syncLoop();
    };
    const onContextRestored = () => setGeneration((g) => g + 1);

    resize();
    renderFrame();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
    resizeObserver?.observe(wrapper);
    const intersectionObserver =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            syncLoop();
          })
        : null;
    intersectionObserver?.observe(wrapper);
    document.addEventListener('visibilitychange', syncLoop);
    wrapper.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    syncLoop();

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      syncLoopRef.current = () => {};
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener('visibilitychange', syncLoop);
      wrapper.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      network.dispose();
      stars.geometry.dispose();
      stars.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [generation, finalStarCount, finalNodeCount, minDpr, maxDpr]);

  return (
    <div className={`${className} opacity-100`} style={{ width, height }}>
      <div ref={wrapperRef} className="relative h-full w-full overflow-hidden">
        <canvas key={generation} ref={canvasRef} className="block h-full w-full" />
      </div>
    </div>
  );
};
