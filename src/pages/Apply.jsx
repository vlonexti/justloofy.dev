import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

export default function Apply() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    age: '',
    experience: '',
    reason: ''
  });
  const [status, setStatus] = useState('');

  useEffect(() => {
    const fetchAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        const { data } = await supabase
          .from('profiles')
          .select('discord_username, minecraft_username')
          .eq('id', session.user.id)
          .single();
        setProfile(data);
      }
      setLoading(false);
    };
    fetchAuth();
  }, []);

  const canApply = profile?.discord_username && profile?.minecraft_username;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Submitting...');
    
    const { error } = await supabase
      .from('applications')
      .insert([
        {
          user_id: user.id,
          discord_username: profile.discord_username,
          minecraft_username: profile.minecraft_username,
          age: parseInt(formData.age, 10),
          experience: formData.experience,
          reason: formData.reason
        }
      ]);

    if (error) {
      setStatus('Error: ' + error.message);
    } else {
      setStatus('Success! Application submitted.');
      setFormData({ age: '', experience: '', reason: '' });
    }
  };

  return (
    <div className="pt-32 pb-20 min-h-screen px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-minecraft text-4xl text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] mb-4"
        >
          STAFF APPLICATION
        </motion.h1>
        <p className="text-xl text-gray-400 font-sans">
          Join the team and help keep the server safe!
        </p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mc-panel"
      >
        {!loading && !user ? (
          <div className="text-center py-10">
            <h2 className="font-minecraft text-xl text-mc-grass mb-4">Login Required</h2>
            <p className="text-gray-300 font-sans mb-6">You must be logged in to apply for a staff position.</p>
            <Link to="/login" className="mc-button mc-button-primary">Log In Now</Link>
          </div>
        ) : !loading && !canApply ? (
          <div className="text-center py-10">
            <h2 className="font-minecraft text-xl text-[#FFAA00] mb-4">Accounts Not Linked</h2>
            <p className="text-gray-300 font-sans mb-6">You must link your Discord and Minecraft accounts before applying.</p>
            <Link to="/profile" className="mc-button mc-button-primary">Link Accounts</Link>
          </div>
        ) : !loading && canApply ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="bg-[#1E1E1E] border-l-4 border-[#FFAA00] p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-[#FFAA00] mt-1 shrink-0" size={24} />
                <div>
                  <h3 className="font-minecraft text-sm text-[#FFAA00] mb-1">IMPORTANT</h3>
                  <p className="text-sm font-sans text-gray-300 leading-relaxed">
                    Once submitted, our Discord bot will automatically create a ticket for your application. <strong>You MUST join our Discord server to view your application status and communicate with admins!</strong>
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-gray-300 font-minecraft text-sm mb-2">Age</label>
              <input 
                required
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({...formData, age: e.target.value})}
                className="w-full bg-[#111] border-2 border-[#3a3a3a] text-white p-3 font-sans focus:outline-none focus:border-mc-grass" 
                placeholder="How old are you?"
              />
            </div>
            
            <div>
              <label className="block text-gray-300 font-minecraft text-sm mb-2">Experience</label>
              <textarea 
                required
                value={formData.experience}
                onChange={(e) => setFormData({...formData, experience: e.target.value})}
                className="w-full h-32 bg-[#111] border-2 border-[#3a3a3a] text-white p-3 font-sans focus:outline-none focus:border-mc-grass resize-none" 
                placeholder="Have you been staff anywhere else? What did you do?"
              ></textarea>
            </div>
            
            <div>
              <label className="block text-gray-300 font-minecraft text-sm mb-2">Why should we pick you?</label>
              <textarea 
                required
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                className="w-full h-32 bg-[#111] border-2 border-[#3a3a3a] text-white p-3 font-sans focus:outline-none focus:border-mc-grass resize-none" 
                placeholder="Tell us what you can bring to the team."
              ></textarea>
            </div>
            
            {status && (
              <div className={`p-3 font-sans text-center ${status.includes('Error') ? 'text-mc-red' : 'text-mc-grass'}`}>
                {status}
              </div>
            )}

            <button type="submit" className="mc-button mc-button-primary w-full flex justify-center items-center gap-2">
              <Send size={20} /> Submit Application
            </button>
          </form>
        ) : (
          <div className="text-center font-minecraft text-white py-10">Checking permissions...</div>
        )}
      </motion.div>
    </div>
  );
}
