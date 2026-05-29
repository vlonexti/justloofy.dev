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
        className="flex-1 w-full min-h-[60vh] border-4 border-black bg-[#1e1e1e] flex flex-col items-center justify-center p-8 text-center shadow-2xl relative"
      >
        <div className="absolute inset-0 opacity-10 bg-[url('https://minecraft.wiki/images/Stone_Bricks.png')] bg-repeat" style={{ backgroundSize: '64px 64px' }}></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="bg-red-500/20 text-red-400 p-4 border-2 border-red-500 mb-8 max-w-lg font-sans text-sm">
            <h3 className="font-minecraft text-red-500 text-lg mb-2 uppercase flex items-center justify-center gap-2">
              <Info size={18} /> Browser Security Notice
            </h3>
            <p>Your browser automatically blocks embedding the Live Map directly on this page because the website is secured with <strong>HTTPS</strong>, but your Minecraft server map uses <strong>HTTP</strong>.</p>
            <p className="mt-2">To view the map safely, click the button below to open it in a new tab!</p>
          </div>

          <a 
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="mc-button mc-button-primary text-xl px-12 py-6 animate-pulse hover:animate-none"
          >
            <MapIcon className="inline-block mr-3" size={28} />
            OPEN LIVE MAP IN NEW TAB
          </a>
        </div>
      </motion.div>
    </div>
  );
}
