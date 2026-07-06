'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Monitor } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirect logged-in users away from auth pages to dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard');
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.push('/dashboard');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-shasha-bg flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-shasha-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-shasha-bg px-4 py-8 overflow-hidden select-none">
      {/* Background Animated Glows */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-shasha-accent/10 blur-[120px] animate-glow-1 pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[130px] animate-glow-2 pointer-events-none" />
      </div>

      <div className="w-full max-w-md z-10 flex flex-col items-center">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 mb-8 cursor-pointer" onClick={() => router.push('/')}>
          <div className="w-10 h-10 rounded-xl bg-shasha-accent flex items-center justify-center shadow-lg shadow-shasha-accent/25">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-wider font-sans text-white">
            شاشة <span className="text-shasha-accent">Shasha</span>
          </span>
        </div>

        {/* Auth form card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full glass-panel p-8 rounded-[24px] text-right"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
