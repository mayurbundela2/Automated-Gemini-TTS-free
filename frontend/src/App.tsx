import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { BatchPage } from './pages/BatchPage';
import { SettingsPage } from './pages/SettingsPage';
import { HistoryPage } from './pages/HistoryPage';
import { api } from './api';
import { Project } from './types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'projects' | 'batches' | 'history' | 'settings'>('projects');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    api.getSettings()
      .then((s) => setIsDemoMode(s.is_demo_mode))
      .catch(console.error);
  }, [currentTab]);

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setCurrentTab('batches');
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setCurrentTab('projects');
  };

  return (
    <div className="min-h-screen bg-studio-bg text-studio-textLight flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isDemoMode={isDemoMode}
        selectedProjectName={selectedProject?.name}
      />

      <main className="flex-1 pb-28 sm:pb-16">
        {currentTab === 'projects' && (
          <Dashboard onSelectProject={handleSelectProject} />
        )}

        {currentTab === 'batches' && selectedProject && (
          <BatchPage
            project={selectedProject}
            onBack={handleBackToProjects}
          />
        )}

        {currentTab === 'batches' && !selectedProject && (
          <Dashboard onSelectProject={handleSelectProject} />
        )}

        {currentTab === 'history' && <HistoryPage />}

        {currentTab === 'settings' && <SettingsPage />}
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-studio-cardBorder/60 text-center text-xs font-mono text-studio-textMuted bg-[#0B0F17]/90">
        Google Gemini TTS Studio &bull; Localhost Engine &bull; Phase 1 Audio Foundation
      </footer>
    </div>
  );
};

export default App;
