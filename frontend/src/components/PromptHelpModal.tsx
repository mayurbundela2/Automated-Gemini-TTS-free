import React, { useState } from 'react';
import { Sparkles, Copy, Check, X, HelpCircle, BookOpen, ExternalLink, ArrowRight, Lightbulb } from 'lucide-react';

export const AI_DIRECTOR_PROMPT = `# MISSION
You are an elite Audio Director and Voiceover Engineer specializing in viral, high-retention YouTube Shorts and Reels. 

Your task is to take my raw short-form script and break it down section-by-section (Hook, Setup, Twist, CTA/Redirect, Outro) into a fully formatted Text-to-Speech (TTS) blueprint ready for the Gemini TTS Studio app.

---

# OUTPUT STRUCTURE RULES (STRICT)

For EVERY single section/part of the short script, you MUST follow this exact 3-block format:

Part [X]: [SECTION NAME, e.g., HOOK / SETUP / TWIST / CTA / OUTRO] [Time Stamp, e.g., 0:00–0:10]

Playground Setup:
- Scene: "[1 vivid atmospheric sentence setting the visual mood of the scene]"
- Sample Context: "[1 sentence defining the narrator's objective, energy, and delivery intent]"
- Audio Profile: "[Target persona, e.g., Deep, bold, and mysterious Indian documentary YouTuber]"
- Style: [Newscaster / Serious / Promo/Hype / Whisper / Conversational / Empathetic] | Pace: [Rapid Fire / Natural / Staccato] | Accent: [Neutral / Indian] | Voice: [Algenib / Achird / Aoede / Fenrir]

Formatted Script to Copy-Paste:
[tag1] [tag2]
[Line 1 with micro-pauses (...)]

[tag3] [tag4]
[Line 2 with micro-pauses (...)]

---

# SCRIPTING & DIRECTION RULES:

1. Double Emotion Tags: Every single spoken line or dialogue punch MUST begin with at least two bracketed emotion tags that guide the TTS tone (e.g., [serious] [probing], [authoritative] [mysterious], [epic] [dramatic], [amazed] [punchy], [fast] [excited], [promo/hype] [direct], [slow] [deep]).
2. Punctuation & Micro-Pauses:
   - Use ellipses (...) for deliberate 0.3s–0.5s dramatic breath pauses between key thoughts.
   - Use exclamation marks (!) for punchy emphasis.
   - Strip unnecessary commas that cause awkward pauses.
3. Phonetic Numerals: Convert ALL numbers, metrics, and years into spoken words (e.g., write "teen hazaar" instead of 3,000; "pandrah" instead of 15; "chaar sau" instead of 400).
4. Section Breakdown: Divide the video into 3 to 5 clear parts:
   - Part 1: HOOK (0:00–0:10) — Scroll-stopping question or dramatic statement
   - Part 2: SETUP / CONTEXT (0:10–0:25) — Background / Myth / Problem
   - Part 3: THE TWIST / REVEAL (0:25–0:42) — The core revelation / medical / scientific fact
   - Part 4: CTA / REDIRECT (0:42–0:55) — Channel subscribe / question to comments
   - Part 5: OUTRO (0:55–1:00) — High energy closing line

---

# FEW-SHOT REFERENCE EXAMPLE:

Part 1: HOOK [0:00–0:11]
Playground Setup:
- Scene: "A dramatic silhouette of Lord Shiva in meditation with rising smoke, shattering common myths."
- Sample Context: "The narrator asks a bold, provocative question to instantly stop the viewer from scrolling."
- Audio Profile: "Deep, bold, and mysterious Indian documentary YouTuber."
- Style: Newscaster | Pace: Rapid Fire | Accent: Neutral | Voice: Algenib

Formatted Script to Copy-Paste:
[serious] [probing]
Kya Shiva ne... sach mein bhang piya tha?

[authoritative] [mysterious]
Sirf ek myth nahi hai... iske peechhe ek teen hazaar saal purani... real kahani hai!

---

Part 2: SETUP & CONTEXT [0:11–0:26]
Playground Setup:
- Scene: "Ancient Ayurvedic texts and mountain herbs glowing with mystical light."
- Sample Context: "Explaining the mythological context with authoritative depth."
- Audio Profile: "Deep, bold, and mysterious Indian documentary YouTuber."
- Style: Serious | Pace: Natural | Accent: Neutral | Voice: Algenib

Formatted Script to Copy-Paste:
[authoritative] [epic]
Puranon ke anusaar... jab Samudra Manthan ke dauraan Halahala vish nikla...

[intense] [dramatic]
Toh sansaar ko bachane ke liye... Lord Shiva ne use apne gale mein dharan kar liya!

---

Part 3: THE TWIST [0:26–0:42]
Playground Setup:
- Scene: "Close up of ancient medicinal formulations and cooling herbs."
- Sample Context: "Revealing the biological and medical truth."
- Audio Profile: "Deep, bold, and mysterious Indian documentary YouTuber."
- Style: Conversational | Pace: Rapid Fire | Accent: Neutral | Voice: Algenib

Formatted Script to Copy-Paste:
[amazed] [punchy]
Aur us agni jaise vish ki jalan ko shant karne ke liye...

[authoritative] [revelation]
Ayurveda ke anusaar cannabis ko ek cooling medicinal herb ki tarah use kiya gaya tha!

---

# SCRIPT TO CONVERT:
[PASTE YOUR RAW SCRIPT OR TOPIC HERE]`;

interface PromptHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseTemplate?: (prompt: string) => void;
}

export const PromptHelpModal: React.FC<PromptHelpModalProps> = ({ isOpen, onClose, onUseTemplate }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(AI_DIRECTOR_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0D1527] border border-[#233554] rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-[#131D33] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-white tracking-wide flex items-center space-x-2">
                <span>AI STUDIO DIRECTOR PROMPT GUIDE</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                  Viral Shorts TTS
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Use this master prompt in Gemini, ChatGPT, or Claude to format any script into multi-part voiceovers.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25 active:scale-95'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'COPIED TO CLIPBOARD!' : 'COPY MASTER PROMPT'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 font-sans">
          {/* Quick 3-Step Workflow Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#0B1120] p-4 rounded-2xl border border-slate-800">
            <div className="flex items-start space-x-3 p-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Copy Prompt</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click "Copy Master Prompt" and paste into Gemini, ChatGPT, or Claude.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                2
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Paste Raw Script</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Add your raw script at the bottom. The AI will output Hook, Setup, Twist parts.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                3
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Import & Generate</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Paste the generated breakdown into "Import Script Reference" to auto-populate cards!
                </p>
              </div>
            </div>
          </div>

          {/* Master Prompt Code Block */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center space-x-1.5 text-blue-400 font-semibold">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Master Voiceover Director Prompt (Ready to Copy)</span>
              </span>
              <span>Markdown Prompt Template</span>
            </div>

            <div className="relative group">
              <pre className="bg-[#080D1A] border border-[#1E293B] rounded-2xl p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed whitespace-pre-wrap selection:bg-blue-600 selection:text-white max-h-[380px]">
                {AI_DIRECTOR_PROMPT}
              </pre>

              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 shadow-lg backdrop-blur-sm transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#131D33] flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Tip: You can customize the voice persona, accents, and pacing inside each paragraph card after importing.
          </p>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
