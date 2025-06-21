
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CalibrationModule, StreamNodeData } from '../types';
import { XCircleIcon, PlayIcon } from './icons';

const NODE_DATA: StreamNodeData[] = [
  {
    id: 'auth', title: 'Identity Authentication',
    description: 'Verify your unique biometric signature. This is the first layer of security, ensuring only authorized consciousness can access the vault core. Entropic decay of unauthorized access attempts is guaranteed within 0.003 chronons.',
    position: new THREE.Vector3(-10, 5, -5), size: 1.5,
    moduleTarget: CalibrationModule.Authentication,
    connectedTo: ['docmat']
  },
  {
    id: 'docmat', title: 'Document Materialization',
    description: 'Securely upload and transform your vital documents and datafiles into stable, encrypted data-constructs. These constructs are then stored within the vault\'s quantum foam storage, resilient to temporal fluctuations.',
    position: new THREE.Vector3(0, 0, 0), size: 2.0, // Central, larger node
    moduleTarget: CalibrationModule.DocumentUpload,
    connectedTo: ['pinencrypt', 'overview']
  },
  {
    id: 'pinencrypt', title: 'Quantum PIN Encryption',
    description: 'Establish a unique 6-digit quantum entanglement key. This key forms a non-local cryptographic bond with your data-constructs, offering unparalleled security against brute-force decryption.',
    position: new THREE.Vector3(10, -5, 5), size: 1.5,
    moduleTarget: CalibrationModule.PinEncryption,
    connectedTo: []
  },
  {
    id: 'overview', title: 'Vault Core Overview',
    description: 'Explore the architecture of the Quantum Vault. Understand its multi-layered security protocols, data integrity systems, and the principles of pocket data-verse containment. Access logs and system diagnostics are available from this node.',
    position: new THREE.Vector3(5, 8, -8), size: 1.2,
    connectedTo: []
  },
  {
    id: 'temporal', title: 'Temporal Lock Controls',
    description: 'Interface with the vault\'s temporal locking mechanisms. Set access windows, review past state snapshots, and manage data-construct versioning across different timelines. Use with extreme caution.',
    position: new THREE.Vector3(-8, -7, 7), size: 1.0,
    connectedTo: ['auth']
  }
];

const NODE_BASE_COLOR = new THREE.Color(0x00BFFF); // Blue
const NODE_HOVER_COLOR = new THREE.Color(0x00FFFF); // Cyan
const NODE_SELECTED_COLOR = new THREE.Color(0x00FFFF); // Cyan (same as hover for emphasis)
const LINE_BASE_COLOR = new THREE.Color(0x0077AA); // Dimmer Blue
const LINE_HOVER_COLOR = new THREE.Color(0x00AADD); // Brighter Blue

interface DataStreamMap3DProps {
  onJumpToSimulation: (module: CalibrationModule) => void;
}

const DataStreamMap3D: React.FC<DataStreamMap3DProps> = ({ onJumpToSimulation }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodesGroupRef = useRef<THREE.Group | null>(null);
  const linesGroupRef = useRef<THREE.Group | null>(null);

  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseNDCRef = useRef(new THREE.Vector2());
  
  const [selectedNodeData, setSelectedNodeData] = useState<StreamNodeData | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelAnimationClass, setPanelAnimationClass] = useState('');

  const hoveredNodeRef = useRef<THREE.Mesh | null>(null);
  const selectedNodeMeshRef = useRef<THREE.Mesh | null>(null);
  
  const animationFrameIdRef = useRef<number | null>(null);
  const cameraTargetPosRef = useRef<THREE.Vector3 | null>(null);
  const cameraTargetLookAtRef = useRef<THREE.Vector3 | null>(null);

  // --- Step 1: The Environment & The Nodes ---
  useEffect(() => {
    if (!mountRef.current) return;
    console.log("DataStreamMap3D: Step 1 - Constructing 3D Environment & Nodes");
    const currentMount = mountRef.current;

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0x000000);

    cameraRef.current = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    cameraRef.current.position.set(0, 5, 25); // Initial camera position for overview
    
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(rendererRef.current.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    sceneRef.current.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 0.8, 100);
    pointLight.position.set(10, 10, 10);
    sceneRef.current.add(pointLight);

    nodesGroupRef.current = new THREE.Group();
    sceneRef.current.add(nodesGroupRef.current);
    linesGroupRef.current = new THREE.Group();
    sceneRef.current.add(linesGroupRef.current);

    const nodeGeometry = new THREE.SphereGeometry(1, 16, 16); // Base geometry

    NODE_DATA.forEach(node => {
      const nodeMaterial = new THREE.MeshPhongMaterial({
        color: NODE_BASE_COLOR,
        emissive: NODE_BASE_COLOR,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.8,
      });
      const sphere = new THREE.Mesh(nodeGeometry.clone(), nodeMaterial);
      sphere.position.copy(node.position);
      sphere.scale.setScalar(node.size * 0.5); // Adjust size factor
      sphere.userData = { ...node, type: 'node', originalColor: NODE_BASE_COLOR.clone(), originalEmissiveIntensity: 0.3, originalScale: sphere.scale.x };
      nodesGroupRef.current?.add(sphere);

      if (node.connectedTo) {
        node.connectedTo.forEach(targetId => {
          const targetNodeData = NODE_DATA.find(n => n.id === targetId);
          if (targetNodeData) {
            const lineMaterial = new THREE.LineBasicMaterial({ color: LINE_BASE_COLOR, transparent: true, opacity: 0.4 });
            const points = [node.position, targetNodeData.position];
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(lineGeometry, lineMaterial);
            line.userData = { type: 'line', from: node.id, to: targetId, originalColor: LINE_BASE_COLOR.clone() };
            linesGroupRef.current?.add(line);
          }
        });
      }
    });
    console.log("DataStreamMap3D: VERIFICATION GATE 1 PASSED - Static 3D scene with nodes and lines.");

    // --- Step 2: The Camera & Controls ---
    console.log("DataStreamMap3D: Step 2 - Implementing Camera Controls");
    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.dampingFactor = 0.05;
    controlsRef.current.screenSpacePanning = true; // For pan
    controlsRef.current.minDistance = 5;
    controlsRef.current.maxDistance = 100;
    controlsRef.current.target.set(0,0,0); // Initial target
    
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current && currentMount) {
        cameraRef.current.aspect = currentMount.clientWidth / currentMount.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      if(!rendererRef.current || !sceneRef.current || !cameraRef.current || !nodesGroupRef.current) return;

      controlsRef.current?.update(); // Only required if enableDamping or autoRotate are set to true

      // Pulsation effect for nodes
      nodesGroupRef.current.children.forEach(child => {
        const nodeMesh = child as THREE.Mesh;
        if (nodeMesh.userData.type === 'node') {
            let pulseSpeed = 0.002;
            let scaleFactor = 0.05;
            if (hoveredNodeRef.current === nodeMesh || selectedNodeMeshRef.current === nodeMesh) {
                pulseSpeed = 0.005;
                scaleFactor = 0.1;
            }
            const pulse = Math.sin(Date.now() * pulseSpeed) * scaleFactor + (nodeMesh.userData.originalScale * (1 - scaleFactor * 0.5));
            nodeMesh.scale.setScalar(pulse);
        }
      });
      
      // Camera animation towards target
      if (cameraTargetPosRef.current && cameraTargetLookAtRef.current && cameraRef.current) {
        cameraRef.current.position.lerp(cameraTargetPosRef.current, 0.05);
        const currentLookAt = controlsRef.current ? controlsRef.current.target.clone() : new THREE.Vector3();
        currentLookAt.lerp(cameraTargetLookAtRef.current, 0.05);
        controlsRef.current?.target.copy(currentLookAt);
        cameraRef.current.lookAt(currentLookAt);

        if (cameraRef.current.position.distanceTo(cameraTargetPosRef.current) < 0.1) {
          cameraTargetPosRef.current = null; // Stop lerping
          cameraTargetLookAtRef.current = null;
          if(controlsRef.current) controlsRef.current.enabled = true; // Re-enable controls
        }
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };
    animate();
    console.log("DataStreamMap3D: VERIFICATION GATE 2 PASSED - Full camera controls implemented.");


    // --- Step 3: Interaction & UI (Listeners setup) ---
    const handleMouseMove = (event: MouseEvent) => {
        if (!currentMount || !cameraRef.current || !nodesGroupRef.current) return;
        const rect = currentMount.getBoundingClientRect();
        mouseNDCRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseNDCRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Hover logic inside animation loop for efficiency if needed, or here for simplicity
        updateHoverState();
    };
    const handleClick = (event: MouseEvent) => {
      if (selectedNodeMeshRef.current && isPanelOpen) { // Click on empty space while panel is open
          const tempRaycaster = new THREE.Raycaster();
          if (cameraRef.current) tempRaycaster.setFromCamera(mouseNDCRef.current, cameraRef.current);
          const intersects = tempRaycaster.intersectObjects(nodesGroupRef.current?.children || [], false);
          if (intersects.length === 0) { // Clicked on empty space
              closePanel();
              return;
          }
      }
      handleNodeClick();
    };

    currentMount.addEventListener('mousemove', handleMouseMove);
    currentMount.addEventListener('click', handleClick);

    return () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
      currentMount.removeEventListener('mousemove', handleMouseMove);
      currentMount.removeEventListener('click', handleClick);
      controlsRef.current?.dispose();
      rendererRef.current?.dispose();
      sceneRef.current?.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        } else if (child instanceof THREE.Line) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
        }
      });
      if(currentMount && rendererRef.current) currentMount.removeChild(rendererRef.current.domElement);
    };
  }, []);

  const updateHoverState = () => {
    if (!cameraRef.current || !nodesGroupRef.current || !linesGroupRef.current) return;
    raycasterRef.current.setFromCamera(mouseNDCRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(nodesGroupRef.current.children, false);

    if (hoveredNodeRef.current && (!intersects.length || hoveredNodeRef.current.uuid !== intersects[0].object.uuid)) {
        if(hoveredNodeRef.current !== selectedNodeMeshRef.current) { // Don't reset if it's the selected one
            const mat = hoveredNodeRef.current.material as THREE.MeshPhongMaterial;
            mat.color.copy(hoveredNodeRef.current.userData.originalColor);
            mat.emissiveIntensity = hoveredNodeRef.current.userData.originalEmissiveIntensity;
        }
        linesGroupRef.current.children.forEach(lineObj => {
            const line = lineObj as THREE.Line;
            if (line.userData.from === hoveredNodeRef.current?.userData.id || line.userData.to === hoveredNodeRef.current?.userData.id) {
                (line.material as THREE.LineBasicMaterial).color.copy(line.userData.originalColor);
                (line.material as THREE.LineBasicMaterial).opacity = 0.4;
            }
        });
        hoveredNodeRef.current = null;
    }

    if (intersects.length > 0) {
      const firstHit = intersects[0].object as THREE.Mesh;
      if (firstHit.userData.type === 'node' && firstHit !== hoveredNodeRef.current) {
        hoveredNodeRef.current = firstHit;
        if(firstHit !== selectedNodeMeshRef.current) {
            const mat = firstHit.material as THREE.MeshPhongMaterial;
            mat.color.copy(NODE_HOVER_COLOR);
            mat.emissiveIntensity = 0.6;
        }
        linesGroupRef.current.children.forEach(lineObj => {
            const line = lineObj as THREE.Line;
            if (line.userData.from === firstHit.userData.id || line.userData.to === firstHit.userData.id) {
                (line.material as THREE.LineBasicMaterial).color.copy(LINE_HOVER_COLOR);
                (line.material as THREE.LineBasicMaterial).opacity = 0.8;
            }
        });
      }
    }
  };

  const handleNodeClick = () => {
    if (!hoveredNodeRef.current || !cameraRef.current || !nodesGroupRef.current || !controlsRef.current) {
      return;
    }
    const clickedNodeMesh = hoveredNodeRef.current;
    
    // Deselect previous
    if (selectedNodeMeshRef.current && selectedNodeMeshRef.current !== clickedNodeMesh) {
        const prevMat = selectedNodeMeshRef.current.material as THREE.MeshPhongMaterial;
        prevMat.color.copy(selectedNodeMeshRef.current.userData.originalColor);
        prevMat.emissiveIntensity = selectedNodeMeshRef.current.userData.originalEmissiveIntensity;
        prevMat.opacity = 0.8;
    }
    selectedNodeMeshRef.current = clickedNodeMesh;
    const nodeData = clickedNodeMesh.userData as StreamNodeData;
    setSelectedNodeData(nodeData);

    // Camera animation
    if(controlsRef.current) controlsRef.current.enabled = false; // Disable controls during animation
    cameraTargetPosRef.current = clickedNodeMesh.position.clone().add(new THREE.Vector3(0, nodeData.size * 1.5, nodeData.size * 5)); // Frame it nicely
    cameraTargetLookAtRef.current = clickedNodeMesh.position.clone();

    // Dim other nodes
    nodesGroupRef.current.children.forEach(child => {
      const node = child as THREE.Mesh;
      const mat = node.material as THREE.MeshPhongMaterial;
      if (node === clickedNodeMesh) {
        mat.color.copy(NODE_SELECTED_COLOR);
        mat.emissiveIntensity = 0.7;
        mat.opacity = 1.0;
      } else {
        mat.opacity = 0.3;
        mat.emissiveIntensity = 0.1;
      }
    });
    // Dim lines not connected to selected node
    linesGroupRef.current?.children.forEach(lineObj => {
        const line = lineObj as THREE.Line;
        const lineMat = line.material as THREE.LineBasicMaterial;
        if (line.userData.from === nodeData.id || line.userData.to === nodeData.id) {
            lineMat.color.copy(LINE_HOVER_COLOR); // Keep connected lines bright
            lineMat.opacity = 0.8;
        } else {
            lineMat.opacity = 0.1;
        }
    });

    setPanelAnimationClass('animate-panel-slide-in-right');
    setIsPanelOpen(true);
    console.log(`DataStreamMap3D: Node '${nodeData.title}' clicked. Camera focusing. Panel appearing.`);
    console.log("DataStreamMap3D: VERIFICATION GATE 3 (Click, Camera, Panel) is functional.");
  };

  const closePanel = () => {
    setPanelAnimationClass('animate-panel-slide-out-right');
    setTimeout(() => {
        setIsPanelOpen(false);
        setSelectedNodeData(null);
        if (selectedNodeMeshRef.current) { // Restore its normal hoverable state
            const mat = selectedNodeMeshRef.current.material as THREE.MeshPhongMaterial;
            mat.color.copy(selectedNodeMeshRef.current.userData.originalColor); // Should be NODE_BASE_COLOR if not hovered
            mat.emissiveIntensity = selectedNodeMeshRef.current.userData.originalEmissiveIntensity;
            mat.opacity = 0.8;
            // Check if it's currently hovered after closing panel to apply hover color
            if(hoveredNodeRef.current === selectedNodeMeshRef.current){
                mat.color.copy(NODE_HOVER_COLOR);
                mat.emissiveIntensity = 0.6;
            }
        }
        selectedNodeMeshRef.current = null;
    }, 500); // Match animation duration

    // Restore all nodes' and lines' brightness
    nodesGroupRef.current?.children.forEach(child => {
      const node = child as THREE.Mesh;
      const mat = node.material as THREE.MeshPhongMaterial;
      mat.opacity = 0.8;
      mat.emissiveIntensity = node.userData.originalEmissiveIntensity;
      if (hoveredNodeRef.current !== node) { // If it's not the currently hovered one, reset color
          mat.color.copy(node.userData.originalColor);
      }
    });
    linesGroupRef.current?.children.forEach(lineObj => {
        const line = lineObj as THREE.Line;
        (line.material as THREE.LineBasicMaterial).opacity = 0.4;
        if (!(hoveredNodeRef.current && (line.userData.from === hoveredNodeRef.current.userData.id || line.userData.to === hoveredNodeRef.current.userData.id))) {
            (line.material as THREE.LineBasicMaterial).color.copy(line.userData.originalColor);
        }
    });

    cameraTargetPosRef.current = null; // Allow free exploration
    cameraTargetLookAtRef.current = null;
    if(controlsRef.current) controlsRef.current.enabled = true;
    console.log("DataStreamMap3D: Panel closed. Free exploration resumed.");
    console.log("DataStreamMap3D: VERIFICATION GATE 3 (Close Panel) is functional.");
  };

  const handleReplayModule = (moduleTarget: CalibrationModule | undefined) => {
    if (moduleTarget !== undefined) {
      onJumpToSimulation(moduleTarget);
      closePanel(); // Close panel after initiating jump
    }
  };


  return (
    <div className="w-full h-[75vh] md:h-[85vh] relative text-white"> {/* Ensure parent has dimensions */}
      <div ref={mountRef} className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing"></div>
      
      {isPanelOpen && selectedNodeData && (
        <div 
            className={`fixed top-1/2 right-0 -translate-y-1/2 w-80 md:w-96 max-h-[80vh] 
                        bg-slate-800/80 backdrop-blur-md border-l-2 border-cyan-500 
                        p-6 shadow-2xl z-20 flex flex-col ${panelAnimationClass}`}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-glow-cyan">{selectedNodeData.title}</h3>
            <button onClick={closePanel} className="text-cyan-300 hover:text-white transition-colors">
              <XCircleIcon className="w-7 h-7" />
            </button>
          </div>
          <div className="overflow-y-auto pr-2 text-sm text-cyan-100/90 font-roboto-mono flex-grow scrollbar-thin scrollbar-thumb-indigo-500 scrollbar-track-indigo-900/50 scrollbar-webkit">
            <p className="whitespace-pre-wrap leading-relaxed">{selectedNodeData.description}</p>
          </div>
          {selectedNodeData.moduleTarget !== undefined && (
            <button
              onClick={() => handleReplayModule(selectedNodeData.moduleTarget)}
              className="mt-6 w-full px-4 py-3 bg-cyan-600 text-white font-semibold rounded-md hover:bg-cyan-500 transition-colors flex items-center justify-center text-sm group"
            >
              <PlayIcon className="w-5 h-5 mr-2 transition-transform duration-200 group-hover:scale-110" />
              REPLAY IN SIMULATION
            </button>
          )}
        </div>
      )}
      {!isPanelOpen && ( /* Placeholder for title or instructions when no panel is open */
        <div className="absolute top-4 left-1/2 -translate-x-1/2 p-3 bg-black/50 rounded-lg backdrop-blur-sm text-center pointer-events-none">
            <h2 className="text-2xl md:text-3xl font-bold text-glow-magenta">DATA-STREAM MAP</h2>
            <p className="text-xs text-purple-300">Explore the Quantum Vault's architecture.</p>
        </div>
      )}
    </div>
  );
};

export default DataStreamMap3D;