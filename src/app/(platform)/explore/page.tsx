'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import {
  Search,
  Sparkles,
  Heart,
  FolderHeart,
  Users,
  Play,
  X,
  Volume2,
  Tv,
  Film,
  Calendar,
  Clock,
  Star,
  Info,
  ChevronRight,
  Plus
} from 'lucide-react';

interface Movie {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  media_type?: 'movie' | 'tv';
}

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string;
}

interface MovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  release_date: string;
  runtime?: number;
  episode_run_time?: number[];
  genres: { id: number; name: string }[];
  media_type: 'movie' | 'tv';
}

export default function ExplorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkedMovieId = searchParams.get('movieId');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'movie' | 'tv' | 'anime' | 'trending' | 'top_rated'>('all');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);

  // Movie Details Modal
  const [selectedMovie, setSelectedMovie] = useState<MovieDetails | null>(null);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Movie[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Social / Library Action States
  const [isFavorite, setIsFavorite] = useState(false);
  const [libraryStatus, setLibraryStatus] = useState<'watched' | 'watching' | 'watchlist' | null>(null);
  const [userRooms, setUserRooms] = useState<any[]>([]);
  const [showRoomInviteDropdown, setShowRoomInviteDropdown] = useState(false);

  // Tabs mapping to TMDB endpoints
  const getEndpoint = (tab: typeof activeTab, p: number) => {
    switch (tab) {
      case 'movie':
        return `/discover/movie?page=${p}`;
      case 'tv':
        return `/discover/tv?page=${p}`;
      case 'anime':
        return `/discover/tv?with_genres=16&with_original_language=ja&page=${p}`;
      case 'trending':
        return `/trending/movie/week?page=${p}`;
      case 'top_rated':
        return `/movie/top_rated?page=${p}`;
      case 'all':
      default:
        return `/trending/all/week?page=${p}`;
    }
  };

  // Fetch movies grid
  const fetchMoviesList = async (tab: typeof activeTab, p: number, isNew: boolean = false) => {
    setLoading(true);
    try {
      let endpoint = getEndpoint(tab, p);
      if (searchQuery.trim()) {
        endpoint = `/search/multi?query=${encodeURIComponent(searchQuery)}&page=${p}`;
      }

      const res = await fetch(`/api/tmdb?endpoint=${endpoint}&language=ar-SA`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();

      if (data.results) {
        // filter out items with no poster/backdrop
        const filtered = data.results.filter((m: any) => m.poster_path || m.backdrop_path);
        
        setMovies((prev) => (isNew ? filtered : [...prev, ...filtered]));
        setHasMore(data.page < data.total_pages);
      }
    } catch (err) {
      console.warn('Explore fetch grid error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger grid fetch on search or tab change
  useEffect(() => {
    setPage(1);
    fetchMoviesList(activeTab, 1, true);
  }, [activeTab, searchQuery]);

  // Load deep linked movie if any
  useEffect(() => {
    if (deepLinkedMovieId) {
      handleOpenDetails(parseInt(deepLinkedMovieId), 'movie');
    }
  }, [deepLinkedMovieId]);

  // Fetch individual details when modal opens
  const handleOpenDetails = async (id: number, mediaType: 'movie' | 'tv') => {
    setLoadingDetails(true);
    setSelectedMovie(null);
    setCast([]);
    setTrailerKey(null);
    setRecommendations([]);
    setIsFavorite(false);
    setLibraryStatus(null);

    try {
      // 1. Fetch details
      const detailRes = await fetch(`/api/tmdb?endpoint=/${mediaType}/${id}&language=ar-SA`);
      if (!detailRes.ok) throw new Error('Details fetch failed');
      const detailData = await detailRes.json();
      
      const movieDetails: MovieDetails = {
        id: detailData.id,
        title: mediaType === 'movie' 
          ? (detailData.original_title || detailData.title || '') 
          : (detailData.original_name || detailData.name || ''),
        overview: detailData.overview,
        poster_path: detailData.poster_path,
        backdrop_path: detailData.backdrop_path,
        vote_average: detailData.vote_average,
        release_date: detailData.release_date || detailData.first_air_date || '',
        runtime: detailData.runtime,
        episode_run_time: detailData.episode_run_time,
        genres: detailData.genres || [],
        media_type: mediaType
      };
      
      setSelectedMovie(movieDetails);

      // 2. Fetch credits (Cast)
      const creditsRes = await fetch(`/api/tmdb?endpoint=/${mediaType}/${id}/credits&language=ar-SA`);
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        if (creditsData.cast) {
          setCast(creditsData.cast.slice(0, 5));
        }
      }

      // 3. Fetch videos (Trailer)
      const videosRes = await fetch(`/api/tmdb?endpoint=/${mediaType}/${id}/videos&language=ar-SA`);
      if (videosRes.ok) {
        const videosData = await videosRes.json();
        const youtubeTrailer = videosData.results?.find(
          (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
        );
        if (youtubeTrailer) {
          setTrailerKey(youtubeTrailer.key);
        }
      }

      // 4. Fetch Recommendations
      const recRes = await fetch(`/api/tmdb?endpoint=/${mediaType}/${id}/recommendations&language=ar-SA`);
      if (recRes.ok) {
        const recData = await recRes.json();
        if (recData.results) {
          setRecommendations(recData.results.slice(0, 4));
        }
      }

      // 5. Fetch Session & Check public tables (Favorites, Library)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check favorites
        const { data: fav } = await supabase
          .from('favorites')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('movie_id', id.toString())
          .maybeSingle();
        
        if (fav) setIsFavorite(true);

        // Check library status
        const { data: lib } = await supabase
          .from('library')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('movie_id', id.toString())
          .maybeSingle();
        
        if (lib) setLibraryStatus(lib.status);

        // Load active persistent rooms for social invite dropdown
        const { data: rooms } = await supabase
          .from('persistent_rooms')
          .select('id, name')
          .eq('creator_id', session.user.id);
        if (rooms) setUserRooms(rooms);
      }

    } catch (err) {
      console.warn('Failed to load movie detailed view:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Toggle Favorite Status
  const handleToggleFavorite = async () => {
    if (!selectedMovie) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      if (isFavorite) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', session.user.id)
          .eq('movie_id', selectedMovie.id.toString());
        setIsFavorite(false);
      } else {
        await supabase
          .from('favorites')
          .insert({
            user_id: session.user.id,
            movie_id: selectedMovie.id.toString(),
            movie_title: selectedMovie.title,
            poster_path: selectedMovie.poster_path,
            media_type: selectedMovie.media_type
          });
        setIsFavorite(true);
      }
    } catch (err) {
      console.warn('Toggle favorite error:', err);
    }
  };

  // Set Library Status
  const handleSetLibraryStatus = async (status: typeof libraryStatus) => {
    if (!selectedMovie) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      if (status === null) {
        await supabase
          .from('library')
          .delete()
          .eq('user_id', session.user.id)
          .eq('movie_id', selectedMovie.id.toString());
        setLibraryStatus(null);
      } else {
        const { data: existing } = await supabase
          .from('library')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('movie_id', selectedMovie.id.toString())
          .maybeSingle();

        if (existing) {
          await supabase
            .from('library')
            .update({ status })
            .eq('user_id', session.user.id)
            .eq('movie_id', selectedMovie.id.toString());
        } else {
          await supabase
            .from('library')
            .insert({
              user_id: session.user.id,
              movie_id: selectedMovie.id.toString(),
              movie_title: selectedMovie.title,
              poster_path: selectedMovie.poster_path,
              media_type: selectedMovie.media_type,
              status
            });
        }
        setLibraryStatus(status);
      }
    } catch (err) {
      console.warn('Set library status error:', err);
    }
  };

  const loadMoreMovies = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchMoviesList(activeTab, nextPage, false);
  };

  const handleCloseModal = () => {
    setSelectedMovie(null);
    // Remove query parameter if present
    if (deepLinkedMovieId) {
      router.push('/explore');
    }
  };

  const tabs = [
    { id: 'all', name: 'الكل' },
    { id: 'movie', name: 'أفلام' },
    { id: 'tv', name: 'مسلسلات' },
    { id: 'anime', name: 'أنمي' },
    { id: 'trending', name: 'شائع' },
    { id: 'top_rated', name: 'الأعلى تقييماً' },
  ] as const;

  return (
    <div className="flex flex-col gap-6 text-right pb-10">
      
      {/* Search and Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-white/5 pb-4">
        
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setSearchQuery('');
                setActiveTab(tab.id);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                activeTab === tab.id
                  ? 'bg-shasha-accent text-white shadow-md'
                  : 'bg-white/3 border border-white/5 text-shasha-secondary hover:bg-white/5 hover:text-white'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Large Explore Search Input */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن الأفلام والأنمي..."
            className="w-full pl-4 pr-10 py-2.5 rounded-xl glass-input text-right text-xs"
          />
          <Search className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-white/30" />
        </div>

      </div>

      {/* Grid Movies View */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
        {movies.map((movie, index) => {
          const type = movie.media_type || (activeTab === 'tv' || activeTab === 'anime' ? 'tv' : 'movie');
          const title = type === 'movie' 
            ? (movie.original_title || movie.title || '') 
            : (movie.original_name || movie.name || '');
          const rating = movie.vote_average.toFixed(1);

          return (
            <motion.div
              key={`${movie.id}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(0.2, index * 0.03) }}
              onClick={() => handleOpenDetails(movie.id, type as 'movie' | 'tv')}
              className="flex flex-col gap-2 group cursor-pointer"
            >
              <div className="aspect-[2/3] rounded-2xl overflow-hidden border border-white/5 relative bg-white/3">
                {movie.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-white/40">لا توجد صورة</div>
                )}
                {/* Overlay hover details */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col justify-end p-3 transition-opacity">
                  <span className="text-[10px] font-bold text-shasha-warning flex items-center gap-1 mb-1 justify-end">
                    ⭐ {rating}/10
                  </span>
                  <span className="text-xs font-bold text-white leading-tight line-clamp-2">{title}</span>
                </div>
              </div>
              <span className="text-xs font-semibold text-white/85 truncate group-hover:text-shasha-accent transition-colors">
                {title}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Infinite Scroll / Load More Trigger */}
      {hasMore && movies.length > 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMoreMovies}
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-[0.98] text-xs font-bold transition-all cursor-pointer disabled:opacity-55"
          >
            {loading ? 'جاري التحميل...' : 'عرض المزيد من الأفلام'}
          </button>
        </div>
      )}

      {/* 5. Movie Details Overlay Modal */}
      <AnimatePresence>
        {selectedMovie && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0" onClick={handleCloseModal} />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto glass-panel border border-white/10 rounded-3xl z-10 flex flex-col relative"
            >
              {/* Top Action Exit Button */}
              <button
                onClick={handleCloseModal}
                className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white/70 hover:text-white z-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Backdrop Header Banner */}
              <div className="relative h-64 md:h-80 shrink-0">
                <img
                  src={`https://image.tmdb.org/t/p/w1280${selectedMovie.backdrop_path}`}
                  alt=""
                  className="w-full h-full object-cover opacity-40"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/65 to-transparent" />
                
                {/* Poster and Basic Details */}
                <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col md:flex-row items-center md:items-end justify-between gap-6">
                  {/* Action buttons on the left */}
                  <div className="flex flex-wrap gap-2.5 z-10">
                    {/* Favorite Button */}
                    <button
                      onClick={handleToggleFavorite}
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                        isFavorite
                          ? 'bg-shasha-danger/20 border-shasha-danger/45 text-shasha-danger'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                      title={isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
                    >
                      <Heart className={`w-4 h-4 ${isFavorite ? 'fill-shasha-danger' : ''}`} />
                    </button>

                    {/* Library watching status buttons */}
                    <div className="flex rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                      <button
                        onClick={() => handleSetLibraryStatus(libraryStatus === 'watched' ? null : 'watched')}
                        className={`px-3 py-2 text-[10px] font-bold border-r border-white/5 transition-all cursor-pointer ${
                          libraryStatus === 'watched' ? 'bg-shasha-accent text-white' : 'text-white/60 hover:bg-white/5'
                        }`}
                      >
                        تمت المشاهدة
                      </button>
                      <button
                        onClick={() => handleSetLibraryStatus(libraryStatus === 'watching' ? null : 'watching')}
                        className={`px-3 py-2 text-[10px] font-bold border-r border-white/5 transition-all cursor-pointer ${
                          libraryStatus === 'watching' ? 'bg-shasha-accent text-white' : 'text-white/60 hover:bg-white/5'
                        }`}
                      >
                        أشاهد حالياً
                      </button>
                      <button
                        onClick={() => handleSetLibraryStatus(libraryStatus === 'watchlist' ? null : 'watchlist')}
                        className={`px-3 py-2 text-[10px] font-bold transition-all cursor-pointer ${
                          libraryStatus === 'watchlist' ? 'bg-shasha-accent text-white' : 'text-white/60 hover:bg-white/5'
                        }`}
                      >
                        لاحقاً
                      </button>
                    </div>

                    {/* Watch with Friends Invite Room Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setShowRoomInviteDropdown(!showRoomInviteDropdown)}
                        className="px-4 py-2.5 rounded-xl bg-shasha-accent hover:bg-shasha-accent-hover text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" />
                        شاهد مع أصدقائك
                      </button>

                      <AnimatePresence>
                        {showRoomInviteDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="absolute top-11 left-0 w-52 glass-panel p-2.5 rounded-xl text-right flex flex-col gap-2 z-50 shadow-2xl"
                          >
                            <span className="text-[9px] font-bold text-white/40 block pb-1 border-b border-white/5">اختر غرفة لمشاهدة الفيلم</span>
                            {userRooms.map((room) => (
                              <button
                                key={room.id}
                                onClick={() => router.push(`/room/${room.id}`)}
                                className="w-full p-2 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/5 rounded-lg text-right truncate cursor-pointer transition-colors"
                              >
                                {room.name}
                              </button>
                            ))}
                            <button
                              onClick={() => router.push('/rooms')}
                              className="w-full p-2 text-xs font-semibold text-shasha-accent hover:bg-shasha-accent/5 rounded-lg text-right flex items-center justify-between cursor-pointer transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              إنشاء غرفة جديدة
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Title and Ratings */}
                  <div className="text-right z-10">
                    <h2 className="text-2xl font-bold text-white mb-2">{selectedMovie.title}</h2>
                    <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-shasha-secondary">
                      <span className="flex items-center gap-1 text-shasha-warning font-bold">
                        ⭐ {selectedMovie.vote_average.toFixed(1)}/10
                      </span>
                      <span>•</span>
                      {selectedMovie.runtime ? (
                        <>
                          <span className="flex items-center gap-1">
                            {selectedMovie.runtime} دقيقة
                            <Clock className="w-3.5 h-3.5" />
                          </span>
                          <span>•</span>
                        </>
                      ) : selectedMovie.episode_run_time && selectedMovie.episode_run_time.length > 0 ? (
                        <>
                          <span className="flex items-center gap-1">
                            {selectedMovie.episode_run_time[0]} دقيقة
                            <Clock className="w-3.5 h-3.5" />
                          </span>
                          <span>•</span>
                        </>
                      ) : null}
                      <span className="flex items-center gap-1">
                        {selectedMovie.release_date}
                        <Calendar className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Body Contents */}
              <div className="p-8 flex flex-col md:flex-row gap-8 bg-[#0c0c0f] text-right">
                
                {/* Left side: Trailer, recommends */}
                <div className="flex-1 flex flex-col gap-6 order-2 md:order-1">
                  
                  {/* Trailer Embed */}
                  {trailerKey ? (
                    <div className="flex flex-col gap-2.5">
                      <h4 className="text-xs font-bold text-white/50">العرض الدعائي (Trailer)</h4>
                      <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/5 bg-black">
                        <iframe
                          src={`https://www.youtube.com/embed/${trailerKey}`}
                          title="YouTube video player"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="w-full h-full"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl bg-white/3 border border-white/5 text-center text-xs text-shasha-secondary">
                      لا يوجد عرض دعائي متاح للفيلم
                    </div>
                  )}

                  {/* Recommendations */}
                  {recommendations.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <h4 className="text-xs font-bold text-white/50">أعمال مقترحة ومماثلة</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {recommendations.map((rec) => (
                          <div
                            key={rec.id}
                            onClick={() => handleOpenDetails(rec.id, selectedMovie.media_type)}
                            className="flex flex-col gap-1.5 cursor-pointer group"
                          >
                            <div className="aspect-[2/3] rounded-xl overflow-hidden border border-white/5 bg-white/3 relative">
                              <img src={`https://image.tmdb.org/t/p/w185${rec.poster_path}`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            </div>
                            <span className="text-[10px] font-semibold text-white/80 truncate text-center group-hover:text-shasha-accent transition-colors">
                              {selectedMovie.media_type === 'tv' ? (rec.original_name || rec.name) : (rec.original_title || rec.title)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* Right side: Overview, genres, cast */}
                <div className="w-full md:w-80 flex flex-col gap-6 order-1 md:order-2 shrink-0">
                  
                  {/* Overview Text */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-xs font-bold text-white/50">القصة والنبذة</h4>
                    <p className="text-xs text-white/90 leading-relaxed">
                      {selectedMovie.overview || 'لا يوجد وصف باللغة العربية متوفر حالياً لهذا العمل.'}
                    </p>
                  </div>

                  {/* Genres tags */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-xs font-bold text-white/50">التصنيفات</h4>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {selectedMovie.genres.map((g) => (
                        <span key={g.id} className="text-[10px] font-semibold text-white bg-white/5 px-2.5 py-1 rounded-full">
                          {g.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Cast list */}
                  {cast.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <h4 className="text-xs font-bold text-white/50">طاقم التمثيل</h4>
                      <div className="flex flex-col gap-2">
                        {cast.map((c) => (
                          <div key={c.id} className="flex items-center justify-end gap-2.5 p-1.5 rounded-xl bg-white/3">
                            <div className="flex flex-col text-right">
                              <span className="text-xs font-bold text-white">{c.name}</span>
                              <span className="text-[9px] text-shasha-secondary">{c.character}</span>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-white/5 overflow-hidden flex items-center justify-center font-bold text-[10px] text-white">
                              {c.profile_path ? (
                                <img src={`https://image.tmdb.org/t/p/w185${c.profile_path}`} alt="" className="w-full h-full object-cover" />
                              ) : (
                                c.name.charAt(0)
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
