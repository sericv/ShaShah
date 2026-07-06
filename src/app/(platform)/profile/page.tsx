'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Film, Users, Monitor, Sparkles, Calendar } from 'lucide-react';

interface ProfileStats {
  moviesWatched: number;
  friendsCount: number;
  roomsCreated: number;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [stats, setStats] = useState<ProfileStats>({
    moviesWatched: 0,
    friendsCount: 0,
    roomsCreated: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfileData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setEmail(session.user.email || '—');

      // 1. Fetch Profile
      const { data: prof, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (!error && prof) {
        setProfile(prof);
      } else {
        setProfile({
          name: session.user.user_metadata?.name || '—',
          avatar_url: '',
          banner_url: '',
          created_at: session.user.created_at || new Date().toISOString()
        });
      }

      // 2. Fetch Stats directly from database (No hardcoding, no fake data)
      // count library items where status = 'watched'
      const { count: watchedCount, error: watchedErr } = await supabase
        .from('library')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('status', 'watched');

      // count friends
      const { count: friendsCount, error: friendsErr } = await supabase
        .from('friends')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`);

      // count rooms created
      const { count: roomsCount, error: roomsErr } = await supabase
        .from('persistent_rooms')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', session.user.id);

      setStats({
        moviesWatched: watchedErr ? 0 : (watchedCount || 0),
        friendsCount: friendsErr ? 0 : (friendsCount || 0),
        roomsCreated: roomsErr ? 0 : (roomsCount || 0)
      });

      setLoading(false);
    };

    loadProfileData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-shasha-bg flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-shasha-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long'
      })
    : '—';

  return (
    <div className="flex flex-col gap-8 text-right pb-10 max-w-3xl mx-auto">
      
      {/* Profile Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl overflow-hidden border border-white/5 bg-[#0c0c0f] flex flex-col relative"
      >
        {/* Banner Area */}
        <div className="h-44 bg-gradient-to-l from-shasha-accent/30 to-purple-600/20 relative">
          {profile?.banner_url && (
            <img src={profile.banner_url} alt="" className="w-full h-full object-cover opacity-60" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0f] to-transparent" />
        </div>

        {/* User basic details */}
        <div className="px-8 pb-6 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6 -mt-10 z-10">
          <div className="flex items-center gap-4 text-right flex-col sm:flex-row">
            <div className="flex flex-col text-right items-center sm:items-end">
              <h2 className="text-2xl font-bold text-white flex items-center gap-1.5 mt-2 sm:mt-0">
                {profile?.name || '—'}
                <Sparkles className="w-5 h-5 text-shasha-accent" />
              </h2>
              <span className="text-xs text-shasha-accent font-semibold mt-0.5" dir="ltr">
                @{profile?.username || '—'}
              </span>
              <span className="text-xs text-shasha-secondary mt-0.5">{email}</span>
              <span className="text-[10px] text-white/40 mt-1 flex items-center gap-1">
                عضو منذ: {joinDate}
                <Calendar className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="w-20 h-20 rounded-full bg-zinc-950 border-4 border-[#0c0c0f] flex items-center justify-center font-bold text-3xl text-shasha-accent overflow-hidden shadow-2xl">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                (profile?.name || '—').charAt(0)
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'أفلام شوهدت', val: stats.moviesWatched, icon: Film, color: 'text-shasha-accent' },
          { label: 'الأصدقاء المضافون', val: stats.friendsCount, icon: Users, color: 'text-shasha-success' },
          { label: 'غرف بث منشأة', val: stats.roomsCreated, icon: Monitor, color: 'text-cyan-500' },
        ].map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className="glass-panel p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center gap-1"
          >
            <item.icon className={`w-6 h-6 mb-2 ${item.color}`} />
            <span className="text-xs text-shasha-secondary font-medium">{item.label}</span>
            <span className="text-lg font-bold text-white leading-tight">{item.val}</span>
          </motion.div>
        ))}
      </div>

    </div>
  );
}
