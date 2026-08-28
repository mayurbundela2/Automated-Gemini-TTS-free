/**
 * Client-Side Reference Parser & Prompt Builder for Android Standalone App & Web Frontend.
 * Parses multi-part AI Studio Markdown scripts, splits into paragraph parts, and extracts director metadata.
 */

export interface ParsedParagraphData {
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
  transcript: string;
  raw_reference?: string;
}

export class ClientReferenceParser {
  // Matches lines starting with "Part 1:", "### Part 1 -", "**Part 1:**", "Paragraph 1:", "Section 1:", "Chapter 1:"
  private static PART_HEADER_REGEX = /(?:^|\n)[ \t]*(?:---[ \t]*\n[ \t]*)?(?:#{1,6}[ \t]*)?(?:\*{1,2})?(?:Part|Section|Paragraph|Chapter)[ \t]*(\d+)[:\s—\-&]*(.*?)(?:\*{1,2})?(?=\n|$)/gi;

  public static parseBatch(rawText: string, defaultVoice: string = 'Algenib'): ParsedParagraphData[] {
    const text = rawText.trim().replace(/\r\n/g, '\n');
    if (!text) return [];

    // Find all Part/Paragraph headers
    const matches: { index: number; fullMatch: string; partNum: number; subtitle: string }[] = [];
    let match: RegExpExecArray | null;
    const regex = new RegExp(this.PART_HEADER_REGEX);

    while ((match = regex.exec(text)) !== null) {
      const partNum = parseInt(match[1], 10);
      const subtitle = (match[2] || '').trim().replace(/^\*{1,2}|\*{1,2}$/g, '').trim();
      matches.push({
        index: match.index,
        fullMatch: match[0],
        partNum,
        subtitle,
      });
    }

    if (matches.length === 0) {
      // Single block
      return [this.parseSingleBlock(text, 1, `Part 1`, defaultVoice)];
    }

    const results: ParsedParagraphData[] = [];

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const start = current.index;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const block = text.substring(start, end).trim();
      if (!block) continue;

      const partLabel = current.subtitle
        ? `Part ${current.partNum}: ${current.subtitle}`
        : `Part ${current.partNum}`;

      results.push(this.parseSingleBlock(block, current.partNum || i + 1, partLabel, defaultVoice));
    }

    return results;
  }

  private static parseSingleBlock(
    block: string,
    pNum: number,
    partLabel: string,
    defaultVoice: string
  ): ParsedParagraphData {
    const lines = block.split('\n');
    let partNumber = partLabel;
    let scene = '';
    let sampleContext = '';
    let audioProfile = '';
    let speaker = '';
    let style = 'Newscaster';
    let pace = 'Natural';
    let accent = 'Neutral';
    let voice = defaultVoice || 'Algenib';

    const transcriptLines: string[] = [];
    let isExplicitScript = false;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (!trimmed || trimmed === '---') continue;

      const cleaned = trimmed.replace(/^[-*+]\s+/, '').replace(/\*\*/g, '').trim();

      // Ignore Part header line itself
      if (/^(?:#{1,6}\s*)?(?:\*{1,2})?(?:Part|Section|Paragraph|Chapter)\s*\d+/i.test(cleaned)) {
        continue;
      }

      // Ignore Section setup labels
      if (/^(?:Playground Setup|Voice Setup|Director Setup|Setup|Parameters|Context Setup)[:\s]*$/i.test(cleaned)) {
        continue;
      }

      // Check for explicit script header
      if (/^(?:Formatted Script to Copy-Paste|Formatted Script|Script to Copy-Paste|Spoken Transcript|Script|Transcript|Dialogue|Spoken Text|Narration)[:\s]*$/i.test(cleaned)) {
        isExplicitScript = true;
        continue;
      }

      // Ignore tips footer
      if (/^(?:🎬|🎥|💡|📌|📝)?\s*(?:CapCut Tips|Production Tips|Editing Tips|Production Notes|Video Notes|Audio Notes|CapCut Notes|Actionable Tips)[:\s]*$/i.test(cleaned)) {
        break;
      }

      // If we are in explicit script section, every line is spoken script
      if (isExplicitScript) {
        let scriptLine = trimmed.startsWith('>') ? trimmed.substring(1).trim() : trimmed;
        scriptLine = scriptLine.replace(/`(\[[^\]]+\])`/g, '$1');
        if (scriptLine) transcriptLines.push(scriptLine);
        continue;
      }

      // Check pipe-separated metadata (e.g. Style: Newscaster | Pace: Rapid Fire | Voice: Algenib)
      if (cleaned.includes('|') && (cleaned.includes(':') || cleaned.includes('Voice'))) {
        const segments = cleaned.split('|');
        for (const seg of segments) {
          this.extractField(seg.trim(), (k, v) => {
            if (k === 'style') style = v;
            else if (k === 'pace') pace = v;
            else if (k === 'accent') accent = v;
            else if (k === 'voice') voice = v;
            else if (k === 'scene') scene = v;
            else if (k === 'context') sampleContext = v;
            else if (k === 'audio') audioProfile = v;
          });
        }
        continue;
      }

      // Check single metadata fields
      let isMeta = false;
      this.extractField(cleaned, (k, v) => {
        isMeta = true;
        if (k === 'scene') scene = v;
        else if (k === 'context') sampleContext = v;
        else if (k === 'audio') audioProfile = v;
        else if (k === 'speaker') speaker = v;
        else if (k === 'style') style = v;
        else if (k === 'pace') pace = v;
        else if (k === 'accent') accent = v;
        else if (k === 'voice') voice = v;
      });

      if (isMeta) continue;

      // Inferred script line
      let scriptLine = trimmed.startsWith('>') ? trimmed.substring(1).trim() : trimmed;
      scriptLine = scriptLine.replace(/`(\[[^\]]+\])`/g, '$1');
      if (scriptLine) {
        transcriptLines.push(scriptLine);
      }
    }

    const transcript = transcriptLines.join('\n').trim();
    const cleanForWords = transcript.replace(/\[.*?\]/g, '').trim();
    const words = cleanForWords ? cleanForWords.split(/\s+/).filter(Boolean).length : 0;
    const chars = transcript.length;

    return {
      paragraph_number: pNum,
      part_number: partNumber,
      scene,
      sample_context: sampleContext,
      audio_profile: audioProfile,
      speaker,
      style,
      pace,
      accent,
      voice,
      transcript,
      word_count: words,
      character_count: chars,
      raw_reference: block,
    };
  }

  private static extractField(text: string, callback: (key: string, val: string) => void): void {
    const cleaned = text.replace(/^[-*+]\s+/, '').replace(/\*\*/g, '').trim();
    const match = cleaned.match(/^([A-Za-z\s]+)[:=]\s*["']?(.*?)["']?$/);
    if (!match) return;

    const rawKey = match[1].trim().toLowerCase();
    const val = match[2].trim().replace(/^["']|["']$/g, '');

    if (rawKey.includes('scene') || rawKey.includes('visual')) callback('scene', val);
    else if (rawKey.includes('context')) callback('context', val);
    else if (rawKey.includes('audio') || rawKey.includes('profile')) callback('audio', val);
    else if (rawKey.includes('speaker') || rawKey.includes('narrator')) callback('speaker', val);
    else if (rawKey.includes('style') || rawKey.includes('tone')) callback('style', val);
    else if (rawKey.includes('pace') || rawKey.includes('speed') || rawKey.includes('pacing')) callback('pace', val);
    else if (rawKey.includes('accent')) callback('accent', val);
    else if (rawKey.includes('voice')) callback('voice', val);
  }

  public static buildPrompt(data: Partial<ParsedParagraphData>): string {
    const instructions: string[] = [];
    if (data.scene) instructions.push(`Scene: ${data.scene}`);
    if (data.sample_context) instructions.push(`Context: ${data.sample_context}`);
    if (data.audio_profile) instructions.push(`Audio Profile: ${data.audio_profile}`);
    if (data.speaker) instructions.push(`Speaker: ${data.speaker}`);
    if (data.style) instructions.push(`Style: ${data.style}`);
    if (data.pace) instructions.push(`Pacing: ${data.pace}`);
    if (data.accent) instructions.push(`Accent: ${data.accent}`);

    const header = instructions.length > 0
      ? `Director Guidance:\n${instructions.map((i) => `- ${i}`).join('\n')}\n\n`
      : '';

    return `${header}Spoken Transcript:\n${data.transcript || ''}`.trim();
  }
}
