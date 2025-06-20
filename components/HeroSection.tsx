
import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

import { ChevronDownIcon } from './icons';

interface HeroSectionProps {
  onInitiateCalibration: () => void;
  onMapDataStream: () => void;
}

const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2() },
    power: { value: 0.0015 } // Slightly adjusted power
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

const HeroSection: React.FC<HeroSectionProps> = ({ onInitiateCalibration, onMapDataStream }) => {
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

  useEffect(() => {
    const newShards = Array.from({ length: NUM_TITLE_SHARDS }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 60 + 110; // Start further out, vw/vh units
      const initialX = `${Math.cos(angle) * radius}vw`;
      const initialY = `${Math.sin(angle) * radius}vh`;
      const initialRotation = `${Math.random() * 360 - 180}deg`;
      
      const targetCenterX = `calc(50% + ${Math.random() * 100 - 50}px)`; 
      // Adjust Y target for title at top 25%
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
      // Embers can persist
    }
  }, [titleAnimationPhase]);


  useEffect(() => {
    if (typedSubtitle.length < fullSubtitle.length) {
      const timer = setTimeout(() => {
        setTypedSubtitle(fullSubtitle.substring(0, typedSubtitle.length + 1));
      }, 70); // Slightly faster typing
      return () => clearTimeout(timer);
    }
  }, [typedSubtitle, fullSubtitle]);

  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, 2000);
    camera.position.z = 100;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 1); // Ensure background is black
    currentMount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5,10,7);
    scene.add(directionalLight);


    const vaultGroup = new THREE.Group();
    scene.add(vaultGroup);

    const coreGeometry = new THREE.SphereGeometry(3.5, 32, 32); 
    const coreMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00BFFF, 
        transparent: true, 
        opacity: 0.85, // Slightly more opaque core
     });
    const energyCore = new THREE.Mesh(coreGeometry, coreMaterial);
    (energyCore.material as THREE.MeshBasicMaterial).userData = { baseEmissiveIntensity: 1.5, pulseSpeed: Math.PI / 2 }; 
    vaultGroup.add(energyCore);

    // New "Elegant Complexity" points generation for Obsidian/Bismuth fusion
    const points: THREE.Vector3[] = [];
    const RGen = (yLevel: number, angle: number, variance: number = 0.3) => {
        return 8 + Math.sin(yLevel * 0.2 + angle * 3) * 2.5 + Math.cos(angle * 2 + yLevel * 0.1) * 2;
    };

    const yLevels = [-10, -6, -2, 2, 6, 10]; // Defines layers of points
    const pointsPerLevel = 6; // More points for complex faceting
    
    yLevels.forEach((y, yIdx) => {
        for (let i = 0; i < pointsPerLevel; i++) {
            const angle = (i / pointsPerLevel) * Math.PI * 2 + (yIdx * 0.45); // Stagger angle per level for faceting
            const baseRadius = RGen(y, angle);
            const radius = baseRadius * (1 + (Math.random() - 0.5) * 0.15); // Slight randomness to radius
            points.push(new THREE.Vector3(
                Math.cos(angle) * radius,
                y + (Math.random() - 0.5) * 1.5, // Slight y variation for asymmetry
                Math.sin(angle) * radius
            ));
        }
    });

    // Add prominent spire/facet points for sharpness (Obsidian influence)
    points.push(new THREE.Vector3(0, 15, 0)); // Top spire
    points.push(new THREE.Vector3(0, -15, 0)); // Bottom spire
    points.push(new THREE.Vector3(12, Math.random()*4 - 2, Math.random()*4 - 2));
    points.push(new THREE.Vector3(-12, Math.random()*4 - 2, Math.random()*4 - 2));
    points.push(new THREE.Vector3(Math.random()*4 - 2, 10, Math.random()*4 - 2));
    points.push(new THREE.Vector3(Math.random()*4 - 2, -10, Math.random()*4 - 2));
    points.push(new THREE.Vector3(Math.random()*3-1.5, Math.random()*3-1.5, 13));
    points.push(new THREE.Vector3(Math.random()*3-1.5, Math.random()*3-1.5, -13));


    const vaultShellGeometry = new ConvexGeometry(points);
    vaultShellGeometry.computeVertexNormals(); 

    const vaultShellMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x90C8E8, // Lighter, slightly more ethereal blue/grey for shell
      metalness: 0.1,
      roughness: 0.05, // Very smooth for glass/obsidian look
      transmission: 0.96, 
      ior: 2.33, // High IOR for strong refraction (like diamond, for effect)
      thickness: 6, 
      transparent: true,
      opacity: 0.65, // Shell itself is semi-transparent, not fully solid
      side: THREE.DoubleSide,
      envMapIntensity: 0.8,
      depthWrite: false,
      // No emissive properties for the shell itself
    });
    const userVaultShell = new THREE.Mesh(vaultShellGeometry, vaultShellMaterial);
    vaultGroup.add(userVaultShell);

    const pathwayMaterial = new THREE.MeshBasicMaterial({ color: 0x00BFFF, transparent: true, opacity: 0.25, side:THREE.DoubleSide });
    (pathwayMaterial as THREE.MeshBasicMaterial).userData = { baseOpacity: 0.25 };
    const internalPathways: THREE.Mesh[] = [];
    const numPathways = 7; // Fewer, more distinct pathways
    const shellVertices = (vaultShellGeometry.attributes.position.array as Float32Array);

    for (let i = 0; i < numPathways; i++) {
        const startPoint = new THREE.Vector3( // Start near core, but slightly offset
            (Math.random() - 0.5) * 1.5, 
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 1.5
        );
        const randomVertexIndex = Math.floor(Math.random() * (shellVertices.length / 3)) * 3;
        const endPoint = new THREE.Vector3(
            shellVertices[randomVertexIndex],
            shellVertices[randomVertexIndex + 1],
            shellVertices[randomVertexIndex + 2]
        ).multiplyScalar(0.85); // End point slightly inside the shell

        const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
        const pathwayGeom = new THREE.CylinderGeometry(0.1, 0.1, direction.length(), 6, 1); // Thinner pathways
        pathwayGeom.applyMatrix4(new THREE.Matrix4().makeTranslation(0, direction.length() / 2, 0));
        pathwayGeom.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        
        const pathway = new THREE.Mesh(pathwayGeom, pathwayMaterial.clone());
        pathway.position.copy(startPoint);
        pathway.lookAt(endPoint);
        internalPathways.push(pathway);
        vaultGroup.add(pathway);
    }
    
    const fractureMaterial = new THREE.MeshBasicMaterial({ color: 0x87CEFA, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }); // Fainter fractures
    const numFractures = 4;
    for (let i = 0; i < numFractures; i++) {
        const planeGeom = new THREE.PlaneGeometry(Math.random()*6 + 3, Math.random()*6+3);
        const plane = new THREE.Mesh(planeGeom, fractureMaterial);
        plane.position.set(
            (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8
        );
        plane.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        vaultGroup.add(plane);
    }

    const fresnelMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00BFFF, transparent: true, opacity: 0, side: THREE.BackSide 
    });
    const fresnelMesh = new THREE.Mesh(vaultShellGeometry.clone().scale(1.06, 1.06, 1.06), fresnelMaterial); 
    vaultGroup.add(fresnelMesh);

    const createParticles = (count: number, size: number, color1: THREE.Color, color2: THREE.Color, color3: THREE.Color, spreadFactor: number, isLayer2: boolean) => {
      const particleGeometry = new THREE.BufferGeometry();
      const positions = []; const colors = []; const sizes = []; const baseVelocities = [];
      for (let i = 0; i < count; i++) {
        positions.push((Math.random() - 0.5) * spreadFactor * (isLayer2 ? 2 : 1));
        positions.push((Math.random() - 0.5) * spreadFactor * (isLayer2 ? 2 : 1));
        positions.push((Math.random() - 0.5) * spreadFactor * (isLayer2 ? 1.5 : 1) - (isLayer2 ? 50 : 20) );
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
    const nearParticles = createParticles(4000, 0.25, new THREE.Color(0x00FFFF), new THREE.Color(0xF0F0F0), new THREE.Color(0xFF00FF), 200, false);
    scene.add(nearParticles);
    const farParticles = createParticles(2500, 0.18, new THREE.Color(0x00FFFF), new THREE.Color(0xF0F0F0), new THREE.Color(0xFF00FF), 400, true);
    scene.add(farParticles);

    const noiseTextureUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAAaklEQVR4Ae3MsQ2AMAwEwXEWBRDUWu0M6V8qPjKzRiwrcsYjYXkz7UASgSA1jESgD5DyBVL+Sj4dfSPk2zQspl9D4Ud3xudjBwDXfAEXKUDXSYCf2Q2E5Rp0AcNl7QIU0Qo4TQtYhXwAdQAAAABJRU5ErkJggg==';
    const nebulaMaterialGen = (color: THREE.Color, mapUrl: string, opacity: number) => {
        const textureLoader = new THREE.TextureLoader(); const texture = textureLoader.load(mapUrl);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        return new THREE.MeshBasicMaterial({ map: texture, color: color, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    };
    const nebula1 = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), nebulaMaterialGen(new THREE.Color(0x3A005E), noiseTextureUrl, 0.18)); // Darker purple
    nebula1.position.set(-100, 50, -300); scene.add(nebula1);
    const nebula2 = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), nebulaMaterialGen(new THREE.Color(0x6A008A), noiseTextureUrl, 0.13)); // Medium purple
    nebula2.position.set(150, -30, -250); scene.add(nebula2);
    const nebula3 = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), nebulaMaterialGen(new THREE.Color(0x007B66), noiseTextureUrl, 0.08)); // Darker teal/green
    nebula3.position.set(0, 0, -350); scene.add(nebula3);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(currentMount.clientWidth, currentMount.clientHeight), 0.5, 0.35, 0.15); 
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
      targetCameraRotation.current.y = mousePosition.current.x * 0.18; // Slightly less camera move
      targetCameraRotation.current.x = mousePosition.current.y * 0.09;
      const raycaster = new THREE.Raycaster(); const mouseVec = new THREE.Vector2(mousePosition.current.x, mousePosition.current.y);
      raycaster.setFromCamera(mouseVec, camera); 
      const intersects = raycaster.intersectObject(userVaultShell, false); 
      isVaultHovered.current = intersects.length > 0;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const clock = new THREE.Clock(); let requestId: number;
    const animate = () => {
      requestId = requestAnimationFrame(animate); 
      const elapsedTime = clock.getElapsedTime();
      
      currentCameraRotation.current.x += (targetCameraRotation.current.x - currentCameraRotation.current.x) * 0.05;
      currentCameraRotation.current.y += (targetCameraRotation.current.y - currentCameraRotation.current.y) * 0.05;
      const baseCamZ = 100;
      camera.position.x = Math.sin(currentCameraRotation.current.y) * baseCamZ * 0.3;
      camera.position.y = Math.sin(currentCameraRotation.current.x) * baseCamZ * 0.2;
      camera.position.z = baseCamZ - Math.abs(Math.cos(currentCameraRotation.current.y) * baseCamZ * 0.1) - Math.abs(Math.cos(currentCameraRotation.current.x) * baseCamZ * 0.1) ;
      camera.lookAt(vaultGroup.position);

      vaultGroup.rotation.y += vaultRotationSpeed.current;
      vaultGroup.rotation.x += Math.sin(elapsedTime * 0.18) * 0.00004; 
      vaultGroup.rotation.z += Math.cos(elapsedTime * 0.13) * 0.00004;

      const corePulseSpeed = (energyCore.material as THREE.MeshBasicMaterial).userData.pulseSpeed;
      const corePulseFactor = 0.9 + Math.sin(elapsedTime * corePulseSpeed) * 0.15; 
      energyCore.scale.set(corePulseFactor, corePulseFactor, corePulseFactor);
      (energyCore.material as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(elapsedTime * corePulseSpeed) * 0.25;

      internalPathways.forEach(pathway => {
        (pathway.material as THREE.MeshBasicMaterial).opacity = (pathway.material as THREE.MeshBasicMaterial).userData.baseOpacity + Math.sin(elapsedTime * corePulseSpeed + Math.PI/3) * 0.15; 
      });

      if (isVaultHovered.current) {
        (energyCore.material as THREE.MeshBasicMaterial).userData.pulseSpeed = Math.PI * 0.8; // Slightly faster pulse for hover (2.5s cycle)
        const currentOpacity = (energyCore.material as THREE.MeshBasicMaterial).opacity;
        (energyCore.material as THREE.MeshBasicMaterial).opacity = Math.min(1, currentOpacity * 1.2);


        internalPathways.forEach(pathway => { 
            (pathway.material as THREE.MeshBasicMaterial).opacity = Math.min(0.6, ((pathway.material as THREE.MeshBasicMaterial).userData.baseOpacity + 0.25 + Math.random()*0.15));
        });
        (fresnelMaterial as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp((fresnelMaterial as THREE.MeshBasicMaterial).opacity, 0.45, 0.1); 
        vaultRotationSpeed.current = THREE.MathUtils.lerp(vaultRotationSpeed.current, 0.00015, 0.1); 
      } else {
        (energyCore.material as THREE.MeshBasicMaterial).userData.pulseSpeed = Math.PI / 2; // Normal pulse speed (4s cycle)
        (fresnelMaterial as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp((fresnelMaterial as THREE.MeshBasicMaterial).opacity, 0, 0.1);
        vaultRotationSpeed.current = THREE.MathUtils.lerp(vaultRotationSpeed.current, 0.001, 0.1);
      }
      
      [nearParticles, farParticles].forEach(pSystem => {
          const positions = pSystem.geometry.attributes.position.array as Float32Array;
          const baseVelocities = pSystem.geometry.attributes.baseVelocity.array as Float32Array;
          const spread = pSystem === nearParticles ? 200 : 400;
          for (let i = 0; i < positions.length / 3; i++) {
            positions[i*3] += baseVelocities[i*3] + (Math.random() - 0.5) * 0.01;
            positions[i*3+1] += baseVelocities[i*3+1] + (Math.random() - 0.5) * 0.01;
            positions[i*3+2] += baseVelocities[i*3+2] + (Math.random() - 0.5) * 0.005;
            if (positions[i*3] > spread/2) positions[i*3] = -spread/2; if (positions[i*3] < -spread/2) positions[i*3] = spread/2;
            if (positions[i*3+1] > spread/2) positions[i*3+1] = -spread/2; if (positions[i*3+1] < -spread/2) positions[i*3+1] = spread/2;
            const zDepth = pSystem === nearParticles ? -20 : -50; const zSpread = pSystem === nearParticles ? 200 : 400;
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
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(requestId); window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('resize', handleResize);
      renderer.dispose(); 
      coreGeometry.dispose(); coreMaterial.dispose();
      vaultShellGeometry.dispose(); vaultShellMaterial.dispose();
      internalPathways.forEach(p => { p.geometry.dispose(); (p.material as THREE.Material).dispose(); });
      pathwayMaterial.dispose();
      fractureMaterial.dispose(); 
      fresnelMaterial.dispose();
      nearParticles.geometry.dispose(); (nearParticles.material as THREE.PointsMaterial).dispose();
      farParticles.geometry.dispose(); (farParticles.material as THREE.PointsMaterial).dispose();
      nebula1.geometry.dispose(); (nebula1.material as THREE.MeshBasicMaterial).map?.dispose(); (nebula1.material as THREE.MeshBasicMaterial).dispose();
      nebula2.geometry.dispose(); (nebula2.material as THREE.MeshBasicMaterial).map?.dispose(); (nebula2.material as THREE.MeshBasicMaterial).dispose();
      nebula3.geometry.dispose(); (nebula3.material as THREE.MeshBasicMaterial).map?.dispose(); (nebula3.material as THREE.MeshBasicMaterial).dispose();
      if (currentMount && renderer.domElement) { currentMount.removeChild(renderer.domElement); }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <section id="hero" className="relative font-orbitron min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden">
      <div ref={mountRef} className="absolute inset-0 z-0"></div>

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
      
      {/* Main content block: Title, Subtitle, Buttons. Positioned absolutely. */}
      <div 
        className="relative z-10 text-center flex flex-col items-center"
        style={{
          position: 'absolute',
          top: '25%', // Top of this block at 25% from viewport top
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(80vw, 1200px)', // Max 80% viewport width or 1200px
        }}
      >
        <div ref={titleFlashRef} className="absolute title-impact-flash-container opacity-0" 
             style={{ 
               // Ensure flash covers the title area appropriately
               top: '50%', left: '50%', transform: 'translate(-50%, -50%)', 
               width: '150%', height: '200%' // Larger flash area
             }}
        />
        <div className="relative title-impact-flash-container"> {/* Container for h1 and embers */}
          <h1
            ref={titleRef}
            className={`text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 font-exo2-bold
                        ${titleAnimationPhase === 'stable' ? 'title-stable-styling' : ''}
                      `}
            aria-label={titleText} // Accessibility: label for the heading
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
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
          <button
            onClick={onInitiateCalibration}
            className="group relative w-60 h-16 bg-cyan-500 text-gray-900 font-bold text-lg rounded-full flex items-center justify-center
                       hover:bg-cyan-400 transition-all duration-300 animate-pulse-orb"
          >
            <span className="relative z-10">INITIATE CALIBRATION</span>
            <span className="absolute top-1/2 left-1/2 w-1 h-1 bg-white rounded-full opacity-0 group-hover:opacity-100 
                           transform -translate-x-1/2 -translate-y-1/2 
                           group-hover:animate-spark">
            </span>
          </button>
          <button
            onClick={onMapDataStream}
            className="relative w-60 h-16 border-2 border-purple-500 text-purple-300 font-bold text-lg rounded-full 
                       flex items-center justify-center overflow-hidden group
                       hover:bg-purple-500/30 hover:text-purple-100 transition-all duration-300"
          >
            <span className="relative z-10">MAP THE DATA-STREAM</span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="absolute bg-purple-200 rounded-full animate-ping group-hover:animate-none"
                     style={{
                       width: `${Math.random()*2+1}px`, height: `${Math.random()*2+1}px`,
                       top: `${Math.random()*80+10}%`, left: `${Math.random()*80+10}%`,
                       animationDelay: `${Math.random()*0.5}s`,
                       animationDuration: `${Math.random()*1+1}s`
                     }}></div>
              ))}
            </div>
          </button>
        </div>
      </div>

      <div 
        onClick={onMapDataStream}
        className="absolute left-1/2 transform -translate-x-1/2 cursor-pointer group z-10"
        style={{ bottom: '5%' }} // Positioned 5% from bottom
        title="Scroll Down"
        aria-label="Scroll to data stream map"
      >
        <div className="w-16 h-16 border-2 border-indigo-400 rounded-full flex items-center justify-center animate-pulse">
            <ChevronDownIcon className="w-8 h-8 text-indigo-300 group-hover:text-cyan-300 transition-colors" />
        </div>
        {[...Array(3)].map((_,i) => ( 
          <div key={i} className="absolute w-1 h-1 bg-indigo-300 rounded-full animate-ping"
             style={{ 
               top: `${Math.random()*20 - 10}px`, left: `${Math.random()*20 - 10}px`,
               animationDelay: `${i*0.2}s`, animationDuration: '2s'
             }}>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HeroSection;
