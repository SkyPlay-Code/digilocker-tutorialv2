import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

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
    power: { value: 0.0015 } // Adjusted for subtlety
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
      vec2 slightlyOff = power / resolution.x * vec2(1.0, 1.0) * ( (vUv - 0.5) * 2.0 ); // Radial displacement
      vec4 cr = texture2D(tDiffuse, vUv + slightlyOff);
      vec4 cga = texture2D(tDiffuse, vUv);
      vec4 cb = texture2D(tDiffuse, vUv - slightlyOff);
      gl_FragColor = vec4(cr.r, cga.g, cb.b, cga.a);
    }
  `
};


const HeroSection: React.FC<HeroSectionProps> = ({ onInitiateCalibration, onMapDataStream }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [typedSubtitle, setTypedSubtitle] = useState('');
  const fullSubtitle = "Calibrate Your Synapse. Master Your Data-Verse.";
  const title = "Quantum Vault";
  
  const mousePosition = useRef({ x: 0, y: 0 }); // Normalized mouse position (-0.5 to 0.5)
  const targetCameraRotation = useRef({ x: 0, y: 0 }); // Target camera rotation based on mouse
  const currentCameraRotation = useRef({ x: 0, y: 0 }); // Smoothed camera rotation

  const isVaultHovered = useRef(false);
  const vaultRotationSpeed = useRef(0.002); // Slower majestic rotation: 0.002 rad/frame * 60fps * 90s approx 1 rotation.

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

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, 2000);
    camera.position.z = 100; // Adjusted camera Z position

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 1); // Absolute black background
    currentMount.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    // The User's Vault (Central Object)
    const vaultGeometry = new THREE.IcosahedronGeometry(15, 1); // Size 15, detail 1
    const vaultMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xADD8E6, // Lighter blue base
      metalness: 0.1,
      roughness: 0.2,
      transmission: 0.9, // Simulates transparency & refraction
      ior: 1.8, // Index of refraction for crystal-like appearance
      thickness: 5, // For transmission
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      envMapIntensity: 0.5,
    });
    const userVault = new THREE.Mesh(vaultGeometry, vaultMaterial);
    scene.add(userVault);

    // Internal Energy Core
    const coreGeometry = new THREE.SphereGeometry(3, 32, 32); // Size 3
    const coreMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00BFFF, // Deep vibrant blue
        transparent: true, 
        opacity: 0.7 
    });
    const energyCore = new THREE.Mesh(coreGeometry, coreMaterial);
    userVault.add(energyCore); // Add core as child of vault

    // Fresnel Glow for Vault on Hover (simplified: a slightly larger emissive mesh)
    const fresnelMaterial = new THREE.MeshBasicMaterial({
        color: 0x00BFFF,
        transparent: true,
        opacity: 0, // Initially invisible
        side: THREE.BackSide, // Render back faces for halo effect
    });
    const fresnelMesh = new THREE.Mesh(vaultGeometry.clone().scale(1.1, 1.1, 1.1), fresnelMaterial);
    userVault.add(fresnelMesh);

    // Data Particles
    const createParticles = (count: number, size: number, color1: THREE.Color, color2: THREE.Color, color3: THREE.Color, spreadFactor: number, isLayer2: boolean) => {
      const particleGeometry = new THREE.BufferGeometry();
      const positions = [];
      const colors = [];
      const sizes = []; // For PointsMaterial size attenuation
      const baseVelocities = [];

      for (let i = 0; i < count; i++) {
        positions.push((Math.random() - 0.5) * spreadFactor * (isLayer2 ? 2 : 1)); // x
        positions.push((Math.random() - 0.5) * spreadFactor * (isLayer2 ? 2 : 1)); // y
        positions.push((Math.random() - 0.5) * spreadFactor * (isLayer2 ? 1.5 : 1) - (isLayer2 ? 50 : 20) ); // z (deeper for layer 2)

        const randomColor = Math.random();
        let chosenColor = randomColor < 0.8 ? color1 : (randomColor < 0.95 ? color2 : color3);
        colors.push(chosenColor.r, chosenColor.g, chosenColor.b);
        sizes.push(Math.random() * (isLayer2 ? 0.8 : 1.5) + 0.5); // Smaller for layer 2
        
        baseVelocities.push(
            (Math.random() - 0.5) * 0.02, 
            (Math.random() - 0.5) * 0.02, 
            (Math.random() - 0.5) * 0.01
        );
      }
      particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      particleGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
      particleGeometry.setAttribute('baseVelocity', new THREE.Float32BufferAttribute(baseVelocities, 3));


      const particleMaterial = new THREE.PointsMaterial({
        size: size,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false, // Important for additive blending
        sizeAttenuation: true, // Sizes appear smaller further away
      });
      
      // Use a custom shader to make particles slightly anamorphic/flare-like
      particleMaterial.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <output_fragment>',
          `
          #include <output_fragment>
          float len = length(gl_PointCoord - vec2(0.5, 0.5));
          // A simple square shape, could be more complex for lens flare
          // outgoingLight.a = outgoingLight.a * (1.0 - step(0.45, len)); // circle
          float dx = abs(gl_PointCoord.x - 0.5);
          float dy = abs(gl_PointCoord.y - 0.5);
          outgoingLight.a *= (1.0 - smoothstep(0.4, 0.5, dx)) * (1.0 - smoothstep(0.2, 0.25, dy)); // anamorphic-like
          `
        );
      };

      const particles = new THREE.Points(particleGeometry, particleMaterial);
      return particles;
    };

    const nearParticles = createParticles(5000, 0.3, new THREE.Color(0x00FFFF), new THREE.Color(0xF0F0F0), new THREE.Color(0xFF00FF), 200, false); // Cyan, White, Magenta
    scene.add(nearParticles);
    const farParticles = createParticles(3000, 0.2, new THREE.Color(0x00FFFF), new THREE.Color(0xF0F0F0), new THREE.Color(0xFF00FF), 400, true);
    scene.add(farParticles);

    // Shimmering Nebulas (using textured planes)
    const nebulaMaterial = (color: THREE.Color, mapUrl: string, opacity: number) => {
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load(mapUrl); // Placeholder, ideally a noise texture
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        return new THREE.MeshBasicMaterial({
            map: texture,
            color: color,
            transparent: true,
            opacity: opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
    };
    // Create a simple noise texture URL (e.g., from a data URI or a small pre-made noise image)
    // For simplicity, using a basic data URI for a tiny noise texture - replace with better textures
    const noiseTextureUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAAaklEQVR4Ae3MsQ2AMAwEwXEWBRDUWu0M6V8qPjKzRiwrcsYjYXkz7UASgSA1jESgD5DyBVL+Sj4dfSPk2zQspl9D4Ud3xudjBwDXfAEXKUDXSYCf2Q2E5Rp0AcNl7QIU0Qo4TQtYhXwAdQAAAABJRU5ErkJggg==';

    const nebula1 = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), nebulaMaterial(new THREE.Color(0x4B0082), noiseTextureUrl, 0.2)); // Indigo
    nebula1.position.set(-100, 50, -300);
    scene.add(nebula1);

    const nebula2 = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), nebulaMaterial(new THREE.Color(0x8A2BE2), noiseTextureUrl, 0.15)); // Violet
    nebula2.position.set(150, -30, -250);
    scene.add(nebula2);

    const nebula3 = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), nebulaMaterial(new THREE.Color(0x009B77), noiseTextureUrl, 0.1)); // Emerald
    nebula3.position.set(0, 0, -350);
    scene.add(nebula3);


    // Post-processing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(currentMount.clientWidth, currentMount.clientHeight), 0.7, 0.3, 0.1); // strength, radius, threshold
    composer.addPass(bloomPass);

    const chromaticAberrationPass = new ShaderPass(ChromaticAberrationShader);
    chromaticAberrationPass.uniforms.resolution.value.set(currentMount.clientWidth, currentMount.clientHeight);
    composer.addPass(chromaticAberrationPass);
    
    const outputPass = new OutputPass(); // Handles sRGBEncoding
    composer.addPass(outputPass);

    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.material.uniforms['resolution'].value.x = 1 / (currentMount.clientWidth * renderer.getPixelRatio());
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (currentMount.clientHeight * renderer.getPixelRatio());
    composer.addPass(fxaaPass);


    // Mouse move listener for parallax
    const handleMouseMove = (event: MouseEvent) => {
      mousePosition.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mousePosition.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      // Target rotation for parallax (adjust sensitivity)
      targetCameraRotation.current.y = mousePosition.current.x * 0.2; // Yaw
      targetCameraRotation.current.x = mousePosition.current.y * 0.1; // Pitch

      // Raycaster for vault hover
      const raycaster = new THREE.Raycaster();
      const mouseVec = new THREE.Vector2(mousePosition.current.x, mousePosition.current.y);
      raycaster.setFromCamera(mouseVec, camera);
      const intersects = raycaster.intersectObject(userVault);
      isVaultHovered.current = intersects.length > 0;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Animation loop
    const clock = new THREE.Clock();
    let requestId: number;
    const animate = () => {
      requestId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth camera rotation (parallax)
      currentCameraRotation.current.x += (targetCameraRotation.current.x - currentCameraRotation.current.x) * 0.05;
      currentCameraRotation.current.y += (targetCameraRotation.current.y - currentCameraRotation.current.y) * 0.05;
      
      // Apply rotation to a group containing the camera if you want the world to pivot
      // Or, position camera and make it lookAt vault
      const baseCamZ = 100;
      camera.position.x = Math.sin(currentCameraRotation.current.y) * baseCamZ * 0.3; // Reduce parallax effect
      camera.position.y = Math.sin(currentCameraRotation.current.x) * baseCamZ * 0.2;
      camera.position.z = baseCamZ - Math.abs(Math.cos(currentCameraRotation.current.y) * baseCamZ * 0.1) - Math.abs(Math.cos(currentCameraRotation.current.x) * baseCamZ * 0.1) ;
      camera.lookAt(userVault.position);


      // Vault animation
      userVault.rotation.y += vaultRotationSpeed.current; // Slow majestic rotation
      userVault.rotation.x += Math.sin(elapsedTime * 0.5) * 0.0001; // Subtle wobble
      userVault.rotation.z += Math.cos(elapsedTime * 0.3) * 0.0001;

      // Vault core pulse
      const pulseScale = 1 + Math.sin(elapsedTime * 2) * 0.1; // 4 second loop (PI*2 / (PI/2) = 4)
      energyCore.scale.set(pulseScale, pulseScale, pulseScale);
      energyCore.material.opacity = 0.6 + Math.sin(elapsedTime * 2) * 0.2;

      // Vault hover effect
      if (isVaultHovered.current) {
        energyCore.material.opacity = Math.min(1, (0.7 + Math.sin(elapsedTime * 2.4) * 0.2) * 1.2); // Brighter pulse
        fresnelMaterial.opacity = THREE.MathUtils.lerp(fresnelMaterial.opacity, 0.3, 0.1); // Fade in fresnel
        vaultRotationSpeed.current = THREE.MathUtils.lerp(vaultRotationSpeed.current, 0.0005, 0.1); // Slow down
      } else {
        fresnelMaterial.opacity = THREE.MathUtils.lerp(fresnelMaterial.opacity, 0, 0.1); // Fade out fresnel
        vaultRotationSpeed.current = THREE.MathUtils.lerp(vaultRotationSpeed.current, 0.002, 0.1); // Return to normal speed
      }

      // Particle animation (Brownian motion approximation)
      [nearParticles, farParticles].forEach(pSystem => {
          const positions = pSystem.geometry.attributes.position.array as Float32Array;
          const baseVelocities = pSystem.geometry.attributes.baseVelocity.array as Float32Array;
          const spread = pSystem === nearParticles ? 200 : 400;
          for (let i = 0; i < positions.length / 3; i++) {
            positions[i*3] += baseVelocities[i*3] + (Math.random() - 0.5) * 0.01;
            positions[i*3+1] += baseVelocities[i*3+1] + (Math.random() - 0.5) * 0.01;
            positions[i*3+2] += baseVelocities[i*3+2] + (Math.random() - 0.5) * 0.005;

            // Boundary checks (simple wrap around)
            if (positions[i*3] > spread/2) positions[i*3] = -spread/2;
            if (positions[i*3] < -spread/2) positions[i*3] = spread/2;
            // similar for y and z
             if (positions[i*3+1] > spread/2) positions[i*3+1] = -spread/2;
            if (positions[i*3+1] < -spread/2) positions[i*3+1] = spread/2;
            const zDepth = pSystem === nearParticles ? -20 : -50;
            const zSpread = pSystem === nearParticles ? 200 : 400;
            if (positions[i*3+2] > zDepth + zSpread/2) positions[i*3+2] = zDepth - zSpread/2;
            if (positions[i*3+2] < zDepth - zSpread/2) positions[i*3+2] = zDepth + zSpread/2;
          }
          pSystem.geometry.attributes.position.needsUpdate = true;
      });

      // Nebula animation (slow churn)
      nebula1.rotation.z += 0.0001;
      nebula1.material.map.offset.x += 0.00005;
      nebula2.rotation.z -= 0.00008;
      nebula2.material.map.offset.y += 0.00003;
      nebula3.material.map.offset.x -= 0.00002;


      composer.render();
    };
    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      composer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      fxaaPass.material.uniforms['resolution'].value.x = 1 / (currentMount.clientWidth * renderer.getPixelRatio());
      fxaaPass.material.uniforms['resolution'].value.y = 1 / (currentMount.clientHeight * renderer.getPixelRatio());
      chromaticAberrationPass.uniforms.resolution.value.set(currentMount.clientWidth, currentMount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(requestId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      // Dispose geometries, materials, textures
      vaultGeometry.dispose();
      vaultMaterial.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      fresnelMaterial.dispose();
      nearParticles.geometry.dispose();
      nearParticles.material.dispose();
      farParticles.geometry.dispose();
      farParticles.material.dispose();
      nebula1.geometry.dispose(); (nebula1.material as THREE.MeshBasicMaterial).map?.dispose(); (nebula1.material as THREE.MeshBasicMaterial).dispose();
      nebula2.geometry.dispose(); (nebula2.material as THREE.MeshBasicMaterial).map?.dispose(); (nebula2.material as THREE.MeshBasicMaterial).dispose();
      nebula3.geometry.dispose(); (nebula3.material as THREE.MeshBasicMaterial).map?.dispose(); (nebula3.material as THREE.MeshBasicMaterial).dispose();
      
      if (currentMount && renderer.domElement) {
         currentMount.removeChild(renderer.domElement);
      }
    };
  }, []);


  return (
    <section id="hero" className="relative font-orbitron min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} className="absolute inset-0 z-0"></div>

      {/* Overlay UI Content */}
      <div className="relative z-10 text-center flex flex-col items-center">
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6">
          {title.split("").map((char, index) => (
            <span
              key={index}
              className="text-glow-cyan materialize-char inline-block" // Added inline-block for transform
              style={{ animationDelay: `${index * 0.1 + 0.5}s` }} // Delay materialization slightly after 3D load
            >
              {char === " " ? "\u00A0" : char}
            </span>
          ))}
        </h1>
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

      {/* Gravity Well Scroll Arrow */}
      <div 
        onClick={onMapDataStream}
        className="absolute bottom-10 left-1/2 transform -translate-x-1/2 cursor-pointer group z-10"
        title="Scroll Down"
      >
        <div className="w-16 h-16 border-2 border-indigo-400 rounded-full flex items-center justify-center animate-pulse">
            <ChevronDownIcon className="w-8 h-8 text-indigo-300 group-hover:text-cyan-300 transition-colors" />
        </div>
        {[...Array(3)].map((_,i) => ( // These are decorative, not interacting with 3D particles
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