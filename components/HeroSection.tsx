import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDownIcon } from './icons';

interface HeroSectionProps {
  onInitiateCalibration: () => void;
  onMapDataStream: () => void; // Callback to scroll to data stream map section
}

const QuantumParticle: React.FC<{ initialX: number; initialY: number; size: number; speed: number; mousePos: { x: number; y: number } }> = ({ initialX, initialY, size, speed, mousePos }) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });

  useEffect(() => {
    const parallaxFactor = speed * 0.005; // Adjust for desired parallax intensity
    const targetX = initialX + (mousePos.x / window.innerWidth - 0.5) * parallaxFactor * 100;
    const targetY = initialY + (mousePos.y / window.innerHeight - 0.5) * parallaxFactor * 100;
    
    setPosition({ x: targetX, y: targetY});

  }, [mousePos, initialX, initialY, speed]);

  return (
    <div
      className="absolute rounded-full bg-cyan-400/50"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        left: `${position.x}%`,
        top: `${position.y}%`,
        transition: 'left 0.1s ease-out, top 0.1s ease-out',
        filter: `blur(${size < 2 ? '1px' : '0px'})`
      }}
    />
  );
};


const HeroSection: React.FC<HeroSectionProps> = ({ onInitiateCalibration, onMapDataStream }) => {
  const [typedSubtitle, setTypedSubtitle] = useState('');
  const fullSubtitle = "Calibrate Your Synapse. Master Your Data-Verse.";
  const title = "Quantum Vault";
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [particles, setParticles] = useState<{ id: number; initialX: number; initialY: number; size: number; speed: number }[]>([]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePos({ x: event.clientX, y: event.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    
    // Generate particles
    const newParticles = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      initialX: Math.random() * 100,
      initialY: Math.random() * 100,
      size: Math.random() * 2 + 0.5, // sizes from 0.5px to 2.5px
      speed: Math.random() * 5 + 1, // speeds from 1 to 6
    }));
    setParticles(newParticles);

    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    if (typedSubtitle.length < fullSubtitle.length) {
      const timer = setTimeout(() => {
        setTypedSubtitle(fullSubtitle.substring(0, typedSubtitle.length + 1));
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [typedSubtitle, fullSubtitle]);


  const parallaxOffset = (layerDepth: number) => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    const x = (mousePos.x - window.innerWidth / 2) * layerDepth;
    const y = (mousePos.y - window.innerHeight / 2) * layerDepth;
    return { x, y };
  };

  return (
    <section id="hero" className="relative font-orbitron min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-black">
      {/* Quantum Aether Background Particles */}
      {particles.map(p => (
        <QuantumParticle key={p.id} {...p} mousePos={mousePos} />
      ))}

      {/* Central Crystalline Vault (Simulated) */}
      <div 
        className="absolute w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 opacity-30"
        style={{ 
          transform: `translateX(${parallaxOffset(0.02).x}px) translateY(${parallaxOffset(0.02).y}px) rotate(45deg)`,
          transition: 'transform 0.1s ease-out'
        }}
      >
        <div className="absolute inset-0 border-2 border-cyan-500 rounded-full animate-pulse opacity-50 box-glow-cyan" style={{ animationDuration: '4s' }}></div>
        <div className="absolute inset-4 border border-purple-500 rounded-full animate-pulse opacity-40" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
        <div className="absolute inset-8 bg-indigo-700/30 rounded-lg animate-spin" style={{ animationDuration: '20s', filter: 'blur(5px)'}} />
      </div>


      <div className="relative z-10 text-center flex flex-col items-center" style={{ transform: `translateX(${parallaxOffset(0.01).x}px) translateY(${parallaxOffset(0.01).y}px)`, transition: 'transform 0.1s ease-out'}}>
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6">
          {title.split("").map((char, index) => (
            <span
              key={index}
              className="text-glow-cyan materialize-char"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {char}
            </span>
          ))}
        </h1>
        <p className="text-xl sm:text-2xl md:text-3xl text-purple-300 mb-12 h-10 font-mono">
          {typedSubtitle}
          <span className="animate-ping">_</span>
        </p>
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
          <button
            onClick={onInitiateCalibration}
            className="group relative w-60 h-16 bg-cyan-500 text-gray-900 font-bold text-lg rounded-full flex items-center justify-center
                       hover:bg-cyan-400 transition-all duration-300 animate-pulse-orb animate-destabilize"
          >
            <span className="relative z-10">INITIATE CALIBRATION</span>
            {/* Lightning arcs simulation on hover */}
            <span className="absolute top-1/2 left-1/2 w-1 h-1 bg-white rounded-full opacity-0 group-hover:opacity-100 
                           transform -translate-x-1/2 -translate-y-1/2 
                           group-hover:animate-spark">
            </span>
          </button>
          <button
            onClick={onMapDataStream}
            className="relative w-60 h-16 border-2 border-purple-500 text-purple-300 font-bold text-lg rounded-full 
                       flex items-center justify-center overflow-hidden group
                       hover:bg-purple-500/30 hover:text-purple-100 transition-all duration-300"
          >
            <span className="relative z-10">MAP THE DATA-STREAM</span>
            {/* Mini star-chart inside (simplified) */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="absolute bg-purple-200 rounded-full animate-ping group-hover:animate-none"
                     style={{
                       width: `${Math.random()*2+1}px`, height: `${Math.random()*2+1}px`,
                       top: `${Math.random()*80+10}%`, left: `${Math.random()*80+10}%`,
                       animationDelay: `${Math.random()*0.5}s`,
                       animationDuration: `${Math.random()*1+1}s`
                     }}></div>
              ))}
            </div>
          </button>
        </div>
      </div>

      {/* Gravity Well Scroll Arrow */}
      <div 
        onClick={onMapDataStream}
        className="absolute bottom-10 left-1/2 transform -translate-x-1/2 cursor-pointer group"
        style={{ transform: `translateX(-50%) translateY(${parallaxOffset(0.03).y}px)`, transition: 'transform 0.1s ease-out'}}
        title="Scroll Down"
      >
        <div className="w-16 h-16 border-2 border-indigo-400 rounded-full flex items-center justify-center animate-pulse">
            <ChevronDownIcon className="w-8 h-8 text-indigo-300 group-hover:text-cyan-300 transition-colors" />
        </div>
        {[...Array(3)].map((_,i) => (
          <div key={i} className="absolute w-1 h-1 bg-indigo-300 rounded-full animate-ping"
             style={{ 
               top: `${Math.random()*20 - 10}px`, left: `${Math.random()*20 - 10}px`,
               animationDelay: `${i*0.2}s`, animationDuration: '2s'
             }}>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HeroSection;
