import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

const ranks = [
  {
    name: 'VIP',
    price: '$4.99',
    color: '#55FF55', // Light Green
    perks: ['Green Chat Color', 'Fly in Hub', '/enderchest command', 'Priority Queue'],
    stripeLink: 'https://buy.stripe.com/4gM5kFgePauOaKy1cy6EU02'
  },
  {
    name: 'MVP',
    price: '$14.99',
    color: '#55FFFF', // Aqua
    perks: ['All VIP Perks', 'Nick command', 'Custom Pets', '3x Coin Multiplier', '/feed command'],
    stripeLink: 'https://buy.stripe.com/eVqeVf8Mn8mGdWKf3o6EU01'
  },
  {
    name: 'PRO',
    price: '$29.99',
    color: '#FF55FF', // Pink
    perks: ['All MVP Perks', 'Golden Chat Name', '/heal command', 'Access to Beta Features', 'Custom join message'],
    stripeLink: 'https://buy.stripe.com/8x24gBaUv6ey8Cq7AW6EU00'
  }
];

const rankWeights = {
  'Player': 0,
  'Linked': 1,
  'VIP': 2,
  'MVP': 3,
  'PRO': 4,
  'Moderator': 5,
  'Admin': 6,
  'Owner': 7
};

export default function Store() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        const { data } = await supabase
          .from('profiles')
          .select('minecraft_username, discord_username')
          .eq('id', session.user.id)
          .single();
        setProfile(data);
      }
      setLoading(false);
    };
    fetchAuth();
  }, []);

  const canPurchase = profile?.minecraft_username && profile?.discord_username;

  return (
    <div className="pt-32 pb-20 min-h-screen px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-minecraft text-4xl md:text-5xl text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] mb-4 flex items-center justify-center gap-4"
        >
          <ShoppingCart size={40} className="text-mc-grass" />
          SERVER STORE
        </motion.h1>
        <p className="text-xl text-gray-400 font-sans mb-4">Support the server and get awesome perks!</p>
        
        {!loading && !user && (
          <div className="inline-block bg-[#AA0000]/20 border-2 border-[#AA0000] p-4 text-white font-sans rounded">
            You must <Link to="/login" className="underline font-bold text-[#FFAA00]">log in</Link> to purchase ranks.
          </div>
        )}
        
        {!loading && user && !canPurchase && (
          <div className="inline-block bg-[#FFAA00]/20 border-2 border-[#FFAA00] p-4 text-white font-sans rounded">
            Please <Link to="/profile" className="underline font-bold text-mc-grass">link your Minecraft and Discord</Link> before purchasing.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {ranks.map((rank, idx) => (
          <motion.div 
            key={rank.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="mc-panel flex flex-col items-center group hover:scale-105 transition-transform"
          >
            <h2 
              className="font-minecraft text-3xl drop-shadow-[2px_2px_0_rgba(0,0,0,1)] mb-2"
              style={{ color: rank.color }}
            >
              {rank.name}
            </h2>
            <div className="text-2xl text-white font-sans font-bold mb-6">{rank.price}</div>
            
            <ul className="text-gray-300 font-sans space-y-3 mb-8 w-full">
              {rank.perks.map((perk, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-mc-grass">✓</span> {perk}
                </li>
              ))}
            </ul>
            
            <div className="mt-auto w-full">
              {!user ? (
                <Link to="/login" className="mc-button mc-button-primary w-full text-center block opacity-50 cursor-not-allowed">
                  Login Required
                </Link>
              ) : !canPurchase ? (
                <Link to="/profile" className="mc-button mc-button-primary w-full text-center block">
                  Link Accounts
                </Link>
              ) : rankWeights[profile?.rank || 'Player'] >= rankWeights[rank.name] ? (
                <div className="mc-button w-full text-center block !bg-[#333] !text-[#888] cursor-not-allowed">
                  Already Owned
                </div>
              ) : (
                <a 
                  href={`${rank.stripeLink}?client_reference_id=${user.id}`}
                  target="_blank" 
                  rel="noreferrer"
                  className="mc-button mc-button-primary w-full text-center block hover:!bg-[#55FF55] hover:text-black"
                >
                  Buy Now
                </a>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
