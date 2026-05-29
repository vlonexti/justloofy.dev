import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Copy, Check, Users } from 'lucide-react';
import MinecraftBlock from './MinecraftBlock';

export default function Hero() {
  const [copied, setCopied] = useState(false);
  const [playerCount, setPlayerCount] = useState(null);
  const displayIp = 'play.justloofy.dev';
  const copyIp = 'play.justloofy.dev:25565';

  useEffect(() => {
    // Fetch player count
    const fetchStatus = async () => {
      try {
        const res = await fetch(`https://api.mcsrvstat.us/3/${copyIp}`);
        const data = await res.json();
        if (data.online) {
          setPlayerCount(data.players.online);
        } else {
          setPlayerCount(0);
        }
      } catch (err) {
        console.error('Failed to fetch player count:', err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(copyIp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden bg-mc-dark">
      
      {/* Background Parallax Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-10 w-32 h-32 bg-mc-grass/10 blur-3xl rounded-full" />
        <div className="absolute bottom-1/4 right-10 w-48 h-48 bg-mc-dirt/20 blur-3xl rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* Left Column: Text & CTAs */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
          className="text-center lg:text-left space-y-8"
        >
          <div className="space-y-4">
            <h1 className="font-minecraft text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white drop-shadow-[4px_4px_0_rgba(0,0,0,1)] leading-tight">
              JUSTLOOFY
              <br />
              <span className="text-mc-grass drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">NETWORK</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto lg:mx-0 drop-shadow-md">
              Experience the next generation of Minecraft survival and custom minigames. 
              Join thousands of players in an epic adventure!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <div className="relative">
              <button 
                onClick={handleCopy}
                className="mc-button mc-button-primary group"
              >
                <div className="flex items-center gap-2">
                  {copied ? <Check size={20} className="text-[#55FF55]" /> : <Copy size={20} />}
                  <span className={copied ? "text-[#55FF55]" : ""}>
                    {copied ? 'COPIED TO CLIPBOARD' : displayIp}
                  </span>
                </div>
              </button>
              
              {/* Tooltip */}
              <AnimatePresence>
                {copied && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: -45, scale: 1 }}
                    exit={{ opacity: 0, y: 0, scale: 0.8 }}
                    className="absolute top-0 left-1/2 -translate-x-1/2 px-3 py-1 bg-black text-white text-xs font-minecraft border-2 border-[#3a3a3a] rounded whitespace-nowrap"
                  >
                    IP COPIED!
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <a href="#about" className="mc-button">
              Learn More
            </a>
          </div>

          {/* Player Count */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center lg:justify-start gap-2 text-gray-300"
          >
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border border-black"></span>
            </div>
            <Users size={18} className="text-green-400" />
            <span className="font-mono font-bold text-white drop-shadow-md">
              {playerCount !== null ? playerCount.toLocaleString() : 'Loading...'} 
            </span>
            <span>players online</span>
          </motion.div>
        </motion.div>

        {/* Right Column: 3D Block */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, y: [0, -15, 0] }}
          transition={{ 
            duration: 1, 
            delay: 0.2, 
            y: {
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }
          }}
          className="h-[400px] md:h-[500px] w-full relative drop-shadow-[0_20px_50px_rgba(91,135,49,0.2)]"
        >
          <Canvas camera={{ position: [5, 5, 5], fov: 45 }}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
            <directionalLight position={[-10, -10, -5]} intensity={0.5} />
            <MinecraftBlock />
            <OrbitControls enableZoom={false} autoRotate={true} autoRotateSpeed={2} />
            <Environment preset="city" />
          </Canvas>
        </motion.div>

      </div>
    </div>
  );
}
