
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CalibrationModule, KeyPoint } from '../types';
import { CALIBRATION_MODULES_TIMESTAMPS } from '../constants';
import { StarIcon, DocumentArrowUpIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon } from './icons';

interface CalibrationSequenceProps {
  onClose: () => void;
  jumpToModule?: CalibrationModule;
}

// const TOTAL_MODULES = 3; // Authentication, DocumentUpload, PinEncryption. Used for old progress calc.

const ModuleHeader: React.FC<{ title: string; moduleNumber: number, objective?: string }> = ({ title, moduleNumber, objective }) => (
  <div className="mb-4 text-center">
    <p className="text-sm text-cyan-400 tracking-widest">MODULE {String(moduleNumber).padStart(2, '0')}</p>
    <h2 className="text-3xl font-bold text-glow-cyan">{title}</h2>
    {objective && <p className="text-md text-purple-300 mt-1">{objective}</p>}
  </div>
);

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="w-full bg-gray-700/50 rounded-full h-2.5 mb-6 hud-element">
    <div
      className="bg-cyan-400 h-2.5 rounded-full transition-all duration-500 ease-out"
      style={{ width: `${progress}%` }}
    ></div>
    <div className="absolute -top-5 right-0 text-xs text-cyan-300 font-mono">SYNC: {progress.toFixed(0)}%</div>
  </div>
);

// --- Module Props Interface ---
interface ModuleProps {
  onComplete: () => void;
  isActive: boolean;
  setVoiceMessage: (message: string) => void; // Allow module to request voice messages
}

// --- NEW AuthenticationModule (Sigil Trace) ---
const AuthenticationModule: React.FC<ModuleProps> = ({ onComplete, isActive, setVoiceMessage: setParentVoiceMessage }) => {
  const SIGIL_NODES = [
    { id: 0, x: 20, y: 50, isStart: true },
    { id: 1, x: 40, y: 25 },
    { id: 2, x: 75, y: 35 },
    { id: 3, x: 65, y: 75 },
    { id: 4, x: 30, y: 70, isEnd: true },
  ];
  const TIME_LIMIT = 7; // seconds
  const TRACE_TOLERANCE = 3; // pixels from line

  const [status, setStatus] = useState<'idle' | 'materializing' | 'awaitingTrace' | 'tracing' | 'success' | 'failed' | 'resetting'>('idle');
  const [tracedSegments, setTracedSegments] = useState<boolean[]>(new Array(SIGIL_NODES.length - 1).fill(false));
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [showSigil, setShowSigil] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const attemptRef = useRef(0); // To handle initial voice line vs retry

  const resetState = useCallback((isRetry = false) => {
    setStatus('materializing');
    setTracedSegments(new Array(SIGIL_NODES.length - 1).fill(false));
    setCurrentNodeIndex(0);
    setTimeLeft(TIME_LIMIT);
    setFeedbackText(null);
    setShowSigil(false); // Will be set to true after materialization
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (isRetry) {
      setParentVoiceMessage("Re-calibrating. Please try again.");
    } else if (attemptRef.current === 0) {
      // This voice line is set by parent when module becomes active for the first time
    }
    attemptRef.current += 1;

    // Stagger materialization after voice line
    setTimeout(() => {
        setShowSigil(true); // Trigger line drawing animation
        // Line drawing animation is 1s, then start timer
        setTimeout(() => {
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
        }, 1000); // Duration of line drawing animation
    }, isRetry ? 1500 : 500); // Shorter delay if not first attempt's voice line. First attempt voice handled by parent.
  }, [setParentVoiceMessage]);

  useEffect(() => {
    if (isActive) {
      resetState(attemptRef.current > 0);
    } else {
      setStatus('idle');
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setShowSigil(false);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);


  const getLocalCoordinates = (event: React.MouseEvent): { x: number, y: number } | null => {
    if (!svgRef.current) return null;
    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return null;
    const localPoint = svgPoint.matrixTransform(CTM.inverse());
    return { x: localPoint.x, y: localPoint.y };
  };

  const distanceToLineSegment = (p: {x:number, y:number}, v: {x:number, y:number}, w: {x:number, y:number}) => {
    const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
    if (l2 === 0) return Math.sqrt((p.x - v.x)**2 + (p.y - v.y)**2);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return Math.sqrt((p.x - projection.x)**2 + (p.y - projection.y)**2);
  };


  const handleMouseDown = (event: React.MouseEvent, nodeId: number) => {
    if (status !== 'awaitingTrace' && status !== 'tracing') return;
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

    if (!endNode) return; // Should not happen if logic is correct

    const distToSegment = distanceToLineSegment(coords, startNode, endNode);
    if (distToSegment > TRACE_TOLERANCE) {
      handleFailure('fail_path');
      return;
    }

    // Check if cursor is near the endNode of the current segment
    const distToEndNode = Math.sqrt((coords.x - endNode.x)**2 + (coords.y - endNode.y)**2);
    if (distToEndNode < 3) { // Consider node vicinity as 'reached'
      const newTracedSegments = [...tracedSegments];
      newTracedSegments[currentNodeIndex] = true;
      setTracedSegments(newTracedSegments);
      setCurrentNodeIndex(prev => prev + 1);

      if (currentNodeIndex + 1 === SIGIL_NODES.length -1) { // Reached the start of the last segment (approaching final node)
        // User still needs to trace to the final node and release
      }
    }
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    if (status !== 'tracing') return;
    setCursorPos(null); // Hide custom cursor

    const finalNode = SIGIL_NODES[SIGIL_NODES.length - 1];
    const coords = getLocalCoordinates(event);

    if (coords && currentNodeIndex === SIGIL_NODES.length - 1 && // All segments should be conceptually traced
        tracedSegments.every(s => s === true) &&
        Math.sqrt((coords.x - finalNode.x)**2 + (coords.y - finalNode.y)**2) < 4 // Released on final node
    ) {
      handleSuccess();
    } else {
      handleFailure('fail_release');
    }
  };
  
  const handleMouseLeave = () => {
    if (status === 'tracing') {
        setCursorPos(null);
        handleFailure('fail_path'); // Or 'fail_release'
    }
  };

  const handleSuccess = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setStatus('success');
    setFeedbackText("SIGNATURE VERIFIED");
    // Play success chime (conceptual)
    setTimeout(() => {
      setShowSigil(false); // Dissolve animation
      setFeedbackText(null);
      setTimeout(onComplete, 1000); // Delay before calling onComplete
    }, 1500);
  };

  const handleFailure = (reason: 'fail_path' | 'fail_release' | 'fail_time') => {
    if (status === 'failed' || status === 'success' || status === 'resetting') return; // Prevent multiple failure calls
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setStatus('failed');
    setCursorPos(null);
    setFeedbackText("SIGNATURE CORRUPTED. RE-ATTEMPTING...");
    // Play error sound (conceptual)
    setTimeout(() => {
        setFeedbackText(null); // Clear message
        setStatus('resetting');
        resetState(true); // Trigger reset with retry voice line
    }, 2500); // Glitch/message display time
  };

  if (!isActive) return null;

  const getLineStatusColor = (index: number) => {
    if (status === 'failed') return "stroke-red-500";
    if (status === 'success' || tracedSegments[index]) return "stroke-green-400"; // #00FF7F
    return "stroke-blue-500"; // #00BFFF
  };
  
  const getNodeStatusColor = (nodeId: number) => {
    if (status === 'failed') return "fill-red-500";
    if (status === 'success') return "fill-green-400";
    if (nodeId < currentNodeIndex || (nodeId === currentNodeIndex && tracedSegments[nodeId-1])) return "fill-green-400";
    if (nodeId === SIGIL_NODES[currentNodeIndex].id && (status === 'awaitingTrace' || status === 'tracing')) return "fill-cyan-300 animate-pulse"; // Pulsing current/next node
    return "fill-blue-500";
  };

  const timerPath = () => {
    const angle = (timeLeft / TIME_LIMIT) * 360;
    const radius = 40;
    const x = 50 + radius * Math.cos(Math.PI/2 - (angle * Math.PI / 180));
    const y = 50 - radius * Math.sin(Math.PI/2 - (angle * Math.PI / 180));
    const largeArcFlag = angle > 180 ? 1 : 0;
    if (angle === 0) return ""; // No arc if time is up
    if (angle >= 360) return `M 50,10 A ${radius},${radius} 0 1 1 49.99,10 Z`; // Full circle slightly broken to render
    return `M 50,10 A ${radius},${radius} 0 ${largeArcFlag} 1 ${x},${y}`;
  };


  return (
    <div className={`flex flex-col items-center relative ${status === 'tracing' ? 'cursor-none' : ''}`} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
       <svg ref={svgRef} viewBox="0 0 100 100" className={`w-full max-w-md h-72 transition-opacity duration-500 ease-in-out hud-element border border-cyan-700/30 rounded-lg 
        ${(status === 'failed' && feedbackText) ? 'animate-[shake_0.5s_ease-in-out]' : ''}
        ${showSigil ? 'opacity-100' : 'opacity-0'}`}
        style={{ animationIterationCount: (status === 'failed' && feedbackText) ? '1' : undefined }}
       >
        {/* Timer */}
        { (status === 'awaitingTrace' || status === 'tracing') &&
            <path d={timerPath()} strokeWidth="3" stroke="#8B5CF6" fill="none" className="transition-all duration-200" />
        }

        {/* Sigil Lines */}
        {SIGIL_NODES.slice(0, -1).map((node, index) => {
          const nextNode = SIGIL_NODES[index + 1];
          return (
            <line
              key={`line-${index}`}
              x1={node.x} y1={node.y}
              x2={nextNode.x} y2={nextNode.y}
              className={`${getLineStatusColor(index)} transition-all duration-300`}
              strokeWidth="1"
              style={{
                strokeDasharray: status === 'materializing' ? '100' : 'none',
                strokeDashoffset: status === 'materializing' ? (showSigil ? 0 : 100) : 0,
                animation: status === 'materializing' ? `draw-line 1s ease-out ${index * 0.15}s forwards` : 'none',
                opacity: (status === 'materializing' && !showSigil) ? 0 : 1, // Start hidden then draw
              }}
            />
          );
        })}

        {/* Sigil Nodes */}
        {SIGIL_NODES.map(node => (
          <circle
            key={`node-${node.id}`}
            cx={node.x} cy={node.y} r="2.5"
            className={`${getNodeStatusColor(node.id)} transition-colors duration-300 ${(node.isStart && (status === 'awaitingTrace' || status === 'tracing')) ? 'cursor-pointer' : ''}`}
            onMouseDown={(e) => (node.isStart && currentNodeIndex === 0) ? handleMouseDown(e, node.id) : null}
             style={{
                animation: (status === 'materializing' && showSigil) ? `fade-in 0.5s ease-out ${node.id * 0.15 + 0.5}s forwards` : 'none',
                opacity: (status === 'materializing' && !showSigil) ? 0 : 1,
            }}
          />
        ))}

        {/* Feedback Text */}
        {feedbackText && (
          <text x="50" y="50" textAnchor="middle" dominantBaseline="middle"
            className={`font-orbitron text-5xl transition-opacity duration-300 ease-in-out
                        ${status === 'success' ? 'fill-green-400 text-glow-green' : ''}
                        ${status === 'failed' ? 'fill-red-500 text-glow-red' : ''}
                        ${(status === 'success' || status === 'failed') && !showSigil ? 'opacity-0' : 'opacity-100' }`} // For dissolve
          >
            {feedbackText.split('.')[0]}
          </text>
        )}
         {feedbackText && feedbackText.includes("RE-ATTEMPTING") && (
            <text x="50" y="60" textAnchor="middle" dominantBaseline="middle"
                className={`font-orbitron text-2xl fill-red-400 transition-opacity duration-300 ease-in-out
                            ${(status === 'success' || status === 'failed') && !showSigil ? 'opacity-0' : 'opacity-100' }`}
            >
                RE-ATTEMPTING...
            </text>
         )}
         {/* Custom cursor dot */}
        {status === 'tracing' && cursorPos && (
            <circle cx={cursorPos.x} cy={cursorPos.y} r="1.5" fill="#00FF7F" className="pointer-events-none drop-shadow-[0_0_3px_#00FF7F]" />
        )}
      </svg>
      <style>{`
        @keyframes draw-line {
          from { stroke-dashoffset: 100; opacity: 0; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
          20%, 40%, 60%, 80% { transform: translateX(3px); }
        }
        .text-glow-green {
          text-shadow: 0 0 5px rgba(0,255,127,0.7), 0 0 10px rgba(0,255,127,0.5);
        }
        .text-glow-red {
          text-shadow: 0 0 5px rgba(255,0,0,0.7), 0 0 10px rgba(255,0,0,0.5);
        }
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
      setUploadProgress(0); // Reset progress

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
      {/* Objective text is now part of ModuleHeader */}
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

  const moduleDetails: Record<CalibrationModule, { title: string; objective?: string; number: number }> = {
    [CalibrationModule.Authentication]: { title: "Identity Authentication", objective: "Authenticate Biometric Signature", number: 1 },
    [CalibrationModule.DocumentUpload]: { title: "Document Materialization", objective: "Materialize your first data-construct.", number: 2 },
    [CalibrationModule.PinEncryption]: { title: "Quantum Pin Encryption", objective: "Set your 6-digit quantum entanglement key.", number: 3 },
    [CalibrationModule.Completed]: { title: "Calibration Complete", number: 4 }, // Not displayed as a regular module
    [CalibrationModule.Intro]: { title: "Introduction", number: 0 },
  };
  
  useEffect(() => {
    if (jumpToModule !== undefined && jumpToModule !== currentModule) {
      setCurrentModule(jumpToModule);
      const modulesToComplete: CalibrationModule[] = [];
      if (jumpToModule === CalibrationModule.DocumentUpload) modulesToComplete.push(CalibrationModule.Authentication);
      if (jumpToModule === CalibrationModule.PinEncryption) modulesToComplete.push(CalibrationModule.Authentication, CalibrationModule.DocumentUpload);
      setCompletedModules(prev => [...new Set([...prev, ...modulesToComplete])]);
    }
  }, [jumpToModule, currentModule]);

  useEffect(() => {
    switch (currentModule) {
      case CalibrationModule.Authentication:
        // Set initial voice message for Module 1, allowing module to handle retries
        if (!completedModules.includes(CalibrationModule.Authentication)) { // Only set initial if not already passed/retrying
             setVoiceMessage("Module 01: Identity Authentication. Please calibrate your input by tracing the biometric sigil.");
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
        if (currentModule === CalibrationModule.Authentication) setCurrentModule(CalibrationModule.DocumentUpload);
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
          <p className="text-sm text-cyan-400 tracking-wider">CALIBRATION PROTOCOL V2.8</p> {/* Version bump */}
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
