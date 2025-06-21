
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { ArrowPathIcon } from './icons';

const STAR_COUNT = 500;
const STAR_FIELD_RADIUS = 50; // Radius for spherical distribution
const PIN_LENGTH = 6;

const DEFAULT_STAR_OPACITY = 0.8;
const HOVER_STAR_COLOR = new THREE.Color(0x00ffff); // Cyan
const SELECTED_STAR_COLOR = new THREE.Color(0x00ff7f); // Green
const LINE_COLOR = new THREE.Color(0x00dd7f); // Slightly darker green for lines to differentiate

interface PinEncryptionModuleProps {
  renderer: THREE.WebGLRenderer; // Passed from CalibrationSequence
  onPinSuccess: (constellationGroup: THREE.Group) => void;
  onReset: () => void; // Callback for AI voice on reset
  onModuleComplete: () => void; // To signal internal fade-out is done
}

type PinModuleInternalPhase = 'initializing' | 'active' | 'successFlash' | 'fadingOut';

const PinEncryptionModule: React.FC<PinEncryptionModuleProps> = ({
  renderer, onPinSuccess, onReset, onModuleComplete
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  
  const starsGroupRef = useRef<THREE.Group | null>(null);
  const linesGroupRef = useRef<THREE.Group | null>(null);
  
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseNDCRef = useRef(new THREE.Vector2(0,0)); // Normalized Device Coordinates
  
  const [selectedStars, setSelectedStars] = useState<THREE.Mesh[]>([]);
  const selectedStarOriginalDataRef = useRef(new Map<string, { material: THREE.Material, scale: THREE.Vector3 }>());
  const currentlyHoveredStarRef = useRef<{ star: THREE.Mesh, originalColor: THREE.Color, originalScale: THREE.Vector3 } | null>(null);

  const [pinDisplay, setPinDisplay] = useState<string[]>(Array(PIN_LENGTH).fill('_'));
  const [internalPhase, setInternalPhase] = useState<PinModuleInternalPhase>('initializing');

  // Camera control state
  const isDraggingRef = useRef(false);
  const previousMousePosRef = useRef({ x: 0, y: 0 });
  const cameraAzimuthAngleRef = useRef(0); // Horizontal rotation around Y axis
  const cameraPolarAngleRef = useRef(Math.PI / 2); // Vertical rotation from Z axis (PI/2 is equatorial)
  const cameraRadiusRef = useRef(STAR_FIELD_RADIUS * 1.5); // Distance from origin

  const animationFrameIdRef = useRef<number | null>(null);

  // --- STEP 1: Construct the 3D Environment ---
  useEffect(() => {
    if (!mountRef.current || !renderer) return;
    console.log("PinEncryption: Step 1 - Constructing 3D Environment");
    const currentMount = mountRef.current;

    sceneRef.current = new THREE.Scene();
    cameraRef.current = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, STAR_FIELD_RADIUS * 5);
    cameraRef.current.position.set(0, 0, cameraRadiusRef.current);
    cameraRef.current.lookAt(0,0,0);

    starsGroupRef.current = new THREE.Group();
    sceneRef.current.add(starsGroupRef.current);

    const starGeometry = new THREE.SphereGeometry(0.1, 8, 8); // Simple sphere for stars

    for (let i = 0; i < STAR_COUNT; i++) {
      const randomHue = 0.55 + Math.random() * 0.2; // Blues to cyans, some yellows
      const randomSaturation = 0.6 + Math.random() * 0.4;
      const randomLightness = 0.5 + Math.random() * 0.3;
      const starColor = new THREE.Color().setHSL(randomHue, randomSaturation, randomLightness);
      if (Math.random() < 0.15) starColor.setHSL(0.15, 0.9, 0.7); // Pale yellow

      const starMaterial = new THREE.MeshBasicMaterial({
        color: starColor,
        transparent: true,
        opacity: DEFAULT_STAR_OPACITY * (0.7 + Math.random() * 0.3) // Varying brightness
      });

      const star = new THREE.Mesh(starGeometry.clone(), starMaterial);
      
      // Volumetric distribution (spherical)
      const r = Math.random() * STAR_FIELD_RADIUS;
      const phi = Math.acos(2 * Math.random() - 1); // inclination
      const theta = Math.random() * Math.PI * 2;   // azimuth
      star.position.setFromSphericalCoords(r, phi, theta);

      const baseScale = 0.7 + Math.random() * 0.8; // Varying size
      star.scale.set(baseScale, baseScale, baseScale);
      
      star.userData = { 
        isSelectable: true, 
        originalColor: starColor.clone(),
        originalScale: star.scale.clone(),
        baseOpacity: starMaterial.opacity,
        pulseOffset: Math.random() * Math.PI * 2, // For varied pulse
      };
      starsGroupRef.current.add(star);
    }

    linesGroupRef.current = new THREE.Group();
    sceneRef.current.add(linesGroupRef.current);

    // Event listeners for camera controls
    const handleMouseDown = (event: MouseEvent) => { isDraggingRef.current = true; previousMousePosRef.current = { x: event.clientX, y: event.clientY }; };
    const handleMouseUp = () => { if(isDraggingRef.current) isDraggingRef.current = false; else handleStarClick(event as unknown as MouseEvent);};
    const handleMouseLeave = () => { isDraggingRef.current = false; };
    const handleMouseMoveCam = (event: MouseEvent) => {
      if (isDraggingRef.current && cameraRef.current) {
        const deltaX = event.clientX - previousMousePosRef.current.x;
        const deltaY = event.clientY - previousMousePosRef.current.y;
        cameraAzimuthAngleRef.current -= deltaX * 0.005; // Adjust sensitivity
        cameraPolarAngleRef.current -= deltaY * 0.005;
        cameraPolarAngleRef.current = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPolarAngleRef.current)); // Clamp polar angle
        previousMousePosRef.current = { x: event.clientX, y: event.clientY };
        updateCameraPosition();
      }
      // Update mouseNDC for raycasting (even if not dragging)
      const rect = currentMount.getBoundingClientRect();
      mouseNDCRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNDCRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const handleWheel = (event: WheelEvent) => {
      if (!cameraRef.current) return;
      cameraRadiusRef.current += event.deltaY * 0.02; // Adjust sensitivity
      cameraRadiusRef.current = Math.max(STAR_FIELD_RADIUS * 0.3, Math.min(STAR_FIELD_RADIUS * 3, cameraRadiusRef.current)); // Clamp zoom
      updateCameraPosition();
    };

    currentMount.addEventListener('mousedown', handleMouseDown);
    currentMount.addEventListener('mouseup', handleMouseUp);
    currentMount.addEventListener('mouseleave', handleMouseLeave);
    currentMount.addEventListener('mousemove', handleMouseMoveCam);
    currentMount.addEventListener('wheel', handleWheel);

    const updateCameraPosition = () => {
      if(!cameraRef.current) return;
      cameraRef.current.position.set(
        cameraRadiusRef.current * Math.sin(cameraPolarAngleRef.current) * Math.sin(cameraAzimuthAngleRef.current),
        cameraRadiusRef.current * Math.cos(cameraPolarAngleRef.current),
        cameraRadiusRef.current * Math.sin(cameraPolarAngleRef.current) * Math.cos(cameraAzimuthAngleRef.current)
      );
      cameraRef.current.lookAt(0, 0, 0);
    };
    updateCameraPosition(); // Initial position

    const handleResize = () => {
        if (cameraRef.current && currentMount && renderer) {
            cameraRef.current.aspect = currentMount.clientWidth / currentMount.clientHeight;
            cameraRef.current.updateProjectionMatrix();
        }
    };
    window.addEventListener('resize', handleResize);
    
    setInternalPhase('active');
    console.log("PinEncryption: VERIFICATION GATE 1 PASSED - 3D Star-field navigable.");

    return () => {
      currentMount.removeEventListener('mousedown', handleMouseDown);
      currentMount.removeEventListener('mouseup', handleMouseUp);
      currentMount.removeEventListener('mouseleave', handleMouseLeave);
      currentMount.removeEventListener('mousemove', handleMouseMoveCam);
      currentMount.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);

      if (starsGroupRef.current) {
        starsGroupRef.current.children.forEach(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
        sceneRef.current?.remove(starsGroupRef.current);
      }
      if (linesGroupRef.current) {
        linesGroupRef.current.children.forEach(child => {
          if (child instanceof THREE.Line) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
        sceneRef.current?.remove(linesGroupRef.current);
      }
      starGeometry.dispose();
      selectedStarOriginalDataRef.current.clear();
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, [renderer]);


  // --- Animation Loop (for hover, pulse) ---
  useEffect(() => {
    if (internalPhase !== 'active' && internalPhase !== 'successFlash') {
      if(animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      return;
    }

    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      if (!sceneRef.current || !cameraRef.current || !starsGroupRef.current || !renderer) return;

      // Star pulsing
      starsGroupRef.current.children.forEach(starObj => {
        const star = starObj as THREE.Mesh;
        if (star.userData && star.userData.originalScale) {
          const pulseFactor = Math.sin(Date.now() * 0.002 + star.userData.pulseOffset) * 0.1 + 0.95;
          const currentScale = star.userData.originalScale.clone().multiplyScalar(pulseFactor);
          if(!star.userData.isSelected) star.scale.lerp(currentScale, 0.1);
        }
      });
      
      // --- STEP 2: Implement Interaction Logic (Hover) ---
      if (internalPhase === 'active' && !isDraggingRef.current) {
        raycasterRef.current.setFromCamera(mouseNDCRef.current, cameraRef.current);
        const intersects = raycasterRef.current.intersectObjects(starsGroupRef.current.children, false);

        // Revert previously hovered star if it's not the current one
        if (currentlyHoveredStarRef.current && 
            (!intersects.length || currentlyHoveredStarRef.current.star.uuid !== intersects[0].object.uuid) &&
            !(selectedStars.find(s => s.uuid === currentlyHoveredStarRef.current!.star.uuid)) // not selected
            ) {
          const prevStar = currentlyHoveredStarRef.current.star;
          (prevStar.material as THREE.MeshBasicMaterial).color.copy(currentlyHoveredStarRef.current.originalColor);
          (prevStar.material as THREE.MeshBasicMaterial).opacity = prevStar.userData.baseOpacity;
          prevStar.scale.copy(currentlyHoveredStarRef.current.originalScale);
          currentlyHoveredStarRef.current = null;
        }

        if (intersects.length > 0) {
          const firstIntersect = intersects[0].object as THREE.Mesh;
          if (firstIntersect.userData.isSelectable && !currentlyHoveredStarRef.current) {
            currentlyHoveredStarRef.current = { 
                star: firstIntersect, 
                originalColor: (firstIntersect.material as THREE.MeshBasicMaterial).color.clone(),
                originalScale: firstIntersect.scale.clone()
            };
            (firstIntersect.material as THREE.MeshBasicMaterial).color.copy(HOVER_STAR_COLOR);
            (firstIntersect.material as THREE.MeshBasicMaterial).opacity = 1.0;
            firstIntersect.scale.multiplyScalar(1.8);
          }
        }
      }
      renderer.render(sceneRef.current, cameraRef.current);
    };
    animate();
    return () => { if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); };
  }, [internalPhase, renderer, selectedStars]);


  const updatePinDisplayInternal = useCallback((count: number) => {
    setPinDisplay(Array(PIN_LENGTH).fill('_').map((_, i) => i < count ? '*' : '_'));
  }, []);

  // --- STEP 2: Implement Interaction Logic (Selection) & STEP 3: Visual Feedback (Lines) ---
  const handleStarClick = useCallback((event: MouseEvent) => {
    if (internalPhase !== 'active' || selectedStars.length >= PIN_LENGTH || !cameraRef.current || !starsGroupRef.current || isDraggingRef.current) return;
    
    // Ensure mouseNDC is up-to-date from the event that triggered the click (mouseup without drag)
    if (mountRef.current) {
        const rect = mountRef.current.getBoundingClientRect();
        mouseNDCRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseNDCRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    raycasterRef.current.setFromCamera(mouseNDCRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(starsGroupRef.current.children, false);

    if (intersects.length > 0) {
      const clickedStar = intersects[0].object as THREE.Mesh;
      if (clickedStar.userData.isSelectable && !selectedStars.find(s => s.uuid === clickedStar.uuid)) {
        console.log("Audio: Resonant musical note (single)");

        clickedStar.userData.isSelectable = false;
        clickedStar.userData.isSelected = true; // Mark for pulse logic
        
        // Store original material & scale before changing
        selectedStarOriginalDataRef.current.set(clickedStar.uuid, {
            material: (clickedStar.material as THREE.Material).clone(), // Clone the material
            scale: clickedStar.scale.clone()
        });

        (clickedStar.material as THREE.MeshBasicMaterial).color.copy(SELECTED_STAR_COLOR);
        (clickedStar.material as THREE.MeshBasicMaterial).opacity = 1.0;
        clickedStar.scale.copy(clickedStar.userData.originalScale.clone().multiplyScalar(1.5)); // Keep it slightly larger


        const newSelectedStars = [...selectedStars, clickedStar];
        setSelectedStars(newSelectedStars);
        updatePinDisplayInternal(newSelectedStars.length);
        console.log(`PinEncryption: Star ${newSelectedStars.length} selected. Gate 2 progress.`);


        // --- STEP 3: Dynamic Line Drawing ---
        if (newSelectedStars.length >= 2 && linesGroupRef.current) {
          const prevStar = newSelectedStars[newSelectedStars.length - 2];
          const lineMaterial = new THREE.LineBasicMaterial({ color: LINE_COLOR, linewidth: 2, transparent:true, opacity:0.8 });
          const points = [prevStar.position.clone(), clickedStar.position.clone()];
          const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(lineGeometry, lineMaterial);
          linesGroupRef.current.add(line);
          console.log(`PinEncryption: Line drawn for star ${newSelectedStars.length}. Gate 3 progress.`);
        }

        if (newSelectedStars.length === PIN_LENGTH) {
          console.log("PinEncryption: VERIFICATION GATE 2 PASSED - Up to 6 stars selectable and turn green.");
          console.log("PinEncryption: VERIFICATION GATE 3 PASSED - Energy lines connect selected stars.");
          console.log("Audio: Resolving musical chord");
          setInternalPhase('successFlash');

          // Flash constellation
          const allConstellationObjects = [...newSelectedStars, ...(linesGroupRef.current?.children || [])];
          allConstellationObjects.forEach(obj => {
            if (obj instanceof THREE.Mesh) (obj.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
            if (obj instanceof THREE.Line) (obj.material as THREE.LineBasicMaterial).color.setHex(0xffffff);
          });

          setTimeout(() => {
            newSelectedStars.forEach(star => (star.material as THREE.MeshBasicMaterial).color.copy(SELECTED_STAR_COLOR));
            linesGroupRef.current?.children.forEach(line => {
              if (line instanceof THREE.Line) (line.material as THREE.LineBasicMaterial).color.copy(LINE_COLOR);
            });

            const constellationGroup = new THREE.Group();
            newSelectedStars.forEach(s => constellationGroup.add(s.clone(true))); // Deep clone stars
            if (linesGroupRef.current) {
                linesGroupRef.current.children.forEach(l => constellationGroup.add(l.clone(true))); // Deep clone lines
            }
            
            console.log("AI Voice: Entanglement key registered. Your constellation is now your signature.");
            onPinSuccess(constellationGroup);
            
            // Start fading out module
            if (mountRef.current) mountRef.current.style.opacity = '0';
            setInternalPhase('fadingOut');
            setTimeout(() => onModuleComplete(), 1000); // Match CSS transition for fade
          }, 600); // Flash duration
        }
      }
    }
  }, [internalPhase, selectedStars, updatePinDisplayInternal, onPinSuccess, onModuleComplete]);

  // --- STEP 4: Render the UI Overlay (Reset Logic) ---
  const handleResetClick = () => {
    if (internalPhase !== 'active') return;
    console.log("AI Voice: Clearing sequence. Please select a new constellation.");
    onReset(); // For AI voice in CalibrationSequence

    selectedStars.forEach(star => {
      const originalData = selectedStarOriginalDataRef.current.get(star.uuid);
      if (originalData) {
        star.material = originalData.material; // Restore cloned original material
        star.scale.copy(originalData.scale);
      }
      star.userData.isSelectable = true;
      star.userData.isSelected = false;
    });
    setSelectedStars([]);
    selectedStarOriginalDataRef.current.clear();
    updatePinDisplayInternal(0);

    if (linesGroupRef.current) {
      linesGroupRef.current.children.forEach(child => {
        if (child instanceof THREE.Line || child instanceof THREE.Mesh) { // Mesh if cylinders were used
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      linesGroupRef.current.children = []; // Clear lines
    }
    
    // Reset hover state
    if(currentlyHoveredStarRef.current) {
        const prevStar = currentlyHoveredStarRef.current.star;
        (prevStar.material as THREE.MeshBasicMaterial).color.copy(currentlyHoveredStarRef.current.originalColor);
        (prevStar.material as THREE.MeshBasicMaterial).opacity = prevStar.userData.baseOpacity;
        prevStar.scale.copy(currentlyHoveredStarRef.current.originalScale);
        currentlyHoveredStarRef.current = null;
    }
    console.log("PinEncryption: Sigil Reset.");
  };

  // UI rendering only after phase is 'active' or 'successFlash'
  const shouldRenderUI = internalPhase === 'active' || internalPhase === 'successFlash';

  return (
    <div 
        ref={mountRef} 
        className="absolute inset-0 bg-black pointer-events-auto transition-opacity duration-1000"
        style={{ opacity: internalPhase === 'initializing' ? 0 : 1 }} 
        // Mouse move for raycasting is handled by useEffect listener on mountRef
    >
      {/* Step 4: UI Overlay - Rendered conditionally */}
      {shouldRenderUI && (
        <>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex space-x-2 p-2 bg-black/40 rounded-md backdrop-blur-sm">
            {pinDisplay.map((char, index) => (
              <span key={index} className="text-3xl font-roboto-mono text-cyan-300 w-8 text-center animate-fadeIn" style={{animationDelay: `${index * 0.1}s`}}>
                {char}
              </span>
            ))}
          </div>

          <button
            onClick={handleResetClick}
            className="absolute bottom-6 right-6 p-3 text-cyan-300 hover:text-white border-2 border-cyan-600 hover:border-cyan-300 rounded-lg transition-all
                       bg-black/40 backdrop-blur-sm hover:bg-cyan-700/50 shadow-md animate-fadeIn"
            style={{animationDelay: '0.5s'}}
            title="Reset PIN Constellation"
            disabled={internalPhase !== 'active'}
          >
            <ArrowPathIcon className="w-7 h-7" />
          </button>
        </>
      )}
    </div>
  );
};

export default PinEncryptionModule;
      