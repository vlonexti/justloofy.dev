import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color } from 'three';
import { Environment, Fog } from '@react-three/drei';

const Terrain = () => {
  const meshRef = useRef();
  const gridSize = 60; // 60x60 blocks
  
  // Create a 3D object to help calculate positions
  const dummy = useMemo(() => new Object3D(), []);
  
  // Pre-calculate positions and colors
  const { positions, colors } = useMemo(() => {
    const pos = [];
    const cols = [];
    const colorObj = new Color();
    
    for (let x = -gridSize / 2; x < gridSize / 2; x++) {
      for (let z = -gridSize / 2; z < gridSize / 2; z++) {
        // Generate rolling hills using sine waves
        const height = Math.floor(
          Math.sin(x / 8) * 3 + 
          Math.cos(z / 10) * 4 + 
          Math.sin((x + z) / 15) * 2
        );
        
        // Push the top block (Grass)
        pos.push({ x, y: height, z });
        
        // Randomize grass color slightly for a stylized look
        const r = 0.2 + Math.random() * 0.05;
        const g = 0.6 + Math.random() * 0.1;
        const b = 0.2 + Math.random() * 0.05;
        colorObj.setRGB(r, g, b);
        cols.push(colorObj.clone());
        
        // Push a couple of dirt blocks underneath so there are no holes when looking from angles
        for (let dy = 1; dy <= 2; dy++) {
          pos.push({ x, y: height - dy, z });
          colorObj.setHex(0x5A3A22); // Dirt color
          cols.push(colorObj.clone());
        }
      }
    }
    return { positions: pos, colors: cols };
  }, [gridSize]);

  // Update instance matrices once after the mesh is mounted
  useEffect(() => {
    if (!meshRef.current) return;
    positions.forEach((pos, i) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, colors[i]);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [dummy, positions, colors]);

  // Slowly move the entire terrain to simulate flying
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.z = (state.clock.elapsedTime * 2) % 1;
    }
  });

  return (
    <instancedMesh 
      ref={meshRef} 
      args={[null, null, positions.length]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
};

const CameraRig = () => {
  useFrame((state) => {
    // Slowly orbit camera
    const t = state.clock.elapsedTime * 0.1;
    state.camera.position.x = Math.sin(t) * 15;
    state.camera.position.z = Math.cos(t) * 15;
    state.camera.position.y = 8 + Math.sin(t * 2) * 2;
    state.camera.lookAt(0, 0, 0);
  });
  return null;
};

export default function VoxelBackground() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
      <Canvas shadows camera={{ position: [0, 10, 20], fov: 60 }}>
        <fog attach="fog" args={['#000000', 10, 40]} />
        <ambientLight intensity={0.2} />
        <directionalLight 
          position={[50, 50, 20]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={[2048, 2048]} 
        />
        <pointLight position={[-10, 10, -10]} intensity={0.5} color="#55FFFF" />
        
        <Terrain />
        <CameraRig />
      </Canvas>
      
      {/* Dark overlay to ensure text is highly readable */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none"></div>
    </div>
  );
}
