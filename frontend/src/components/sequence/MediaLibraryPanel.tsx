import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Film, Trash2, Tag, Search, Plus, Sparkles } from 'lucide-react';
import { MediaAsset } from '../../types';
import { api } from '../../api';

interface MediaLibraryPanelProps {
  batchId: number;
  mediaAssets: MediaAsset[];
  onMediaUploaded: () => void;
  onMediaDeleted: (assetId: number) => void;
  selectedAssetId?: number;
  onSelectAsset?: (asset: MediaAsset) => void;
}

export const MediaLibraryPanel: React.FC<MediaLibraryPanelProps> = ({
  batchId,
  mediaAssets,
  onMediaUploaded,
  onMediaDeleted,
  selectedAssetId,
  onSelectAsset
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setUploading(true);
    try {
      await api.uploadBatchMedia(batchId, files);
      onMediaUploaded();
    } catch (err: any) {
      alert(err.message || 'Failed to upload media files');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredAssets = mediaAssets.filter((a) =>
    a.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.tags && a.tags.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full bg-[#0D1527] border-r border-[#1F2E4A] overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 border-b border-[#1F2E4A] bg-[#111A30] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-xs text-white tracking-wide uppercase">Media Assets</h3>
            <span className="text-[10px] text-slate-400 font-mono">{mediaAssets.length} files</span>
          </div>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all active:scale-95"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{uploading ? 'UPLOADING...' : 'IMPORT'}</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFilesSelected}
        />
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-[#1F2E4A] bg-[#0F182C]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by filename or tag..."
            className="w-full bg-[#090E1A] border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium placeholder-slate-500"
          />
        </div>
      </div>

      {/* Media Grid / List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
        {filteredAssets.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700/80 hover:border-blue-500/60 rounded-2xl p-6 text-center cursor-pointer transition-all bg-[#090E1A]/40 space-y-2"
          >
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-300">Drag & drop images / videos here</p>
            <p className="text-[10px] text-slate-500 font-mono">Supports JPG, PNG, WEBP, MP4, MOV</p>
          </div>
        ) : (
          filteredAssets.map((asset) => (
            <div
              key={asset.id}
              onClick={() => onSelectAsset && onSelectAsset(asset)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                selectedAssetId === asset.id
                  ? 'bg-blue-600/20 border-blue-500 shadow-md shadow-blue-500/10'
                  : 'bg-[#121B30] border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Thumbnail */}
              <div className="w-14 h-12 rounded-lg bg-black overflow-hidden flex-shrink-0 relative border border-slate-700/50">
                {asset.file_type === 'video' ? (
                  <video
                    src={api.getMediaFileUrl(asset.id)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={api.getMediaFileUrl(asset.id)}
                    alt={asset.filename}
                    className="w-full h-full object-cover"
                  />
                )}
                <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 text-[8px] font-mono uppercase bg-black/80 text-white rounded font-bold">
                  {asset.file_type === 'video' ? 'MP4' : 'IMG'}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-xs font-bold text-white truncate group-hover:text-blue-300" title={asset.filename}>
                  {asset.filename}
                </p>
                {asset.tags && (
                  <div className="flex items-center space-x-1 text-[10px] text-indigo-300 font-mono truncate">
                    <Tag className="w-2.5 h-2.5 flex-shrink-0 text-indigo-400" />
                    <span className="truncate">{asset.tags}</span>
                  </div>
                )}
              </div>

              {/* Delete Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${asset.filename}"?`)) {
                    onMediaDeleted(asset.id);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                title="Delete Asset"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
