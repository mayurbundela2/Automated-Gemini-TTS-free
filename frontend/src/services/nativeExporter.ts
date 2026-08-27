/**
 * Native Android File Exporter and Sharing Service.
 * Uses Capacitor Share and Filesystem plugins to save or share audio and subtitle files.
 */

import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export class NativeExporter {
  public static isNative(): boolean {
    return (
      typeof (window as any).Capacitor !== 'undefined' &&
      typeof (window as any).Capacitor.isNativePlatform === 'function' &&
      (window as any).Capacitor.isNativePlatform()
    );
  }

  /**
   * Shares a text/subtitle string (SRT/VTT/JSON) or audio file directly to Android Share Sheet (e.g. CapCut, WhatsApp, Drive).
   */
  public static async shareText(title: string, text: string, filename: string = 'subtitles.srt'): Promise<void> {
    if (this.isNative()) {
      try {
        // Write to cache directory first to share as a real file with UTF8 encoding
        const result = await Filesystem.writeFile({
          path: filename,
          data: text,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        await Share.share({
          title,
          text: filename,
          files: [result.uri],
          url: result.uri,
          dialogTitle: `Share ${filename} to CapCut / Premiere`,
        });
        return;
      } catch (e) {
        console.warn('Capacitor share file failed, falling back to text share:', e);
      }

      try {
        await Share.share({
          title,
          text,
          dialogTitle: `Share ${filename}`,
        });
        return;
      } catch (e) {
        console.warn('Share text fallback failed:', e);
      }
    }

    // Browser fallback: standard download
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /**
   * Shares or downloads an audio or subtitle Blob.
   */
  public static async shareOrDownloadBlob(blob: Blob, filename: string = 'narration.wav', title: string = 'Narration Track'): Promise<void> {
    if (this.isNative()) {
      try {
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const res = reader.result as string;
            const b64 = res.includes(',') ? res.split(',')[1] : res;
            resolve(b64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const result = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: filename,
          text: `Voiceover audio: ${filename}`,
          url: result.uri,
          dialogTitle: `Share ${filename} to CapCut / Drive`,
        });
        return;
      } catch (e) {
        console.warn('Native share blob failed:', e);
      }
    }

    // Standard download fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /**
   * Shares or downloads an audio URL.
   */
  public static async shareAudioUrl(url: string, filename: string = 'narration.wav'): Promise<void> {
    if (this.isNative()) {
      try {
        await Share.share({
          title: filename,
          url,
          dialogTitle: `Share ${filename}`,
        });
        return;
      } catch (e) {
        console.warn('Native share failed:', e);
      }
    }

    // Standard download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
