import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { ArrowPathIcon } from './icons'; // Using existing ArrowPathIcon

const STAR_COUNT = 300;
const STAR_FIELD_RADIUS = 50;
const PIN_LENGTH = 6;
const HOVER_COLOR = new THREE.Color(0x00ffff); // Cyan
const SELECTED_COLOR = new THREE.Color(0x00ff7f); // Green
const LINE_COLOR = new THREE.Color(0x00ff7f); // Green

interface PinEncryptionModuleProps {
  renderer: THREE.WebGLRenderer;
  onPinSuccess: (constellationGroup: THREE.Group) => void;
  onReset: () => void;
  onModuleComplete: () => void; // To signal internal fade-out is done
}

type PinModulePhase = 'fadingIn' | 'active' | 'successSequence' | 'fadingOut';

const PinEncryptionModule: React.FC<PinEncryptionModuleProps> = ({
  renderer, onPinSuccess, onReset, onModuleComplete
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const starsRef = useRef<THREE.Group | null>(null);
  const linesRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  
  const [phase, setPhase] = useState<PinModulePhase>('fadingIn');
  const [selectedStars, setSelectedStars] = useState<THREE.Object3D[]>([]);
  const [pinDisplay, setPinDisplay] = useState<string[]>(Array(PIN_LENGTH).fill('_'));
  const [isDragging, setIsDragging] = useState(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const cameraRotationTargetRef = useRef({ x: 0, y: 0 }); // Target rotation based on drag
  const cameraCurrentRotationRef = useRef({ x: 0, y: 0 }); // Smoothed current rotation

  const originalStarMaterialsRef = useRef(new Map<string, THREE.Material | THREE.Material[]>());


  // Scene Initialization
  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    camera.position.z = STAR_FIELD_RADIUS * 1.2; // Zoom out to see the field
    cameraRef.current = camera;

    // Star Generation
    const starsGroup = new THREE.Group();
    const starGeometry = new THREE.SphereGeometry(0.15, 8, 8); // Smaller, simpler stars
    for (let i = 0; i < STAR_COUNT; i++) {
      const starMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(Math.random() * 0x888888 + 0xaaaaaa), // Blues, yellows, whites
        transparent: true,
        opacity: 0.7 + Math.random() * 0.3,
      });
      if (Math.random() < 0.3) starMaterial.color.setHex(0xaaaaff); // More blues
      if (Math.random() < 0.2) starMaterial.color.setHex(0xffffaa); // Some yellows
      
      const star = new THREE.Mesh(starGeometry.clone(), starMaterial);
      
      const phi = Math.acos(-1 + (2 * i) / STAR_COUNT); // Distribute more evenly than pure random
      const theta = Math.sqrt(STAR_COUNT * Math.PI) * phi;
      star.position.setFromSphericalCoords(STAR_FIELD_RADIUS * (0.6 + Math.random() * 0.4), phi, theta);
      
      star.userData.originalColor = starMaterial.color.clone();
      star.userData.isSelectable = true;
      star.userData.baseScale = 0.5 + Math.random() * 1.0;
      star.scale.setScalar(star.userData.baseScale);
      starsGroup.add(star);
    }
    scene.add(starsGroup);
    starsRef.current = starsGroup;

    linesRef.current = new THREE.Group();
    scene.add(linesRef.current);

    // Initial fade in animation
    if (mountRef.current) mountRef.current.style.opacity = '1';
    
    // Resize handling for this module's camera
    const handleResize = () => {
        if (cameraRef.current && mountRef.current && renderer) {
            cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
            cameraRef.current.updateProjectionMatrix();
            // Renderer size is managed by CalibrationSequence, but if this module had its own composer, it'd be here
        }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      starsGroup.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
      scene.remove(starsGroup);
      if (linesRef.current) {
        linesRef.current.children.forEach(child => {
          if (child instanceof THREE.Line) {
            child.geometry.dispose();
             if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
             else (child.material as THREE.Material).dispose();
          }
        });
        scene.remove(linesRef.current);
      }
      originalStarMaterialsRef.current.clear();
      // Scene is local, renderer is passed, no need to dispose renderer here.
    };
  }, [renderer]);

  // Animation Loop
  useEffect(() => {
    if (phase === 'fadingOut') return; // Stop animation when fading out

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!sceneRef.current || !cameraRef.current || !starsRef.current || !renderer) return;

      // Smooth camera rotation
      cameraCurrentRotationRef.current.x += (cameraRotationTargetRef.current.x - cameraCurrentRotationRef.current.x) * 0.1;
      cameraCurrentRotationRef.current.y += (cameraRotationTargetRef.current.y - cameraCurrentRotationRef.current.y) * 0.1;
      
      // Apply rotation to a group containing the camera or orbit the camera
      // Orbiting camera around origin:
      const radius = cameraRef.current.position.length();
      cameraRef.current.position.x = radius * Math.sin(cameraCurrentRotationRef.current.y) * Math.cos(cameraCurrentRotationRef.current.x);
      cameraRef.current.position.y = radius * Math.sin(cameraCurrentRotationRef.current.x);
      cameraRef.current.position.z = radius * Math.cos(cameraCurrentRotationRef.current.y) * Math.cos(cameraCurrentRotationRef.current.x);
      cameraRef.current.lookAt(sceneRef.current.position);


      // Star twinkle/pulse
      starsRef.current.children.forEach(star => {
        if (star instanceof THREE.Mesh) {
          const pulseSpeed = 0.005 + Math.random() * 0.01;
          star.scale.setScalar(star.userData.baseScale * (1 + Math.sin(Date.now() * pulseSpeed) * 0.1));
        }
      });
      
      renderer.render(sceneRef.current, cameraRef.current);
    };
    let animationFrameId: number | null = null;
    animate();
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [renderer, phase]); // Re-run if phase changes and not fadingOut

  const updatePinDisplay = useCallback((count: number) => {
    setPinDisplay(prev => prev.map((_, i) => (i < count ? '*' : '_')));
  }, []);

  const resetStarMaterial = (star: THREE.Object3D) => {
    if (star instanceof THREE.Mesh && originalStarMaterialsRef.current.has(star.uuid)) {
        star.material = originalStarMaterialsRef.current.get(star.uuid)!;
        star.userData.isSelectable = true;
    }
  };
  
  const setStarSelectedMaterial = (star: THREE.Object3D) => {
      if (star instanceof THREE.Mesh) {
          if (!originalStarMaterialsRef.current.has(star.uuid)) {
              originalStarMaterialsRef.current.set(star.uuid, star.material);
          }
          const selectedMaterial = (star.material as THREE.MeshBasicMaterial).clone();
          selectedMaterial.color.set(SELECTED_COLOR);
          selectedMaterial.opacity = 1.0;
          star.material = selectedMaterial;
          star.userData.isSelectable = false;
      }
  };

  const handleStarClick = useCallback(() => {
    if (!cameraRef.current || !starsRef.current || selectedStars.length >= PIN_LENGTH || phase !== 'active') return;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(starsRef.current.children, true);

    if (intersects.length > 0) {
      const clickedStar = intersects[0].object;
      if (clickedStar instanceof THREE.Mesh && clickedStar.userData.isSelectable) {
        console.log("AI Audio: Resonant musical note (single)");
        setStarSelectedMaterial(clickedStar);

        if (selectedStars.length > 0 && linesRef.current) {
          const prevStar = selectedStars[selectedStars.length - 1];
          const lineMaterial = new THREE.LineBasicMaterial({ color: LINE_COLOR, linewidth: 2 });
          const points = [prevStar.position.clone(), clickedStar.position.clone()];
          const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(lineGeometry, lineMaterial);
          linesRef.current.add(line);
        }
        
        const newSelectedStars = [...selectedStars, clickedStar];
        setSelectedStars(newSelectedStars);
        updatePinDisplay(newSelectedStars.length);

        if (newSelectedStars.length === PIN_LENGTH) {
          setPhase('successSequence');
          console.log("AI Audio: Resolving musical chord");
          // Flash constellation
          if(linesRef.current) {
            linesRef.current.children.forEach(line => {
                if(line instanceof THREE.Line) (line.material as THREE.LineBasicMaterial).color.setHex(0xffffff);
            });
          }
          newSelectedStars.forEach(star => {
            if(star instanceof THREE.Mesh) (star.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
          });

          setTimeout(() => {
            if(linesRef.current) {
                linesRef.current.children.forEach(line => {
                    if(line instanceof THREE.Line) (line.material as THREE.LineBasicMaterial).color.set(LINE_COLOR);
                });
            }
            newSelectedStars.forEach(star => {
                if(star instanceof THREE.Mesh) (star.material as THREE.MeshBasicMaterial).color.set(SELECTED_COLOR);
            });

            // Create final constellation group
            const constellationGroup = new THREE.Group();
            newSelectedStars.forEach(s => constellationGroup.add(s.clone())); // Clone stars
            if (linesRef.current) { // Clone lines
                linesRef.current.children.forEach(l => constellationGroup.add(l.clone()));
            }
            
            onPinSuccess(constellationGroup);
            setPhase('fadingOut');
          }, 500); // Flash duration
        }
      }
    }
  }, [selectedStars, phase, updatePinDisplay, onPinSuccess]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!mountRef.current || !cameraRef.current || !starsRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    if (isDragging) {
        const deltaX = event.clientX - lastMousePosRef.current.x;
        const deltaY = event.clientY - lastMousePosRef.current.y;
        cameraRotationTargetRef.current.y += deltaX * 0.005; // Adjust sensitivity
        cameraRotationTargetRef.current.x += deltaY * 0.005;
        // Clamp vertical rotation to avoid flipping
        cameraRotationTargetRef.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, cameraRotationTargetRef.current.x));
        lastMousePosRef.current = { x: event.clientX, y: event.clientY };
    } else if (phase === 'active') { // Hover effect only if not dragging and active
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        const intersects = raycasterRef.current.intersectObjects(starsRef.current.children, true);

        starsRef.current.children.forEach(star => {
            if (star instanceof THREE.Mesh && star.userData.isSelectable) {
                (star.material as THREE.MeshBasicMaterial).color.set(star.userData.originalColor);
                star.scale.setScalar(star.userData.baseScale); // Reset scale
            }
        });

        if (intersects.length > 0) {
            const hoveredStar = intersects[0].object;
            if (hoveredStar instanceof THREE.Mesh && hoveredStar.userData.isSelectable) {
                (hoveredStar.material as THREE.MeshBasicMaterial).color.set(HOVER_COLOR);
                 hoveredStar.scale.setScalar(hoveredStar.userData.baseScale * 1.5); // Enlarge on hover
            }
        }
    }
  }, [isDragging, phase]);

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    lastMousePosRef.current = { x: event.clientX, y: event.clientY };
  };
  const handleMouseUp = () => {
    if(isDragging) setIsDragging(false);
    else handleStarClick(); // If not dragging, it's a click
  };
  
  const handleWheel = useCallback((event: WheelEvent) => {
      if (!cameraRef.current) return;
      const zoomSpeed = 0.5;
      cameraRef.current.position.z += event.deltaY * 0.01 * zoomSpeed;
      cameraRef.current.position.z = Math.max(10, Math.min(STAR_FIELD_RADIUS * 2, cameraRef.current.position.z)); // Clamp zoom
      cameraRef.current.updateProjectionMatrix();
  }, []);

  useEffect(() => {
    const currentMount = mountRef.current;
    if(currentMount && phase === 'active') { // Only add wheel listener when active to avoid conflicts
        currentMount.addEventListener('wheel', handleWheel);
        return () => currentMount.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel, phase]);


  const handleResetClick = () => {
    if (phase !== 'active' && phase !== 'successSequence') return;
    onReset();
    selectedStars.forEach(resetStarMaterial);
    setSelectedStars([]);
    updatePinDisplay(0);
    if (linesRef.current) {
      linesRef.current.children.forEach(child => {
        if (child instanceof THREE.Line) {
            child.geometry.dispose();
            const material = child.material as THREE.Material | THREE.Material[];
            if (Array.isArray(material)) material.forEach(m => m.dispose());
            else material.dispose();
        }
      });
      linesRef.current.children = []; // Clear lines
    }
    setPhase('active'); // Go back to active selection
  };
  
  // Phase management for fade in/out
  useEffect(() => {
    if (phase === 'fadingIn') {
        if (mountRef.current) mountRef.current.style.opacity = '0';
        setTimeout(() => {
            if (mountRef.current) mountRef.current.style.opacity = '1';
            setPhase('active');
        }, 100); // Short fade in for module
    } else if (phase === 'fadingOut') {
        if (mountRef.current) mountRef.current.style.opacity = '0';
        setTimeout(() => {
            onModuleComplete(); // Notify CalibrationSequence that this module is done
        }, 1000); // Match CSS transition duration
    }
  }, [phase, onModuleComplete]);

  return (
    <div 
        ref={mountRef} 
        className="absolute inset-0 bg-black transition-opacity duration-1000 pointer-events-auto" // Higher z-index handled by CalibrationSequence logic
        style={{ opacity: 0 }} // Initial opacity for fade-in
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={isDragging ? undefined : handleStarClick} // Click only if not dragging
    >
      {/* Minimalist HUD for PIN */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex space-x-2 p-2 bg-black/30 rounded-md">
        {pinDisplay.map((char, index) => (
          <span key={index} className="text-3xl font-roboto-mono text-cyan-300 w-8 text-center">
            {char}
          </span>
        ))}
      </div>

      {/* Reset Button */}
      <button
        onClick={handleResetClick}
        className="absolute bottom-4 right-4 p-2 text-cyan-300 hover:text-white border border-cyan-500/50 hover:border-cyan-400 rounded-md transition-colors"
        title="Reset PIN"
        disabled={phase === 'fadingOut' || phase === 'fadingIn'}
      >
        <ArrowPathIcon className="w-6 h-6" />
      </button>
    </div>
  );
};

export default PinEncryptionModule;