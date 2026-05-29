import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Map as MapIcon, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Map() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const mapUrl = "http://150.136.49.99:8100/";

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/');
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('rank')
        .eq('id', session.user.id)
        .single();

      if (!data || data.rank === 'Player') {
        navigate('/');
      } else {
        setLoading(false);
      }
    };

    checkAccess();
  }, [navigate]);

  if (loading) return <div className="pt-32 min-h-screen text-center text-white font-minecraft">Checking permissions...</div>;

  return (
    <div className="pt-24 pb-6 min-h-screen px-2 sm:px-4 lg:px-6 w-full flex flex-col">
      <div className="flex flex-col md:flex-row items-center justify-between mb-4 mt-2">
        <div>
          <h1 className="font-minecraft text-4xl text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] mb-2 flex items-center gap-4">
            <MapIcon size={32} className="text-mc-grass" />
            LIVE SERVER MAP
          </h1>
          <p className="text-gray-400 font-sans">
            Explore the JustLoofy Network in real-time from your browser.
          </p>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex-1 w-full min-h-[75vh] border-4 border-black bg-black rounded shadow-2xl overflow-hidden relative group"
      >
        <iframe 
          src={mapUrl} 
          title="Minecraft Live Map"
          className="w-full h-full border-0 absolute inset-0"
          allowFullScreen
        ></iframe>
      </motion.div>
    </div>
  );
}
