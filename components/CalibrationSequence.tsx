
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CalibrationModule, KeyPoint } from '../types';
import { CALIBRATION_MODULES_TIMESTAMPS } from '../constants';
import { StarIcon, DocumentArrowUpIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon } from './icons';

interface CalibrationSequenceProps {
  onClose: () => void;
  jumpToModule?: CalibrationModule;
}

const ModuleHeader: React.FC<{ title: string; moduleNumber: number, objective?: string }> = ({ title, moduleNumber, objective }) => (
  <div className="mb-4 text-center">
    <p className="text-sm text-cyan-400 tracking-widest">MODULE {String(moduleNumber).padStart(2, '0')}</p>
    <h2 className="text-3xl font-bold text-glow-cyan">{title}</h2>
    {objective && <p className="text-md text-purple-300 mt-1">{objective}</p>}
  </div>
);

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="w-full bg-gray-700/50 rounded-full h-2.5 mb-6 hud-element relative">
    <div
      className="bg-cyan-400 h-2.5 rounded-full transition-all duration-500 ease-out"
      style={{ width: `${progress}%` }}
    ></div>
    <div className="absolute -top-5 right-0 text-xs text-cyan-300 font-mono">SYNC: {progress.toFixed(0)}%</div>
  </div>
);

interface ModuleProps {
  onComplete: () => void;
  isActive: boolean;
  setVoiceMessage: (message: string) => void;
}

const AuthenticationModule: React.FC<ModuleProps> = ({ onComplete, isActive, setVoiceMessage: setParentVoiceMessage }) => {
  const SIGIL_NODES = [
    { id: 0, x: 25, y: 50, isStart: true }, // Adjusted for better centering/layout
    { id: 1, x: 45, y: 25 },
    { id: 2, x: 75, y: 35 },
    { id: 3, x: 60, y: 75 },
    { id: 4, x: 30, y: 65, isEnd: true },
  ];
  const TIME_LIMIT = 7; 
  const TRACE_TOLERANCE = 5; // pixels from line (increased slightly for usability)

  const [status, setStatus] = useState<'idle' | 'materializing' | 'awaitingTrace' | 'tracing' | 'success' | 'failed' | 'resetting'>('idle');
  const [tracedSegments, setTracedSegments] = useState<boolean[]>(new Array(SIGIL_NODES.length - 1).fill(false));
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [showSigil, setShowSigil] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const attemptRef = useRef(0); 

  const resetState = useCallback((isRetry = false) => {
    setStatus('materializing');
    setTracedSegments(new Array(SIGIL_NODES.length - 1).fill(false));
    setCurrentNodeIndex(0);
    setTimeLeft(TIME_LIMIT);
    setFeedbackText(null);
    setShowSigil(false); 
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (isRetry) {
      setParentVoiceMessage("Re-calibrating. Please try again.");
    }
    // Initial voice line is handled by parent CalibrationSequence

    attemptRef.current += 1;

    setTimeout(() => {
        setShowSigil(true); 
        setTimeout(() => {
            if (!isActive) return; // Guard against component unmount during timeout
            setStatus('awaitingTrace');
            timerIntervalRef.current = window.setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerIntervalRef.current!);
                        handleFailure('fail_time');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }, 1000); 
    }, isRetry ? 1500 : 500); 
  }, [setParentVoiceMessage, isActive]); // Added isActive to dependency array

  useEffect(() => {
    if (isActive) {
      // Parent sets initial voice message, resetState handles retries.
      resetState(attemptRef.current > 0 && status !== 'idle'); // Only consider retry if not first idle load
    } else {
      setStatus('idle');
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setShowSigil(false);
      attemptRef.current = 0; // Reset attempts when module becomes inactive
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]); // Removed resetState from deps to avoid loop with its own isActive dep


  const getLocalCoordinates = (event: React.MouseEvent): { x: number, y: number } | null => {
    if (!svgRef.current) return null;
    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return null;
    try {
        const localPoint = svgPoint.matrixTransform(CTM.inverse());
        return { x: localPoint.x, y: localPoint.y };
    } catch(e) {
        console.error("Error transforming point:", e);
        return null;
    }
  };

  const distanceToLineSegment = (p: {x:number, y:number}, v: {x:number, y:number}, w: {x:number, y:number}) => {
    const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
    if (l2 === 0) return Math.sqrt((p.x - v.x)**2 + (p.y - v.y)**2);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return Math.sqrt((p.x - projection.x)**2 + (p.y - projection.y)**2);
  };

  const handleMouseDown = (event: React.MouseEvent<SVGElement>, nodeId: number) => {
    if (status !== 'awaitingTrace' || currentNodeIndex !== nodeId || !SIGIL_NODES[nodeId]?.isStart) return;
     if (nodeId === SIGIL_NODES[currentNodeIndex].id) {
        setStatus('tracing');
        const coords = getLocalCoordinates(event);
        if (coords) setCursorPos(coords);
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (status !== 'tracing' || !svgRef.current) return;

    const coords = getLocalCoordinates(event);
    if (!coords) return;
    setCursorPos(coords);

    const startNode = SIGIL_NODES[currentNodeIndex];
    const endNode = SIGIL_NODES[currentNodeIndex + 1];

    if (!endNode) return; 

    const distToSegment = distanceToLineSegment(coords, startNode, endNode);
    if (distToSegment > TRACE_TOLERANCE) {
      handleFailure('fail_path');
      return;
    }

    const distToEndNode = Math.sqrt((coords.x - endNode.x)**2 + (coords.y - endNode.y)**2);
    if (distToEndNode < TRACE_TOLERANCE + 2) { // Node "capture" radius
      const newTracedSegments = [...tracedSegments];
      newTracedSegments[currentNodeIndex] = true;
      setTracedSegments(newTracedSegments);
      
      if (currentNodeIndex + 1 < SIGIL_NODES.length -1) {
          setCurrentNodeIndex(prev => prev + 1);
      } else if (currentNodeIndex + 1 === SIGIL_NODES.length -1) { // Reached the final node
          // Check if it's actually the final node being approached
          if(SIGIL_NODES[currentNodeIndex + 1].isEnd) {
            // No explicit state change here, waiting for mouseUp on final node
            // setCurrentNodeIndex can be incremented to SIGIL_NODES.length -1 here
             setCurrentNodeIndex(prev => prev + 1);
          }
      }
    }
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    if (status !== 'tracing') {
        if(status === 'awaitingTrace' && svgRef.current?.contains(event.target as Node)) {
            // If clicked somewhere not on the start node while awaiting trace
        }
        return;
    }
    setCursorPos(null); 

    const finalNodeInfo = SIGIL_NODES[SIGIL_NODES.length - 1];
    const coords = getLocalCoordinates(event);

    if (coords && 
        currentNodeIndex === SIGIL_NODES.length - 1 && // Must be at the stage of approaching the final node
        tracedSegments.every(s => s === true) &&
        finalNodeInfo.isEnd &&
        Math.sqrt((coords.x - finalNodeInfo.x)**2 + (coords.y - finalNodeInfo.y)**2) < TRACE_TOLERANCE + 3 // Released on final node
    ) {
      handleSuccess();
    } else {
      handleFailure('fail_release');
    }
  };
  
  const handleMouseLeave = (event: React.MouseEvent) => {
    if (status === 'tracing') {
        setCursorPos(null);
        handleFailure('fail_path');
    }
  };

  const handleSuccess = () => {
    if (status === 'success' || status === 'failed') return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setStatus('success');
    setFeedbackText("SIGNATURE VERIFIED");
    console.log("Audio Cue: Success CHIME"); // Conceptual Audio
    setTimeout(() => {
      setShowSigil(false); 
      setFeedbackText(null);
      setTimeout(onComplete, 1000); 
    }, 1500);
  };

  const handleFailure = (reason: 'fail_path' | 'fail_release' | 'fail_time') => {
    if (status === 'failed' || status === 'success' || status === 'resetting') return; 
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setStatus('failed');
    setCursorPos(null);
    setFeedbackText("SIGNATURE CORRUPTED. RE-ATTEMPTING...");
    console.log("Audio Cue: Failure BUZZER"); // Conceptual Audio
    setTimeout(() => {
        setFeedbackText(null); 
        setStatus('resetting');
        resetState(true); 
    }, 2500); 
  };

  if (!isActive && status === 'idle') return null; // Only render if active or needs to animate out

  const getLineStatusColor = (index: number) => {
    if (status === 'failed') return "stroke-red-500"; // Tailwind red-500
    if (status === 'success' || tracedSegments[index]) return "stroke-green-400"; // Tailwind green-400 (#00FF7F is approx)
    return "stroke-[#00BFFF]"; // Neutral blue
  };
  
  const getNodeStatusColor = (nodeId: number) => {
    const node = SIGIL_NODES[nodeId];
    if (status === 'failed') return "fill-red-500";
    if (status === 'success') return "fill-green-400";
    
    // If segment leading to this node is traced, or if it's the start node and we are about to trace from it
    if (nodeId > 0 && tracedSegments[nodeId-1]) return "fill-green-400"; // Node reached
    if (nodeId === 0 && currentNodeIndex === 0 && (status === 'awaitingTrace' || status === 'tracing')) return "fill-[#00BFFF] animate-sigil-pulse-bright"; // Start node ready
    if (nodeId === currentNodeIndex && (status === 'awaitingTrace' || status === 'tracing')) return "fill-cyan-300 animate-sigil-pulse-bright";

    return "fill-[#00BFFF]";
  };

  const timerPath = () => {
    const angle = Math.max(0, (timeLeft / TIME_LIMIT) * 360);
    const radius = 45; // slightly larger radius for timer circle
    const center = 50;
    
    if (angle <= 0.01) return ""; // Effectively empty
    if (angle >= 359.99) return `M ${center},${center-radius} A ${radius},${radius} 0 1 1 ${center-0.01},${center-radius} Z`; // Full circle (approx)

    const startX = center;
    const startY = center - radius;
    const radians = (360 - angle) * Math.PI / 180; // Corrected angle for arc drawing
    const endX = center + radius * Math.sin(radians);
    const endY = center - radius * Math.cos(radians);
    const largeArcFlag = (360 - angle) > 180 ? 1 : 0;

    return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${endX} ${endY}`;
  };

  const svgClasses = `w-full max-w-md h-72 transition-opacity duration-500 ease-in-out hud-element border border-cyan-700/30 rounded-lg 
    ${(status === 'failed' && feedbackText) ? 'animate-sigil-shake' : ''}
    ${showSigil || (status === 'success' && feedbackText) || (status === 'failed' && feedbackText) ? 'opacity-100' : 'opacity-0'}
    ${status === 'tracing' ? 'cursor-none' : ''}`;


  return (
    <div 
      className={`flex flex-col items-center relative ${status === 'tracing' ? 'cursor-none' : ''}`}
      onMouseUpCapture={(e: React.MouseEvent<HTMLDivElement>) => { if (status === 'tracing') handleMouseUp(e); }}
      onMouseMoveCapture={(e: React.MouseEvent<HTMLDivElement>) => { if (status === 'tracing') handleMouseMove(e); }}
      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { if (status === 'tracing') handleMouseLeave(e); }}
    >
       <svg ref={svgRef} viewBox="0 0 100 100" className={svgClasses}
       >
        {/* Timer */}
        { (status === 'awaitingTrace' || status === 'tracing') && timeLeft > 0 &&
            <path d={timerPath()} strokeWidth="2" stroke="#8B5CF6" fill="none" className="transition-all duration-200" />
        }

        {/* Sigil Lines */}
        {SIGIL_NODES.slice(0, -1).map((node, index) => {
          const nextNode = SIGIL_NODES[index + 1];
          const lineLength = Math.sqrt(Math.pow(nextNode.x - node.x, 2) + Math.pow(nextNode.y - node.y, 2));
          return (
            <line
              key={`line-${index}`}
              x1={node.x} y1={node.y}
              x2={nextNode.x} y2={nextNode.y}
              className={`${getLineStatusColor(index)} transition-all duration-300`}
              strokeWidth="1.2"
              strokeDasharray={lineLength}
              strokeDashoffset={status === 'materializing' && showSigil ? 0 : lineLength}
              style={{
                transitionProperty: 'stroke-dashoffset, stroke',
                transitionDuration: status === 'materializing' ? '1s' : '0.3s',
                transitionDelay: status === 'materializing' ? `${index * 0.15}s` : '0s',
                opacity: (status === 'materializing' && !showSigil) ? 0 : 1,
              }}
            />
          );
        })}

        {/* Sigil Nodes */}
        {SIGIL_NODES.map(node => (
          <circle
            key={`node-${node.id}`}
            cx={node.x} cy={node.y} r="3" // Slightly larger nodes
            className={`${getNodeStatusColor(node.id)} transition-colors duration-300 
                        ${(node.isStart && currentNodeIndex === 0 && (status === 'awaitingTrace' || status === 'materializing')) ? 'cursor-pointer' : ''}`}
            onMouseDown={(e) => (node.isStart && currentNodeIndex === 0 && status === 'awaitingTrace') ? handleMouseDown(e, node.id) : undefined}
             style={{
                animation: (status === 'materializing' && showSigil) ? `sigil-node-fade-in-anim 0.5s ease-out ${node.id * 0.15 + 0.5}s forwards` : 'none',
                opacity: (status === 'materializing' && !showSigil) ? 0 : 1,
            }}
          />
        ))}

        {/* Feedback Text */}
        {feedbackText && (
          <text x="50" y="50" textAnchor="middle" dominantBaseline="central" // Changed to central for better alignment
            className={`font-mono text-5xl transition-opacity duration-300 ease-in-out pointer-events-none
                        ${status === 'success' ? 'fill-green-300 text-glow-green' : ''} 
                        ${status === 'failed' ? 'fill-red-400 text-glow-red font-orbitron' : 'font-mono'}
                        ${(status === 'success' || status === 'failed') && !showSigil ? 'opacity-0' : 'opacity-100' }`}
             style={{ fontSize: '7px' }} // SVG font size
          >
            {feedbackText.split('.')[0]}
          </text>
        )}
         {feedbackText && feedbackText.includes("RE-ATTEMPTING") && (
            <text x="50" y="60" textAnchor="middle" dominantBaseline="central"
                className={`font-orbitron fill-red-400 transition-opacity duration-300 ease-in-out pointer-events-none
                            ${(status === 'success' || status === 'failed') && !showSigil ? 'opacity-0' : 'opacity-100' }`}
                style={{ fontSize: '3px' }} // SVG font size
            >
                RE-ATTEMPTING...
            </text>
         )}
         {/* Custom cursor dot */}
        {status === 'tracing' && cursorPos && (
            <circle cx={cursorPos.x} cy={cursorPos.y} r="2" fill="#00FF7F" className="pointer-events-none drop-shadow-[0_0_4px_#00FF7F]" />
        )}
      </svg>
      {/* Fallback cursor none for the div if SVG doesn't capture it perfectly */}
      <style>{` 
        .animate-sigil-pulse-bright { animation: sigil-pulse-bright-anim 1.2s infinite ease-in-out; }
        .animate-sigil-shake { animation: sigil-shake-anim 0.4s 1 ease-in-out; }
      `}</style>
    </div>
  );
};


const DocumentUploadModule: React.FC<ModuleProps> = ({ onComplete, isActive }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (isActive) {
        setFileName(null);
        setIsUploading(false);
        setUploadProgress(0);
    }
  }, [isActive]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFileName(event.target.files[0].name);
      setIsUploading(true);
      setUploadProgress(0); 

      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += 10;
        setUploadProgress(currentProgress);
        if (currentProgress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsUploading(false);
            onComplete();
          }, 1000);
        }
      }, 200);
    }
  };

  if (!isActive) return null;

  return (
    <div className="flex flex-col items-center text-center">
      <label htmlFor="file-upload" className={`cursor-pointer p-6 border-2 border-dashed border-cyan-500/70 rounded-lg hud-element hover:border-cyan-400 transition-colors
                                             ${isUploading ? 'opacity-50' : ''}`}>
        <DocumentArrowUpIcon className="w-16 h-16 mx-auto text-cyan-400 mb-2" />
        {fileName ? <p className="text-green-400">{fileName}</p> : <p>Select Document</p>}
      </label>
      <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} disabled={isUploading} />
      {isUploading && (
        <div className="mt-4 w-full max-w-md">
          <p className="text-sm text-cyan-300 mb-1">Materializing: {uploadProgress}%</p>
          <div className="w-full bg-gray-700/50 rounded-full h-1.5 hud-element">
            <div className="bg-cyan-400 h-1.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
          </div>
          <p className="text-xs text-purple-400 mt-2 animate-pulse">Breaking down data into light particles...</p>
        </div>
      )}
      {uploadProgress === 100 && !isUploading && (
         <p className="mt-4 text-green-400 flex items-center"><CheckCircleIcon className="w-5 h-5 mr-2"/>Data-construct materialized.</p>
      )}
    </div>
  );
};

const PinEncryptionModule: React.FC<ModuleProps> = ({ onComplete, isActive }) => {
  const [stars, setStars] = useState<{ id: number; x: number; y: number }[]>([]);
  const [selectedStars, setSelectedStars] = useState<number[]>([]);
  const [pin, setPin] = useState<string>("");
  const [message, setMessage] = useState("Select 6 stars to form your Quantum Entanglement Key.");
  const requiredPinLength = 6;

  useEffect(() => {
    if (isActive) {
      const newStars = Array.from({ length: 15 }).map((_, i) => ({
        id: i,
        x: Math.random() * 90 + 5,
        y: Math.random() * 90 + 5,
      }));
      setStars(newStars);
      setSelectedStars([]);
      setPin("");
      setMessage(`Select ${requiredPinLength} stars to form your Quantum Entanglement Key.`);
    }
  }, [isActive]);

  const handleStarClick = (starId: number, starDigit: number) => {
    if (selectedStars.length < requiredPinLength && !selectedStars.includes(starId)) {
      const newSelectedStars = [...selectedStars, starId];
      setSelectedStars(newSelectedStars);
      setPin(prevPin => prevPin + starDigit.toString());

      if (newSelectedStars.length === requiredPinLength) {
        setMessage("Quantum Entanglement Key set!");
        setTimeout(onComplete, 1500);
      } else {
        setMessage(`${requiredPinLength - newSelectedStars.length} stars remaining.`);
      }
    }
  };
  
  const resetPin = () => {
    setSelectedStars([]);
    setPin("");
    setMessage(`Select ${requiredPinLength} stars to form your Quantum Entanglement Key.`);
  };

  if (!isActive) return null;

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-lg text-purple-300 mb-2">{message}</p>
      <div className="flex items-center justify-center mb-4 space-x-2">
        <p className="text-2xl font-mono tracking-widest text-cyan-300 border border-cyan-500/50 px-4 py-2 rounded hud-element">
          {pin.padEnd(requiredPinLength, '_')}
        </p>
        <button onClick={resetPin} title="Reset PIN" className="p-2 hud-element rounded hover:bg-cyan-500/30 transition-colors">
            <ArrowPathIcon className="w-6 h-6 text-cyan-400"/>
        </button>
      </div>
      <svg className="w-full max-w-lg h-72 border border-cyan-500/50 rounded-lg hud-element" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {selectedStars.length > 1 && selectedStars.slice(1).map((starId, index) => {
          const prevStar = stars.find(s => s.id === selectedStars[index]);
          const currentStar = stars.find(s => s.id === starId);
          if (!prevStar || !currentStar) return null;
          return (
            <line
              key={`constellation-line-${index}`}
              x1={prevStar.x} y1={prevStar.y}
              x2={currentStar.x} y2={currentStar.y}
              stroke="rgba(0, 255, 255, 0.5)" strokeWidth="0.3"
            />
          );
        })}
        {stars.map((star, index) => (
          <StarIcon
            key={star.id}
            filled={selectedStars.includes(star.id)}
            className={`absolute w-5 h-5 cursor-pointer transition-all duration-200 ease-in-out
                        ${selectedStars.includes(star.id) ? 'text-yellow-400 scale-125' : 'text-purple-400 hover:text-yellow-300 hover:scale-110'}`}
            style={{ left: `${star.x}%`, top: `${star.y}%`, transform: 'translate(-50%, -50%)' }}
            onClick={() => handleStarClick(star.id, (index % 9) + 1)}
          />
        ))}
      </svg>
    </div>
  );
};


const CalibrationSequence: React.FC<CalibrationSequenceProps> = ({ onClose, jumpToModule }) => {
  const [currentModule, setCurrentModule] = useState<CalibrationModule>(CalibrationModule.Authentication);
  const [completedModules, setCompletedModules] = useState<CalibrationModule[]>([]);
  const [voiceMessage, setVoiceMessage] = useState("Initializing calibration sequence...");
  const fractalTimelineRef = useRef<HTMLDivElement>(null);
  const hasSetInitialAuthVoiceLine = useRef(false);


  const moduleDetails: Record<CalibrationModule, { title: string; objective?: string; number: number }> = {
    [CalibrationModule.Authentication]: { title: "Identity Authentication", objective: "Authenticate Biometric Signature", number: 1 },
    [CalibrationModule.DocumentUpload]: { title: "Document Materialization", objective: "Materialize your first data-construct.", number: 2 },
    [CalibrationModule.PinEncryption]: { title: "Quantum Pin Encryption", objective: "Set your 6-digit quantum entanglement key.", number: 3 },
    [CalibrationModule.Completed]: { title: "Calibration Complete", number: 4 }, 
    [CalibrationModule.Intro]: { title: "Introduction", number: 0 },
  };
  
  useEffect(() => {
    if (jumpToModule !== undefined && jumpToModule !== currentModule) {
      setCurrentModule(jumpToModule);
      const modulesToComplete: CalibrationModule[] = [];
      if (jumpToModule === CalibrationModule.DocumentUpload) modulesToComplete.push(CalibrationModule.Authentication);
      if (jumpToModule === CalibrationModule.PinEncryption) modulesToComplete.push(CalibrationModule.Authentication, CalibrationModule.DocumentUpload);
      setCompletedModules(prev => [...new Set([...prev, ...modulesToComplete])]);
      hasSetInitialAuthVoiceLine.current = true; // If jumping past auth, assume initial line not needed.
    }
  }, [jumpToModule, currentModule]);

  useEffect(() => {
    switch (currentModule) {
      case CalibrationModule.Authentication:
        if (!completedModules.includes(CalibrationModule.Authentication) && !hasSetInitialAuthVoiceLine.current) {
             setVoiceMessage("Module 01: Identity Authentication. Please calibrate your input by tracing the biometric sigil.");
             hasSetInitialAuthVoiceLine.current = true;
        } else if (completedModules.includes(CalibrationModule.Authentication)) {
            // If returning to a completed auth module, perhaps a neutral message or module title.
            // For now, AuthenticationModule will handle its own retry messages.
        }
        break;
      case CalibrationModule.DocumentUpload:
        setVoiceMessage("Now, let's materialize your first data-construct into the vault.");
        break;
      case CalibrationModule.PinEncryption:
        setVoiceMessage("Secure your vault. Set your 6-digit quantum entanglement key.");
        break;
      case CalibrationModule.Completed:
        setVoiceMessage("Calibration successful. Your Quantum Vault is now synchronized and secure.");
        break;
      default:
        setVoiceMessage("Awaiting system input...");
        break;
    }
  }, [currentModule, completedModules]);
  
  const handleModuleComplete = useCallback(() => {
    setCompletedModules(prev => {
        const newCompleted = [...new Set([...prev, currentModule])];
        if (currentModule === CalibrationModule.Authentication) {
             setCurrentModule(CalibrationModule.DocumentUpload);
             hasSetInitialAuthVoiceLine.current = true; // Mark Auth as "passed" for voice line logic
        }
        else if (currentModule === CalibrationModule.DocumentUpload) setCurrentModule(CalibrationModule.PinEncryption);
        else if (currentModule === CalibrationModule.PinEncryption) setCurrentModule(CalibrationModule.Completed);
        return newCompleted;
    });
  }, [currentModule]);

  const getProgressPercentage = (completed: CalibrationModule[]): number => {
    if (completed.includes(CalibrationModule.PinEncryption)) return 100;
    if (completed.includes(CalibrationModule.DocumentUpload)) return 50; 
    if (completed.includes(CalibrationModule.Authentication)) return 15;
    return 0;
  };
  const progressPercentage = getProgressPercentage(completedModules);


  const jumpToTimelineSegment = (module: CalibrationModule) => {
     if (completedModules.includes(module) || module === CalibrationModule.Authentication || 
        (module === CalibrationModule.DocumentUpload && completedModules.includes(CalibrationModule.Authentication)) ||
        (module === CalibrationModule.PinEncryption && completedModules.includes(CalibrationModule.DocumentUpload))
     ) {
      setCurrentModule(module);
       if (module >= CalibrationModule.Authentication) {
         hasSetInitialAuthVoiceLine.current = true; // If jumping to or past Auth, mark initial voice as handled.
       }
     }
  };

  const fractalModules = [CalibrationModule.Authentication, CalibrationModule.DocumentUpload, CalibrationModule.PinEncryption];
  const currentModuleInfo = moduleDetails[currentModule];

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-3xl bg-slate-900/70 border border-cyan-600/50 rounded-xl shadow-2xl p-6 md:p-8 relative hud-element box-glow-cyan">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10">
          <XCircleIcon className="w-8 h-8"/>
        </button>

        <div className="text-center mb-2">
          <p className="text-sm text-cyan-400 tracking-wider">CALIBRATION PROTOCOL V2.8</p>
          <h1 className="text-4xl font-bold text-glow-blue">SYNAPSE CALIBRATION</h1>
        </div>

        <ProgressBar progress={progressPercentage} />
        
        <div className="min-h-[350px] md:min-h-[400px] flex flex-col justify-center">
            {currentModule !== CalibrationModule.Completed && currentModuleInfo && (
                 <ModuleHeader 
                    title={currentModuleInfo.title} 
                    moduleNumber={currentModuleInfo.number}
                    objective={currentModuleInfo.objective}
                 />
            )}
           
          <AuthenticationModule 
            isActive={currentModule === CalibrationModule.Authentication} 
            onComplete={handleModuleComplete}
            setVoiceMessage={setVoiceMessage} 
          />
          <DocumentUploadModule 
            isActive={currentModule === CalibrationModule.DocumentUpload} 
            onComplete={handleModuleComplete}
            setVoiceMessage={setVoiceMessage}
          />
          <PinEncryptionModule 
            isActive={currentModule === CalibrationModule.PinEncryption} 
            onComplete={handleModuleComplete} 
            setVoiceMessage={setVoiceMessage}
          />

          {currentModule === CalibrationModule.Completed && (
            <div className="text-center py-10">
              <CheckCircleIcon className="w-24 h-24 text-green-400 mx-auto mb-4 animate-pulse" />
              <h2 className="text-3xl font-bold text-glow-cyan mb-2">CALIBRATION COMPLETE</h2>
              <p className="text-lg text-purple-300">{voiceMessage}</p>
              <button 
                onClick={onClose}
                className="mt-8 px-6 py-3 bg-cyan-500 text-gray-900 font-bold rounded-lg hover:bg-cyan-400 transition-colors"
              >
                ACCESS VAULT
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 p-3 text-center hud-element rounded-md border-t border-cyan-500/30">
          <p className="text-sm text-purple-300 font-mono animate-pulse h-5">SYSTEM VOICE: <span className="text-cyan-300">{voiceMessage}</span></p>
        </div>

        <div ref={fractalTimelineRef} className="mt-6 pt-4 border-t border-cyan-700/50">
          <h3 className="text-center text-sm text-purple-300 mb-3 tracking-wider">FRACTAL TIMELINE</h3>
          <div className="flex justify-around items-center">
            {fractalModules.map((module, index) => {
              const moduleInfo = moduleDetails[module];
              const isClickable = completedModules.includes(module) || 
                                 module === CalibrationModule.Authentication ||
                                 (module === CalibrationModule.DocumentUpload && completedModules.includes(CalibrationModule.Authentication)) ||
                                 (module === CalibrationModule.PinEncryption && completedModules.includes(CalibrationModule.DocumentUpload));

              return (
              <React.Fragment key={module}>
                {index > 0 && <div className={`flex-grow h-0.5 ${completedModules.includes(fractalModules[index-1]) ? 'bg-cyan-400' : 'bg-gray-700'}`}></div>}
                <div 
                  onClick={() => isClickable && jumpToTimelineSegment(module)}
                  className={`relative p-2 ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'} group flex flex-col items-center transition-all duration-300
                              ${currentModule === module ? 'transform scale-110' : ''}`}
                >
                  <div className={`w-3 h-3 rounded-full border-2 
                                  ${completedModules.includes(module) ? 'bg-cyan-400 border-cyan-300' : 'bg-gray-600 border-gray-500'}
                                  ${currentModule === module ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-slate-900' : ''}
                                  ${isClickable ? 'hover:bg-cyan-300' : 'opacity-50'}
                                  transition-all`}>
                  </div>
                  <span className={`mt-1 text-xs 
                                   ${completedModules.includes(module) ? 'text-cyan-300' : 'text-gray-500'}
                                   ${isClickable ? 'group-hover:text-cyan-200' : ''}
                                   ${!isClickable ? 'opacity-50' : ''}
                                   `}>
                    M{moduleInfo.number} {CALIBRATION_MODULES_TIMESTAMPS[module as keyof typeof CALIBRATION_MODULES_TIMESTAMPS] || ''}
                  </span>
                   <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 bg-slate-800 text-xs text-purple-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {moduleInfo.title}
                    </div>
                </div>
              </React.Fragment>
            );})}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalibrationSequence;
