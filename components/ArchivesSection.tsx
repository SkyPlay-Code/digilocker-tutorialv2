import React, { useState } from 'react';
import { RELATED_RESOURCES_DATA } from '../constants';
import { XCircleIcon } from './icons';

interface ArchiveItem {
  id: string;
  title: string;
  icon: string; // Emoji or simple character
  content: string;
}

const ArchivesSection: React.FC = () => {
  const [expandedItem, setExpandedItem] = useState<ArchiveItem | null>(null);

  const handleItemClick = (item: ArchiveItem) => {
    setExpandedItem(item);
  };

  const handleCloseReader = () => {
    setExpandedItem(null);
  };

  return (
    <section id="archives" className="py-16 md:py-24 bg-gradient-to-b from-black via-indigo-950 to-slate-900 font-orbitron">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 text-glow-blue">THE ARCHIVES</h2>
        <p className="text-lg md:text-xl text-blue-300 text-center mb-12 max-w-2xl mx-auto">
          Access supplementary data-constructs. Expand your knowledge of the Quantum Vault's deeper systems.
        </p>

        <div className="relative flex space-x-6 pb-4 overflow-x-auto scrollbar-thin scrollbar-thumb-indigo-500 scrollbar-track-indigo-900/50 scrollbar-webkit">
          {RELATED_RESOURCES_DATA.map((item, index) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="group flex-shrink-0 w-64 h-72 p-6 rounded-xl border-2 border-blue-600/70 
                         bg-indigo-900/50 hover:bg-indigo-800/70 hover:border-blue-400 
                         transition-all duration-300 ease-in-out cursor-pointer
                         flex flex-col items-center justify-center text-center transform hover:scale-105 box-glow-blue"
              style={{
                // Dodecahedron-like shape (simplified with clip-path, requires browser support or SVG)
                // For simplicity, a rounded rectangle is used here. A more complex shape could be achieved with:
                // clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
              }}
            >
              <div className="text-6xl mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:animate-pulse">{item.icon}</div>
              <h3 className="text-2xl font-semibold text-blue-300 group-hover:text-glow-cyan">{item.title}</h3>
              <p className="text-sm text-blue-400 mt-2">Click to expand</p>
            </div>
          ))}
        </div>
      </div>

      {/* Full-screen reader modal */}
      {expandedItem && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-3xl max-h-[90vh] bg-slate-900 border-2 border-blue-500 rounded-lg shadow-2xl 
                          flex flex-col hud-element box-glow-blue">
            <div className="flex items-center justify-between p-4 border-b border-blue-600/50">
              <h2 className="text-2xl font-bold text-glow-blue">{expandedItem.icon} {expandedItem.title}</h2>
              <button onClick={handleCloseReader} className="text-blue-300 hover:text-white transition-colors">
                <XCircleIcon className="w-8 h-8"/>
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-blue-200 font-mono scrollbar-thin scrollbar-thumb-indigo-500 scrollbar-track-indigo-900/50 scrollbar-webkit">
              {/* This is a simple way to render content. For real animated diagrams, more complex components would be needed. */}
              {expandedItem.content.split('\n').map((paragraph, index, arr) => (
                  <p key={index} className="text-sm md:text-base leading-relaxed animate-typewriter mb-3"
                     style={{animationDelay: `${index * 0.1}s`, whiteSpace: 'pre-wrap', overflow: 'hidden', borderRight: index === arr.length -1 ? '.15em solid orange' : 'none', animationFillMode:'forwards'}}>
                     {paragraph}
                  </p>
              ))}
            </div>
            <div className="p-3 border-t border-blue-600/50 text-center">
                <p className="text-xs text-blue-400">End of Data-Construct // Archive: {expandedItem.id}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ArchivesSection;
