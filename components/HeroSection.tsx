
import React, { useState, useEffect, useCallback, useRef } from 'react';
// Removed duplicate: import * React from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { ChevronDownIcon } from './icons';

interface HeroSectionProps {
  onInitiateCalibration: () => void;
  onMapDataStream: () => void;
}

// Chromatic Aberration Shader (simplified)
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

type TitleAnimationState = 'idle' | 'constructing' | 'charsConstructed' | 'flashing' | 'settled';

const HeroSection: React.FC<HeroSectionProps> = ({ onInitiateCalibration, onMapDataStream }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [typedSubtitle, setTypedSubtitle] = useState('');
  const fullSubtitle = "Calibrate Your Synapse. Master Your Data-Verse.";
  const title = "DigiLocker Tutorial"; // New title
  
  const mousePosition = useRef({ x: 0, y: 0 }); 
  const targetCameraRotation = useRef({ x: 0, y: 0 });
  const currentCameraRotation = useRef({ x: 0, y: 0 });

  const isVaultHovered = useRef(false);
  const vaultRotationSpeed = useRef(0.002);

  const [titleAnimationState, setTitleAnimationState] = useState<TitleAnimationState>('idle');
  const [showEmbers, setShowEmbers] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Character construction animation settings
  const charAnimDuration = 0.4; // seconds
  const charAnimDelayIncrement = 0.05; // seconds

  useEffect(() => {
    setTitleAnimationState('constructing');
    const totalCharAnimTime = (title.length -1) * charAnimDelayIncrement + charAnimDuration;
    
    const timerConstructionDone = setTimeout(() => {
      setTitleAnimationState('charsConstructed');
    }, totalCharAnimTime * 1000);

    return () => {
      clearTimeout(timerConstructionDone);
    };
  }, [title]);

  useEffect(() => {
    if (titleAnimationState === 'charsConstructed') {
      setTitleAnimationState('flashing');
      const flashDuration = 0.2; // Corresponds to impact-flash animation
      const timerFlashDone = setTimeout(() => {
        setTitleAnimationState('settled');
      }, flashDuration * 1000);
      return () => clearTimeout(timerFlashDone);
    }
  }, [titleAnimationState]);

  useEffect(() => {
    if (titleAnimationState === 'settled') {
      setShowEmbers(true);
      const embersDuration = 4000; // Embers visible for 4s
      const timerClearEmbers = setTimeout(() => {
        setShowEmbers(false); 
      }, embersDuration);
      return () => clearTimeout(timerClearEmbers);
    }
  }, [titleAnimationState]);


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
    // Scene setup (omitted for brevity, remains the same as original)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, 2000);
    camera.position.z = 100;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 1);
    currentMount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const vaultGeometry = new THREE.IcosahedronGeometry(15, 1);
    const vaultMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xADD8E6, metalness: 0.1, roughness: 0.2, transmission: 0.9,
      ior: 1.8, thickness: 5, transparent: true, opacity: 0.8,
      side: THREE.DoubleSide, envMapIntensity: 0.5,
    });
    const userVault = new THREE.Mesh(vaultGeometry, vaultMaterial);
    scene.add(userVault);

    const coreGeometry = new THREE.SphereGeometry(3, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0x00BFFF, transparent: true, opacity: 0.7 });
    const energyCore = new THREE.Mesh(coreGeometry, coreMaterial);
    userVault.add(energyCore);

    const fresnelMaterial = new THREE.MeshBasicMaterial({ color: 0x00BFFF, transparent: true, opacity: 0, side: THREE.BackSide });
    const fresnelMesh = new THREE.Mesh(vaultGeometry.clone().scale(1.1, 1.1, 1.1), fresnelMaterial);
    userVault.add(fresnelMesh);

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
      particleMaterial.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <output_fragment>',`
          #include <output_fragment>
          float dx = abs(gl_PointCoord.x - 0.5); float dy = abs(gl_PointCoord.y - 0.5);
          outgoingLight.a *= (1.0 - smoothstep(0.4, 0.5, dx)) * (1.0 - smoothstep(0.2, 0.25, dy));`
        );
      };
      return new THREE.Points(particleGeometry, particleMaterial);
    };
    const nearParticles = createParticles(5000, 0.3, new THREE.Color(0x00FFFF), new THREE.Color(0xF0F0F0), new THREE.Color(0xFF00FF), 200, false);
    scene.add(nearParticles);
    const farParticles = createParticles(3000, 0.2, new THREE.Color(0x00FFFF), new THREE.Color(0xF0F0F0), new THREE.Color(0xFF00FF), 400, true);
    scene.add(farParticles);

    const noiseTextureUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAAaklEQVR4Ae3MsQ2AMAwEwXEWBRDUWu0M6V8qPjKzRiwrcsYjYXkz7UASgSA1jESgD5DyBVL+Sj4dfSPk2zQspl9D4Ud3xudjBwDXfAEXKUDXSYCf2Q2E5Rp0AcNl7QIU0Qo4TQtYhXwAdQAAAABJRU5ErkJggg==';
    const nebulaMaterial = (color: THREE.Color, mapUrl: string, opacity: number) => {
        const textureLoader = new THREE.TextureLoader(); const texture = textureLoader.load(mapUrl);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        return new THREE.MeshBasicMaterial({ map: texture, color: color, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    };
    const nebula1 = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), nebulaMaterial(new THREE.Color(0x4B0082), noiseTextureUrl, 0.2));
    nebula1.position.set(-100, 50, -300); scene.add(nebula1);
    const nebula2 = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), nebulaMaterial(new THREE.Color(0x8A2BE2), noiseTextureUrl, 0.15));
    nebula2.position.set(150, -30, -250); scene.add(nebula2);
    const nebula3 = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), nebulaMaterial(new THREE.Color(0x009B77), noiseTextureUrl, 0.1));
    nebula3.position.set(0, 0, -350); scene.add(nebula3);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(currentMount.clientWidth, currentMount.clientHeight), 0.7, 0.3, 0.1);
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
      targetCameraRotation.current.y = mousePosition.current.x * 0.2;
      targetCameraRotation.current.x = mousePosition.current.y * 0.1;
      const raycaster = new THREE.Raycaster(); const mouseVec = new THREE.Vector2(mousePosition.current.x, mousePosition.current.y);
      raycaster.setFromCamera(mouseVec, camera); const intersects = raycaster.intersectObject(userVault);
      isVaultHovered.current = intersects.length > 0;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const clock = new THREE.Clock(); let requestId: number;
    const animate = () => {
      requestId = requestAnimationFrame(animate); const elapsedTime = clock.getElapsedTime();
      currentCameraRotation.current.x += (targetCameraRotation.current.x - currentCameraRotation.current.x) * 0.05;
      currentCameraRotation.current.y += (targetCameraRotation.current.y - currentCameraRotation.current.y) * 0.05;
      const baseCamZ = 100;
      camera.position.x = Math.sin(currentCameraRotation.current.y) * baseCamZ * 0.3;
      camera.position.y = Math.sin(currentCameraRotation.current.x) * baseCamZ * 0.2;
      camera.position.z = baseCamZ - Math.abs(Math.cos(currentCameraRotation.current.y) * baseCamZ * 0.1) - Math.abs(Math.cos(currentCameraRotation.current.x) * baseCamZ * 0.1) ;
      camera.lookAt(userVault.position);

      userVault.rotation.y += vaultRotationSpeed.current;
      userVault.rotation.x += Math.sin(elapsedTime * 0.5) * 0.0001;
      userVault.rotation.z += Math.cos(elapsedTime * 0.3) * 0.0001;
      const pulseScale = 1 + Math.sin(elapsedTime * 2) * 0.1;
      energyCore.scale.set(pulseScale, pulseScale, pulseScale);
      (energyCore.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(elapsedTime * 2) * 0.2;

      if (isVaultHovered.current) {
        (energyCore.material as THREE.MeshBasicMaterial).opacity = Math.min(1, (0.7 + Math.sin(elapsedTime * 2.4) * 0.2) * 1.2);
        (fresnelMaterial as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp((fresnelMaterial as THREE.MeshBasicMaterial).opacity, 0.3, 0.1);
        vaultRotationSpeed.current = THREE.MathUtils.lerp(vaultRotationSpeed.current, 0.0005, 0.1);
      } else {
        (fresnelMaterial as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp((fresnelMaterial as THREE.MeshBasicMaterial).opacity, 0, 0.1);
        vaultRotationSpeed.current = THREE.MathUtils.lerp(vaultRotationSpeed.current, 0.002, 0.1);
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
      renderer.dispose(); vaultGeometry.dispose(); vaultMaterial.dispose(); coreGeometry.dispose(); coreMaterial.dispose(); fresnelMaterial.dispose();
      nearParticles.geometry.dispose(); (nearParticles.material as THREE.PointsMaterial).dispose();
      farParticles.geometry.dispose(); (farParticles.material as THREE.PointsMaterial).dispose();
      nebula1.geometry.dispose(); (nebula1.material as THREE.MeshBasicMaterial).map?.dispose(); (nebula1.material as THREE.MeshBasicMaterial).dispose();
      nebula2.geometry.dispose(); (nebula2.material as THREE.MeshBasicMaterial).map?.dispose(); (nebula2.material as THREE.MeshBasicMaterial).dispose();
      nebula3.geometry.dispose(); (nebula3.material as THREE.MeshBasicMaterial).map?.dispose(); (nebula3.material as THREE.MeshBasicMaterial).dispose();
      if (currentMount && renderer.domElement) { currentMount.removeChild(renderer.domElement); }
    };
  }, []);


  return (
    <section id="hero" className="relative font-orbitron min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden">
      <div ref={mountRef} className="absolute inset-0 z-0"></div>

      <div className="relative z-10 text-center flex flex-col items-center">
        <div className="relative title-impact-flash-container"> {/* Container for h1 and embers and flash pseudo-element */}
          <h1
            ref={titleRef}
            className={`text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 font-exo2-bold
                        ${titleAnimationState === 'flashing' ? 'animate-impact-flash' : ''}
                        ${titleAnimationState === 'settled' ? 'title-final-appearance' : ''}
                      `}
            // The ::after pseudo-element for flash will be on title-impact-flash-container
            // or apply animate-impact-flash to the h1 directly if its ::after is used for flash
          >
            {title.split("").map((char, index) => (
              <span
                key={index}
                className={`
                  title-char-construct 
                  ${titleAnimationState === 'constructing' || titleAnimationState === 'charsConstructed' || titleAnimationState === 'flashing' || titleAnimationState === 'settled' ? 'animate-construct-char' : ''}
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
          {showEmbers && Array.from({ length: 40 }).map((_, i) => { // Increased ember count
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 50 + 20; // Distance from center
            const tx = Math.cos(angle) * (radius + Math.random() * 50); // Spread further
            const ty = Math.sin(angle) * (radius + Math.random() * 50) - 20; // Tend to float up
            const duration = Math.random() * 1.5 + 2.5; // 2.5-4s
            const delay = Math.random() * 0.3; // Stagger start slightly more
            const size = Math.random() * 2 + 1.5; // 1.5px to 3.5px
            return (
              <div
                key={`ember-${i}`}
                className="ember-particle"
                style={{
                  left: `calc(50% + ${Math.random()*60-30}px)`, // Random initial X around center of H1
                  top: `calc(50% + ${Math.random()*30-15}px)`,  // Random initial Y around center of H1
                  width: `${size}px`, 
                  height: `${size}px`,
                  animationName: 'ember-fly-fade', // Use class from Tailwind config
                  animationDuration: `${duration}s`,
                  animationDelay: `${delay}s`,
                  // CSS custom properties for animation target
                  // @ts-ignore
                  '--ember-tx': `${tx}px`,
                  '--ember-ty': `${ty}px`,
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
        className="absolute bottom-10 left-1/2 transform -translate-x-1/2 cursor-pointer group z-10"
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
