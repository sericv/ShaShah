import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type YouTubePlayerState = {
  videoId: string | null;
  playing: boolean;
  currentTime: number;
};

export type YouTubePlayerEvent = 
  | { type: 'change_video'; payload: { videoId: string } }
  | { type: 'play'; payload: { currentTime: number } }
  | { type: 'pause'; payload: { currentTime: number } }
  | { type: 'seek'; payload: { currentTime: number } }
  | { type: 'sync_state'; payload: YouTubePlayerState };

interface UseYouTubeSyncProps {
  roomId: string;
  isHost: boolean;
  onEvent: (event: YouTubePlayerEvent) => void;
  getState: () => YouTubePlayerState;
}

export function useYouTubeSync({ roomId, isHost, onEvent, getState }: UseYouTubeSyncProps) {
  const channelRef = useRef<any>(null);
  
  // Keep the latest callbacks in refs to avoid re-triggering the useEffect
  const onEventRef = useRef(onEvent);
  const getStateRef = useRef(getState);
  
  useEffect(() => {
    onEventRef.current = onEvent;
    getStateRef.current = getState;
  }, [onEvent, getState]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`youtube_sync:${roomId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'youtube_command' }, ({ payload }) => {
        console.log(`[YouTube Sync] RECEIVED ${payload.type}`, payload);

        // Members listen to Host commands. Host also listens to request_sync.
        if (payload.type === 'request_sync') {
          if (isHost) {
            const currentState = getStateRef.current();
            console.log(`[YouTube Sync] SEND sync_state`, currentState);
            // Send current state back
            channel.send({
              type: 'broadcast',
              event: 'youtube_command',
              payload: {
                type: 'sync_state',
                payload: currentState,
              },
            });
          }
        } else {
          // Other commands: play, pause, seek, change_video, sync_state
          onEventRef.current(payload as YouTubePlayerEvent);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && !isHost) {
          console.log(`[YouTube Sync] SEND request_sync`);
          // New member asks for the current video state
          channel.send({
            type: 'broadcast',
            event: 'youtube_command',
            payload: { type: 'request_sync' },
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, isHost]);

  // Methods for the Host to broadcast events
  const broadcastEvent = useCallback((event: YouTubePlayerEvent) => {
    if (channelRef.current && isHost) {
      console.log(`[YouTube Sync] SEND ${event.type}`, event.payload);
      channelRef.current.send({
        type: 'broadcast',
        event: 'youtube_command',
        payload: event,
      });
    }
  }, [isHost]);

  return { broadcastEvent };
}
