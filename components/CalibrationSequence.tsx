import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CalibrationModule as CalibrationModuleEnum } from '../types'; 
import { LogoIcon, XCircleIcon } from './icons'; 
import AuthenticationSigil from './AuthenticationSigil'; // New component

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

  const [hudBooted, setHudBooted] = useState(false);
  const [currentLoadedModule, setCurrentLoadedModule] = useState<CalibrationModuleEnum | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [currentObjectiveText, setCurrentObjectiveText] = useState("");


  // Three.js Scene Setup for Data Core
  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    console.log("CalibrationSequence: Initializing Data Core scene.");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 0.1); 

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0); 
    currentMount.appendChild(renderer.domElement);

    const gridSize = 100;
    const gridDivisions = 10;
    const grids: THREE.GridHelper[] = [];
    const createGridPlane = (size: number, divisions: number, color1: any, color2: any) => {
        const grid = new THREE.GridHelper(size, divisions, color1, color2);
        (grid.material as THREE.Material).opacity = 0.25;
        (grid.material as THREE.Material).transparent = true;
        (grid.material as THREE.Material).blending = THREE.AdditiveBlending;
        (grid.material as THREE.Material).depthWrite = false;
        return grid;
    }

    const wallDist = gridSize / 2;
    const gridFront = createGridPlane(gridSize, gridDivisions, 0x0088ff, 0x00ffff); gridFront.position.z = -wallDist; grids.push(gridFront); scene.add(gridFront);
    const gridBack = createGridPlane(gridSize, gridDivisions, 0x0088ff, 0x00ffff); gridBack.position.z = wallDist; gridBack.rotation.x = Math.PI; grids.push(gridBack); scene.add(gridBack);
    const gridTop = createGridPlane(gridSize, gridDivisions, 0x0088ff, 0x00ffff); gridTop.position.y = wallDist; gridTop.rotation.x = Math.PI / 2; grids.push(gridTop); scene.add(gridTop);
    const gridBottom = createGridPlane(gridSize, gridDivisions, 0x0088ff, 0x00ffff); gridBottom.position.y = -wallDist; gridBottom.rotation.x = -Math.PI / 2; grids.push(gridBottom); scene.add(gridBottom);
    const gridLeft = createGridPlane(gridSize, gridDivisions, 0x0088ff, 0x00ffff); gridLeft.position.x = -wallDist; gridLeft.rotation.y = Math.PI / 2; grids.push(gridLeft); scene.add(gridLeft);
    const gridRight = createGridPlane(gridSize, gridDivisions, 0x0088ff, 0x00ffff); gridRight.position.x = wallDist; gridRight.rotation.y = -Math.PI / 2; grids.push(gridRight); scene.add(gridRight);
    
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
    scene.add(dataComets);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(currentMount.clientWidth, currentMount.clientHeight), 0.4, 0.5, 0.1);
    composer.addPass(bloomPass);
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
    
    const mousePosition = { x: 0, y: 0 };
    const handleMouseMove = (event: MouseEvent) => {
      mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
      mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    let requestId: number;
    const animate = () => {
      requestId = requestAnimationFrame(animate);
      camera.rotation.y += (mousePosition.x * 0.1 - camera.rotation.y) * 0.05;
      camera.rotation.x += (-mousePosition.y * 0.1 - camera.rotation.x) * 0.05;

      const cometPositions = dataComets.geometry.attributes.position.array as Float32Array;
      const cometVelocities = dataComets.geometry.attributes.velocity.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        cometPositions[i * 3 + 0] += cometVelocities[i * 3 + 0];
        cometPositions[i * 3 + 1] += cometVelocities[i * 3 + 1];
        cometPositions[i * 3 + 2] += cometVelocities[i * 3 + 2];
        if (Math.abs(cometPositions[i*3+0]) > gridSize * 0.75) cometVelocities[i*3+0] *= -1;
        if (Math.abs(cometPositions[i*3+1]) > gridSize * 0.75) cometVelocities[i*3+1] *= -1;
        if (Math.abs(cometPositions[i*3+2]) > gridSize * 0.75) cometVelocities[i*3+2] *= -1;
      }
      dataComets.geometry.attributes.position.needsUpdate = true;
      grids.forEach(g => g.rotation.y += 0.0001); 
      composer.render();
    };
    animate();

    const handleResize = () => {
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      composer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // HUD Boot-up sequence & Initial Module Load
    setTimeout(() => {
      setHudBooted(true);
      console.log("AI Voice: Calibration sequence initiated. Welcome.");
      setTimeout(() => {
        setCurrentObjectiveText("CURRENT OBJECTIVE: Authenticate Biometric Signature");
        console.log("AI Voice: Module 01: Identity Authentication. Please calibrate your input by tracing the biometric sigil.");
        setCurrentLoadedModule(CalibrationModuleEnum.Authentication);
      }, 2500); // 2s pause + 0.5s for message
    }, 500); // Delay after transition

    return () => {
      cancelAnimationFrame(requestId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      scene.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.GridHelper) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            (child.material as THREE.Material).dispose();
          }
        }
      });
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      console.log("CalibrationSequence: Data Core scene cleaned up.");
    };
  }, []);

  const handleAuthenticationSuccess = useCallback(() => {
    console.log("Authentication successful!");
    setSyncProgress(15);
    setCurrentObjectiveText("BIOMETRIC SIGNATURE VERIFIED");
    console.log("AI Voice: Signature Verified. Module 01 complete."); // Placeholder for success chime + voice
    setCurrentLoadedModule(null); // Or next module, e.g., CalibrationModuleEnum.DocumentUpload
    // Potentially load next module after a delay
    // setTimeout(() => setCurrentLoadedModule(CalibrationModuleEnum.DocumentUpload), 2000);
  }, []);

  const handleAuthenticationRetryPrompt = useCallback(() => {
    console.log("AI Voice: Re-calibrating. Please try again.");
  }, []);

  const renderCurrentModuleContent = () => {
    if (currentLoadedModule === CalibrationModuleEnum.Authentication) {
      return (
        <AuthenticationSigil 
          onSuccess={handleAuthenticationSuccess} 
          onRetryPrompt={handleAuthenticationRetryPrompt} 
        />
      );
    }
    // Placeholder for other modules or an empty state
    // if (currentLoadedModule === CalibrationModuleEnum.DocumentUpload) {
    // return <DocumentUploadModule onSuccess={() => { ... }} />;
    // }
    return null; 
  };


  return (
    <div className="fixed inset-0 z-40 animate-fadeIn"> 
      <div ref={mountRef} className="absolute inset-0 z-0"></div>

      {/* HUD Elements */}
      <div className={`absolute top-4 left-4 p-2 space-y-1 transition-opacity duration-500 ${hudBooted ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-0.5 w-16 bg-cyan-400 animate-hud-line-draw-x mb-1" style={{ animationDelay: '0.1s' }}></div>
        <HUDText text="STATUS: ONLINE" delay={0.3} />
        <HUDText text="CALIBRATION PROTOCOL V7.0" delay={0.6} />
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
          <HUDText text={currentObjectiveText} delay={1.8} className="text-center mt-1 text-sm" />
        )}
      </div>
      
      {/* Container for the current interactive module */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* The module itself will handle pointer events if needed */}
        {renderCurrentModuleContent()}
      </div>


       <button onClick={onClose} className="absolute bottom-4 right-4 text-cyan-300 hover:text-white transition-colors z-50 font-roboto-mono p-2 border border-cyan-500/50 hover:border-cyan-400 rounded text-sm animate-fadeIn" style={{animationDelay: '2s'}}>
          [ EXIT CALIBRATION ]
        </button>
    </div>
  );
};

export default CalibrationSequence;