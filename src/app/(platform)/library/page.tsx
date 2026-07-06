'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { FolderHeart, Sparkles, Tv, Clock, Eye, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface LibraryMovie {
  id: string;
  movie_id: string;
  movie_title: string;
  poster_path: string;
  media_type: string;
  status: 'watched' | 'watching' | 'watchlist';
}

export default function LibraryPage() {
  const router = useRouter();
  const [library, setLibrary] = useState<LibraryMovie[]>([]);
  const [loading, setLoading] = useState(true);

  // Active viewing filter tab
  const [activeSection, setActiveSection] = useState<'all' | 'watched' | 'watching' | 'watchlist'>('all');

  useEffect(() => {
    const fetchLibrary = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('library')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setLibrary(data);
      }
      setLoading(false);
    };

    fetchLibrary();
  }, []);

  const handleUpdateStatus = async (id: string, status: LibraryMovie['status']) => {
    try {
      await supabase
        .from('library')
        .update({ status })
        .eq('id', id);

      setLibrary((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status } : m))
      );
    } catch (err) {
      console.warn('Update library status error:', err);
    }
  };

  const handleRemoveFromLibrary = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await supabase
        .from('library')
        .delete()
        .eq('id', id);

      setLibrary((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.warn('Remove library error:', err);
    }
  };

  const sections = [
    { id: 'all', name: 'الكل' },
    { id: 'watched', name: 'شوهد سابقاً' },
    { id: 'watching', name: 'أشاهد حالياً' },
    { id: 'watchlist', name: 'المشاهدة لاحقاً' },
  ] as const;

  const filteredLibrary = library.filter((m) => activeSection === 'all' || m.status === activeSection);

  return (
    <div className="flex flex-col gap-8 text-right pb-10 max-w-5xl mx-auto">
      
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center border-b border-white/5 pb-4"
      >
        <span className="text-xs text-shasha-secondary font-semibold">صنف ونظم مكتبتك الفنية الشخصية</span>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          مكتبتي
          <FolderHeart className="w-5.5 h-5.5 text-shasha-accent" />
        </h1>
      </motion.div>

      {/* Filter Section Tabs */}
      <div className="flex items-center justify-end gap-2 overflow-x-auto w-full border-b border-white/[0.04] pb-3">
        {sections.map((sec) => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
              activeSection === sec.id
                ? 'bg-shasha-accent text-white shadow-md'
                : 'bg-white/3 border border-white/5 text-shasha-secondary hover:bg-white/5 hover:text-white'
            }`}
          >
            {sec.name}
          </button>
        ))}
      </div>

      {/* Library Grid Content */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-full aspect-[2/3] rounded-2xl bg-white/3 animate-pulse" />
          ))}
        </div>
      ) : filteredLibrary.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          <AnimatePresence mode="popLayout">
            {filteredLibrary.map((movie) => {
              const statusName =
                movie.status === 'watched'
                  ? 'تمت مشاهدته'
                  : movie.status === 'watching'
                  ? 'أشاهده حالياً'
                  : 'المشاهدة لاحقاً';

              return (
                <motion.div
                  key={movie.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => router.push(`/explore?movieId=${movie.movie_id}`)}
                  className="flex flex-col gap-2.5 group cursor-pointer relative bg-white/2 p-3 rounded-2xl border border-white/5 hover:bg-white/4"
                >
                  <div className="aspect-[2/3] rounded-xl overflow-hidden border border-white/5 relative bg-white/3">
                    {movie.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                        alt={movie.movie_title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-white/40">لا توجد صورة</div>
                    )}
                    
                    {/* Delete button overlay */}
                    <button
                      onClick={(e) => handleRemoveFromLibrary(e, movie.id)}
                      className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 hover:bg-shasha-danger text-white border border-white/10 flex items-center justify-center transition-all z-20 cursor-pointer"
                      title="إزالة من المكتبة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-xs font-bold text-white truncate">{movie.movie_title}</span>
                    
                    {/* Status selection pill */}
                    <select
                      value={movie.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleUpdateStatus(movie.id, e.target.value as LibraryMovie['status'])}
                      className="mt-1 w-full p-1.5 rounded-lg bg-black/30 border border-white/10 text-[9px] font-semibold text-white/70 focus:outline-none text-right cursor-pointer"
                    >
                      <option value="watched" className="bg-shasha-card text-white">تمت المشاهدة</option>
                      <option value="watching" className="bg-shasha-card text-white">أشاهد حالياً</option>
                      <option value="watchlist" className="bg-shasha-card text-white">مشاهدة لاحقاً</option>
                    </select>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-12 text-center text-xs text-shasha-secondary border border-white/5 flex flex-col items-center justify-center gap-4">
          <FolderHeart className="w-10 h-10 text-white/25" />
          <span>لا توجد أعمال فنية في هذا القسم.</span>
          <Link href="/explore" className="px-5 py-2.5 rounded-xl bg-shasha-accent text-white font-bold hover:bg-shasha-accent-hover transition-colors flex items-center gap-1.5 cursor-pointer">
            أضف أفلاماً لمكتبتك
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      )}

    </div>
  );
}
