import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const baseNavLinks = [
  { name: 'Home', href: '/' },
  { name: 'News', href: '/news' },
  { name: 'Store', href: '/store' },
  { name: 'Staff', href: '/staff' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        const { data } = await supabase
          .from('profiles')
          .select('rank')
          .eq('id', session.user.id)
          .single();
        setProfile(data);
      }
    };
    fetchAuth();
  }, []);

  const isStaff = profile?.rank && profile.rank !== 'Player';

  const navLinks = [...baseNavLinks];
  if (!isStaff) {
    navLinks.push({ name: 'Apply', href: '/apply' });
  } else {
    // Insert map right before 'Staff' tab for staff members
    navLinks.splice(3, 0, { name: 'Map', href: '/map' });
  }

  return (
    <nav className="fixed w-full z-50 bg-black/80 backdrop-blur-md border-b-4 border-mc-btn-bottom">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex-shrink-0 flex items-center gap-3 hover:opacity-80 transition-opacity">
            {/* Custom Generated Logo */}
            <img src="/logo.png" alt="JustLoofy Logo" className="w-12 h-12 object-contain" />
            <span className="font-minecraft text-xl md:text-2xl text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">
              JustLoofy
            </span>
          </Link>
          
          <div className="hidden lg:block">
            <div className="ml-10 flex items-baseline space-x-2">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className={link.name === 'Apply' ? 'mc-button mc-button-primary' : 'mc-button'}
                >
                  {link.name}
                </Link>
              ))}
              <Link to={user ? "/profile" : "/login"} className="mc-button !bg-[#1E1E1E] border-2 border-mc-btn-face text-[#FFAA00] hover:!bg-[#2a2a2a]">
                {user ? "Profile" : "Login"}
              </Link>
            </div>
          </div>
          
          <div className="lg:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="mc-button !px-3 !py-2"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-[#1a1a1a] border-b-4 border-mc-btn-bottom overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-6 flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`mc-button w-full ${link.name === 'Apply' ? 'mc-button-primary' : ''}`}
                >
                  {link.name}
                </Link>
              ))}
              <div className="h-1 border-t-2 border-[#333] my-2"></div>
              <Link
                to={user ? "/profile" : "/login"}
                onClick={() => setIsOpen(false)}
                className="mc-button w-full !bg-[#2a2a2a] border-2 border-[#555] text-[#FFAA00]"
              >
                {user ? "Manage Profile" : "Account Login"}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
