
import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CalibrationModule as CalibrationModuleEnum, TimelineModuleConfig } from '../types'; 
import { LogoIcon } from './icons'; 
import AuthenticationSigil from './AuthenticationSigil';
import DocumentUploadModule from './DocumentUploadModule';
import PinEncryptionModule from './PinEncryptionModule';
import FractalTimeline from './FractalTimeline';

interface CalibrationSequenceProps {
  onClose: () => void;
  jumpToModule?: CalibrationModuleEnum;
}

const HUDText: React.FC<{ text: string; delay?: number, className?: string }> = ({ text, delay = 0, className="" }) => {
  return (
    <p className={`font-roboto-mono text-cyan-400 ${className}`} style={{ textShadow: '0 0 3px rgba(0,255,255,0.7), 0 0 5px rgba(0,255,255,0.5)'}}>
      {text.split("").map((char, index) => (
        <span
          key={index}
          className="hud-char-flicker"
          style={{ animationDelay: `${delay + index * 0.03}s` }}
        >
          {char}
        </span>
      ))}
    </p>
  );
};

const TIMELINE_MODULE_CONFIGS: TimelineModuleConfig[] = [
  { id: CalibrationModuleEnum.Authentication, label: "Module 01: Identity Auth", progressAtStart: 0 },
  { id: CalibrationModuleEnum.DocumentUpload, label: "Module 02: Data Materialization", progressAtStart: 15 },
  { id: CalibrationModuleEnum.PinEncryption, label: "Module 03: Quantum PIN Encryption", progressAtStart: 30 },
  { id: CalibrationModuleEnum.Completed, label: "Calibration Complete", progressAtStart: 50 },
];


const CalibrationSequence: React.FC<CalibrationSequenceProps> = ({ onClose, jumpToModule }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const dataCometsRef = useRef<THREE.Points | null>(null);
  const gridsRef = useRef<THREE.GridHelper[]>([]);
  const clockRef = useRef(new THREE.Clock());
  const mousePosRef = useRef({ x: 0, y: 0 });

  const [hudBooted, setHudBooted] = useState(false);
  const [currentLoadedModule, setCurrentLoadedModule] = useState<CalibrationModuleEnum | null>(null);
  const [completedModuleIds, setCompletedModuleIds] = useState<CalibrationModuleEnum[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [currentObjectiveText, setCurrentObjectiveText] = useState("");
  const [materializedObjects, setMaterializedObjects] = useState<THREE.Object3D[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const [isDataCoreVisible, setIsDataCoreVisible] = useState(true);
  const pinConstellationRef = useRef<THREE.Group | null>(null);
  const authSigilRef = useRef<{ reset: () => void } | null>(null); // For resetting sigil


  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    console.log("CalibrationSequence: Initializing Data Core scene.");

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000); 
    camera.position.set(0, 0, 0.1); 
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0); 
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const gridSize = 100;
    const gridDivisions = 10;
    const localGrids: THREE.GridHelper[] = [];
    const createGridPlane = (size: number, divisions: number, color1: THREE.ColorRepresentation, color2: THREE.ColorRepresentation) => {
        const grid = new THREE.GridHelper(size, divisions, color1, color2);
        (grid.material as THREE.Material).opacity = 0.25;
        (grid.material as THREE.Material).transparent = true;
        (grid.material as THREE.Material).blending = THREE.AdditiveBlending;
        (grid.material as THREE.Material).depthWrite = false;
        return grid;
    }

    const wallDist = gridSize / 2;
    const gridFront = createGridPlane(gridSize, gridDivisions, 0x0088ff, 0x00ffff); gridFront.position.z = -wallDist; localGrids.push(gridFront); scene.add(gridFront);
    const gridBack = createGridPlane(gridSize, gridDivisions, 0x0088ff, 0x00ffff); gridBack.position.z = wallDist; gridBack.rotation.x = Math.PI; localGrids.push(gridBack); scene.add(gridBack);
    const gridTop = createGridPlane(gridSize, gridDivisions, 0x0088ff, 0x00ffff); gridTop.position.y = wallDist; gridTop.rotation.x = Math.PI / 2; localGrids.push(gridTop); scene.add(gridTop);
    const gridBottom = createGridPlane(gridSize, gridDivisions, 0x0088ff, 0x00ffff); gridBottom.position.y = -wallDist; gridBottom.rotation.x = -Math.PI / 2; localGrids.push(gridBottom); scene.add(gridBottom);
    const gridLeft = createGridPlane(gridSize, gridDivisions, 0x0088ff, 0x00ffff); gridLeft.position.x = -wallDist; gridLeft.rotation.y = Math.PI / 2; localGrids.push(gridLeft); scene.add(gridLeft);
    const gridRight = createGridPlane(gridSize, gridDivisions, 0x0088ff, 0x00ffff); gridRight.position.x = wallDist; gridRight.rotation.y = -Math.PI / 2; localGrids.push(gridRight); scene.add(gridRight);
    gridsRef.current = localGrids;
    
    const spaceMaterial = new THREE.MeshBasicMaterial({ color: 0x050510, side: THREE.BackSide });
    const spaceSphere = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 32), spaceMaterial);
    scene.add(spaceSphere);

    const particleCount = 300;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * gridSize * 1.5;
      positions[i * 3 + 1] = (Math.random() - 0.5) * gridSize * 1.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * gridSize * 1.5;
      velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.05;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    const particleMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    const dataComets = new THREE.Points(particleGeometry, particleMaterial);
    dataCometsRef.current = dataComets;
    scene.add(dataComets);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(currentMount.clientWidth, currentMount.clientHeight), 0.4, 0.5, 0.1);
    composer.addPass(bloomPass);
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
    composerRef.current = composer;
    
    const handleMouseMove = (event: MouseEvent) => {
        if (currentLoadedModule === CalibrationModuleEnum.PinEncryption && isDataCoreVisible === false) return; 
        mousePosRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
        mousePosRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      if(!cameraRef.current || !composerRef.current || !sceneRef.current) return;

      if (currentLoadedModule !== CalibrationModuleEnum.PinEncryption || isDataCoreVisible) {
        cameraRef.current.rotation.y += (mousePosRef.current.x * 0.05 - cameraRef.current.rotation.y) * 0.05; 
        cameraRef.current.rotation.x += (-mousePosRef.current.y * 0.05 - cameraRef.current.rotation.x) * 0.05;
      }
      
      if (isDataCoreVisible) {
        if(dataCometsRef.current) {
            const cometPositions = dataCometsRef.current.geometry.attributes.position.array as Float32Array;
            const cometVelocities = dataCometsRef.current.geometry.attributes.velocity.array as Float32Array;
            for (let i = 0; i < particleCount; i++) {
                cometPositions[i * 3 + 0] += cometVelocities[i * 3 + 0];
                cometPositions[i * 3 + 1] += cometVelocities[i * 3 + 1];
                cometPositions[i * 3 + 2] += cometVelocities[i * 3 + 2];
                if (Math.abs(cometPositions[i*3+0]) > gridSize * 0.75) cometVelocities[i*3+0] *= -1;
                if (Math.abs(cometPositions[i*3+1]) > gridSize * 0.75) cometVelocities[i*3+1] *= -1;
                if (Math.abs(cometPositions[i*3+2]) > gridSize * 0.75) cometVelocities[i*3+2] *= -1;
            }
            dataCometsRef.current.geometry.attributes.position.needsUpdate = true;
        }
        gridsRef.current.forEach(g => g.rotation.y += 0.0001); 
        materializedObjects.forEach(obj => {
            obj.rotation.y += 0.003; 
            obj.rotation.x += 0.001;
            obj.rotation.z += 0.0005;
        });
        if(pinConstellationRef.current) {
            pinConstellationRef.current.rotation.y += 0.0002;
            pinConstellationRef.current.rotation.x -= 0.0001;
        }
      }
      // Render Data Core scene if visible OR if PinEncryption module is not fully active yet (e.g. during its own fade in)
      if (isDataCoreVisible || (currentLoadedModule === CalibrationModuleEnum.PinEncryption && sceneRef.current.visible)) {
         composerRef.current.render(clockRef.current.getDelta());
      }
    };
    animate();

    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current || !composerRef.current || !mountRef.current) return;
      cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      composerRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    setTimeout(() => {
      setHudBooted(true);
      console.log("AI Voice: Calibration sequence initiated. Welcome.");
       const initialModule = jumpToModule ?? CalibrationModuleEnum.Authentication;
       if (jumpToModule) { // If jumping, mark all previous modules as completed
            const jumpedModuleIndex = TIMELINE_MODULE_CONFIGS.findIndex(m => m.id === jumpToModule);
            if (jumpedModuleIndex > -1) {
                setCompletedModuleIds(TIMELINE_MODULE_CONFIGS.slice(0, jumpedModuleIndex).map(m => m.id));
            }
        }
        loadModule(initialModule);
    }, 500);

    return () => {
      if(animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      
      if(rendererRef.current) rendererRef.current.dispose();
      sceneRef.current?.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.GridHelper || child instanceof THREE.LineSegments || child instanceof THREE.Line) {
          child.geometry.dispose();
          const material = (child as THREE.Mesh | THREE.Points | THREE.GridHelper | THREE.LineSegments | THREE.Line).material;
          if (Array.isArray(material)) {
            material.forEach(mat => mat.dispose());
          } else if (material) {
            (material as THREE.Material).dispose();
          }
        }
      });
      if (mountRef.current && rendererRef.current?.domElement) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      console.log("CalibrationSequence: Data Core scene cleaned up.");
    };
  }, [jumpToModule]); // jumpToModule dependency

  // Handle visibility of Data Core elements
  useEffect(() => {
    if(sceneRef.current) sceneRef.current.visible = isDataCoreVisible;
  }, [isDataCoreVisible]);


  useEffect(() => {
    materializedObjects.forEach(obj => {
        if (obj && sceneRef.current && !sceneRef.current?.children.includes(obj)) {
            sceneRef.current?.add(obj);
        }
    });
    return () => {
        materializedObjects.forEach(obj => {
            sceneRef.current?.remove(obj);
        });
    };
  }, [materializedObjects]);

  const loadModule = (module: CalibrationModuleEnum) => {
    setCurrentLoadedModule(module);
    const moduleConfig = TIMELINE_MODULE_CONFIGS.find(m => m.id === module);
    
    if (moduleConfig) {
        setSyncProgress(moduleConfig.progressAtStart);
        setCurrentObjectiveText(`CURRENT OBJECTIVE: ${moduleConfig.label.replace(/Module \d+: /,'')}`);
    } else if (module === CalibrationModuleEnum.Authentication) { // Fallback for initial load if not in TIMELINE_MODULE_CONFIGS (e.g. Intro)
        setSyncProgress(0);
        setCurrentObjectiveText("CURRENT OBJECTIVE: Authenticate Biometric Signature");
    }

    switch (module) {
        case CalibrationModuleEnum.Authentication:
            console.log("AI Voice: Module 01: Identity Authentication. Please calibrate your input by tracing the biometric sigil.");
            setIsDataCoreVisible(true);
            authSigilRef.current?.reset(); // Reset sigil if rewinding to it
            break;
        case CalibrationModuleEnum.DocumentUpload:
             console.log("AI Voice: Module 02: Document Materialization. Please select a data-construct for upload.");
            setIsDataCoreVisible(true);
            break;
        case CalibrationModuleEnum.PinEncryption:
            console.log("AI Voice: Module 03: Quantum Pin Encryption. Create your key by selecting six stars to form a unique constellation.");
            setIsDataCoreVisible(false); 
            break;
        case CalibrationModuleEnum.Completed:
            setSyncProgress(100); // Override for completion
            setCurrentObjectiveText("ALL SYSTEMS CALIBRATED. QUANTUM VAULT ONLINE.");
            console.log("AI Voice: Calibration complete. Quantum Vault systems nominal.");
            setIsDataCoreVisible(true);
            break;
    }
  };

  const addCompletedModule = (moduleId: CalibrationModuleEnum) => {
    setCompletedModuleIds(prev => {
        if (prev.includes(moduleId)) return prev;
        // Ensure modules are added in order according to TIMELINE_MODULE_CONFIGS
        const newCompleted = [...prev, moduleId];
        const sorted = TIMELINE_MODULE_CONFIGS
            .filter(config => newCompleted.includes(config.id))
            .map(config => config.id);
        return sorted;
    });
  };

  const handleAuthenticationSuccess = useCallback(() => {
    console.log("Authentication successful!");
    addCompletedModule(CalibrationModuleEnum.Authentication);
    const nextModuleConfig = TIMELINE_MODULE_CONFIGS.find(m => m.id === CalibrationModuleEnum.DocumentUpload);
    if(nextModuleConfig) setSyncProgress(nextModuleConfig.progressAtStart);
    setCurrentObjectiveText("BIOMETRIC SIGNATURE VERIFIED");
    console.log("AI Voice: Signature Verified. Module 01 complete.");
    setTimeout(() => {
        loadModule(CalibrationModuleEnum.DocumentUpload);
    }, 1500);
  }, []);

  const handleAuthenticationRetryPrompt = useCallback(() => {
    console.log("AI Voice: Re-calibrating. Please try again.");
  }, []);

  const handleDocumentUploadSuccess = useCallback((newObject: THREE.Object3D) => {
    console.log("Document Materialization successful!");
    addCompletedModule(CalibrationModuleEnum.DocumentUpload);
    setMaterializedObjects(prev => [...prev.filter(o => o.uuid !== newObject.uuid), newObject]);
    const nextModuleConfig = TIMELINE_MODULE_CONFIGS.find(m => m.id === CalibrationModuleEnum.PinEncryption);
    if(nextModuleConfig) setSyncProgress(nextModuleConfig.progressAtStart);
    setCurrentObjectiveText("DATA-CONSTRUCT FORGED & MATERIALIZED"); 
    console.log("AI Voice: Data-construct received and materialized.");
    setTimeout(() => {
        loadModule(CalibrationModuleEnum.PinEncryption);
    }, 2000);
  }, []);

  const handleDocumentUploadFailure = useCallback(() => {
    console.log("Document Materialization failed.");
    // Potentially allow retry or skip
  }, []);

  const handlePinSetSuccess = useCallback((constellationGroupFromModule: THREE.Group) => {
    console.log("AI Voice: Entanglement key registered. Your constellation is now your signature.");
    addCompletedModule(CalibrationModuleEnum.PinEncryption);
    const nextModuleConfig = TIMELINE_MODULE_CONFIGS.find(m => m.id === CalibrationModuleEnum.Completed);
    if(nextModuleConfig) setSyncProgress(nextModuleConfig.progressAtStart);
    setCurrentObjectiveText("QUANTUM ENTANGLEMENT KEY REGISTERED");
    
    if (pinConstellationRef.current && sceneRef.current) { 
        sceneRef.current.remove(pinConstellationRef.current);
        pinConstellationRef.current.traverse(child => { /* dispose geometry/material */ });
    }
    
    constellationGroupFromModule.traverse(child => {
        const obj = child as THREE.Mesh | THREE.Line;
        if (obj.material) {
            const material = obj.material as THREE.Material; 
            material.transparent = true;
            material.opacity = 0.20; 
            if (material instanceof THREE.LineBasicMaterial || material instanceof THREE.MeshBasicMaterial) {
                 material.color.multiplyScalar(0.7); 
            }
        }
    });
    constellationGroupFromModule.scale.set(0.07, 0.07, 0.07); 
    constellationGroupFromModule.position.set(2, -3, -10); 
    constellationGroupFromModule.rotation.set(Math.PI / 8, Math.PI / 4, 0);

    pinConstellationRef.current = constellationGroupFromModule;
    if (sceneRef.current) sceneRef.current.add(pinConstellationRef.current);
    setIsDataCoreVisible(true); 

    setTimeout(() => {
      loadModule(CalibrationModuleEnum.Completed);
    }, 2000);
  }, []);
  
  const handlePinReset = useCallback(() => {
      console.log("AI Voice: Clearing sequence. Please select a new constellation.");
  }, []);

  const handleRewindToModule = useCallback((moduleId: CalibrationModuleEnum) => {
    console.log(`Rewinding to Module: ${moduleId}`);
    console.log("Audio: REWIND SOUND (reversed whoosh)");
    
    const targetModuleConfig = TIMELINE_MODULE_CONFIGS.find(m => m.id === moduleId);
    if (!targetModuleConfig) return;

    console.log(`AI Voice: Reverting timeline. Re-engaging ${targetModuleConfig.label.split(':')[0]}.`);
    
    // Update completed modules list
    const targetModuleIndex = TIMELINE_MODULE_CONFIGS.findIndex(m => m.id === moduleId);
    setCompletedModuleIds(TIMELINE_MODULE_CONFIGS.slice(0, targetModuleIndex).map(m => m.id));

    // Load the target module (which also sets syncProgress and objective text)
    loadModule(moduleId);

    // Clean up future scene elements if necessary
    if (moduleId < CalibrationModuleEnum.DocumentUpload) {
        materializedObjects.forEach(obj => sceneRef.current?.remove(obj));
        setMaterializedObjects([]);
    }
    if (moduleId < CalibrationModuleEnum.PinEncryption && pinConstellationRef.current && sceneRef.current) {
        sceneRef.current.remove(pinConstellationRef.current);
        // Proper disposal of pinConstellationRef.current geometry/materials if needed
        pinConstellationRef.current = null;
    }

  }, []);


  const triggerCameraRecoil = useCallback(() => {
    console.log("CalibrationSequence: ACTION - Camera Recoil Triggered!");
    if (cameraRef.current) {
        const originalZ = cameraRef.current.position.z;
        const originalFov = cameraRef.current.fov;
        cameraRef.current.position.z -= 0.5; 
        cameraRef.current.fov = originalFov + 10; 
        cameraRef.current.updateProjectionMatrix();
        setTimeout(() => {
            if (cameraRef.current) {
                cameraRef.current.position.z = originalZ;
                cameraRef.current.fov = originalFov;
                cameraRef.current.updateProjectionMatrix();
            }
        }, 150); 
    }
  }, []);

  const panCameraToTarget = useCallback((targetPosition: THREE.Vector3 | null) => {
    // Placeholder - actual camera panning logic would go here
  }, []);

  const updateEnvironmentForComet = useCallback((cometPosition: THREE.Vector3) => {
     gridsRef.current.forEach(grid => {
        const distanceToGridPlane = Math.min(
            Math.abs(grid.position.x - cometPosition.x), 
            Math.abs(grid.position.y - cometPosition.y), 
            Math.abs(grid.position.z - cometPosition.z)  
        );
        if (distanceToGridPlane < 15) { 
            const mat = grid.material as THREE.LineBasicMaterial; 
            const originalColorHex = mat.color.getHex();
            if(!grid.userData.originalColor) grid.userData.originalColor = originalColorHex;

            mat.color.setHex(0x00ffff); 
            mat.opacity = 0.8;
            if (grid.userData.flickerTimeout) clearTimeout(grid.userData.flickerTimeout);
            grid.userData.flickerTimeout = setTimeout(() => {
                mat.color.setHex(grid.userData.originalColor);
                mat.opacity = 0.25;
            }, 100); 
        }
    });
  }, []);
  
  const triggerShockwaveEffect = useCallback(() => {
      // Placeholder - visual shockwave logic
  }, []);


  const renderCurrentModuleContent = () => {
    if (!rendererRef.current) { 
        return <div className="text-cyan-400 text-center p-8">Initializing Data Core Interface...</div>;
    }

    switch (currentLoadedModule) {
      case CalibrationModuleEnum.Authentication:
        return (
          <AuthenticationSigil 
            key={`auth-${completedModuleIds.length}`} // Force re-render on rewind
            onSuccess={handleAuthenticationSuccess} 
            onRetryPrompt={handleAuthenticationRetryPrompt} 
          />
        );
      case CalibrationModuleEnum.DocumentUpload:
        if (!sceneRef.current || !cameraRef.current) return null; 
        return (
          <DocumentUploadModule
            key={`docupload-${completedModuleIds.length}`}
            scene={sceneRef.current}
            camera={cameraRef.current}
            renderer={rendererRef.current}
            onSuccess={handleDocumentUploadSuccess}
            onFailure={handleDocumentUploadFailure}
            triggerCameraRecoil={triggerCameraRecoil}
            panCameraToTarget={panCameraToTarget}
            updateEnvironmentForComet={updateEnvironmentForComet}
            triggerShockwaveEffect={triggerShockwaveEffect}
          />
        );
       case CalibrationModuleEnum.PinEncryption:
        if (!rendererRef.current) return null; 
        return (
            <PinEncryptionModule
                key={`pin-${completedModuleIds.length}`}
                renderer={rendererRef.current}
                onPinSuccess={handlePinSetSuccess}
                onReset={handlePinReset}
                onModuleComplete={() => { 
                    setIsDataCoreVisible(true); 
                }}
            />
        );
      default:
        return null; 
    }
  };


  return (
    <div className={`fixed inset-0 z-40 animate-fadeIn ${!isDataCoreVisible && currentLoadedModule === CalibrationModuleEnum.PinEncryption ? 'bg-black' : ''}`}> 
      <div ref={mountRef} className={`absolute inset-0 z-0 transition-opacity duration-1000 ${isDataCoreVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}></div>

      {isDataCoreVisible && ( 
        <>
          <div className={`absolute top-4 left-4 p-2 space-y-1 transition-opacity duration-500 ${hudBooted ? 'opacity-100' : 'opacity-0'}`}>
            <div className="h-0.5 w-16 bg-cyan-400 animate-hud-line-draw-x mb-1" style={{ animationDelay: '0.1s' }}></div>
            <HUDText text="STATUS: ONLINE" delay={0.3} />
            <HUDText text="CALIBRATION PROTOCOL V7.1" delay={0.6} /> 
          </div>

          <div className={`absolute top-4 right-4 p-2 flex items-center space-x-2 transition-opacity duration-500 ${hudBooted ? 'opacity-100' : 'opacity-0'}`}>
            <LogoIcon className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 3px #00FFFF)'}} />
            <div className="h-8 w-0.5 bg-cyan-400 animate-hud-line-draw-y" style={{ animationDelay: '0.1s' }}></div>
          </div>

          <div className={`absolute bottom-[140px] left-1/2 -translate-x-1/2 w-3/4 max-w-md p-2 transition-opacity duration-500 ${hudBooted ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center justify-between">
                <HUDText text="SYNC PROGRESS:" delay={1.2} />
                <HUDText text={`${Math.round(syncProgress)}%`} delay={1.2} />
            </div>
            <div className="h-1 w-full bg-cyan-900/50 mt-1 rounded overflow-hidden">
              <div className="h-full bg-cyan-400 rounded animate-hud-line-draw-x" style={{ width: `${syncProgress}%`, transition: 'width 0.5s ease-out', animationDelay: '1.5s' }}></div>
            </div>
            {currentObjectiveText && (
              <HUDText text={currentObjectiveText} delay={1.8} className="text-center mt-1 text-sm uppercase" />
            )}
          </div>
          
          <button onClick={onClose} className="absolute bottom-[150px] right-4 text-cyan-300 hover:text-white transition-colors z-50 font-roboto-mono p-2 border border-cyan-500/50 hover:border-cyan-400 rounded text-sm animate-fadeIn" style={{animationDelay: '2s'}}>
            [ EXIT CALIBRATION ]
          </button>
        </>
      )}
      
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {renderCurrentModuleContent()}
      </div>

      <FractalTimeline
        moduleConfigs={TIMELINE_MODULE_CONFIGS}
        completedModuleIds={completedModuleIds}
        currentModuleId={currentLoadedModule}
        onRewindToModule={handleRewindToModule}
      />

    </div>
  );
};

export default CalibrationSequence;
