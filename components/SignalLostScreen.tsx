
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

interface SignalLostScreenProps {
  onAccessArchive: () => void;
}

const MESSAGE_LINES = [
  "// INITIATING HANDSHAKE...",
  "// CONNECTION FAILED: ENDPOINT UNRESPONSIVE.",
  "// QUERYING LOGS...",
  "",
  "> SIGNAL LOST.",
  "",
  "> FURTHER DEVELOPMENT OF THIS DATA-STREAM HAS BEEN ABORTED.",
  "> CAUSE: UNFORESEEN PARAMETERS.",
  "",
  "> THE CORE SIMULATION REMAINS IN A STABLE, ARCHIVED STATE.",
  "> PROCEED WITH CAUTION."
];
const CHAR_TYPE_DELAY = 40; // ms per character
const LINE_PAUSE_DELAY = 250; // ms pause after a line
const POST_TEXT_PAUSE = 1500; // ms
const BUTTON_MATERIALIZE_DURATION = 1000; // ms

// Terminal Plane Shader
const TerminalShader = {
  uniforms: {
    uTexture: { value: null as THREE.CanvasTexture | null },
    uTime: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(512, 256) }, // Canvas texture resolution
    uFlicker: { value: 0.0 },
    uScanlineSpeed: { value: 50.0 },
    uScanlineThickness: { value: 0.03 }, // Relative to fragment height
    uScanlineStrength: { value: 0.2 },
    uRefractionStrength: { value: 0.005 }, // Distortion amount
    uEdgeGlowColor: { value: new THREE.Color(0x00aaff) }, // Lighter cyan for edge
    uFresnelPower: { value: 2.5 },
    uOpacity: { value: 0.8 } // Base opacity
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    void main() {
      vUv = uv;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uFlicker;
    uniform float uScanlineSpeed;
    uniform float uScanlineThickness;
    uniform float uScanlineStrength;
    uniform float uRefractionStrength;
    uniform vec3 uEdgeGlowColor;
    uniform float uFresnelPower;
    uniform float uOpacity;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    float noise(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
      vec2 distortedUv = vUv;
      // Simulated Refraction / Distortion
      float distortionFactor = noise(vUv * vec2(20.0, 5.0) + uTime * 0.1) - 0.5; // Centered noise
      distortedUv += vec2(distortionFactor, distortionFactor * 0.3) * uRefractionStrength;
      distortedUv = clamp(distortedUv, 0.0, 1.0);

      vec4 texColor = texture2D(uTexture, distortedUv);

      // Scan Lines
      float scanlineEffect = abs(sin((vUv.y * uResolution.y * 0.05) - uTime * uScanlineSpeed)); // Denser scanlines with 0.05
      float scanline = smoothstep(1.0 - uScanlineThickness, 1.0, scanlineEffect); // Thin lines
      
      vec3 finalColor = texColor.rgb * (1.0 - scanline * uScanlineStrength);
      
      // Fresnel Edge Glow
      float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), uFresnelPower);
      finalColor += uEdgeGlowColor * fresnel * (1.0 + uFlicker * 0.5);

      // Flicker
      finalColor *= (0.95 + uFlicker * 0.1); // Apply global flicker

      gl_FragColor = vec4(finalColor, texColor.a * uOpacity * (0.8 + fresnel * 0.5) * (1.0 - scanline * (uScanlineStrength * 0.5)) );
      if (gl_FragColor.a < 0.01) discard;
    }
  `
};

type AnimationPhase = 'sceneRender' | 'textAnimation' | 'postTextPause' | 'buttonMaterialization' | 'stableIdle' | 'fadingOut';

const SignalLostScreen: React.FC<SignalLostScreenProps> = ({ onAccessArchive }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  
  const vaultGhostRef = useRef<THREE.Points | null>(null);
  const terminalMeshRef = useRef<THREE.Mesh | null>(null);
  const terminalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const terminalTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const terminalMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  
  const particlesRef = useRef<THREE.Points | null>(null);
  const nebulasRef = useRef<THREE.Mesh[]>([]);
  
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('sceneRender');
  const [displayedLines, setDisplayedLines] = useState<string[]>(Array(MESSAGE_LINES.length).fill(""));
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [showButtonOnCanvas, setShowButtonOnCanvas] = useState(false);
  const [buttonMaterializeProgress, setButtonMaterializeProgress] = useState(0); // 0 to 1

  const animationFrameIdRef = useRef<number | null>(null);
  const mousePosRef = useRef({x: 0, y: 0});
  const clockRef = useRef(new THREE.Clock());

  const init3DScene = useCallback(() => {
    if (!mountRef.current) return { renderer: null, scene: null, camera: null };
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 18); // Closer initial view for terminal focus
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 1);
    currentMount.appendChild(renderer.domElement);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // Quantum Aether Background
    const particleCount = 700;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const baseVelocities = new Float32Array(particleCount * 3);
    const pColors = new Float32Array(particleCount * 3);
    const color = new THREE.Color();

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 150;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 150;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 150 - 30;
      baseVelocities[i * 3 + 0] = (Math.random() - 0.5) * 0.002;
      baseVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.002;
      baseVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.001;
      color.setHSL(0.5 + Math.random() * 0.2, 0.7, 0.5 + Math.random() * 0.2); // Cyan/blueish
      pColors[i*3+0] = color.r; pColors[i*3+1] = color.g; pColors[i*3+2] = color.b;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('baseVelocity', new THREE.BufferAttribute(baseVelocities, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
    const particleMaterial = new THREE.PointsMaterial({ size: 0.15, vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    particlesRef.current = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particlesRef.current);

    const nebulaTextureUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAAaklEQVR4Ae3MsQ2AMAwEwXEWBRDUWu0M6V8qPjKzRiwrcsYjYXkz7UASgSA1jESgD5DyBVL+Sj4dfSPk2zQspl9D4Ud3xudjBwDXfAEXKUDXSYCf2Q2E5Rp0AcNl7QIU0Qo4TQtYhXwAdQAAAABJRU5ErkJggg==';
    const textureLoader = new THREE.TextureLoader();
    const nebulaMap = textureLoader.load(nebulaTextureUrl);
    const createNebula = (c: number, opacity: number, size: number, pos: [number,number,number]) => {
        const mat = new THREE.MeshBasicMaterial({ map: nebulaMap, color: c, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        const neb = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
        neb.position.set(...pos);
        neb.lookAt(camera.position); // Face camera initially
        nebulasRef.current.push(neb);
        scene.add(neb);
    };
    createNebula(0x100520, 0.08, 300, [-80, 40, -100]);
    createNebula(0x051025, 0.06, 250, [70, -30, -90]);

    // Central "Ghost" of the Vault
    const dodecahedron = new THREE.DodecahedronGeometry(6, 0); // Smaller ghost
    const ghostBasePositions = dodecahedron.attributes.position.array.slice();
    const numGhostParticles = ghostBasePositions.length / 3;
    const ghostParticleData = new Float32Array(numGhostParticles * 4); // x,y,z,life
    for (let i = 0; i < numGhostParticles; i++) {
        ghostParticleData[i * 4 + 0] = ghostBasePositions[i*3+0];
        ghostParticleData[i * 4 + 1] = ghostBasePositions[i*3+1];
        ghostParticleData[i * 4 + 2] = ghostBasePositions[i*3+2];
        ghostParticleData[i * 4 + 3] = Math.random() * 0.5 + 0.1; // Initial life (short)
    }
    const ghostGeometry = new THREE.BufferGeometry();
    ghostGeometry.setAttribute('positionLife', new THREE.BufferAttribute(ghostParticleData, 4));
    const ghostShaderMaterial = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(0xffffff) }, uPointSize: { value: 2.0 } },
        vertexShader: `
            attribute vec4 positionLife; // x,y,z,life
            varying float vLife;
            uniform float uPointSize;
            void main() {
                vLife = positionLife.w;
                vec4 mvPosition = modelViewMatrix * vec4(positionLife.xyz, 1.0);
                gl_PointSize = uPointSize * (10.0 / -mvPosition.z) * vLife;
                gl_Position = projectionMatrix * mvPosition;
            }`,
        fragmentShader: `
            uniform vec3 uColor;
            varying float vLife;
            void main() {
                if (vLife <= 0.0) discard;
                float dist = length(gl_PointCoord - vec2(0.5));
                if (dist > 0.5) discard;
                gl_FragColor = vec4(uColor, vLife * (1.0 - dist * 2.0) * 0.7); // Faint white
            }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    vaultGhostRef.current = new THREE.Points(ghostGeometry, ghostShaderMaterial);
    scene.add(vaultGhostRef.current);

    // Holographic Terminal
    terminalCanvasRef.current = document.createElement('canvas');
    terminalCanvasRef.current.width = 1024; // Higher res canvas for sharper text
    terminalCanvasRef.current.height = 512;
    terminalTextureRef.current = new THREE.CanvasTexture(terminalCanvasRef.current);
    terminalTextureRef.current.minFilter = THREE.LinearFilter;
    terminalTextureRef.current.magFilter = THREE.LinearFilter;

    const terminalUniforms = THREE.UniformsUtils.clone(TerminalShader.uniforms);
    terminalUniforms.uTexture.value = terminalTextureRef.current;
    terminalUniforms.uResolution.value.set(terminalCanvasRef.current.width, terminalCanvasRef.current.height);

    terminalMaterialRef.current = new THREE.ShaderMaterial({
        uniforms: terminalUniforms,
        vertexShader: TerminalShader.vertexShader,
        fragmentShader: TerminalShader.fragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
    });
    const terminalGeometry = new THREE.PlaneGeometry(10, 5); // Width, Height
    terminalMeshRef.current = new THREE.Mesh(terminalGeometry, terminalMaterialRef.current);
    terminalMeshRef.current.position.set(0, 0, 5); // Position in front of ghost
    scene.add(terminalMeshRef.current);
    
    return { renderer, scene, camera };
  }, []);

  const drawTerminalContent = useCallback(() => {
    if (!terminalCanvasRef.current) return;
    const canvas = terminalCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background (mostly transparent, shader handles appearance)
    ctx.fillStyle = "rgba(0,0,0,0.01)"; // Nearly transparent, just to clear
    ctx.fillRect(0,0,canvas.width, canvas.height);

    // Text
    ctx.font = "28px 'Roboto Mono', monospace"; // Slightly larger for clarity
    ctx.fillStyle = "#00CFE0"; // Glowing cyan
    ctx.shadowColor = "#00FFFF";
    ctx.shadowBlur = 8;

    const lineHeight = 36;
    let yPos = 50;
    displayedLines.forEach(line => {
      ctx.fillText(line, 30, yPos);
      yPos += lineHeight;
    });

    // Cursor for typing text (simple blinking)
    if (animationPhase === 'textAnimation' && currentCharIndex < MESSAGE_LINES[currentLineIndex]?.length) {
        if (Math.floor(clockRef.current.getElapsedTime() * 2) % 2 === 0) { // Blink
            const cursorX = 30 + ctx.measureText(displayedLines[currentLineIndex] || "").width;
            const cursorY = 50 + currentLineIndex * lineHeight - (lineHeight * 0.7);
            ctx.fillRect(cursorX, cursorY, 12, lineHeight * 0.8);
        }
    }
    
    // Button
    if (showButtonOnCanvas) {
        const buttonWidth = 400;
        const buttonHeight = 70;
        const buttonX = (canvas.width - buttonWidth) / 2;
        const buttonY = canvas.height - buttonHeight - 40;
        
        ctx.globalAlpha = buttonMaterializeProgress; // Fade in button
        
        // Simulating particle assembly for button background
        const numParticles = 50;
        for(let i=0; i<numParticles; i++) {
            const pLife = Math.random();
            if(pLife < buttonMaterializeProgress) {
                const px = buttonX + Math.random() * buttonWidth;
                const py = buttonY + Math.random() * buttonHeight;
                const pSize = (1 - pLife) * 5 + 1; // Particles shrink as they settle
                ctx.fillStyle = `rgba(0, 220, 255, ${pLife * 0.5})`;
                ctx.beginPath();
                ctx.arc(px, py, pSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Button border and main fill after particles settle
        if(buttonMaterializeProgress > 0.7) {
            const fillOpacity = (buttonMaterializeProgress - 0.7) / 0.3;
            ctx.fillStyle = `rgba(0, 100, 120, ${fillOpacity * 0.6})`;
            ctx.strokeStyle = `rgba(0, 220, 255, ${fillOpacity})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(buttonX, buttonY, buttonWidth, buttonHeight);
            ctx.fill();
            ctx.stroke();
        }

        // Button Text (appears towards end of materialization)
        if (buttonMaterializeProgress > 0.85) {
            const textOpacity = (buttonMaterializeProgress - 0.85) / 0.15;
            ctx.font = "bold 30px Orbitron";
            ctx.fillStyle = `rgba(255, 255, 255, ${textOpacity})`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = `rgba(0, 255, 255, ${textOpacity * 0.7})`;
            ctx.shadowBlur = 10;
            ctx.fillText("[ ACCESS THE ARCHIVE ]", canvas.width / 2, buttonY + buttonHeight / 2);
        }
        ctx.globalAlpha = 1.0; // Reset global alpha
    }
    ctx.shadowBlur = 0; // Reset shadow for next frame

    if (terminalTextureRef.current) terminalTextureRef.current.needsUpdate = true;
  }, [displayedLines, currentCharIndex, currentLineIndex, animationPhase, showButtonOnCanvas, buttonMaterializeProgress]);

  // Main Animation Loop
  useEffect(() => {
    const { renderer } = init3DScene(); // Call init here
    if (!renderer || !sceneRef.current || !cameraRef.current) return;

    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();
      const elapsedTime = clockRef.current.getElapsedTime();

      // Parallax for background
      if (cameraRef.current && sceneRef.current) {
          const parallaxFactor = 0.5;
          cameraRef.current.position.x += (mousePosRef.current.x * parallaxFactor - cameraRef.current.position.x) * 0.02;
          cameraRef.current.position.y += (-mousePosRef.current.y * parallaxFactor - cameraRef.current.position.y) * 0.02;
          cameraRef.current.lookAt(sceneRef.current.position); // Look at center
      }
      
      // Update particles
      if(particlesRef.current) {
        const pos = particlesRef.current.geometry.attributes.position.array as Float32Array;
        const vel = particlesRef.current.geometry.attributes.baseVelocity.array as Float32Array;
        for (let i = 0; i < pos.length / 3; i++) {
          pos[i*3+0] += vel[i*3+0] + (Math.sin(elapsedTime + i*0.1) * 0.0005);
          pos[i*3+1] += vel[i*3+1] + (Math.cos(elapsedTime + i*0.15) * 0.0005);
          pos[i*3+2] += vel[i*3+2];
          if (pos[i*3+2] > cameraRef.current.position.z + 20) pos[i*3+2] = -120;
          if (pos[i*3+2] < -150) pos[i*3+2] = cameraRef.current.position.z -10;
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }
      nebulasRef.current.forEach((neb,i) => {neb.rotation.z += (i%2 === 0 ? 0.00003 : -0.00002) * delta * 60; neb.lookAt(cameraRef.current!.position)});

      // Update Ghost
      if (vaultGhostRef.current) {
        const geom = vaultGhostRef.current.geometry;
        const posLifeAttr = geom.attributes.positionLife as THREE.BufferAttribute;
        const posLifeArray = posLifeAttr.array as Float32Array;
        let needsUpdate = false;
        for (let i = 0; i < posLifeArray.length / 4; i++) {
            posLifeArray[i * 4 + 3] -= delta * (0.8 + Math.random()*0.4); // Life decreases
            if (posLifeArray[i * 4 + 3] <= 0) {
                posLifeArray[i * 4 + 3] = Math.random() * 0.5 + 0.3; // Reset life
                needsUpdate = true;
            }
        }
        if(needsUpdate) posLifeAttr.needsUpdate = true;
        vaultGhostRef.current.rotation.y += delta * 0.05;
        vaultGhostRef.current.rotation.x += delta * 0.02;
      }
      
      // Update Terminal Shader
      if (terminalMaterialRef.current) {
        terminalMaterialRef.current.uniforms.uTime.value = elapsedTime;
        terminalMaterialRef.current.uniforms.uFlicker.value = Math.random() * 0.3 - 0.15; // Random flicker amount
        if(animationPhase === 'fadingOut') {
            terminalMaterialRef.current.uniforms.uOpacity.value = Math.max(0, terminalMaterialRef.current.uniforms.uOpacity.value - delta * 2.0);
        }
      }
      drawTerminalContent(); // Update canvas texture
      
      renderer.render(sceneRef.current, cameraRef.current);
    };
    if (animationPhase !== 'fadingOut' || (terminalMaterialRef.current && terminalMaterialRef.current.uniforms.uOpacity.value > 0)) {
        animate();
    } else if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
    }
    
    const handleMouseMove = (event: MouseEvent) => {
      mousePosRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mousePosRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => { /* ... */ }; window.addEventListener('resize', handleResize);

    return () => {
      if(animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      rendererRef.current?.dispose();
      // Dispose other THREE objects...
      if (mountRef.current && rendererRef.current?.domElement) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, []); // Run once on mount

  // State Machine for Animation Sequence
  useEffect(() => {
    let timeoutId: number;
    if (animationPhase === 'sceneRender') {
      timeoutId = window.setTimeout(() => setAnimationPhase('textAnimation'), 500); // T=0.5s
    } else if (animationPhase === 'textAnimation') {
      if (currentLineIndex >= MESSAGE_LINES.length) {
        setAnimationPhase('postTextPause');
      } else {
        const currentLineContent = MESSAGE_LINES[currentLineIndex];
        if (currentCharIndex < currentLineContent.length) {
          timeoutId = window.setTimeout(() => {
            setDisplayedLines(prev => {
              const newLines = [...prev];
              newLines[currentLineIndex] = currentLineContent.substring(0, currentCharIndex + 1);
              // Simple glitch: randomly replace char
              if (Math.random() < 0.05 && newLines[currentLineIndex].length > 0) { 
                  const glitchChar = String.fromCharCode(Math.floor(Math.random()* (126-33+1))+33); // Printable ASCII
                  const originalChar = newLines[currentLineIndex][currentCharIndex];
                  newLines[currentLineIndex] = newLines[currentLineIndex].substring(0, currentCharIndex) + glitchChar;
                  setTimeout(() => { // Revert glitch
                    setDisplayedLines(prevRevert => {
                        const revertLines = [...prevRevert];
                        if(revertLines[currentLineIndex]?.length > currentCharIndex) {
                           revertLines[currentLineIndex] = revertLines[currentLineIndex].substring(0, currentCharIndex) + originalChar + revertLines[currentLineIndex].substring(currentCharIndex+1);
                        }
                        return revertLines;
                    });
                  }, 80);
              }
              return newLines;
            });
            setCurrentCharIndex(prev => prev + 1);
          }, CHAR_TYPE_DELAY);
        } else {
          timeoutId = window.setTimeout(() => {
            setCurrentLineIndex(prev => prev + 1);
            setCurrentCharIndex(0);
          }, LINE_PAUSE_DELAY);
        }
      }
    } else if (animationPhase === 'postTextPause') {
      timeoutId = window.setTimeout(() => setAnimationPhase('buttonMaterialization'), POST_TEXT_PAUSE);
    } else if (animationPhase === 'buttonMaterialization') {
      setShowButtonOnCanvas(true);
      let startTime = Date.now();
      const animateButton = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / BUTTON_MATERIALIZE_DURATION, 1);
        setButtonMaterializeProgress(progress);
        if (progress < 1) {
          requestAnimationFrame(animateButton);
        } else {
          setAnimationPhase('stableIdle');
        }
      };
      animateButton();
    } else if (animationPhase === 'stableIdle') {
      console.log("SignalLostScreen: Stable Idle State Reached. Button active.");
      // The screen is now stable and interactive.
    }
    return () => clearTimeout(timeoutId);
  }, [animationPhase, currentLineIndex, currentCharIndex, displayedLines]);

  const handleAccessArchiveClick = () => {
    if (animationPhase !== 'stableIdle') return;
    setAnimationPhase('fadingOut');
    setTimeout(() => {
      onAccessArchive();
    }, 800); // Allow fade out time for 3D elements + overall fade
  };

  const isTerminalInteractive = animationPhase === 'stableIdle';

  return (
    <div 
      className={`fixed inset-0 z-[100] transition-opacity duration-500 ease-in-out ${animationPhase === 'fadingOut' ? 'opacity-0' : 'opacity-100'}`}
      onClick={isTerminalInteractive ? handleAccessArchiveClick : undefined} // Click anywhere on screen if button is active
      style={{cursor: isTerminalInteractive ? 'pointer' : 'default'}}
    >
      <div ref={mountRef} className="absolute inset-0 z-0"></div>
      {/* 
        The terminal content is now rendered onto a 3D plane via canvas texture.
        The button click will be handled by raycasting on the 3D plane in the animate loop
        if the UV coordinates match the button area on the texture.
        The CSS based button is removed.
      */}
    </div>
  );
};

export default SignalLostScreen;
