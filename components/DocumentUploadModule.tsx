import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { DocumentArrowUpIcon, CubeIcon } from './icons'; // Using CubeIcon for PDF representation

interface DocumentUploadModuleProps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  onSuccess: (object3D: THREE.Object3D) => void;
  onFailure: () => void;
  // Callbacks for CalibrationSequence interaction
  triggerCameraRecoil: () => void;
  panCameraToTarget: (targetPosition: THREE.Vector3 | null) => void;
  updateEnvironmentForComet: (cometPosition: THREE.Vector3) => void;
  triggerShockwaveEffect: () => void;
}

type ModulePhase =
  | 'idle'
  | 'awaitingFile'
  | 'implodingIcon' // Icon flickers, glitches, absorbs light, compresses to singularity
  | 'cometLaunch'   // Singularity erupts into a data-comet
  | 'cometTransit'  // Comet streaks through Data Core, environment reacts
  | 'blueprintFormation' // Comet explodes, wireframe blueprint appears
  | 'forgingObject' // Particles weld the wireframe into a solid object
  | 'finalizingObject' // Shockwave, molten core, embers
  | 'materialized'  // Object fully formed and settled
  | 'error';

interface ScreenParticle { // For 2D screen-space effects like light absorption
  id: string;
  x: number; y: number; // current position
  vx: number; vy: number; // velocity
  opacity: number; size: number; color: string;
  life: number; // remaining life
  startX: number; startY: number; // initial position for complex paths
  endX: number; endY: number; // target for absorption
  progress: number; // for interpolation
}

const generateId = () => Math.random().toString(36).substring(2, 9);

// Helper to get a point on the screen border
const getRandomBorderPoint = (containerWidth: number, containerHeight: number) => {
    const side = Math.floor(Math.random() * 4);
    switch (side) {
        case 0: return { x: Math.random() * containerWidth, y: -20 }; // Top
        case 1: return { x: containerWidth + 20, y: Math.random() * containerHeight }; // Right
        case 2: return { x: Math.random() * containerWidth, y: containerHeight + 20 }; // Bottom
        default: return { x: -20, y: Math.random() * containerHeight }; // Left
    }
};


const DocumentUploadModule: React.FC<DocumentUploadModuleProps> = ({
  scene, camera, renderer, onSuccess, onFailure,
  triggerCameraRecoil, panCameraToTarget, updateEnvironmentForComet, triggerShockwaveEffect
}) => {
  const [phase, setPhase] = useState<ModulePhase>('idle');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileType, setSelectedFileType] = useState<'pdf' | 'doc' | 'txt' | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [uiBlockInteraction, setUiBlockInteraction] = useState(false);
  
  const [screenParticles, setScreenParticles] = useState<ScreenParticle[]>([]);
  const [showSingularity, setShowSingularity] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const moduleContainerRef = useRef<HTMLDivElement>(null);
  const iconContainerRef = useRef<HTMLDivElement>(null); // For icon position

  const dataCometRef = useRef<THREE.Mesh | null>(null);
  const wireframeObjectRef = useRef<THREE.Mesh | null>(null);
  const solidObjectRef = useRef<THREE.Mesh | null>(null);
  const forgingParticlesRef = useRef<THREE.Points | null>(null);
  const shockwaveMeshRef = useRef<THREE.Mesh | null>(null);
  const emberParticlesRef = useRef<THREE.Points | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    setPhase('awaitingFile');
    return () => { // Cleanup on unmount
      if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      // Dispose all THREE objects created by this module
      [dataCometRef, wireframeObjectRef, solidObjectRef, forgingParticlesRef, shockwaveMeshRef, emberParticlesRef].forEach(ref => {
          if (ref.current) {
              scene.remove(ref.current);
              if (ref.current.geometry) ref.current.geometry.dispose();
              if ((ref.current as THREE.Mesh).material) {
                const mat = (ref.current as THREE.Mesh).material;
                if (Array.isArray(mat)) mat.forEach(m => m.dispose());
                else mat.dispose();
              }
              ref.current = null;
          }
      });
    };
  }, [scene]);

  const getFileType = (fileName: string): 'pdf' | 'doc' | 'txt' | null => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') return 'pdf';
    if (extension === 'doc' || extension === 'docx') return 'doc';
    if (extension === 'txt') return 'txt';
    return null;
  };

  const handleFileSelectClick = () => {
    if (uiBlockInteraction || phase !== 'awaitingFile' && phase !== 'error') return;
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
        setUiBlockInteraction(true);
        setPhase('implodingIcon');
        console.log(`File selected: ${file.name}, type: ${fileType}`);
      } else {
        setFeedbackMessage("Incompatible data format. Please select a .pdf, .doc(x), or .txt file.");
        setPhase('error');
        onFailure();
        console.log("Audio: ERROR SOUND");
        console.log("AI Voice: Upload failed. Incompatible data format. Please select a valid document.");
      }
    }
    if (event.target) event.target.value = '';
  };

  // Phase: implodingIcon
  useEffect(() => {
    if (phase === 'implodingIcon' && iconContainerRef.current && moduleContainerRef.current) {
      console.log("Audio: DEEP CHARGING HUM (rising pitch)");
      const iconRect = iconContainerRef.current.getBoundingClientRect();
      const moduleRect = moduleContainerRef.current.getBoundingClientRect();
      const targetX = iconRect.left - moduleRect.left + iconRect.width / 2;
      const targetY = iconRect.top - moduleRect.top + iconRect.height / 2;

      // Create screen particles for light absorption
      const newScreenParticles: ScreenParticle[] = [];
      for (let i = 0; i < 50; i++) {
        const startPos = getRandomBorderPoint(moduleRect.width, moduleRect.height);
        newScreenParticles.push({
          id: generateId(), x: startPos.x, y: startPos.y,
          vx:0, vy:0, // Will be interpolated
          opacity: 0, size: Math.random() * 2 + 1,
          color: Math.random() > 0.3 ? 'rgba(0, 255, 255, 0.7)' : 'rgba(200, 200, 255, 0.6)',
          life: 100, startX: startPos.x, startY: startPos.y, endX: targetX, endY: targetY, progress: 0,
        });
      }
      setScreenParticles(newScreenParticles);
      
      // Icon compresses after a short delay for glitching
      setTimeout(() => {
        setShowSingularity(true); // Triggers CSS animation for compression
      }, 300); // Glitch time

      // After compression animation (0.7s defined in CSS) + small buffer
      setTimeout(() => {
        console.log("Audio: Sharp CRACK (Singularity formed)");
        triggerCameraRecoil();
        setShowSingularity(false); // Hide the 2D singularity dot
        setScreenParticles([]); // Clear absorption particles
        if(iconContainerRef.current) iconContainerRef.current.style.opacity = '0'; // Hide original icon
        
        console.log("Audio: Moment of SILENCE");
        setTimeout(() => {
          setPhase('cometLaunch');
        }, 100); // Brief silence
      }, 300 + 700 + 50); 
    }
  }, [phase, triggerCameraRecoil]);

  // Screen particle animation (for absorption)
  useEffect(() => {
    if (phase === 'implodingIcon' && screenParticles.length > 0) {
      const animLogic = () => {
        setScreenParticles(prev =>
          prev.map(p => {
            const newProgress = Math.min(1, p.progress + 0.03); // Speed of absorption
            return {
              ...p,
              progress: newProgress,
              x: THREE.MathUtils.lerp(p.startX, p.endX, newProgress),
              y: THREE.MathUtils.lerp(p.startY, p.endY, newProgress),
              opacity: THREE.MathUtils.lerp(0.8, 0, newProgress) + (1-newProgress)*0.1, // Fade in then mostly out
              life: p.life -1,
            };
          }).filter(p => p.life > 0 && p.progress < 1)
        );
      };
      animationFrameId.current = requestAnimationFrame(animLogic);
      return () => { if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
    } else {
        setScreenParticles([]); // Ensure cleared if phase changes
    }
  }, [screenParticles, phase]);


  // Phase: cometLaunch & cometTransit
  useEffect(() => {
    if (phase === 'cometLaunch') {
      console.log("Audio: CANNON BOOM (Concussive, with echo)");
      panCameraToTarget(new THREE.Vector3(0,0,-20)); // Aim camera towards where comet will go

      const cometGeometry = new THREE.SphereGeometry(0.3, 16, 16); // Small, bright core
      const cometMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
      const comet = new THREE.Mesh(cometGeometry, cometMaterial);
      
      // Add a tail using THREE.Points or a custom shader. For simplicity, we'll use a PointLight as a simple bright core.
      const pointLight = new THREE.PointLight(0x00ffff, 5, 50, 1.5); // color, intensity, distance, decay
      comet.add(pointLight);

      // Start near camera, slightly off-center if desired
      const startPos = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        camera.position.z + camera.near + 1 // Start in front of camera near plane
      );
      // Convert to world space if camera is not at origin or rotated significantly
      // For simplicity here, assuming camera is mostly forward-facing from origin for calibration module
      comet.position.copy(startPos);


      scene.add(comet);
      dataCometRef.current = comet;
      setPhase('cometTransit');
    }

    if (phase === 'cometTransit' && dataCometRef.current) {
      const comet = dataCometRef.current;
      const targetPosition = new THREE.Vector3(0, 0, -25); // Central point in Data Core
      const duration = 1.5 * 1000; // 1.5 seconds transit
      const startTime = Date.now();

      const animateComet = () => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        comet.position.lerpVectors(comet.position, targetPosition, progress * 0.1); // Ease towards target
        updateEnvironmentForComet(comet.position);

        if (progress < 1) {
          animationFrameId.current = requestAnimationFrame(animateComet);
        } else {
          setPhase('blueprintFormation');
        }
      };
      animateComet();
      return () => { if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
    }
  }, [phase, scene, camera, panCameraToTarget, updateEnvironmentForComet]);


  // Phase: blueprintFormation, forgingObject, finalizingObject
  useEffect(() => {
    // Blueprint Formation
    if (phase === 'blueprintFormation' && selectedFileType) {
      console.log("Audio: SILENT FLASH, then humming potential (Blueprint forming)");
      if (dataCometRef.current) { // Comet "explodes"
        scene.remove(dataCometRef.current);
        dataCometRef.current.geometry.dispose();
        (dataCometRef.current.material as THREE.Material).dispose();
        dataCometRef.current = null;
      }
      
      // Create a flash effect (e.g., rapidly expanding sprite or light)
      const flashMaterial = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false });
      const flashSprite = new THREE.Sprite(flashMaterial);
      flashSprite.position.set(0,0,-25); // Where comet ended
      flashSprite.scale.set(0.1, 0.1, 0.1);
      scene.add(flashSprite);
      let flashStart = Date.now();
      const flashAnim = () => {
          const elapsed = Date.now() - flashStart;
          if(elapsed < 200){ // 0.2 sec flash
              const p = elapsed / 200;
              flashSprite.scale.set(p*20, p*20, 1);
              flashSprite.material.opacity = 0.9 * (1-p);
              requestAnimationFrame(flashAnim);
          } else {
              scene.remove(flashSprite);
              flashSprite.material.dispose();
          }
      };
      flashAnim();


      let geometry: THREE.BufferGeometry;
      switch (selectedFileType) {
        case 'pdf': geometry = new THREE.BoxGeometry(2, 2, 2); break;
        case 'doc': geometry = new THREE.CylinderGeometry(0.5, 0.5, 3, 16); geometry.rotateX(Math.PI / 2); geometry.scale(1,1,0.7); break;
        case 'txt': geometry = new THREE.BoxGeometry(2, 3, 0.2); break;
        default: geometry = new THREE.SphereGeometry(1, 16, 16);
      }
      
      const wireframeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.7 });
      const wireframe = new THREE.Mesh(geometry.clone(), wireframeMaterial); // Use clone for wireframe
      wireframe.position.set(0, 0, -25); // Position in Data Core
      wireframe.rotation.y = Math.random() * Math.PI;
      scene.add(wireframe);
      wireframeObjectRef.current = wireframe;

      // Solid object (initially invisible)
      const solidMaterial = new THREE.MeshStandardMaterial({
        color: 0x00BFFF, emissive: 0x003366, transparent: true, opacity: 0,
        roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide
      });
      const solid = new THREE.Mesh(geometry, solidMaterial); // Use original geometry
      solid.position.copy(wireframe.position);
      solid.rotation.copy(wireframe.rotation);
      scene.add(solid);
      solidObjectRef.current = solid;

      // Forging particles (remnants of comet explosion)
      const particleCount = 200;
      const particlePositions = new Float32Array(particleCount * 3);
      const particleColors = new Float32Array(particleCount * 3);
      const particleAlphas = new Float32Array(particleCount);
      const color = new THREE.Color();
      for (let i = 0; i < particleCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 3 + Math.random() * 3; // Spread around blueprint
        particlePositions[i*3+0] = wireframe.position.x + radius * Math.sin(phi) * Math.cos(theta);
        particlePositions[i*3+1] = wireframe.position.y + radius * Math.sin(phi) * Math.sin(theta);
        particlePositions[i*3+2] = wireframe.position.z + radius * Math.cos(phi);
        color.setHSL(0.5 + Math.random()*0.1, 0.8, 0.6); // Cyan-ish
        particleColors[i*3+0] = color.r; particleColors[i*3+1] = color.g; particleColors[i*3+2] = color.b;
        particleAlphas[i] = 1.0;
      }
      const pGeom = new THREE.BufferGeometry();
      pGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      pGeom.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
      pGeom.setAttribute('alpha', new THREE.BufferAttribute(particleAlphas, 1)); // Custom attribute for alpha
      
      // Custom shader material for forging particles
      const pMaterial = new THREE.ShaderMaterial({
          uniforms: { pointTexture: { value: new THREE.TextureLoader().load('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==') } }, // simple white circle
          vertexShader: `
              attribute float alpha;
              varying float vAlpha;
              varying vec3 vColor;
              attribute vec3 color;
              void main() {
                  vAlpha = alpha;
                  vColor = color;
                  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                  gl_PointSize = (20.0 / -mvPosition.z) * (vAlpha + 0.1); // Size attenuation + alpha influence
                  gl_Position = projectionMatrix * mvPosition;
              }`,
          fragmentShader: `
              uniform sampler2D pointTexture;
              varying float vAlpha;
              varying vec3 vColor;
              void main() {
                  if (vAlpha <= 0.0) discard;
                  gl_FragColor = vec4(vColor, vAlpha) * texture2D(pointTexture, gl_PointCoord);
              }`,
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true
      });

      const particles = new THREE.Points(pGeom, pMaterial);
      forgingParticlesRef.current = particles;
      scene.add(particles);

      setTimeout(() => setPhase('forgingObject'), 500); // Delay before forging starts
    }

    // Forging Object
    if (phase === 'forgingObject' && wireframeObjectRef.current && solidObjectRef.current && forgingParticlesRef.current) {
      console.log("Audio: High-frequency WELDING/SIZZLING");
      const wireframe = wireframeObjectRef.current;
      const solid = solidObjectRef.current;
      const particles = forgingParticlesRef.current;
      const particlePositions = particles.geometry.attributes.position.array as Float32Array;
      const particleAlphas = particles.geometry.attributes.alpha.array as Float32Array;
      
      const duration = 2.0 * 1000; // 2 seconds forging
      const startTime = Date.now();
      const initialParticlePositions = new Float32Array(particlePositions); // Store initial positions for lerping

      const animateForging = () => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic

        (wireframe.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - easedProgress);
        (solid.material as THREE.MeshStandardMaterial).opacity = easedProgress * 0.9; // Solid becomes visible

        // Particles converge onto the solid object's surface (simplified to center)
        for (let i = 0; i < particleAlphas.length; i++) {
          particlePositions[i*3+0] = THREE.MathUtils.lerp(initialParticlePositions[i*3+0], solid.position.x, easedProgress);
          particlePositions[i*3+1] = THREE.MathUtils.lerp(initialParticlePositions[i*3+1], solid.position.y, easedProgress);
          particlePositions[i*3+2] = THREE.MathUtils.lerp(initialParticlePositions[i*3+2], solid.position.z, easedProgress);
          particleAlphas[i] = 1.0 * (1 - easedProgress * 0.95); // Fade out as they reach
        }
        particles.geometry.attributes.position.needsUpdate = true;
        particles.geometry.attributes.alpha.needsUpdate = true;

        if (progress < 1) {
          animationFrameId.current = requestAnimationFrame(animateForging);
        } else {
          scene.remove(wireframe); wireframe.geometry.dispose(); (wireframe.material as THREE.Material).dispose(); wireframeObjectRef.current = null;
          scene.remove(particles); particles.geometry.dispose(); (particles.material as THREE.Material).dispose(); forgingParticlesRef.current = null;
          setPhase('finalizingObject');
        }
      };
      animateForging();
      return () => { if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
    }

    // Finalizing Object (Shockwave, Embers)
    if (phase === 'finalizingObject' && solidObjectRef.current) {
      console.log("Audio: Resonant METALLIC CLANG, then deep fading HUM (Shockwave)");
      const solid = solidObjectRef.current;
      triggerShockwaveEffect(); // Notify CalibrationSequence for potential post-proc

      // Create 3D shockwave mesh
      const shockwaveGeom = new THREE.RingGeometry(0.1, 0.2, 64); // innerRadius, outerRadius, segments
      const shockwaveMat = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide 
      });
      const shockwave = new THREE.Mesh(shockwaveGeom, shockwaveMat);
      shockwave.position.copy(solid.position);
      shockwave.lookAt(camera.position); // Orient towards camera
      scene.add(shockwave);
      shockwaveMeshRef.current = shockwave;
      
      // Molten core effect (simple emissive pulse)
      const mat = solid.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x00ffff); // Bright cyan emissive
      mat.emissiveIntensity = 1.5;
      
      // Embers
      const emberCount = 50;
      const emberPositions = new Float32Array(emberCount * 3);
      const emberVelocities = new Float32Array(emberCount * 3); // For movement
      const emberLifes = new Float32Array(emberCount);
      const baseColor = new THREE.Color(0xffaa33); // Orange-yellow
      const emberColors = new Float32Array(emberCount * 3);

      for (let i = 0; i < emberCount; i++) {
          // Start on surface of the object (approximate for now)
          emberPositions[i * 3 + 0] = solid.position.x + (Math.random() - 0.5) * 2;
          emberPositions[i * 3 + 1] = solid.position.y + (Math.random() - 0.5) * 2;
          emberPositions[i * 3 + 2] = solid.position.z + (Math.random() - 0.5) * 2;
          emberVelocities[i * 3 + 0] = (Math.random() - 0.5) * 0.03;
          emberVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.03;
          emberVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.03;
          emberLifes[i] = 0.5 + Math.random() * 1.0; // 0.5 to 1.5 seconds life
          
          const c = baseColor.clone().offsetHSL(0, (Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2);
          emberColors[i*3+0] = c.r; emberColors[i*3+1] = c.g; emberColors[i*3+2] = c.b;
      }
      const emberGeom = new THREE.BufferGeometry();
      emberGeom.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
      emberGeom.setAttribute('velocity', new THREE.BufferAttribute(emberVelocities, 3));
      emberGeom.setAttribute('life', new THREE.BufferAttribute(emberLifes, 1));
      emberGeom.setAttribute('color', new THREE.BufferAttribute(emberColors, 3));

      const emberMaterial = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      const embers = new THREE.Points(emberGeom, emberMaterial);
      emberParticlesRef.current = embers;
      scene.add(embers);

      const duration = 2.5 * 1000; // Total finalizing duration
      const startTime = Date.now();

      const animateFinalizing = () => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / duration, 1);

        // Shockwave animation
        if (shockwaveMeshRef.current) {
          const sw = shockwaveMeshRef.current;
          const swProgress = Math.min(elapsedTime / (duration * 0.4), 1); // Shockwave faster
          sw.scale.setScalar(1 + swProgress * 30); // Expands up to 30x size
          (sw.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - swProgress);
          if (swProgress >= 1) { scene.remove(sw); sw.geometry.dispose(); (sw.material as THREE.Material).dispose(); shockwaveMeshRef.current = null; }
        }

        // Embers animation
        if (emberParticlesRef.current) {
            const positions = emberParticlesRef.current.geometry.attributes.position.array as Float32Array;
            const velocities = emberParticlesRef.current.geometry.attributes.velocity.array as Float32Array;
            const lifes = emberParticlesRef.current.geometry.attributes.life.array as Float32Array;
            let activeEmbers = 0;
            for (let i = 0; i < emberCount; i++) {
                lifes[i] -= 0.016; // Approx 1/60th of a second
                if (lifes[i] > 0) {
                    activeEmbers++;
                    positions[i * 3 + 0] += velocities[i * 3 + 0];
                    positions[i * 3 + 1] += velocities[i * 3 + 1];
                    positions[i * 3 + 2] += velocities[i * 3 + 2];
                    velocities[i * 3 + 1] -= 0.0005; // Gravity on embers
                }
            }
            emberParticlesRef.current.geometry.attributes.position.needsUpdate = true;
            emberParticlesRef.current.geometry.attributes.life.needsUpdate = true; // For potential shader use
            (emberParticlesRef.current.material as THREE.PointsMaterial).opacity = 0.9 * Math.max(0, (1 - progress * 0.8)); // Fade all embers over time

            if (activeEmbers === 0 && progress > 0.5) { // Ensure embers had time to live
                scene.remove(emberParticlesRef.current);
                emberParticlesRef.current.geometry.dispose();
                (emberParticlesRef.current.material as THREE.PointsMaterial).dispose();
                emberParticlesRef.current = null;
            }
        }
        
        // Molten core cools down
        mat.emissiveIntensity = 1.5 * (1 - progress);

        if (progress < 1) {
          animationFrameId.current = requestAnimationFrame(animateFinalizing);
        } else {
          setPhase('materialized');
        }
      };
      animateFinalizing();
      return () => { if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
    }
    
    // Materialized
    if (phase === 'materialized' && solidObjectRef.current) {
      console.log("AI Voice: Data-construct received and materialized.");
      onSuccess(solidObjectRef.current); // Pass the final solid object
      panCameraToTarget(null); // Reset camera pan
      setUiBlockInteraction(false);
    }

  }, [phase, selectedFileType, scene, camera, onSuccess, triggerShockwaveEffect, panCameraToTarget]);


  const renderFileIconForImplosion = () => {
    if (!selectedFileType) return null;
    let iconContent;
    switch (selectedFileType) {
        case 'pdf': iconContent = <CubeIcon className="w-16 h-16 text-cyan-300" />; break;
        case 'doc': iconContent = <span className="text-4xl text-cyan-300 font-bold">[DOC]</span>; break;
        case 'txt': iconContent = <span className="text-4xl text-cyan-300 font-bold">[TXT]</span>; break;
        default: return null;
    }
    return (
        <div ref={iconContainerRef} className={`absolute inset-0 flex items-center justify-center 
            ${phase === 'implodingIcon' ? 'animate-icon-glitch' : ''}
            ${showSingularity ? 'animate-icon-compress' : ''}
            transition-opacity duration-200`}
            style={{opacity: (phase === 'awaitingFile' || phase === 'error' || phase === 'idle') ? 0 : 1 }}
        >
            {iconContent}
        </div>
    );
  };

  return (
    <div ref={moduleContainerRef} className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto overflow-hidden">
      {/* File Select Button */}
      {(phase === 'awaitingFile' || phase === 'error') && !uiBlockInteraction && (
        <>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.txt" />
          <button
            onClick={handleFileSelectClick}
            className={`relative w-72 h-16 border font-exo2-regular text-lg text-white
                        rounded-full flex items-center justify-center overflow-hidden group
                        transition-all duration-300 ease-in-out focus:outline-none 
                        ${phase === 'error' ? 'bg-red-500/30 border-red-500 hover:bg-red-500/50 hover:border-red-300 animate-pulse' 
                                            : 'bg-cyan-500/10 border-cyan-500 hover:bg-cyan-500/30 hover:border-cyan-300 hover:shadow-[0_0_15px_rgba(0,191,255,0.5)]'}
                        animate-fadeIn`}
            style={{ animationDelay: '0.5s' }}
          >
            <DocumentArrowUpIcon className="w-6 h-6 mr-3"/>
            <span className="relative z-10">SELECT FILE</span>
          </button>
          {feedbackMessage && <p className="mt-4 text-red-400 text-sm animate-fadeIn">{feedbackMessage}</p>}
        </>
      )}

      {/* Icon Display Area for Implosion (managed by renderFileIconForImplosion) */}
      <div className="w-32 h-32 relative pointer-events-none">
         {renderFileIconForImplosion()}
      </div>

      {/* 2D Screen Particles for light absorption */}
      {screenParticles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.x, top: p.y, width: p.size, height: p.size,
            backgroundColor: p.color, opacity: p.opacity,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
      
      {/* UI Shockwave overlay as a simple div animation for dramatic screen effect */}
      {phase === 'finalizingObject' && (
        <div 
            className="absolute inset-0 border-2 border-cyan-300 rounded-full animate-ui-shockwave-pulse pointer-events-none"
            style={{ transformOrigin: 'center center' }}
        ></div>
      )}

    </div>
  );
};

export default DocumentUploadModule;