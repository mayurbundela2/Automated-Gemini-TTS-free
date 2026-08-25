import { Project, Batch, Paragraph, Generation, AppSettings, VoiceItem } from './types';

const API_BASE = '/api';

export const api = {
  // Settings
  async getSettings(): Promise<AppSettings> {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  // Voices
  async getVoices(): Promise<VoiceItem[]> {
    const res = await fetch(`${API_BASE}/voices`);
    if (!res.ok) throw new Error('Failed to fetch voices');
    return res.json();
  },

  async addCustomVoice(name: string): Promise<VoiceItem[]> {
    const res = await fetch(`${API_BASE}/voices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to add custom voice');
    return res.json();
  },

  // System
  async openAiStudio(): Promise<{ status: string; opened: boolean }> {
    const res = await fetch(`${API_BASE}/open-ai-studio`, { method: 'POST' });
    return res.json();
  },

  async openFolder(path: string): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/open-folder?path=${encodeURIComponent(path)}`, { method: 'POST' });
    return res.json();
  },

  // Projects
  async getProjects(): Promise<Project[]> {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  async createProject(name: string, description?: string): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to create project');
    }
    return res.json();
  },

  async getProject(id: number): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects/${id}`);
    if (!res.ok) throw new Error('Failed to fetch project');
    return res.json();
  },

  async updateProject(id: number, data: { name?: string; description?: string }): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update project');
    return res.json();
  },

  async deleteProject(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete project');
  },

  // Batches
  async getBatches(projectId: number): Promise<Batch[]> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/batches`);
    if (!res.ok) throw new Error('Failed to fetch batches');
    return res.json();
  },

  async createBatch(projectId: number, name: string, batchNumber?: number): Promise<Batch> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, batch_number: batchNumber }),
    });
    if (!res.ok) throw new Error('Failed to create batch');
    return res.json();
  },

  async getBatch(id: number): Promise<Batch> {
    const res = await fetch(`${API_BASE}/batches/${id}`);
    if (!res.ok) throw new Error('Failed to fetch batch');
    return res.json();
  },

  async deleteBatch(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/batches/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete batch');
  },

  async parseReference(batchId: number, rawText: string, defaultVoice?: string): Promise<{ detected_count: number; paragraphs: any[] }> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/parse-reference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: rawText, default_voice: defaultVoice }),
    });
    if (!res.ok) throw new Error('Failed to parse reference');
    return res.json();
  },

  async importReference(batchId: number, rawText: string, defaultVoice?: string): Promise<Batch> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/import-reference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: rawText, default_voice: defaultVoice }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to import reference');
    }
    return res.json();
  },

  async generateAllReady(batchId: number): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/generate-ready`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Batch generation failed');
    }
    return res.json();
  },

  async combineBatchAudio(batchId: number): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/combine-audio`, {
      method: 'POST',
    });
    if (!res.ok) {
      let msg = 'Failed to combine batch audio';
      try {
        const err = await res.json();
        msg = err.detail || msg;
      } catch {
        const text = await res.text();
        msg = text || msg;
      }
      throw new Error(msg);
    }
    return res.json();
  },

  async tightenBatchAudio(batchId: number, silenceThreshold = 0.35): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/tighten-audio?silence_threshold=${silenceThreshold}`, {
      method: 'POST',
    });
    if (!res.ok) {
      let msg = 'Failed to trim pauses';
      try {
        const err = await res.json();
        msg = err.detail || msg;
      } catch {
        const text = await res.text();
        msg = text || msg;
      }
      throw new Error(msg);
    }
    return res.json();
  },

  async rebuildAllBatchAudio(batchId: number, silenceThreshold = 0.35): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/rebuild-all?silence_threshold=${silenceThreshold}`, {
      method: 'POST',
    });
    if (!res.ok) {
      let msg = 'Failed to rebuild narration';
      try {
        const err = await res.json();
        msg = err.detail || msg;
      } catch {
        const text = await res.text();
        msg = text || msg;
      }
      throw new Error(msg);
    }
    return res.json();
  },

  getBatchAudioUrl(batchId: number, format: 'wav' | 'mp3' = 'wav', download = false): string {
    return `${API_BASE}/batches/${batchId}/audio?format=${format}${download ? '&download=true' : ''}`;
  },

  getBatchTightAudioUrl(batchId: number, format: 'wav' | 'mp3' | 'mp4' = 'mp4', download = false): string {
    return `${API_BASE}/batches/${batchId}/tight-audio?format=${format}${download ? '&download=true' : ''}`;
  },

  getBatchSubtitlesUrl(batchId: number, format: 'srt' | 'vtt' | 'json' = 'srt', type: 'master' | 'tight' = 'master', download = false): string {
    return `${API_BASE}/batches/${batchId}/subtitles?format=${format}&type=${type}${download ? '&download=true' : ''}`;
  },

  async getBatchWordTimestamps(batchId: number, type: 'master' | 'tight' = 'master'): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/word-timestamps?type=${type}`);
    if (!res.ok) {
      throw new Error('Failed to fetch word timestamps');
    }
    return res.json();
  },

  getParagraphSubtitlesUrl(paragraphId: number, format: 'srt' | 'vtt' | 'json' = 'srt', download = false): string {
    return `${API_BASE}/paragraphs/${paragraphId}/subtitles?format=${format}${download ? '&download=true' : ''}`;
  },

  // Paragraphs
  async updateParagraph(id: number, data: Partial<Paragraph>): Promise<Paragraph> {
    const res = await fetch(`${API_BASE}/paragraphs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update paragraph');
    return res.json();
  },

  async deleteParagraph(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/paragraphs/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete paragraph');
  },

  async previewPrompt(id: number): Promise<{ paragraph_id: number; prompt: string; is_custom: boolean; transcript: string; voice: string }> {
    const res = await fetch(`${API_BASE}/paragraphs/${id}/preview-prompt`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to preview prompt');
    return res.json();
  },

  async resetPrompt(id: number): Promise<any> {
    const res = await fetch(`${API_BASE}/paragraphs/${id}/reset-prompt`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset prompt');
    return res.json();
  },

  async generateParagraph(id: number): Promise<any> {
    const res = await fetch(`${API_BASE}/paragraphs/${id}/generate`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Generation failed');
    }
    return res.json();
  },

  async autoSplitParagraph(id: number): Promise<any> {
    const res = await fetch(`${API_BASE}/paragraphs/${id}/split-auto`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to auto split paragraph');
    return res.json();
  },

  async manualSplitParagraph(id: number, partA: string, partB: string, partC?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/paragraphs/${id}/split-manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ part_a_transcript: partA, part_b_transcript: partB, part_c_transcript: partC }),
    });
    if (!res.ok) throw new Error('Failed to split paragraph');
    return res.json();
  },

  async mergeParagraph(id: number): Promise<any> {
    const res = await fetch(`${API_BASE}/paragraphs/${id}/merge`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to merge sub-paragraphs');
    }
    return res.json();
  },

  // Generations & Audio
  async getGenerations(limit = 50): Promise<Generation[]> {
    const res = await fetch(`${API_BASE}/generations?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch generations');
    return res.json();
  },

  getAudioUrl(genId: number, format: 'wav' | 'mp3' = 'wav', download = false): string {
    return `${API_BASE}/generations/${genId}/audio?format=${format}${download ? '&download=true' : ''}`;
  },

  async deleteGeneration(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/generations/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete generation');
  },

  // Media & Video Sequence Editor
  async uploadBatchMedia(batchId: number, files: File[]): Promise<{ uploaded_count: number; assets: any[] }> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    const res = await fetch(`${API_BASE}/batches/${batchId}/media/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to upload media files');
    }
    return res.json();
  },

  async listBatchMedia(batchId: number): Promise<any[]> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/media`);
    if (!res.ok) throw new Error('Failed to fetch media assets');
    return res.json();
  },

  async deleteMediaAsset(assetId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/media/${assetId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete media asset');
  },

  getMediaFileUrl(assetId: number): string {
    return `${API_BASE}/media/${assetId}/file`;
  },

  async autoAlignBatchSequence(batchId: number, trackType: 'master' | 'tight' = 'master'): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/sequence/auto-align?track_type=${trackType}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to auto-align visual sequence');
    }
    return res.json();
  },

  async getBatchSequence(batchId: number): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/sequence`);
    if (!res.ok) throw new Error('Failed to fetch sequence');
    return res.json();
  },

  async updateBatchSequence(batchId: number, cuts: any[]): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/sequence`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeline_cuts: cuts }),
    });
    if (!res.ok) throw new Error('Failed to save sequence adjustments');
    return res.json();
  },

  async renderTimelineVideo(batchId: number, trackType: 'master' | 'tight' = 'tight'): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/render-video?track_type=${trackType}`, {
      method: 'POST',
    });
    if (!res.ok) {
      let msg = 'Failed to render 1080p video';
      try {
        const err = await res.json();
        msg = err.detail || msg;
      } catch {
        const text = await res.text();
        msg = text || msg;
      }
      throw new Error(msg);
    }
    return res.json();
  },

  getRenderedVideoUrl(batchId: number, download = false): string {
    return `${API_BASE}/batches/${batchId}/rendered-video${download ? '?download=true' : ''}`;
  }
};
