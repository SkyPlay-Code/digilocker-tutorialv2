import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { DocumentArrowUpIcon, CubeIcon } from './icons'; // Using CubeIcon as a placeholder for PDF

interface DocumentUploadModuleProps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  onSuccess: (object3D: THREE.Object3D) => void;
  onFailure: () => void;
}

type ModulePhase = 
  | 'idle' 
  | 'awaitingFile' 
  | 'deconstructingFileIcon' 
  | 'streamingToCore' 
  | 'reconstructingInCore' 
  | 'materialized' 
  | 'error';

interface ScreenParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  size: number;
  color: string;
  life: number;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const DocumentUploadModule: React.FC<DocumentUploadModuleProps> = ({ scene, camera, renderer, onSuccess, onFailure }) => {
  const [phase, setPhase] = useState<ModulePhase>('idle');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileType, setSelectedFileType] = useState<'pdf' | 'doc' | 'txt' | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [deconstructionParticles, setDeconstructionParticles] = useState<ScreenParticle[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const moduleContainerRef = useRef<HTMLDivElement>(null);
  const threeDParticleSystemRef = useRef<THREE.Points | null>(null);
  const reconstructedObjectRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    setPhase('awaitingFile');
  }, []);

  const getFileType = (fileName: string): 'pdf' | 'doc' | 'txt' | null => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') return 'pdf';
    if (extension === 'doc' || extension === 'docx') return 'doc';
    if (extension === 'txt') return 'txt';
    return null;
  };

  const handleFileSelectClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileType = getFileType(file.name);
      if (fileType) {
        setSelectedFileName(file.name);
        setSelectedFileType(fileType);
        setFeedbackMessage(null);
        setPhase('deconstructingFileIcon');
        console.log(`File selected: ${file.name}, type: ${fileType}`);
        console.log("Audio: SCANNING...");
      } else {
        setFeedbackMessage("Incompatible data format. Please select a .pdf, .doc(x), or .txt file.");
        setPhase('error');
        onFailure();
        console.log("Audio: ERROR SOUND");
        console.log("AI Voice: Upload failed. Incompatible data format. Please select a valid document.");
      }
    }
    // Reset file input value to allow selecting the same file again
    if (event.target) event.target.value = '';
  };
  
  // Phase: deconstructingFileIcon
  useEffect(() => {
    if (phase === 'deconstructingFileIcon' && moduleContainerRef.current) {
      const containerRect = moduleContainerRef.current.getBoundingClientRect();
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;
      const numParticles = 150;
      const newParticles: ScreenParticle[] = [];
      for (let i = 0; i < numParticles; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3;
        newParticles.push({
          id: generateId(),
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 0.5 - 2, // Bias upwards then stream "into" screen
          opacity: 1,
          size: Math.random() * 2 + 1,
          color: Math.random() > 0.3 ? 'rgba(0, 255, 255, 1)' : 'rgba(220, 220, 255, 1)',
          life: 100 + Math.random() * 50,
        });
      }
      setDeconstructionParticles(newParticles);

      setTimeout(() => {
        console.log("Audio: WHOOSH (Deconstruction Particles Firing)");
        setPhase('streamingToCore');
      }, 500); // Short delay after particle creation before "whoosh"
      
      const deconstructionTimer = setTimeout(() => {
         // Particles will fade out on their own. Main goal is to trigger next phase.
      }, 2000); // Total deconstruction duration
      return () => clearTimeout(deconstructionTimer);
    }
  }, [phase]);

  // Particle animation for deconstruction
  useEffect(() => {
    if (phase === 'deconstructingFileIcon' || deconstructionParticles.length > 0) {
      const animFrame = requestAnimationFrame(() => {
        setDeconstructionParticles(prevParticles =>
          prevParticles
            .map(p => ({
              ...p,
              x: p.x + p.vx,
              y: p.y + p.vy,
              opacity: Math.max(0, p.opacity - 0.02),
              life: p.life -1,
            }))
            .filter(p => p.opacity > 0 && p.life > 0)
        );
      });
      return () => cancelAnimationFrame(animFrame);
    }
  }, [deconstructionParticles, phase]);


  // Phase: streamingToCore (3D particle stream)
  useEffect(() => {
    if (phase === 'streamingToCore') {
      console.log("Audio: SWIRLING ENERGY (Particles arriving in 3D Core)");
      const particleCount = 500;
      const positions = new Float32Array(particleCount * 3);
      const geometry = new THREE.BufferGeometry();
      
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 0] = (Math.random() - 0.5) * 5;  // x
        positions[i * 3 + 1] = (Math.random() - 0.5) * 5;  // y
        positions[i * 3 + 2] = -50 - Math.random() * 20; // z (start far away)
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: 0x00FFFF,
        size: 0.15,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      });
      const particleSystem = new THREE.Points(geometry, material);
      threeDParticleSystemRef.current = particleSystem;
      scene.add(particleSystem);

      let startTime = Date.now();
      const animationDuration = 1500; // 1.5 seconds

      const animateStream = () => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / animationDuration, 1);

        if (threeDParticleSystemRef.current) {
          const currentPositions = threeDParticleSystemRef.current.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < particleCount; i++) {
            // Move particles towards origin (0,0,0)
            const initialZ = -50 - Math.random() * 20; // Re-fetch or store initial if complex path needed
            currentPositions[i * 3 + 2] = THREE.MathUtils.lerp(initialZ, 0, progress); // Lerp Z
             // Optional: Add swirling or pathing for X, Y
            currentPositions[i * 3 + 0] *= (1 - progress * 0.1); // Converge X slightly
            currentPositions[i * 3 + 1] *= (1 - progress * 0.1); // Converge Y slightly
          }
          threeDParticleSystemRef.current.geometry.attributes.position.needsUpdate = true;
          (threeDParticleSystemRef.current.material as THREE.PointsMaterial).opacity = 0.8 * (1 - progress * 0.5); // Fade slightly as they converge
        }

        if (progress < 1) {
          requestAnimationFrame(animateStream);
        } else {
          setPhase('reconstructingInCore');
        }
      };
      animateStream();

      return () => { // Cleanup 3D particles if component unmounts or phase changes prematurely
        if (threeDParticleSystemRef.current) {
          scene.remove(threeDParticleSystemRef.current);
          threeDParticleSystemRef.current.geometry.dispose();
          (threeDParticleSystemRef.current.material as THREE.Material).dispose();
          threeDParticleSystemRef.current = null;
        }
      };
    }
  }, [phase, scene]);

  // Phase: reconstructingInCore
  useEffect(() => {
    if (phase === 'reconstructingInCore' && selectedFileType) {
       // Clean up the 3D particle stream from previous phase
      if (threeDParticleSystemRef.current) {
        scene.remove(threeDParticleSystemRef.current);
        threeDParticleSystemRef.current.geometry.dispose();
        (threeDParticleSystemRef.current.material as THREE.Material).dispose();
        threeDParticleSystemRef.current = null;
      }

      console.log("Audio: SOLIDIFYING CHUNK/FORM (Object reconstruction)");
      let geometry: THREE.BufferGeometry;
      const material = new THREE.MeshStandardMaterial({
        color: 0x00BFFF,
        emissive: 0x0088AA,
        transparent: true,
        opacity: 0.85,
        roughness: 0.3,
        metalness: 0.1,
      });

      switch (selectedFileType) {
        case 'pdf':
          geometry = new THREE.BoxGeometry(2, 2, 2);
          break;
        case 'doc': // Scroll: represented by a slightly flattened cylinder
          geometry = new THREE.CylinderGeometry(0.5, 0.5, 3, 16);
          geometry.rotateX(Math.PI / 2); // Lay it flat
          geometry.scale(1, 1, 0.7); // Flatten it a bit
          break;
        case 'txt': // Data Slate: thin box
          geometry = new THREE.BoxGeometry(2, 3, 0.2);
          break;
        default:
          geometry = new THREE.SphereGeometry(1, 16, 16); // Fallback
      }
      
      const object = new THREE.Mesh(geometry, material);
      object.scale.set(0.01, 0.01, 0.01); // Start small
      scene.add(object);
      reconstructedObjectRef.current = object;

      let startTime = Date.now();
      const animationDuration = 2000; // 2 seconds

      const animateReconstruction = () => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / animationDuration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic

        if (reconstructedObjectRef.current) {
          const meshObject = reconstructedObjectRef.current as THREE.Mesh; // Cast to Mesh
          meshObject.scale.set(easedProgress, easedProgress, easedProgress);
          (meshObject.material as THREE.MeshStandardMaterial).opacity = 0.85 * easedProgress;
        }

        if (progress < 1) {
          requestAnimationFrame(animateReconstruction);
        } else {
          setPhase('materialized');
          if (reconstructedObjectRef.current) {
            // Pulse animation
             const originalScale = reconstructedObjectRef.current.scale.clone();
             reconstructedObjectRef.current.scale.multiplyScalar(1.2);
             setTimeout(() => {
                reconstructedObjectRef.current?.scale.copy(originalScale);
             }, 200);
            onSuccess(reconstructedObjectRef.current);
          }
        }
      };
      animateReconstruction();
    }
  }, [phase, selectedFileType, scene, onSuccess]);

  const renderFileIconForDeconstruction = () => {
    if (!selectedFileType) return null;
    let iconContent;
    switch (selectedFileType) {
        case 'pdf': iconContent = <CubeIcon className="w-16 h-16 text-cyan-300" />; break;
        case 'doc': iconContent = <span className="text-4xl text-cyan-300 font-bold">[DOC]</span>; break; // Placeholder
        case 'txt': iconContent = <span className="text-4xl text-cyan-300 font-bold">[TXT]</span>; break; // Placeholder
        default: return null;
    }
    return (
        <div className="absolute inset-0 flex items-center justify-center animate-fadeIn">
            {iconContent}
        </div>
    );
  };

  return (
    <div ref={moduleContainerRef} className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto">
      {phase === 'awaitingFile' && (
        <>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.txt" />
          <button
            onClick={handleFileSelectClick}
            className={`relative w-72 h-16 border font-exo2-regular text-lg text-white
                        rounded-full flex items-center justify-center overflow-hidden group
                        transition-all duration-300 ease-in-out
                        focus:outline-none bg-cyan-500/10 border-cyan-500 hover:bg-cyan-500/30 hover:border-cyan-300 hover:shadow-[0_0_15px_rgba(0,191,255,0.5)]
                        animate-fadeIn`}
            style={{ animationDelay: '0.5s' }}
          >
            <div className={`absolute inset-0 data-stream-button-shimmer group-hover:animate-data-stream-shimmer`}
                 style={{animationPlayState: 'paused'}} // Control shimmer if desired
            ></div>
             <DocumentArrowUpIcon className="w-6 h-6 mr-3"/>
            <span className="relative z-10">SELECT FILE</span>
          </button>
          {feedbackMessage && <p className="mt-4 text-red-400 text-sm animate-fadeIn">{feedbackMessage}</p>}
        </>
      )}

      {phase === 'deconstructingFileIcon' && (
         <div className="w-32 h-32 relative"> {/* Container for icon and particles */}
            {renderFileIconForDeconstruction()}
        </div>
      )}
      
      {/* 2D Deconstruction Particles */}
      {(phase === 'deconstructingFileIcon' || deconstructionParticles.length > 0) && deconstructionParticles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            opacity: p.opacity,
            transform: 'translate(-50%, -50%)',
            transition: 'opacity 0.1s linear', // For fading
          }}
        />
      ))}

      {phase === 'error' && (
        <>
          <button
            onClick={handleFileSelectClick} // Allow re-selection
            className={`relative w-72 h-16 border font-exo2-regular text-lg text-white
                        rounded-full flex items-center justify-center overflow-hidden group
                        transition-all duration-300 ease-in-out
                        focus:outline-none bg-red-500/30 border-red-500 hover:bg-red-500/50 hover:border-red-300 animate-pulse`}
          >
            <DocumentArrowUpIcon className="w-6 h-6 mr-3"/>
            <span className="relative z-10">SELECT FILE</span>
          </button>
          {feedbackMessage && <p className="mt-4 text-red-400 text-sm">{feedbackMessage}</p>}
        </>
      )}

    </div>
  );
};

export default DocumentUploadModule;