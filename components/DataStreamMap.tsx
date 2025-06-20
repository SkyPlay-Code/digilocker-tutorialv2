import React, { useState, useRef, useEffect } from 'react';
import { KeyPoint, CalibrationModule } from '../types';
import { KEY_POINTS_DATA } from '../constants';
import { PlayIcon, CheckCircleIcon } from './icons';

interface DataStreamMapProps {
  onJumpToSimulation: (module: CalibrationModule) => void;
}

interface NodePosition {
  x: number; // percentage
  y: number; // percentage
  depth: number; // for parallax effect, 0 to 1
}

const DataStreamMap: React.FC<DataStreamMapProps> = ({ onJumpToSimulation }) => {
  const [activeNode, setActiveNode] = useState<KeyPoint | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const nodePositions: Record<string, NodePosition> = {
    auth: { x: 20, y: 30, depth: 0.8 },
    docmat: { x: 50, y: 50, depth: 0.5 },
    pinencrypt: { x: 80, y: 70, depth: 0.9 },
    overview: { x: 30, y: 75, depth: 0.6 },
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({ 
          x: event.clientX - rect.left, 
          y: event.clientY - rect.top 
        });
      }
    };
    const currentRef = containerRef.current;
    currentRef?.addEventListener('mousemove', handleMouseMove);
    return () => currentRef?.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleNodeClick = (nodeData: KeyPoint) => {
    setActiveNode(nodeData);
  };

  const handleJump = (moduleTarget?: CalibrationModule) => {
    if (moduleTarget !== undefined) {
      onJumpToSimulation(moduleTarget);
    }
    setActiveNode(null); // Close panel after jump
  };
  
  const calculateTransform = (depth: number) => {
    if (!containerRef.current) return '';
    const centerX = containerRef.current.offsetWidth / 2;
    const centerY = containerRef.current.offsetHeight / 2;
    const moveX = (mousePos.x - centerX) * 0.05 * depth; // Adjust multiplier for intensity
    const moveY = (mousePos.y - centerY) * 0.05 * depth;
    return `translate(${moveX}px, ${moveY}px)`;
  };


  return (
    <section id="data-stream-map" className="py-16 md:py-24 bg-gradient-to-b from-black via-indigo-950 to-purple-950 font-orbitron relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        {[...Array(30)].map((_, i) => (
            <div key={i} className="absolute bg-purple-400 rounded-full animate-pulse"
                 style={{
                   width: `${Math.random()*3+1}px`, height: `${Math.random()*3+1}px`,
                   top: `${Math.random()*100}%`, left: `${Math.random()*100}%`,
                   animationDelay: `${Math.random()*5}s`,
                   animationDuration: `${Math.random()*3+2}s`,
                   filter: 'blur(1px)'
                 }}></div>
          ))}
      </div>
      <div className="container mx-auto px-4 text-center relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold mb-4 text-glow-magenta">DATA-STREAM MAP</h2>
        <p className="text-lg md:text-xl text-purple-300 mb-12 max-w-2xl mx-auto">
          Navigate the key constellations of your Quantum Vault calibration. Each node unlocks critical knowledge.
        </p>

        <div ref={containerRef} className="relative w-full max-w-4xl h-[500px] md:h-[600px] mx-auto border-2 border-purple-600/50 rounded-xl hud-element p-4 overflow-hidden"
             style={{ perspective: '1000px' }}>
          {/* Background Grid Lines (decorative) */}
          {[...Array(10)].map((_, i) => (
            <React.Fragment key={`grid-${i}`}>
              <div className="absolute bg-purple-500/20" style={{left: `${i*10}%`, top:0, bottom:0, width: '1px'}}></div>
              <div className="absolute bg-purple-500/20" style={{top: `${i*10}%`, left:0, right:0, height: '1px'}}></div>
            </React.Fragment>
          ))}

          {/* Nodes */}
          {KEY_POINTS_DATA.map((node) => {
            const pos = nodePositions[node.id] || { x: Math.random()*80+10, y: Math.random()*80+10, depth: Math.random()*0.5 + 0.5 };
            return (
              <div
                key={node.id}
                onClick={() => handleNodeClick(node)}
                className={`absolute w-24 h-24 p-2 flex flex-col items-center justify-center rounded-full 
                            border-2 cursor-pointer transition-all duration-300 group
                            ${activeNode?.id === node.id ? 'bg-magenta-500/50 border-magenta-400 scale-110 shadow-lg box-glow-magenta' : 'bg-indigo-700/50 border-indigo-500 hover:border-magenta-400 hover:scale-105'}`}
                style={{ 
                  left: `${pos.x}%`, top: `${pos.y}%`, 
                  transform: `translate(-50%, -50%) ${calculateTransform(pos.depth)}`,
                  transition: 'transform 0.1s ease-out, background-color 0.3s, border-color 0.3s, box-shadow 0.3s',
                }}
              >
                <span className="text-xs font-semibold text-center text-glow-magenta group-hover:text-magenta-200">{node.title}</span>
                <span className="text-[10px] text-purple-300 group-hover:text-purple-100">{node.timestamp}</span>
              </div>
            );
          })}
          
          {/* Connecting Lines (decorative, simplified) */}
          {KEY_POINTS_DATA.length > 1 && KEY_POINTS_DATA.slice(0, -1).map((node, i) => {
            const nextNode = KEY_POINTS_DATA[i+1];
            const pos1 = nodePositions[node.id] || {x:0,y:0,depth:0};
            const pos2 = nodePositions[nextNode.id] || {x:0,y:0,depth:0};
            // This is a very simplified line, real SVG lines would be better for connections
            return (
              <div key={`line-${i}`} className="absolute h-px bg-purple-500/30 origin-left"
                style={{
                  left: `${Math.min(pos1.x, pos2.x)}%`,
                  top: `${Math.min(pos1.y, pos2.y) + (Math.abs(pos1.y - pos2.y)/2)}%`, // Midpoint approximation
                  width: `${Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2))}%`, // Distance
                  transform: `rotate(${Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x) * 180 / Math.PI}deg) translateZ(-${(pos1.depth + pos2.depth)/2 * 100}px)`, // Average depth for Z
                  transformOrigin: 'top left'
                }}
              ></div>
            );
          })}


          {/* Holographic Panel */}
          {activeNode && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11/12 max-w-md 
                            bg-slate-800/80 backdrop-blur-sm border border-magenta-500/70 rounded-lg 
                            p-6 shadow-2xl animate-slideUp z-20 hud-element box-glow-magenta">
              <h3 className="text-2xl font-bold text-glow-magenta mb-3">{activeNode.title}</h3>
              <p className="text-sm text-purple-200 mb-1">Timestamp: {activeNode.timestamp}</p>
              <p className="text-purple-300 mb-4 text-sm">{activeNode.description}</p>
              
              {/* Placeholder for holovid animation */}
              <div className="w-full h-32 bg-black/30 border border-magenta-600 rounded flex items-center justify-center mb-4">
                <PlayIcon className="w-12 h-12 text-magenta-400 opacity-50" />
                <p className="absolute text-xs text-magenta-500">Holovid Simulation Offline</p>
              </div>

              {activeNode.moduleTarget !== undefined ? (
                <button 
                  onClick={() => handleJump(activeNode.moduleTarget)}
                  className="w-full px-4 py-2 bg-magenta-500 text-white font-semibold rounded hover:bg-magenta-400 transition-colors flex items-center justify-center"
                >
                  <PlayIcon className="w-5 h-5 mr-2" /> JUMP TO SIMULATION
                </button>
              ) : (
                <div className="text-center text-sm text-purple-400 flex items-center justify-center">
                    <CheckCircleIcon className="w-5 h-5 mr-2 text-green-400" /> General Information Node
                </div>
              )}

              <button 
                onClick={() => setActiveNode(null)}
                className="mt-3 w-full text-xs text-purple-400 hover:text-magenta-300 transition-colors"
              >
                Close Panel
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default DataStreamMap;
