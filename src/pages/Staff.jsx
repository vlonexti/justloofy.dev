import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

const roleColors = {
  'Owner': '#AA0000',
  'Admin': '#FFAA00',
  'Mod': '#55FF55',
  'Developer': '#55FFFF'
};

// Define sorting hierarchy (lower number = higher up)
const roleHierarchy = {
  'Owner': 1,
  'Admin': 2,
  'Developer': 3,
  'Mod': 4,
  'Player': 99
};

export default function Staff() {
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStaff = async () => {
      // Fetch staff from Supabase profiles where rank is not 'Player'
      const { data, error } = await supabase
        .from('profiles')
        .select('username, minecraft_username, rank')
        .neq('rank', 'Player');
        
      if (data && data.length > 0) {
        const resolvedStaff = data.map((member) => {
          // Use minecraft_username if available, otherwise fallback to web username
          const mcName = member.minecraft_username || member.username;
          return {
            name: member.username,
            minecraftName: mcName,
            role: member.rank,
            color: roleColors[member.rank] || '#55FFFF',
            sortOrder: roleHierarchy[member.rank] || 50
          };
        });

        // Sort by role hierarchy
        resolvedStaff.sort((a, b) => a.sortOrder - b.sortOrder);
        setStaffMembers(resolvedStaff);
      } else {
        // Fallback for demonstration if database is empty
        setStaffMembers([
          { name: 'JustLoofy', minecraftName: 'Notch', role: 'Owner', color: '#AA0000', sortOrder: 1 }
        ]);
      }
      setLoading(false);
    };
    
    loadStaff();
  }, []);

  return (
    <div className="pt-32 pb-20 min-h-screen px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="font-minecraft text-4xl md:text-5xl text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] mb-4"
        >
          MEET THE TEAM
        </motion.h1>
        <p className="text-xl text-gray-400 font-sans">The dedicated people keeping the server running.</p>
      </div>

      {loading ? (
        <div className="text-center text-white font-minecraft">Loading Staff...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {staffMembers.map((staff, idx) => (
            <motion.div 
              key={staff.name}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 50, delay: idx * 0.15 }}
              viewport={{ once: true, margin: "-50px" }}
              className="flex flex-col items-center"
            >
              <div className="relative mb-6 group cursor-pointer">
                <div className="absolute inset-0 bg-mc-grass/20 blur-xl rounded-full scale-50 group-hover:scale-110 transition-transform duration-500"></div>
                {/* Minotar supports fetching 3D bodies directly by username! */}
                <img 
                  src={`https://minotar.net/armor/body/${staff.minecraftName}/300.png`} 
                  alt={`${staff.name} 3D Model`}
                  className="h-64 object-contain relative z-10 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] group-hover:-translate-y-4 transition-transform duration-300 image-rendering-pixelated"
                />
              </div>

              <div className="mc-panel w-full text-center hover:scale-105 transition-transform">
                <h2 className="font-minecraft text-2xl text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] mb-2">
                  {staff.name}
                </h2>
                <div 
                  className="font-minecraft text-sm tracking-widest drop-shadow-[1px_1px_0_rgba(0,0,0,1)]"
                  style={{ color: staff.color }}
                >
                  [{staff.role.toUpperCase()}]
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
