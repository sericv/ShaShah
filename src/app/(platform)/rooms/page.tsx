'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Sparkles, Monitor, ArrowLeft, Plus, Clock, Film, Search, Star, X } from 'lucide-react';
import { isPlayableHttpUrl } from '@/utils/videoUrl';

interface PersistentRoom {
  id: string;
  name: string;
  created_at: string;
  creator_id: string;
  room_type?: 'normal' | 'cinema';
  poster_path?: string | null;
  release_year?: string | null;
  vote_average?: number | null;
}

interface TmdbMovie {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  runtime?: number;
}

// Generate human-friendly room IDs
const ADJECTIVES = ['cyber', 'quantum', 'neon', 'cosmic', 'aurora', 'shadow', 'stellar', 'sonic', 'hyper', 'alpha'];
const NOUNS = ['fox', 'falcon', 'wolf', 'phoenix', 'lynx', 'panther', 'ranger', 'vortex', 'matrix', 'beacon'];

function generateRoomId() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${adj}-${noun}-${num}`;
}

export default function RoomsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  
  // Rooms lists
  const [myRooms, setMyRooms] = useState<PersistentRoom[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Room State
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createMode, setCreateMode] = useState<'choice' | 'normal' | 'cinema'>('choice');
  const [cinemaStep, setCinemaStep] = useState(1);
  const [movieQuery, setMovieQuery] = useState('');
  const [movieResults, setMovieResults] = useState<TmdbMovie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<TmdbMovie | null>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [searchingMovies, setSearchingMovies] = useState(false);

  // Fetch Rooms
  useEffect(() => {
    const loadRooms = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setProfile(session.user);

      // Fetch user's persistent rooms from Supabase
      const { data: rooms, error } = await supabase
        .from('persistent_rooms')
        .select('*')
        .eq('creator_id', session.user.id)
        .order('created_at', { ascending: false });

      if (!error && rooms) {
        setMyRooms(rooms);
      }
      setLoading(false);
    };

    loadRooms();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      setErrorMsg('الرجاء إدخال اسم الغرفة');
      return;
    }

    setCreating(true);
    setErrorMsg('');

    const newId = generateRoomId();

    try {
      const { error } = await supabase
        .from('persistent_rooms')
        .insert({
          id: newId,
          name: newRoomName.trim(),
          creator_id: profile.id,
          room_type: 'normal',
        });

      if (error) {
        setErrorMsg(error.message || 'فشل إنشاء الغرفة، يرجى المحاولة لاحقاً');
        setCreating(false);
      } else {
        // Optimistic update
        const roomObj: PersistentRoom = {
          id: newId,
          name: newRoomName.trim(),
          creator_id: profile.id,
          created_at: new Date().toISOString(),
          room_type: 'normal',
        };
        setMyRooms((prev) => [roomObj, ...prev]);
        setNewRoomName('');
        setCreating(false);

        // Redirect to the room
        router.push(`/room/${newId}`);
      }
    } catch (err) {
      setErrorMsg('حدث خطأ غير متوقع');
      setCreating(false);
    }
  };

  useEffect(() => {
    if (createMode !== 'cinema' || movieQuery.trim().length < 2) {
      setMovieResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchingMovies(true);
      try {
        const res = await fetch(`/api/tmdb?endpoint=/search/movie&query=${encodeURIComponent(movieQuery)}&language=ar-SA`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setMovieResults((data.results || []).filter((item: TmdbMovie) => item.poster_path).slice(0, 8));
      } catch (err) {
        if (!controller.signal.aborted) setMovieResults([]);
      } finally {
        if (!controller.signal.aborted) setSearchingMovies(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [createMode, movieQuery]);

  const selectMovie = async (movie: TmdbMovie) => {
    setSelectedMovie(movie);
    setCinemaStep(2);

    try {
      const res = await fetch(`/api/tmdb?endpoint=/movie/${movie.id}&language=ar-SA`);
      if (res.ok) {
        const details = await res.json();
        setSelectedMovie({ ...movie, runtime: details.runtime });
      }
    } catch {
      setSelectedMovie(movie);
    }
  };

  const handleCreateCinemaRoom = async () => {
    if (!selectedMovie) {
      setErrorMsg('اختر الفيلم أولاً');
      return;
    }
    if (!isPlayableHttpUrl(streamUrl)) {
      setErrorMsg('أدخل رابط http أو https صالح');
      return;
    }

    setCreating(true);
    setErrorMsg('');

    const newId = generateRoomId();
    const title = selectedMovie.title || selectedMovie.name || 'Cinema Room';
    const releaseYear = (selectedMovie.release_date || selectedMovie.first_air_date || '').slice(0, 4) || null;

    try {
      const { error } = await supabase.from('persistent_rooms').insert({
        id: newId,
        name: title,
        creator_id: profile.id,
        room_type: 'cinema',
        tmdb_id: selectedMovie.id,
        title,
        poster_path: selectedMovie.poster_path,
        backdrop_path: selectedMovie.backdrop_path,
        release_year: releaseYear,
        vote_average: selectedMovie.vote_average,
        runtime: selectedMovie.runtime,
        stream_url: streamUrl.trim(),
      });

      if (error) {
        setErrorMsg(error.message || 'فشل إنشاء غرفة السينما');
        setCreating(false);
        return;
      }

      router.push(`/room/${newId}`);
    } catch {
      setErrorMsg('حدث خطأ غير متوقع');
      setCreating(false);
    }
  };

  const resetCreateDialog = () => {
    setShowCreateDialog(false);
    setCreateMode('choice');
    setCinemaStep(1);
    setMovieQuery('');
    setMovieResults([]);
    setSelectedMovie(null);
    setStreamUrl('');
    setNewRoomName('');
    setErrorMsg('');
  };

  return (
    <div className="flex flex-col gap-8 text-right pb-10 max-w-5xl mx-auto">
      
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center border-b border-white/5 pb-4"
      >
        <span className="text-xs text-shasha-secondary">أدر غرف البث الخاصة بك أو أنشئ غرفاً جديدة</span>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          إدارة الغرف
          <Monitor className="w-5.5 h-5.5 text-shasha-accent" />
        </h1>
      </motion.div>

      {/* Grid Layout: Create Room (Left) & My Rooms (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Create New Room (Left Card) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col gap-5"
        >
          <h3 className="text-md font-bold text-white flex items-center justify-end gap-2 border-b border-white/5 pb-3">
            أنشئ غرفة بث جديدة
            <Plus className="w-4 h-4 text-shasha-accent" />
          </h3>

          <div className="flex flex-col gap-4">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="w-full py-3.5 rounded-xl bg-shasha-accent text-white font-semibold text-xs transition-all hover:bg-shasha-accent-hover active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-shasha-accent/20 cursor-pointer disabled:opacity-55"
            >
              إنشاء غرفة
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="text-xs font-semibold text-shasha-danger bg-shasha-danger/10 border border-shasha-danger/20 px-3 py-2 rounded-lg text-center">
              {errorMsg}
            </div>
          )}
        </motion.div>

        {/* My Rooms List (Right Columns) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-2 flex flex-col gap-4"
        >
          <h3 className="text-md font-bold text-white/50 flex items-center justify-end gap-2">
            غرف البث الخاصة بي
            <Sparkles className="w-4 h-4 text-shasha-accent" />
          </h3>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 rounded-2xl bg-white/3 animate-pulse" />
              ))}
            </div>
          ) : myRooms.length > 0 ? (
            <div className="flex flex-col gap-3">
              {myRooms.map((room) => {
                const relativeTime = new Date(room.created_at).toLocaleDateString('ar-EG', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                
                return (
                  <motion.div
                    key={room.id}
                    className="p-4 rounded-2xl bg-white/3 hover:bg-white/5 border border-white/5 flex items-center justify-between transition-all group"
                  >
                    <button
                      onClick={() => router.push(`/room/${room.id}`)}
                      className="px-4 py-2 rounded-xl bg-shasha-accent text-white text-xs font-bold hover:bg-shasha-accent-hover active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      دخول الغرفة
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-bold text-white group-hover:text-shasha-accent transition-colors flex items-center gap-2 justify-end">
                        {room.room_type === 'cinema' && <Film className="w-3.5 h-3.5 text-shasha-accent" />}
                        {room.name}
                      </span>
                      <div className="flex items-center gap-3 text-[10px] text-shasha-secondary justify-end">
                        <span className="flex items-center gap-1">
                          {relativeTime}
                          <Clock className="w-3.5 h-3.5" />
                        </span>
                        <span className="flex items-center gap-1">
                          رمز الغرفة: {room.id}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="glass-panel rounded-3xl p-10 text-center text-xs text-shasha-secondary border border-white/5">
              لم تقم بإنشاء أي غرف بث حتى الآن. أنشئ غرفتك الأولى باستخدام الصندوق الجانبي!
            </div>
          )}
        </motion.div>

      </div>

      {showCreateDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel border border-white/10 rounded-3xl w-full max-w-2xl max-h-[88vh] overflow-y-auto p-5 text-right">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-5">
              <button onClick={resetCreateDialog} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-bold text-white">إنشاء غرفة</h2>
            </div>

            {createMode === 'choice' && (
              <div className="grid md:grid-cols-2 gap-3">
                <button onClick={() => setCreateMode('normal')} className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-shasha-accent/50 text-right">
                  <Monitor className="w-7 h-7 text-shasha-accent mb-4 ml-auto" />
                  <h3 className="font-bold text-white mb-1">غرفة عادية</h3>
                  <p className="text-xs text-shasha-secondary">النظام الحالي كما هو مع مشاركة الشاشة.</p>
                </button>
                <button onClick={() => setCreateMode('cinema')} className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-shasha-accent/50 text-right">
                  <Film className="w-7 h-7 text-shasha-accent mb-4 ml-auto" />
                  <h3 className="font-bold text-white mb-1">غرفة مخصصة</h3>
                  <p className="text-xs text-shasha-secondary">اختيار فيلم وتشغيل رابط فيديو مباشر داخل المنصة.</p>
                </button>
              </div>
            )}

            {createMode === 'normal' && (
              <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
                <label className="block text-xs font-semibold text-shasha-secondary">اسم الغرفة</label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="مثال: سهرة أفلام الجمعة"
                  className="w-full px-4 py-3 rounded-xl glass-input text-right text-xs"
                  maxLength={30}
                  required
                />
                <button type="submit" disabled={creating} className="w-full py-3 rounded-xl bg-shasha-accent text-white text-xs font-bold disabled:opacity-55">
                  {creating ? 'جاري الإنشاء...' : 'إنشاء ودخول الغرفة'}
                </button>
              </form>
            )}

            {createMode === 'cinema' && (
              <div className="flex flex-col gap-5">
                {cinemaStep === 1 && (
                  <>
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-shasha-secondary" />
                      <input
                        value={movieQuery}
                        onChange={(e) => setMovieQuery(e.target.value)}
                        placeholder="ابحث عن فيلم..."
                        className="w-full pr-10 pl-4 py-3 rounded-xl glass-input text-right text-xs"
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {searchingMovies && <div className="text-xs text-shasha-secondary">جاري البحث...</div>}
                      {movieResults.map((movie) => {
                        const title = movie.title || movie.name || '';
                        const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
                        return (
                          <button key={movie.id} onClick={() => selectMovie(movie)} className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-shasha-accent/50 flex gap-3 text-right">
                            <img src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`} alt="" className="w-16 h-24 rounded-lg object-cover" />
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-white text-sm line-clamp-2">{title}</h4>
                              <div className="mt-2 text-[11px] text-shasha-secondary flex items-center justify-end gap-2">
                                <span>{year}</span>
                                <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" />{movie.vote_average?.toFixed(1) || '-'}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {cinemaStep === 2 && selectedMovie && (
                  <>
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-end gap-3">
                      <div>
                        <h3 className="font-bold text-white">{selectedMovie.title || selectedMovie.name}</h3>
                        <p className="text-xs text-shasha-secondary">{(selectedMovie.release_date || '').slice(0, 4)} · {selectedMovie.vote_average?.toFixed(1) || '-'}</p>
                      </div>
                      <img src={`https://image.tmdb.org/t/p/w185${selectedMovie.poster_path}`} alt="" className="w-12 h-16 rounded-lg object-cover" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-shasha-secondary mb-2">رابط الفيديو المباشر</label>
                      <input
                        value={streamUrl}
                        onChange={(e) => setStreamUrl(e.target.value)}
                        placeholder="https://cdn.example.com/movie.m3u8"
                        className="w-full px-4 py-3 rounded-xl glass-input text-left text-xs"
                      />
                    </div>
                    <button onClick={() => setCinemaStep(3)} className="w-full py-3 rounded-xl bg-white/10 text-white text-xs font-bold">التالي</button>
                  </>
                )}

                {cinemaStep === 3 && selectedMovie && (
                  <button onClick={handleCreateCinemaRoom} disabled={creating} className="w-full py-3.5 rounded-xl bg-shasha-accent text-white text-xs font-bold disabled:opacity-55">
                    {creating ? 'جاري الإنشاء...' : 'Create Cinema Room'}
                  </button>
                )}
              </div>
            )}

            {errorMsg && <div className="mt-4 text-xs font-semibold text-shasha-danger bg-shasha-danger/10 border border-shasha-danger/20 px-3 py-2 rounded-lg text-center">{errorMsg}</div>}
          </div>
        </div>
      )}

    </div>
  );
}
