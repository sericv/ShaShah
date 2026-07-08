export interface UserProfile {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  banner_url: string;
  bio: string;
  country: string;
  favorite_genre: string;
  favorite_movie_id: string;
  favorite_movie_title: string;
  favorite_movie_poster: string;
  favorite_series_id: string;
  favorite_series_title: string;
  favorite_series_poster: string;
  movies_watched: number;
  series_watched: number;
  watchlist_count: number;
  favorite_movies_count?: number;
  favorite_series_count?: number;
  friends_count?: number;
  rooms_created?: number;
  hours_watched: number;
  total_watch_time: number;
  achievements_count: number;
  created_at: string;
}

export interface LibraryItem {
  id: string;
  user_id: string;
  movie_id: string;
  movie_title: string;
  poster_path: string;
  media_type: 'movie' | 'tv';
  status: 'watched' | 'watching' | 'watchlist';
  rating: number;
  progress: number;
  created_at: string;
}

export interface FavoriteItem {
  id: string;
  user_id: string;
  movie_id: string;
  movie_title: string;
  poster_path: string;
  media_type: 'movie' | 'tv';
  created_at: string;
}

export interface MovieRating {
  id: string;
  user_id: string;
  tmdb_id: string;
  media_type: 'movie' | 'tv';
  rating: number;
  created_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  tmdb_id: string;
  media_type: 'movie' | 'tv';
  content: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

export interface ActivityLogItem {
  id: string;
  user_id: string;
  activity_type: ActivityType;
  tmdb_id: string;
  media_type: 'movie' | 'tv' | null;
  metadata: Record<string, any>;
  created_at: string;
}

export type ActivityType =
  | 'watched_movie'
  | 'watched_episode'
  | 'finished_series'
  | 'added_to_watchlist'
  | 'rated_movie'
  | 'reviewed_movie'
  | 'added_to_favorites'
  | 'joined_cinema_room'
  | 'added_friend'
  | 'created_room';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement_type: string;
  requirement_value: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  achievement?: Achievement;
  unlocked_at: string;
}

export interface UserSettings {
  user_id: string;
  sound_muted: boolean;
  theme: string;
  language: string;
  privacy_status: 'public' | 'friends_only' | 'private';
  hide_watch_history: boolean;
  hide_watchlist: boolean;
  hide_ratings: boolean;
  hide_activity: boolean;
}

export interface CurrentlyWatching {
  roomId: string;
  roomName: string;
  title: string;
  poster_path: string;
  tmdb_id: string;
  media_type: 'movie' | 'tv';
}

export interface ActivityDescription {
  icon: string;
  text: string;
}

export const ACTIVITY_LABELS: Record<ActivityType, ActivityDescription> = {
  watched_movie: { icon: '🎬', text: 'شاهد فيلماً' },
  watched_episode: { icon: '📺', text: 'شاهد حلقة' },
  finished_series: { icon: '🏁', text: 'أكمل مسلسلاً' },
  added_to_watchlist: { icon: '📋', text: 'أضاف إلى قائمة المشاهدة' },
  rated_movie: { icon: '⭐', text: 'قيّم فيلماً' },
  reviewed_movie: { icon: '✍️', text: 'كتب مراجعة' },
  added_to_favorites: { icon: '❤️', text: 'أضاف إلى المفضلة' },
  joined_cinema_room: { icon: '🎥', text: 'انضم إلى غرفة سينما' },
  added_friend: { icon: '👥', text: 'أضاف صديقاً' },
  created_room: { icon: '🛋️', text: 'أنشأ غرفة بث' },
};
