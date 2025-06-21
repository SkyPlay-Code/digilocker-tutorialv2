
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
const CHAR_TYPE_DELAY = 50; // ms per character
const LINE_PAUSE_DELAY = 300; // ms pause after a line

const SignalLostScreen: React.FC<SignalLostScreenProps> = ({ onAccessArchive }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [displayedText, setDisplayedText] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [glitchIndices, setGlitchIndices] = useState<Set<number>>(new Set());

  const animationFrameIdRef = useRef<number | null>(null);
  const vaultGhostRef = useRef<THREE.Points | null>(null);


  // 3D Background Effect
  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    camera.position.z = 50;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 1);
    currentMount.appendChild(renderer.domElement);

    // Sparse Particles
    const particleCount = 500; // Fewer particles
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200 - 50; // Further back
      velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.005; // Slower
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.005;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    const particleMaterial = new THREE.PointsMaterial({ color: 0x555577, size: 0.1, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Faint Nebulas (dimmer)
    const nebulaTextureUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAAaklEQVR4Ae3MsQ2AMAwEwXEWBRDUWu0M6V8qPjKzRiwrcsYjYXkz7UASgSA1jESgD5DyBVL+Sj4dfSPk2zQspl9D4Ud3xudjBwDXfAEXKUDXSYCf2Q2E5Rp0AcNl7QIU0Qo4TQtYhXwAdQAAAABJRU5ErkJggg==';
    const textureLoader = new THREE.TextureLoader();
    const nebulaMap = textureLoader.load(nebulaTextureUrl);
    const nebulaMaterial = new THREE.MeshBasicMaterial({ map: nebulaMap, color: 0x1a0a24, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false });
    const nebula1 = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), nebulaMaterial.clone());
    nebula1.position.set(-100, 50, -200); scene.add(nebula1);
    const nebula2 = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), nebulaMaterial.clone());
    (nebula2.material as THREE.MeshBasicMaterial).color.setHex(0x0a1a24);
    (nebula2.material as THREE.MeshBasicMaterial).opacity = 0.04;
    nebula2.position.set(120, -30, -180); scene.add(nebula2);

    // Vault Ghost (flickering dodecahedron points)
    const dodecahedron = new THREE.DodecahedronGeometry(15, 0);
    const ghostPositions = dodecahedron.attributes.position.array.slice(); // Copy positions
    const ghostParticleCount = ghostPositions.length / 3;
    const ghostParticleOpacities = new Float32Array(ghostParticleCount);
    for (let i = 0; i < ghostParticleCount; i++) ghostParticleOpacities[i] = Math.random() * 0.1 + 0.05; // Very faint

    const ghostGeometry = new THREE.BufferGeometry();
    ghostGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ghostPositions, 3));
    ghostGeometry.setAttribute('opacity', new THREE.Float32BufferAttribute(ghostParticleOpacities, 1));
    
    const ghostMaterial = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(0x00BFFF) }, // Cyan ghost
            time: { value: 0.0 }
        },
        vertexShader: `
            attribute float opacity;
            varying float vOpacity;
            uniform float time;
            void main() {
                vOpacity = opacity * (sin(time * 2.0 + position.x * 0.5) * 0.3 + 0.7); // Flicker effect
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = (10.0 / -mvPosition.z) * vOpacity; // Size attenuation
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            varying float vOpacity;
            void main() {
                if (vOpacity < 0.01) discard; // Don't draw fully transparent particles
                float dist = length(gl_PointCoord - vec2(0.5));
                if (dist > 0.5) discard; // Circular points
                gl_FragColor = vec4(color, vOpacity * (1.0 - dist * 2.0)); // Fade towards edges of point
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    vaultGhostRef.current = new THREE.Points(ghostGeometry, ghostMaterial);
    scene.add(vaultGhostRef.current);


    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      
      const particlePos = particles.geometry.attributes.position.array as Float32Array;
      const particleVel = particles.geometry.attributes.velocity.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        particlePos[i*3+0] += particleVel[i*3+0];
        particlePos[i*3+1] += particleVel[i*3+1];
        particlePos[i*3+2] += particleVel[i*3+2];
        if (Math.abs(particlePos[i*3+0]) > 100) particleVel[i*3+0] *= -1;
        if (Math.abs(particlePos[i*3+1]) > 100) particleVel[i*3+1] *= -1;
        if (particlePos[i*3+2] > camera.position.z || particlePos[i*3+2] < -150) particleVel[i*3+2] *= -1;
      }
      particles.geometry.attributes.position.needsUpdate = true;
      nebula1.rotation.z += 0.00005; nebula2.rotation.z -= 0.00003;

      if (vaultGhostRef.current) {
        vaultGhostRef.current.rotation.y += 0.001;
        vaultGhostRef.current.rotation.x += 0.0005;
        (vaultGhostRef.current.material as THREE.ShaderMaterial).uniforms.time.value += 0.016; // Approx 60fps
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => { /* Similar to other components */ };
    window.addEventListener('resize', handleResize);

    return () => {
      if(animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      particleGeometry.dispose(); particleMaterial.dispose();
      nebula1.geometry.dispose(); (nebula1.material as THREE.Material).dispose();
      nebula2.geometry.dispose(); (nebula2.material as THREE.Material).dispose();
      if(vaultGhostRef.current) {
        vaultGhostRef.current.geometry.dispose();
        (vaultGhostRef.current.material as THREE.Material).dispose();
      }
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Text Typing Effect
  useEffect(() => {
    if (currentLineIndex >= MESSAGE_LINES.length) {
      setShowButton(true);
      return;
    }

    const currentLineContent = MESSAGE_LINES[currentLineIndex];
    if (currentCharIndex < currentLineContent.length) {
      const timeoutId = setTimeout(() => {
        setDisplayedText(prev => {
          const newText = [...prev];
          if (!newText[currentLineIndex]) newText[currentLineIndex] = "";
          newText[currentLineIndex] += currentLineContent[currentCharIndex];
          return newText;
        });
        
        // Random glitch effect
        if (Math.random() < 0.03) { // 3% chance to glitch a char
            const currentGlobalCharIndex = displayedText.slice(0, currentLineIndex).join("").length + currentCharIndex;
            setGlitchIndices(prev => new Set(prev).add(currentGlobalCharIndex));
            setTimeout(() => {
                setGlitchIndices(prev => {
                    const next = new Set(prev);
                    next.delete(currentGlobalCharIndex);
                    return next;
                });
            }, 150); // Glitch duration
        }
        setCurrentCharIndex(prev => prev + 1);
      }, CHAR_TYPE_DELAY);
      return () => clearTimeout(timeoutId);
    } else {
      const timeoutId = setTimeout(() => {
        setCurrentLineIndex(prev => prev + 1);
        setCurrentCharIndex(0);
      }, currentLineContent.length === 0 ? CHAR_TYPE_DELAY : LINE_PAUSE_DELAY); // shorter pause for empty lines
      return () => clearTimeout(timeoutId);
    }
  }, [currentLineIndex, currentCharIndex, displayedText]);

  const handleButtonClick = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onAccessArchive();
    }, 500); // Match fade-out duration
  };
  
  const renderTypedText = () => {
    let globalCharIndex = 0;
    return displayedText.map((line, lineIdx) => (
      <p key={lineIdx} className="whitespace-pre-wrap min-h-[1.5em]"> {/* min-h to prevent layout shift */}
        {line.split("").map((char, charIdx) => {
          const charKey = `${lineIdx}-${charIdx}`;
          const isGlitching = glitchIndices.has(globalCharIndex);
          globalCharIndex++;
          return (
            <span key={charKey} className={isGlitching ? 'animate-terminal-char-glitch' : ''}>
              {char}
            </span>
          );
        })}
      </p>
    ));
  };


  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500 ease-in-out ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
    >
      <div ref={mountRef} className="absolute inset-0 z-0"></div>
      
      <div className="relative z-10 p-6 md:p-8 max-w-2xl w-[90vw] rounded-lg border border-cyan-500/30 bg-black/70 backdrop-blur-sm
                      shadow-[0_0_20px_rgba(0,191,255,0.3),_inset_0_0_5px_rgba(0,191,255,0.2)]
                      overflow-hidden animate-fadeIn">
        {/* Scanline effect overlay */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            background: 'linear-gradient(rgba(0,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '100% 3px', /* Adjust 3px for scanline thickness */
            animation: 'terminalScanlineAnim 2s linear infinite'
          }}
        />
        {/* Grid lines overlay */}
         <div 
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0,191,255,0.3) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,191,255,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px'
          }}
        />

        <div className="relative font-roboto-mono text-sm md:text-base text-cyan-300 leading-relaxed text-glow-cyan">
          {renderTypedText()}
        </div>

        {showButton && (
          <div className="mt-8 text-center animate-fadeIn" style={{ animationDelay: '0.5s' }}>
            <button
              onClick={handleButtonClick}
              className="px-8 py-3 font-orbitron text-base md:text-lg text-black bg-cyan-400 rounded-md
                         border-2 border-cyan-400 hover:bg-cyan-300 hover:border-cyan-200
                         transition-all duration-300 ease-in-out focus:outline-none 
                         shadow-[0_0_10px_rgba(0,191,255,0.5),_0_0_20px_rgba(0,191,255,0.3)]
                         hover:shadow-[0_0_15px_rgba(0,191,255,0.7),_0_0_30px_rgba(0,191,255,0.5)]
                         animate-access-button-pulse"
            >
              [ ACCESS THE ARCHIVE ]
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignalLostScreen;
