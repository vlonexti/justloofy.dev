import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { LogOut, User, Settings, Shield, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ minecraft_username: '', discord_username: '', rank: 'Player' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('account');

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }
      setUser(session.user);

      const { data } = await supabase
        .from('profiles')
        .select('minecraft_username, discord_username, rank')
        .eq('id', session.user.id)
        .single();
        
      if (data) {
        setProfile({
          minecraft_username: data.minecraft_username || '',
          discord_username: data.discord_username || '',
          rank: data.rank || 'Player'
        });
      }
      setLoading(false);
    };

    fetchProfile();
  }, []);

  const handleSaveAccounts = async (e) => {
    e.preventDefault();
    setMessage('Saving & Verifying...');
    
    // Verify Minecraft Username
    if (profile.minecraft_username) {
      try {
        const res = await fetch(`https://playerdb.co/api/player/minecraft/${profile.minecraft_username}`);
        if (!res.ok) throw new Error('Invalid Premium Minecraft Username');
        const data = await res.json();
        if (!data.success) throw new Error('Invalid Premium Minecraft Username');
        
        // Ensure no one else has this username
        const { data: existingUser } = await supabase.from('profiles').select('id').or(`minecraft_username.ilike.${profile.minecraft_username},username.ilike.${profile.minecraft_username}`).neq('id', user.id).maybeSingle();
        if (existingUser) {
          setMessage('Error: That Minecraft username is already claimed by someone else!');
          return;
        }
      } catch (err) {
        setMessage('Error: ' + err.message);
        return;
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        username: profile.minecraft_username,
        minecraft_username: profile.minecraft_username,
        discord_username: profile.discord_username
      })
      .eq('id', user.id);

    if (error) {
      setMessage('Error updating profile: ' + error.message);
    } else {
      setMessage('Accounts linked successfully! Discord bot will sync your roles shortly.');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
    window.location.reload();
  };

  if (loading) return <div className="pt-32 min-h-screen text-center text-white font-minecraft">Loading Profile...</div>;

  return (
    <div className="pt-32 pb-20 min-h-screen px-4 max-w-5xl mx-auto flex flex-col md:flex-row gap-8">
      {/* Sidebar Navigation */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="w-full md:w-64 space-y-2">
        <div className="mc-panel mb-4 text-center">
          <div className="w-20 h-20 mx-auto bg-[#1a1a1a] border-2 border-[#3a3a3a] mb-4 overflow-hidden shadow-inner">
            <img 
              src={`https://minotar.net/helm/${profile.minecraft_username || 'steve'}/100.png`} 
              alt="Avatar" 
              className="w-full h-full object-cover image-rendering-pixelated"
            />
          </div>
          <h2 className="font-minecraft text-white drop-shadow-md truncate">{user.user_metadata?.username || 'Player'}</h2>
          <span className="text-[#FFAA00] font-sans text-sm font-bold tracking-widest uppercase">[{profile.rank}]</span>
        </div>

        <button onClick={() => setActiveTab('account')} className={`w-full text-left px-4 py-3 font-minecraft text-sm flex items-center gap-3 transition-colors ${activeTab === 'account' ? 'bg-[#3c8527] text-white border-2 border-black' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#333]'}`}>
          <User size={18} /> Accounts
        </button>
        <button onClick={() => setActiveTab('preferences')} className={`w-full text-left px-4 py-3 font-minecraft text-sm flex items-center gap-3 transition-colors ${activeTab === 'preferences' ? 'bg-[#3c8527] text-white border-2 border-black' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#333]'}`}>
          <Settings size={18} /> Preferences
        </button>
        <button onClick={() => setActiveTab('notifications')} className={`w-full text-left px-4 py-3 font-minecraft text-sm flex items-center gap-3 transition-colors ${activeTab === 'notifications' ? 'bg-[#3c8527] text-white border-2 border-black' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#333]'}`}>
          <Bell size={18} /> Alerts
        </button>
        <button onClick={() => setActiveTab('security')} className={`w-full text-left px-4 py-3 font-minecraft text-sm flex items-center gap-3 transition-colors ${activeTab === 'security' ? 'bg-[#3c8527] text-white border-2 border-black' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#333]'}`}>
          <Shield size={18} /> Security
        </button>
        
        <button onClick={handleLogout} className="w-full mt-8 text-left px-4 py-3 font-minecraft text-sm flex items-center gap-3 bg-[#aa0000] hover:bg-[#ff5555] text-white border-2 border-black transition-colors">
          <LogOut size={18} /> LOG OUT
        </button>
      </motion.div>

      {/* Main Content Area */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 mc-panel">
        
        {activeTab === 'account' && (
          <div>
            <h1 className="font-minecraft text-3xl text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] mb-6">LINK ACCOUNTS</h1>
            <p className="text-gray-400 font-sans mb-8 leading-relaxed">
              Link your game accounts to sync your purchases, forum ranks, and server roles. The Discord bot will automatically assign your Linked and Staff roles within 5 minutes of saving!
            </p>

            <form onSubmit={handleSaveAccounts} className="space-y-6 max-w-md">
              <div>
                <label className="block text-gray-300 font-minecraft text-sm mb-2">Minecraft Username</label>
                <input 
                  required
                  type="text"
                  value={profile.minecraft_username}
                  onChange={(e) => setProfile({ ...profile, minecraft_username: e.target.value })}
                  className="w-full bg-[#111] border-2 border-[#3a3a3a] text-white p-3 font-sans focus:outline-none focus:border-mc-grass" 
                  placeholder="Notch"
                />
              </div>
              <div>
                <label className="block text-gray-300 font-minecraft text-sm mb-2">Discord Username</label>
                <input 
                  required
                  type="text"
                  value={profile.discord_username}
                  onChange={(e) => setProfile({ ...profile, discord_username: e.target.value })}
                  className="w-full bg-[#111] border-2 border-[#3a3a3a] text-white p-3 font-sans focus:outline-none focus:border-mc-grass" 
                  placeholder="username#0000"
                />
              </div>
              
              {message && <p className="text-mc-grass font-sans font-bold text-sm bg-mc-grass/10 p-3 border border-mc-grass">{message}</p>}

              <button type="submit" className="mc-button mc-button-primary">
                Save Accounts
              </button>
            </form>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div>
            <h1 className="font-minecraft text-3xl text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] mb-6">PREFERENCES</h1>
            <div className="space-y-6 max-w-md">
              <div>
                <label className="block text-gray-300 font-minecraft text-sm mb-2">Site Theme</label>
                <select className="w-full bg-[#111] border-2 border-[#3a3a3a] text-white p-3 font-sans focus:outline-none">
                  <option>Dark Mode (Default)</option>
                  <option>Light Mode (Coming Soon)</option>
                  <option>Nether Mode</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-300 font-minecraft text-sm mb-2">Language</label>
                <select className="w-full bg-[#111] border-2 border-[#3a3a3a] text-white p-3 font-sans focus:outline-none">
                  <option>English (US)</option>
                  <option>Spanish</option>
                  <option>French</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div>
            <h1 className="font-minecraft text-3xl text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] mb-6">NOTIFICATIONS</h1>
            <div className="space-y-4">
              <label className="flex items-center gap-3 text-gray-300 font-sans cursor-pointer">
                <input type="checkbox" defaultChecked className="w-5 h-5 accent-mc-grass" />
                Receive emails for Store purchases
              </label>
              <label className="flex items-center gap-3 text-gray-300 font-sans cursor-pointer">
                <input type="checkbox" defaultChecked className="w-5 h-5 accent-mc-grass" />
                Notify me on Discord for Application updates
              </label>
              <label className="flex items-center gap-3 text-gray-300 font-sans cursor-pointer">
                <input type="checkbox" className="w-5 h-5 accent-mc-grass" />
                Subscribe to Server Newsletter
              </label>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div>
            <h1 className="font-minecraft text-3xl text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] mb-6">SECURITY</h1>
            <div className="space-y-6 max-w-md">
              <button className="mc-button mt-4">
                Reset Password
              </button>
              <div className="pt-8 mt-8 border-t border-[#333]">
                <h3 className="text-mc-red font-minecraft text-sm mb-2">Danger Zone</h3>
                <button className="mc-button bg-[#aa0000] hover:bg-[#ff5555]">
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}

      </motion.div>
    </div>
  );
}
