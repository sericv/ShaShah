'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef, use, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  Copy,
  Check,
  Share2,
  Send,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Maximize,
  Minimize,
  ScreenShare,
  Tv,
  HelpCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '@/lib/supabase';
import { useWebRTC, ParticipantPresence } from '@/hooks/useWebRTC';

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [myId, setMyId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('غرفة البث');
  const [isLoading, setIsLoading] = useState(true);
  const [roomExists, setRoomExists] = useState(false);

  // UI States
  const [showChat, setShowChat] = useState(true);
  const [showParticipants, setShowParticipants] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Focus Mode (Fullscreen) States & Refs
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false); // CSS fallback for devices without Fullscreen API
  const [showToolbarFullscreen, setShowToolbarFullscreen] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const toolbarTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFullscreenRef = useRef(false);

  // Cinema Chat States & Refs
  const [soundMuted, setSoundMuted] = useState(false);
  const [cinemaToasts, setCinemaToasts] = useState<{ id: string; senderName: string; content: string; isEmoji: boolean }[]>([]);
  const [showCinemaComposer, setShowCinemaComposer] = useState(false);
  const [cinemaInputText, setCinemaInputText] = useState('');

  useEffect(() => {
    isFullscreenRef.current = isFullscreen || isImmersive;
  }, [isFullscreen, isImmersive]);

  // Chat Data
  const [messages, setMessages] = useState<Message[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Devices info
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState('default');
  const [selectedVideo, setSelectedVideo] = useState('');
  const [streamQuality, setStreamQuality] = useState<'1085p' | '720p' | '480p'>('1085p'); // 1085p stands for 1080p 60fps

  // Initialize guest client details
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let clientUuid = localStorage.getItem('shasha_client_uuid');
      if (!clientUuid) {
        clientUuid = crypto.randomUUID();
        localStorage.setItem('shasha_client_uuid', clientUuid);
      }
      setMyId(clientUuid);

      const savedName = localStorage.getItem('shasha_user_name');
      setUserName(savedName || `مستخدم-${Math.floor(Math.random() * 900) + 100}`);
    }
  }, []);

  const chatChannelRef = useRef<any>(null);

  // Verify Room exists
  useEffect(() => {
    if (!roomId) return;
    
    const checkRoom = async () => {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('name')
          .eq('id', roomId)
          .single();

        if (error) {
          // If PGRST116 (row not found), it means table exists but room doesn't.
          // Otherwise, it's a table configuration error, in which case we fallback!
          if (error.code === 'PGRST116') {
            setRoomExists(false);
          } else {
            console.warn('Database room verification failed. Using fallback room.', error);
            setRoomName(`غرفة بث (مؤقتة)`);
            setRoomExists(true);
          }
        } else if (data) {
          setRoomName(data.name);
          setRoomExists(true);
          // Fetch existing messages
          const { data: msgData } = await supabase
            .from('messages')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: true });
          
          if (msgData) {
            setMessages(msgData);
          }
        } else {
          setRoomExists(false);
        }
      } catch (err) {
        console.warn('Room check error, using fallback:', err);
        setRoomName(`غرفة بث (مؤقتة)`);
        setRoomExists(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkRoom();
  }, [roomId]);

  // Hook initialization (Runs only when myId and userName are loaded)
  const webrtc = useWebRTC(
    roomExists ? roomId : '',
    userName,
    myId
  );

  // Handle Broadcast Chat Messages for Realtime Fallback
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room_chat_broadcast:${roomId}`);
    chatChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'chat-message' }, ({ payload }) => {
        handleIncomingMessage(payload);
      })
      .subscribe((status, err) => {
        console.log(`[Chat Broadcast] Subscription Status: ${status}`, err || '');
      });

    return () => {
      channel.unsubscribe();
      chatChannelRef.current = null;
    };
  }, [roomId]);

  // Handle DB Realtime Message Subscriptions
  useEffect(() => {
    if (!roomExists || !roomId) return;

    const channel = supabase
      .channel(`room_messages_db:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          handleIncomingMessage(payload.new as Message);
        }
      )
      .subscribe((status, err) => {
        console.log(`[Postgres Chat DB] Subscription Status: ${status}`, err || '');
      });

    return () => {
      channel.unsubscribe();
    };
  }, [roomExists, roomId]);

  // Autoscroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // typing status updates inside Presence
  const typingTimeout = useRef<any>(null);
  const handleInputChange = (val: string) => {
    setInputText(val);
    if (!isTyping) {
      setIsTyping(true);
      // We can hook typing status here by updating presence if desired
    }

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
    }, 1500);
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const msgContent = inputText.trim();
    setInputText('');
    setIsTyping(false);

    const tempId = crypto.randomUUID();
    const localMsg: Message = {
      id: tempId,
      room_id: roomId,
      sender_id: myId,
      sender_name: userName,
      content: msgContent,
      created_at: new Date().toISOString(),
    };
    
    // Optimistic update
    setMessages((prev) => [...prev, localMsg]);
    if (effectiveFullscreen) {
      addCinemaToast(localMsg);
    }

    // Broadcast message in real-time
    if (chatChannelRef.current) {
      chatChannelRef.current.send({
        type: 'broadcast',
        event: 'chat-message',
        payload: localMsg,
      });
    }

    try {
      const { error } = await supabase.from('messages').insert([
        {
          id: tempId,
          room_id: roomId,
          sender_id: myId,
          sender_name: userName,
          content: msgContent,
        },
      ]);

      if (error) {
        console.warn('Supabase DB message save failed (fallback mode active):', error);
      }
    } catch (err) {
      console.warn('Supabase DB message save failed:', err);
    }
  };

  // Copy invitation link
  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const link = `${window.location.origin}/?join=${roomId}`;
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      
      confetti({
        particleCount: 80,
        spread: 50,
        origin: { y: 0.9 },
        colors: ['#4F8CFF', '#22C55E', '#FFFFFF'],
      });

      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Enumerate active devices
  const loadDeviceOptions = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
      setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
    } catch (e) {
      console.error(e);
    }
  };

  // Settings trigger
  useEffect(() => {
    if (showSettings) {
      loadDeviceOptions();
    }
  }, [showSettings]);

  const handleDeviceChange = async (type: 'audio' | 'video', deviceId: string) => {
    if (type === 'audio') {
      setSelectedAudio(deviceId);
      await webrtc.changeDevices(deviceId, undefined);
    } else {
      setSelectedVideo(deviceId);
      await webrtc.changeDevices(undefined, deviceId);
    }
  };

  // Find who is sharing screen (including local or remote)
  const activeScreenShareFeed = (() => {
    // Check remote peers first (do not always prioritize local user)
    const activeSharingPeer = webrtc.participants.find((p) => p.screenShareEnabled && p.id !== myId);
    if (activeSharingPeer && webrtc.remoteStreams[activeSharingPeer.id]?.screenStream) {
      return {
        id: activeSharingPeer.id,
        name: activeSharingPeer.name,
        stream: webrtc.remoteStreams[activeSharingPeer.id].screenStream!,
        isLocal: false,
      };
    }

    // Check if local screen sharing is active
    if (webrtc.screenShareEnabled && webrtc.localScreenStream) {
      return {
        id: myId,
        name: userName,
        stream: webrtc.localScreenStream,
        isLocal: true,
      };
    }

    return null;
  })();

  // Synthesize a soft premium chime sound locally using Web Audio API
  const playNotificationSound = () => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); // D6
      
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start(now);
      osc2.start(now);
      
      osc1.stop(now + 0.18);
      osc2.stop(now + 0.18);
    } catch (e) {
      console.warn('Failed to play synthesized chime:', e);
    }
  };

  // Check if string contains only emojis
  const isEmojiOnly = (str: string) => {
    const cleaned = str.replace(/\s/g, '');
    if (!cleaned) return false;
    const emojiRegex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])+$/;
    return emojiRegex.test(cleaned);
  };

  // Add message to Cinema Toasts
  const addCinemaToast = useCallback((msg: Message) => {
    const isIncoming = msg.sender_id !== myId;
    if (isIncoming && !soundMuted) {
      playNotificationSound();
    }

    const id = msg.id || Math.random().toString();
    const newToast = {
      id,
      senderName: msg.sender_name,
      content: msg.content,
      isEmoji: isEmojiOnly(msg.content),
    };

    setCinemaToasts((prev) => {
      const current = [...prev, newToast];
      if (current.length > 3) {
        return current.slice(current.length - 3);
      }
      return current;
    });

    setTimeout(() => {
      setCinemaToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, [myId, soundMuted]);

  // Handle incoming message routing (updates messages list and plays toast if fullscreen)
  const handleIncomingMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      if (isFullscreenRef.current) {
        addCinemaToast(msg);
      }
      return [...prev, msg];
    });
  }, [addCinemaToast]);

  const handleSendCinemaMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cinemaInputText.trim()) return;

    try {
      const content = cinemaInputText;
      setCinemaInputText('');
      setShowCinemaComposer(false);

      const localMsg: Message = {
        id: crypto.randomUUID(),
        room_id: roomId,
        sender_id: myId,
        sender_name: userName,
        content,
        created_at: new Date().toISOString(),
      };

      addCinemaToast(localMsg);
      setMessages((prev) => [...prev, localMsg]);

      if (chatChannelRef.current) {
        chatChannelRef.current.send({
          type: 'broadcast',
          event: 'chat-message',
          payload: localMsg,
        });
      }

      await supabase.from('messages').insert({
        room_id: roomId,
        sender_id: myId,
        sender_name: userName,
        content,
      });
    } catch (err) {
      console.warn('Cinema chat send error:', err);
    }
  };

  // Cross-browser fullscreen helpers
  const getFullscreenElement = (): Element | null => {
    return document.fullscreenElement
      || (document as any).webkitFullscreenElement
      || null;
  };

  const requestFS = (el: HTMLElement): Promise<void> | null => {
    if (el.requestFullscreen) return el.requestFullscreen();
    if ((el as any).webkitRequestFullscreen) { (el as any).webkitRequestFullscreen(); return Promise.resolve(); }
    return null; // API not available
  };

  const exitFS = (): Promise<void> | null => {
    if (document.exitFullscreen) return document.exitFullscreen();
    if ((document as any).webkitExitFullscreen) { (document as any).webkitExitFullscreen(); return Promise.resolve(); }
    return null;
  };

  // Focus Mode toggle function – called directly from user gesture (click/tap)
  const toggleFocusMode = () => {
    const currentlyFS = getFullscreenElement() !== null;
    const currentlyImmersive = isImmersive;

    if (currentlyFS) {
      // Exit native fullscreen
      const result = exitFS();
      if (!result) {
        setIsFullscreen(false);
      }
      return;
    }

    if (currentlyImmersive) {
      // Exit CSS immersive fallback
      setIsImmersive(false);
      setShowToolbarFullscreen(true);
      return;
    }

    // Try native fullscreen first
    if (rootRef.current) {
      const result = requestFS(rootRef.current);
      if (result === null) {
        // Fullscreen API unavailable → use CSS immersive fallback
        console.log('[Fullscreen] API unavailable, using immersive CSS fallback');
        setIsImmersive(true);
      } else {
        result.catch(() => {
          // requestFullscreen was rejected (e.g. not from user gesture, or blocked)
          console.log('[Fullscreen] API rejected, using immersive CSS fallback');
          setIsImmersive(true);
        });
      }
    }
  };

  // Fullscreen change listener (cross-browser)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = getFullscreenElement() !== null;
      setIsFullscreen(active);
      if (!active) {
        setShowToolbarFullscreen(true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // ESC key exits immersive fallback mode
  useEffect(() => {
    if (!isImmersive) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsImmersive(false);
        setShowToolbarFullscreen(true);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isImmersive]);

  // Derive effective fullscreen state (native OR CSS fallback)
  const effectiveFullscreen = isFullscreen || isImmersive;

  // Keyboard shortcut listener ('F' key to toggle fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCinemaComposer) {
        setShowCinemaComposer(false);
        e.stopPropagation();
        return;
      }
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        toggleFocusMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [effectiveFullscreen, showCinemaComposer]);

  // Mouse move activity tracker for fullscreen toolbar
  const handleMouseMove = () => {
    if (!effectiveFullscreen) return;

    setShowToolbarFullscreen(true);

    if (toolbarTimerRef.current) {
      clearTimeout(toolbarTimerRef.current);
    }

    toolbarTimerRef.current = setTimeout(() => {
      setShowToolbarFullscreen(false);
    }, 3000);
  };

  // Main Render - Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-shasha-bg flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-shasha-accent/15 flex items-center justify-center border border-shasha-accent/30 relative">
            <Monitor className="w-6 h-6 text-shasha-accent animate-pulse" />
            <span className="absolute inset-0 rounded-2xl border border-shasha-accent animate-ping opacity-45" />
          </div>
          <span className="text-sm font-semibold text-shasha-secondary">جاري التحقق من الغرفة...</span>
        </div>
      </div>
    );
  }

  // Room not found state
  if (!roomExists) {
    return (
      <div className="min-h-screen bg-shasha-bg flex flex-col items-center justify-center px-4">
        <div className="glass-panel p-8 rounded-[24px] max-w-sm w-full text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-shasha-danger/10 border border-shasha-danger/20 flex items-center justify-center text-shasha-danger mb-4">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">عذراً، الغرفة غير موجودة</h2>
          <p className="text-sm text-shasha-secondary mb-6">قد يكون الرابط خاطئاً أو تم حذف الغرفة من الخادم.</p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 rounded-xl bg-shasha-accent text-white font-semibold hover:bg-shasha-accent-hover transition-colors active:scale-98 cursor-pointer"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      onMouseMove={handleMouseMove}
      className={`bg-shasha-bg flex flex-col overflow-hidden select-none ${
        isImmersive
          ? 'fixed inset-0 w-screen h-[100dvh] z-[9999] bg-black'
          : 'h-screen max-h-screen relative'
      }`}
    >
      
      {/* Top Navigation Bar */}
      {!effectiveFullscreen && (
        <header className="h-16 border-b border-white/[0.06] flex items-center justify-between px-6 bg-shasha-card/50 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div
            onClick={() => router.push('/')}
            className="w-8 h-8 rounded-lg bg-shasha-accent flex items-center justify-center cursor-pointer hover:bg-shasha-accent-hover transition-colors"
          >
            <Monitor className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col text-right">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              {roomName}
              <span className="w-1.5 h-1.5 rounded-full bg-shasha-success" />
            </h2>
            <span className="text-[10px] text-shasha-secondary tracking-wider font-mono uppercase">{roomId}</span>
          </div>
        </div>

        {/* Invite and copy actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="h-9 px-4 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 active:scale-98 flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-shasha-success" />
                تم النسخ!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-shasha-secondary" />
                رابط الدعوة
              </>
            )}
          </button>
          
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: 'انضم لبث شاشتي',
                  url: window.location.href,
                }).catch(console.error);
              } else {
                handleCopyLink();
              }
            }}
            className="w-9 h-9 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
          >
            <Share2 className="w-4 h-4 text-shasha-secondary" />
          </button>
        </div>
      </header>
      )}

      {/* Main Workspace Panels */}
      <div
        className="flex-1 flex overflow-hidden w-full relative"
        onTouchStart={(e) => {
          if (effectiveFullscreen) {
            handleMouseMove();
          }
        }}
      >
        
        {/* Left Panel: Participants Sidebar */}
        <AnimatePresence>
          {showParticipants && !effectiveFullscreen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="h-full border-l border-white/[0.06] bg-shasha-card/20 flex flex-col shrink-0 overflow-hidden"
            >
              <div className="p-4 border-b border-white/[0.04] flex items-center justify-between shrink-0">
                <span className="text-xs font-bold uppercase tracking-wider text-shasha-secondary">المشاركون ({webrtc.participants.length})</span>
                <Users className="w-4 h-4 text-white/30" />
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {webrtc.participants.map((p) => {
                  const isMe = p.id === myId;
                  const isSpeaking = p.isSpeaking;
                  
                  return (
                    <motion.div
                      layoutId={`participant-${p.id}`}
                      key={p.id}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                        isSpeaking
                          ? 'bg-shasha-accent/10 border-shasha-accent/30'
                          : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {/* Speaking Ring */}
                          {isSpeaking && (
                            <span className="absolute inset-0 rounded-full border-2 border-shasha-accent animate-ping scale-110 opacity-70" />
                          )}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            isMe ? 'bg-shasha-accent text-white' : 'bg-purple-500 text-white'
                          }`}>
                            {p.name.substring(0, 2)}
                          </div>
                        </div>

                        <div className="flex flex-col text-right">
                          <span className="text-xs font-bold text-white flex items-center gap-1">
                            {p.name} {isMe && <span className="text-[10px] text-white/40 font-normal">(أنت)</span>}
                          </span>
                          <span className="text-[9px] text-shasha-secondary flex items-center gap-1">
                            {p.isHost && <span className="px-1 py-0.5 rounded bg-shasha-warning/10 text-shasha-warning font-semibold text-[8px]">مضيف</span>}
                            {p.screenShareEnabled ? 'يبث الشاشة' : 'متصل'}
                          </span>
                        </div>
                      </div>

                      {/* Icons statuses */}
                      <div className="flex items-center gap-1 opacity-70">
                        {p.micEnabled ? (
                          <Mic className={`w-3.5 h-3.5 ${isSpeaking ? 'text-shasha-accent animate-pulse' : 'text-white/40'}`} />
                        ) : (
                          <MicOff className="w-3.5 h-3.5 text-shasha-danger" />
                        )}
                        {p.camEnabled ? (
                          <Video className="w-3.5 h-3.5 text-white/40" />
                        ) : (
                          <VideoOff className="w-3.5 h-3.5 text-shasha-danger" />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Center: Stream/Video Display Area */}
        <main className="flex-1 h-full bg-black/30 flex flex-col justify-center items-center p-4 relative overflow-hidden">
          {activeScreenShareFeed ? (
            <div className="w-full h-full flex flex-col items-center justify-center relative">
              <VideoPlayerStream
                stream={activeScreenShareFeed.stream}
                userName={activeScreenShareFeed.name}
                isLocal={activeScreenShareFeed.isLocal}
              />
            </div>
          ) : (
            /* Empty State: No screen shared */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center text-center p-6 max-w-sm"
            >
              <div className="w-24 h-24 rounded-3xl bg-shasha-accent/5 border border-shasha-accent/15 flex items-center justify-center text-shasha-accent mb-6 relative">
                <Monitor className="w-12 h-12" />
                <span className="absolute inset-0 rounded-3xl border border-shasha-accent/30 animate-pulse" />
              </div>
              <h2 className="text-xl font-bold mb-2">لا أحد يشارك شاشته حالياً</h2>
              {webrtc.isHost ? (
                <>
                  <p className="text-sm text-shasha-secondary mb-6 leading-relaxed">
                    اضغط على زر "مشاركة الشاشة" في الشريط السفلي لبدء البث ومشاركة المحتوى مع الحاضرين.
                  </p>
                  <button
                    onClick={webrtc.toggleScreenShare}
                    className="px-6 py-3 rounded-xl bg-shasha-accent text-white font-semibold text-sm hover:bg-shasha-accent-hover active:scale-98 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Monitor className="w-4 h-4" />
                    شارك شاشتك الآن
                  </button>
                </>
              ) : (
                <p className="text-sm text-shasha-secondary mb-6 leading-relaxed flex items-center gap-1.5 justify-center">
                  <span className="w-2 h-2 rounded-full bg-shasha-warning animate-pulse" />
                  بانتظار قيام مضيف الغرفة بمشاركة شاشته...
                </p>
              )}
            </motion.div>
          )}

          {/* WebRTC Video Grids of active cameras on bottom right (Overlay) */}
          <div className="absolute bottom-4 right-4 flex gap-2 pointer-events-none z-10">
            {/* Show my camera if active */}
            {webrtc.camEnabled && webrtc.localMediaStream && (
              <div className="w-28 h-20 rounded-xl overflow-hidden border border-white/10 shadow-lg pointer-events-auto bg-black relative">
                <VideoPlayerCamera stream={webrtc.localMediaStream} isLocal={true} />
                <div className="absolute bottom-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-semibold text-white">أنت</div>
              </div>
            )}

            {/* Show other active remote cameras */}
            {webrtc.participants.map((p) => {
              if (p.id !== myId && p.camEnabled && webrtc.remoteStreams[p.id]?.cameraStream) {
                return (
                  <div key={p.id} className="w-28 h-20 rounded-xl overflow-hidden border border-white/10 shadow-lg pointer-events-auto bg-black relative">
                    <VideoPlayerCamera stream={webrtc.remoteStreams[p.id].cameraStream!} isLocal={false} />
                    <div className="absolute bottom-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-semibold text-white">{p.name}</div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </main>

        {/* Right Panel: Chat Sidebar */}
        <AnimatePresence>
          {showChat && !effectiveFullscreen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="h-full border-r border-white/[0.06] bg-shasha-card/20 flex flex-col shrink-0 overflow-hidden"
            >
              {/* Chat Title */}
              <div className="p-4 border-b border-white/[0.04] flex items-center justify-between shrink-0">
                <span className="text-xs font-bold uppercase tracking-wider text-shasha-secondary">الدردشة المباشرة</span>
                <MessageSquare className="w-4 h-4 text-white/30" />
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {messages.length === 0 ? (
                  <div className="my-auto text-center flex flex-col items-center px-4">
                    <MessageSquare className="w-8 h-8 text-white/10 mb-2" />
                    <p className="text-xs text-shasha-secondary">لا توجد رسائل بعد. ابدأ محادثة جديدة!</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.sender_id === myId;
                    return (
                      <div key={m.id} className={`flex flex-col ${isMe ? 'items-start text-right' : 'items-end text-left'}`}>
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[10px] font-bold text-white/60">{m.sender_name}</span>
                          <span className="text-[8px] text-white/30 font-mono">
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className={`p-3 rounded-[16px] text-sm break-all max-w-[85%] leading-relaxed ${
                          isMe
                            ? 'bg-shasha-accent text-white rounded-tr-none'
                            : 'bg-white/5 border border-white/5 text-white/90 rounded-tl-none'
                        }`}>
                          {m.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-white/[0.04] flex gap-2 shrink-0 bg-black/10">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="اكتب رسالتك..."
                  className="flex-1 px-4 py-2.5 rounded-xl glass-input text-right text-xs"
                />
                <button
                  type="submit"
                  className="w-10 h-10 rounded-xl bg-shasha-accent text-white flex items-center justify-center hover:bg-shasha-accent-hover active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.aside>
          )}
        </AnimatePresence>

      </div>

      {/* Bottom Control Toolbar */}
      <motion.footer
        animate={{
          y: effectiveFullscreen && !showToolbarFullscreen ? 100 : 0,
          opacity: effectiveFullscreen && !showToolbarFullscreen ? 0 : 1,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{ touchAction: 'manipulation' }}
        className={`${
          effectiveFullscreen
            ? 'fixed bottom-[env(safe-area-inset-bottom,6px)] left-1/2 -translate-x-1/2 w-auto bg-zinc-950/85 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-lg h-16 px-6 gap-8 pointer-events-auto'
            : 'h-20 border-t border-white/[0.06] bg-shasha-card/50 backdrop-blur-md w-full px-6'
        } flex items-center justify-between shrink-0 z-[10000] transition-all duration-300`}
      >
        
        {/* Left Side: Room Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
              showParticipants
                ? 'bg-shasha-accent/15 border-shasha-accent/30 text-shasha-accent'
                : 'bg-white/5 border-white/5 text-shasha-secondary hover:bg-white/10'
            }`}
          >
            <Users className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
              showChat
                ? 'bg-shasha-accent/15 border-shasha-accent/30 text-shasha-accent'
                : 'bg-white/5 border-white/5 text-shasha-secondary hover:bg-white/10'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>

        {/* Center Side: Media Stream Toggles */}
        <div className="flex items-center gap-3">
          <button
            onClick={webrtc.toggleMic}
            className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all scale-100 hover:scale-105 active:scale-95 cursor-pointer ${
              webrtc.micEnabled
                ? 'bg-shasha-accent/10 border-shasha-accent/30 text-shasha-accent'
                : 'bg-shasha-danger/10 border-shasha-danger/25 text-shasha-danger'
            }`}
          >
            {webrtc.micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          <button
            onClick={webrtc.toggleCam}
            className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all scale-100 hover:scale-105 active:scale-95 cursor-pointer ${
              webrtc.camEnabled
                ? 'bg-shasha-accent/10 border-shasha-accent/30 text-shasha-accent'
                : 'bg-shasha-danger/10 border-shasha-danger/25 text-shasha-danger'
            }`}
          >
            {webrtc.camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {webrtc.isHost && (
            <button
              onClick={webrtc.toggleScreenShare}
              title="مشاركة الشاشة"
              className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all scale-100 hover:scale-105 active:scale-95 cursor-pointer ${
                webrtc.screenShareEnabled
                  ? 'bg-shasha-success/15 border-shasha-success/40 text-shasha-success'
                  : 'bg-white/5 border-white/5 text-white hover:bg-white/10'
              }`}
            >
              <Monitor className="w-5 h-5" />
            </button>
          )}

          {/* Focus Mode / Fullscreen Button - Everyone */}
          <button
            onClick={toggleFocusMode}
            title={effectiveFullscreen ? 'إغلاق نمط التركيز' : 'نمط التركيز (ملء الشاشة)'}
            className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all scale-100 hover:scale-105 active:scale-95 cursor-pointer ${
              effectiveFullscreen
                ? 'bg-shasha-accent/15 border-shasha-accent/40 text-shasha-accent'
                : 'bg-white/5 border-white/5 text-white hover:bg-white/10'
            }`}
          >
            {effectiveFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>

        {/* Right Side: Exit & Settings */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center cursor-pointer transition-colors"
          >
            <Settings className="w-5 h-5 text-shasha-secondary" />
          </button>

          <button
            onClick={() => {
              if (confirm('هل أنت متأكد من مغادرة غرفة البث؟')) {
                router.push('/');
              }
            }}
            className="w-10 h-10 rounded-full bg-shasha-danger/15 border border-shasha-danger/30 hover:bg-shasha-danger text-shasha-danger hover:text-white active:scale-95 flex items-center justify-center cursor-pointer transition-all"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

      </motion.footer>

      {/* Settings Dialog Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md glass-panel p-6 rounded-[24px] text-right flex flex-col gap-5"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-xs font-semibold text-shasha-secondary hover:text-white cursor-pointer"
                >
                  إغلاق
                </button>
                <h3 className="text-lg font-bold">إعدادات الصوت والفيديو</h3>
              </div>

              {/* Micro input selection */}
              <div>
                <label className="block text-xs font-semibold text-shasha-secondary mb-2">اختر الميكروفون</label>
                <select
                  value={selectedAudio}
                  onChange={(e) => handleDeviceChange('audio', e.target.value)}
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/8 text-xs font-medium text-white focus:outline-none focus:border-shasha-accent"
                >
                  {audioDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId} className="bg-shasha-card text-white">
                      {d.label || `ميكروفون ${d.deviceId.substring(0, 5)}`}
                    </option>
                  ))}
                  {audioDevices.length === 0 && <option className="bg-shasha-card">الميكروفون الافتراضي</option>}
                </select>
              </div>

              {/* Camera selection */}
              <div>
                <label className="block text-xs font-semibold text-shasha-secondary mb-2">اختر الكاميرا</label>
                <select
                  value={selectedVideo}
                  onChange={(e) => handleDeviceChange('video', e.target.value)}
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/8 text-xs font-medium text-white focus:outline-none focus:border-shasha-accent"
                >
                  {videoDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId} className="bg-shasha-card text-white">
                      {d.label || `كاميرا ${d.deviceId.substring(0, 5)}`}
                    </option>
                  ))}
                  {videoDevices.length === 0 && <option className="bg-shasha-card">لا توجد كاميرا متاحة</option>}
                </select>
              </div>

              {/* Stream Quality Selection */}
              <div>
                <label className="block text-xs font-semibold text-shasha-secondary mb-2">جودة البث والمعدل</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['1085p', '720p', '480p'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => setStreamQuality(q)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        streamQuality === q
                          ? 'bg-shasha-accent border-shasha-accent text-white'
                          : 'bg-white/3 border-white/5 text-shasha-secondary hover:bg-white/5'
                      }`}
                    >
                      {q === '1085p' ? '1080p (60fps)' : q === '720p' ? '720p (30fps)' : '480p (30fps)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mute Chat Sounds Toggle */}
              <div>
                <label className="block text-xs font-semibold text-shasha-secondary mb-2">إشعارات سينما شات</label>
                <button
                  onClick={() => setSoundMuted(!soundMuted)}
                  className={`w-full p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    soundMuted
                      ? 'bg-shasha-danger/10 border-shasha-danger/25 text-shasha-danger'
                      : 'bg-shasha-success/10 border-shasha-success/25 text-shasha-success'
                  }`}
                >
                  <span>{soundMuted ? 'أصوات الإشعارات معطلة' : 'أصوات الإشعارات مفعلة'}</span>
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setShowSettings(false)}
                className="w-full mt-2 py-3 rounded-xl bg-shasha-accent text-white font-semibold text-sm hover:bg-shasha-accent-hover transition-colors cursor-pointer"
              >
                تطبيق وحفظ التغييرات
              </button>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Chat Button for Cinema Mode */}
      <AnimatePresence>
        {effectiveFullscreen && showToolbarFullscreen && !showCinemaComposer && (
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setShowCinemaComposer(true)}
            className="fixed bottom-24 right-6 w-12 h-12 rounded-full glass-panel bg-zinc-950/80 border border-white/15 text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 cursor-pointer z-[10001] focus:outline-none pointer-events-auto"
          >
            <MessageSquare className="w-5 h-5 text-shasha-accent" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Cinema Composer */}
      <AnimatePresence>
        {effectiveFullscreen && showCinemaComposer && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[10002] flex items-end justify-center" style={{ touchAction: 'manipulation' }}>
            {/* Click outside to close */}
            <div className="absolute inset-0" onClick={() => setShowCinemaComposer(false)} onTouchEnd={(e) => { e.preventDefault(); setShowCinemaComposer(false); }} />
            
            <motion.form
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onSubmit={handleSendCinemaMessage}
              className="w-full max-w-md bg-zinc-950/90 border border-white/10 p-3 rounded-2xl shadow-2xl backdrop-blur-lg flex gap-2 relative z-10 pointer-events-auto"
              style={{ marginBottom: 'env(safe-area-inset-bottom, 12px)', paddingBottom: 4 }}
            >
              <input
                ref={(input) => {
                  if (input) {
                    requestAnimationFrame(() => {
                      input.focus({ preventScroll: true });
                    });
                  }
                }}
                type="text"
                inputMode="text"
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="off"
                value={cinemaInputText}
                onChange={(e) => setCinemaInputText(e.target.value)}
                placeholder="اكتب رسالة سينما شات..."
                className="flex-1 px-4 py-2 bg-white/5 border border-white/5 focus:border-shasha-accent/40 rounded-xl text-white text-base text-right focus:outline-none placeholder-white/30"
                style={{ fontSize: '16px', touchAction: 'manipulation' }}
                onFocus={(e) => {
                  e.target.scrollIntoView = () => {};
                }}
              />
              <button
                type="submit"
                className="w-10 h-10 rounded-xl bg-shasha-accent text-white flex items-center justify-center hover:bg-shasha-accent-hover active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Cinema Chat Toasts Container */}
      <div className="fixed bottom-24 left-6 z-50 flex flex-col gap-2 max-w-[320px] pointer-events-none">
        <AnimatePresence>
          {effectiveFullscreen && cinemaToasts.map((toast) => {
            if (toast.isEmoji) {
              return (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, y: 20, scale: 0.5 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0, 
                    scale: 1,
                    rotate: [0, -10, 10, -10, 0],
                  }}
                  exit={{ opacity: 0, filter: 'blur(5px)' }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="flex flex-col items-start p-3 bg-zinc-950/45 border border-white/5 rounded-2xl backdrop-blur-md shadow-xl text-right"
                >
                  <span className="text-[10px] font-bold text-white/50 mb-0.5">{toast.senderName}</span>
                  <span className="text-3xl animate-bounce leading-none py-1 block">{toast.content}</span>
                </motion.div>
              );
            }
            
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, filter: 'blur(5px)' }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-start p-3 bg-zinc-950/75 border border-white/10 rounded-2xl backdrop-blur-md shadow-xl text-right max-w-[300px]"
              >
                <span className="text-[10px] font-bold text-shasha-accent mb-0.5">{toast.senderName}</span>
                <span className="text-xs text-white/90 font-medium leading-relaxed break-words w-full">{toast.content}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

    </div>
  );
}

// Subcomponent: Handles rendering of active screen stream
function VideoPlayerStream({ stream, userName, isLocal }: { stream: MediaStream; userName: string; isLocal: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (!document.fullscreenElement) {
        videoRef.current.requestFullscreen().catch(console.error);
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  return (
    <div className="relative w-full h-full rounded-[24px] overflow-hidden border border-white/10 bg-black flex items-center justify-center group shadow-2xl">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Mute local streams to prevent self-echoing
        className="w-full h-full object-contain"
      />

      {/* Custom Stream Info Bar Overlay */}
      <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-shasha-accent animate-pulse" />
          <span className="text-xs font-bold text-white">بث شاشة: {userName} {isLocal && '(أنت)'}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center cursor-pointer transition-colors"
          >
            <Maximize className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Subcomponent: Handles camera tracks overlay
function VideoPlayerCamera({ stream, isLocal }: { stream: MediaStream; isLocal: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal}
      className="w-full h-full object-cover transform scale-x-[-1]" // mirror local/camera stream
    />
  );
}
