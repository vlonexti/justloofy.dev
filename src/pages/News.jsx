import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Calendar, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function News() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePost, setActivePost] = useState(null);

  useEffect(() => {
    const fetchNews = async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (data && data.length > 0) {
        setAnnouncements(data);
      }
      setLoading(false);
    };
    
    fetchNews();
  }, []);

  return (
    <div className="pt-32 pb-20 min-h-screen px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between mb-12">
        <div>
          <h1 className="font-minecraft text-4xl text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] mb-2 flex items-center gap-4">
            <Megaphone size={32} className="text-mc-grass" />
            SERVER NEWS
          </h1>
          <p className="text-gray-400 font-sans">Official announcements synced directly from Discord.</p>
        </div>
        
        <div className="mt-6 md:mt-0">
          <a href="https://discord.gg/ehrVgxYSat" target="_blank" rel="noreferrer" className="mc-button mc-button-primary">
            Join our Discord
          </a>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-white font-minecraft">Loading news...</div>
      ) : announcements.length === 0 ? (
        <div className="text-center text-gray-400 font-sans mt-20">
          <div className="text-6xl mb-4 opacity-30">📰</div>
          <h2 className="text-2xl font-minecraft text-white mb-2">No News Yet</h2>
          <p>Check back later for updates and announcements from the team!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {announcements.map((post, idx) => (
            <motion.div 
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => setActivePost(post)}
              className="bg-[#1e1e1e] border-2 border-black flex flex-col hover:border-mc-grass transition-colors group cursor-pointer"
            >
              <div className="h-48 w-full bg-cover bg-center border-b-2 border-black overflow-hidden relative" style={{ backgroundImage: `url('${post.image_url || `https://picsum.photos/seed/${post.id || idx}/600/300`}')` }}>
                <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors"></div>
                <div className="absolute bottom-2 left-2 bg-[#FFAA00] text-black font-minecraft text-xs px-2 py-1 uppercase">
                  Server News
                </div>
              </div>
              
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center justify-between text-gray-400 text-xs font-sans mb-3 uppercase tracking-wider font-bold">
                  <span>{new Date(post.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  <span className="flex items-center gap-1"><Calendar size={14} /> By {post.author}</span>
                </div>
                
                <h2 className="font-minecraft text-xl text-white mb-3 group-hover:text-mc-grass transition-colors">
                  {post.title}
                </h2>
                
                <div className="text-gray-300 font-sans text-sm leading-relaxed mb-6 line-clamp-3">
                  {post.content}
                </div>
                
                <div className="mt-auto pt-4 border-t border-[#333]">
                  <span className="text-mc-grass font-minecraft text-sm group-hover:underline uppercase">Read More &rarr;</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Full Post Modal */}
      <AnimatePresence>
        {activePost && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setActivePost(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1e1e1e] border-4 border-black max-w-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col relative"
            >
              <button 
                onClick={() => setActivePost(null)}
                className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-red-600 text-white p-2 rounded transition-colors"
              >
                <X size={24} />
              </button>

              <div className="h-64 sm:h-80 w-full bg-cover bg-center border-b-4 border-black" style={{ backgroundImage: `url('${activePost.image_url || `https://picsum.photos/seed/${activePost.id}/800/400`}')` }}>
              </div>
              
              <div className="p-8">
                <div className="flex items-center gap-4 text-mc-grass text-sm font-sans mb-4 uppercase tracking-wider font-bold">
                  <span>{new Date(activePost.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  <span className="flex items-center gap-1"><Calendar size={14} /> By {activePost.author}</span>
                </div>
                
                <h1 className="font-minecraft text-3xl sm:text-4xl text-white mb-8 drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">
                  {activePost.title}
                </h1>
                
                <div className="text-gray-200 font-sans text-lg leading-relaxed whitespace-pre-wrap">
                  {activePost.content}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
