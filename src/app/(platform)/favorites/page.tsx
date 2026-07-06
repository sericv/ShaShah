'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Heart, Film, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface FavoriteMovie {
  id: string;
  movie_id: string;
  movie_title: string;
  poster_path: string;
  media_type: string;
}

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteMovie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setFavorites(data);
      }
      setLoading(false);
    };

    fetchFavorites();
  }, []);

  const handleRemoveFavorite = async (e: React.MouseEvent, movie_id: string) => {
    e.preventDefault();
    e.stopPropagation();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', session.user.id)
        .eq('movie_id', movie_id);

      setFavorites((prev) => prev.filter((f) => f.movie_id !== movie_id));
    } catch (err) {
      console.warn('Remove favorite error:', err);
    }
  };

  return (
    <div className="flex flex-col gap-8 text-right pb-10 max-w-5xl mx-auto">
      
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center border-b border-white/5 pb-4"
      >
        <span className="text-xs text-shasha-secondary">الأعمال الفنية المفضلة لديك للوصول السريع إليها</span>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          المفضلة
          <Heart className="w-5.5 h-5.5 text-shasha-danger fill-shasha-danger" />
        </h1>
      </motion.div>

      {/* Favorites Movies Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-full aspect-[2/3] rounded-2xl bg-white/3 animate-pulse" />
          ))}
        </div>
      ) : favorites.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-5">
          <AnimatePresence>
            {favorites.map((movie) => (
              <motion.div
                key={movie.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={() => router.push(`/explore?movieId=${movie.movie_id}`)}
                className="flex flex-col gap-2 group cursor-pointer relative"
              >
                <div className="aspect-[2/3] rounded-2xl overflow-hidden border border-white/5 relative bg-white/3">
                  {movie.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                      alt={movie.movie_title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-white/40">لا توجد صورة</div>
                  )}
                  
                  {/* Remove Favorite Button */}
                  <button
                    onClick={(e) => handleRemoveFavorite(e, movie.movie_id)}
                    className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/60 hover:bg-shasha-danger text-white border border-white/10 flex items-center justify-center transition-all z-20 cursor-pointer"
                    title="حذف من المفضلة"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-[10px] font-bold text-white bg-shasha-accent/80 px-2.5 py-1 rounded-full flex items-center gap-1">
                      عرض التفاصيل
                    </span>
                  </div>
                </div>

                <span className="text-xs font-semibold text-white/85 truncate group-hover:text-shasha-accent transition-colors">
                  {movie.movie_title}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-12 text-center text-xs text-shasha-secondary border border-white/5 flex flex-col items-center justify-center gap-4">
          <Heart className="w-10 h-10 text-white/25" />
          <span>لم تقم بإضافة أي أعمال فنية للمفضلة بعد.</span>
          <Link href="/explore" className="px-5 py-2.5 rounded-xl bg-shasha-accent text-white font-bold hover:bg-shasha-accent-hover transition-colors flex items-center gap-1.5 cursor-pointer">
            اكتشف الأفلام الآن
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      )}

    </div>
  );
}

// Inline subcomponent for simple modal closing inside other pages
function X({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}
