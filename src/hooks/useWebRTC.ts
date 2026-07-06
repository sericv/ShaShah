'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ParticipantPresence {
  id: string;
  name: string;
  isHost: boolean;
  micEnabled: boolean;
  camEnabled: boolean;
  screenShareEnabled: boolean;
  cameraStreamId?: string;
  screenStreamId?: string;
  isSpeaking: boolean;
  joinedAt: string;
  connectionState: 'connecting' | 'connected' | 'disconnected';
}

interface RemoteStreams {
  [peerId: string]: {
    cameraStream?: MediaStream;
    screenStream?: MediaStream;
  };
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export function useWebRTC(roomId: string, userName: string, myId: string) {
  const [localMediaStream, setLocalMediaStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreams>({});
  const [participants, setParticipants] = useState<ParticipantPresence[]>([]);
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  // Refs for tracking changing values without re-running useEffect
  const localMediaStreamRef = useRef<MediaStream | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const participantsRef = useRef<ParticipantPresence[]>([]);
  const candidateQueue = useRef<{ [peerId: string]: any[] }>({});
  const allStreams = useRef<{ [peerId: string]: Set<MediaStream> }>({});
  const initialNegotiationCompleted = useRef<{ [peerId: string]: boolean }>({});
  const negotiationPending = useRef<{ [peerId: string]: boolean }>({});

  // Refs for WebRTC connections and signaling
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcs = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const screenSenders = useRef<{ [peerId: string]: RTCRtpSender[] }>({});
  const mediaSenders = useRef<{ [peerId: string]: RTCRtpSender[] }>({});
  const myPresence = useRef<ParticipantPresence>({
    id: myId,
    name: userName,
    isHost: false,
    micEnabled: false,
    camEnabled: false,
    screenShareEnabled: false,
    isSpeaking: false,
    joinedAt: new Date().toISOString(),
    connectionState: 'connected',
  });

  // Track active device IDs
  const activeAudioDevice = useRef<string>('default');
  const activeVideoDevice = useRef<string>('');

  // Sync state values to refs for callback stability
  useEffect(() => {
    localMediaStreamRef.current = localMediaStream;
  }, [localMediaStream]);

  useEffect(() => {
    localScreenStreamRef.current = localScreenStream;
  }, [localScreenStream]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  // Sync loaded guest details to myPresence ref to prevent empty string keys
  useEffect(() => {
    if (myId) {
      myPresence.current.id = myId;
    }
    if (userName) {
      myPresence.current.name = userName;
    }
  }, [myId, userName]);

  // Update presence function
  const updatePresence = useCallback((updates: Partial<ParticipantPresence>) => {
    myPresence.current = { ...myPresence.current, ...updates };
    if (channelRef.current) {
      channelRef.current.track(myPresence.current);
    }
  }, []);

  // Broadcast signaling messages
  const sendSignaling = useCallback((receiverId: string, type: 'offer' | 'answer' | 'ice-candidate', payload: any) => {
    if (channelRef.current) {
      console.log(`[useWebRTC] Sending signaling type: ${type} to ${receiverId}`);
      channelRef.current.send({
        type: 'broadcast',
        event: 'signaling',
        payload: {
          senderId: myId,
          receiverId,
          type,
          payload,
        },
      });
    }
  }, [myId]);

  // Reactive mapping of received remote streams based on latest presence info
  const updateRemoteStreamsMapping = useCallback((currentParticipants: ParticipantPresence[]) => {
    setRemoteStreams((prev) => {
      const next: RemoteStreams = {};
      
      Object.keys(allStreams.current).forEach((peerId) => {
        const streams = Array.from(allStreams.current[peerId]);
        const pState = currentParticipants.find((p) => p.id === peerId);
        
        let cameraStream: MediaStream | undefined;
        let screenStream: MediaStream | undefined;

        streams.forEach((stream) => {
          // If stream ID matches the participant's metadata
          if (pState?.screenStreamId === stream.id) {
            screenStream = stream;
          } else if (pState?.cameraStreamId === stream.id) {
            cameraStream = stream;
          } else {
            // Fallback heuristics: screen share has no audio usually
            const hasVideo = stream.getVideoTracks().length > 0;
            const hasAudio = stream.getAudioTracks().length > 0;
            if (hasVideo && !hasAudio && pState?.screenShareEnabled) {
              screenStream = stream;
            } else {
              cameraStream = stream;
            }
          }
        });

        next[peerId] = { cameraStream, screenStream };
      });

      return next;
    });
  }, []);

  // Sync stream mappings whenever participants presence changes
  useEffect(() => {
    updateRemoteStreamsMapping(participants);
  }, [participants, updateRemoteStreamsMapping]);

  // Clean up a peer's connection
  const closePeerConnection = useCallback((peerId: string) => {
    console.log(`[useWebRTC] Closing PeerConnection for peer: ${peerId}`);
    if (pcs.current[peerId]) {
      pcs.current[peerId].close();
      delete pcs.current[peerId];
    }
    if (screenSenders.current[peerId]) {
      delete screenSenders.current[peerId];
    }
    if (mediaSenders.current[peerId]) {
      delete mediaSenders.current[peerId];
    }
    if (allStreams.current[peerId]) {
      delete allStreams.current[peerId];
    }
    if (candidateQueue.current[peerId]) {
      delete candidateQueue.current[peerId];
    }
    if (initialNegotiationCompleted.current[peerId]) {
      delete initialNegotiationCompleted.current[peerId];
    }
    if (negotiationPending.current[peerId]) {
      delete negotiationPending.current[peerId];
    }
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  // Initialize a PeerConnection for a specific remote peer
  const createPeerConnection = useCallback((peerId: string) => {
    if (pcs.current[peerId]) return pcs.current[peerId];

    console.log(`[useWebRTC] Peer created: creating RTCPeerConnection for ${peerId}`);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcs.current[peerId] = pc;

    // Track state change
    pc.onconnectionstatechange = () => {
      console.log(`[useWebRTC] connectionState change with ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        initialNegotiationCompleted.current[peerId] = true;
      }
      if (pc.connectionState === 'failed') {
        console.log(`[useWebRTC] Connection failed with ${peerId}. Restarting ICE Connection...`);
        pc.restartIce();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[useWebRTC] iceConnectionState change with ${peerId}: ${pc.iceConnectionState}`);
    };

    pc.onsignalingstatechange = async () => {
      console.log(`[useWebRTC] signalingState change with ${peerId}: ${pc.signalingState}`);
      if (pc.signalingState === 'stable' && negotiationPending.current[peerId]) {
        console.log(`[useWebRTC] Signaling state is now stable, executing pending negotiation for ${peerId}`);
        negotiationPending.current[peerId] = false;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          console.log(`[useWebRTC] Offer created and set as local description (pending negotiation) for ${peerId}`);
          sendSignaling(peerId, 'offer', offer);
        } catch (err) {
          console.error('Error executing pending negotiation:', err);
        }
      }
    };

    // Gather ICE candidates and send them
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[useWebRTC] ICE candidate sent to peer ${peerId}`);
        sendSignaling(peerId, 'ice-candidate', event.candidate);
      }
    };

    // Receive remote tracks
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (!remoteStream) return;

      console.log(`[useWebRTC] ontrack fired: received track ${event.track.kind} (${event.track.id}) from ${peerId}, stream ID: ${remoteStream.id}`);

      if (!allStreams.current[peerId]) {
        allStreams.current[peerId] = new Set();
      }
      allStreams.current[peerId].add(remoteStream);

      // Trigger reactive stream mapping update
      updateRemoteStreamsMapping(participantsRef.current);
    };

    // Add local tracks (webcam/mic) to the connection
    const currentMedia = localMediaStreamRef.current;
    if (currentMedia) {
      const senders: RTCRtpSender[] = [];
      currentMedia.getTracks().forEach((track) => {
        console.log(`[useWebRTC] addTrack called for camera/mic track: ${track.kind} (${track.id}) to peer ${peerId}`);
        const sender = pc.addTrack(track, currentMedia);
        senders.push(sender);
      });
      mediaSenders.current[peerId] = senders;
    }

    // Add local screen share tracks
    const currentScreen = localScreenStreamRef.current;
    if (currentScreen) {
      const senders: RTCRtpSender[] = [];
      currentScreen.getTracks().forEach((track) => {
        console.log(`[useWebRTC] addTrack called for screen track: ${track.kind} (${track.id}) to peer ${peerId}`);
        const sender = pc.addTrack(track, currentScreen);
        senders.push(sender);
      });
      screenSenders.current[peerId] = senders;
    }

    // Handle negotiation needed
    pc.onnegotiationneeded = async () => {
      try {
        console.log(`[useWebRTC] onnegotiationneeded event fired for peer ${peerId}. Current signalingState: ${pc.signalingState}`);
        if (pc.signalingState !== 'stable') {
          console.log(`[useWebRTC] Signaling state is not stable, queueing negotiation for ${peerId}`);
          negotiationPending.current[peerId] = true;
          return;
        }
        console.log(`[useWebRTC] Creating offer for ${peerId}`);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log(`[useWebRTC] Offer created and set as local description for ${peerId}`);
        sendSignaling(peerId, 'offer', offer);
      } catch (err) {
        console.error('Error in onnegotiationneeded:', err);
      }
    };

    return pc;
  }, [myId, sendSignaling, updateRemoteStreamsMapping]);

  // Process queued ICE candidates after remote description is set
  const processQueuedCandidates = async (peerId: string, pc: RTCPeerConnection) => {
    const queue = candidateQueue.current[peerId] || [];
    candidateQueue.current[peerId] = [];
    for (const candidate of queue) {
      try {
        console.log(`[useWebRTC] Processing queued ICE candidate for ${peerId}`);
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error(`[useWebRTC] Failed to add queued ICE candidate for ${peerId}:`, e);
      }
    }
  };

  // Handle incoming signaling messages
  const handleSignalingMessage = useCallback(async (senderId: string, type: string, payload: any) => {
    try {
      let pc = pcs.current[senderId];

      if (!pc) {
        pc = createPeerConnection(senderId);
      }

      if (type === 'offer') {
        console.log(`[useWebRTC] Offer received from ${senderId}`);
        
        // Perfect Negotiation Collision handling
        const polite = myId > senderId;
        const offerCollision = pc.signalingState !== 'stable';
        if (offerCollision) {
          if (!polite) {
            console.log(`[useWebRTC] Offer collision detected and we are impolite, ignoring remote offer from ${senderId}`);
            return;
          }
          console.log(`[useWebRTC] Offer collision detected and we are polite, rolling back local description for ${senderId}`);
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        console.log(`[useWebRTC] Set remote description (offer) successfully for ${senderId}`);
        const answer = await pc.createAnswer();
        console.log(`[useWebRTC] Answer created for ${senderId}`);
        await pc.setLocalDescription(answer);
        console.log(`[useWebRTC] Set local description (answer) successfully for ${senderId}`);
        sendSignaling(senderId, 'answer', answer);
        await processQueuedCandidates(senderId, pc);
      } else if (type === 'answer') {
        console.log(`[useWebRTC] Answer received from ${senderId}`);
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        console.log(`[useWebRTC] Set remote description (answer) successfully for ${senderId}`);
        await processQueuedCandidates(senderId, pc);
      } else if (type === 'ice-candidate') {
        console.log(`[useWebRTC] ICE candidate received from ${senderId}`);
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(payload));
          console.log(`[useWebRTC] Added ICE candidate immediately for ${senderId}`);
        } else {
          if (!candidateQueue.current[senderId]) {
            candidateQueue.current[senderId] = [];
          }
          candidateQueue.current[senderId].push(payload);
          console.log(`[useWebRTC] Queued ICE candidate for ${senderId}`);
        }
      }
    } catch (err) {
      console.error('Signaling processing failed:', err);
    }
  }, [createPeerConnection, sendSignaling]);

  // Start webcam & microphone
  const startMedia = useCallback(async (audioDeviceId = 'default', videoDeviceId = '') => {
    try {
      // Release existing media tracks
      if (localMediaStreamRef.current) {
        localMediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: audioDeviceId ? { exact: audioDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: videoDeviceId
          ? {
              deviceId: { exact: videoDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Initially disable tracks based on UI states
      stream.getAudioTracks().forEach((track) => {
        track.enabled = micEnabled;
      });
      stream.getVideoTracks().forEach((track) => {
        track.enabled = camEnabled;
      });

      setLocalMediaStream(stream);
      activeAudioDevice.current = audioDeviceId;
      activeVideoDevice.current = videoDeviceId;

      // Update Presence with stream info
      updatePresence({
        cameraStreamId: stream.id,
      });

      // Update track for all active peer connections
      Object.keys(pcs.current).forEach((peerId) => {
        const pc = pcs.current[peerId];
        
        // Remove existing media senders
        if (mediaSenders.current[peerId]) {
          mediaSenders.current[peerId].forEach((sender) => {
            try { pc.removeTrack(sender); } catch(e) {}
          });
        }

        // Add new tracks
        const newSenders: RTCRtpSender[] = [];
        stream.getTracks().forEach((track) => {
          console.log(`[useWebRTC] addTrack called (re-media) for camera/mic track: ${track.kind} (${track.id}) to peer ${peerId}`);
          const sender = pc.addTrack(track, stream);
          newSenders.push(sender);
        });
        mediaSenders.current[peerId] = newSenders;
      });

      return stream;
    } catch (err: any) {
      console.error('Failed to get media devices:', err);
      setError(`Media access failed: ${err.message || err}`);
      throw err;
    }
  }, [micEnabled, camEnabled, updatePresence]);

  // Handle toggling microphone
  const toggleMic = useCallback(async () => {
    try {
      const nextState = !micEnabled;
      setMicEnabled(nextState);

      let stream = localMediaStreamRef.current;
      if (!stream && nextState) {
        stream = await startMedia(activeAudioDevice.current, activeVideoDevice.current);
      }

      if (stream) {
        stream.getAudioTracks().forEach((t) => {
          t.enabled = nextState;
        });
      }

      updatePresence({ micEnabled: nextState });
    } catch (err) {
      setMicEnabled(false);
    }
  }, [micEnabled, startMedia, updatePresence]);

  // Handle toggling camera
  const toggleCam = useCallback(async () => {
    try {
      const nextState = !camEnabled;
      setCamEnabled(nextState);

      let stream = localMediaStreamRef.current;
      if (!stream && nextState) {
        stream = await startMedia(activeAudioDevice.current, activeVideoDevice.current);
      }

      if (stream) {
        stream.getVideoTracks().forEach((t) => {
          t.enabled = nextState;
        });
      }

      updatePresence({ camEnabled: nextState });
    } catch (err) {
      setCamEnabled(false);
    }
  }, [camEnabled, startMedia, updatePresence]);

  // Switch hardware devices
  const changeDevices = useCallback(async (audioId?: string, videoId?: string) => {
    const nextAudio = audioId || activeAudioDevice.current;
    const nextVideo = videoId || activeVideoDevice.current;
    
    if (localMediaStreamRef.current) {
      await startMedia(nextAudio, nextVideo);
    } else {
      activeAudioDevice.current = nextAudio;
      activeVideoDevice.current = nextVideo;
    }
  }, [startMedia]);

  // Start/Stop screen sharing
  const toggleScreenShare = useCallback(async () => {
    // Security check: only host can share screen
    if (!isHost) {
      console.warn('[useWebRTC] Screen sharing is restricted to host only.');
      return;
    }

    if (screenShareEnabled) {
      // Stop screen sharing
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      setLocalScreenStream(null);
      setScreenShareEnabled(false);
      updatePresence({ screenShareEnabled: false, screenStreamId: undefined });

      // Remove tracks from connections
      Object.keys(pcs.current).forEach((peerId) => {
        const pc = pcs.current[peerId];
        if (screenSenders.current[peerId]) {
          screenSenders.current[peerId].forEach((sender) => {
            try { pc.removeTrack(sender); } catch (e) {}
          });
          delete screenSenders.current[peerId];
        }
      });
    } else {
      // Start screen sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 60 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        console.log(`[useWebRTC] getDisplayMedia success. Stream ID: ${stream.id}`);
        stream.getVideoTracks().forEach((track) => {
          console.log(`[useWebRTC] screen track id: ${track.id}, kind: ${track.kind}`);
        });

        setLocalScreenStream(stream);
        setScreenShareEnabled(true);
        updatePresence({ screenShareEnabled: true, screenStreamId: stream.id });

        // Add screen share tracks to existing connections
        Object.keys(pcs.current).forEach((peerId) => {
          const pc = pcs.current[peerId];
          const senders: RTCRtpSender[] = [];
          stream.getTracks().forEach((track) => {
            console.log(`[useWebRTC] addTrack called (screen share start) for track: ${track.kind} (${track.id}) to peer ${peerId}`);
            const sender = pc.addTrack(track, stream);
            senders.push(sender);
          });
          screenSenders.current[peerId] = senders;
        });

        // Auto stop screen share if user clicks browser's native "Stop Sharing" bubble
        stream.getVideoTracks()[0].onended = () => {
          stream.getTracks().forEach((t) => t.stop());
          setLocalScreenStream(null);
          setScreenShareEnabled(false);
          updatePresence({ screenShareEnabled: false, screenStreamId: undefined });

          Object.keys(pcs.current).forEach((peerId) => {
            const pc = pcs.current[peerId];
            if (screenSenders.current[peerId]) {
              screenSenders.current[peerId].forEach((sender) => {
                try { pc.removeTrack(sender); } catch (e) {}
              });
              delete screenSenders.current[peerId];
            }
          });
        };
      } catch (err: any) {
        console.error('Screen sharing denied:', err);
        setScreenShareEnabled(false);
      }
    }
  }, [screenShareEnabled, updatePresence, isHost]);

  // Main Effect: Join room channel and manage signaling
  useEffect(() => {
    if (!roomId) return;

    console.log(`Joining Room: ${roomId} as User: ${userName} (${myId})`);
    
    // Subscribe to signaling channel
    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: {
          key: myId,
        },
      },
    });

    channelRef.current = channel;

    // Listen for broadcast signaling
    channel.on('broadcast', { event: 'signaling' }, ({ payload }) => {
      if (payload.receiverId === myId) {
        handleSignalingMessage(payload.senderId, payload.type, payload.payload);
      }
    });

    // Listen for presence syncs
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activePresences: ParticipantPresence[] = [];

        Object.keys(state).forEach((key) => {
          const presList = state[key] as any[];
          if (presList && presList.length > 0) {
            activePresences.push(presList[0] as ParticipantPresence);
          }
        });

        // Find oldest joined member to mark as host
        if (activePresences.length > 0) {
          const sorted = [...activePresences].sort(
            (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
          );
          const oldestId = sorted[0].id;
          activePresences.forEach((p) => {
            p.isHost = p.id === oldestId;
          });
          
          const amHost = myId === oldestId;
          myPresence.current.isHost = amHost;
          setIsHost(amHost);
        }

        setParticipants(activePresences);
        setConnectionState('connected');
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const newPeer = newPresences[0] as any;
        if (key && key !== '' && key !== myId && newPeer) {
          console.log(`Peer joined: ${newPeer.name} (${key})`);
          // Create peer connection immediately
          createPeerConnection(key);
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key && key !== '' && key !== myId) {
          console.log(`Peer left: ${key}`);
          closePeerConnection(key);
        }
      });

    // Subscribe
    channel.subscribe(async (status, err) => {
      console.log(`[useWebRTC] Realtime Channel Subscribe Status: ${status}`, err || '');
      if (status === 'SUBSCRIBED') {
        console.log('[useWebRTC] Subscribed to Room Realtime channel successfully');
        channel.track(myPresence.current);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[useWebRTC] Supabase Channel subscription error. Status:', status, 'Error object:', err);
        setConnectionState('error');
        setError(`Connection failed. Channel issue: ${err?.message || 'Channel Error'}`);
      } else if (status === 'TIMED_OUT') {
        console.warn('[useWebRTC] Supabase Channel subscription timed out');
      } else if (status === 'CLOSED') {
        console.log('[useWebRTC] Supabase Channel subscription closed');
      }
    });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      
      // Clean up all connections
      Object.keys(pcs.current).forEach((peerId) => {
        closePeerConnection(peerId);
      });

      // Stop local tracks
      if (localMediaStreamRef.current) {
        localMediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [roomId, userName, myId, handleSignalingMessage, createPeerConnection, closePeerConnection]);

  // Speaking indicator effect (runs on local mic track and sets speaking presence)
  useEffect(() => {
    if (!localMediaStream || !micEnabled) {
      if (myPresence.current.isSpeaking) {
        updatePresence({ isSpeaking: false });
      }
      return;
    }

    const audioTracks = localMediaStream.getAudioTracks();
    if (audioTracks.length === 0) return;

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let intervalId: any = null;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source = audioContext.createMediaStreamSource(new MediaStream([audioTracks[0]]));
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let speakingDebounce = 0;

        intervalId = setInterval(() => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          
          // Audio threshold for active speaking
          const isSpeaking = average > 12;

          if (isSpeaking) {
            speakingDebounce = 3; // Keep speaking true for a few ticks to avoid flickering
          } else {
            speakingDebounce = Math.max(0, speakingDebounce - 1);
          }

          const currentlySpeaking = speakingDebounce > 0;

          if (currentlySpeaking !== myPresence.current.isSpeaking) {
            updatePresence({ isSpeaking: currentlySpeaking });
          }
        }, 150);
      }
    } catch (e) {
      console.warn('Speaking indicator AudioContext initialization failed', e);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (source) source.disconnect();
      if (audioContext) {
        audioContext.close().catch(() => {});
      }
    };
  }, [localMediaStream, micEnabled, updatePresence]);

  return {
    localMediaStream,
    localScreenStream,
    remoteStreams,
    participants,
    connectionState,
    micEnabled,
    camEnabled,
    screenShareEnabled,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    changeDevices,
    error,
    isHost,
  };
}
