'use client';

import Hls from 'hls.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Link as LinkIcon, Star, Clock } from 'lucide-react';
import type { CinemaPlaybackState, CinemaRoomMetadata, CinemaSyncEvent } from '@/types/cinema';
import { useCinemaSync } from '@/hooks/useCinemaSync';
import { isPlayableHttpUrl } from '@/utils/videoUrl';

interface CinemaPlayerProps {
  roomId: string;
  myId: string;
  isHost: boolean;
  metadata: CinemaRoomMetadata;
}

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

function formatRuntime(runtime?: number | null) {
  if (!runtime) return null;
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  return hours > 0 ? `${hours}س ${minutes}د` : `${minutes}د`;
}

export default function CinemaPlayer({ roomId, myId, isHost, metadata }: CinemaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const suppressEventsRef = useRef(false);
  const triedHlsFallbackRef = useRef(false);
  const [draftUrl, setDraftUrl] = useState(metadata.stream_url || '');
  const [error, setError] = useState('');

  const posterUrl = metadata.poster_path ? `${TMDB_IMAGE_BASE}/w342${metadata.poster_path}` : '';
  const backdropUrl = metadata.backdrop_path ? `${TMDB_IMAGE_BASE}/w1280${metadata.backdrop_path}` : '';

  const getPlayerTime = useCallback(() => videoRef.current?.currentTime || 0, []);
  const isPlayerPlaying = useCallback(() => {
    const video = videoRef.current;
    return !!video && !video.paused && !video.ended;
  }, []);

  const applyRemoteState = useCallback((state: CinemaPlaybackState, event: CinemaSyncEvent) => {
    const video = videoRef.current;
    if (!video) return;

    suppressEventsRef.current = true;
    const networkAdjustedTime = state.isPlaying
      ? state.currentTime + Math.max(0, (Date.now() - state.updatedAt) / 1000)
      : state.currentTime;
    const delta = Math.abs(video.currentTime - networkAdjustedTime);

    if (delta > 1 || event === 'seek' || event === 'sync_state') {
      video.currentTime = networkAdjustedTime;
    }

    if (state.isPlaying) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }

    window.setTimeout(() => {
      suppressEventsRef.current = false;
    }, 250);
  }, []);

  const cinemaSync = useCinemaSync({
    roomId,
    myId,
    isHost,
    initialStreamUrl: metadata.stream_url || '',
    getPlayerTime,
    isPlayerPlaying,
    onRemoteState: applyRemoteState,
  });

  const sourceUrl = useMemo(() => {
    const url = cinemaSync.streamUrl || metadata.stream_url || '';
    console.log('[CinemaPlayer] sourceUrl recomputed:', { fromSync: cinemaSync.streamUrl, fromMetadata: metadata.stream_url, result: url });
    return url;
  }, [cinemaSync.streamUrl, metadata.stream_url]);

  useEffect(() => {
    const video = videoRef.current;
    console.log('[CinemaPlayer] sourceUrl effect fired, sourceUrl:', sourceUrl, 'metadata.stream_url:', metadata.stream_url, 'cinemaSync.streamUrl:', cinemaSync.streamUrl);
    if (!video || !sourceUrl) return;

    hlsRef.current?.destroy();
    hlsRef.current = null;
    triedHlsFallbackRef.current = false;
    setError('');
    video.src = sourceUrl;
    console.log('[CinemaPlayer] Assigned video.src =', sourceUrl);

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [sourceUrl]);

  const tryHlsFallback = useCallback(() => {
    const video = videoRef.current;
    console.log('[CinemaPlayer] tryHlsFallback called, sourceUrl:', sourceUrl, 'triedHlsFallbackRef:', triedHlsFallbackRef.current);
    if (!video || triedHlsFallbackRef.current) {
      console.log('[CinemaPlayer] tryHlsFallback: no video or already tried, showing error');
      setError('الرابط غير صالح أو لا يمكن تشغيله');
      return;
    }

    triedHlsFallbackRef.current = true;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('[CinemaPlayer] Safari native HLS supported, letting native playback proceed');
      setError('');
      return;
    }

    if (!Hls.isSupported()) {
      console.log('[CinemaPlayer] HLS not supported, showing error');
      setError('الرابط غير صالح أو لا يمكن تشغيله');
      return;
    }

    console.log('[CinemaPlayer] Attempting hls.js fallback for URL:', sourceUrl);
    hlsRef.current?.destroy();
    const hls = new Hls({ enableWorker: true });
    hlsRef.current = hls;
    hls.loadSource(sourceUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      console.log('[CinemaPlayer] hls.js MANIFEST_PARSED, clearing error');
      setError('');
    });
    hls.on(Hls.Events.ERROR, (_, data) => {
      console.log('[CinemaPlayer] hls.js error:', data.type, data.details, data.fatal);
      if (data.fatal) {
        setError('الرابط غير صالح أو لا يمكن تشغيله');
      }
    });
  }, [sourceUrl]);

  const handleHostStreamChange = async () => {
    const nextUrl = draftUrl.trim();
    if (!isHost || !isPlayableHttpUrl(nextUrl)) {
      setError('أدخل رابط http أو https صالح.');
      return;
    }

    setError('');
    cinemaSync.dispatchStreamChange(nextUrl);
  };

  const handleHostSeek = (offset: number) => {
    const video = videoRef.current;
    if (!video || !isHost) return;
    const nextTime = Math.max(0, video.currentTime + offset);
    video.currentTime = nextTime;
    cinemaSync.dispatchSeek(nextTime);
  };

  return (
    <div className="w-full h-full flex flex-col bg-black relative overflow-hidden">
      {backdropUrl && (
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-center blur-sm scale-105"
          style={{ backgroundImage: `url(${backdropUrl})` }}
        />
      )}

      <div className="relative z-10 flex items-center justify-end gap-4 p-4 bg-gradient-to-b from-black/75 to-transparent">
        <div className="text-right min-w-0">
          <h2 className="text-lg font-bold text-white truncate">{metadata.title}</h2>
          <div className="flex items-center justify-end gap-3 text-[11px] text-white/70 mt-1">
            {formatRuntime(metadata.runtime) && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatRuntime(metadata.runtime)}</span>}
            {metadata.vote_average ? <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" />{metadata.vote_average.toFixed(1)}</span> : null}
            {metadata.release_year && <span>{metadata.release_year}</span>}
          </div>
        </div>
        {posterUrl && <img src={posterUrl} alt="" className="w-12 h-16 rounded-lg object-cover border border-white/10 shadow-xl" />}
      </div>

      <div className="relative z-10 flex-1 min-h-0 flex items-center justify-center">
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-black"
          poster={backdropUrl}
          controls={isHost}
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          playsInline
          onLoadedMetadata={() => isHost && cinemaSync.dispatchVideoLoaded(videoRef.current?.currentTime || 0)}
          onPlay={() => !suppressEventsRef.current && cinemaSync.dispatchPlay()}
          onPause={() => !suppressEventsRef.current && cinemaSync.dispatchPause()}
          onSeeked={() => !suppressEventsRef.current && isHost && cinemaSync.dispatchSeek(videoRef.current?.currentTime || 0)}
          onError={(e) => {
            const videoEl = e.currentTarget;
            console.log('[CinemaPlayer] HTML5 video onError fired', { errorCode: videoEl.error?.code, errorMessage: videoEl.error?.message, src: videoEl.src, sourceUrl });
            tryHlsFallback();
          }}
        />
        {!isHost && <div className="absolute inset-0 z-20 cursor-default" />}
      </div>

      {error && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-shasha-danger/90 text-white text-xs font-semibold">
          {error}
        </div>
      )}

      {isHost && (
        <div className="relative z-30 p-3 bg-black/80 border-t border-white/10 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => videoRef.current?.paused ? videoRef.current?.play() : videoRef.current?.pause()} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-center">
              {isPlayerPlaying() ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button onClick={() => handleHostSeek(-10)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={() => handleHostSeek(10)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-center">
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex w-full md:max-w-xl gap-2">
            <button onClick={handleHostStreamChange} className="w-11 h-10 rounded-xl bg-shasha-accent text-white flex items-center justify-center shrink-0">
              <LinkIcon className="w-4 h-4" />
            </button>
            <input
              value={draftUrl}
              onChange={(event) => setDraftUrl(event.target.value)}
              className="flex-1 px-4 py-2 rounded-xl glass-input text-xs text-left dir-ltr"
              placeholder="https://cdn.example.com/movie.m3u8"
            />
          </div>
        </div>
      )}
    </div>
  );
}
