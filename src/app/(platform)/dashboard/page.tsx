'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Sparkles, Tv, Users, Film, Heart, Play, Eye } from 'lucide-react';
import Link from 'next/link';

interface Movie {
  id: number;
  title: string;
  original_title?: string;
  original_name?: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  overview: string;
  release_date: string;
}

interface Profile {
  id: string;
  name: string;
}

interface ActiveRoom {
  id: string;
  name: string;
  creatorName: string;
  creatorAvatar: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  
  // Dynamic Greeting based on time
  const [greeting, setGreeting] = useState('مساء الخير');
  
  // Dashboard Section States
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [suggestedMovie, setSuggestedMovie] = useState<Movie | null>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [onlineFriends, setOnlineFriends] = useState<any[]>([]);
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(true);

  // Initialize Greeting
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('صباح الخير');
    else if (hour < 17) setGreeting('مساء الخير');
    else setGreeting('مساء الخير');
  }, []);

  // Fetch session & details
  useEffect(() => {
    let active = true;
    let channel: any = null;

    const loadDashboardData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !active) return;

      // Load Profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', session.user.id)
        .single();
      
      if (prof && active) setProfile(prof);

      // Load Friends list
      const { data: friendsData } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`);
      
      if (friendsData && active) {
        setFriendsCount(friendsData.length);
        const friendIds = friendsData.map(f => f.user_id === session.user.id ? f.friend_id : f.user_id);
        
        if (friendIds.length > 0) {
          // Load Online friends list
          const { data: onlineProfiles } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .in('id', friendIds)
            .limit(3);
          
          if (onlineProfiles && active) {
            setOnlineFriends(onlineProfiles);
          }

          // Initial load of active rooms
          const refreshActiveRooms = async () => {
            const { data: rooms } = await supabase
              .from('persistent_rooms')
              .select('id, name, creator_id')
              .in('creator_id', friendIds);

            if (rooms && rooms.length > 0 && active) {
              const { data: profiles } = await supabase
                .from('profiles')
                .select('id, name, avatar_url')
                .in('id', friendIds);

              const populated = rooms.map(room => {
                const creator = profiles?.find(p => p.id === room.creator_id);
                return {
                  id: room.id,
                  name: room.name,
                  creatorName: creator ? creator.name : 'صديق شاشة',
                  creatorAvatar: creator ? creator.avatar_url : ''
                };
              });
              setActiveRooms(populated);
            } else if (active) {
              setActiveRooms([]);
            }
          };

          await refreshActiveRooms();

          // Subscribe to persistent_rooms changes in Realtime
          channel = supabase
            .channel('dashboard_active_rooms')
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'persistent_rooms'
              },
              async () => {
                if (active) {
                  await refreshActiveRooms();
                }
              }
            )
            .subscribe();
        }
      }
    };

    loadDashboardData();

    return () => {
      active = false;
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, []);

  // Fetch TMDB Movies
  useEffect(() => {
    const fetchTMDB = async () => {
      try {
        const res = await fetch('/api/tmdb?endpoint=/trending/movie/day&language=ar-SA');
        if (!res.ok) throw new Error('Failed to fetch from TMDB');
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
          setTrendingMovies(data.results);
          // Choose a random featured movie for "Movie Tonight"
          const randomIndex = Math.floor(Math.random() * Math.min(10, data.results.length));
          setSuggestedMovie(data.results[randomIndex]);
        }
      } catch (err) {
        console.warn('TMDB Dashboard Fetch Error:', err);
      } finally {
        setLoadingMovies(false);
      }
    };

    fetchTMDB();
  }, []);

  return (
    <div className="flex flex-col gap-8 text-right pb-10">
      
      {/* 1. Header Hero Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden glass-panel border border-white/5 p-8 flex flex-col justify-center gap-2 overflow-hidden bg-gradient-to-l from-shasha-accent/10 to-transparent"
      >
        <div className="absolute top-0 left-0 w-64 h-full bg-shasha-accent/5 blur-[80px] pointer-events-none" />
        
        <h1 className="text-3xl font-bold flex flex-col items-end gap-1 text-white">
          <span className="flex items-center gap-2">
            {greeting}
            <Sparkles className="w-6 h-6 text-shasha-accent animate-pulse" />
          </span>
          <span className="text-shasha-accent text-4xl mt-1 font-bold">{profile?.name || '—'}</span>
        </h1>
        <p className="text-sm text-shasha-secondary">مرحباً بك في لوحة تحكم شاشة. اكتشف الأفلام، أدر غرفتك وابدأ البث مع أصدقائك فوراً.</p>
      </motion.div>

      {/* 2. Grid Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Friends' Active Rooms Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-white/5 flex flex-col gap-4"
        >
          <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider flex items-center justify-end gap-2">
            غرف الأصدقاء النشطة
            <Tv className="w-4 h-4 text-shasha-accent" />
          </h3>

          <div className="flex-1 flex flex-col gap-3 justify-center min-h-[140px]">
            {activeRooms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeRooms.map((room) => (
                  <div key={room.id} className="p-4 rounded-2xl bg-white/3 hover:bg-white/5 border border-white/5 flex items-center justify-between transition-colors">
                    <button
                      onClick={() => router.push(`/room/${room.id}`)}
                      className="px-4 py-2 rounded-xl bg-shasha-accent text-white text-xs font-bold hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                    >
                      انضم الآن
                    </button>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-bold text-white/90 flex items-center gap-1.5 justify-end">
                        👤 {room.creatorName}
                      </span>
                      <span className="text-[11px] text-shasha-secondary">
                        🎥 غرفة: {room.name}
                      </span>
                      <span className="text-[10px] text-shasha-success font-semibold flex items-center gap-1 mt-0.5">
                        🟢 مباشر الآن
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-xs text-shasha-secondary py-8">
                لا يوجد أي صديق داخل غرفة حالياً.
              </div>
            )}
          </div>
        </motion.div>

        {/* Friends Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col gap-4 justify-between"
        >
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider flex items-center justify-end gap-2">
              قائمة الأصدقاء
              <Users className="w-4 h-4 text-shasha-accent" />
            </h3>

            <div className="flex flex-col gap-2.5">
              {onlineFriends.map((friend) => (
                <div key={friend.id} className="flex items-center justify-between p-2 rounded-xl bg-white/3">
                  <div className="flex items-center gap-1.5 text-[10px] text-shasha-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-shasha-success" />
                    متصل
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">{friend.name}</span>
                    <div className="w-6 h-6 rounded-full bg-shasha-accent/25 flex items-center justify-center font-bold text-[10px] text-shasha-accent overflow-hidden">
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        friend.name.charAt(0)
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {onlineFriends.length === 0 && (
                <div className="text-center text-xs text-shasha-secondary py-6">لا يوجد أصدقاء متصلون</div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-2">
            <Link href="/friends" className="text-xs text-shasha-accent font-bold hover:text-shasha-accent-hover transition-colors">
              عرض الكل
            </Link>
            <span className="text-xs text-shasha-secondary">إجمالي الأصدقاء: {friendsCount}</span>
          </div>
        </motion.div>

      </div>

      {/* 3. Movie Tonight (Featured Suggestion) */}
      {suggestedMovie && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative rounded-3xl overflow-hidden min-h-[300px] border border-white/5 flex items-center justify-end p-8"
        >
          {/* Background image & gradient overlay */}
          <div className="absolute inset-0 z-0">
            <img
              src={`https://image.tmdb.org/t/p/w1280${suggestedMovie.backdrop_path}`}
              alt=""
              className="w-full h-full object-cover opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          </div>

          {/* Featured Content details */}
          <div className="relative z-10 max-w-xl text-right flex flex-col items-start gap-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-shasha-accent/20 border border-shasha-accent/30 text-shasha-accent text-[10px] font-bold">
              <Film className="w-3.5 h-3.5" />
              فيلم الليلة المقترح
            </div>

            <h2 className="text-3xl font-bold text-white">{suggestedMovie.original_title || suggestedMovie.title}</h2>
            <p className="text-sm text-shasha-secondary leading-relaxed line-clamp-3">
              {suggestedMovie.overview || 'لا يوجد وصف متاح باللغة العربية حالياً.'}
            </p>

            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs text-shasha-secondary font-semibold">تاريخ الإصدار: {suggestedMovie.release_date}</span>
              <span className="text-xs text-shasha-warning font-bold">⭐ {suggestedMovie.vote_average.toFixed(1)}/10</span>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => router.push(`/explore?movieId=${suggestedMovie.id}`)}
                className="px-5 py-3 rounded-xl bg-shasha-accent text-white text-xs font-bold hover:bg-shasha-accent-hover transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                عرض التفاصيل
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* 4. Trending Today horizontal scrollable list */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex flex-col gap-4"
      >
        <h3 className="text-lg font-bold text-white flex items-center justify-end gap-2">
          الأكثر رواجاً اليوم
          <Sparkles className="w-5 h-5 text-shasha-accent" />
        </h3>

        {loadingMovies ? (
          <div className="flex gap-4 overflow-x-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-40 aspect-[2/3] rounded-2xl bg-white/3 animate-pulse shrink-0" />
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 scroll-smooth">
            {trendingMovies.map((movie) => (
              <Link
                key={movie.id}
                href={`/explore?movieId=${movie.id}`}
                className="w-40 flex flex-col gap-2 shrink-0 group hover:scale-[1.03] transition-all"
              >
                <div className="aspect-[2/3] rounded-2xl overflow-hidden border border-white/5 relative bg-white/3">
                  {movie.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                      alt={movie.original_title || movie.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-white/40">لا توجد صورة</div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-[10px] font-bold text-white bg-shasha-accent/80 px-2.5 py-1 rounded-full flex items-center gap-1">
                      عرض التفاصيل
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-white/90 truncate group-hover:text-shasha-accent transition-colors">
                  {movie.original_title || movie.title}
                </span>
              </Link>
            ))}
          </div>
        )}
      </motion.div>

    </div>
  );
}
