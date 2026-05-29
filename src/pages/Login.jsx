import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';

export default function Login() {
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setMessage('Processing...');
    try {
      const pseudoEmail = `${username.toLowerCase()}@justloofy.local`;

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: pseudoEmail, password });
        if (error) throw error;
        setMessage('Successfully logged in!');
      } else {
        // Check if username is taken in database
        setMessage('Checking username availability...');
        const { data: existingUser } = await supabase.from('profiles').select('id').or(`minecraft_username.ilike.${username},username.ilike.${username}`).maybeSingle();
        if (existingUser) {
          setMessage('That Minecraft username is already registered on this site!');
          return;
        }

        // Verify Minecraft Username before signing up
        setMessage('Verifying Minecraft Username...');
        try {
          const res = await fetch(`https://playerdb.co/api/player/minecraft/${username}`);
          if (!res.ok) {
            throw new Error('Minecraft username not found. Please enter a valid premium Minecraft username.');
          }
          const data = await res.json();
          if (!data.success) {
            throw new Error('Minecraft username not found.');
          }
        } catch (err) {
          setMessage(err.message || 'Error verifying Minecraft username.');
          return;
        }

        setMessage('Username verified! Creating account...');
        
        const { error, data } = await supabase.auth.signUp({ 
          email: pseudoEmail, 
          password,
          options: {
            data: { 
              username: username,
              minecraft_username: username 
            }
          }
        });
        if (error) throw error;
        
        // Also manually update the profile immediately just in case the trigger only sets `username`
        if (data.user) {
          await supabase.from('profiles').update({ minecraft_username: username }).eq('id', data.user.id);
        }

        setMessage('Account created successfully! You are now logged in.');
      }
    } catch (error) {
      setMessage(error.message || 'An error occurred.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMessage('Logged out.');
  };

  if (user) {
    return (
      <div className="pt-32 pb-20 min-h-screen px-4 max-w-lg mx-auto flex flex-col justify-center text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mc-panel">
          <h1 className="font-minecraft text-3xl text-mc-grass mb-4 drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">LOGGED IN</h1>
          <p className="text-gray-300 font-sans mb-8">Welcome back, {user.user_metadata?.username}!</p>
          <div className="flex flex-col gap-4">
            <a href="/profile" className="mc-button mc-button-primary">Manage Profile</a>
            <button onClick={handleLogout} className="mc-button bg-[#AA0000] hover:bg-[#ff3333]">Logout</button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 min-h-screen px-4 sm:px-6 lg:px-8 max-w-lg mx-auto flex flex-col justify-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mc-panel">
        <h1 className="font-minecraft text-3xl text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] mb-6 text-center">
          {isLogin ? 'ACCOUNT LOGIN' : 'CREATE ACCOUNT'}
        </h1>
        
        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label className="block text-gray-300 font-minecraft text-sm mb-2">Minecraft Username</label>
            <input 
              required
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#111] border-2 border-[#3a3a3a] text-white p-3 font-sans focus:outline-none focus:border-mc-grass" 
              placeholder="Notch"
            />
          </div>
          <div>
            <label className="block text-gray-300 font-minecraft text-sm mb-2">Password</label>
            <input 
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#111] border-2 border-[#3a3a3a] text-white p-3 font-sans focus:outline-none focus:border-mc-grass" 
              placeholder="********"
            />
          </div>
          
          {message && <p className="text-mc-grass font-sans text-center text-sm">{message}</p>}

          <button type="submit" className="mc-button mc-button-primary w-full">
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
          
          <div className="text-center mt-4">
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-gray-400 font-sans hover:text-white underline text-sm">
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
