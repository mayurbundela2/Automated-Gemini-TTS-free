import React, { useState, useEffect } from 'react';
import { Plus, FolderKanban, ArrowRight, Trash2, Mic, Clock, FileAudio, Sparkles } from 'lucide-react';
import { api } from '../api';
import { Project } from '../types';

interface DashboardProps {
  onSelectProject: (project: Project) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const p = await api.createProject(name, description);
      setShowNewModal(false);
      setName('');
      setDescription('');
      onSelectProject(p);
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project and all its batches?')) {
      await api.deleteProject(id);
      fetchProjects();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 animate-fadeIn">
      {/* Hero Welcome */}
      <div className="bg-gradient-to-r from-[#111A2E] to-[#15233E] border border-studio-cardBorder rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Studio Style TTS Voice Architecture</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            High-Fidelity Gemini TTS Studio
          </h1>
          <p className="text-sm text-studio-textMuted leading-relaxed">
            Generate cinematic voiceovers paragraph by paragraph with granular director controls, smart splitting, master WAV preservation, and automatic 320k MP3 conversion.
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="z-10 flex items-center space-x-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          <span>NEW PROJECT</span>
        </button>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Projects Grid Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Your Projects</h2>
          <p className="text-xs text-studio-textMuted">Select a project or create a new narration workspace</p>
        </div>

        <span className="text-xs font-mono text-studio-textMuted bg-studio-card px-3 py-1 rounded-lg border border-studio-cardBorder">
          {projects.length} Project{projects.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-studio-card/50 rounded-2xl border border-studio-cardBorder animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-studio-card/30 border border-dashed border-studio-cardBorder rounded-3xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 mx-auto flex items-center justify-center">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No projects yet</h3>
            <p className="text-xs text-studio-textMuted max-w-sm mx-auto">
              Create your first project (e.g., "Cannabis Documentary") to start batching narration scripts.
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Project</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => (
            <div
              key={proj.id}
              onClick={() => onSelectProject(proj)}
              className="group bg-[#111A2D] hover:bg-[#15223B] border border-studio-cardBorder hover:border-blue-500/40 rounded-2xl p-6 shadow-xl transition-all cursor-pointer flex flex-col justify-between space-y-5 relative"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FolderKanban className="w-5 h-5" />
                  </div>

                  <button
                    onClick={(e) => handleDelete(proj.id, e)}
                    className="p-1.5 rounded-lg text-studio-textMuted hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                  {proj.name}
                </h3>
                {proj.description && (
                  <p className="text-xs text-studio-textMuted line-clamp-2 leading-relaxed">
                    {proj.description}
                  </p>
                )}
              </div>

              {/* Stats Footer */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-studio-textMuted">
                <div className="flex items-center space-x-3">
                  <span><strong>{proj.batch_count}</strong> Batches</span>
                  <span>&bull;</span>
                  <span><strong>{proj.paragraph_count}</strong> Paras</span>
                </div>

                <div className="flex items-center space-x-1 text-blue-400 font-semibold group-hover:translate-x-1 transition-transform">
                  <span>Open</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#111A2C] border border-[#233554] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <form onSubmit={handleCreate}>
              <div className="px-6 py-4 border-b border-studio-cardBorder bg-[#152037]">
                <h3 className="font-bold text-sm text-white">CREATE NEW PROJECT</h3>
                <p className="text-xs text-studio-textMuted">Set up a container for your documentary or video batches</p>
              </div>

              <div className="p-6 space-y-4">
                {error && (
                  <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">{error}</p>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white uppercase tracking-wider block">
                    Project Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Cannabis Documentary"
                    className="w-full bg-studio-bg border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-studio-textMuted uppercase tracking-wider block">
                    Description (Optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Brief summary of topic, tone, and goals..."
                    className="w-full bg-studio-bg border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-studio-cardBorder bg-[#152037] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20"
                >
                  {creating ? 'Creating...' : 'CREATE PROJECT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
