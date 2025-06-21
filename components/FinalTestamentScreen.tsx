

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const DUST_PARTICLE_COUNT = 70;
const MESSAGE_TEXT = `I tried to build a universe here.
A space born of code and light.
It did not become what I had envisioned.
Perhaps it was never meant to.
But an echo remains.
A fragment of a perfect dream.
What you see is what was.
And what could have been.`;
const WORD_FADE_IN_DURATION = 10000; // Total time for message to appear (ms)

const HEART_PULSE_NORMAL_DURATION = '5s';
const HEART_PULSE_FASTER_DURATION = '1.5s';

interface MemoryMote {
  id: string;
  x: number;
  y: number;
  opacity: number;
  size: number;
  vx: number;
  vy: number;
  createdAt: number;
  life: number; // in ms
}

interface FinalTestamentScreenProps {
  onAccessArchive: () => void;
}

const FinalTestamentScreen: React.FC<FinalTestamentScreenProps> = ({ onAccessArchive }) => {
  const [phase, setPhase] = useState<'initial' | 'messageVisible' | 'linkVisible' | 'fadingOut'>('initial');
  const [visibleWords, setVisibleWords] = useState<string[]>([]);
  const [isLinkHovered, setIsLinkHovered] = useState(false);
  const [memoryMotes, setMemoryMotes] = useState<MemoryMote[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const heartSvgRef = useRef<SVGSVGElement>(null);
  const heartCoreLightRef = useRef<SVGCircleElement>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const words = useMemo(() => MESSAGE_TEXT.split(/\s+/), []);
  const wordDelay = WORD_FADE_IN_DURATION / words.length;

  // Initialize and clean up Web Audio
  useEffect(() => {
    try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        oscillatorRef.current = audioContextRef.current.createOscillator();
        gainNodeRef.current = audioContextRef.current.createGain();

        oscillatorRef.current.type = 'sine';
        oscillatorRef.current.frequency.setValueAtTime(90, audioContextRef.current.currentTime); // Low resonant hum (e.g., F#2 ~92.5Hz)
        gainNodeRef.current.gain.setValueAtTime(0.0001, audioContextRef.current.currentTime); // Start silent

        oscillatorRef.current.connect(gainNodeRef.current);
        gainNodeRef.current.connect(audioContextRef.current.destination);
        oscillatorRef.current.start();
        
        // Fade in audio
        gainNodeRef.current.gain.linearRampToValueAtTime(0.15, audioContextRef.current.currentTime + 2); // Fade in to 0.15 gain over 2s

    } catch (e) {
        console.error("Web Audio API is not supported in this browser or failed to init.", e);
    }
    
    return () => {
      if (audioContextRef.current) {
        if(gainNodeRef.current && oscillatorRef.current) {
            gainNodeRef.current.gain.cancelScheduledValues(audioContextRef.current.currentTime);
            gainNodeRef.current.gain.linearRampToValueAtTime(0.0001, audioContextRef.current.currentTime + 0.5); // Quick fade out
            setTimeout(() => {
                oscillatorRef.current?.stop();
                oscillatorRef.current?.disconnect();
                gainNodeRef.current?.disconnect();
                if (audioContextRef.current?.state !== 'closed') {
                    audioContextRef.current?.close().catch(console.error);
                }
            }, 600);
        } else if (audioContextRef.current?.state !== 'closed') {
           audioContextRef.current?.close().catch(console.error);
        }
      }
    };
  }, []);


  // Fade in the main container
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.opacity = '1';
    }
  }, []);

  // Word-by-word message animation
  useEffect(() => {
    if (phase === 'initial') {
      const timers: number[] = [];
      words.forEach((word, index) => {
        timers.push(
          window.setTimeout(() => {
            setVisibleWords((prev) => [...prev, word]);
          }, index * wordDelay)
        );
      });
      timers.push(window.setTimeout(() => setPhase('messageVisible'), WORD_FADE_IN_DURATION + 500));
      return () => timers.forEach(clearTimeout);
    }
  }, [phase, words, wordDelay]);

  // Show "Enter the Echo" link after message
  useEffect(() => {
    if (phase === 'messageVisible') {
      const timer = setTimeout(() => setPhase('linkVisible'), 1000); // 1s after message fully appears
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Heartbeat animation control
  useEffect(() => {
    if (heartCoreLightRef.current) {
      heartCoreLightRef.current.style.animationDuration = isLinkHovered
        ? HEART_PULSE_FASTER_DURATION
        : HEART_PULSE_NORMAL_DURATION;
    }
  }, [isLinkHovered]);

  // Memory Motes (Decaying Particles)
  useEffect(() => {
    const spawnInterval = setInterval(() => {
      if (phase === 'fadingOut' || !heartSvgRef.current) return;

      const heartRect = heartSvgRef.current.getBoundingClientRect();
      const numCracks = 3; // Number of distinct crack origins
      const crackOriginIndex = Math.floor(Math.random() * numCracks);
      
      let startXPercent, startYPercent;
      // Simplified crack origins based on heart shape, relative to SVG 0-100 viewBox
      if(crackOriginIndex === 0) { startXPercent = 40 + Math.random()*5; startYPercent = 30 + Math.random()*5;} // Top left-ish
      else if(crackOriginIndex === 1) { startXPercent = 60 + Math.random()*5; startYPercent = 40 + Math.random()*5;} // Top right-ish
      else { startXPercent = 50 + Math.random()*5-2.5; startYPercent = 70 + Math.random()*5;} // Bottom-ish center

      const mote: MemoryMote = {
        id: `mote-${Date.now()}-${Math.random()}`,
        x: (heartRect.left + (startXPercent / 100) * heartRect.width) + (Math.random() - 0.5) * 5, //px
        y: (heartRect.top + (startYPercent / 100) * heartRect.height) + (Math.random() - 0.5) * 5, //px
        opacity: 0.8,
        size: Math.random() * 2 + 1, // 1px to 3px
        vx: (Math.random() - 0.5) * 0.3, // Slow horizontal drift
        vy: 0.2 + Math.random() * 0.3,   // Slow downward drift
        createdAt: Date.now(),
        life: 3000 + Math.random() * 2000, // 3-5 seconds lifespan
      };
      setMemoryMotes((prev) => [...prev, mote]);
    }, 2000 + Math.random() * 1500); // Spawn one every 2-3.5 seconds

    const animationInterval = setInterval(() => {
      setMemoryMotes((prevMotes) =>
        prevMotes
          .map((m) => {
            const age = Date.now() - m.createdAt;
            if (age > m.life) return null;
            return {
              ...m,
              x: m.x + m.vx,
              y: m.y + m.vy,
              opacity: Math.max(0, 0.8 * (1 - age / m.life)),
            };
          })
          .filter((m): m is MemoryMote => m !== null)
      );
    }, 50); // Animation update rate

    return () => {
      clearInterval(spawnInterval);
      clearInterval(animationInterval);
    };
  }, [phase]);


  const handleInteraction = useCallback(() => {
    if (phase !== 'linkVisible' && phase !== 'initial' && phase !== 'messageVisible') return; // Allow click if link is visible or even before
    
    setPhase('fadingOut');
    if (containerRef.current) {
      containerRef.current.style.opacity = '0';
      containerRef.current.style.transition = 'opacity 3s ease-out';
    }

    if (audioContextRef.current && gainNodeRef.current) {
        gainNodeRef.current.gain.cancelScheduledValues(audioContextRef.current.currentTime);
        gainNodeRef.current.gain.linearRampToValueAtTime(0.0001, audioContextRef.current.currentTime + 2.8); // Fade hum with screen
    }

    setTimeout(() => {
      onAccessArchive();
    }, 3000); // Match fade-out duration
  }, [phase, onAccessArchive]);

  useEffect(() => {
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [handleInteraction]);

  return (
    <div ref={containerRef} className="final-testament-container" style={{ opacity: 0 }}>
      {/* Dust of Time Particles */}
      {Array.from({ length: DUST_PARTICLE_COUNT }).map((_, i) => {
        const duration = Math.random() * 20 + 15; // 15-35 seconds
        const delay = Math.random() * duration;
        const size = Math.random() * 1.5 + 0.5; // 0.5px to 2px
        const initialXOffset = Math.random() * 100; // vw
        const driftXEnd = (Math.random() - 0.5) * 80; // vw total horizontal drift
        return (
          <div
            key={`dust-${i}`}
            className="dust-particle"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              left: `${initialXOffset}vw`,
              animationDuration: `${duration}s`,
              animationDelay: `-${delay}s`, // Start partway through animation
              // @ts-ignore Custom property for animation
              '--drift-x-end': `${driftXEnd}vw`,
            }}
          />
        );
      })}

      {/* Crystalline Heart */}
      <div 
        className={`crystalline-heart-container ${isLinkHovered ? 'heart-pulse-faster' : ''}`}
      >
        <svg ref={heartSvgRef} viewBox="0 0 100 100" className="crystalline-heart-svg">
          <defs>
            <filter id="heartGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <path
            d="M50 25 C 20 20, 15 50, 50 85 C 85 50, 80 20, 50 25 Z"
            fill="rgba(25, 35, 80, 0.25)" /* Dark, semi-transparent obsidian-like */
            stroke="rgba(100, 120, 180, 0.4)" /* Faint edge */
            strokeWidth="0.3"
            filter="url(#heartGlow)"
          />
          <circle ref={heartCoreLightRef} cx="50" cy="55" r="5" fill="#00BFFF" className="heart-core-light" />
          {/* Fractures - these are static for simplicity, dynamic ones are the motes */}
          <line x1="50" y1="55" x2="40" y2="30" stroke="rgba(220, 220, 255, 0.3)" strokeWidth="0.25" />
          <line x1="50" y1="55" x2="60" y2="40" stroke="rgba(220, 220, 255, 0.3)" strokeWidth="0.25" />
          <line x1="50" y1="55" x2="55" y2="70" stroke="rgba(220, 220, 255, 0.3)" strokeWidth="0.25" />
          <line x1="45" y1="40" x2="55" y2="50" stroke="rgba(220, 220, 255, 0.2)" strokeWidth="0.2" />
          <line x1="60" y1="65" x2="48" y2="60" stroke="rgba(220, 220, 255, 0.2)" strokeWidth="0.2" />
        </svg>
      </div>

       {/* Memory Motes */}
      {memoryMotes.map((mote) => (
        <div
          key={mote.id}
          className="memory-mote"
          style={{
            left: `${mote.x}px`,
            top: `${mote.y}px`,
            width: `${mote.size}px`,
            height: `${mote.size}px`,
            opacity: mote.opacity,
            transition: 'opacity 0.5s linear', // For fade out handled by JS
          }}
        />
      ))}


      {/* Message */}
      <div className="final-message-container">
        {words.map((word, index) => (
          <span
            key={index}
            className={`final-message-word ${visibleWords.length > index ? 'visible' : ''}`}
            style={{ transitionDelay: `${index * (wordDelay / 1000)}s` }}
          >
            {word}
          </span>
        ))}
      </div>

      {/* Invitation Link */}
      <a
        href="#"
        className={`enter-echo-link ${phase === 'linkVisible' || phase === 'fadingOut' ? 'visible' : ''}`}
        style={{
            opacity: (phase === 'linkVisible' || phase === 'fadingOut') ? 1: 0, 
            transitionDelay: (phase === 'linkVisible' || phase === 'fadingOut') ? '0s' : `${WORD_FADE_IN_DURATION / 1000 + 1.5}s`
        }}
        onMouseEnter={() => setIsLinkHovered(true)}
        onMouseLeave={() => setIsLinkHovered(false)}
        onClick={(e) => {
          e.preventDefault(); // Prevent actual navigation for "#"
          handleInteraction();
        }}
      >
        Enter the Echo.
      </a>
    </div>
  );
};

export default FinalTestamentScreen;
