'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export interface PresenceState {
  userId: string;
  status: 'online' | 'in_room';
  roomId?: string;
  roomName?: string;
  lastSeen: string;
}

interface PresenceContextType {
  onlineUsers: Record<string, PresenceState>;
  updateMyStatus: (status: 'online' | 'in_room', roomId?: string, roomName?: string) => void;
}

const PresenceContext = createContext<PresenceContextType>({
  onlineUsers: {},
  updateMyStatus: () => {},
});

export const usePresence = () => useContext(PresenceContext);

export const PresenceProvider = ({ children }: { children: React.ReactNode }) => {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceState>>({});
  const [myPresence, setMyPresence] = useState<PresenceState | null>(null);
  const [channel, setChannel] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const initialPresence: PresenceState = {
      userId: userId,
      status: 'online',
      lastSeen: new Date().toISOString(),
    };
    
    setMyPresence(initialPresence);

    const presChannel = supabase.channel('shasha_global_presence', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    presChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presChannel.presenceState();
        const activeUsers: Record<string, PresenceState> = {};
        
        Object.keys(state).forEach((key) => {
          const presList = state[key] as unknown as PresenceState[];
          if (presList && presList.length > 0) {
            const sorted = [...presList].sort(
              (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
            );
            activeUsers[key] = sorted[0];
          }
        });
        
        setOnlineUsers(activeUsers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presChannel.track(initialPresence);
        }
      });

    setChannel(presChannel);

    return () => {
      presChannel.unsubscribe();
    };
  }, [userId]);

  const updateMyStatus = async (status: 'online' | 'in_room', roomId?: string, roomName?: string) => {
    if (!channel || !userId || !myPresence) return;
    
    const updated: PresenceState = {
      ...myPresence,
      status,
      roomId,
      roomName,
      lastSeen: new Date().toISOString(),
    };
    
    setMyPresence(updated);
    await channel.track(updated);
  };

  return (
    <PresenceContext.Provider value={{ onlineUsers, updateMyStatus }}>
      {children}
    </PresenceContext.Provider>
  );
};
