'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import {
  Film, Users, Monitor, Sparkles, Calendar, Clock, Star, Heart,
  Bookmark, Tv, Globe, Shield, MessageSquare, ThumbsUp, Play,
  UserPlus, UserCheck, Trophy, Eye, List, PenSquare,
  Activity, MapPin, Tags, Clock as ClockIcon
} from 'lucide-react';
import UserAvatar from '@/components/ui/UserAvatar';
import type {
  UserProfile, LibraryItem, FavoriteItem, MovieRating, Review,
  ActivityLogItem, ActivityType
} from '@/types/profile';
import { ACTIVITY_LABELS } from '@/types/profile';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

function PosterCarousel({ items, title }: { items: (FavoriteItem | LibraryItem)[], title: string }) {
  const [scrollPos, setScrollPos] = useState(0);
  const scrollRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    el.scrollTo({ left: scrollPos, behavior: 'smooth' });
  }, [scrollPos]);

  const openMovie = (id: string) => {
    window.open(`/explore?movieId=${id}`, '_blank');
  };

  if (!items.length) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        {title}
        <span className="text-[10px] text-shasha-secondary font-normal">({items.length})</span>
      </h3>
      <div className="relative group">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-none pb-2"
          onScroll={(e) => setScrollPos(e.currentTarget.scrollLeft)}
        >
          {items.map((item) => {
            const posterPath = (item as any).poster_path;
            const title_text = (item as any).movie_title || (item as any).title || '';
            const id = (item as any).movie_id || (item as any).tmdb_id || '';
            return (
              <div
                key={item.id}
                onClick={() => openMovie(id)}
                className="flex-shrink-0 w-28 cursor-pointer hover:scale-105 transition-transform duration-200"
              >
                <div className="w-28 h-40 rounded-xl overflow-hidden bg-white/5 border border-white/10">
                  {posterPath ? (
                    <img src={`${TMDB_IMAGE_BASE}/w185${posterPath}`} alt={title_text} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">{title_text.charAt(0)}</div>
                  )}
                </div>
                <p className="text-[10px] text-white/70 mt-1.5 truncate text-center font-medium">{title_text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AchievementGrid({ achievements, allAchievements }: { achievements: any[], allAchievements: any[] }) {
  if (!allAchievements.length) return null;

  const unlocked = new Set(achievements.map((a) => a.achievement_id));

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-500" />
        الإنجازات
        <span className="text-[10px] text-shasha-secondary font-normal">({achievements.length}/{allAchievements.length})</span>
      </h3>
      <div className="flex flex-wrap gap-2">
        {allAchievements.map((ach) => {
          const has = unlocked.has(ach.id);
          return (
            <div
              key={ach.id}
              title={has ? ach.description : '🔒 مقفل'}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold border transition-all ${
                has
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-zinc-800/50 border-zinc-700/30 text-zinc-600'
              }`}
            >
              <span className="ml-1">{has ? ach.icon : '🔒'}</span>
              {ach.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityTimeline({ items }: { items: ActivityLogItem[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <Activity className="w-4 h-4 text-shasha-accent" />
        النشاطات الأخيرة
      </h3>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => {
          const label = ACTIVITY_LABELS[item.activity_type as ActivityType];
          const icon = label?.icon || '📌';
          const text = label?.text || item.activity_type;
          const time = new Date(item.created_at).toLocaleDateString('ar-EG', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          });
          return (
            <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all">
              <span className="text-lg">{icon}</span>
              <div className="flex-1 text-right">
                <span className="text-xs text-white/80">{text}</span>
                {item.tmdb_id && (
                  <span className="text-xs text-shasha-accent mr-1.5">{item.metadata?.title || ''}</span>
                )}
              </div>
              <span className="text-[9px] text-white/30 font-mono shrink-0">{time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RatingStars({ rating, max = 10 }: { rating: number; max?: number }) {
  const stars = Math.round(rating / 2);
  return (
    <div className="flex items-center gap-0.5" dir="ltr">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3 h-3 ${i < stars ? 'text-amber-400 fill-amber-400' : 'text-zinc-600'}`} />
      ))}
      <span className="text-[10px] text-white/50 mr-1">{rating}/{max}</span>
    </div>
  );
}

export default function ProfilePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const targetUserId = searchParams.get('userId');

  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  const [moviesWatched, setMoviesWatched] = useState(0);
  const [seriesWatched, setSeriesWatched] = useState(0);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);
  const [roomsCreated, setRoomsCreated] = useState(0);

  const [favoritesMovie, setFavoritesMovie] = useState<FavoriteItem[]>([]);
  const [favoritesTv, setFavoritesTv] = useState<FavoriteItem[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<LibraryItem[]>([]);
  const [watchlist, setWatchlist] = useState<LibraryItem[]>([]);
  const [ratings, setRatings] = useState<MovieRating[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activity, setActivity] = useState<ActivityLogItem[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [allAchievements, setAllAchievements] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [isFriend, setIsFriend] = useState(false);
  const [hasSentRequest, setHasSentRequest] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setCurrentUserId(session.user.id);
    });
  }, []);

  // Subscribe to global presence to check online status
  useEffect(() => {
    const ch = supabase.channel('shasha_global_presence_profile', {
      config: { presence: { key: 'profile_viewer' } },
    });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<any>();
      const active: Record<string, any> = {};
      Object.keys(state).forEach((key) => {
        const list = state[key];
        if (list?.length) active[key] = list[0];
      });
      setOnlineUsers(active);
    }).subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  const loadProfile = useCallback(async (userId: string, currentId: string) => {
    setLoading(true);
    const own = userId === currentId;
    setIsOwnProfile(own);

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (prof) setProfile(prof as UserProfile);

    const { data: sets } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
    if (sets) setSettings(sets);

    const { count: mw } = await supabase.from('library').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('media_type', 'movie').eq('status', 'watched');
    setMoviesWatched(mw || 0);

    const { count: sw } = await supabase.from('library').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('media_type', 'tv').eq('status', 'watched');
    setSeriesWatched(sw || 0);

    const { count: wl } = await supabase.from('library').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'watchlist');
    setWatchlistCount(wl || 0);

    const { count: fc } = await supabase.from('friends').select('*', { count: 'exact', head: true }).or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    setFriendsCount(fc || 0);

    const { count: rc } = await supabase.from('persistent_rooms').select('*', { count: 'exact', head: true }).eq('creator_id', userId);
    setRoomsCreated(rc || 0);

    if (own || sets?.privacy_status === 'public') {
      const { data: fav } = await supabase.from('favorites').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (fav) {
        setFavoritesMovie(fav.filter((f) => f.media_type === 'movie').slice(0, 20));
        setFavoritesTv(fav.filter((f) => f.media_type === 'tv').slice(0, 20));
      }

      if (!sets?.hide_watch_history) {
        const { data: rw } = await supabase.from('library').select('*').eq('user_id', userId).eq('status', 'watched').order('created_at', { ascending: false }).limit(20);
        if (rw) setRecentlyWatched(rw as LibraryItem[]);
      }

      if (!sets?.hide_watchlist) {
        const { data: wlData } = await supabase.from('library').select('*').eq('user_id', userId).eq('status', 'watchlist').order('created_at', { ascending: false }).limit(20);
        if (wlData) setWatchlist(wlData as LibraryItem[]);
      }

      if (!sets?.hide_ratings) {
        const { data: rData } = await supabase.from('movie_ratings').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
        if (rData) setRatings(rData as MovieRating[]);
        const { data: revData } = await supabase.from('reviews').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
        if (revData) setReviews(revData as Review[]);
      }

      if (!sets?.hide_activity) {
        const { data: act } = await supabase.from('activity_log').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
        if (act) setActivity(act as ActivityLogItem[]);
      }

      const { data: ua } = await supabase.from('user_achievements').select('*, achievement:achievements(*)').eq('user_id', userId);
      if (ua) setAchievements(ua);
      const { data: aa } = await supabase.from('achievements').select('*');
      if (aa) setAllAchievements(aa);
    }

    if (!own && currentId) {
      const { data: fChk } = await supabase.from('friends').select('*').or(`and(user_id.eq.${currentId},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentId})`).maybeSingle();
      setIsFriend(!!fChk);

      const { data: rChk } = await supabase.from('friend_requests').select('*').eq('sender_id', currentId).eq('receiver_id', userId).eq('status', 'pending').maybeSingle();
      setHasSentRequest(!!rChk);

      const { data: fRel } = await supabase.from('friends').select('*').or(`user_id.eq.${userId},friend_id.eq.${userId}`);
      if (fRel) {
        const ids = fRel.map((f) => f.user_id === userId ? f.friend_id : f.user_id);
        if (ids.length > 0) {
          const { data: fp } = await supabase.from('profiles').select('id, name, username, avatar_url').in('id', ids).limit(6);
          if (fp) setFriends(fp);
        }
      }
    }

    if (prof) {
      const presence = onlineUsers[userId];
      setIsOnline(!!presence);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const uid = targetUserId || currentUserId;
    loadProfile(uid, currentUserId);
  }, [targetUserId, currentUserId, loadProfile]);

  // Real-time subscriptions
  useEffect(() => {
    if (!profile) return;
    const uid = profile.id;
    const chs: any[] = [];
    const tables = ['favorites', 'library', 'movie_ratings', 'reviews', 'activity_log'];
    tables.forEach((t) => {
      const ch = supabase.channel(`prof_${t}_${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `user_id=eq.${uid}` },
          () => loadProfile(uid, currentUserId)
        ).subscribe();
      chs.push(ch);
    });
    const fch = supabase.channel(`prof_friends_${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' },
        () => loadProfile(uid, currentUserId)
      ).subscribe();
    chs.push(fch);

    return () => chs.forEach((ch) => ch.unsubscribe());
  }, [profile?.id]);

  const handleSendFriendRequest = async () => {
    if (!currentUserId || !profile) return;
    await supabase.from('friend_requests').insert({ sender_id: currentUserId, receiver_id: profile.id, status: 'pending' });
    await supabase.from('notifications').insert({ user_id: profile.id, content: `أرسل لك ${profile.name || 'مستخدم'} طلب صداقة.`, type: 'friend_request' });
    setHasSentRequest(true);
  };

  const handleRemoveFriend = async () => {
    if (!currentUserId || !profile) return;
    await supabase.from('friends').delete().or(`and(user_id.eq.${currentUserId},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${currentUserId})`);
    setIsFriend(false);
  };

  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  const statItems = [
    { label: 'أفلام شوهدت', val: moviesWatched, icon: Film, color: 'text-shasha-accent' },
    { label: 'مسلسلات شوهدت', val: seriesWatched, icon: Tv, color: 'text-purple-500' },
    { label: 'قائمة المشاهدة', val: watchlistCount, icon: Bookmark, color: 'text-amber-500' },
    { label: 'الأصدقاء', val: friendsCount, icon: Users, color: 'text-shasha-success' },
    { label: 'غرف منشأة', val: roomsCreated, icon: Monitor, color: 'text-cyan-500' },
    { label: 'ساعات المشاهدة', val: profile?.hours_watched || 0, icon: Clock, color: 'text-rose-500' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-shasha-bg flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-shasha-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-shasha-bg flex flex-col items-center justify-center px-4">
        <div className="glass-panel p-8 rounded-[24px] max-w-sm w-full text-center">
          <h2 className="text-xl font-bold mb-2">الملف الشخصي غير موجود</h2>
          <p className="text-sm text-shasha-secondary mb-6">لم نتمكن من العثور على هذا المستخدم</p>
          <button onClick={() => router.push('/dashboard')} className="w-full py-3 rounded-xl bg-shasha-accent text-white font-semibold cursor-pointer">العودة للرئيسية</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 text-right pb-10 max-w-5xl mx-auto">

      {/* ============ PROFILE HEADER ============ */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl overflow-hidden border border-white/5 bg-[#0c0c0f] flex flex-col relative">
        <div className="h-48 bg-gradient-to-l from-shasha-accent/30 via-purple-600/10 to-transparent relative">
          {profile?.banner_url && <img src={profile.banner_url} alt="" className="w-full h-full object-cover opacity-50" />}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0f] via-[#0c0c0f]/40 to-transparent" />
        </div>

        <div className="px-8 pb-6 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6 -mt-14 z-10">
          <div className="flex items-center gap-5 text-right flex-col sm:flex-row">
            <UserAvatar userId={profile.id} name={profile.name || '—'} avatarUrl={profile.avatar_url} size="xl" isOnline={isOnline} showStatus className="border-4 border-[#0c0c0f] rounded-full" />
            <div className="flex flex-col text-right items-center sm:items-end">
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <h2 className="text-2xl font-bold text-white">{profile.name || '—'}</h2>
                <Sparkles className="w-5 h-5 text-shasha-accent" />
              </div>
              <span className="text-xs text-shasha-accent font-semibold" dir="ltr">@{profile.username || '—'}</span>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap justify-end">
                {profile.country && <span className="text-[10px] text-white/50 flex items-center gap-1"><MapPin className="w-3 h-3" />{profile.country}</span>}
                <span className="text-[10px] text-white/40 flex items-center gap-1"><Calendar className="w-3 h-3" />عضو منذ {joinDate}</span>
                {isOnline ? (
                  <span className="text-[10px] text-shasha-success flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-shasha-success animate-pulse" />متصل الآن</span>
                ) : (
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />غير متصل</span>
                )}
              </div>
              {profile.bio && <p className="text-xs text-white/60 mt-2 max-w-md leading-relaxed">{profile.bio}</p>}
              {profile.favorite_genre && (
                <div className="flex items-center gap-1.5 mt-2 justify-end">
                  <span className="text-[10px] text-white/40">النوع المفضل:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-shasha-accent/15 border border-shasha-accent/25 text-[10px] text-shasha-accent font-semibold">{profile.favorite_genre}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons for non-own profiles */}
          {!isOwnProfile && currentUserId && (
            <div className="flex gap-2 self-start mt-4 sm:mt-0">
              {isFriend ? (
                <button onClick={handleRemoveFriend} className="px-4 py-2 rounded-xl border border-shasha-danger/30 text-shasha-danger hover:bg-shasha-danger hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5">
                  إزالة الصديق <UserCheck className="w-3.5 h-3.5" />
                </button>
              ) : hasSentRequest ? (
                <span className="px-4 py-2 rounded-xl bg-white/5 text-white/50 text-xs font-semibold flex items-center gap-1.5 border border-white/10">
                  في انتظار القبول <ClockIcon className="w-3.5 h-3.5" />
                </span>
              ) : (
                <button onClick={handleSendFriendRequest} className="px-4 py-2 rounded-xl bg-shasha-accent text-white text-xs font-bold hover:bg-shasha-accent-hover transition-all cursor-pointer flex items-center gap-1.5">
                  أضف صديقاً <UserPlus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* ============ STATS GRID ============ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statItems.map((item, idx) => (
          <motion.div key={idx} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.03 }}
            className="glass-panel p-4 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center gap-1"
          >
            <item.icon className={`w-5 h-5 mb-1 ${item.color}`} />
            <span className="text-[10px] text-shasha-secondary font-medium">{item.label}</span>
            <span className="text-lg font-bold text-white leading-tight">{item.val}</span>
          </motion.div>
        ))}
      </div>

      {/* ============ FAVORITE MOVIES ============ */}
      <div className="glass-panel p-5 rounded-3xl border border-white/5">
        <PosterCarousel items={favoritesMovie} title="⭐ الأفلام المفضلة" />
      </div>

      {/* ============ FAVORITE TV SHOWS ============ */}
      {favoritesTv.length > 0 && (
        <div className="glass-panel p-5 rounded-3xl border border-white/5">
          <PosterCarousel items={favoritesTv} title="📺 المسلسلات المفضلة" />
        </div>
      )}

      {/* ============ RECENTLY WATCHED ============ */}
      {recentlyWatched.length > 0 && (
        <div className="glass-panel p-5 rounded-3xl border border-white/5">
          <PosterCarousel items={recentlyWatched} title="🎬 شوهدت مؤخراً" />
        </div>
      )}

      {/* ============ WATCHLIST ============ */}
      {watchlist.length > 0 && (
        <div className="glass-panel p-5 rounded-3xl border border-white/5">
          <PosterCarousel items={watchlist} title="📋 قائمة المشاهدة" />
        </div>
      )}

      {/* ============ RATINGS ============ */}
      {ratings.length > 0 && (
        <div className="glass-panel p-5 rounded-3xl border border-white/5 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            التقييمات
          </h3>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {ratings.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <RatingStars rating={r.rating} />
                  <span className="text-[10px] text-white/30 font-mono">
                    {new Date(r.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white/70">{r.tmdb_id && `#${r.tmdb_id}`}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ REVIEWS ============ */}
      {reviews.length > 0 && (
        <div className="glass-panel p-5 rounded-3xl border border-white/5 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-shasha-accent" />
            المراجعات
            <span className="text-[10px] text-shasha-secondary font-normal">({reviews.length})</span>
          </h3>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {reviews.map((rev) => (
              <div key={rev.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-3 h-3 text-white/30" />
                    <span className="text-[10px] text-white/30">{rev.likes_count}</span>
                    <MessageSquare className="w-3 h-3 text-white/30 mr-1" />
                    <span className="text-[10px] text-white/30">{rev.comments_count}</span>
                  </div>
                  <span className="text-[10px] text-white/30 font-mono">
                    {new Date(rev.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs text-white/70 leading-relaxed line-clamp-3">{rev.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ ACTIVITY TIMELINE ============ */}
      {activity.length > 0 && (
        <div className="glass-panel p-5 rounded-3xl border border-white/5">
          <ActivityTimeline items={activity} />
        </div>
      )}

      {/* ============ ACHIEVEMENTS ============ */}
      <div className="glass-panel p-5 rounded-3xl border border-white/5">
        <AchievementGrid achievements={achievements} allAchievements={allAchievements} />
      </div>

      {/* ============ FRIENDS ============ */}
      {friends.length > 0 && (
        <div className="glass-panel p-5 rounded-3xl border border-white/5 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-shasha-success" />
            الأصدقاء
            <span className="text-[10px] text-shasha-secondary font-normal">({friendsCount})</span>
          </h3>
          <div className="flex flex-wrap gap-3">
            {friends.map((f) => (
              <div key={f.id} className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] transition-all cursor-pointer"
                onClick={() => router.push(`/profile?userId=${f.id}`)}
              >
                <UserAvatar userId={f.id} name={f.name} avatarUrl={f.avatar_url} size="sm" />
                <div className="flex flex-col text-right">
                  <span className="text-xs font-semibold text-white">{f.name}</span>
                  <span className="text-[9px] text-shasha-secondary" dir="ltr">@{f.username}</span>
                </div>
              </div>
            ))}
            {friendsCount > friends.length && (
              <Link href="/friends" className="text-[10px] text-shasha-accent self-center mr-2 hover:underline">
                +{friendsCount - friends.length} آخرون
              </Link>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
