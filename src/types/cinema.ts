export type RoomType = 'normal' | 'cinema';

export interface CinemaRoomMetadata {
  room_type?: RoomType | null;
  tmdb_id?: number | null;
  title?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_year?: string | null;
  vote_average?: number | null;
  runtime?: number | null;
  stream_url?: string | null;
}

export interface CinemaPlaybackState {
  streamUrl: string;
  currentTime: number;
  isPlaying: boolean;
  updatedAt: number;
}

export type CinemaSyncEvent =
  | 'video_loaded'
  | 'play'
  | 'pause'
  | 'seek'
  | 'sync_request'
  | 'sync_state'
  | 'change_stream';

