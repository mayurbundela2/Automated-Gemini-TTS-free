export interface WordDiffToken {
  type: 'match' | 'missing' | 'added';
  text: string;
  originalIndex?: number;
  paragraphIndex?: number;
  paragraphNumber?: number;
}

export interface ParagraphWordAudit {
  paragraphId: number;
  paragraphNumber: number;
  partTitle?: string;
  wordCount: number;
  missingCount: number;
  addedCount: number;
  matchedCount: number;
  transcript: string;
}

export interface ScriptComparisonResult {
  originalTotalWords: number;
  batchTotalWords: number;
  matchedWordsCount: number;
  missingWordsCount: number;
  addedWordsCount: number;
  matchPercentage: number;
  diffTokens: WordDiffToken[];
  missingWordsList: string[];
  paragraphAudits: ParagraphWordAudit[];
}

export class ScriptCheckerService {
  /**
   * Cleans and tokenizes text into words and punctuation while stripping bracket direction tags like [serious]
   */
  static tokenize(text: string, stripTags: boolean = true): { raw: string; normalized: string }[] {
    if (!text) return [];

    let cleaned = text;
    if (stripTags) {
      // Remove bracket tags like [serious], [whisper], [pause 1s], etc.
      cleaned = cleaned.replace(/\[[^\]]*\]/g, ' ');
      cleaned = cleaned.replace(/\([^\)]*\)/g, ' ');
    }

    // Split by whitespace and preserve words
    const tokens = cleaned.split(/\s+/).filter((t) => t.trim().length > 0);

    return tokens.map((token) => {
      // Normalize: strip leading/trailing punctuation and lowercase
      const normalized = token
        .toLowerCase()
        .replace(/^[^\w\u0900-\u097F]+|[^\w\u0900-\u097F]+$/g, '')
        .trim();

      return {
        raw: token,
        normalized: normalized || token.toLowerCase().trim(),
      };
    });
  }

  /**
   * Computes sequence-wise word comparison using Longest Common Subsequence (LCS)
   */
  static compareScripts(
    originalScript: string,
    paragraphs: { id: number; paragraph_number: number; part_number?: string; transcript: string }[],
    options: { ignorePunctuation?: boolean; caseSensitive?: boolean; stripTags?: boolean } = {}
  ): ScriptComparisonResult {
    const stripTags = options.stripTags !== false;
    const origTokens = this.tokenize(originalScript, stripTags);

    // Build flattened batch tokens with paragraph mapping
    interface ParagraphToken {
      raw: string;
      normalized: string;
      paragraphId: number;
      paragraphNumber: number;
      partTitle?: string;
    }

    const batchTokens: ParagraphToken[] = [];
    const paragraphAudits: ParagraphWordAudit[] = paragraphs.map((p) => {
      const pTokens = this.tokenize(p.transcript, stripTags);
      for (const pt of pTokens) {
        batchTokens.push({
          raw: pt.raw,
          normalized: pt.normalized,
          paragraphId: p.id,
          paragraphNumber: p.paragraph_number,
          partTitle: p.part_number,
        });
      }

      return {
        paragraphId: p.id,
        paragraphNumber: p.paragraph_number,
        partTitle: p.part_number,
        wordCount: pTokens.length,
        missingCount: 0,
        addedCount: 0,
        matchedCount: 0,
        transcript: p.transcript,
      };
    });

    const N = origTokens.length;
    const M = batchTokens.length;

    // Fast LCS Matrix for sequence alignment
    const dp: number[][] = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(0));

    for (let i = 1; i <= N; i++) {
      for (let j = 1; j <= M; j++) {
        const origWord = options.caseSensitive ? origTokens[i - 1].raw : origTokens[i - 1].normalized;
        const batchWord = options.caseSensitive ? batchTokens[j - 1].raw : batchTokens[j - 1].normalized;

        if (origWord === batchWord && origWord.length > 0) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to extract word diff tokens
    let i = N;
    let j = M;
    const diffTokensReversed: WordDiffToken[] = [];
    const missingWordsList: string[] = [];

    let matchedCount = 0;
    let missingCount = 0;
    let addedCount = 0;

    const paraAuditMap = new Map<number, ParagraphWordAudit>();
    for (const audit of paragraphAudits) {
      paraAuditMap.set(audit.paragraphId, audit);
    }

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0) {
        const origWord = options.caseSensitive ? origTokens[i - 1].raw : origTokens[i - 1].normalized;
        const batchWord = options.caseSensitive ? batchTokens[j - 1].raw : batchTokens[j - 1].normalized;

        if (origWord === batchWord && origWord.length > 0) {
          matchedCount++;
          const bTok = batchTokens[j - 1];
          const audit = paraAuditMap.get(bTok.paragraphId);
          if (audit) audit.matchedCount++;

          diffTokensReversed.push({
            type: 'match',
            text: origTokens[i - 1].raw,
            originalIndex: i - 1,
            paragraphIndex: j - 1,
            paragraphNumber: bTok.paragraphNumber,
          });
          i--;
          j--;
          continue;
        }
      }

      if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        // Word exists in batch paragraph but not in original script (Added / Extra)
        addedCount++;
        const bTok = batchTokens[j - 1];
        const audit = paraAuditMap.get(bTok.paragraphId);
        if (audit) audit.addedCount++;

        diffTokensReversed.push({
          type: 'added',
          text: bTok.raw,
          paragraphIndex: j - 1,
          paragraphNumber: bTok.paragraphNumber,
        });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        // Word exists in original script but missing from batch paragraphs (Missing - RED)
        missingCount++;
        missingWordsList.push(origTokens[i - 1].raw);

        diffTokensReversed.push({
          type: 'missing',
          text: origTokens[i - 1].raw,
          originalIndex: i - 1,
        });
        i--;
      }
    }

    const diffTokens = diffTokensReversed.reverse();
    missingWordsList.reverse();

    const matchPercentage =
      N > 0 ? Math.min(100, Math.round((matchedCount / Math.max(N, 1)) * 1000) / 10) : 100;

    return {
      originalTotalWords: N,
      batchTotalWords: M,
      matchedWordsCount: matchedCount,
      missingWordsCount: missingCount,
      addedWordsCount: addedCount,
      matchPercentage,
      diffTokens,
      missingWordsList,
      paragraphAudits,
    };
  }
}
