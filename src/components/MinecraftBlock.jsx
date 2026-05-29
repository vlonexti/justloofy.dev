import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges, useTexture } from '@react-three/drei';
import * as THREE from 'three';

export default function MinecraftBlock() {
  const meshRef = useRef();
  const [hovered, setHover] = useState(false);

  // Load real Minecraft Diamond Ore texture
  const diamondOre = useTexture('https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19.3/assets/minecraft/textures/block/diamond_ore.png');

  // Set texture filtering to NearestFilter for the pixelated look
  diamondOre.magFilter = THREE.NearestFilter;
  diamondOre.minFilter = THREE.NearestFilter;
  diamondOre.generateMipmaps = false;
  diamondOre.colorSpace = THREE.SRGBColorSpace;

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
      
      // Scale up slightly on hover
      const targetScale = hovered ? 1.1 : 1.0;
      meshRef.current.scale.x += (targetScale - meshRef.current.scale.x) * 0.1;
      meshRef.current.scale.y += (targetScale - meshRef.current.scale.y) * 0.1;
      meshRef.current.scale.z += (targetScale - meshRef.current.scale.z) * 0.1;
    }
  });

  return (
    <mesh
      ref={meshRef}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      rotation={[0.5, Math.PI / 4, 0]}
    >
      <boxGeometry args={[2.5, 2.5, 2.5]} />
      {/* Right, Left, Top, Bottom, Front, Back */}
      <meshStandardMaterial attach="material-0" map={diamondOre} roughness={0.8} />
      <meshStandardMaterial attach="material-1" map={diamondOre} roughness={0.8} />
      <meshStandardMaterial attach="material-2" map={diamondOre} roughness={0.8} />
      <meshStandardMaterial attach="material-3" map={diamondOre} roughness={0.8} />
      <meshStandardMaterial attach="material-4" map={diamondOre} roughness={0.8} />
      <meshStandardMaterial attach="material-5" map={diamondOre} roughness={0.8} />
      <Edges scale={1.001} threshold={15} color="black" />
    </mesh>
  );
}
