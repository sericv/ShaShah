'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { extractYouTubeVideoId } from '@/utils/youtube';
import { useYouTubeSync, YouTubePlayerEvent, YouTubePlayerState } from '@/hooks/useYouTubeSync';
import { Play, Pause, FastForward, Rewind, Link as LinkIcon } from 'lucide-react';

interface YouTubePlayerProps {
  roomId: string;
  isHost: boolean;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export default function YouTubePlayer({ roomId, isHost }: YouTubePlayerProps) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const playerRef = useRef<any>(null);
  const expectedStateRef = useRef<{ playing: boolean; time: number } | null>(null);
  const isInternalChangeRef = useRef(false);

  // Sync logic
  const getState = useCallback((): YouTubePlayerState => {
    return {
      videoId,
      playing: playerRef.current ? playerRef.current.getPlayerState() === window.YT.PlayerState.PLAYING : false,
      currentTime: playerRef.current ? playerRef.current.getCurrentTime() : 0,
    };
  }, [videoId]);

  const handleSyncEvent = useCallback((event: YouTubePlayerEvent) => {
    if (isHost && event.type !== 'sync_state') return; // Host controls others, doesn't get controlled (except sync_state edge cases)
    
    if (!playerRef.current) return;

    isInternalChangeRef.current = true;
    switch (event.type) {
      case 'change_video':
        setVideoId(event.payload.videoId);
        break;
      case 'play':
        if (Math.abs(playerRef.current.getCurrentTime() - event.payload.currentTime) > 1) {
          playerRef.current.seekTo(event.payload.currentTime, true);
        }
        playerRef.current.playVideo();
        setIsPlaying(true);
        break;
      case 'pause':
        playerRef.current.pauseVideo();
        if (Math.abs(playerRef.current.getCurrentTime() - event.payload.currentTime) > 1) {
          playerRef.current.seekTo(event.payload.currentTime, true);
        }
        setIsPlaying(false);
        break;
      case 'seek':
        playerRef.current.seekTo(event.payload.currentTime, true);
        break;
      case 'sync_state':
        console.log(`[YouTube Sync] Executing sync_state... videoId=${event.payload.videoId}, playing=${event.payload.playing}, time=${event.payload.currentTime}`);
        if (!isHost) {
          if (event.payload.videoId && event.payload.videoId !== videoId) {
            setVideoId(event.payload.videoId);
          }
          // We need to wait for the player to be ready if it's not
          if (!playerReady) {
            console.log(`[YouTube Sync] Player not ready yet, saving state to expectedStateRef...`);
            expectedStateRef.current = { playing: event.payload.playing, time: event.payload.currentTime };
          } else {
            console.log(`[YouTube Sync] Applying sync_state directly to player`);
            if (event.payload.playing) {
              playerRef.current.seekTo(event.payload.currentTime, true);
              playerRef.current.playVideo();
              setIsPlaying(true);
            } else {
              playerRef.current.seekTo(event.payload.currentTime, true);
              playerRef.current.pauseVideo();
              setIsPlaying(false);
            }
          }
        }
        break;
    }
    setTimeout(() => { isInternalChangeRef.current = false; }, 500);
  }, [isHost, videoId]);

  const { broadcastEvent } = useYouTubeSync({
    roomId,
    isHost,
    onEvent: handleSyncEvent,
    getState,
  });

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        // Ready to init players
      };
    }
  }, []);

  // Initialize or re-initialize player when videoId changes
  useEffect(() => {
    if (!videoId) return;

    const initPlayer = () => {
      console.log(`[YouTube Sync] initPlayer() called with videoId=${videoId}`);
      if (playerRef.current) {
        console.log(`[YouTube Sync] playerRef exists, calling loadVideoById()`);
        playerRef.current.loadVideoById(videoId);
        return;
      }

      console.log(`[YouTube Sync] Creating new YT.Player instance...`);
      playerRef.current = new window.YT.Player('yt-player-container', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: isHost ? 1 : 0, // Hide controls for non-hosts
          disablekb: isHost ? 0 : 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            console.log(`[YouTube Sync] PLAYER READY`);
            setPlayerReady(true);
            if (expectedStateRef.current) {
               console.log(`[YouTube Sync] Applying expectedState: time=${expectedStateRef.current.time}, playing=${expectedStateRef.current.playing}`);
               playerRef.current.seekTo(expectedStateRef.current.time, true);
               if (expectedStateRef.current.playing) {
                 playerRef.current.playVideo();
               }
               expectedStateRef.current = null;
            }
          },
          onStateChange: (e: any) => {
            if (isInternalChangeRef.current) return;
            if (!isHost) return;

            const time = playerRef.current.getCurrentTime();
            if (e.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              broadcastEvent({ type: 'play', payload: { currentTime: time } });
            } else if (e.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
              broadcastEvent({ type: 'pause', payload: { currentTime: time } });
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const interval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(interval);
          initPlayer();
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [videoId, isHost, broadcastEvent]);

  // Host interval to sync time periodically if needed (seek detection)
  useEffect(() => {
    if (!isHost || !playerReady) return;

    let lastTime = playerRef.current?.getCurrentTime() || 0;
    
    const interval = setInterval(() => {
      if (playerRef.current && playerRef.current.getPlayerState() === window.YT.PlayerState.PLAYING) {
        const currentTime = playerRef.current.getCurrentTime();
        // Detect seek by checking if jump is more than 2 seconds from expected
        if (Math.abs(currentTime - lastTime - 1) > 2) {
          broadcastEvent({ type: 'seek', payload: { currentTime } });
        }
        lastTime = currentTime;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isHost, playerReady, broadcastEvent]);

  const handleLoadVideo = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const id = extractYouTubeVideoId(inputUrl);
    if (!id) {
      setErrorMsg('رابط غير صالح، يرجى إدخال رابط YouTube صحيح');
      return;
    }
    setVideoId(id);
    setInputUrl('');
    broadcastEvent({ type: 'change_video', payload: { videoId: id } });
  };

  return (
    <div className="flex flex-col h-full bg-[#08080a]">
      {isHost && (
        <div className="p-4 border-b border-white/5 bg-white/5">
          <form onSubmit={handleLoadVideo} className="flex gap-2">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-shasha-secondary">
                <LinkIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="أدخل رابط YouTube هنا (مثال: https://youtu.be/...)"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pr-10 pl-4 text-sm text-white focus:outline-none focus:border-shasha-accent focus:bg-white/10 transition-all dir-ltr"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 bg-shasha-accent hover:bg-shasha-accent-hover text-white rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 whitespace-nowrap"
            >
              تشغيل
            </button>
          </form>
          {errorMsg && <p className="mt-2 text-xs text-shasha-danger">{errorMsg}</p>}
        </div>
      )}

      <div className="flex-1 relative p-4 flex items-center justify-center w-full h-full">
        {/* Player Container - Always rendered but hidden if no videoId */}
        <div className={`w-full h-full rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/5 relative ${videoId ? 'block' : 'hidden'}`}>
          <div id="yt-player-container" className="w-full h-full absolute inset-0"></div>
          
          {!isHost && (
            // Invisible overlay to block clicks for non-hosts
            <div className="absolute inset-0 z-10" />
          )}
        </div>

        {/* Placeholder - Visible only if no videoId */}
        {!videoId && (
          <div className="absolute text-center glass-panel p-8 rounded-3xl border border-white/5 max-w-sm w-full mx-auto shadow-2xl">
            <div className="w-16 h-16 bg-white/5 rounded-2xl mx-auto flex items-center justify-center mb-4 text-3xl">
              📺
            </div>
            <h3 className="text-lg font-bold text-white mb-2">مشاهدة جماعية (YouTube)</h3>
            <p className="text-sm text-shasha-secondary leading-relaxed">
              {isHost
                ? "أدخل رابط فيديو يوتيوب بالأعلى للبدء بمشاهدته مع الجميع في نفس اللحظة."
                : "المضيف لم يقم بتشغيل أي فيديو حالياً. سيظهر الفيديو هنا تلقائياً عند تشغيله."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
