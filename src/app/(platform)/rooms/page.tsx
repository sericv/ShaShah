'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Sparkles, Monitor, ArrowLeft, Plus, Clock, Users, ArrowRight } from 'lucide-react';

interface PersistentRoom {
  id: string;
  name: string;
  created_at: string;
  creator_id: string;
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
          creator_id: profile.id
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
          created_at: new Date().toISOString()
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

          <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-shasha-secondary mb-2">اسم الغرفة المستهدفة</label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="مثال: سهرة أفلام الجمعة"
                className="w-full px-4 py-3 rounded-xl glass-input text-right text-xs"
                maxLength={30}
                required
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-3.5 rounded-xl bg-shasha-accent text-white font-semibold text-xs transition-all hover:bg-shasha-accent-hover active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-shasha-accent/20 cursor-pointer disabled:opacity-55"
            >
              {creating ? (
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  إنشاء ودخول الغرفة
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

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
                      <span className="text-sm font-bold text-white group-hover:text-shasha-accent transition-colors">{room.name}</span>
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

    </div>
  );
}
