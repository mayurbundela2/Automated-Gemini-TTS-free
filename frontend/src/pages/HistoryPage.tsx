import React, { useState, useEffect } from 'react';
import { History, Download, Trash2, FileAudio, ExternalLink, Play, RotateCcw, Clock } from 'lucide-react';
import { api } from '../api';
import { Generation } from '../types';
import { AudioPlayer } from '../components/AudioPlayer';

export const HistoryPage: React.FC = () => {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGen, setSelectedGen] = useState<Generation | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getGenerations(100);
      setGenerations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm('Delete this generation record?')) {
      await api.deleteGeneration(id);
      fetchHistory();
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-studio-cardBorder">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Generation Audit Log</h1>
            <p className="text-xs text-studio-textMuted">Complete chronological record of all generated narration master files</p>
          </div>
        </div>

        <span className="text-xs font-mono text-studio-textMuted bg-studio-card px-3 py-1.5 rounded-lg border border-studio-cardBorder">
          {generations.length} Generation Records
        </span>
      </div>

      {/* Active Selected Audio Player Modal / Panel */}
      {selectedGen && (
        <div className="bg-[#121D33] border border-blue-500/40 rounded-2xl p-5 shadow-2xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-md bg-blue-600/30 text-blue-400 font-mono text-xs font-bold">
                {selectedGen.project_name || 'Project'} &bull; Batch {selectedGen.batch_number || 1} &bull; Para {selectedGen.paragraph_number || 1}
              </span>
              <span className="text-xs text-white font-semibold">{selectedGen.voice}</span>
            </div>

            <button
              onClick={() => setSelectedGen(null)}
              className="text-xs text-studio-textMuted hover:text-white"
            >
              Close Player &times;
            </button>
          </div>

          <AudioPlayer generation={selectedGen} />
        </div>
      )}

      {/* Generations Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-studio-card/40 rounded-xl animate-pulse border border-studio-cardBorder" />
          ))}
        </div>
      ) : generations.length === 0 ? (
        <div className="text-center py-16 bg-studio-card/20 border border-dashed border-studio-cardBorder rounded-2xl space-y-2">
          <FileAudio className="w-8 h-8 text-studio-textMuted mx-auto" />
          <p className="text-xs text-studio-textMuted">No audio files have been generated yet.</p>
        </div>
      ) : (
        <div className="bg-[#101827] border border-studio-cardBorder rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#141F36] border-b border-studio-cardBorder text-slate-400 uppercase font-mono text-[11px]">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Project / Batch</th>
                  <th className="px-5 py-3">Paragraph</th>
                  <th className="px-5 py-3">Voice</th>
                  <th className="px-5 py-3">Model</th>
                  <th className="px-5 py-3">Duration</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {generations.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-studio-textMuted">
                      {formatDate(g.created_at)}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-white">
                      {g.project_name || 'Project'} <span className="text-blue-400">(Batch {g.batch_number || 1})</span>
                    </td>
                    <td className="px-5 py-3.5 font-mono">
                      Paragraph {g.paragraph_number || 1} {g.part_number ? `(${g.part_number})` : ''}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                        {g.voice}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-400">
                      {g.model}
                    </td>
                    <td className="px-5 py-3.5 font-mono">
                      {g.duration ? `${g.duration}s` : '--'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        g.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {g.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {g.status === 'COMPLETED' && (
                          <button
                            onClick={() => setSelectedGen(g)}
                            className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
                            title="Play audio in studio waveform player"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                        )}

                        {g.wav_path && (
                          <a
                            href={api.getAudioUrl(g.id, 'wav', true)}
                            download
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Download WAV Master"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          onClick={() => handleDelete(g.id)}
                          className="p-1.5 rounded-lg text-studio-textMuted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
