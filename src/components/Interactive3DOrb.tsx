import React, { useRef, useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// --- Background Stars (High count, simple behavior) ---
const BackgroundStars = ({ count = 2000 }) => {
  const mesh = useRef<THREE.Points>(null);
  
  const [positions, colors] = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const colorPalette = [
      new THREE.Color('#00d4ff'), // Cyan
      new THREE.Color('#8a2be2'), // Purple
      new THREE.Color('#ffffff'), // White
    ];

    for (let i = 0; i < count; i++) {
      // Sphere distribution
      const r = 12 + Math.random() * 10; // Larger radius for background
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    return [positions, colors];
  }, [count]);

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.y = state.clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// --- Network/Constellation System (Lower count, connections) ---
const NetworkSystem = ({ count = 150, radius = 4 }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const { mouse, viewport } = useThree();

  // Generate initial positions and velocities
  const [particles] = useMemo(() => {
    const p = new Array(count).fill(0).map(() => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * radius * 2,
        (Math.random() - 0.5) * radius * 2,
        (Math.random() - 0.5) * radius * 2
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      ),
      originalPos: new THREE.Vector3(), // To tether them if needed, but free floating is cool too
    }));
    
    // Store original positions for tethering
    p.forEach(part => part.originalPos.copy(part.position));

    return [p];
  }, [count, radius]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    // Mouse interaction
    const mouseX = (mouse.x * viewport.width) / 2;
    const mouseY = (mouse.y * viewport.height) / 2;
    const mousePos = new THREE.Vector3(mouseX, mouseY, 0);

    // Update particle positions
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color1 = new THREE.Color('#00d4ff'); // Cyan
    const color2 = new THREE.Color('#ff7f50'); // Orange

    particles.forEach((particle, i) => {
      // Move
      particle.position.add(particle.velocity);

      // Tether/Boundary check (soft bounce)
      if (particle.position.distanceTo(new THREE.Vector3(0,0,0)) > radius) {
        particle.velocity.multiplyScalar(-1);
      }
      
      // Mouse repulsion/attraction
      const distToMouse = particle.position.distanceTo(mousePos);
      if (distToMouse < 3) {
        const repulsion = new THREE.Vector3().subVectors(particle.position, mousePos).normalize().multiplyScalar(0.05);
        particle.position.add(repulsion);
      }

      // Gentle sine wave float
      particle.position.y += Math.sin(time + particle.position.x) * 0.002;

      positions[i * 3] = particle.position.x;
      positions[i * 3 + 1] = particle.position.y;
      positions[i * 3 + 2] = particle.position.z;

      // Color based on position or index
      const mixedColor = i % 2 === 0 ? color1 : color2;
      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    });

    if (pointsRef.current) {
      pointsRef.current.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      pointsRef.current.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.geometry.attributes.color.needsUpdate = true;
    }

    // Update Lines
    const linePositions = [];
    const lineColors = [];
    const connectionDistance = 1.5;

    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dist = particles[i].position.distanceTo(particles[j].position);
        
        if (dist < connectionDistance) {
          linePositions.push(
            particles[i].position.x, particles[i].position.y, particles[i].position.z,
            particles[j].position.x, particles[j].position.y, particles[j].position.z
          );

          // Use a mix of the particle colors
          lineColors.push(
            colors[i*3], colors[i*3+1], colors[i*3+2], // Start color
            colors[j*3], colors[j*3+1], colors[j*3+2]  // End color
          );
        }
      }
    }

    if (linesRef.current) {
      linesRef.current.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      linesRef.current.geometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
    }
  });

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry />
        <pointsMaterial
          size={0.15}
          vertexColors
          transparent
          opacity={0.9}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry />
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </>
  );
};

interface Interactive3DOrbProps {
  width?: string;
  height?: string;
  className?: string;
}

export const Interactive3DOrb: React.FC<Interactive3DOrbProps> = ({
  width = "100%",
  height = "100%",
  className = ""
}) => {
  const [contextLost, setContextLost] = useState(false);
  const [key, setKey] = useState(0);

  // Handle WebGL context loss - this can happen when GPU resources are exhausted
  // or when the browser tab loses focus/visibility
  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    const canvas = gl.domElement;
    
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.debug('[3DOrb] WebGL context lost, will attempt recovery');
      setContextLost(true);
    };
    
    const handleContextRestored = () => {
      console.debug('[3DOrb] WebGL context restored');
      setContextLost(false);
      // Force remount by changing key
      setKey(prev => prev + 1);
    };
    
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, []);

  // Don't render while context is lost
  if (contextLost) {
    return (
      <div className={`${className} opacity-100`} style={{ width, height }}>
        {/* Empty placeholder during context recovery */}
      </div>
    );
  }

  return (
    <div className={`${className} opacity-100`} style={{ width, height }}>
      <Canvas
        key={key}
        camera={{ position: [0, 0, 8], fov: 60 }}
        style={{ background: 'transparent' }}
        dpr={[1, 2]}
        gl={{ 
          antialias: true, 
          alpha: true,
          // Improve context stability
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false
        }}
        onCreated={handleCreated}
      >
        <ambientLight intensity={0.5} />
        
        <group rotation={[0, 0, Math.PI / 4]}>
            <NetworkSystem count={100} radius={5} />
            <BackgroundStars count={1500} />
        </group>
        
        <OrbitControls 
          enableZoom={false}
          enablePan={false}
          enableRotate={true}
          autoRotate={true}
          autoRotateSpeed={0.5}
          maxPolarAngle={Math.PI}
          minPolarAngle={0}
        />
      </Canvas>
    </div>
  );
};