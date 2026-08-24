import React, { useState } from 'react';
import { Copy, Check, Edit3, RotateCcw, X, Sparkles } from 'lucide-react';
import { api } from '../api';

interface PromptPreviewProps {
  paragraphId: number;
  prompt: string;
  isCustom: boolean;
  onClose: () => void;
  onPromptUpdated: () => void;
}

export const PromptPreview: React.FC<PromptPreviewProps> = ({
  paragraphId,
  prompt,
  isCustom,
  onClose,
  onPromptUpdated,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(prompt);
  const [saving, setSaving] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await api.updateParagraph(paragraphId, { custom_prompt: editedPrompt });
      setIsEditing(false);
      onPromptUpdated();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await api.resetPrompt(paragraphId);
      setIsEditing(false);
      onPromptUpdated();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111A2C] border border-[#233554] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-studio-cardBorder flex items-center justify-between bg-[#152037]">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-sm text-white tracking-wide">FINAL TTS PROMPT</h3>
            {isCustom && (
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                Custom Edited
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-studio-textMuted hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs leading-relaxed text-slate-300">
          {isEditing ? (
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="w-full h-80 bg-studio-bg border border-blue-500/40 rounded-xl p-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs resize-none"
              placeholder="Edit final TTS prompt..."
            />
          ) : (
            <pre className="whitespace-pre-wrap bg-studio-bg/90 border border-studio-cardBorder p-4 rounded-xl selection:bg-blue-600">
              {prompt}
            </pre>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 border-t border-studio-cardBorder bg-[#152037] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isCustom && (
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                title="Reset to default director prompt"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>RESET PROMPT</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedPrompt(prompt);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20"
                >
                  Save Prompt
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setEditedPrompt(prompt);
                    setIsEditing(true);
                  }}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>EDIT PROMPT</span>
                </button>

                <button
                  onClick={handleCopy}
                  className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'COPIED!' : 'COPY PROMPT'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
