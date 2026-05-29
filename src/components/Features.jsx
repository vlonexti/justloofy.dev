import { motion } from 'framer-motion';
import { Sword, Shield, Pickaxe, Zap, Gem, Users } from 'lucide-react';

const features = [
  {
    title: 'Custom Survival',
    description: 'A deeply enhanced survival experience with custom biomes, structures, and unique challenges that stay true to the vanilla feel.',
    icon: Pickaxe,
    color: '#5B8731' // Grass green
  },
  {
    title: 'Anti-Griefing',
    description: 'State-of-the-art land claiming and rollback systems to ensure your builds are always safe from malicious players.',
    icon: Shield,
    color: '#866043' // Dirt brown
  },
  {
    title: 'PvP Arenas',
    description: 'Test your skills in our custom-built arenas. Weekly tournaments with exclusive cosmetic rewards.',
    icon: Sword,
    color: '#AA0000' // Red
  },
  {
    title: 'Economy System',
    description: 'Player-driven economy with dynamic pricing, player shops, and an auction house to trade your hard-earned loot.',
    icon: Gem,
    color: '#55FFFF' // Diamond/Aqua
  },
  {
    title: 'Lag-Free Experience',
    description: 'Running on top-tier dedicated hardware with heavily optimized custom server software for 20 TPS gameplay.',
    icon: Zap,
    color: '#FFAA00' // Gold
  },
  {
    title: 'Active Community',
    description: 'Join a welcoming and mature community. Regular events, active Discord, and responsive staff team.',
    icon: Users,
    color: '#FF55FF' // Pink/Magenta
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 100
    }
  }
};

export default function Features() {
  return (
    <section id="about" className="py-24 relative bg-[#1a1a1a] border-t-4 border-[#3a3a3a]">
      {/* Subtle texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAiLz4KPC9zdmc+')" }}></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-minecraft text-3xl md:text-5xl text-white drop-shadow-[3px_3px_0_rgba(0,0,0,1)] mb-4"
          >
            SERVER FEATURES
          </motion.h2>
          <motion.div 
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="h-1 w-24 bg-mc-grass mx-auto border border-black"
          />
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              variants={itemVariants}
              className="mc-panel group hover:-translate-y-2 transition-transform duration-300"
            >
              <div 
                className="w-14 h-14 flex items-center justify-center border-2 border-black mb-6"
                style={{ 
                  backgroundColor: feature.color,
                  boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,0.3)'
                }}
              >
                <feature.icon className="text-white drop-shadow-md" size={28} />
              </div>
              
              <h3 className="font-minecraft text-xl text-white mb-3 drop-shadow-[2px_2px_0_rgba(0,0,0,1)] group-hover:text-[#A8A8A8] transition-colors">
                {feature.title}
              </h3>
              
              <p className="text-gray-400 leading-relaxed font-sans">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
