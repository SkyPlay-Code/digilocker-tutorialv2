
import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import gsap from 'gsap';

interface HeroSectionProps {
  onInitiateCalibration: () => void; // Kept for potential other uses, but Orb click is now transition
  onTransitionToDataCoreComplete: () => void; // New prop for completing the light speed transition
  onMapDataStream: () => void;
}

// Radial Blur Shader (for light speed streaks)
const RadialBlurShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2() },
    center: { value: new THREE.Vector2(0.5, 0.5) },
    strength: { value: 0.0 }, // Strength of the blur, animate this
    samples: { value: 10 }, // Number of samples
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
    uniform vec2 center;
    uniform float strength;
    uniform int samples;
    varying vec2 vUv;

    float random(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 dir = vUv - center;
      float dist = length(dir);
      vec4 color = vec4(0.0);
      float totalStrength = strength * smoothstep(0.0, 1.0, dist); // Blur more at edges

      if (totalStrength > 0.0) {
        for (int i = 0; i < samples; ++i) {
          float percent = (float(i) + random(vUv * float(i))) / float(samples);
          float weight = 4.0 * (percent - percent * percent); // Apply quadratic easing
          color += texture2D(tDiffuse, vUv - dir * percent * totalStrength * 0.1) * weight;
        }
        color /= float(samples) * 2.0; // Approximation of sum of weights
      } else {
        color = texture2D(tDiffuse, vUv);
      }
      gl_FragColor = color;
    }
  `
};


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

type TitleAnimationPhase = 'idle' | 'shardsEntering' | 'shardsSwarming' | 'textForming' | 'stable';
const NUM_TITLE_SHARDS = 60; 

interface LightningArc {
  id: string;
  d: string;
  style?: React.CSSProperties;
}

type LightSpeedTransitionPhase = 'idle' | 'initiating' | 'zooming' | 'breaching' | 'done';

const StarChartStar = React.memo(({ style }: { style: React.CSSProperties }) => (
  <span className="absolute w-0.5 h-0.5 bg-white rounded-full" style={style}></span>
));

const StarChartLine = React.memo(({ style }: { style: React.CSSProperties }) => (
  <span className="absolute h-px bg-cyan-600/50" style={style}></span>
));


const HeroSection: React.FC<HeroSectionProps> = ({ onTransitionToDataCoreComplete, onMapDataStream }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [typedSubtitle, setTypedSubtitle] = useState('');
  const fullSubtitle = "Calibrate Your Synapse. Master Your Data-Verse.";
  const titleText = "DigiLocker Tutorial";
  
  const mousePosition = useRef({ x: 0, y: 0 }); 
  const targetCameraRotation = useRef({ x: 0, y: 0 });
  const currentCameraRotation = useRef({ x: 0, y: 0 });

  const isVaultHovered = useRef(false);
  const vaultRotationSpeed = useRef(0.001); 

  const [titleAnimationPhase, setTitleAnimationPhase] = useState<TitleAnimationPhase>('idle');
  const [showEmbers, setShowEmbers] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleFlashRef = useRef<HTMLDivElement>(null);

  const [titleShards, setTitleShards] = useState<{ id: number; style: React.CSSProperties }[]>([]);

  // Orb State
  const [isOrbHoveredState, setIsOrbHoveredState] = useState(false); // Renamed to avoid conflict with ref
  const [lightningArcs, setLightningArcs] = useState<LightningArc[]>([]);
  const lightningIntervalRef = useRef<number | null>(null);
  const orbRef = useRef<HTMLButtonElement>(null);
  const orbClickFlashRef = useRef<HTMLDivElement>(null); 
  // const [orbClicked, setOrbClicked] = useState(false); // Managed by transitionPhase now
  const orbCoreRef = useRef<HTMLDivElement>(null); 

  // Gravity Well State
  const [showGravityWell, setShowGravityWell] = useState(true);
  const gravityWellCanvasRef = useRef<HTMLCanvasElement>(null);
  const gravityWellAnimationRequestRef = useRef<number | null>(null);
  const gravityWell3DTargetRef = useRef(new THREE.Vector3(0, -60, 20)); 


  // Light Speed Transition State
  const [lightSpeedPhase, setLightSpeedPhase] = useState<LightSpeedTransitionPhase>('idle');
  const sceneElementsRef = useRef<{ // To store Three.js elements for manipulation
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    vaultGroup?: THREE.Group;
    composer?: EffectComposer;
    radialBlurPass?: ShaderPass;
    nearParticles?: THREE.Points;
    farParticles?: THREE.Points;
    nebulae?: THREE.Mesh[];
    energyCore?: THREE.Mesh;
    internalPathways?: THREE.Mesh[];
    userVaultShell?: THREE.Mesh;
    sceneAnimationActive: boolean; // To control general scene animation
  }>({ sceneAnimationActive: true });


  useEffect(() => {
    const newShards = Array.from({ length: NUM_TITLE_SHARDS }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 60 + 110; 
      const initialX = `${Math.cos(angle) * radius}vw`;
      const initialY = `${Math.sin(angle) * radius}vh`;
      const initialRotation = `${Math.random() * 360 - 180}deg`;
      
      const targetCenterX = `calc(50% + ${Math.random() * 100 - 50}px)`; 
      const targetCenterY = `calc(25% + ${Math.random() * 80 - 40}px)`; 

      return {
        id: i,
        style: {
          // @ts-ignore
          '--shard-ix': initialX,
          '--shard-iy': initialY,
          '--shard-ir': initialRotation,
          '--shard-cx': targetCenterX, 
          '--shard-cy': targetCenterY,
          '--shard-finalx': targetCenterX, 
          '--shard-finaly': targetCenterY,
          '--swarm-dx1': `${Math.random()*15-7.5}px`, '--swarm-dy1': `${Math.random()*15-7.5}px`, '--swarm-r1': `${Math.random()*60-30}deg`,
          '--swarm-dx2': `${Math.random()*15-7.5}px`, '--swarm-dy2': `${Math.random()*15-7.5}px`, '--swarm-r2': `${Math.random()*60-30}deg`,
          '--swarm-dx3': `${Math.random()*15-7.5}px`, '--swarm-dy3': `${Math.random()*15-7.5}px`, '--swarm-r3': `${Math.random()*60-30}deg`,
          animationDelay: `${Math.random() * 0.5}s`, 
        }
      };
    });
    setTitleShards(newShards);
  }, []);
  
  useEffect(() => {
    if (lightSpeedPhase !== 'idle') return; // Don't run title animation if transition is happening

    if (titleAnimationPhase === 'idle') {
      const startTimer = setTimeout(() => setTitleAnimationPhase('shardsEntering'), 500);
      return () => clearTimeout(startTimer);
    }
    if (titleAnimationPhase === 'shardsEntering') {
      const swarmTimer = setTimeout(() => setTitleAnimationPhase('shardsSwarming'), 1000 + 500); 
      return () => clearTimeout(swarmTimer);
    }
    if (titleAnimationPhase === 'shardsSwarming') {
      const formTimer = setTimeout(() => setTitleAnimationPhase('textForming'), 1000);
      return () => clearTimeout(formTimer);
    }
    if (titleAnimationPhase === 'textForming') {
      if (titleFlashRef.current) {
        titleFlashRef.current.classList.add('animate-title-impact-flash-main');
      }
      const stableTimer = setTimeout(() => {
        setTitleAnimationPhase('stable');
        if (titleFlashRef.current) {
            titleFlashRef.current.classList.remove('animate-title-impact-flash-main');
            titleFlashRef.current.style.opacity = '0'; 
        }
      }, 300); 
      return () => clearTimeout(stableTimer);
    }
    if (titleAnimationPhase === 'stable') {
      setShowEmbers(true);
    }
  }, [titleAnimationPhase, lightSpeedPhase]);

  useEffect(() => {
    if (typedSubtitle.length < fullSubtitle.length) {
      const timer = setTimeout(() => {
        setTypedSubtitle(fullSubtitle.substring(0, typedSubtitle.length + 1));
      }, 70); 
      return () => clearTimeout(timer);
    }
  }, [typedSubtitle, fullSubtitle]);

  // Orb effects
  const generateLightningArcPath = useCallback((coreRadius: number, orbContainerRadius: number): string => {
    const svgCenter = orbContainerRadius; 

    const angleStart = Math.random() * Math.PI * 2;
    const startX = svgCenter + Math.cos(angleStart) * coreRadius;
    const startY = svgCenter + Math.sin(angleStart) * coreRadius;

    const arcLengthFactor = Math.random() * 0.3 + 0.2; 
    const endRadius = coreRadius + (orbContainerRadius - coreRadius) * arcLengthFactor;
    
    const endX = svgCenter + Math.cos(angleStart) * endRadius + (Math.random() - 0.5) * (endRadius * 0.3); 
    const endY = svgCenter + Math.sin(angleStart) * endRadius + (Math.random() - 0.5) * (endRadius * 0.3);

    const midPoints = [];
    const numSegments = Math.floor(Math.random() * 2) + 2; 
    for (let i = 1; i < numSegments; i++) {
        const t = i / numSegments;
        const baseX = startX + (endX - startX) * t;
        const baseY = startY + (endY - startY) * t;
        const perpendicularAngle = angleStart + Math.PI / 2;
        const jitterMagnitude = (orbContainerRadius * 0.05) * (Math.random() - 0.5) * 2; 
        const offsetX = Math.cos(perpendicularAngle) * jitterMagnitude;
        const offsetY = Math.sin(perpendicularAngle) * jitterMagnitude;
        midPoints.push(`${baseX + offsetX},${baseY + offsetY}`);
    }
    return `M${startX},${startY} L${midPoints.join(' L')} L${endX},${endY}`;
  }, []);


  useEffect(() => {
    if (isOrbHoveredState) {
      if (lightningIntervalRef.current) clearInterval(lightningIntervalRef.current);
      lightningIntervalRef.current = window.setInterval(() => {
        if (!orbRef.current || !orbCoreRef.current) return;
        
        const orbContainerRect = orbRef.current.getBoundingClientRect();
        const orbContainerRadius = orbContainerRect.width / 2; 

        const visualCoreRadius = orbContainerRadius * 0.55; 
        
        const newArcs: LightningArc[] = [];
        const arcCount = Math.floor(Math.random() * 2) + 1; 
        for (let i = 0; i < arcCount; i++) {
          newArcs.push({
            id: `arc-${Date.now()}-${i}`,
            d: generateLightningArcPath(visualCoreRadius, orbContainerRadius),
            style: { animationDelay: `${Math.random() * 0.1}s` } 
          });
        }
        setLightningArcs(newArcs);
      }, 250); 
    } else {
      if (lightningIntervalRef.current) {
        clearInterval(lightningIntervalRef.current);
        lightningIntervalRef.current = null;
      }
      setLightningArcs([]);
    }
    return () => {
      if (lightningIntervalRef.current) clearInterval(lightningIntervalRef.current);
    };
  }, [isOrbHoveredState, generateLightningArcPath]);


  const handleOrbMouseDown = () => {
    if (lightSpeedPhase !== 'idle') return;
    if (orbRef.current) {
        orbRef.current.style.transform = 'scale(0.9)';
    }
    if (orbClickFlashRef.current) {
        orbClickFlashRef.current.classList.remove('animate-orb-click-flash');
        void orbClickFlashRef.current.offsetWidth; 
        orbClickFlashRef.current.classList.add('animate-orb-click-flash');
    }
  };
  const handleOrbMouseUp = () => {
    if (lightSpeedPhase !== 'idle') return;
     if (orbRef.current) { 
        orbRef.current.style.transform = 'scale(1)';
    }
  };

   const handleOrbClick = () => {
    if (lightSpeedPhase !== 'idle') return;
    setLightSpeedPhase('initiating');
    // Orb flash is handled by mousedown, if desired as part of click, can trigger here.
    // Transition logic will be handled by useEffect watching lightSpeedPhase and the Three.js animate loop.
  };

  // Gravity Well scroll listener
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setShowGravityWell(false);
      } else {
        // setShowGravityWell(true); 
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Gravity Well Canvas Animation
  useEffect(() => {
    if (!gravityWellCanvasRef.current || !showGravityWell) return;

    const canvas = gravityWellCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 50;
    canvas.height = 50;

    const particles: any[] = [];
    const singularityRadius = 3; 
    const accretionDiskRadius = 25; 
    const numParticles = 70;

    function Particle(this: any) {
      const angle = Math.random() * Math.PI * 2;
      this.currentRadius = accretionDiskRadius * (0.8 + Math.random() * 0.2); 
      this.angle = angle;
      this.x = canvas.width / 2 + Math.cos(this.angle) * this.currentRadius;
      this.y = canvas.height / 2 + Math.sin(this.angle) * this.currentRadius;
      
      this.initialSpeed = 0.02 + Math.random() * 0.015;
      this.color = Math.random() < 0.7 ? '#00BFFF' : '#FFFFFF'; 
      this.size = Math.random() * 1.2 + 0.5;
      this.stretch = 1;
      this.alpha = 0.5 + Math.random() * 0.5;
    }

    Particle.prototype.draw = function() {
      ctx.beginPath();
      ctx.globalAlpha = this.alpha;
      
      if (this.stretch > 1) {
        const dx = canvas.width / 2 - this.x;
        const dy = canvas.height / 2 - this.y;
        const norm = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const aspect = 0.3; 
        const pSize = this.size * 0.8; 

        const perpX = -dy / norm * pSize * aspect / 2;
        const perpY = dx / norm * pSize * aspect / 2;
        
        const stretchFactor = this.size * this.stretch / 2;
        const dirX = dx / norm * stretchFactor;
        const dirY = dy / norm * stretchFactor;

        ctx.moveTo(this.x - dirX - perpX, this.y - dirY - perpY);
        ctx.lineTo(this.x + dirX - perpX, this.y + dirY - perpY);
        ctx.lineTo(this.x + dirX + perpX, this.y + dirY + perpY);
        ctx.lineTo(this.x - dirX + perpX, this.y - dirY + perpY);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();

      } else {
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    Particle.prototype.update = function() {
      const distToCenter = this.currentRadius;
      
      const inwardPull = 0.05 + (accretionDiskRadius - distToCenter) * 0.005;
      this.currentRadius -= inwardPull;

      if (this.currentRadius <= singularityRadius) {
        const angle = Math.random() * Math.PI * 2;
        this.currentRadius = accretionDiskRadius * (0.8 + Math.random() * 0.2);
        this.angle = angle;
        this.alpha = 0.5 + Math.random() * 0.5;
        this.stretch = 1;
      }

      const speedFactor = Math.max(0.1, accretionDiskRadius / (distToCenter + 1)); 
      this.angle += this.initialSpeed * speedFactor;

      this.x = canvas.width / 2 + Math.cos(this.angle) * this.currentRadius;
      this.y = canvas.height / 2 + Math.sin(this.angle) * this.currentRadius;
      
      this.stretch = 1;
      if (this.currentRadius < singularityRadius * 4 && this.currentRadius > singularityRadius) { 
          this.stretch = 1 + ((singularityRadius * 4 - this.currentRadius) / (singularityRadius * 3)) * 3; 
          this.alpha = Math.max(0.1, this.alpha * (this.currentRadius / (singularityRadius * 4))); 
      } else if (this.currentRadius <= singularityRadius) {
           this.alpha = 0; 
      }
    };
    
    for (let i = 0; i < numParticles; i++) {
      particles.push(new (Particle as any)());
    }

    const animateGravityWell = () => {
      if (!showGravityWell || !gravityWellCanvasRef.current) {
        if (gravityWellAnimationRequestRef.current) {
          cancelAnimationFrame(gravityWellAnimationRequestRef.current);
        }
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      gravityWellAnimationRequestRef.current = requestAnimationFrame(animateGravityWell);
    };

    animateGravityWell();

    return () => {
      if (gravityWellAnimationRequestRef.current) {
        cancelAnimationFrame(gravityWellAnimationRequestRef.current);
      }
    };
  }, [showGravityWell]);

  // Main Three.js Scene Setup
  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;
    
    const scene = new THREE.Scene();
    sceneElementsRef.current.scene = scene;
    const camera = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, 2000);
    camera.position.z = 100;
    sceneElementsRef.current.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 1); 
    currentMount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5,10,7);
    scene.add(directionalLight);

    const vaultGroup = new THREE.Group();
    scene.add(vaultGroup);
    sceneElementsRef.current.vaultGroup = vaultGroup;

    const coreGeometry = new THREE.SphereGeometry(3.5, 32, 32); 
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0x00BFFF, transparent: true, opacity: 0.85 });
    const energyCore = new THREE.Mesh(coreGeometry, coreMaterial);
    (energyCore.material as THREE.MeshBasicMaterial).userData = { baseEmissiveIntensity: 1.5, pulseSpeed: Math.PI / 2 }; 
    vaultGroup.add(energyCore);
    sceneElementsRef.current.energyCore = energyCore;

    const points: THREE.Vector3[] = [];
    const RGen = (yLevel: number, angle: number) => 8 + Math.sin(yLevel * 0.2 + angle * 3) * 2.5 + Math.cos(angle * 2 + yLevel * 0.1) * 2;
    const yLevels = [-10, -6, -2, 2, 6, 10]; 
    const pointsPerLevel = 6; 
    yLevels.forEach((y, yIdx) => {
        for (let i = 0; i < pointsPerLevel; i++) {
            const angle = (i / pointsPerLevel) * Math.PI * 2 + (yIdx * 0.45); 
            const baseRadius = RGen(y, angle);
            const radius = baseRadius * (1 + (Math.random() - 0.5) * 0.15); 
            points.push(new THREE.Vector3( Math.cos(angle) * radius, y + (Math.random() - 0.5) * 1.5, Math.sin(angle) * radius ));
        }
    });
    points.push(new THREE.Vector3(0, 15, 0)); points.push(new THREE.Vector3(0, -15, 0));
    points.push(new THREE.Vector3(12, Math.random()*4 - 2, Math.random()*4 - 2)); points.push(new THREE.Vector3(-12, Math.random()*4 - 2, Math.random()*4 - 2));
    points.push(new THREE.Vector3(Math.random()*4 - 2, 10, Math.random()*4 - 2)); points.push(new THREE.Vector3(Math.random()*4 - 2, -10, Math.random()*4 - 2));
    points.push(new THREE.Vector3(Math.random()*3-1.5, Math.random()*3-1.5, 13)); points.push(new THREE.Vector3(Math.random()*3-1.5, Math.random()*3-1.5, -13));

    const vaultShellGeometry = new ConvexGeometry(points);
    vaultShellGeometry.computeVertexNormals(); 

    const vaultShellMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x90C8E8, metalness: 0.1, roughness: 0.05, transmission: 0.96, ior: 2.33, thickness: 6, 
      transparent: true, opacity: 0.65, side: THREE.DoubleSide, envMapIntensity: 0.8, depthWrite: false,
    });
    const userVaultShell = new THREE.Mesh(vaultShellGeometry, vaultShellMaterial);
    vaultGroup.add(userVaultShell);
    sceneElementsRef.current.userVaultShell = userVaultShell;

    const pathwayMaterial = new THREE.MeshBasicMaterial({ color: 0x00BFFF, transparent: true, opacity: 0.25, side:THREE.DoubleSide });
    (pathwayMaterial as THREE.MeshBasicMaterial).userData = { baseOpacity: 0.25 };
    const internalPathways: THREE.Mesh[] = []; const numPathways = 7; 
    const shellVertices = (vaultShellGeometry.attributes.position.array as Float32Array);
    for (let i = 0; i < numPathways; i++) {
        const startPoint = new THREE.Vector3( (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5 );
        const randomVertexIndex = Math.floor(Math.random() * (shellVertices.length / 3)) * 3;
        const endPoint = new THREE.Vector3( shellVertices[randomVertexIndex], shellVertices[randomVertexIndex + 1], shellVertices[randomVertexIndex + 2] ).multiplyScalar(0.85); 
        const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
        const pathwayGeom = new THREE.CylinderGeometry(0.1, 0.1, direction.length(), 6, 1); 
        pathwayGeom.applyMatrix4(new THREE.Matrix4().makeTranslation(0, direction.length() / 2, 0));
        pathwayGeom.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        const pathway = new THREE.Mesh(pathwayGeom, pathwayMaterial.clone());
        pathway.position.copy(startPoint); pathway.lookAt(endPoint);
        internalPathways.push(pathway); vaultGroup.add(pathway);
    }
    sceneElementsRef.current.internalPathways = internalPathways;
    const fractureMaterial = new THREE.MeshBasicMaterial({ color: 0x87CEFA, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }); 
    const numFractures = 4;
    for (let i = 0; i < numFractures; i++) {
        const planeGeom = new THREE.PlaneGeometry(Math.random()*6 + 3, Math.random()*6+3);
        const plane = new THREE.Mesh(planeGeom, fractureMaterial);
        plane.position.set( (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8 );
        plane.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        vaultGroup.add(plane);
    }
    const fresnelMaterial = new THREE.MeshBasicMaterial({ color: 0x00BFFF, transparent: true, opacity: 0, side: THREE.BackSide });
    const fresnelMesh = new THREE.Mesh(vaultShellGeometry.clone().scale(1.06, 1.06, 1.06), fresnelMaterial); 
    vaultGroup.add(fresnelMesh);

    const createParticles = (count: number, size: number, color1: THREE.Color, color2: THREE.Color, color3: THREE.Color, spreadFactor: number, isLayer2: boolean) => {
      const particleGeometry = new THREE.BufferGeometry();
      const positions = []; const colors = []; const sizes = []; const baseVelocities = []; const pulledByGravityWell = [];
      for (let i = 0; i < count; i++) {
        positions.push((Math.random() - 0.5) * spreadFactor * (isLayer2 ? 2 : 1));
        positions.push((Math.random() - 0.5) * spreadFactor * (isLayer2 ? 2 : 1));
        positions.push((Math.random() - 0.5) * spreadFactor * (isLayer2 ? 1.5 : 1) - (isLayer2 ? 50 : 20) );
        const randomColor = Math.random(); let chosenColor = randomColor < 0.8 ? color1 : (randomColor < 0.95 ? color2 : color3);
        colors.push(chosenColor.r, chosenColor.g, chosenColor.b);
        sizes.push(Math.random() * (isLayer2 ? 0.8 : 1.5) + 0.5);
        baseVelocities.push((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.01);
        pulledByGravityWell.push(0);
      }
      particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      particleGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
      particleGeometry.setAttribute('baseVelocity', new THREE.Float32BufferAttribute(baseVelocities, 3));
      particleGeometry.setAttribute('pulledByGravityWell', new THREE.Float32BufferAttribute(pulledByGravityWell, 1));
      const particleMaterial = new THREE.PointsMaterial({ size: size, vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
      return new THREE.Points(particleGeometry, particleMaterial);
    };
    const nearParticles = createParticles(4000, 0.25, new THREE.Color(0x00FFFF), new THREE.Color(0xF0F0F0), new THREE.Color(0xFF00FF), 200, false);
    scene.add(nearParticles); sceneElementsRef.current.nearParticles = nearParticles;
    const farParticles = createParticles(2500, 0.18, new THREE.Color(0x00FFFF), new THREE.Color(0xF0F0F0), new THREE.Color(0xFF00FF), 400, true);
    scene.add(farParticles); sceneElementsRef.current.farParticles = farParticles;

    [nearParticles, farParticles].forEach(pSystem => {
        const pulledAttr = pSystem.geometry.attributes.pulledByGravityWell as THREE.BufferAttribute;
        let pullCount = 0; const maxPullCount = Math.floor(pulledAttr.count * 0.10); 
        for (let i = 0; i < pulledAttr.count; i++) { if (pullCount < maxPullCount && Math.random() < 0.1) { pulledAttr.setX(i, 1); pullCount++; } }
        pulledAttr.needsUpdate = true;
    });

    const noiseTextureUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAAaklEQVR4Ae3MsQ2AMAwEwXEWBRDUWu0M6V8qPjKzRiwrcsYjYXkz7UASgSA1jESgD5DyBVL+Sj4dfSPk2zQspl9D4Ud3xudjBwDXfAEXKUDXSYCf2Q2E5Rp0AcNl7QIU0Qo4TQtYhXwAdQAAAABJRU5ErkJggg==';
    const nebulaMaterialGen = (color: THREE.Color, mapUrl: string, opacity: number) => {
        const textureLoader = new THREE.TextureLoader(); const texture = textureLoader.load(mapUrl);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        return new THREE.MeshBasicMaterial({ map: texture, color: color, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    };
    const nebula1 = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), nebulaMaterialGen(new THREE.Color(0x3A005E), noiseTextureUrl, 0.18)); 
    nebula1.position.set(-100, 50, -300); scene.add(nebula1);
    const nebula2 = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), nebulaMaterialGen(new THREE.Color(0x6A008A), noiseTextureUrl, 0.13)); 
    nebula2.position.set(150, -30, -250); scene.add(nebula2);
    const nebula3 = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), nebulaMaterialGen(new THREE.Color(0x007B66), noiseTextureUrl, 0.08)); 
    nebula3.position.set(0, 0, -350); scene.add(nebula3);
    sceneElementsRef.current.nebulae = [nebula1, nebula2, nebula3];

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(currentMount.clientWidth, currentMount.clientHeight), 0.5, 0.35, 0.15); 
    composer.addPass(bloomPass);
    
    const radialBlurPass = new ShaderPass(RadialBlurShader);
    radialBlurPass.uniforms.resolution.value.set(currentMount.clientWidth, currentMount.clientHeight);
    radialBlurPass.enabled = false; // Initially disabled
    composer.addPass(radialBlurPass);
    sceneElementsRef.current.radialBlurPass = radialBlurPass;

    const chromaticAberrationPass = new ShaderPass(ChromaticAberrationShader);
    chromaticAberrationPass.uniforms.resolution.value.set(currentMount.clientWidth, currentMount.clientHeight);
    composer.addPass(chromaticAberrationPass);
    const outputPass = new OutputPass(); composer.addPass(outputPass);
    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.material.uniforms['resolution'].value.x = 1 / (currentMount.clientWidth * renderer.getPixelRatio());
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (currentMount.clientHeight * renderer.getPixelRatio());
    composer.addPass(fxaaPass);
    sceneElementsRef.current.composer = composer;

    const handleMouseMove = (event: MouseEvent) => {
      if (lightSpeedPhase !== 'idle') return;
      mousePosition.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mousePosition.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
      targetCameraRotation.current.y = mousePosition.current.x * 0.18; 
      targetCameraRotation.current.x = mousePosition.current.y * 0.09;
      if (sceneElementsRef.current.userVaultShell && sceneElementsRef.current.camera){
          const raycaster = new THREE.Raycaster(); const mouseVec = new THREE.Vector2(mousePosition.current.x, mousePosition.current.y);
          raycaster.setFromCamera(mouseVec, sceneElementsRef.current.camera); 
          const intersects = raycaster.intersectObject(sceneElementsRef.current.userVaultShell, false); 
          isVaultHovered.current = intersects.length > 0;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);

    const clock = new THREE.Clock(); let requestId: number;
    const animate = () => {
      requestId = requestAnimationFrame(animate); 
      const elapsedTime = clock.getElapsedTime();
      const deltaTime = clock.getDelta();
      
      const { 
        camera: animCamera, 
        vaultGroup: animVaultGroup, 
        nearParticles: animNearParticles,
        farParticles: animFarParticles,
        nebulae: animNebulae,
        energyCore: animEnergyCore,
        internalPathways: animInternalPathways,
        radialBlurPass: animRadialBlurPass,
        composer: animComposer,
        sceneAnimationActive
      } = sceneElementsRef.current;

      if (!animCamera || !animVaultGroup || !animComposer) return;

      if (lightSpeedPhase === 'idle' && sceneAnimationActive) {
          currentCameraRotation.current.x += (targetCameraRotation.current.x - currentCameraRotation.current.x) * 0.05;
          currentCameraRotation.current.y += (targetCameraRotation.current.y - currentCameraRotation.current.y) * 0.05;
          const baseCamZ = 100;
          animCamera.position.x = Math.sin(currentCameraRotation.current.y) * baseCamZ * 0.3;
          animCamera.position.y = Math.sin(currentCameraRotation.current.x) * baseCamZ * 0.2;
          animCamera.position.z = baseCamZ - Math.abs(Math.cos(currentCameraRotation.current.y) * baseCamZ * 0.1) - Math.abs(Math.cos(currentCameraRotation.current.x) * baseCamZ * 0.1) ;
          animCamera.lookAt(animVaultGroup.position);

          animVaultGroup.rotation.y += vaultRotationSpeed.current;
          animVaultGroup.rotation.x += Math.sin(elapsedTime * 0.18) * 0.00004; 
          animVaultGroup.rotation.z += Math.cos(elapsedTime * 0.13) * 0.00004;

          if (animEnergyCore) {
            const corePulseSpeed = (animEnergyCore.material as THREE.MeshBasicMaterial).userData.pulseSpeed;
            const corePulseFactor = 0.9 + Math.sin(elapsedTime * corePulseSpeed) * 0.15; 
            animEnergyCore.scale.set(corePulseFactor, corePulseFactor, corePulseFactor);
            (animEnergyCore.material as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(elapsedTime * corePulseSpeed) * 0.25;
          }

          animInternalPathways?.forEach(pathway => {
            if (animEnergyCore) {
                const corePulseSpeed = (animEnergyCore.material as THREE.MeshBasicMaterial).userData.pulseSpeed;
                (pathway.material as THREE.MeshBasicMaterial).opacity = (pathway.material as THREE.MeshBasicMaterial).userData.baseOpacity + Math.sin(elapsedTime * corePulseSpeed + Math.PI/3) * 0.15; 
            }
          });

          if (isVaultHovered.current && animEnergyCore) {
            (animEnergyCore.material as THREE.MeshBasicMaterial).userData.pulseSpeed = Math.PI * 0.8; 
            const currentOpacity = (animEnergyCore.material as THREE.MeshBasicMaterial).opacity;
            (animEnergyCore.material as THREE.MeshBasicMaterial).opacity = Math.min(1, currentOpacity * 1.2);
            animInternalPathways?.forEach(pathway => { 
                (pathway.material as THREE.MeshBasicMaterial).opacity = Math.min(0.6, ((pathway.material as THREE.MeshBasicMaterial).userData.baseOpacity + 0.25 + Math.random()*0.15));
            });
            (fresnelMesh.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp((fresnelMesh.material as THREE.MeshBasicMaterial).opacity, 0.45, 0.1); 
            vaultRotationSpeed.current = THREE.MathUtils.lerp(vaultRotationSpeed.current, 0.00015, 0.1); 
          } else if (animEnergyCore) {
            (animEnergyCore.material as THREE.MeshBasicMaterial).userData.pulseSpeed = Math.PI / 2; 
            (fresnelMesh.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp((fresnelMesh.material as THREE.MeshBasicMaterial).opacity, 0, 0.1);
            vaultRotationSpeed.current = THREE.MathUtils.lerp(vaultRotationSpeed.current, 0.001, 0.1);
          }
          
          const particlePullStrength = 0.05 * deltaTime * 60; 
          const tempVec = new THREE.Vector3(); 

          [animNearParticles, animFarParticles].forEach(pSystem => {
              if (!pSystem) return;
              const positions = pSystem.geometry.attributes.position.array as Float32Array;
              const baseVelocities = pSystem.geometry.attributes.baseVelocity.array as Float32Array;
              const pulledAttr = pSystem.geometry.attributes.pulledByGravityWell as THREE.BufferAttribute;
              const spread = pSystem === animNearParticles ? 200 : 400;

              for (let i = 0; i < positions.length / 3; i++) {
                let currentX = positions[i*3], currentY = positions[i*3+1], currentZ = positions[i*3+2];
                if (showGravityWell && pulledAttr.getX(i) === 1) {
                    const worldYThreshold = -20; 
                    if (currentY < worldYThreshold && Math.abs(currentX) < spread / 4 ) { 
                        tempVec.set(currentX, currentY, currentZ);
                        const directionToWell = gravityWell3DTargetRef.current.clone().sub(tempVec).normalize();
                        baseVelocities[i*3] = THREE.MathUtils.lerp(baseVelocities[i*3], directionToWell.x * 0.1, particlePullStrength * 0.5);
                        baseVelocities[i*3+1] = THREE.MathUtils.lerp(baseVelocities[i*3+1], directionToWell.y * 0.1, particlePullStrength); 
                        baseVelocities[i*3+2] = THREE.MathUtils.lerp(baseVelocities[i*3+2], directionToWell.z * 0.1, particlePullStrength * 0.3);
                    }
                }
                currentX += baseVelocities[i*3] + (Math.random() - 0.5) * 0.01;
                currentY += baseVelocities[i*3+1] + (Math.random() - 0.5) * 0.01;
                currentZ += baseVelocities[i*3+2] + (Math.random() - 0.5) * 0.005;
                if (currentX > spread/2) currentX = -spread/2; if (currentX < -spread/2) currentX = spread/2;
                if (currentY > spread/2) currentY = -spread/2; if (currentY < -spread/2) currentY = spread/2;
                const zDepth = pSystem === animNearParticles ? -20 : -50; const zSpread = pSystem === animNearParticles ? 200 : 400;
                if (currentZ > zDepth + zSpread/2) currentZ = zDepth - zSpread/2; if (currentZ < zDepth - zSpread/2) currentZ = zDepth + zSpread/2;
                positions[i*3] = currentX; positions[i*3+1] = currentY; positions[i*3+2] = currentZ;
              }
              pSystem.geometry.attributes.position.needsUpdate = true;
              pSystem.geometry.attributes.baseVelocity.needsUpdate = true;
          });

          animNebulae?.forEach((neb, idx) => {
            neb.rotation.z += (idx % 2 === 0 ? 0.0001 : -0.00008);
            (neb.material as THREE.MeshBasicMaterial).map!.offset.x += (idx % 3 === 0 ? 0.00005 : -0.00002);
            if (idx === 1) (neb.material as THREE.MeshBasicMaterial).map!.offset.y += 0.00003;
          });
      }
      
      animComposer.render();
    };
    animate();

    const handleResize = () => {
      if (!sceneElementsRef.current.camera || !sceneElementsRef.current.composer) return;
      sceneElementsRef.current.camera.aspect = currentMount.clientWidth / currentMount.clientHeight; 
      sceneElementsRef.current.camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight); 
      sceneElementsRef.current.composer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      fxaaPass.material.uniforms['resolution'].value.x = 1 / (currentMount.clientWidth * renderer.getPixelRatio());
      fxaaPass.material.uniforms['resolution'].value.y = 1 / (currentMount.clientHeight * renderer.getPixelRatio());
      chromaticAberrationPass.uniforms.resolution.value.set(currentMount.clientWidth, currentMount.clientHeight);
      if (sceneElementsRef.current.radialBlurPass) {
        sceneElementsRef.current.radialBlurPass.uniforms.resolution.value.set(currentMount.clientWidth, currentMount.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(requestId); window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('resize', handleResize);
      renderer.dispose(); 
      coreGeometry.dispose(); (coreMaterial as THREE.Material).dispose();
      vaultShellGeometry.dispose(); (vaultShellMaterial as THREE.Material).dispose();
      internalPathways.forEach(p => { p.geometry.dispose(); (p.material as THREE.Material).dispose(); });
      (pathwayMaterial as THREE.Material).dispose();
      (fractureMaterial as THREE.Material).dispose(); 
      (fresnelMaterial as THREE.Material).dispose();
      nearParticles.geometry.dispose(); (nearParticles.material as THREE.PointsMaterial).dispose();
      farParticles.geometry.dispose(); (farParticles.material as THREE.PointsMaterial).dispose();
      sceneElementsRef.current.nebulae?.forEach(n => { n.geometry.dispose(); (n.material as THREE.MeshBasicMaterial).map?.dispose(); ((n.material as THREE.MeshBasicMaterial) as THREE.Material).dispose(); });
      if (currentMount && renderer.domElement) { currentMount.removeChild(renderer.domElement); }
      if (gravityWellAnimationRequestRef.current) cancelAnimationFrame(gravityWellAnimationRequestRef.current);
      gsap.globalTimeline.clear(); // Clear all GSAP animations
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGravityWell]); // Re-run Three.js effect logic if showGravityWell changes


  // Light Speed Transition Logic
  useEffect(() => {
    const { camera, vaultGroup, radialBlurPass, sceneAnimationActive } = sceneElementsRef.current;
    if (!camera || !vaultGroup || !radialBlurPass) return;

    if (lightSpeedPhase === 'initiating') {
      // T=0.0s - 0.2s: Freeze scene
      // console.log("Audio: Orb Flash sound (already handled on mousedown)");
      sceneElementsRef.current.sceneAnimationActive = false;
      // console.log("Audio: THWUMP sound (plays now)");
      // console.log("Audio: Rising WHINE sound (starts now, lasts 1s)");
      
      gsap.to(camera, { 
          duration: 0.2, 
          onComplete: () => setLightSpeedPhase('zooming') 
      });
    } else if (lightSpeedPhase === 'zooming') {
      // T=0.2s - 1.2s: Zoom
      camera.lookAt(vaultGroup.position);
      radialBlurPass.enabled = true;
      
      gsap.to(camera, {
        fov: 120,
        duration: 0.5, // FOV change faster
        ease: 'power2.in',
        onUpdate: () => camera.updateProjectionMatrix(),
      });
      gsap.to(camera.position, {
        x: vaultGroup.position.x + (Math.random() -0.5) * 2, // Slightly inside
        y: vaultGroup.position.y + (Math.random() -0.5) * 2,
        z: vaultGroup.position.z + 5, // Target slightly in front of center, from inside
        duration: 1.0, // Zoom duration
        ease: 'power3.in', // Exponential acceleration
      });
      gsap.to(radialBlurPass.uniforms.strength, {
        value: 0.1, // Max blur strength
        duration: 0.8,
        ease: 'power2.inOut',
      });

      gsap.to({}, { duration: 1.0, onComplete: () => setLightSpeedPhase('breaching') });

    } else if (lightSpeedPhase === 'breaching') {
      // T=1.2s - 1.5s: Breach
      // console.log("Audio: Crescendo into SHATTER + muffled BOOM, then near silence.");
      const flashEl = document.getElementById('fullscreen-flash-container');
      if (flashEl) {
          flashEl.classList.add('animate-screen-flash');
          setTimeout(() => flashEl.classList.remove('animate-screen-flash'), 300);
      }
      
      gsap.to(camera, {
        fov: 60, // Return FOV
        duration: 0.3,
        ease: 'power2.out',
        onUpdate: () => camera.updateProjectionMatrix(),
      });
      gsap.to(radialBlurPass.uniforms.strength, {
        value: 0.0, // Reduce blur
        duration: 0.3,
        ease: 'power1.out',
        onComplete: () => {
            radialBlurPass.enabled = false;
        }
      });

      gsap.to({}, { 
          duration: 0.3, 
          onComplete: () => {
            setLightSpeedPhase('done');
            onTransitionToDataCoreComplete();
          }
      });
    }

  }, [lightSpeedPhase, onTransitionToDataCoreComplete]);


  const dataStreamStarStyles: React.CSSProperties[] = React.useMemo(() => [
    { top: '15%', left: '10%' }, { top: '30%', left: '25%' }, { top: '50%', left: '5%' },
    { top: '70%', left: '15%' }, { top: '85%', left: '30%' }, { top: '20%', left: '40%' },
    { top: '40%', left: '55%' }, { top: '60%', left: '35%' }, { top: '80%', left: '50%' },
    { top: '10%', left: '65%' }, { top: '35%', left: '75%' }, { top: '55%', left: '60%' },
    { top: '75%', left: '80%' }, { top: '90%', left: '68%' }, { top: '5%', left: '90%' },
    { top: '15%', left: '110%' }, { top: '30%', left: '125%' }, { top: '50%', left: '105%' },
    { top: '70%', left: '115%' }, { top: '85%', left: '130%' }, { top: '20%', left: '140%' },
    { top: '40%', left: '155%' }, { top: '60%', left: '135%' }, { top: '80%', left: '150%' },
  ], []);

  const dataStreamLineStyles: React.CSSProperties[] = React.useMemo(() => [
    { top: '22%', left: '12%', width: '15%', transform: 'rotate(45deg)' },
    { top: '60%', left: '8%', width: '20%', transform: 'rotate(-30deg)' },
    { top: '30%', left: '42%', width: '18%', transform: 'rotate(10deg)' },
    { top: '70%', left: '40%', width: '15%', transform: 'rotate(70deg)' },
    { top: '20%', left: '70%', width: '12%', transform: 'rotate(-50deg)' },
    { top: '22%', left: '112%', width: '15%', transform: 'rotate(45deg)' },
    { top: '60%', left: '108%', width: '20%', transform: 'rotate(-30deg)' },
  ], []);

  const [gravityWellContainerClass, setGravityWellContainerClass] = useState("gravity-well-container");

  useEffect(() => {
    if (!showGravityWell) {
      setGravityWellContainerClass("gravity-well-container fade-out");
      const timer = setTimeout(() => {
        if (window.scrollY > 0) { 
             setGravityWellContainerClass("gravity-well-container fade-out hidden");
        }
      }, 500); 
      return () => clearTimeout(timer);
    } else {
      setGravityWellContainerClass("gravity-well-container");
    }
  }, [showGravityWell]);


  return (
    <section id="hero" className="relative font-orbitron min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden">
      <div ref={mountRef} className="absolute inset-0 z-0"></div>

      {lightSpeedPhase === 'idle' && (
        <>
            <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden"> 
            {titleShards.map(shard => (
            <div
                key={shard.id}
                className={`title-shard 
                ${titleAnimationPhase === 'shardsEntering' ? 'animate-shard-ingress' : ''}
                ${titleAnimationPhase === 'shardsSwarming' ? 'animate-shard-swarm' : ''}
                ${titleAnimationPhase === 'textForming' ? 'animate-shard-coalesce' : ''}
                `}
                style={{ 
                ...shard.style, 
                opacity: titleAnimationPhase === 'idle' || titleAnimationPhase === 'stable' ? 0 : undefined 
                }} 
            />
            ))}
        </div>
        
        <div 
            className="relative z-10 text-center flex flex-col items-center"
            style={{
            position: 'absolute',
            top: '25%', 
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(80vw, 1200px)', 
            }}
        >
            <div ref={titleFlashRef} className="absolute title-impact-flash-container opacity-0" 
                style={{ 
                top: '50%', left: '50%', transform: 'translate(-50%, -50%)', 
                width: '150%', height: '200%' 
                }}
            />
            <div className="relative title-impact-flash-container">
            <h1
                ref={titleRef}
                className={`text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 font-exo2-bold
                            ${titleAnimationPhase === 'stable' ? 'title-stable-styling' : ''}
                        `}
                aria-label={titleText}
            >
                {titleText.split("").map((char, index) => (
                <span
                    key={index}
                    className={`title-text-element 
                                ${titleAnimationPhase === 'textForming' ? 'animate-text-snap-in' : 'opacity-0'}
                            `}
                    style={{ 
                    animationDelay: `${index * 0.02}s`, 
                    }}
                >
                    {char === " " ? "\u00A0" : char}
                </span>
                ))}
            </h1>
            {showEmbers && titleAnimationPhase === 'stable' && Array.from({ length: 25 }).map((_, i) => {
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * (titleRef.current?.offsetWidth || 300) * 0.4 + 20;
                const tx = Math.cos(angle) * (radius + Math.random() * 80); 
                const ty = Math.sin(angle) * (radius + Math.random() * 80) - (titleRef.current?.offsetHeight || 50) * 0.2;
                const duration = Math.random() * 2.0 + 3.0; 
                const delay = Math.random() * 2.5; 
                const size = Math.random() * 2.5 + 1.0; 
                const initialOpacity = Math.random() * 0.4 + 0.6;
                return (
                <div
                    key={`ember-${i}`}
                    className="ember-particle"
                    style={{
                    left: `calc(50% + ${(Math.random() - 0.5) * (titleRef.current?.offsetWidth || 300) * 0.6}px)`, 
                    top: `calc(50% + ${(Math.random() - 0.5) * (titleRef.current?.offsetHeight || 100) * 0.3}px)`,  
                    width: `${size}px`, 
                    height: `${size}px`,
                    animationName: 'ember-fly-fade', 
                    animationDuration: `${duration}s`,
                    animationDelay: `${delay}s`,
                    // @ts-ignore
                    '--ember-tx': `${tx}px`,
                    '--ember-ty': `${ty}px`,
                    '--ember-initial-opacity': initialOpacity,
                    }}
                />
                );
            })}
            </div>

            <p className="text-xl sm:text-2xl md:text-3xl text-purple-300 mb-12 h-10 font-mono overflow-hidden whitespace-nowrap">
            {typedSubtitle}
            <span className="animate-ping text-purple-300">_</span>
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 items-center justify-center">
                <button
                    ref={orbRef}
                    onClick={handleOrbClick}
                    onMouseDown={handleOrbMouseDown}
                    onMouseUp={handleOrbMouseUp}
                    onMouseEnter={() => setIsOrbHoveredState(true)}
                    onMouseLeave={() => setIsOrbHoveredState(false)}
                    aria-label="Initiate Calibration"
                    className={`orb-container mr-6 
                            ${isOrbHoveredState 
                                ? 'animate-orb-vibration orb-layer-1-corona-hover' 
                                : 'orb-layer-1-corona orb-layer-1-corona-pulsing'
                            }`}
                    style={{ 
                        width: '8vw', height: '8vw', 
                        maxWidth: '120px', maxHeight: '120px'
                    }}
                >
                    <div className="orb-layer-2-atmosphere"></div>
                    <div 
                        ref={orbCoreRef}
                        className={`orb-layer-3-core ${isOrbHoveredState ? 'orb-layer-3-core-hover' : ''}`}
                    ></div>
                    {isOrbHoveredState && orbRef.current && (
                        <svg 
                            className="orb-lightning-svg"
                            viewBox={`0 0 ${orbRef.current.offsetWidth} ${orbRef.current.offsetHeight}`} 
                            preserveAspectRatio="xMidYMid meet"
                        >
                        {lightningArcs.map(arc => (
                            <path 
                                key={arc.id} 
                                d={arc.d} 
                                stroke="#FFFFFF" 
                                strokeWidth="0.7" 
                                fill="none" 
                                className="animate-lightning-arc-fade" 
                                style={{ 
                                    strokeLinecap: 'round', 
                                    strokeDasharray: '200', strokeDashoffset: '200', 
                                    filter: 'drop-shadow(0 0 1px #FFFFFF) drop-shadow(0 0 2px #FFFFF0)', 
                                    ...(arc.style || {})
                                }} 
                            />
                        ))}
                        </svg>
                    )}
                    <div className="orb-layer-4-lens"></div>
                    <span className="orb-layer-5-text">
                        INITIATE<br/>CALIBRATION
                    </span>
                    <div 
                        ref={orbClickFlashRef}
                        className="orb-click-flash-element"
                    ></div>
                </button>

            <button
                onClick={onMapDataStream}
                className="relative w-64 h-16 bg-cyan-500/10 border border-cyan-500 text-white 
                        font-exo2 text-base rounded-full 
                        flex items-center justify-center overflow-hidden group
                        hover:bg-cyan-500/30 hover:border-cyan-300 
                        active:scale-98 transition-all duration-500 ease-in-out
                        focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/50"
                style={{ WebkitTapHighlightColor: 'transparent' }}
            >
                <span className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
                <span className="absolute top-0 left-0 w-[50%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-effect -translate-x-full"></span>
                </span>
                <div className="absolute inset-0 w-full h-full overflow-hidden rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute top-0 left-0 w-[200%] h-full animate-starchart-pan-effect"> 
                    <div className="absolute inset-0 bg-gradient-radial from-cyan-900/20 via-cyan-800/5 to-transparent opacity-40"></div>
                    {dataStreamStarStyles.map((style, i) => <StarChartStar key={`star-${i}`} style={style} />)}
                    {dataStreamLineStyles.map((style, i) => <StarChartLine key={`line-${i}`} style={style} />)}
                </div>
                </div>
                <span className="relative z-10 select-none">MAP THE DATA-STREAM</span>
            </button>
            </div>
        </div>
        
        <div
            className={gravityWellContainerClass}
            onClick={onMapDataStream}
            title="Scroll Down"
            aria-label="Scroll to data stream map"
        >
            <canvas ref={gravityWellCanvasRef} className="gravity-well-canvas"></canvas>
            <div className="gravity-well-singularity"></div>
        </div>
      </>
      )}


    </section>
  );
};

export default HeroSection;