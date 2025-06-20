import React, { useState } from 'react';
import { SOCIAL_PLATFORMS } from '../constants';
import { ClipboardIcon, LinkIcon, GlobeAltIcon, CheckCircleIcon } from './icons';

const ShareSection: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [transmittingTo, setTransmittingTo] = useState<string | null>(null);

  const handleShare = (platformId: string, platformName: string) => {
    setTransmittingTo(platformName);
    // Simulate data beam animation
    setTimeout(() => setTransmittingTo(null), 2000); // Reset after 2s

    const shareUrl = window.location.href; // Or a specific tutorial link
    const text = "Discover The Quantum Vault - Your Personal Data-Verse!";
    let url = "";

    switch (platformId) {
      case 'fb':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'tw':
        url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
        break;
      case 'ln':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        break;
    }
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      // "Data chip minted" animation could be triggered here
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <section id="share" className="py-16 md:py-24 bg-gradient-to-b from-purple-950 via-indigo-900 to-black font-orbitron">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-4 text-glow-cyan">PROPAGATE THE SIGNAL</h2>
        <p className="text-lg md:text-xl text-cyan-300 mb-12 max-w-2xl mx-auto">
          Share this calibration protocol across the network. Expand the reach of The Quantum Vault.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          {/* Globe Console */}
          <div className="md:col-span-1 flex justify-center items-center relative">
            <GlobeAltIcon className="w-48 h-48 md:w-64 md:h-64 text-cyan-500 opacity-60 
                                   filter drop-shadow-[0_0_15px_#06b6d4] 
                                   animate-[pulse_4s_cubic-bezier(0.4,0,0.6,1)_infinite]" 
            />
            {/* Simulated data beam */}
            {transmittingTo && (
                <div className="absolute top-1/2 left-1/2 w-1 h-32 bg-cyan-300 rounded-full animate-beam"
                     style={{
                        transformOrigin: 'top center',
                        transform: `translate(-50%, -100%) rotate(${Math.random()*360}deg)`,
                        boxShadow: '0 0 10px #06b6d4, 0 0 20px #06b6d4'
                     }}>
                </div>
            )}
            {transmittingTo && <p className="absolute bottom-0 text-sm text-cyan-200 animate-pulse">Transmitting to {transmittingTo}...</p>}
          </div>

          {/* Share Buttons & Copy Link */}
          <div className="md:col-span-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SOCIAL_PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => handleShare(platform.id, platform.name)}
                  className={`w-full p-4 font-semibold rounded-lg transition-all duration-300 ease-in-out
                              text-white border-2 border-transparent hover:border-cyan-400
                              flex items-center justify-center space-x-2 hud-element ${platform.color} 
                              hover:shadow-[0_0_15px_rgba(6,182,212,0.7)]`}
                >
                  <span className="text-xl">{platform.icon}</span>
                  <span>{platform.name}</span>
                </button>
              ))}
            </div>
            <button
              onClick={handleCopyLink}
              className={`w-full p-4 font-semibold rounded-lg transition-all duration-300 ease-in-out
                          border-2 border-purple-500 hover:border-purple-300
                          flex items-center justify-center space-x-2 hud-element 
                          ${copied ? 'bg-green-500/80 text-white' : 'bg-purple-600/50 text-purple-200 hover:bg-purple-500/50 hover:text-white'}`}
            >
              {copied ? <CheckCircleIcon className="w-6 h-6" /> : <ClipboardIcon className="w-6 h-6" />}
              <span>{copied ? 'DATASLUG ENCODED!' : 'ENCODE DATASLUG (Copy Link)'}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ShareSection;
