/**
 * Client-Side Audio Trimmer, Concatenator, and VAD Subtitle Generator for Mobile.
 * Uses Web Audio API to process PCM buffers directly in the browser/Capacitor.
 */

import { ClientGeminiService } from './clientGeminiService';

export interface WordTimestamp {
  index: number;
  word: string;
  start: number;
  end: number;
  duration: number;
}

export interface IntervalMapping {
  origStart: number;
  origEnd: number;
  tightStart: number;
  tightEnd: number;
}

export interface AudioTrimResult {
  tightWavBlob: Blob;
  originalDuration: number;
  tightDuration: number;
  savedSeconds: number;
  mappings: IntervalMapping[];
}

export interface SubtitleResult {
  srt: string;
  vtt: string;
  wordsJson: {
    total_words: number;
    total_duration: number;
    words: WordTimestamp[];
  };
}

export class ClientAudioProcessor {
  /**
   * Decodes a WAV blob into an AudioBuffer using OfflineAudioContext.
   */
  public static async decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    try {
      return await audioCtx.decodeAudioData(arrayBuffer);
    } finally {
      await audioCtx.close();
    }
  }

  /**
   * Concatenates multiple paragraph audio blobs into a single continuous Master WAV track.
   */
  public static async concatenateAudioBlobs(
    blobs: Blob[],
    silenceGapSec: number = 0.15
  ): Promise<{ combinedBlob: Blob; duration: number; offsets: { index: number; start: number; end: number; duration: number }[] }> {
    if (blobs.length === 0) {
      const emptyBlob = ClientGeminiService.pcmToWavBlob(new Uint8Array(0), 24000);
      return { combinedBlob: emptyBlob, duration: 0, offsets: [] };
    }

    const buffers: AudioBuffer[] = [];
    for (const b of blobs) {
      const decoded = await this.decodeAudioBlob(b);
      buffers.push(decoded);
    }

    const sampleRate = buffers[0].sampleRate || 24000;
    const gapSamples = Math.max(0, Math.floor(sampleRate * silenceGapSec));

    let totalSamples = 0;
    for (let i = 0; i < buffers.length; i++) {
      totalSamples += Math.floor(buffers[i].length);
      if (i < buffers.length - 1) {
        totalSamples += gapSamples;
      }
    }
    totalSamples = Math.floor(totalSamples);

    const pcmData = new Int16Array(totalSamples);
    let writeOffset = 0;
    const offsets: { index: number; start: number; end: number; duration: number }[] = [];

    for (let i = 0; i < buffers.length; i++) {
      const buf = buffers[i];
      const channelData = buf.getChannelData(0);
      const startSec = Math.round((writeOffset / sampleRate) * 1000) / 1000;

      for (let s = 0; s < channelData.length; s++) {
        if (writeOffset < totalSamples) {
          const floatVal = Math.max(-1.0, Math.min(1.0, channelData[s]));
          pcmData[writeOffset++] = Math.floor(floatVal * 32767);
        }
      }

      const endSec = Math.round((writeOffset / sampleRate) * 1000) / 1000;
      offsets.push({
        index: i + 1,
        start: startSec,
        end: endSec,
        duration: Math.round((endSec - startSec) * 1000) / 1000,
      });

      // Insert gap between paragraphs
      if (i < buffers.length - 1) {
        for (let g = 0; g < gapSamples; g++) {
          if (writeOffset < totalSamples) {
            pcmData[writeOffset++] = 0;
          }
        }
      }
    }

    const validPcm = pcmData.subarray(0, writeOffset);
    const pcmBytes = new Uint8Array(validPcm.buffer, validPcm.byteOffset, validPcm.byteLength);
    const combinedBlob = ClientGeminiService.pcmToWavBlob(pcmBytes, sampleRate);
    const duration = Math.round((writeOffset / sampleRate) * 100) / 100;

    return { combinedBlob, duration, offsets };
  }

  /**
   * Detects active speech intervals by analyzing audio RMS energy windows.
   */
  public static detectSpeechIntervals(
    audioBuffer: AudioBuffer,
    thresholdDb: number = -40,
    minSilenceSec: number = 0.15
  ): { start: number; end: number; duration: number }[] {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const totalSec = audioBuffer.duration;

    const windowSize = Math.max(1, Math.floor(sampleRate * 0.02)); // 20ms window
    const minSilenceSamples = Math.max(1, Math.floor(sampleRate * minSilenceSec));
    const thresholdAmp = Math.pow(10, thresholdDb / 20);

    const intervals: { start: number; end: number; duration: number }[] = [];
    let inSpeech = false;
    let speechStartSample = 0;
    let silenceSampleCount = 0;

    for (let i = 0; i < channelData.length; i += windowSize) {
      // Calculate RMS of this window
      let sumSq = 0;
      const end = Math.min(i + windowSize, channelData.length);
      for (let j = i; j < end; j++) {
        sumSq += channelData[j] * channelData[j];
      }
      const rms = Math.sqrt(sumSq / (end - i));

      if (rms >= thresholdAmp) {
        if (!inSpeech) {
          inSpeech = true;
          speechStartSample = i;
        }
        silenceSampleCount = 0;
      } else {
        if (inSpeech) {
          silenceSampleCount += end - i;
          if (silenceSampleCount >= minSilenceSamples || i + windowSize >= channelData.length) {
            inSpeech = false;
            const startSec = speechStartSample / sampleRate;
            const endSec = (i - silenceSampleCount) / sampleRate;
            if (endSec > startSec + 0.04) {
              intervals.push({
                start: Math.round(startSec * 1000) / 1000,
                end: Math.round(endSec * 1000) / 1000,
                duration: Math.round((endSec - startSec) * 1000) / 1000,
              });
            }
          }
        }
      }
    }

    if (inSpeech) {
      const startSec = speechStartSample / sampleRate;
      intervals.push({
        start: Math.round(startSec * 1000) / 1000,
        end: Math.round(totalSec * 1000) / 1000,
        duration: Math.round((totalSec - startSec) * 1000) / 1000,
      });
    }

    if (intervals.length === 0) {
      intervals.push({ start: 0, end: totalSec, duration: totalSec });
    }

    return intervals;
  }

  /**
   * Removes dead pauses and stitches speech chunks together into a tight audio track.
   * Also captures exact interval mappings to precisely transform word timestamps.
   */
  public static async tightenAudio(
    blob: Blob,
    silenceThresholdSec: number = 0.18,
    gapPaddingSec: number = 0.08
  ): Promise<AudioTrimResult> {
    const audioBuffer = await this.decodeAudioBlob(blob);
    const intervals = this.detectSpeechIntervals(audioBuffer, -40, silenceThresholdSec);
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);

    const paddingSamples = Math.max(0, Math.floor(sampleRate * gapPaddingSec));
    let totalTightSamples = 0;

    for (const inv of intervals) {
      const len = Math.max(0, Math.floor((inv.end - inv.start) * sampleRate));
      totalTightSamples += len + paddingSamples;
    }
    totalTightSamples = Math.floor(totalTightSamples);

    const pcmData = new Int16Array(totalTightSamples);
    let writeOffset = 0;
    const mappings: IntervalMapping[] = [];

    for (const inv of intervals) {
      const tightStart = Math.round((writeOffset / sampleRate) * 1000) / 1000;
      const startSample = Math.max(0, Math.floor(inv.start * sampleRate));
      const endSample = Math.min(Math.floor(inv.end * sampleRate), channelData.length);

      for (let s = startSample; s < endSample; s++) {
        if (writeOffset < totalTightSamples) {
          const floatVal = Math.max(-1.0, Math.min(1.0, channelData[s]));
          pcmData[writeOffset++] = Math.floor(floatVal * 32767);
        }
      }

      const tightEnd = Math.round((writeOffset / sampleRate) * 1000) / 1000;
      mappings.push({
        origStart: inv.start,
        origEnd: inv.end,
        tightStart,
        tightEnd,
      });

      // Add gentle silence padding
      for (let p = 0; p < paddingSamples; p++) {
        if (writeOffset < totalTightSamples) {
          pcmData[writeOffset++] = 0;
        }
      }
    }

    const validPcm = pcmData.subarray(0, writeOffset);
    const tightPcmBytes = new Uint8Array(validPcm.buffer, validPcm.byteOffset, validPcm.byteLength);
    const tightWavBlob = ClientGeminiService.pcmToWavBlob(tightPcmBytes, sampleRate);
    const tightDuration = Math.round((writeOffset / sampleRate) * 100) / 100;
    const originalDuration = Math.round(audioBuffer.duration * 100) / 100;

    return {
      tightWavBlob,
      originalDuration,
      tightDuration,
      savedSeconds: Math.max(0, Math.round((originalDuration - tightDuration) * 100) / 100),
      mappings,
    };
  }

  /**
   * Generates high-precision, VAD-anchored subtitles (.SRT, .VTT, and JSON word timestamps)
  /**
   * Cleans any prompt or transcript down to strictly the spoken words.
   * Removes Director Guidance, Scene/Context/Profile headers, emotion tags, markdown, etc.
   */
  public static cleanSpokenText(text: string): string {
    if (!text) return '';

    // If text contains a dedicated spoken section header, extract only that section
    const spokenHeaderMatch = text.match(
      /(?:Spoken Transcript|Formatted Script to Copy-Paste|Formatted Script|Transcript|Spoken Text|Dialogue)[:\s]*\n([\s\S]*)/i
    );
    let workingText = spokenHeaderMatch ? spokenHeaderMatch[1] : text;

    // Cut off any trailing tips / production guide
    const tipsMatch = workingText.match(
      /(?:\n|^)\s*(?:🎬|🎥|💡|📌|📝)?\s*(?:CapCut|Production|Video|Audio|Editing|Tips|Notes|Hook Impact|Setup to Twist)[\s\S]*/i
    );
    if (tipsMatch && tipsMatch.index !== undefined) {
      workingText = workingText.substring(0, tipsMatch.index);
    }

    const lines = workingText.split('\n');
    const validLines: string[] = [];

    for (const rawLine of lines) {
      let l = rawLine.trim();
      if (!l) continue;

      // Skip lines that are metadata tags or director headers
      if (
        /^(?:Part|Paragraph|Scene|Section|Shot)\s*\d+[:\s—\-]/i.test(l) ||
        /^(?:Playground Setup|Director Guidance|Sample Context|Audio Profile|Speaker|Style|Pacing|Pace|Accent|Voice|Scene|Context)[:\s]/i.test(l) ||
        /^[-*•]\s*(?:Scene|Context|Audio Profile|Speaker|Style|Pacing|Pace|Accent|Voice)[:\s]/i.test(l)
      ) {
        continue;
      }

      // Remove markdown quotes and formatting
      l = l.replace(/^>\s*/, '');
      l = l.replace(/\*\*(.*?)\*\*/g, '$1');
      l = l.replace(/\*(.*?)\*/g, '$1');
      l = l.replace(/`(\[[^\]]+\])`/g, '');
      l = l.replace(/\[[^\]]*\]/g, ''); // strip any emotion/audio tag like [serious] [promo/hype] [whisper]

      l = l.trim();
      if (l) validLines.push(l);
    }

    return validLines.join('\n');
  }

  /**
   * Generates high-precision, VAD-anchored subtitles (.SRT, .VTT, and JSON word timestamps)
   * for a single audio buffer and transcript.
   */
  public static generateSubtitles(
    transcript: string,
    intervals: { start: number; end: number; duration: number }[],
    totalDuration: number,
    wordsPerCaption: number = 3,
    timeOffset: number = 0
  ): SubtitleResult {
    // 1. Clean transcript of emotion tags, director notes and metadata
    const cleanSpoken = this.cleanSpokenText(transcript);
    const rawWords = cleanSpoken.split(/\s+/).filter((w) => w.length > 0);

    if (rawWords.length === 0) {
      return {
        srt: '',
        vtt: 'WEBVTT\r\n\r\n',
        wordsJson: { total_words: 0, total_duration: totalDuration, words: [] },
      };
    }

    // 2. Syllable and phonetic weight calculation
    const getWordWeight = (w: string): number => {
      const cleanW = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!cleanW) return 1.0;
      const syllables = cleanW.match(/[aeiouy]{1,2}/g)?.length || 1;
      return Math.max(1.0, syllables * 1.5 + cleanW.length * 0.25);
    };

    const weights = rawWords.map((w) => getWordWeight(w));
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1.0;

    // 3. Fallback or single speech interval
    const validIntervals =
      intervals.length > 0
        ? intervals
        : [{ start: 0.05, end: Math.max(0.1, totalDuration - 0.05), duration: Math.max(0.1, totalDuration - 0.1) }];

    const totalIntervalDuration = validIntervals.reduce((acc, inv) => acc + inv.duration, 0) || 1.0;

    // 4. Distribute words proportionally across speech intervals
    const wordEntries: WordTimestamp[] = [];
    let currentWordIdx = 0;

    for (let i = 0; i < validIntervals.length; i++) {
      const inv = validIntervals[i];
      const isLastInterval = i === validIntervals.length - 1;
      const intervalTargetWeight = (inv.duration / totalIntervalDuration) * totalWeight;

      const wordsForInterval: { word: string; weight: number }[] = [];
      let accumulatedWeight = 0;

      if (isLastInterval) {
        while (currentWordIdx < rawWords.length) {
          wordsForInterval.push({ word: rawWords[currentWordIdx], weight: weights[currentWordIdx] });
          currentWordIdx++;
        }
      } else {
        while (currentWordIdx < rawWords.length) {
          const nextW = rawWords[currentWordIdx];
          const nextWeight = weights[currentWordIdx];
          wordsForInterval.push({ word: nextW, weight: nextWeight });
          accumulatedWeight += nextWeight;
          currentWordIdx++;

          const remainingWords = rawWords.length - currentWordIdx;
          const remainingIntervals = validIntervals.length - (i + 1);

          // Break if target reached and enough words left for remaining intervals
          if (accumulatedWeight >= intervalTargetWeight && remainingWords >= remainingIntervals) {
            break;
          }
        }
      }

      if (wordsForInterval.length === 0) continue;

      const intervalWeightSum = wordsForInterval.reduce((sum, item) => sum + item.weight, 0) || 1.0;
      let currentT = timeOffset + inv.start;

      for (let j = 0; j < wordsForInterval.length; j++) {
        const item = wordsForInterval[j];
        const durationFraction = item.weight / intervalWeightSum;
        const wordDur = Math.max(0.08, durationFraction * inv.duration);
        const speechEnd = Math.min(timeOffset + inv.end, currentT + wordDur);

        wordEntries.push({
          index: wordEntries.length + 1,
          word: item.word,
          start: Math.round(currentT * 100) / 100,
          end: Math.round(speechEnd * 100) / 100,
          duration: Math.round((speechEnd - currentT) * 100) / 100,
        });

        currentT += wordDur;
      }
    }

    // 5. Build SRT & VTT chunks (2-3 words per subtitle for punchy sync)
    const srtLines: string[] = [];
    const vttLines: string[] = ['WEBVTT', ''];
    let captionIdx = 1;

    for (let i = 0; i < wordEntries.length; i += wordsPerCaption) {
      const chunk = wordEntries.slice(i, i + wordsPerCaption);
      if (chunk.length === 0) continue;

      const startSec = chunk[0].start;
      const endSec = chunk[chunk.length - 1].end;
      const text = chunk.map((c) => c.word).join(' ');

      // Format SRT timestamp: 00:00:00,000
      const srtStart = this.formatTimestamp(startSec, ',');
      const srtEnd = this.formatTimestamp(endSec, ',');
      srtLines.push(`${captionIdx}`);
      srtLines.push(`${srtStart} --> ${srtEnd}`);
      srtLines.push(text);
      srtLines.push('');

      // Format VTT timestamp: 00:00:00.000
      const vttStart = this.formatTimestamp(startSec, '.');
      const vttEnd = this.formatTimestamp(endSec, '.');
      vttLines.push(`${captionIdx}`);
      vttLines.push(`${vttStart} --> ${vttEnd}`);
      vttLines.push(text);
      vttLines.push('');

      captionIdx++;
    }

    return {
      srt: srtLines.join('\r\n') + '\r\n',
      vtt: vttLines.join('\r\n') + '\r\n',
      wordsJson: {
        total_words: wordEntries.length,
        total_duration: Math.round(totalDuration * 100) / 100,
        words: wordEntries,
      },
    };
  }

  /**
   * Generates perfectly aligned batch subtitles by analyzing each paragraph audio individually
   * and offsetting timestamps by the exact paragraph audio stitch points.
   */
  public static async generateBatchAlignedSubtitles(
    paragraphItems: { transcript: string; blob: Blob; startOffset: number; duration: number }[],
    totalDuration: number,
    wordsPerCaption: number = 3
  ): Promise<SubtitleResult> {
    const allWordEntries: WordTimestamp[] = [];
    const srtLines: string[] = [];
    const vttLines: string[] = ['WEBVTT', ''];
    let captionIdx = 1;

    for (let pIdx = 0; pIdx < paragraphItems.length; pIdx++) {
      const item = paragraphItems[pIdx];
      let intervals: { start: number; end: number; duration: number }[] = [];

      try {
        const buffer = await this.decodeAudioBlob(item.blob);
        intervals = this.detectSpeechIntervals(buffer, -38, 0.15);
      } catch {
        intervals = [{ start: 0, end: item.duration, duration: item.duration }];
      }

      const paraResult = this.generateSubtitles(
        item.transcript,
        intervals,
        item.duration,
        wordsPerCaption,
        item.startOffset
      );

      for (const w of paraResult.wordsJson.words) {
        allWordEntries.push({
          ...w,
          index: allWordEntries.length + 1,
        });
      }
    }

    // Build batch SRT & VTT
    for (let i = 0; i < allWordEntries.length; i += wordsPerCaption) {
      const chunk = allWordEntries.slice(i, i + wordsPerCaption);
      if (chunk.length === 0) continue;

      const startSec = chunk[0].start;
      const endSec = chunk[chunk.length - 1].end;
      const text = chunk.map((c) => c.word).join(' ');

      const srtStart = this.formatTimestamp(startSec, ',');
      const srtEnd = this.formatTimestamp(endSec, ',');
      srtLines.push(`${captionIdx}`);
      srtLines.push(`${srtStart} --> ${srtEnd}`);
      srtLines.push(text);
      srtLines.push('');

      const vttStart = this.formatTimestamp(startSec, '.');
      const vttEnd = this.formatTimestamp(endSec, '.');
      vttLines.push(`${captionIdx}`);
      vttLines.push(`${vttStart} --> ${vttEnd}`);
      vttLines.push(text);
      vttLines.push('');

      captionIdx++;
    }

    return {
      srt: srtLines.join('\r\n') + '\r\n',
      vtt: vttLines.join('\r\n') + '\r\n',
      wordsJson: {
        total_words: allWordEntries.length,
        total_duration: Math.round(totalDuration * 100) / 100,
        words: allWordEntries,
      },
    };
  }

  /**
   * Exact Mathematical Transformation: Maps master word timestamps directly onto the
   * tight/trimmed audio timeline based on the physical audio splice points.
   */
  public static mapTimestampsToTightAudio(
    masterWords: WordTimestamp[],
    mappings: IntervalMapping[],
    tightTotalDuration: number,
    wordsPerCaption: number = 3
  ): SubtitleResult {
    if (mappings.length === 0 || masterWords.length === 0) {
      return {
        srt: '',
        vtt: 'WEBVTT\r\n\r\n',
        wordsJson: { total_words: 0, total_duration: tightTotalDuration, words: [] },
      };
    }

    const mapTime = (t: number): number => {
      // Find if t is inside any active speech slice
      for (const m of mappings) {
        if (t >= m.origStart && t <= m.origEnd) {
          const range = m.origEnd - m.origStart || 1;
          const fraction = (t - m.origStart) / range;
          return m.tightStart + fraction * (m.tightEnd - m.tightStart);
        }
      }

      // If t is before the first interval
      if (t < mappings[0].origStart) {
        return mappings[0].tightStart;
      }

      // If t falls in a silence gap that was trimmed out between intervals
      for (let i = 0; i < mappings.length - 1; i++) {
        if (t > mappings[i].origEnd && t < mappings[i + 1].origStart) {
          return mappings[i].tightEnd;
        }
      }

      // If t is after the last interval
      return mappings[mappings.length - 1].tightEnd;
    };

    const tightWords: WordTimestamp[] = masterWords.map((w, idx) => {
      const start = Math.round(mapTime(w.start) * 100) / 100;
      let end = Math.round(mapTime(w.end) * 100) / 100;
      if (end <= start) {
        end = Math.round((start + Math.max(0.08, w.duration * 0.85)) * 100) / 100;
      }
      return {
        index: idx + 1,
        word: w.word,
        start,
        end,
        duration: Math.round((end - start) * 100) / 100,
      };
    });

    // Build tight SRT & VTT chunks (2-3 words per subtitle)
    const srtLines: string[] = [];
    const vttLines: string[] = ['WEBVTT', ''];
    let captionIdx = 1;

    for (let i = 0; i < tightWords.length; i += wordsPerCaption) {
      const chunk = tightWords.slice(i, i + wordsPerCaption);
      if (chunk.length === 0) continue;

      const startSec = chunk[0].start;
      const endSec = chunk[chunk.length - 1].end;
      const text = chunk.map((c) => c.word).join(' ');

      const srtStart = this.formatTimestamp(startSec, ',');
      const srtEnd = this.formatTimestamp(endSec, ',');
      srtLines.push(`${captionIdx}`);
      srtLines.push(`${srtStart} --> ${srtEnd}`);
      srtLines.push(text);
      srtLines.push('');

      const vttStart = this.formatTimestamp(startSec, '.');
      const vttEnd = this.formatTimestamp(endSec, '.');
      vttLines.push(`${captionIdx}`);
      vttLines.push(`${vttStart} --> ${vttEnd}`);
      vttLines.push(text);
      vttLines.push('');

      captionIdx++;
    }

    return {
      srt: srtLines.join('\r\n') + '\r\n',
      vtt: vttLines.join('\r\n') + '\r\n',
      wordsJson: {
        total_words: tightWords.length,
        total_duration: Math.round(tightTotalDuration * 100) / 100,
        words: tightWords,
      },
    };
  }

  private static formatTimestamp(seconds: number, msSeparator: string = ','): string {
    const totalMs = Math.max(0, Math.floor(seconds * 1000));
    const hrs = Math.floor(totalMs / 3600000);
    const mins = Math.floor((totalMs % 3600000) / 60000);
    const secs = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;

    const pad = (n: number, w: number = 2) => String(n).padStart(w, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}${msSeparator}${pad(ms, 3)}`;
  }
}
