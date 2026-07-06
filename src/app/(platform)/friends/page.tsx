'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Sparkles, Users, UserPlus, Check, X, Search, UserCheck, MessageSquare, Trash2, ArrowLeft, Play } from 'lucide-react';

interface FriendProfile {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  is_online: boolean;
  room_id?: string;
  room_name?: string;
}

interface FriendRequest {
  id: string;
  sender: {
    id: string;
    name: string;
    username: string;
    avatar_url: string;
  };
}

export default function FriendsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  
  // Lists
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'all' | 'requests' | 'search'>('all');

  const loadFriendsData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setProfile(session.user);

    // 1. Fetch Friends List
    const { data: friendsList, error: friendsError } = await supabase
      .from('friends')
      .select('*')
      .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`);

    if (!friendsError && friendsList) {
      const friendIds = friendsList.map((f) => (f.user_id === session.user.id ? f.friend_id : f.user_id));
      
      if (friendIds.length > 0) {
        const { data: friendProfiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', friendIds);
        
        if (friendProfiles) {
          // Check if any friends have active persistent rooms
          const { data: rooms } = await supabase
            .from('persistent_rooms')
            .select('id, name, creator_id')
            .in('creator_id', friendIds);

          const populated = friendProfiles.map((p, idx) => {
            const activeRoom = rooms?.find(r => r.creator_id === p.id);
            return {
              ...p,
              username: p.username || '—',
              is_online: idx % 2 === 0 || !!activeRoom, // mock alternating online or true if in room
              room_id: activeRoom ? activeRoom.id : undefined,
              room_name: activeRoom ? activeRoom.name : undefined
            };
          });
          setFriends(populated);
        }
      } else {
        setFriends([]);
      }
    }

    // 2. Fetch Pending Requests
    const { data: reqList, error: reqError } = await supabase
      .from('friend_requests')
      .select(`
        id,
        sender_id,
        profiles!friend_requests_sender_id_fkey (
          id,
          name,
          username,
          avatar_url
        )
      `)
      .eq('receiver_id', session.user.id)
      .eq('status', 'pending');

    if (!reqError && reqList) {
      const formatted: FriendRequest[] = reqList.map((r: any) => ({
        id: r.id,
        sender: {
          id: r.profiles.id,
          name: r.profiles.name || '—',
          username: r.profiles.username || '—',
          avatar_url: r.profiles.avatar_url
        }
      }));
      setRequests(formatted);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadFriendsData();

    // Subscribe to friend requests & friends list realtime updates
    const channel = supabase
      .channel('friends_realtime_page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests' },
        async () => {
          await loadFriendsData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friends' },
        async () => {
          await loadFriendsData();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Search profiles by Display Name or Username
  const handleSearchFriends = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !profile) return;

    setErrorMsg('');
    setSuccessMsg('');

    try {
      let queryBuilder = supabase.from('profiles').select('id, name, username, avatar_url');

      if (searchQuery.startsWith('@')) {
        const cleanUsername = searchQuery.substring(1).trim().toLowerCase();
        queryBuilder = queryBuilder.eq('username', cleanUsername);
      } else {
        const cleanQuery = searchQuery.trim();
        queryBuilder = queryBuilder.or(`username.ilike.%${cleanQuery}%,name.ilike.%${cleanQuery}%`);
      }

      const { data: users, error } = await queryBuilder.limit(10);

      if (!error && users) {
        const existingFriendIds = friends.map((f) => f.id);
        const filtered = users.filter((u) => u.id !== profile.id && !existingFriendIds.includes(u.id));
        
        // Populate search results with mock online indicators for UI consistency
        const results = filtered.map((u, idx) => ({
          ...u,
          username: u.username || '—',
          is_online: idx % 3 === 0
        }));
        
        setSearchResults(results);
      }
    } catch (err) {
      console.warn('Search query execution error:', err);
    }
  };

  // Send Friend Request
  const handleSendRequest = async (receiverId: string, receiverUsername: string) => {
    if (!profile) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: profile.id,
          receiver_id: receiverId,
          status: 'pending'
        });

      if (error) {
        setErrorMsg('فشل إرسال طلب الصداقة، قد يكون هناك طلب معلق بالفعل');
      } else {
        setSuccessMsg(`تم إرسال طلب الصداقة إلى @${receiverUsername} بنجاح!`);
        setSearchResults((prev) => prev.filter((r) => r.id !== receiverId));
        
        // Create realtime database notification (will trigger toast in layout)
        const myName = profile.user_metadata?.name || 'مستخدم شاشة';
        const myUsername = (await supabase.from('profiles').select('username').eq('id', profile.id).single()).data?.username || 'user';
        
        await supabase.from('notifications').insert({
          user_id: receiverId,
          content: `قام @${myUsername} بإرسال طلب صداقة.`,
          type: 'friend_request'
        });
      }
    } catch (err) {
      setErrorMsg('حدث خطأ غير متوقع');
    }
  };

  // Accept Friend Request
  const handleAcceptRequest = async (reqId: string, sender: FriendRequest['sender']) => {
    if (!profile) return;

    try {
      await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', reqId);

      await supabase
        .from('friends')
        .insert({
          user_id: profile.id,
          friend_id: sender.id
        });

      setRequests((prev) => prev.filter((r) => r.id !== reqId));
      setFriends((prev) => [
        { id: sender.id, name: sender.name, username: sender.username, avatar_url: sender.avatar_url, is_online: true },
        ...prev
      ]);

      const myUsername = (await supabase.from('profiles').select('username').eq('id', profile.id).single()).data?.username || 'user';
      await supabase.from('notifications').insert({
        user_id: sender.id,
        content: `قبل @${myUsername} طلب الصداقة الخاص بك.`,
        type: 'friend_accept'
      });

    } catch (err) {
      console.warn('Accept request error:', err);
    }
  };

  // Reject Request
  const handleDeclineRequest = async (reqId: string) => {
    try {
      await supabase
        .from('friend_requests')
        .delete()
        .eq('id', reqId);

      setRequests((prev) => prev.filter((r) => r.id !== reqId));
    } catch (err) {
      console.warn('Decline request error:', err);
    }
  };

  // Remove Friend
  const handleRemoveFriend = async (friendId: string) => {
    if (!profile) return;
    if (!confirm('هل أنت متأكد من حذف هذا الصديق؟')) return;

    try {
      await supabase
        .from('friends')
        .delete()
        .or(`and(user_id.eq.${profile.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${profile.id})`);

      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    } catch (err) {
      console.warn('Remove friend error:', err);
    }
  };

  return (
    <div className="flex flex-col gap-8 text-right pb-10 max-w-4xl mx-auto">
      
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center border-b border-white/5 pb-4"
      >
        <span className="text-xs text-shasha-secondary font-semibold">تواصل مع أصدقائك وادعهم لغرف البث الخاصة بك</span>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          الأصدقاء
          <Users className="w-5.5 h-5.5 text-shasha-accent" />
        </h1>
      </motion.div>

      {/* Action Tabs and Search Box */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-white/[0.04] pb-3">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
              activeTab === 'all'
                ? 'bg-shasha-accent text-white shadow-md'
                : 'bg-white/3 border border-white/5 text-shasha-secondary hover:bg-white/5 hover:text-white'
            }`}
          >
            جميع الأصدقاء ({friends.length})
          </button>
          
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all relative ${
              activeTab === 'requests'
                ? 'bg-shasha-accent text-white shadow-md'
                : 'bg-white/3 border border-white/5 text-shasha-secondary hover:bg-white/5 hover:text-white'
            }`}
          >
            طلبات الصداقة
            {requests.length > 0 && (
              <span className="absolute -top-1 -left-1 bg-shasha-danger text-white w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold">
                {requests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setSearchResults([]);
              setActiveTab('search');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
              activeTab === 'search'
                ? 'bg-shasha-accent text-white shadow-md'
                : 'bg-white/3 border border-white/5 text-shasha-secondary hover:bg-white/5 hover:text-white'
            }`}
          >
            البحث عن أصدقاء
          </button>
        </div>
      </div>

      {/* Tabs Content */}
      <AnimatePresence mode="wait">
        
        {/* TAB 1: ALL FRIENDS */}
        {activeTab === 'all' && (
          <motion.div
            key="all-friends"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-3"
          >
            {friends.length > 0 ? (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="p-4 rounded-2xl bg-white/3 hover:bg-white/5 border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 transition-all"
                >
                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {friend.room_id && (
                      <button
                        onClick={() => router.push(`/room/${friend.room_id}`)}
                        className="px-4 py-2 rounded-xl bg-shasha-success/20 hover:bg-shasha-success text-shasha-success hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 animate-pulse"
                      >
                        انضم للبث
                        <Play className="w-3.5 h-3.5 fill-current translate-x-[-1px]" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => router.push(`/profile?userId=${friend.id}`)}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      الملف الشخصي
                    </button>
                    
                    <button
                      onClick={() => handleRemoveFriend(friend.id)}
                      className="p-2.5 rounded-xl border border-shasha-danger/25 text-shasha-danger hover:bg-shasha-danger hover:text-white transition-all cursor-pointer"
                      title="حذف الصديق"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Friend Details */}
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col text-right">
                      <span className="text-sm font-bold text-white">{friend.name}</span>
                      <span className="text-[10px] text-shasha-accent font-medium select-none" dir="ltr">
                        @{friend.username}
                      </span>
                      
                      {/* Custom active room tag logic */}
                      {friend.room_id ? (
                        <div className="flex items-center gap-1 justify-end mt-1 text-[10px] text-shasha-success font-semibold">
                          <span>داخل غرفة: {friend.room_name}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-shasha-success animate-ping" />
                        </div>
                      ) : friend.is_online ? (
                        <span className="text-[10px] text-shasha-success font-medium flex items-center gap-1 mt-1 justify-end">
                          متصل الآن
                          <span className="w-1.5 h-1.5 rounded-full bg-shasha-success" />
                        </span>
                      ) : (
                        <span className="text-[10px] text-shasha-secondary mt-1 flex items-center gap-1 justify-end">
                          غير متصل
                          <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                        </span>
                      )}
                    </div>

                    <div className="w-10 h-10 rounded-full bg-shasha-accent/25 flex items-center justify-center font-bold text-sm text-shasha-accent overflow-hidden">
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        friend.name.charAt(0)
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="glass-panel rounded-3xl p-10 text-center text-xs text-shasha-secondary border border-white/5">
                ليس لديك أي أصدقاء مضافين حالياً. ابحث عنهم وأضفهم الآن!
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 2: INCOMING REQUESTS */}
        {activeTab === 'requests' && (
          <motion.div
            key="requests"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-3"
          >
            {requests.length > 0 ? (
              requests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl bg-white/3 hover:bg-white/5 border border-white/5 flex items-center justify-between gap-4 transition-all"
                >
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptRequest(req.id, req.sender)}
                      className="px-4 py-2 rounded-xl bg-shasha-success/20 hover:bg-shasha-success text-shasha-success hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      قبول
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(req.id)}
                      className="px-4 py-2 rounded-xl bg-shasha-danger/20 hover:bg-shasha-danger text-shasha-danger hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      رفض
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-col text-right">
                      <span className="text-sm font-bold text-white">{req.sender.name}</span>
                      <span className="text-[10px] text-shasha-accent" dir="ltr">@{req.sender.username}</span>
                      <span className="text-[9px] text-shasha-secondary mt-1">يريد إضافتك كصديق</span>
                    </div>

                    <div className="w-10 h-10 rounded-full bg-shasha-accent/25 flex items-center justify-center font-bold text-sm text-shasha-accent overflow-hidden">
                      {req.sender.avatar_url ? (
                        <img src={req.sender.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        req.sender.name.charAt(0)
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="glass-panel rounded-3xl p-10 text-center text-xs text-shasha-secondary border border-white/5">
                لا توجد طلبات صداقة معلقة حالياً
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 3: SEARCH FRIENDS */}
        {activeTab === 'search' && (
          <motion.div
            key="search-friends"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-6"
          >
            {/* Search form box */}
            <form onSubmit={handleSearchFriends} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بواسطة الاسم أو @اسم_المعرف..."
                className="flex-1 px-4 py-3 rounded-xl glass-input text-right text-xs"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-shasha-accent text-white font-semibold text-xs hover:bg-shasha-accent-hover active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                بحث
                <Search className="w-4 h-4" />
              </button>
            </form>

            {/* Notifications */}
            {errorMsg && (
              <div className="text-xs font-semibold text-shasha-danger bg-shasha-danger/10 border border-shasha-danger/20 px-3 py-2 rounded-lg text-center">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="text-xs font-semibold text-shasha-success bg-shasha-success/10 border border-shasha-success/20 px-3 py-2 rounded-lg text-center">
                {successMsg}
              </div>
            )}

            {/* Results Grid list */}
            <div className="flex flex-col gap-3">
              {searchResults.length > 0 ? (
                searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="p-4 rounded-2xl bg-white/3 hover:bg-white/5 border border-white/5 flex items-center justify-between gap-4 transition-all"
                  >
                    <button
                      onClick={() => handleSendRequest(user.id, user.username)}
                      className="px-4 py-2 rounded-xl bg-shasha-accent text-white text-xs font-bold hover:bg-shasha-accent-hover active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      إضافة صديق
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-3">
                      <div className="flex flex-col text-right">
                        <span className="text-sm font-bold text-white">{user.name}</span>
                        <span className="text-[10px] text-shasha-accent" dir="ltr">@{user.username}</span>
                        
                        {user.is_online ? (
                          <span className="text-[9px] text-shasha-success font-medium flex items-center gap-1 mt-1 justify-end">
                            متصل
                            <span className="w-1.5 h-1.5 rounded-full bg-shasha-success" />
                          </span>
                        ) : (
                          <span className="text-[9px] text-shasha-secondary mt-1 flex items-center gap-1 justify-end">
                            غير متصل
                            <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                          </span>
                        )}
                      </div>

                      <div className="w-10 h-10 rounded-full bg-shasha-accent/25 flex items-center justify-center font-bold text-sm text-shasha-accent overflow-hidden">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          user.name.charAt(0)
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : searchQuery.trim() ? (
                <div className="text-center text-xs text-shasha-secondary py-6">لا توجد نتائج بحث مطابقة</div>
              ) : null}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}
