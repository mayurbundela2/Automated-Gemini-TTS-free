export interface Project {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  batch_count: number;
  paragraph_count: number;
  completed_generations: number;
}

export interface LimitMetrics {
  status: 'SAFE' | 'NEAR_LIMIT' | 'OVER_LIMIT';
  words: number;
  characters: number;
  max_words: number;
  max_characters: number;
  word_percentage: number;
  character_percentage: number;
  is_over_limit: boolean;
  is_near_limit: boolean;
}

export interface WaveformData {
  peaks: number[];
  duration: number;
  sample_rate?: number;
  channels?: number;
}

export interface Generation {
  id: number;
  paragraph_id: number;
  project_name?: string;
  batch_number?: number;
  paragraph_number?: number;
  part_number?: string;
  voice: string;
  model: string;
  duration?: number;
  wav_path?: string;
  mp3_path?: string;
  metadata_path?: string;
  status: string;
  error_message?: string;
  created_at: string;
  waveform?: WaveformData;
}

export interface Paragraph {
  id: number;
  batch_id: number;
  paragraph_number: number;
  part_number?: string;
  scene?: string;
  sample_context?: string;
  audio_profile?: string;
  speaker?: string;
  style?: string;
  pace?: string;
  accent?: string;
  voice?: string;
  director_notes?: string;
  additional_notes?: string;
  transcript: string;
  custom_prompt?: string;
  word_count: number;
  character_count: number;
  status: 'DRAFT' | 'READY' | 'OVER_LIMIT' | 'QUEUED' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  limit_status: 'SAFE' | 'NEAR_LIMIT' | 'OVER_LIMIT';
  limit_metrics?: LimitMetrics;
  raw_reference?: string;
  parent_paragraph_id?: number;
  created_at: string;
  updated_at: string;
  latest_generation?: Generation;
}

export interface MediaAsset {
  id: number;
  filename: string;
  file_type: 'image' | 'video';
  duration?: number;
  width?: number;
  height?: number;
  size_bytes?: number;
  tags?: string;
  created_at?: string;
  url: string;
}

export interface SceneAsset {
  id: number;
  paragraph_id: number;
  filename: string;
  file_path: string;
  asset_type: 'photo' | 'video';
  order_index: number;
  sequence_index: number;
  duration_override_ms?: number;
  matched_automatically: boolean;
  url: string;
}

export interface SequenceSegment {
  paragraph_id: number;
  paragraph_number: number;
  part_title: string;
  subtitle_text: string;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  assets: SceneAsset[];
}

export interface BatchSequenceResponse {
  batch_id: number;
  tight_duration_ms: number;
  total_paragraphs: number;
  segments: SequenceSegment[];
}

export interface TimelineCut {
  id?: string;
  scene_index: number;
  paragraph_id?: number;
  paragraph_number: number;
  part_title: string;
  transcript: string;
  timeline_start: number;
  timeline_end: number;
  duration: number;
  source_start?: number;
  source_end?: number;
  media_asset_id?: number;
  media_filename?: string;
  media_type?: 'image' | 'video';
  media_path?: string;
  match_score?: number;
  match_confidence?: number;
  match_reason?: string;
  match_method?: string;
  locked?: boolean;
  motion?: {
    type: 'zoom_in' | 'zoom_out' | 'pan_right' | 'pan_left' | 'static';
    amount?: number;
  };
  transition?: {
    type: 'cut' | 'crossfade';
    duration?: number;
  };
}

export interface Batch {
  id: number;
  project_id: number;
  batch_number: number;
  name: string;
  raw_reference?: string;
  status: string;
  created_at: string;
  updated_at: string;
  paragraphs: Paragraph[];
  total_words: number;
  total_characters: number;
  ready_count: number;
  over_limit_count: number;
  completed_count: number;
  combined_audio?: {
    wav_path: string;
    mp3_path?: string;
    duration: number;
    waveform?: WaveformData;
  };
  tight_audio?: {
    wav_path: string;
    mp3_path?: string;
    mp4_path?: string;
    duration: number;
    waveform?: WaveformData;
  };
  rendered_video_path?: string;
  timeline_data?: string;
}

export interface VoiceItem {
  name: string;
  gender: string;
  description: string;
  recommended_for: string;
  is_default: boolean;
}

export interface AppSettings {
  gemini_api_key_masked: string;
  gemini_api_key?: string;
  gemini_model: string;
  default_voice: string;
  max_tts_characters: number;
  max_tts_words: number;
  near_limit_threshold: number;
  auto_split: boolean;
  auto_convert_mp3: boolean;
  mp3_bitrate: string;
  preserve_inline_tags: boolean;
  output_folder: string;
  chrome_path: string;
  ffmpeg_path: string;
  is_demo_mode: boolean;
}
