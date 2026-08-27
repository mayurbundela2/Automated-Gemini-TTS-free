/**
 * Local Mobile Database & Storage Service for Standalone Android App.
 * Uses IndexedDB for rich persistent object and blob storage.
 */

import { Project, Batch, Paragraph, Generation, AppSettings, VoiceItem } from '../types';

const DB_NAME = 'GeminiTTSMobileDB';
const DB_VERSION = 1;

export class MobileStorage {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e: any) => {
        const db = e.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('batches')) {
          db.createObjectStore('batches', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('paragraphs')) {
          db.createObjectStore('paragraphs', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('generations')) {
          db.createObjectStore('generations', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('audio_blobs')) {
          db.createObjectStore('audio_blobs', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return this.dbPromise;
  }

  // --- Settings ---
  public static async getSettings(): Promise<AppSettings> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get('app_settings');
      req.onsuccess = () => {
        if (req.result && req.result.value) {
          resolve(req.result.value);
        } else {
          resolve({
            gemini_api_key_masked: '',
            gemini_api_key: '',
            gemini_model: 'gemini-3.1-flash-tts-preview',
            default_voice: 'Algenib',
            default_style: 'Neutral',
            default_pace: 'Normal',
            default_accent: 'Neutral',
            max_words_per_paragraph: 500,
            max_characters_per_paragraph: 3000,
            output_folder: 'outputs',
            is_demo_mode: false,
          });
        }
      };
      req.onerror = () => {
        resolve({
          gemini_api_key_masked: '',
          gemini_api_key: '',
          gemini_model: 'gemini-3.1-flash-tts-preview',
          default_voice: 'Algenib',
          mp3_bitrate: '320k',
          preserve_inline_tags: true,
          output_folder: 'outputs',
          chrome_path: '',
          ffmpeg_path: '',
          is_demo_mode: false,
        });
      };
    });
  }

  public static async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      store.put({ key: 'app_settings', value: updated });
      tx.oncomplete = () => resolve(updated);
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Audio Blobs ---
  public static async saveAudioBlob(key: string, blob: Blob): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio_blobs', 'readwrite');
      const store = tx.objectStore('audio_blobs');
      store.put({ key, blob, timestamp: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public static async getAudioBlob(key: string): Promise<Blob | null> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('audio_blobs', 'readonly');
      const store = tx.objectStore('audio_blobs');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result?.blob || null);
      req.onerror = () => resolve(null);
    });
  }

  // --- Projects ---
  public static async getProjects(): Promise<Project[]> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  public static async getProject(id: number): Promise<Project | null> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  public static async createProject(name: string, description?: string): Promise<Project> {
    const db = await this.getDB();
    const project: any = {
      name,
      description: description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      batch_count: 1,
      paragraph_count: 0,
      completed_generations: 0,
    };

    const createdProject: Project = await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.add(project);
      req.onsuccess = () => {
        project.id = req.result as number;
        resolve(project);
      };
      tx.onerror = () => reject(tx.error);
    });

    // Auto-create Batch 1
    await this.createBatch(createdProject.id, 'Batch 1', 1);
    return createdProject;
  }

  public static async updateProject(id: number, data: { name?: string; description?: string }): Promise<Project> {
    const project = await this.getProject(id);
    if (!project) throw new Error('Project not found');

    const updated = { ...project, ...data, updated_at: new Date().toISOString() };
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      store.put(updated);
      tx.oncomplete = () => resolve(updated);
      tx.onerror = () => reject(tx.error);
    });
  }

  public static async deleteProject(id: number): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Batches ---
  public static async getBatches(projectId: number): Promise<Batch[]> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('batches', 'readonly');
      const store = tx.objectStore('batches');
      const req = store.getAll();
      req.onsuccess = () => {
        const all: Batch[] = req.result || [];
        resolve(all.filter((b: any) => b.project_id === projectId));
      };
      req.onerror = () => resolve([]);
    });
  }

  public static async getBatch(id: number): Promise<Batch | null> {
    const db = await this.getDB();
    const batch: any = await new Promise((resolve) => {
      const tx = db.transaction('batches', 'readonly');
      const store = tx.objectStore('batches');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    if (!batch) return null;
    batch.paragraphs = await this.getParagraphs(id);
    return batch;
  }

  public static async createBatch(projectId: number, name: string, batchNumber?: number): Promise<Batch> {
    const existing = await this.getBatches(projectId);
    const num = batchNumber || existing.length + 1;
    const db = await this.getDB();

    const batch: any = {
      project_id: projectId,
      batch_number: num,
      name,
      status: 'DRAFT',
      created_at: new Date().toISOString(),
      total_paragraphs: 0,
      total_words: 0,
      total_characters: 0,
      ready_count: 0,
      over_limit_count: 0,
      completed_count: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('batches', 'readwrite');
      const store = tx.objectStore('batches');
      const req = store.add(batch);
      req.onsuccess = () => {
        batch.id = req.result as number;
        resolve(batch);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  public static async updateBatch(id: number, data: Partial<Batch>): Promise<Batch> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('batches', 'readwrite');
      const store = tx.objectStore('batches');
      const req = store.get(id);
      req.onsuccess = () => {
        const existing = req.result;
        if (!existing) {
          reject(new Error('Batch not found'));
          return;
        }
        const updated = { ...existing, ...data };
        store.put(updated);
        resolve(updated);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  public static async deleteBatch(id: number): Promise<void> {
    const db = await this.getDB();
    await this.deleteBatchParagraphs(id);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('batches', 'readwrite');
      const store = tx.objectStore('batches');
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public static async deleteBatchParagraphs(batchId: number): Promise<void> {
    const paras = await this.getParagraphs(batchId);
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('paragraphs', 'readwrite');
      const store = tx.objectStore('paragraphs');
      for (const p of paras) {
        store.delete(p.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Paragraphs ---
  public static async getParagraph(id: number): Promise<Paragraph | null> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('paragraphs', 'readonly');
      const store = tx.objectStore('paragraphs');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  public static async getParagraphs(batchId: number): Promise<Paragraph[]> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('paragraphs', 'readonly');
      const store = tx.objectStore('paragraphs');
      const req = store.getAll();
      req.onsuccess = () => {
        const all: Paragraph[] = req.result || [];
        resolve(all.filter((p: any) => p.batch_id === batchId).sort((a, b) => a.paragraph_number - b.paragraph_number));
      };
      req.onerror = () => resolve([]);
    });
  }

  public static async deleteParagraph(id: number): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('paragraphs', 'readwrite');
      const store = tx.objectStore('paragraphs');
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public static async saveParagraphs(paragraphs: Paragraph[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('paragraphs', 'readwrite');
      const store = tx.objectStore('paragraphs');
      for (const p of paragraphs) {
        store.put(p);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public static async updateParagraph(id: number, data: Partial<Paragraph>): Promise<Paragraph> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('paragraphs', 'readwrite');
      const store = tx.objectStore('paragraphs');
      const req = store.get(id);
      req.onsuccess = () => {
        const existing = req.result;
        if (!existing) {
          reject(new Error('Paragraph not found'));
          return;
        }
        const updated = { ...existing, ...data };
        store.put(updated);
        tx.oncomplete = () => resolve(updated);
      };
      tx.onerror = () => reject(tx.error);
    });
  }
}
