import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CalibrationModule as CalibrationModuleEnum } from '../types'; 
import { LogoIcon } from './icons'; 
import AuthenticationSigil from './AuthenticationSigil';
import DocumentUploadModule from './DocumentUploadModule';

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
  const [syncProgress, setSyncProgress] = useState(0);
  const [currentObjectiveText, setCurrentObjectiveText] = useState("");
  const [materializedObjects, setMaterializedObjects] = useState<THREE.Object3D[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);


  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    console.log("CalibrationSequence: Initializing Data Core scene.");

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000); // Default FOV 75
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
      mousePosRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mousePosRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      if(!cameraRef.current || !composerRef.current || !dataCometsRef.current) return;

      cameraRef.current.rotation.y += (mousePosRef.current.x * 0.05 - cameraRef.current.rotation.y) * 0.05; // Adjusted mouse influence
      cameraRef.current.rotation.x += (-mousePosRef.current.y * 0.05 - cameraRef.current.rotation.x) * 0.05; // Adjusted mouse influence


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
      gridsRef.current.forEach(g => g.rotation.y += 0.0001); 

      materializedObjects.forEach(obj => {
        obj.rotation.y += 0.003; // Slightly slower base rotation
        obj.rotation.x += 0.001;
        obj.rotation.z += 0.0005;
      });
      
      composerRef.current.render(clockRef.current.getDelta());
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
        setCurrentLoadedModule(initialModule);

        if (initialModule === CalibrationModuleEnum.Authentication) {
            setCurrentObjectiveText("CURRENT OBJECTIVE: Authenticate Biometric Signature");
            console.log("AI Voice: Module 01: Identity Authentication. Please calibrate your input by tracing the biometric sigil.");
        } else if (initialModule === CalibrationModuleEnum.DocumentUpload) {
            setSyncProgress(15); 
            setCurrentObjectiveText("CURRENT OBJECTIVE: UPLOAD PRIMARY DATA-CONSTRUCT");
            console.log("AI Voice: Module 02: Document Materialization. Please select a data-construct for upload.");
        }
    }, 500);

    return () => {
      if(animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      
      if(rendererRef.current) rendererRef.current.dispose();
      sceneRef.current?.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.GridHelper) {
          child.geometry.dispose();
          const material = (child as THREE.Mesh | THREE.Points | THREE.GridHelper).material;
          if (Array.isArray(material)) {
            material.forEach(mat => mat.dispose());
          } else {
            (material as THREE.Material).dispose();
          }
        }
      });
      if (mountRef.current && rendererRef.current?.domElement) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      console.log("CalibrationSequence: Data Core scene cleaned up.");
    };
  }, [jumpToModule]); // materializedObjects removed from deps for now, managed by its own effect

  // Handle materialized object updates separately
    useEffect(() => {
        materializedObjects.forEach(obj => {
            if (obj && !sceneRef.current?.children.includes(obj)) {
                sceneRef.current?.add(obj);
            }
        });
        // Cleanup: remove objects from scene if they are removed from materializedObjects state
        return () => {
            materializedObjects.forEach(obj => {
                sceneRef.current?.remove(obj);
                // Consider disposing geometry/material if objects are permanently removed and not reused
            });
        };
    }, [materializedObjects]);


  const handleAuthenticationSuccess = useCallback(() => {
    console.log("Authentication successful!");
    setSyncProgress(15);
    setCurrentObjectiveText("BIOMETRIC SIGNATURE VERIFIED");
    console.log("AI Voice: Signature Verified. Module 01 complete.");
    setTimeout(() => {
        setCurrentLoadedModule(CalibrationModuleEnum.DocumentUpload);
        setCurrentObjectiveText("CURRENT OBJECTIVE: UPLOAD PRIMARY DATA-CONSTRUCT");
        console.log("AI Voice: Module 02: Document Materialization. Please select a data-construct for upload.");
    }, 1500);
  }, []);

  const handleAuthenticationRetryPrompt = useCallback(() => {
    console.log("AI Voice: Re-calibrating. Please try again.");
  }, []);

  const handleDocumentUploadSuccess = useCallback((newObject: THREE.Object3D) => {
    console.log("Document Materialization successful!");
    setMaterializedObjects(prev => [...prev.filter(o => o.uuid !== newObject.uuid), newObject]);
    setSyncProgress(30);
    setCurrentObjectiveText("DATA-CONSTRUCT FORGED & MATERIALIZED"); // Updated text
    console.log("AI Voice: Data-construct received and materialized.");
    setTimeout(() => {
        setCurrentLoadedModule(null); 
        setCurrentObjectiveText("CALIBRATION SEQUENCE: STAGE 2 COMPLETE");
    }, 2000);
  }, []);

  const handleDocumentUploadFailure = useCallback(() => {
    console.log("Document Materialization failed.");
  }, []);

  // Callbacks for DocumentUploadModule to interact with camera/environment
  const triggerCameraRecoil = useCallback(() => {
    console.log("CalibrationSequence: ACTION - Camera Recoil Triggered!");
    if (cameraRef.current) {
        const originalZ = cameraRef.current.position.z;
        const originalFov = cameraRef.current.fov;
        cameraRef.current.position.z -= 0.5; // Recoil: Push camera slightly back (adjust value)
        cameraRef.current.fov = originalFov + 10; // Widen FOV
        cameraRef.current.updateProjectionMatrix();
        
        console.log(`Camera recoiled: Z from ${originalZ.toFixed(2)} to ${cameraRef.current.position.z.toFixed(2)}, FOV from ${originalFov} to ${cameraRef.current.fov}`);

        setTimeout(() => {
            if (cameraRef.current) {
                cameraRef.current.position.z = originalZ;
                cameraRef.current.fov = originalFov;
                cameraRef.current.updateProjectionMatrix();
                console.log("Camera recoil reset.");
            }
        }, 150); // Duration of the recoil effect
    }
  }, []);

  const panCameraToTarget = useCallback((targetPosition: THREE.Vector3 | null) => {
    // For now, this will just log. A real implementation would smoothly lerp camera.lookAt or rotation.
    if (targetPosition) {
        console.log(`CalibrationSequence: ACTION - Pan Camera Towards Target: x:${targetPosition.x.toFixed(2)}, y:${targetPosition.y.toFixed(2)}, z:${targetPosition.z.toFixed(2)}`);
    } else {
        console.log("CalibrationSequence: ACTION - Reset Camera Pan/Target.");
        // Reset to default lookAt or rotation if needed
    }
    // if(cameraRef.current && targetPosition){
    //     // cameraRef.current.lookAt(targetPosition); // Simple lookAt, or implement smooth lerping
    // }
  }, []);

  const updateEnvironmentForComet = useCallback((cometPosition: THREE.Vector3) => {
    console.log(`CalibrationSequence: ACTION - Environment Reacts to Comet at: x:${cometPosition.x.toFixed(2)}, y:${cometPosition.y.toFixed(2)}, z:${cometPosition.z.toFixed(2)}`);
    // Here, you would iterate through gridsRef.current and change material properties
    // of grid segments near cometPosition (e.g., emissive color, opacity).
     gridsRef.current.forEach(grid => {
        // Example: If comet is close to a grid plane, make that grid flicker brighter
        // This is a placeholder; actual distance check and effect would be more complex
        const distanceToGrid = Math.abs(grid.position.z - cometPosition.z); // Simplified check for Z-aligned grids
        if (distanceToGrid < 10) { // Arbitrary distance
            const mat = grid.material as THREE.LineBasicMaterial; // Cast to specific material if known
            const originalColor = mat.color.getHex();
            mat.color.setHex(0x00ffff); // Bright cyan
            mat.opacity = 0.8;
            setTimeout(() => {
                mat.color.setHex(originalColor);
                mat.opacity = 0.25;
            }, 100); // Flicker duration
        }
    });
  }, []);
  
  const triggerShockwaveEffect = useCallback(() => {
      console.log("CalibrationSequence: ACTION - Visual Shockwave Effect Triggered!");
      // This could involve a post-processing shader, a screen-space effect,
      // or a rapidly expanding transparent mesh.
      // For now, it's a log.
  }, []);


  const renderCurrentModuleContent = () => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) {
        return <div className="text-cyan-400 text-center p-8">Initializing Data Core Interface...</div>;
    }

    switch (currentLoadedModule) {
      case CalibrationModuleEnum.Authentication:
        return (
          <AuthenticationSigil 
            onSuccess={handleAuthenticationSuccess} 
            onRetryPrompt={handleAuthenticationRetryPrompt} 
          />
        );
      case CalibrationModuleEnum.DocumentUpload:
        return (
          <DocumentUploadModule
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
      default:
        return null; 
    }
  };


  return (
    <div className="fixed inset-0 z-40 animate-fadeIn"> 
      <div ref={mountRef} className="absolute inset-0 z-0"></div>

      <div className={`absolute top-4 left-4 p-2 space-y-1 transition-opacity duration-500 ${hudBooted ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-0.5 w-16 bg-cyan-400 animate-hud-line-draw-x mb-1" style={{ animationDelay: '0.1s' }}></div>
        <HUDText text="STATUS: ONLINE" delay={0.3} />
        <HUDText text="CALIBRATION PROTOCOL V7.1" delay={0.6} /> {/* Version bump for fun */}
      </div>

      <div className={`absolute top-4 right-4 p-2 flex items-center space-x-2 transition-opacity duration-500 ${hudBooted ? 'opacity-100' : 'opacity-0'}`}>
        <LogoIcon className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 3px #00FFFF)'}} />
        <div className="h-8 w-0.5 bg-cyan-400 animate-hud-line-draw-y" style={{ animationDelay: '0.1s' }}></div>
      </div>

      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-3/4 max-w-md p-2 transition-opacity duration-500 ${hudBooted ? 'opacity-100' : 'opacity-0'}`}>
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
      
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {renderCurrentModuleContent()}
      </div>

       <button onClick={onClose} className="absolute bottom-4 right-4 text-cyan-300 hover:text-white transition-colors z-50 font-roboto-mono p-2 border border-cyan-500/50 hover:border-cyan-400 rounded text-sm animate-fadeIn" style={{animationDelay: '2s'}}>
          [ EXIT CALIBRATION ]
        </button>
    </div>
  );
};

export default CalibrationSequence;