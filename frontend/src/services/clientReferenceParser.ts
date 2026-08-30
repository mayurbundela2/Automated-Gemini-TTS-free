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
  // Matches "Part 1:", "### Part 1 -", "**Part 1:**", "Paragraph 1:", "Scene 1:", "Section 1:"
  private static PART_HEADER_REGEX = /(?:^|\n)\s*(?:---\s*\n\s*)?(?:#{1,6}\s*)?(?:\*{1,2})?(?:Part|Paragraph|Scene|Section|Shot)\s*(\d+)[:\s—\-&]*(.*?)(?:\*{1,2})?(?=\n|$)/gi;

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

    let scriptStartIndex = -1;
    let tipsStartIndex = -1;

    // Detect Script Header and Tips/Production section headers
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      const cleaned = l.replace(/^[-*+]\s+/, '').replace(/\*\*/g, '').trim();

      // Check for Script Header
      if (
        /^(?:Formatted Script to Copy-Paste|Formatted Script|Script to Copy-Paste|Script|Transcript|Spoken Text|Narration Script|Dialogue)[:\s]*$/i.test(
          cleaned
        )
      ) {
        scriptStartIndex = i;
        continue;
      }

      // Check for CapCut / Production Tips header (stop collecting script)
      if (
        scriptStartIndex !== -1 &&
        i > scriptStartIndex &&
        /(?:🎬|🎥|💡|📌|📝)?\s*(?:CapCut|Production|Video|Audio|Editing|Tips|Notes|Hook Impact|Setup to Twist)/i.test(
          cleaned
        )
      ) {
        tipsStartIndex = i;
        break;
      }
    }

    // Parse Metadata from lines before the script
    const metaLines = scriptStartIndex !== -1 ? lines.slice(0, scriptStartIndex) : lines;

    for (const rawLine of metaLines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Extract piped key-values: e.g. "Style: Newscaster | Pace: Rapid Fire | Accent: Neutral | Voice: Algenib"
      if (line.includes('|') && (line.includes(':') || line.includes('Voice'))) {
        const segments = line.split('|');
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

      // Extract standard bullet key-value
      this.extractField(line, (k, v) => {
        if (k === 'scene') scene = v;
        else if (k === 'context') sampleContext = v;
        else if (k === 'audio') audioProfile = v;
        else if (k === 'speaker') speaker = v;
        else if (k === 'style') style = v;
        else if (k === 'pace') pace = v;
        else if (k === 'accent') accent = v;
        else if (k === 'voice') voice = v;
      });
    }

    // Extract Transcript
    const transcriptLines: string[] = [];

    if (scriptStartIndex !== -1) {
      const endIdx = tipsStartIndex !== -1 ? tipsStartIndex : lines.length;
      const scriptSlice = lines.slice(scriptStartIndex + 1, endIdx);

      for (const raw of scriptSlice) {
        let l = raw.trim();
        // Remove leading markdown quote >
        if (l.startsWith('>')) {
          l = l.substring(1).trim();
        }
        // Normalize backticks around tags `[serious]` -> [serious]
        l = l.replace(/`(\[[^\]]+\])`/g, '$1');

        if (l) {
          transcriptLines.push(l);
        }
      }
    } else {
      // Fallback: infer lines that are not bullet metadata
      for (const raw of lines) {
        const l = raw.trim();
        if (!l) continue;
        if (l.startsWith('#') || l.startsWith('*') || l.startsWith('-') || l.includes('Playground Setup:')) {
          continue;
        }
        let clean = l.startsWith('>') ? l.substring(1).trim() : l;
        if (clean) transcriptLines.push(clean);
      }
    }

    const transcript = transcriptLines.join('\n').trim() || block;

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
