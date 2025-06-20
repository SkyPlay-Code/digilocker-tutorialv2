
import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import GravityWell from './GravityWell'; // Import the new component

// Removed ChevronDownIcon import as it's no longer used

interface HeroSectionProps {
  onInitiateCalibration: () => void;
  onMapDataStream: () => void;
}

const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2() },
    power: { value: 0.0015 } 
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float power;
    varying vec2 vUv;
    void main() {
      vec2 slightlyOff = power / resolution.x * vec2(1.0, 1.0) * ( (vUv - 0.5) * 2.0 );
      vec4 cr = texture2D(tDiffuse, vUv + slightlyOff);
      vec4 cga = texture2D(tDiffuse, vUv);
      vec4 cb = texture2D(tDiffuse, vUv - slightlyOff);
      gl_FragColor = vec4(cr.r, cga.g, cb.b, cga.a);
    }
  `
};

type TitleAnimationPhase = 'ingress' | 'chaoticSwarm' | 'coalescenceFlash' | 'settled';


const InitiateCalibrationOrb: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isMouseDown, setIsMouseDown] = useState(false);
    const [lightningPaths, setLightningPaths] = useState<string[]>([]);
    const orbButtonRef = useRef<HTMLButtonElement>(null);
    const lightningIntervalRef = useRef<number | null>(null);
    const [showFlash, setShowFlash] = useState(false);
    const [currentOrbDiameter, setCurrentOrbDiameter] = useState(120); 

    useEffect(() => {
        if (orbButtonRef.current) {
            setCurrentOrbDiameter(orbButtonRef.current.offsetWidth);
        }
        const handleResize = () => {
            if (orbButtonRef.current) {
                setCurrentOrbDiameter(orbButtonRef.current.offsetWidth);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);


    const generateLightning = useCallback(() => {
        if (!orbButtonRef.current || !isHovered || isMouseDown) return;
        const newPaths: string[] = [];
        const numArcs = Math.floor(Math.random() * 2) + 2; 
        
        const orbDiameter = currentOrbDiameter;
        const coreDiameter = orbDiameter * 0.5; 
        const lensInnerDiameter = orbDiameter * 0.95; 

        const coreRadius = coreDiameter / 2;
        const lensInnerRadius = lensInnerDiameter / 2;
        const orbCenter = orbDiameter / 2;


        for (let i = 0; i < numArcs; i++) {
            const angleStart = Math.random() * 2 * Math.PI;
            const startX = orbCenter + coreRadius * Math.cos(angleStart);
            const startY = orbCenter + coreRadius * Math.sin(angleStart);
            let path = `M${startX.toFixed(2)} ${startY.toFixed(2)}`;

            const angleEnd = angleStart + (Math.random() - 0.5) * (Math.PI / 4); 
            const endXUnconstrained = orbCenter + lensInnerRadius * Math.cos(angleEnd);
            const endYUnconstrained = orbCenter + lensInnerRadius * Math.sin(angleEnd);
            
            const endX = endXUnconstrained;
            const endY = endYUnconstrained;

            const segments = Math.floor(Math.random() * 3) + 3; 
            let currentX = startX;
            let currentY = startY;
            const totalArcVecX = endX - startX;
            const totalArcVecY = endY - startY;

            for (let j = 1; j <= segments; j++) {
                const progress = j / segments;
                const midX = startX + totalArcVecX * progress;
                const midY = startY + totalArcVecY * progress;

                const perpAngle = angleStart + Math.PI / 2;
                const displacementFactor = (Math.random() - 0.5) * (coreRadius * 0.25); 
                
                const nextX = midX + displacementFactor * Math.cos(perpAngle);
                const nextY = midY + displacementFactor * Math.sin(perpAngle);
                
                path += ` L${nextX.toFixed(2)} ${nextY.toFixed(2)}`;
                currentX = nextX;
                currentY = nextY;
            }
            newPaths.push(path);
        }
        setLightningPaths(newPaths);
    }, [currentOrbDiameter, isHovered, isMouseDown]);

    useEffect(() => {
        if (isHovered && !isMouseDown) {
            generateLightning();
            lightningIntervalRef.current = window.setInterval(generateLightning, 150 + Math.random() * 100); 
        } else {
            if (lightningIntervalRef.current) clearInterval(lightningIntervalRef.current);
            setLightningPaths([]);
        }
        return () => {
            if (lightningIntervalRef.current) clearInterval(lightningIntervalRef.current);
        };
    }, [isHovered, isMouseDown, generateLightning]);
    
    const handleMouseDownCb = () => {
      if (isMouseDown || showFlash) return;
      setIsMouseDown(true);
      setShowFlash(true);
      
      setTimeout(() => {
        onClick(); 
        setTimeout(() => {
            setIsMouseDown(false);
            setShowFlash(false);
        }, 400) 
      }, 380); 
    };

    return (
        <button
            ref={orbButtonRef}
            onClick={handleMouseDownCb}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {setIsHovered(false); setLightningPaths([]);} }
            className={`relative rounded-full flex items-center justify-center
                        font-exo2-bold text-white text-center cursor-pointer
                        transition-all duration-300 ease-in-out group
                        focus:outline-none isolate
                        w-[8vw] h-[8vw] max-w-[120px] max-h-[120px]
                        ${isMouseDown ? 'scale-[0.9]' : ''}
                        ${isHovered && !isMouseDown ? 'animate-orb-unstable-flicker' : (!isMouseDown && !showFlash ? 'animate-orb-deep-thrum-glow' : '')}
                      `}
            style={{
                filter: (isHovered && !isMouseDown) ? 
                    'drop-shadow(0 0 10px #00BFFF) drop-shadow(0 0 18px #00BFFF) brightness(0.95)' : 
                    (!isMouseDown && !showFlash ? 
                        'drop-shadow(0 0 12px #00BFFF) drop-shadow(0 0 20px #00BFFF) brightness(1.0)' : 
                        'none' 
                    ),
            }}
            disabled={isMouseDown || showFlash}
        >
            <div className="absolute inset-0 w-full h-full rounded-full"
                 style={{background: 'radial-gradient(circle, rgba(0,95,127,0.3) 0%, #005f7f 70%)'}}
            ></div>

            <div className={`absolute top-1/2 left-1/2 w-1/2 h-1/2 rounded-full
                             ${isHovered && !isMouseDown ? '' : (!isMouseDown && !showFlash ? 'animate-orb-deep-thrum-core-scale' : '')}
                            `}
                 style={{
                    background: 'radial-gradient(circle, #F0FFFF 5%, #00FFFF 40%, rgba(0,200,200,0.5) 70%, rgba(0,100,100,0) 100%)',
                    filter: 'blur(3px)',
                    transform: 'translate(-50%, -50%)', 
                    opacity: isHovered && !isMouseDown ? 1 : (!isMouseDown && !showFlash ? 0.8 : 1), 
                 }}
            ></div>
            
            <div className="absolute inset-0 w-full h-full rounded-full"
                 style={{
                    background: 'radial-gradient(circle, rgba(200,255,255,0.03) 0%, rgba(150,200,255,0.01) 70%, rgba(0,0,0,0.05) 95%, rgba(0,0,0,0.15) 100%)',
                    boxShadow: 'inset 0 0 1px 0px rgba(255,255,255,0.3), inset 0 0 2px 1px rgba(0,0,0,0.1)',
                 }}
            ></div>

             <svg
                viewBox={`0 0 ${currentOrbDiameter} ${currentOrbDiameter}`}
                className={`absolute inset-0 w-full h-full overflow-hidden rounded-full pointer-events-none
                           ${isHovered && !isMouseDown ? 'animate-orb-vibrate' : ''}`}
            >
                {lightningPaths.map((path, index) => (
                    <path
                        key={`lightning-${index}-${Math.random()}`} 
                        d={path}
                        stroke="rgba(255, 255, 255, 0.9)" 
                        strokeWidth="0.75" 
                        fill="none"
                        className="opacity-0 animate-fadeIn" 
                        style={{animationDuration: '0.1s', animationFillMode: 'forwards', animationDelay: `${Math.random()*0.02}s`}}
                    />
                ))}
            </svg>

            <span className="relative z-10 p-1 calibration-orb-text" style={{textShadow: '0 0 5px rgba(0,0,0,0.7)'}}>
                INITIATE<br />CALIBRATION
            </span>

            {showFlash && (
                <div 
                    className="absolute top-1/2 left-1/2 w-1/2 h-1/2 rounded-full bg-white animate-orb-flash-expand origin-center pointer-events-none"
                    style={{ transform: 'translate(-50%, -50%)' }} 
                ></div>
            )}
        </button>
    );
};

const MapDataStreamButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isMouseDown, setIsMouseDown] = useState(false);
    const starChartRef = useRef<HTMLDivElement>(null);
    const starsGeneratedRef = useRef(false);

    useEffect(() => {
        if (isHovered && starChartRef.current && !starsGeneratedRef.current) {
            const numStars = 60 + Math.floor(Math.random() * 20); 
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < numStars; i++) {
                const star = document.createElement('div');
                star.className = 'absolute bg-white rounded-full'; 
                const size = Math.random() * 1.5 + 1; 
                star.style.width = `${size}px`;
                star.style.height = `${size}px`;
                star.style.left = `${Math.random() * 100}%`; 
                star.style.top = `${Math.random() * 100}%`;
                star.style.opacity = `${Math.random() * 0.4 + 0.6}`; 
                if (Math.random() < 0.1) { 
                    star.style.boxShadow = `0 0 3px 1px rgba(0, 191, 255, 0.7), 0 0 5px 2px rgba(0,128,255,0.5)`;
                }
                fragment.appendChild(star);
            }
            starChartRef.current.appendChild(fragment);
            starsGeneratedRef.current = true; 
        }
    }, [isHovered]);


    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onMouseDown={() => setIsMouseDown(true)}
            onMouseUp={() => setIsMouseDown(false)}
            className={`relative w-72 h-16 border font-exo2-regular text-lg text-white
                        rounded-full flex items-center justify-center overflow-hidden group
                        transition-all duration-500 ease-in-out
                        focus:outline-none 
                        ${isMouseDown ? 'transform scale-[0.98]' : ''}
                        ${isHovered ? 'bg-cyan-500/30 border-cyan-300 shadow-[0_0_15px_rgba(0,191,255,0.5)]' : 'bg-cyan-500/10 border-cyan-500'}
                      `}
        >
            <div className={`absolute inset-0 data-stream-button-shimmer 
                           ${isHovered ? 'animate-data-stream-shimmer' : ''}`} 
                 style={{animationPlayState: isHovered ? 'running': 'paused'}}>
            </div>

            <div
                className={`absolute inset-0 transition-opacity duration-500 ease-in-out data-stream-star-chart
                            ${isHovered ? 'opacity-100 animate-data-stream-starchart-pan' : 'opacity-0'}`}
                 style={{animationPlayState: isHovered ? 'running': 'paused'}}
            >
                <div ref={starChartRef} className="w-full h-full relative">
                </div>
            </div>

            <span className="relative z-10" style={{textShadow: '0 0 5px rgba(0,0,0,0.7)'}}>MAP THE DATA-STREAM</span>
        </button>
    );
};


const HeroSection: React.FC<HeroSectionProps> = ({ onInitiateCalibration, onMapDataStream }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [typedSubtitle, setTypedSubtitle] = useState('');
  const fullSubtitle = "Calibrate Your Synapse. Master Your Data-Verse.";
  const title = "DigiLocker Tutorial";
  
  const mousePosition = useRef({ x: 0, y: 0 }); 
  const targetCameraRotation = useRef({ x: 0, y: 0 });
  const currentCameraRotation = useRef({ x: 0, y: 0 });

  const isVaultHovered = useRef(false);
  const vaultRotationSpeed = useRef(0.0015);

  const [titleAnimationPhase, setTitleAnimationPhase] = useState<TitleAnimationPhase>('ingress');
  const [showEmbers, setShowEmbers] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleContainerRef = useRef<HTMLDivElement>(null);
  
  const [isPageAtTop, setIsPageAtTop] = useState(true);

  const charAnimDuration = 0.5; 
  const charAnimDelayIncrement = 0.06; 
  const impactFlashDuration = 0.25; 

  useEffect(() => {
    const handleScroll = () => {
      setIsPageAtTop(window.scrollY < 1);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  useEffect(() => {
    setTitleAnimationPhase('ingress'); 
    const totalIngressTime = (title.length -1) * charAnimDelayIncrement + charAnimDuration;
    const timerAllCharsAssembled = setTimeout(() => {
        setTitleAnimationPhase('coalescenceFlash');
    }, totalIngressTime * 1000); 

    return () => {
      clearTimeout(timerAllCharsAssembled);
    };
  }, [title]);


  useEffect(() => {
    if (titleAnimationPhase === 'coalescenceFlash') {
      const timerFlashDone = setTimeout(() => {
        setTitleAnimationPhase('settled');
      }, impactFlashDuration * 1000);
      return () => clearTimeout(timerFlashDone);
    }
  }, [titleAnimationPhase]);

  useEffect(() => {
    if (titleAnimationPhase === 'settled') {
      setShowEmbers(true); 
    } else {
      setShowEmbers(false); 
    }
  }, [titleAnimationPhase]);


  useEffect(() => {
    if (typedSubtitle.length < fullSubtitle.length) {
      const timer = setTimeout(() => {
        setTypedSubtitle(fullSubtitle.substring(0, typedSubtitle.length + 1));
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [typedSubtitle, fullSubtitle]);

  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, 2000);
    camera.position.z = 60; 

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 1);
    currentMount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7); 
    directionalLight.position.set(5,10,7);
    scene.add(directionalLight);


    const vaultGeometry = new THREE.DodecahedronGeometry(15, 0); 
    const vaultMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x05080A,       
      metalness: 0.1,         
      roughness: 0.05,        
      transmission: 0.9,      
      ior: 1.5,               
      thickness: 2.5,          
      transparent: true,
      opacity: 0.9,           
      envMapIntensity: 1.2,   
      side: THREE.DoubleSide,
    });
    const userVault = new THREE.Mesh(vaultGeometry, vaultMaterial);
    userVault.position.set(0,0,0);
    userVault.scale.set(1, 1.05, 0.95); 
    scene.add(userVault);

    const coreGeometry = new THREE.SphereGeometry(3, 32, 32); 
    const coreMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00BFFF, 
        transparent: true, 
        opacity: 0.6, 
    });
    const energyCore = new THREE.Mesh(coreGeometry, coreMaterial);
    userVault.add(energyCore); 

    const fresnelMaterial = new THREE.ShaderMaterial({
        uniforms: {
            c: { type: "f", value: 0.1 }, 
            p: { type: "f", value: 3.0 }, 
            glowColor: { type: "c", value: new THREE.Color(0x00BFFF) }, 
            cameraPosition: { value: camera.position } 
        },
        vertexShader: `
            uniform vec3 cameraPosition; 
            varying float intensity;
            void main() {
                vec3 worldNormal = normalize( mat3(modelMatrix) * normal );
                vec3 worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                vec3 viewDirection = normalize(cameraPosition - worldPosition);
                intensity = pow(0.6 - dot(worldNormal, viewDirection), 3.0); 
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `,
        fragmentShader: `
            uniform vec3 glowColor;
            varying float intensity;
            void main() {
                vec3 glow = glowColor * intensity;
                gl_FragColor = vec4( glow, intensity * 0.7 ); 
            }`,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
    });

    const fresnelMesh = new THREE.Mesh(vaultGeometry.clone().scale(1.08, 1.08, 1.08), fresnelMaterial);
    userVault.add(fresnelMesh);


    const createParticles = (count: number, size: number, color1: THREE.Color, color2: THREE.Color, color3: THREE.Color, spreadFactor: number, isLayer2: boolean) => {
      const particleGeometry = new THREE.BufferGeometry();
      const positions = []; const colors = []; const sizes = []; const baseVelocities = [];
      for (let i = 0; i < count; i++) {
        positions.push((Math.random() - 0.5) * spreadFactor * (isLayer2 ? 2 : 1));
        positions.push((Math.random() - 0.5) * spreadFactor * (isLayer2 ? 2 : 1));
        positions.push((Math.random() - 0.5) * spreadFactor * (isLayer2 ? 1.5 : 1) - (isLayer2 ? 70 : 40) ); 
        const randomColor = Math.random();
        let chosenColor = randomColor < 0.8 ? color1 : (randomColor < 0.95 ? color2 : color3);
        colors.push(chosenColor.r, chosenColor.g, chosenColor.b);
        sizes.push(Math.random() * (isLayer2 ? 0.8 : 1.5) + 0.5);
        baseVelocities.push((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.01);
      }
      particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      particleGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
      particleGeometry.setAttribute('baseVelocity', new THREE.Float32BufferAttribute(baseVelocities, 3));
      const particleMaterial = new THREE.PointsMaterial({ size: size, vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
      return new THREE.Points(particleGeometry, particleMaterial);
    };
    const nearParticles = createParticles(5000, 0.3, new THREE.Color(0x00FFFF), new THREE.Color(0xF0F0F0), new THREE.Color(0xFF00FF), 250, false);
    scene.add(nearParticles);
    const farParticles = createParticles(3000, 0.2, new THREE.Color(0x00FFFF), new THREE.Color(0xF0F0F0), new THREE.Color(0xFF00FF), 500, true);
    scene.add(farParticles);

    const noiseTextureUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAAaklEQVR4Ae3MsQ2AMAwEwXEWBRDUWu0M6V8qPjKzRiwrcsYjYXkz7UASgSA1jESgD5DyBVL+Sj4dfSPk2zQspl9D4Ud3xudjBwDXfAEXKUDXSYCf2Q2E5Rp0AcNl7QIU0Qo4TQtYhXwAdQAAAABJRU5ErkJggg==';
    const nebulaMaterial = (color: THREE.Color, mapUrl: string, opacity: number) => {
        const textureLoader = new THREE.TextureLoader(); const texture = textureLoader.load(mapUrl);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        return new THREE.MeshBasicMaterial({ map: texture, color: color, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    };
    const nebula1 = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), nebulaMaterial(new THREE.Color(0x4B0082), noiseTextureUrl, 0.2)); 
    nebula1.position.set(-150, 70, -400); scene.add(nebula1);
    const nebula2 = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), nebulaMaterial(new THREE.Color(0x8A2BE2), noiseTextureUrl, 0.15)); 
    nebula2.position.set(180, -50, -350); scene.add(nebula2);
    const nebula3 = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), nebulaMaterial(new THREE.Color(0x00CED1), noiseTextureUrl, 0.12)); 
    nebula3.position.set(20, 20, -450); scene.add(nebula3);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(currentMount.clientWidth, currentMount.clientHeight), 0.5, 0.3, 0.15); 
    composer.addPass(bloomPass);
    const chromaticAberrationPass = new ShaderPass(ChromaticAberrationShader);
    chromaticAberrationPass.uniforms.resolution.value.set(currentMount.clientWidth, currentMount.clientHeight);
    composer.addPass(chromaticAberrationPass);
    const outputPass = new OutputPass(); composer.addPass(outputPass);
    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.material.uniforms['resolution'].value.x = 1 / (currentMount.clientWidth * renderer.getPixelRatio());
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (currentMount.clientHeight * renderer.getPixelRatio());
    composer.addPass(fxaaPass);

    const handleMouseMove = (event: MouseEvent) => {
      mousePosition.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mousePosition.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
      targetCameraRotation.current.y = mousePosition.current.x * 0.15; 
      targetCameraRotation.current.x = mousePosition.current.y * 0.08;
      
      const raycaster = new THREE.Raycaster(); 
      const mouseVec = new THREE.Vector2(mousePosition.current.x, mousePosition.current.y);
      raycaster.setFromCamera(mouseVec, camera); 
      const intersects = raycaster.intersectObject(userVault, false); 
      isVaultHovered.current = intersects.length > 0;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const clock = new THREE.Clock(); let requestId: number;
    const particleScreenPos = new THREE.Vector3(); // For reuse
    
    // Calculate GravityWell's screen position within the animate function if mountRef.current is available
    let gravityWellScreenX = currentMount.clientWidth / 2;
    let gravityWellScreenY = currentMount.clientHeight * 0.97; // Approx. bottom: 3vh

    const animate = () => {
      requestId = requestAnimationFrame(animate); const elapsedTime = clock.getElapsedTime();
      currentCameraRotation.current.x += (targetCameraRotation.current.x - currentCameraRotation.current.x) * 0.05;
      currentCameraRotation.current.y += (targetCameraRotation.current.y - currentCameraRotation.current.y) * 0.05;
      
      const baseCamZ = 60; 
      camera.position.x = Math.sin(currentCameraRotation.current.y) * baseCamZ * 0.2;
      camera.position.y = Math.sin(currentCameraRotation.current.x) * baseCamZ * 0.15;
      camera.position.z = baseCamZ - Math.abs(Math.cos(currentCameraRotation.current.y) * baseCamZ * 0.05) - Math.abs(Math.cos(currentCameraRotation.current.x) * baseCamZ * 0.05) ;
      camera.lookAt(userVault.position);
      fresnelMaterial.uniforms.cameraPosition.value.copy(camera.position); 

      userVault.rotation.y += vaultRotationSpeed.current;
      userVault.rotation.x += Math.sin(elapsedTime * 0.3) * 0.0003; 
      userVault.rotation.z += Math.cos(elapsedTime * 0.2) * 0.0003;

      const corePulseSpeed = isVaultHovered.current ? 3.5 : 1.57; 
      const coreBaseOpacity = 0.6;
      const coreHoverBrightnessFactor = 1.25;

      const pulseFactor = (Math.sin(elapsedTime * corePulseSpeed) + 1) / 2; 
      const currentScale = 1 + pulseFactor * 0.15; 
      energyCore.scale.set(currentScale, currentScale, currentScale);
      
      let currentOpacity = coreBaseOpacity + pulseFactor * 0.4; 
      if (isVaultHovered.current) {
        currentOpacity = Math.min(1, currentOpacity * coreHoverBrightnessFactor); 
        (userVault.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.05; 
         (userVault.material as THREE.MeshPhysicalMaterial).emissive = new THREE.Color(0x00BFFF); 
      } else {
        (userVault.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0;
      }
      (energyCore.material as THREE.MeshBasicMaterial).opacity = currentOpacity;


       if (isVaultHovered.current) {
         vaultRotationSpeed.current = THREE.MathUtils.lerp(vaultRotationSpeed.current, 0.0008, 0.1); 
         (fresnelMesh.material as THREE.ShaderMaterial).uniforms.p.value = 2.5; 
       } else {
         vaultRotationSpeed.current = THREE.MathUtils.lerp(vaultRotationSpeed.current, 0.0015, 0.1); 
         (fresnelMesh.material as THREE.ShaderMaterial).uniforms.p.value = 3.0; 
       }

      [nearParticles, farParticles].forEach(pSystem => { 
          const positions = pSystem.geometry.attributes.position.array as Float32Array;
          const baseVelocities = pSystem.geometry.attributes.baseVelocity.array as Float32Array;
          const spread = pSystem === nearParticles ? 250 : 500;
          for (let i = 0; i < positions.length / 3; i++) {
            let dX = baseVelocities[i*3] + (Math.random() - 0.5) * 0.01;
            let dY = baseVelocities[i*3+1] + (Math.random() - 0.5) * 0.01;
            let dZ = baseVelocities[i*3+2] + (Math.random() - 0.5) * 0.005;

            if (isPageAtTop) {
              particleScreenPos.set(positions[i*3], positions[i*3+1], positions[i*3+2]);
              particleScreenPos.project(camera); // Convert to NDC

              const screenX = (particleScreenPos.x * 0.5 + 0.5) * currentMount.clientWidth;
              const screenY = (-particleScreenPos.y * 0.5 + 0.5) * currentMount.clientHeight;
              
              const influenceRadiusY = currentMount.clientHeight * 0.35; // Lower 35% of screen
              const influenceRadiusX = currentMount.clientWidth * 0.25; // Horizontal range for pull

              if (screenY > currentMount.clientHeight - influenceRadiusY && Math.abs(screenX - gravityWellScreenX) < influenceRadiusX) {
                 const pullStrengthBase = 0.008; 
                 const distToWellYNorm = Math.max(0.01, Math.abs(screenY - gravityWellScreenY) / influenceRadiusY); // Normalize, avoid div by zero
                 const distToWellXNorm = Math.max(0.01, Math.abs(screenX - gravityWellScreenX) / influenceRadiusX);

                 // Inverse distance factor for stronger pull when closer, but not excessively strong
                 const pullFactor = 1 / (distToWellYNorm + distToWellXNorm + 0.5); // Added 0.5 to soften very close pulls

                 dY -= pullStrengthBase * pullFactor * 0.7; // Stronger downward pull bias
                 
                 const horizontalPullBias = pullStrengthBase * pullFactor * 0.3;
                 if (screenX < gravityWellScreenX) {
                     dX += horizontalPullBias;
                 } else {
                     dX -= horizontalPullBias;
                 }
              }
            }
            positions[i*3] += dX;
            positions[i*3+1] += dY;
            positions[i*3+2] += dZ;

            if (positions[i*3] > spread/2) positions[i*3] = -spread/2; if (positions[i*3] < -spread/2) positions[i*3] = spread/2;
            if (positions[i*3+1] > spread/2) positions[i*3+1] = -spread/2; if (positions[i*3+1] < -spread/2) positions[i*3+1] = spread/2;
            const zDepth = pSystem === nearParticles ? -40 : -70; const zSpread = pSystem === nearParticles ? 250 : 500;
            if (positions[i*3+2] > zDepth + zSpread/2) positions[i*3+2] = zDepth - zSpread/2; if (positions[i*3+2] < zDepth - zSpread/2) positions[i*3+2] = zDepth + zSpread/2;
          }
          pSystem.geometry.attributes.position.needsUpdate = true;
      });
      nebula1.rotation.z += 0.0001; (nebula1.material as THREE.MeshBasicMaterial).map!.offset.x += 0.00005;
      nebula2.rotation.z -= 0.00008; (nebula2.material as THREE.MeshBasicMaterial).map!.offset.y += 0.00003;
      (nebula3.material as THREE.MeshBasicMaterial).map!.offset.x -= 0.00002;
      composer.render();
    };
    animate();

    const handleResize = () => {
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight; camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight); composer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      fxaaPass.material.uniforms['resolution'].value.x = 1 / (currentMount.clientWidth * renderer.getPixelRatio());
      fxaaPass.material.uniforms['resolution'].value.y = 1 / (currentMount.clientHeight * renderer.getPixelRatio());
      chromaticAberrationPass.uniforms.resolution.value.set(currentMount.clientWidth, currentMount.clientHeight);
      gravityWellScreenX = currentMount.clientWidth / 2;
      gravityWellScreenY = currentMount.clientHeight * 0.97;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(requestId); window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('resize', handleResize);
      renderer.dispose(); vaultGeometry.dispose(); (vaultMaterial as THREE.MeshPhysicalMaterial).dispose(); 
      coreGeometry.dispose(); (coreMaterial as THREE.MeshBasicMaterial).dispose(); 
      fresnelMaterial.dispose(); 
      if (fresnelMesh && fresnelMesh.material) { 
        (fresnelMesh.material as THREE.ShaderMaterial).dispose();
      }
      nearParticles.geometry.dispose(); (nearParticles.material as THREE.PointsMaterial).dispose();
      farParticles.geometry.dispose(); (farParticles.material as THREE.PointsMaterial).dispose();
      nebula1.geometry.dispose(); (nebula1.material as THREE.MeshBasicMaterial).map?.dispose(); (nebula1.material as THREE.MeshBasicMaterial).dispose();
      nebula2.geometry.dispose(); (nebula2.material as THREE.MeshBasicMaterial).map?.dispose(); (nebula2.material as THREE.MeshBasicMaterial).dispose();
      nebula3.geometry.dispose(); (nebula3.material as THREE.MeshBasicMaterial).map?.dispose(); (nebula3.material as THREE.MeshBasicMaterial).dispose();
      if (currentMount && renderer.domElement) { currentMount.removeChild(renderer.domElement); }
    };
  }, [isPageAtTop]);


  return (
    <section id="hero" className="relative font-orbitron min-h-screen flex flex-col items-center justify-start p-4 overflow-hidden">
      <div ref={mountRef} className="absolute inset-0 z-0"></div>

      <div 
        className="text-center flex flex-col items-center"
        style={{
          position: 'absolute',
          top: '25%', 
          left: '50%',
          transform: 'translateX(-50%)', 
          width: '80vw', 
          maxWidth: `calc(0.8 * ${typeof window !== 'undefined' ? window.innerWidth : 1600}px)`, 
          zIndex: 10, 
        }}
      >
        <div ref={titleContainerRef} className="relative title-impact-flash-container">
          <h1
            ref={titleRef}
            className={`text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 font-exo2-bold
                        ${titleAnimationPhase === 'coalescenceFlash' ? 'animate-impact-flash' : ''}
                        ${titleAnimationPhase === 'settled' ? 'title-final-appearance' : ''}
                      `}
            style={{
                animationDelay: titleAnimationPhase === 'coalescenceFlash' ? `${(title.length -1) * charAnimDelayIncrement + charAnimDuration}s` : '0s',
                color: titleAnimationPhase === 'settled' ? '#FFFFFF' : 'transparent', 
                opacity: titleAnimationPhase === 'settled' ? 1 : (titleAnimationPhase === 'ingress' || titleAnimationPhase === 'coalescenceFlash' ? 1 : 0) 
            }}
          >
            {title.split("").map((char, index) => (
              <span
                key={index}
                className={`
                  title-char-construct 
                  ${titleAnimationPhase === 'ingress' ? 'animate-construct-char' : ''}
                  ${titleAnimationPhase === 'settled' ? 'text-white' : ''} 
                `}
                style={{ 
                  animationDelay: `${index * charAnimDelayIncrement}s`, 
                  animationDuration: `${charAnimDuration}s`, 
                 }}
              >
                {char === " " ? "\u00A0" : char}
              </span>
            ))}
          </h1>
          {showEmbers && titleRef.current && Array.from({ length: 50 }).map((_, i) => { 
            const titleRect = titleRef.current!.getBoundingClientRect();
            const startX = Math.random() * titleRect.width - titleRect.width / 2;
            const startY = Math.random() * titleRect.height - titleRect.height / 2;

            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 80 + 40; 
            const endX = startX + Math.cos(angle) * radius;
            const endY = startY + Math.sin(angle) * radius - 30; 
            
            const duration = Math.random() * 2.0 + 2.0; 
            const delay = Math.random() * 1.5; 
            const size = Math.random() * 2 + 1; 

            return (
              <div
                key={`ember-${i}`}
                className="ember-particle"
                style={{
                  left: `calc(50%)`, 
                  top: `calc(50%)`,  
                  width: `${size}px`, 
                  height: `${size}px`,
                  animationName: 'ember-fly-fade',
                  animationDuration: `${duration}s`,
                  animationDelay: `${delay}s`,
                  // @ts-ignore
                  '--ember-start-x': `${startX}px`,
                  '--ember-start-y': `${startY}px`,
                  '--ember-end-x': `${endX}px`,
                  '--ember-end-y': `${endY}px`,
                }}
              />
            );
          })}
        </div>

        <p className="text-xl sm:text-2xl md:text-3xl text-purple-300 mb-12 h-10 font-mono overflow-hidden whitespace-nowrap">
          {typedSubtitle}
          <span className="animate-ping text-purple-300">_</span>
        </p>
        
        <div className="flex flex-col sm:flex-row space-y-6 sm:space-y-0 sm:space-x-6 items-center justify-center mt-8">
            <InitiateCalibrationOrb onClick={onInitiateCalibration} />
            <MapDataStreamButton onClick={onMapDataStream} />
        </div>
      </div>
      
      <GravityWell onClick={onMapDataStream} isVisible={isPageAtTop} />

    </section>
  );
};

export default HeroSection;
