'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Mic, Shield, Video, Sparkles, ArrowLeft, ArrowRight, Check, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Generate human-friendly room IDs
const ADJECTIVES = ['cyber', 'quantum', 'neon', 'cosmic', 'aurora', 'shadow', 'stellar', 'sonic', 'hyper', 'alpha'];
const NOUNS = ['fox', 'falcon', 'wolf', 'phoenix', 'lynx', 'panther', 'ranger', 'vortex', 'matrix', 'beacon'];

function generateRoomId() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${adj}-${noun}-${num}`;
}

export default function Home() {
  const router = useRouter();
  const [roomIdInput, setRoomIdInput] = useState('');
  const [userName, setUserName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);

  // Decorative particles client-side state to prevent hydration mismatch
  interface Particle {
    top: string;
    left: string;
    width: string;
    height: string;
    duration: number;
  }
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Initialize random username and particles after mount
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('shasha_user_name');
      if (savedName) {
        setUserName(savedName);
      } else {
        const randNum = Math.floor(Math.random() * 900) + 100;
        setUserName(`ضيف-${randNum}`);
      }
    }

    const generated: Particle[] = [...Array(6)].map(() => ({
      top: `${Math.random() * 80 + 10}%`,
      left: `${Math.random() * 80 + 10}%`,
      width: `${Math.random() * 4 + 2}px`,
      height: `${Math.random() * 4 + 2}px`,
      duration: 5 + Math.random() * 5,
    }));
    setParticles(generated);
  }, []);

  const saveUserName = (name: string) => {
    setUserName(name);
    if (typeof window !== 'undefined') {
      localStorage.setItem('shasha_user_name', name);
    }
  };

  // Handle Room Creation
  const handleCreateRoom = async () => {
    if (!userName.trim()) {
      setErrorMsg('الرجاء إدخال اسمك أولاً');
      return;
    }
    setIsCreating(true);
    setErrorMsg('');

    const newRoomId = generateRoomId();
    const newRoomName = `غرفة ${userName}`;

    try {
      // Insert room into Supabase
      const { error } = await supabase
        .from('rooms')
        .insert([{ id: newRoomId, name: newRoomName }]);

      if (error) {
        console.warn('Supabase DB Rooms insert failed. Falling back to local/broadcast room.', error);
      }
      
      router.push(`/room/${newRoomId}`);
    } catch (err: any) {
      console.warn('Supabase DB rooms error, using fallback:', err);
      router.push(`/room/${newRoomId}`);
    }
  };

  // Handle Joining Room
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomIdInput.trim()) {
      setErrorMsg('الرجاء إدخال رمز الغرفة');
      return;
    }
    if (!userName.trim()) {
      setErrorMsg('الرجاء إدخال اسمك أولاً');
      return;
    }

    setIsJoining(true);
    setErrorMsg('');

    try {
      // Verify if room exists in Supabase
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomIdInput.trim().toLowerCase())
        .single();

      if (error) {
        // If room is actually missing from a configured table
        if (error.code === 'PGRST116') {
          setErrorMsg('الغرفة غير موجودة، يرجى التحقق من الرمز');
          setIsJoining(false);
          return;
        }
        
        console.warn('Supabase DB Rooms check failed. Falling back to local join.', error);
      }

      router.push(`/room/${roomIdInput.trim().toLowerCase()}`);
    } catch (err: any) {
      console.warn('Supabase DB join error, using fallback:', err);
      router.push(`/room/${roomIdInput.trim().toLowerCase()}`);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between overflow-hidden bg-shasha-bg px-4 py-8 select-none">
      
      {/* Background Animated Glows */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-shasha-accent/15 blur-[120px] animate-glow-1 pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[130px] animate-glow-2 pointer-events-none" />
      </div>

      {/* Decorative Particle Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        {isMounted && particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/20"
            style={{
              top: p.top,
              left: p.left,
              width: p.width,
              height: p.height,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="w-full max-w-6xl flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-shasha-accent flex items-center justify-center shadow-lg shadow-shasha-accent/25">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-wider font-sans">شاشة <span className="text-shasha-accent">Shasha</span></span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-shasha-secondary bg-white/5 border border-white/5 rounded-full px-4 py-1.5 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-shasha-success animate-pulse" />
          WebRTC P2P مباشر
        </div>
      </header>

      {/* Hero Section */}
      <main className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-between gap-12 my-auto z-10 pt-8 pb-12">
        
        {/* Right Content Column */}
        <div className="flex-1 flex flex-col items-start text-right lg:pr-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-shasha-accent/10 border border-shasha-accent/20 text-shasha-accent text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              أسرع منصة لمشاركة الشاشة بجودة فائقة
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.15] mb-6">
              <span className="gradient-text">شارك شاشتك</span>
              <br />
              <span className="gradient-accent-text">في ثانية واحدة.</span>
            </h1>
            
            <p className="text-lg text-shasha-secondary leading-relaxed max-w-lg mb-8">
              لا حسابات، لا برامج، ولا تعقيد. مشاركة شاشة، صوت وكاميرا بجودة فائقة 1080p وتأخير شبه معدوم مباشرة عبر المتصفح.
            </p>
          </motion.div>

          {/* Action Card / Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="w-full max-w-md glass-panel p-6 rounded-[24px]"
          >
            <div className="mb-5">
              <label className="block text-xs font-semibold text-shasha-secondary uppercase tracking-wider mb-2">اسمك المستعار</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => saveUserName(e.target.value)}
                placeholder="أدخل اسمك"
                className="w-full px-4 py-3 rounded-xl glass-input text-right text-sm font-medium"
                maxLength={20}
              />
            </div>

            <AnimatePresence mode="wait">
              {!showJoinForm ? (
                <motion.div
                  key="main-buttons"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col gap-3"
                >
                  <button
                    onClick={handleCreateRoom}
                    disabled={isCreating}
                    className="w-full py-4 rounded-xl bg-shasha-accent text-white font-semibold text-base transition-all hover:bg-shasha-accent-hover active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-shasha-accent/20 cursor-pointer disabled:opacity-55"
                  >
                    {isCreating ? (
                      <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <>
                        أنشئ غرفة بث فورية
                        <ArrowLeft className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setShowJoinForm(true);
                      setErrorMsg('');
                    }}
                    className="w-full py-4 rounded-xl bg-white/5 border border-white/8 text-white font-semibold text-base transition-all hover:bg-white/10 active:scale-[0.98] cursor-pointer"
                  >
                    انضم لغرفة موجودة
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key="join-form"
                  onSubmit={handleJoinRoom}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col gap-3"
                >
                  <div>
                    <label className="block text-xs font-semibold text-shasha-secondary uppercase tracking-wider mb-2">رمز الغرفة (Room ID)</label>
                    <input
                      type="text"
                      value={roomIdInput}
                      onChange={(e) => setRoomIdInput(e.target.value)}
                      placeholder="مثال: cyber-fox-45"
                      className="w-full px-4 py-3 rounded-xl glass-input text-left text-sm font-semibold tracking-wide"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isJoining}
                      className="flex-1 py-4 rounded-xl bg-shasha-accent text-white font-semibold text-base transition-all hover:bg-shasha-accent-hover active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-shasha-accent/20 cursor-pointer disabled:opacity-55"
                    >
                      {isJoining ? (
                        <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : (
                        'انضم الآن'
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowJoinForm(false);
                        setErrorMsg('');
                      }}
                      className="px-4 rounded-xl bg-white/5 border border-white/8 text-white flex items-center justify-center hover:bg-white/10 active:scale-[0.98] cursor-pointer"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-xs font-semibold text-shasha-danger bg-shasha-danger/10 border border-shasha-danger/20 px-3 py-2 rounded-lg text-center"
              >
                {errorMsg}
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Left Column: UI Premium Illustration */}
        <div className="flex-1 w-full flex justify-center items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative w-full max-w-lg aspect-[16/10] rounded-[24px] overflow-hidden glass-panel border border-white/10 shadow-2xl p-4 flex flex-col justify-between"
          >
            {/* Window bar */}
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-white/40">cyber-phoenix-18</span>
                <span className="w-1.5 h-1.5 rounded-full bg-shasha-success" />
              </div>
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-white/10" />
                <span className="w-3 h-3 rounded-full bg-white/10" />
                <span className="w-3 h-3 rounded-full bg-white/10" />
              </div>
            </div>

            {/* Inner body mockup */}
            <div className="flex-1 flex gap-3 pt-3">
              {/* Left streams view */}
              <div className="flex-1 rounded-xl bg-black/40 border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute top-3 right-3 bg-black/60 px-2.5 py-1 rounded-lg border border-white/5 flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-white/90">شاشة أحمد</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-shasha-accent animate-pulse" />
                </div>
                
                {/* Visual waves to represent quality screen sharing */}
                <div className="w-24 h-24 rounded-2xl bg-shasha-accent/10 border border-shasha-accent/30 flex items-center justify-center">
                  <Monitor className="w-10 h-10 text-shasha-accent" />
                </div>
                <div className="mt-3 text-xs text-white/50 font-medium">1080p • 60fps • نشط</div>
              </div>

              {/* Sidebar list mock */}
              <div className="w-[140px] flex flex-col gap-2">
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-shasha-accent flex items-center justify-center text-[9px] font-bold text-white">أ</div>
                    <span className="text-[11px] font-semibold">أحمد (أنت)</span>
                  </div>
                  <div className="flex gap-1">
                    <Mic className="w-3 h-3 text-white/40" />
                    <Video className="w-3 h-3 text-white/40" />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-white/3 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-[9px] font-bold text-white">م</div>
                    <span className="text-[11px] font-semibold text-white/70">محمد</span>
                  </div>
                  <div className="flex gap-1">
                    <Mic className="w-3 h-3 text-shasha-accent animate-pulse" />
                    <Video className="w-3 h-3 text-white/30" />
                  </div>
                </div>

                {/* Chat mockup bubbles */}
                <div className="flex-1 rounded-lg bg-black/20 p-2 border border-white/5 flex flex-col justify-end gap-1.5 overflow-hidden">
                  <div className="text-[9px] bg-white/5 p-1.5 rounded-lg text-white/80 self-start max-w-[90%]">
                    السلام عليكم، البث شغال؟
                  </div>
                  <div className="text-[9px] bg-shasha-accent/10 p-1.5 rounded-lg text-shasha-accent self-end max-w-[90%]">
                    وعليكم السلام، شغال ممتاز!
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom mockup bar */}
            <div className="mt-3 flex justify-center gap-2 pt-2 border-t border-white/5">
              <span className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-[11px]">🎙️</span>
              <span className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-[11px]">📷</span>
              <span className="w-8 h-8 rounded-full bg-shasha-accent/20 border border-shasha-accent/40 flex items-center justify-center text-[11px]">🖥️</span>
              <span className="w-8 h-8 rounded-full bg-shasha-danger/10 border border-shasha-danger/20 flex items-center justify-center text-[11px]">🚪</span>
            </div>
          </motion.div>
        </div>

      </main>

      {/* Features Grid */}
      <section className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 z-10">
        
        <div className="p-6 rounded-[20px] bg-shasha-card border border-white/[0.04] hover:border-white/10 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-shasha-accent/10 border border-shasha-accent/20 flex items-center justify-center mb-4">
            <Monitor className="w-5 h-5 text-shasha-accent" />
          </div>
          <h3 className="text-lg font-bold mb-2">مشاركة الشاشة بجودة فائقة</h3>
          <p className="text-sm text-shasha-secondary leading-relaxed">
            دعم مشاركة الشاشة الكاملة، النوافذ الفردية، أو علامات تبويب المتصفح بجودة تصل لـ 1080p ومعدل تحديث 60 إطاراً في الثانية.
          </p>
        </div>

        <div className="p-6 rounded-[20px] bg-shasha-card border border-white/[0.04] hover:border-white/10 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-shasha-accent/10 border border-shasha-accent/20 flex items-center justify-center mb-4">
            <Shield className="w-5 h-5 text-shasha-accent" />
          </div>
          <h3 className="text-lg font-bold mb-2">حماية قصوى وتوصيل مباشر</h3>
          <p className="text-sm text-shasha-secondary leading-relaxed">
            يتم البث باستخدام تقنية WebRTC (Peer-to-Peer) بحيث يتم نقل البيانات مباشرة بين الأجهزة دون المرور بخوادم وسيطة.
          </p>
        </div>

        <div className="p-6 rounded-[20px] bg-shasha-card border border-white/[0.04] hover:border-white/10 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-shasha-accent/10 border border-shasha-accent/20 flex items-center justify-center mb-4">
            <Sparkles className="w-5 h-5 text-shasha-accent" />
          </div>
          <h3 className="text-lg font-bold mb-2">اتصال فوري ومشاركة الصوت</h3>
          <p className="text-sm text-shasha-secondary leading-relaxed">
            أنشئ غرفتك في ثانية بضغطة زر، وشارك صوت النظام (System Audio) بالتوازي مع البث لمشاهدة الفيديوهات أو العمل معاً.
          </p>
        </div>

      </section>

      {/* Footer */}
      <footer className="w-full max-w-6xl flex justify-between items-center text-xs text-white/30 pt-6 border-t border-white/5 z-10">
        <div>شاشة © {new Date().getFullYear()} — جميع الحقوق محفوظة.</div>
        <div className="flex gap-4">
          <a href="#" className="hover:text-white transition-colors">عن الخدمة</a>
          <a href="#" className="hover:text-white transition-colors">الشروط والأحكام</a>
        </div>
      </footer>

    </div>
  );
}
