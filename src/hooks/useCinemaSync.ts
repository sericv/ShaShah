'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CinemaPlaybackState, CinemaSyncEvent } from '@/types/cinema';

interface CinemaSyncMessage {
  event: CinemaSyncEvent;
  state?: CinemaPlaybackState;
  requesterId?: string;
}

interface UseCinemaSyncProps {
  roomId: string;
  myId: string;
  isHost: boolean;
  initialStreamUrl: string;
  getPlayerTime: () => number;
  isPlayerPlaying: () => boolean;
  onRemoteState: (state: CinemaPlaybackState, event: CinemaSyncEvent) => void;
}

export function useCinemaSync({
  roomId,
  myId,
  isHost,
  initialStreamUrl,
  getPlayerTime,
  isPlayerPlaying,
  onRemoteState,
}: UseCinemaSyncProps) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [streamUrl, setStreamUrl] = useState(initialStreamUrl);

  console.log('[useCinemaSync] render', { isHost, roomId, myId, initialStreamUrl, streamUrl });

  const setStreamUrlAndLog = useCallback((url: string, source: string) => {
    console.log('[useCinemaSync] setStreamUrl', { url, source, isHost, roomId });
    setStreamUrl(url);
  }, [isHost, roomId]);

  useEffect(() => {
    console.log('[useCinemaSync] initialStreamUrl changed', { initialStreamUrl, isHost, roomId });
    setStreamUrl(initialStreamUrl);
  }, [initialStreamUrl]);

  const buildState = useCallback((override?: Partial<CinemaPlaybackState>): CinemaPlaybackState => ({
    streamUrl,
    currentTime: getPlayerTime(),
    isPlaying: isPlayerPlaying(),
    updatedAt: Date.now(),
    ...override,
  }), [getPlayerTime, isPlayerPlaying, streamUrl]);

  const broadcast = useCallback((event: CinemaSyncEvent, state?: CinemaPlaybackState, requesterId?: string) => {
    channelRef.current?.send({
      type: 'broadcast',
      event,
      payload: { event, state, requesterId } satisfies CinemaSyncMessage,
    });
  }, []);

  const hostDispatch = useCallback((event: Exclude<CinemaSyncEvent, 'sync_request'>, override?: Partial<CinemaPlaybackState>) => {
    if (!isHost) return;
    const nextState = buildState(override);
    setStreamUrlAndLog(nextState.streamUrl, `hostDispatch:${event}`);
    broadcast(event, nextState);
  }, [broadcast, buildState, isHost, setStreamUrlAndLog]);

  useEffect(() => {
    if (!roomId || !myId) return;

    const channel = supabase.channel(`cinema_sync:${roomId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'video_loaded' }, ({ payload }) => {
        const message = payload as CinemaSyncMessage;
        console.log('[useCinemaSync] received video_loaded', { isHost, hasState: !!message.state, currentTime: message.state?.currentTime });
        if (!isHost && message.state) onRemoteState(message.state, 'video_loaded');
      })
      .on('broadcast', { event: 'play' }, ({ payload }) => {
        const message = payload as CinemaSyncMessage;
        console.log('[useCinemaSync] received play', { isHost, currentTime: message.state?.currentTime });
        if (!isHost && message.state) onRemoteState(message.state, 'play');
      })
      .on('broadcast', { event: 'pause' }, ({ payload }) => {
        const message = payload as CinemaSyncMessage;
        console.log('[useCinemaSync] received pause', { isHost, currentTime: message.state?.currentTime });
        if (!isHost && message.state) onRemoteState(message.state, 'pause');
      })
      .on('broadcast', { event: 'seek' }, ({ payload }) => {
        const message = payload as CinemaSyncMessage;
        console.log('[useCinemaSync] received seek', { isHost, currentTime: message.state?.currentTime });
        if (!isHost && message.state) onRemoteState(message.state, 'seek');
      })
      .on('broadcast', { event: 'change_stream' }, ({ payload }) => {
        const message = payload as CinemaSyncMessage;
        if (!isHost && message.state) {
          console.log('[useCinemaSync] received change_stream', { streamUrl: message.state.streamUrl, isHost, myId });
          setStreamUrlAndLog(message.state.streamUrl, 'broadcast:change_stream');
          onRemoteState(message.state, 'change_stream');
        }
      })
      .on('broadcast', { event: 'sync_request' }, ({ payload }) => {
        const message = payload as CinemaSyncMessage;
        console.log('[useCinemaSync] received sync_request from:', message.requesterId, 'myId:', myId, 'isHost:', isHost);
        if (isHost && message.requesterId !== myId) {
          console.log('[useCinemaSync] host responding to sync_request with current state');
          broadcast('sync_state', buildState());
        }
      })
      .on('broadcast', { event: 'sync_state' }, ({ payload }) => {
        const message = payload as CinemaSyncMessage;
        if (!isHost && message.state) {
          console.log('[useCinemaSync] received sync_state', { streamUrl: message.state.streamUrl, currentTime: message.state.currentTime, isPlaying: message.state.isPlaying, isHost, myId });
          setStreamUrlAndLog(message.state.streamUrl, 'broadcast:sync_state');
          onRemoteState(message.state, 'sync_state');
        }
      })
      .subscribe((status) => {
        console.log('[useCinemaSync] subscription status:', status, 'isHost:', isHost);
        if (status === 'SUBSCRIBED' && !isHost) {
          console.log('[useCinemaSync] guest subscribed, sending sync_request');
          broadcast('sync_request', undefined, myId);
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [broadcast, buildState, isHost, myId, onRemoteState, roomId]);

  return {
    streamUrl,
    dispatchVideoLoaded: (durationTime = getPlayerTime()) => hostDispatch('video_loaded', { currentTime: durationTime }),
    dispatchPlay: () => hostDispatch('play', { isPlaying: true }),
    dispatchPause: () => hostDispatch('pause', { isPlaying: false }),
    dispatchSeek: (currentTime: number) => hostDispatch('seek', { currentTime }),
    dispatchStreamChange: (nextUrl: string) => hostDispatch('change_stream', {
      streamUrl: nextUrl,
      currentTime: 0,
      isPlaying: false,
    }),
  };
}

