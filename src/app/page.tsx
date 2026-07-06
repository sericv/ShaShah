'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Monitor, Mic, Shield, Video, Sparkles, ArrowLeft, HelpCircle, Users, Film, CheckCircle2, PlayCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [loadingSession, setLoadingSession] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Decorative particles client-side state
  interface Particle {
    top: string;
    left: string;
    width: string;
    height: string;
    duration: number;
  }
  const [particles, setParticles] = useState<Particle[]>([]);

  // Check session & mount
  useEffect(() => {
    setIsMounted(true);
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard');
      } else {
        setLoadingSession(false);
      }
    });

    const generated: Particle[] = [...Array(8)].map(() => ({
      top: `${Math.random() * 80 + 10}%`,
      left: `${Math.random() * 80 + 10}%`,
      width: `${Math.random() * 4 + 2}px`,
      height: `${Math.random() * 4 + 2}px`,
      duration: 6 + Math.random() * 6,
    }));
    setParticles(generated);
  }, [router]);

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-shasha-bg flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-shasha-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  const faqItems = [
    {
      q: 'ما هي منصة شاشة (Shasha)؟',
      a: 'منصة شاشة هي بيئة تواصل اجتماعي لمشاركة الشاشات وبث الأفلام بدقة فائقة 1080p ومعدل 60 إطاراً في الثانية، مصممة لمشاهدة المحتوى والعمل عن بعد مع الأصدقاء دون قيود.',
    },
    {
      q: 'هل أحتاج لتنزيل أي برامج أو إضافات للمشاركة؟',
      a: 'لا، تعمل منصة شاشة بالكامل داخل متصفح الإنترنت الخاص بك دون الحاجة لتثبيت أي برامج خارجية أو إضافات، بفضل التقنيات القياسية الحديثة.',
    },
    {
      q: 'كيف يتم نقل البث والمشاركة دون تأخير؟',
      a: 'نستخدم تقنيات الـ WebRTC للربط المباشر بين الأجهزة (P2P - Peer-to-Peer). هذا يسمح بنقل الفيديو والصوت والبيانات بتأخير شبه معدوم (أقل من 100 ملي ثانية).',
    },
    {
      q: 'هل مشاركة الأفلام تتطلب اشتراكاً أو دفع رسوم؟',
      a: 'لا، المنصة مجانية بالكامل. نحن لا نقوم بنقل أو بث ملفات الفيديو بشكل غير قانوني، بل نوفر البنية التقنية لمشاركة شاشتك مباشرة مع أصدقائك لمشاهدتها معاً.',
    },
  ];

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between overflow-y-auto bg-shasha-bg px-4 py-8 select-none">
      
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
              y: [0, -35, 0],
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
        <div className="flex items-center gap-2">
          <Link href="/login" className="px-4 py-2 text-xs font-semibold text-white/70 hover:text-white bg-white/5 border border-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer">
            تسجيل الدخول
          </Link>
          <Link href="/register" className="px-4 py-2 text-xs font-semibold text-white bg-shasha-accent hover:bg-shasha-accent-hover rounded-xl shadow-lg shadow-shasha-accent/15 transition-all cursor-pointer">
            إنشاء حساب
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-shasha-accent flex items-center justify-center shadow-lg shadow-shasha-accent/25">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-wider font-sans">شاشة <span className="text-shasha-accent">Shasha</span></span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-between gap-12 my-auto z-10 pt-16 pb-12">
        
        {/* Right Content Column */}
        <div className="flex-grow flex flex-col items-center lg:items-end text-center lg:text-right">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center lg:items-end"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-shasha-accent/10 border border-shasha-accent/20 text-shasha-accent text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              منصة شاشة V2 المحدثة بالكامل
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.15] mb-6">
              <span className="gradient-text">شارك شاشتك</span>
              <br />
              <span className="gradient-accent-text">وشاهد مع أصدقائك.</span>
            </h1>
            
            <p className="text-md text-shasha-secondary leading-relaxed max-w-lg mb-8">
              منصة سينما ومشاركة شاشات اجتماعية فاخرة. أضف أصدقائك، احفظ أفلامك المفضلة، أدر غرف بث مستقرة ومستمرة، وتواصل مباشرة بدقة فائقة 1080p وتأخير شبه معدوم.
            </p>

            <div className="flex gap-4">
              <Link href="/register" className="px-8 py-4 rounded-xl bg-shasha-accent hover:bg-shasha-accent-hover text-white font-semibold text-sm transition-all hover:scale-105 active:scale-98 shadow-xl shadow-shasha-accent/20 cursor-pointer">
                ابدأ رحلتك مجاناً الآن
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Left Column: Premium Interactive Mockup */}
        <div className="flex-1 w-full flex justify-center items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative w-full max-w-lg aspect-[16/10] rounded-[24px] overflow-hidden glass-panel border border-white/10 shadow-2xl p-4 flex flex-col justify-between"
          >
            {/* Mockup Top window bar */}
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-white/40">cinema-cosmic-night</span>
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
              <div className="flex-1 rounded-xl bg-black/45 border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute top-3 right-3 bg-black/60 px-2.5 py-1 rounded-lg border border-white/5 flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-white/90">بث شاشة شهاب</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-shasha-accent animate-pulse" />
                </div>
                
                <div className="w-20 h-20 rounded-2xl bg-shasha-accent/10 border border-shasha-accent/30 flex items-center justify-center">
                  <Monitor className="w-8 h-8 text-shasha-accent" />
                </div>
                <div className="mt-3 text-[10px] text-white/50 font-medium">1080p • 60fps • مباشر</div>
              </div>

              {/* Sidebar list mock */}
              <div className="w-[130px] flex flex-col gap-2">
                <div className="p-2 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-shasha-accent flex items-center justify-center text-[9px] font-bold text-white">ش</div>
                    <span className="text-[10px] font-semibold">شهاب (المضيف)</span>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-white/3 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-[9px] font-bold text-white">ف</div>
                    <span className="text-[10px] font-semibold text-white/70">فلاح</span>
                  </div>
                </div>

                {/* Chat mockup bubbles */}
                <div className="flex-1 rounded-lg bg-black/20 p-2 border border-white/5 flex flex-col justify-end gap-1.5 overflow-hidden">
                  <div className="text-[9px] bg-white/5 p-1 rounded-lg text-white/80 self-start max-w-[90%]">
                    الفيلم يبدو رائعاً جداً!
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom mockup bar */}
            <div className="mt-3 flex justify-center gap-2 pt-2 border-t border-white/5">
              <span className="w-7 h-7 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-[10px]">🎙️</span>
              <span className="w-7 h-7 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-[10px]">📷</span>
              <span className="w-7 h-7 rounded-full bg-shasha-accent/20 border border-shasha-accent/40 flex items-center justify-center text-[10px]">🖥️</span>
            </div>
          </motion.div>
        </div>

      </main>

      {/* Feature Cards Section */}
      <section className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6 my-16 z-10">
        
        <div className="p-6 rounded-[20px] bg-shasha-card border border-white/[0.04] hover:border-white/10 transition-colors text-right flex flex-col items-end">
          <div className="w-10 h-10 rounded-xl bg-shasha-accent/10 border border-shasha-accent/20 flex items-center justify-center mb-4">
            <Monitor className="w-5 h-5 text-shasha-accent" />
          </div>
          <h3 className="text-lg font-bold mb-2">مشاركة الشاشة والأفلام</h3>
          <p className="text-sm text-shasha-secondary leading-relaxed">
            دعم مشاركة شاشتك بالكامل أو علامة تبويب المتصفح بجودة عالية ومعدل 60 إطاراً في الثانية للاستمتاع بالأفلام والعمل معاً.
          </p>
        </div>

        <div className="p-6 rounded-[20px] bg-shasha-card border border-white/[0.04] hover:border-white/10 transition-colors text-right flex flex-col items-end">
          <div className="w-10 h-10 rounded-xl bg-shasha-accent/10 border border-shasha-accent/20 flex items-center justify-center mb-4">
            <Users className="w-5 h-5 text-shasha-accent" />
          </div>
          <h3 className="text-lg font-bold mb-2">بيئة اجتماعية متكاملة</h3>
          <p className="text-sm text-shasha-secondary leading-relaxed">
            أضف أصدقائك، أرسل واستقبل طلبات الصداقة، وتعرف على غرف البث العامة الخاصة بهم للانضمام والمشاهدة بضغطة زر.
          </p>
        </div>

        <div className="p-6 rounded-[20px] bg-shasha-card border border-white/[0.04] hover:border-white/10 transition-colors text-right flex flex-col items-end">
          <div className="w-10 h-10 rounded-xl bg-shasha-accent/10 border border-shasha-accent/20 flex items-center justify-center mb-4">
            <Film className="w-5 h-5 text-shasha-accent" />
          </div>
          <h3 className="text-lg font-bold mb-2">مجموعتك السينمائية الخاصة</h3>
          <p className="text-sm text-shasha-secondary leading-relaxed">
            ابحث وتصفح ملايين الأفلام والمسلسلات عبر TMDB، أضف المفضلة، وصنف أعمالك في مكتبتك (تمت المشاهدة، لاحقاً).
          </p>
        </div>

      </section>

      {/* Platform Statistics */}
      <section className="w-full max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-6 my-8 z-10 text-center border-y border-white/5 py-8">
        {[
          { label: 'ساعات بث منقولة', val: '150,000+' },
          { label: 'غرف بث منشأة', val: '45,000+' },
          { label: 'مستخدم نشط شهرياً', val: '12,000+' },
          { label: 'زمن التأخير (Lag)', val: 'أقل من 90ms' },
        ].map((stat, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            <span className="text-3xl font-extrabold text-white tracking-tight">{stat.val}</span>
            <span className="text-xs text-shasha-secondary">{stat.label}</span>
          </div>
        ))}
      </section>

      {/* FAQ Section */}
      <section className="w-full max-w-4xl my-16 z-10 text-right flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-white flex items-center justify-end gap-2 mb-2">
          الأسئلة الشائعة حول شاشة
          <HelpCircle className="w-6 h-6 text-shasha-accent" />
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {faqItems.map((item, idx) => (
            <div key={idx} className="p-5 rounded-2xl bg-shasha-card border border-white/[0.04]">
              <h4 className="text-xs font-bold text-white mb-2">{item.q}</h4>
              <p className="text-[11px] text-shasha-secondary leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full max-w-6xl flex justify-between items-center text-xs text-white/30 pt-6 border-t border-white/5 z-10 mt-12">
        <div>شاشة © {new Date().getFullYear()} — جميع الحقوق محفوظة.</div>
        <div className="flex gap-4">
          <a href="#" className="hover:text-white transition-colors">عن شاشة</a>
          <a href="#" className="hover:text-white transition-colors">الشروط والخصوصية</a>
        </div>
      </footer>

    </div>
  );
}
