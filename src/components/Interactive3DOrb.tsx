import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface ParticleSystemProps {
  count?: number;
  radius?: number;
  color?: string;
}

const ParticleSystem: React.FC<ParticleSystemProps> = ({ 
  count = 2000, 
  radius = 2,
  color = '#00bfff'
}) => {
  const mesh = useRef<THREE.Points>(null);
  const { mouse, viewport } = useThree();
  
  // Generate particle positions in a sphere
  const [positions, originalPositions] = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const originalPositions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      // Generate points on a sphere surface with some randomness
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      
      // Add some randomness for organic look
      const r = radius + (Math.random() - 0.5) * 0.5;
      
      const x = r * Math.cos(theta) * Math.sin(phi);
      const y = r * Math.sin(theta) * Math.sin(phi);
      const z = r * Math.cos(phi);
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      
      originalPositions[i * 3] = x;
      originalPositions[i * 3 + 1] = y;
      originalPositions[i * 3 + 2] = z;
    }
    
    return [positions, originalPositions];
  }, [count, radius]);

  // Animation and mouse interaction
  useFrame((state) => {
    if (!mesh.current) return;
    
    const time = state.clock.getElapsedTime();
    const positions = mesh.current.geometry.attributes.position.array as Float32Array;
    
    // Mouse interaction force
    const mouseX = (mouse.x * viewport.width) / 2;
    const mouseY = (mouse.y * viewport.height) / 2;
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      
      // Original position
      const originalX = originalPositions[i3];
      const originalY = originalPositions[i3 + 1];
      const originalZ = originalPositions[i3 + 2];
      
      // Add gentle floating animation
      const floatX = originalX + Math.sin(time + i * 0.01) * 0.1;
      const floatY = originalY + Math.cos(time + i * 0.01) * 0.1;
      const floatZ = originalZ + Math.sin(time * 0.5 + i * 0.02) * 0.2;
      
      // Mouse interaction - create displacement field
      const mouseDistance = Math.sqrt(
        Math.pow(floatX - mouseX, 2) + 
        Math.pow(floatY - mouseY, 2)
      );
      
      const mouseForce = Math.max(0, 2 - mouseDistance);
      const displaceX = (floatX - mouseX) * mouseForce * 0.1;
      const displaceY = (floatY - mouseY) * mouseForce * 0.1;
      const displaceZ = floatZ + mouseForce * 0.2;
      
      positions[i3] = floatX + displaceX;
      positions[i3 + 1] = floatY + displaceY;
      positions[i3 + 2] = displaceZ;
    }
    
    mesh.current.geometry.attributes.position.needsUpdate = true;
    
    // Gentle rotation
    mesh.current.rotation.y += 0.002;
    mesh.current.rotation.x += 0.001;
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
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color={color}
        transparent
        opacity={1}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
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
  return (
    <div className={`${className}`} style={{ width, height }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        style={{ background: 'transparent' }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
        {/* Main particle system */}
        <ParticleSystem count={3000} radius={2} color="#00d4ff" />
        
        {/* Inner core particles */}
        <ParticleSystem count={800} radius={1.2} color="#40e0ff" />
        
        {/* Outer shell particles */}
        <ParticleSystem count={1200} radius={2.8} color="#0099cc" />
        
        <OrbitControls 
          enableZoom={false}
          enablePan={false}
          enableRotate={true}
          autoRotate={true}
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
};