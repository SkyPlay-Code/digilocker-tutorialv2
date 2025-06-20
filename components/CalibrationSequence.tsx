import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CalibrationModule, KeyPoint } from '../types';
import { CALIBRATION_MODULES_TIMESTAMPS } from '../constants';
import { StarIcon, DocumentArrowUpIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon } from './icons';

interface CalibrationSequenceProps {
  onClose: () => void;
  jumpToModule?: CalibrationModule;
}

const TOTAL_MODULES = 3; // Authentication, DocumentUpload, PinEncryption

const ModuleHeader: React.FC<{ title: string; moduleNumber: number }> = ({ title, moduleNumber }) => (
  <div className="mb-6 text-center">
    <p className="text-sm text-cyan-400 tracking-widest">MODULE {String(moduleNumber).padStart(2, '0')}</p>
    <h2 className="text-3xl font-bold text-glow-cyan">{title}</h2>
  </div>
);

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="w-full bg-gray-700/50 rounded-full h-2.5 mb-8 hud-element">
    <div
      className="bg-cyan-400 h-2.5 rounded-full transition-all duration-500 ease-out"
      style={{ width: `${progress}%` }}
    ></div>
  </div>
);

// --- Module Components ---
interface ModuleProps {
  onComplete: () => void;
  isActive: boolean;
}

const AuthenticationModule: React.FC<ModuleProps> = ({ onComplete, isActive }) => {
  const [patternPoints, setPatternPoints] = useState<{ x: number; y: number; id: number }[]>([]);
  const [tracedPoints, setTracedPoints] = useState<number[]>([]);
  const [message, setMessage] = useState("Trace the biometric signature.");
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (isActive) {
      // Generate 5 random points for the pattern
      const points = Array.from({ length: 5 }).map((_, i) => ({
        x: Math.random() * 80 + 10, // % values for responsiveness
        y: Math.random() * 80 + 10,
        id: i
      }));
      setPatternPoints(points);
      setTracedPoints([]);
      setMessage("Trace the biometric signature by clicking the nodes in order.");
    }
  }, [isActive]);

  const handlePointClick = (id: number) => {
    if (tracedPoints.length === id) { // Must click in order
      const newTracedPoints = [...tracedPoints, id];
      setTracedPoints(newTracedPoints);
      if (newTracedPoints.length === patternPoints.length) {
        setMessage("SIGNATURE VERIFIED. AUTHENTICATION COMPLETE.");
        setTimeout(onComplete, 1500);
      } else {
        setMessage(`Node ${id+1} acquired. Awaiting next node...`);
      }
    } else {
      setMessage("Incorrect sequence. Resetting trace...");
      setTimeout(() => {
        setTracedPoints([]);
        setMessage("Trace the biometric signature by clicking the nodes in order.");
      }, 1500);
    }
  };

  if (!isActive) return null;

  return (
    <div className="flex flex-col items-center">
      <p className="text-lg text-purple-300 mb-4 text-center">{message}</p>
      <svg ref={svgRef} className="w-full max-w-md h-64 border border-cyan-500/50 rounded-lg hud-element" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Draw lines for traced path */}
        {tracedPoints.length > 1 && tracedPoints.slice(1).map((pointId, index) => {
          const prevPoint = patternPoints[tracedPoints[index]];
          const currentPoint = patternPoints[pointId];
          return (
            <line 
              key={`line-${index}`}
              x1={prevPoint.x} y1={prevPoint.y}
              x2={currentPoint.x} y2={currentPoint.y}
              stroke="#06b6d4" strokeWidth="0.5"
            />
          );
        })}
        {/* Draw pattern points */}
        {patternPoints.map((point, index) => (
          <circle
            key={point.id}
            cx={point.x}
            cy={point.y}
            r="2"
            fill={tracedPoints.includes(point.id) ? "#06b6d4" : "rgba(100,100,200,0.5)"}
            className={`cursor-pointer hover:fill-cyan-300 transition-colors ${tracedPoints.length === index ? 'animate-pulse' : ''}`}
            onClick={() => handlePointClick(point.id)}
          />
        ))}
      </svg>
    </div>
  );
};

const DocumentUploadModule: React.FC<ModuleProps> = ({ onComplete, isActive }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFileName(event.target.files[0].name);
      setIsUploading(true);
      setUploadProgress(0); // Reset progress

      // Simulate upload and materialization
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
      <p className="text-lg text-purple-300 mb-6">Materialize your first data-construct.</p>
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
         <p className="mt-4 text-green-400 flex items-center"><CheckCircleIcon className="w-5 h-5 mr-2"/>Data-construct materialized successfully.</p>
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
      setPin(prevPin => prevPin + starDigit.toString()); // Using starDigit (index+1) for PIN

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
        {/* Draw lines for constellation */}
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
        {/* Draw stars */}
        {stars.map((star, index) => (
          <StarIcon
            key={star.id}
            filled={selectedStars.includes(star.id)}
            className={`absolute w-5 h-5 cursor-pointer transition-all duration-200 ease-in-out
                        ${selectedStars.includes(star.id) ? 'text-yellow-400 scale-125' : 'text-purple-400 hover:text-yellow-300 hover:scale-110'}`}
            style={{ left: `${star.x}%`, top: `${star.y}%`, transform: 'translate(-50%, -50%)' }}
            onClick={() => handleStarClick(star.id, (index % 9) + 1)} // Use star's index for PIN digit
          />
        ))}
      </svg>
    </div>
  );
};


// --- Main Calibration Sequence Component ---
const CalibrationSequence: React.FC<CalibrationSequenceProps> = ({ onClose, jumpToModule }) => {
  const [currentModule, setCurrentModule] = useState<CalibrationModule>(CalibrationModule.Authentication);
  const [completedModules, setCompletedModules] = useState<CalibrationModule[]>([]);
  const [voiceMessage, setVoiceMessage] = useState("Initializing calibration sequence...");
  const fractalTimelineRef = useRef<HTMLDivElement>(null);

  const moduleTitles: Record<CalibrationModule, string> = {
    [CalibrationModule.Authentication]: "Identity Authentication",
    [CalibrationModule.DocumentUpload]: "Document Materialization",
    [CalibrationModule.PinEncryption]: "Quantum Pin Encryption",
    [CalibrationModule.Completed]: "Calibration Complete",
    [CalibrationModule.Intro]: "Introduction", // Not actively displayed as a module
  };
  
  useEffect(() => {
    if (jumpToModule !== undefined && jumpToModule !== currentModule) {
      setCurrentModule(jumpToModule);
      // Mark previous modules as complete for timeline jump
      const modulesToComplete: CalibrationModule[] = [];
      if (jumpToModule === CalibrationModule.DocumentUpload) modulesToComplete.push(CalibrationModule.Authentication);
      if (jumpToModule === CalibrationModule.PinEncryption) modulesToComplete.push(CalibrationModule.Authentication, CalibrationModule.DocumentUpload);
      setCompletedModules(prev => [...new Set([...prev, ...modulesToComplete])]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToModule]);

  useEffect(() => {
    // Simulate voice guidance
    switch (currentModule) {
      case CalibrationModule.Authentication:
        setVoiceMessage("Please authenticate your biometric signature to proceed.");
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
    }
  }, [currentModule]);
  
  const handleModuleComplete = useCallback(() => {
    setCompletedModules(prev => [...prev, currentModule]);
    if (currentModule === CalibrationModule.Authentication) setCurrentModule(CalibrationModule.DocumentUpload);
    else if (currentModule === CalibrationModule.DocumentUpload) setCurrentModule(CalibrationModule.PinEncryption);
    else if (currentModule === CalibrationModule.PinEncryption) setCurrentModule(CalibrationModule.Completed);
  }, [currentModule]);

  const progressPercentage = (completedModules.length / TOTAL_MODULES) * 100;

  const jumpToTimelineSegment = (module: CalibrationModule) => {
     if (completedModules.includes(module) || module === CalibrationModule.Authentication) { // Allow jumping to first or completed
      setCurrentModule(module);
     }
  };

  const fractalModules = [CalibrationModule.Authentication, CalibrationModule.DocumentUpload, CalibrationModule.PinEncryption];

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-3xl bg-slate-900/70 border border-cyan-600/50 rounded-xl shadow-2xl p-6 md:p-8 relative hud-element box-glow-cyan">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10">
          <XCircleIcon className="w-8 h-8"/>
        </button>

        <div className="text-center mb-4">
          <p className="text-sm text-cyan-400 tracking-wider">CALIBRATION PROTOCOL V2.7</p>
          <h1 className="text-4xl font-bold text-glow-blue">SYNAPSE CALIBRATION</h1>
        </div>

        <ProgressBar progress={progressPercentage} />
        
        <div className="min-h-[300px] md:min-h-[350px] flex flex-col justify-center">
            {currentModule !== CalibrationModule.Completed && (
                 <ModuleHeader title={moduleTitles[currentModule]} moduleNumber={
                    currentModule === CalibrationModule.Authentication ? 1 :
                    currentModule === CalibrationModule.DocumentUpload ? 2 : 3
                 } />
            )}
           
          <AuthenticationModule isActive={currentModule === CalibrationModule.Authentication} onComplete={handleModuleComplete} />
          <DocumentUploadModule isActive={currentModule === CalibrationModule.DocumentUpload} onComplete={handleModuleComplete} />
          <PinEncryptionModule isActive={currentModule === CalibrationModule.PinEncryption} onComplete={handleModuleComplete} />

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

        {/* HUD Voice Message */}
        <div className="mt-8 p-3 text-center hud-element rounded-md border-t border-cyan-500/30">
          <p className="text-sm text-purple-300 font-mono animate-pulse">SYSTEM VOICE: <span className="text-cyan-300">{voiceMessage}</span></p>
        </div>

        {/* Fractal Timeline */}
        <div ref={fractalTimelineRef} className="mt-8 pt-4 border-t border-cyan-700/50">
          <h3 className="text-center text-sm text-purple-300 mb-3 tracking-wider">FRACTAL TIMELINE</h3>
          <div className="flex justify-around items-center">
            {fractalModules.map((module, index) => (
              <React.Fragment key={module}>
                {index > 0 && <div className={`flex-grow h-0.5 ${completedModules.includes(fractalModules[index-1]) ? 'bg-cyan-400' : 'bg-gray-700'}`}></div>}
                <div 
                  onClick={() => jumpToTimelineSegment(module)}
                  className={`relative p-2 cursor-pointer group flex flex-col items-center transition-all duration-300
                              ${currentModule === module ? 'transform scale-110' : ''}`}
                >
                  <div className={`w-3 h-3 rounded-full border-2 
                                  ${completedModules.includes(module) ? 'bg-cyan-400 border-cyan-300' : 'bg-gray-600 border-gray-500'}
                                  ${currentModule === module ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-slate-900' : ''}
                                  ${(completedModules.includes(module) || module === CalibrationModule.Authentication) ? 'hover:bg-cyan-300' : 'cursor-not-allowed opacity-50'}
                                  transition-all`}>
                  </div>
                  <span className={`mt-1 text-xs 
                                   ${completedModules.includes(module) ? 'text-cyan-300' : 'text-gray-500'}
                                   ${(completedModules.includes(module) || module === CalibrationModule.Authentication) ? 'group-hover:text-cyan-200' : ''}
                                   `}>
                    M{index+1} {CALIBRATION_MODULES_TIMESTAMPS[module as keyof typeof CALIBRATION_MODULES_TIMESTAMPS] || ''}
                  </span>
                   <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 bg-slate-800 text-xs text-purple-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {moduleTitles[module]}
                    </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalibrationSequence;
