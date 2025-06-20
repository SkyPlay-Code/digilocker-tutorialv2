
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'; // Added import

interface DataCoreEnvironmentProps {
  onClose: () => void; // Example prop if closing this view is needed
}

const DataCoreEnvironment: React.FC<DataCoreEnvironmentProps> = ({ onClose }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [hudVisible, setHudVisible] = useState(false);
  const [videoPlayerVisible, setVideoPlayerVisible] = useState(false);
  const [aiMessage, setAiMessage] = useState("");

  const mousePosition = useRef({ x: 0, y: 0 });
  const targetCameraRotation = useRef({ x: 0, y: 0 });
  const currentCameraRotation = useRef({ x: 0, y: 0 });


  // HUD Boot-up and AI Voice Sequence
  useEffect(() => {
    // console.log("Audio: Near silence after breach.");
    const bootTimer = setTimeout(() => {
      setHudVisible(true);
      // console.log("Audio: AI Voice - 'Calibration sequence initiated. Welcome.' (plays after HUD boot-up)");
      setAiMessage("Calibration sequence initiated. Welcome.");

      const welcomeDuration = 3000; // Duration of first message + pause
      setTimeout(() => {
        // console.log("Audio: AI Voice - 'Synchronizing with your data-stream. Please observe the primary display.'");
        setAiMessage("Synchronizing with your data-stream. Please observe the primary display.");
        setVideoPlayerVisible(true);
      }, welcomeDuration);

    }, 500); // Start HUD boot after 0.5s from environment load

    return () => clearTimeout(bootTimer);
  }, []);

  // Video Sync Progress
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !videoPlayerVisible) return;

    const handleTimeUpdate = () => {
      if (videoElement.duration) {
        const progress = (videoElement.currentTime / videoElement.duration) * 100;
        setSyncProgress(progress);
      }
    };
    const handleVideoEnd = () => {
        setSyncProgress(100);
        // console.log("Audio: AI Voice - 'Synchronization complete.'");
        setAiMessage("Synchronization complete. Vault ready for input.");
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('ended', handleVideoEnd);
    // videoElement.play().catch(error => console.warn("Video autoplay blocked:", error));


    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('ended', handleVideoEnd);
    };
  }, [videoPlayerVisible]);


  // Three.js Scene Setup
  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, 3000);
    camera.position.set(0, 0, 0.1); // Start inside, looking out slightly

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 1);
    currentMount.appendChild(renderer.domElement);
    
    // Vista (Muted Deep Space Skybox)
    const skyboxTextureUrls = [
        'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_px.jpg', // right
        'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_nx.jpg', // left
        'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_py.jpg', // top
        'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_ny.jpg', // bottom
        'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_pz.jpg', // front
        'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_nz.jpg'  // back
    ];
    const skyboxLoader = new THREE.CubeTextureLoader();
    const skyboxTexture = skyboxLoader.load(skyboxTextureUrls, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace; // Or appropriate color space
    });
    scene.background = skyboxTexture;
    scene.backgroundIntensity = 0.2; // Muted

    // Grid Walls (Complex Geometric Patterns)
    const gridGroup = new THREE.Group();
    const gridSize = 100; // Radius of the spherical grid
    const gridDivisions = 12;
    const gridMaterial = new THREE.LineBasicMaterial({ 
        color: 0x007FFF, // Pulsing blue base
        transparent: true, 
        opacity: 0.15,
        blending: THREE.AdditiveBlending 
    });
    
    // Latitudinal lines
    for (let i = 0; i <= gridDivisions; i++) {
        const phi = Math.PI * (-0.5 + i / gridDivisions);
        const points = [];
        for (let j = 0; j <= gridDivisions * 2; j++) {
            const theta = 2 * Math.PI * (j / (gridDivisions*2));
            points.push(new THREE.Vector3(Math.cos(theta) * Math.cos(phi) * gridSize, Math.sin(phi) * gridSize, Math.sin(theta) * Math.cos(phi) * gridSize));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, gridMaterial.clone());
        gridGroup.add(line);
    }
    // Longitudinal lines
    for (let i = 0; i <= gridDivisions * 2; i++) {
        const theta = 2 * Math.PI * (i / (gridDivisions*2));
        const points = [];
        for (let j = 0; j <= gridDivisions; j++) {
            const phi = Math.PI * (-0.5 + j / gridDivisions);
            points.push(new THREE.Vector3(Math.cos(theta) * Math.cos(phi) * gridSize, Math.sin(phi) * gridSize, Math.sin(theta) * Math.cos(phi) * gridSize));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, gridMaterial.clone());
        gridGroup.add(line);
    }
    scene.add(gridGroup);


    // Data Streams (Tiny Comets)
    const streamParticleCount = 500;
    const streamPositions = new Float32Array(streamParticleCount * 3);
    const streamVelocities = new Float32Array(streamParticleCount * 3);
    const streamColors = new Float32Array(streamParticleCount * 3);
    const streamLifes = new Float32Array(streamParticleCount);

    for (let i = 0; i < streamParticleCount; i++) {
        // Start on a grid line (approximate)
        const startAnglePhi = Math.random() * Math.PI - Math.PI/2;
        const startAngleTheta = Math.random() * Math.PI * 2;
        streamPositions[i * 3 + 0] = Math.cos(startAngleTheta) * Math.cos(startAnglePhi) * gridSize * 0.95;
        streamPositions[i * 3 + 1] = Math.sin(startAnglePhi) * gridSize * 0.95;
        streamPositions[i * 3 + 2] = Math.sin(startAngleTheta) * Math.cos(startAnglePhi) * gridSize * 0.95;

        const velocityFactor = 0.1 + Math.random() * 0.2;
        // Move along tangent (approximate)
        streamVelocities[i * 3 + 0] = (-Math.sin(startAngleTheta)) * velocityFactor;
        streamVelocities[i * 3 + 1] = (Math.cos(startAnglePhi) * Math.random() * 0.5) * velocityFactor; // Some vertical drift
        streamVelocities[i * 3 + 2] = (Math.cos(startAngleTheta)) * velocityFactor;
        
        streamColors[i * 3 + 0] = 1.0; streamColors[i * 3 + 1] = 1.0; streamColors[i * 3 + 2] = 1.0; // White
        streamLifes[i] = Math.random() * 100; // Random initial life
    }
    const streamGeometry = new THREE.BufferGeometry();
    streamGeometry.setAttribute('position', new THREE.BufferAttribute(streamPositions, 3));
    streamGeometry.setAttribute('velocity', new THREE.BufferAttribute(streamVelocities, 3));
    streamGeometry.setAttribute('color', new THREE.BufferAttribute(streamColors, 3));
    streamGeometry.setAttribute('life', new THREE.BufferAttribute(streamLifes, 1));

    const streamMaterial = new THREE.PointsMaterial({
        size: 0.3,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
    });
    const dataStreams = new THREE.Points(streamGeometry, streamMaterial);
    scene.add(dataStreams);


    // Post-processing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(currentMount.clientWidth, currentMount.clientHeight), 0.4, 0.5, 0.1);
    composer.addPass(bloomPass);
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.material.uniforms['resolution'].value.x = 1 / (currentMount.clientWidth * renderer.getPixelRatio());
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (currentMount.clientHeight * renderer.getPixelRatio());
    composer.addPass(fxaaPass);

    const handleMouseMove = (event: MouseEvent) => {
      mousePosition.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mousePosition.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
      targetCameraRotation.current.y = mousePosition.current.x * 0.1; 
      targetCameraRotation.current.x = mousePosition.current.y * 0.1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      currentCameraRotation.current.x += (targetCameraRotation.current.x - currentCameraRotation.current.x) * 0.05;
      currentCameraRotation.current.y += (targetCameraRotation.current.y - currentCameraRotation.current.y) * 0.05;
      camera.rotation.x = currentCameraRotation.current.x;
      camera.rotation.y = currentCameraRotation.current.y;
      
      // Animate Grid pulse
      gridGroup.children.forEach((lineMesh, index) => {
        const line = lineMesh as THREE.Line;
        const material = line.material as THREE.LineBasicMaterial;
        material.opacity = 0.15 + Math.sin(elapsedTime * 0.5 + index * 0.1) * 0.1;
      });

      // Animate Data Streams
      const positions = dataStreams.geometry.attributes.position.array as Float32Array;
      const velocities = dataStreams.geometry.attributes.velocity.array as Float32Array;
      const lives = dataStreams.geometry.attributes.life.array as Float32Array;
      for (let i = 0; i < streamParticleCount; i++) {
        positions[i*3+0] += velocities[i*3+0];
        positions[i*3+1] += velocities[i*3+1];
        positions[i*3+2] += velocities[i*3+2];
        lives[i] -= 0.5;

        if (lives[i] < 0 || Math.abs(positions[i*3+0]) > gridSize * 1.1 || Math.abs(positions[i*3+1]) > gridSize * 1.1 || Math.abs(positions[i*3+2]) > gridSize * 1.1) {
            const startAnglePhi = Math.random() * Math.PI - Math.PI/2;
            const startAngleTheta = Math.random() * Math.PI * 2;
            positions[i * 3 + 0] = Math.cos(startAngleTheta) * Math.cos(startAnglePhi) * gridSize * 0.95;
            positions[i * 3 + 1] = Math.sin(startAnglePhi) * gridSize * 0.95;
            positions[i * 3 + 2] = Math.sin(startAngleTheta) * Math.cos(startAnglePhi) * gridSize * 0.95;
            lives[i] = 100 + Math.random() * 50;
        }
      }
      dataStreams.geometry.attributes.position.needsUpdate = true;
      dataStreams.geometry.attributes.life.needsUpdate = true;


      composer.render();
    };
    animate();

    const handleResize = () => {
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      composer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      fxaaPass.material.uniforms['resolution'].value.x = 1 / (currentMount.clientWidth * renderer.getPixelRatio());
      fxaaPass.material.uniforms['resolution'].value.y = 1 / (currentMount.clientHeight * renderer.getPixelRatio());
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      // Dispose geometries and materials if necessary
      gridGroup.children.forEach(child => {
          if (child instanceof THREE.Line) {
              child.geometry.dispose();
              (child.material as THREE.Material).dispose();
          }
      });
      streamGeometry.dispose();
      (streamMaterial as THREE.Material).dispose();
      scene.background = null; // Important for CubeTexture disposal
      skyboxTexture.dispose();

      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
    };
  }, []);


  return (
    <div className="fixed inset-0 bg-black">
      <div ref={mountRef} className="absolute inset-0 z-0"></div>
      
      {/* HUD Elements */}
      <div className={`absolute top-4 left-4 space-y-1 font-roboto-mono text-sm ${hudVisible ? '' : 'opacity-0'}`}>
        <div 
          className={`data-core-hud-element ${hudVisible ? 'animate-hud-text-flicker' : ''}`}
          style={{animationDelay: '0.2s'}}
        >STATUS: ONLINE</div>
        <div 
          className={`data-core-hud-element ${hudVisible ? 'animate-hud-text-flicker' : ''}`}
          style={{animationDelay: '0.4s'}}
        >CALIBRATION PROTOCOL V7.0</div>
      </div>

      <div className={`absolute top-4 right-4 ${hudVisible ? '' : 'opacity-0'}`}>
        {/* Minimalist Logo: Three concentric circles */}
        <div 
            className={`data-core-hud-element ${hudVisible ? 'animate-hud-text-flicker' : ''}`}
            style={{ animationDelay: '0.6s'}}
        >
            <div className="w-8 h-8 border-2 border-cyan-500 rounded-full p-1">
                <div className="w-full h-full border-2 border-cyan-500 rounded-full p-0.5">
                    <div className="w-full h-full bg-cyan-500 rounded-full"></div>
                </div>
            </div>
        </div>
      </div>
      
      {/* Corner HUD Lines */}
      {hudVisible && (
        <>
          <div className="hud-line animate-hud-line-draw absolute top-2 left-2 w-16 h-px" style={{animationDelay: '0s', transformOrigin: 'left'}}></div>
          <div className="hud-line animate-hud-line-draw absolute top-2 left-2 w-px h-16" style={{animationDelay: '0s', transformOrigin: 'top'}}></div>
          
          <div className="hud-line animate-hud-line-draw absolute top-2 right-2 w-16 h-px" style={{animationDelay: '0.1s', transformOrigin: 'right'}}></div>
          <div className="hud-line animate-hud-line-draw absolute top-2 right-2 w-px h-16" style={{animationDelay: '0.1s', transformOrigin: 'top'}}></div>

          <div className="hud-line animate-hud-line-draw absolute bottom-2 left-2 w-16 h-px" style={{animationDelay: '0.2s', transformOrigin: 'left'}}></div>
          <div className="hud-line animate-hud-line-draw absolute bottom-2 left-2 w-px h-16" style={{animationDelay: '0.2s', transformOrigin: 'bottom'}}></div>

          <div className="hud-line animate-hud-line-draw absolute bottom-2 right-2 w-16 h-px" style={{animationDelay: '0.3s', transformOrigin: 'right'}}></div>
          <div className="hud-line animate-hud-line-draw absolute bottom-2 right-2 w-px h-16" style={{animationDelay: '0.3s', transformOrigin: 'bottom'}}></div>
        </>
      )}


      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-3/4 max-w-md space-y-1 font-roboto-mono text-sm text-center ${hudVisible ? '' : 'opacity-0'}`}>
        <div 
          className={`data-core-hud-element ${hudVisible ? 'animate-hud-text-flicker' : ''}`}
          style={{animationDelay: '0.8s'}}
        >
          SYNC PROGRESS: {Math.round(syncProgress)}%
        </div>
        <div 
          className={`progress-bar-container data-core-hud-element ${hudVisible ? 'animate-hud-text-flicker' : ''}`}
          style={{animationDelay: '0.9s', opacity: hudVisible ? 1 : 0}} // Opacity handled by flicker directly
        >
          <div className="progress-bar-fill" style={{ width: `${syncProgress}%` }}></div>
        </div>
      </div>
      
      {/* AI Voice Message Display (Conceptual) */}
      {aiMessage && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-center font-roboto-mono text-cyan-300/80 text-sm p-2 rounded animate-fadeIn">
              <p>&lt;AI_GUIDE&gt;: {aiMessage}</p>
          </div>
      )}

      {/* Holographic Video Player */}
      <div className={`holographic-video-player ${videoPlayerVisible ? 'animate-video-player-materialize' : ''}`}>
        {/* Placeholder for actual video. Replace src with your video file. */}
        {videoPlayerVisible && (
            <video 
                ref={videoRef} 
                className="w-full h-full" 
                controls 
                src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" // Example video
                onPlay={() => { if(videoRef.current) videoRef.current.volume = 0.3; }}
                preload="metadata"
            >
                Your browser does not support the video tag.
            </video>
        )}
      </div>

       {/* Temporary close button for development */}
       {/* <button onClick={onClose} className="absolute bottom-20 right-4 p-2 bg-red-500/50 text-white rounded font-roboto-mono">Close Env</button> */}
    </div>
  );
};

export default DataCoreEnvironment;
