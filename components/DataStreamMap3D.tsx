
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CalibrationModule, StreamNodeData } from '../types';
// Removed XCircleIcon and PlayIcon as they were for the 2D panel. Content is now on canvas.

const NODE_DATA: StreamNodeData[] = [
  {
    id: 'auth', title: 'Identity Authentication', moduleShortName: 'ID Auth',
    description: 'Verify your unique biometric signature. This is the first layer of security, ensuring only authorized consciousness can access the vault core. Entropic decay of unauthorized access attempts is guaranteed within 0.003 chronons.',
    position: new THREE.Vector3(-10, 5, -5), size: 1.5,
    moduleTarget: CalibrationModule.Authentication,
    connectedTo: ['docmat'], holovidId: 'sigilScan'
  },
  {
    id: 'docmat', title: 'Document Materialization', moduleShortName: 'Doc Forge',
    description: 'Securely upload and transform your vital documents and datafiles into stable, encrypted data-constructs. These constructs are then stored within the vault\'s quantum foam storage, resilient to temporal fluctuations.',
    position: new THREE.Vector3(0, 0, 0), size: 2.0, // Central, larger node
    moduleTarget: CalibrationModule.DocumentUpload,
    connectedTo: ['pinencrypt', 'overview'], holovidId: 'cubeConstruct'
  },
  {
    id: 'pinencrypt', title: 'Quantum PIN Encryption', moduleShortName: 'PIN Encrypt',
    description: 'Establish a unique 6-digit quantum entanglement key. This key forms a non-local cryptographic bond with your data-constructs, offering unparalleled security against brute-force decryption.',
    position: new THREE.Vector3(10, -5, 5), size: 1.5,
    moduleTarget: CalibrationModule.PinEncryption,
    connectedTo: [], holovidId: 'starConstellation'
  },
  {
    id: 'overview', title: 'Vault Core Overview', moduleShortName: 'Core View',
    description: 'Explore the architecture of the Quantum Vault. Understand its multi-layered security protocols, data integrity systems, and the principles of pocket data-verse containment.',
    position: new THREE.Vector3(5, 8, -8), size: 1.2,
    connectedTo: [], holovidId: 'dataFlow'
  },
  {
    id: 'temporal', title: 'Temporal Lock Controls', moduleShortName: 'Time Lock',
    description: 'Interface with the vault\'s temporal locking mechanisms. Set access windows, review past state snapshots, and manage data-construct versioning across different timelines.',
    position: new THREE.Vector3(-8, -7, 7), size: 1.0,
    connectedTo: ['auth'], holovidId: 'clockReverse'
  }
];

const NODE_BASE_COLOR = new THREE.Color(0x00BFFF);
const NODE_HOVER_COLOR = new THREE.Color(0x00FFFF);
const NODE_SELECTED_HIGHLIGHT_COLOR = new THREE.Color(0x87CEFA); // Lighter blue for selected node itself
const LINE_BASE_COLOR = new THREE.Color(0x0077AA);
const LINE_HOVER_COLOR = new THREE.Color(0x00AADD);

const HOLO_PANEL_WIDTH = 4;
const HOLO_PANEL_HEIGHT = 3;
const HOLO_PANEL_COLOR = new THREE.Color(0x00ffff); // Cyan

type HoloPanelState = 'idle' | 'projecting' | 'active' | 'dematerializing';

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
  const nodeOriginalPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const linesGroupRef = useRef<THREE.Group | null>(null);

  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseNDCRef = useRef(new THREE.Vector2());
  
  const activeNodeDataRef = useRef<StreamNodeData | null>(null); // For panel content
  const selectedNodeMeshRef = useRef<THREE.Mesh | null>(null); // The 3D mesh of the selected node
  const hoveredNodeRef = useRef<THREE.Mesh | null>(null);

  const holographicPanelRef = useRef<THREE.Mesh | null>(null);
  const holoPanelProjectionLineRef = useRef<THREE.Line | null>(null);
  const holoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const holoTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const holoPanelStateRef = useRef<HoloPanelState>('idle');
  const holoPanelAnimationProgressRef = useRef(0); // 0 to 1

  const animationFrameIdRef = useRef<number | null>(null);
  const cameraTargetPosRef = useRef<THREE.Vector3 | null>(null);
  const cameraTargetLookAtRef = useRef<THREE.Vector3 | null>(null);
  const clockRef = useRef(new THREE.Clock());


  // Holovid Animation Placeholders
  const holovidAnimations: Record<string, (ctx: CanvasRenderingContext2D, time: number, w: number, h: number) => void> = {
    sigilScan: (ctx, time, w, h) => {
      ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 2;
      const progress = (time % 2000) / 2000;
      const points = [{x:w*0.2,y:h*0.7}, {x:w*0.5,y:h*0.2}, {x:w*0.8,y:h*0.7}, {x:w*0.35,y:h*0.4}, {x:w*0.65,y:h*0.4}, {x:w*0.2,y:h*0.7}];
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for(let i=1; i < Math.floor(progress * points.length) + 1 && i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      if(Math.floor(progress*points.length) >= points.length-1) { // Draw cursor at end
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(points[points.length-1].x, points[points.length-1].y, 3, 0, Math.PI*2); ctx.fill();
      }
    },
    cubeConstruct: (ctx, time, w, h) => {
      ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 1;
      const angle = time * 0.001; const cubeSize = h * 0.3;
      const cx = w/2; const cy = h/2;
      const vertices = [
        {x:-1,y:-1,z:-1},{x:1,y:-1,z:-1},{x:1,y:1,z:-1},{x:-1,y:1,z:-1},
        {x:-1,y:-1,z:1},{x:1,y:-1,z:1},{x:1,y:1,z:1},{x:-1,y:1,z:1}
      ];
      const edges = [
        [0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],
        [0,4],[1,5],[2,6],[3,7]
      ];
      const rotatedVertices = vertices.map(v => {
        const x = v.x * Math.cos(angle) - v.z * Math.sin(angle);
        const z = v.x * Math.sin(angle) + v.z * Math.cos(angle);
        const y = v.y;
        return {
            x: cx + x * cubeSize * (z * 0.2 + 1), // Perspective
            y: cy + y * cubeSize * (z * 0.2 + 1),
        };
      });
      edges.forEach(edge => {
        ctx.beginPath();
        ctx.moveTo(rotatedVertices[edge[0]].x, rotatedVertices[edge[0]].y);
        ctx.lineTo(rotatedVertices[edge[1]].x, rotatedVertices[edge[1]].y);
        ctx.stroke();
      });
    },
    starConstellation: (ctx, time, w, h) => {
      ctx.fillStyle = '#00FFFF';
      const numStars = 6; const radius = h * 0.3;
      const cx = w/2; const cy = h/2;
      const starPositions: {x:number, y:number}[] = [];
      for (let i = 0; i < numStars; i++) {
        const angle = (i / numStars) * Math.PI * 2 + time * 0.0005;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        starPositions.push({x,y});
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for(let i=0; i<starPositions.length; i++) {
        ctx.lineTo(starPositions[i].x, starPositions[(i+1)%starPositions.length].y);
      }
      ctx.closePath(); ctx.stroke();
    },
    dataFlow: (ctx, time, w, h) => {
      ctx.fillStyle = '#00FFFF';
      for(let i=0; i<10; i++) {
        const x = (time * 0.1 + i*20) % w;
        const y = h/2 + Math.sin(x*0.1 + i) * h*0.2;
        ctx.beginPath(); ctx.arc(x,y,1.5,0,Math.PI*2); ctx.fill();
      }
    },
    clockReverse: (ctx, time, w, h) => {
        const cx = w / 2; const cy = h / 2; const radius = h * 0.35;
        ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
        const angle = -time * 0.002; // Reverse direction
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + radius * 0.8 * Math.cos(angle), cy + radius * 0.8 * Math.sin(angle));
        ctx.stroke();
    },
    default: (ctx, time, w, h) => {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '16px Orbitron'; ctx.fillStyle = '#00FFFF';
        ctx.fillText("DATA STREAM ACTIVE", w/2, h/2);
    }
  };


  const drawHoloPanelContent = useCallback(() => {
    if (!holoCanvasRef.current || !activeNodeDataRef.current) return;
    const canvas = holoCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const time = clockRef.current.getElapsedTime() * 1000; // milliseconds
    const nodeData = activeNodeDataRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background with subtle scanlines
    ctx.fillStyle = 'rgba(0, 20, 30, 0.7)'; // Dark translucent blue
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(0, 120, 150, 0.3)';
    ctx.lineWidth = 1;
    for (let y = 0; y < canvas.height; y += 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Holovid Area (top 2/3)
    const holovidHeight = canvas.height * 0.60;
    ctx.save();
    ctx.beginPath(); ctx.rect(0,0, canvas.width, holovidHeight); ctx.clip(); // Clip holovid drawing
    const holovidFunc = holovidAnimations[nodeData.holovidId] || holovidAnimations.default;
    holovidFunc(ctx, time, canvas.width, holovidHeight);
    ctx.restore();
    
    ctx.strokeStyle = HOLO_PANEL_COLOR.getStyle();
    ctx.lineWidth = 2;
    ctx.strokeRect(2,2, canvas.width-4, holovidHeight-2); // Border for holovid area

    // Text Area (bottom 1/3)
    const textYStart = holovidHeight + 10;
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 20px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(nodeData.moduleShortName, canvas.width / 2, textYStart + 20);

    ctx.font = '13px Exo 2';
    ctx.textAlign = 'center';
    const descriptionLines = wrapText(ctx, nodeData.description, canvas.width - 40, 3); // Max 3 lines
    descriptionLines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, textYStart + 50 + index * 18);
    });

    // Jump Button Area (very bottom)
    const buttonHeight = 50;
    const buttonY = canvas.height - buttonHeight - 10;
    ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
    ctx.fillRect(20, buttonY, canvas.width - 40, buttonHeight);
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, buttonY, canvas.width - 40, buttonHeight);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Orbitron';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('[ JUMP TO SIMULATION ]', canvas.width / 2, buttonY + buttonHeight / 2);

    if (holoTextureRef.current) holoTextureRef.current.needsUpdate = true;
  }, []);

  function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = context.measureText(currentLine + " " + word).width;
      if (width < maxWidth && lines.length < maxLines -1) {
        currentLine += " " + word;
      } else {
        if(lines.length < maxLines -1){
            lines.push(currentLine);
            currentLine = word;
        } else {
            // Last line, try to fit and add ellipsis if needed
            const testLine = currentLine + " " + word;
            if(context.measureText(testLine).width < maxWidth) {
                 currentLine = testLine;
            } else {
                while(context.measureText(currentLine + "...").width > maxWidth && currentLine.length > 0) {
                    currentLine = currentLine.slice(0, -1);
                }
                currentLine += "...";
            }
            break; 
        }
      }
    }
    lines.push(currentLine);
    return lines.slice(0, maxLines);
  }

  // --- Step 1: The Environment & The Nodes ---
  useEffect(() => {
    if (!mountRef.current) return;
    console.log("DataStreamMap3D: Initializing 3D Scene");
    const currentMount = mountRef.current;

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0x000000);

    cameraRef.current = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    cameraRef.current.position.set(0, 5, 25);
    
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(rendererRef.current.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); sceneRef.current.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7); sceneRef.current.add(directionalLight);

    nodesGroupRef.current = new THREE.Group(); sceneRef.current.add(nodesGroupRef.current);
    linesGroupRef.current = new THREE.Group(); sceneRef.current.add(linesGroupRef.current);

    const nodeGeometry = new THREE.SphereGeometry(1, 24, 24);
    NODE_DATA.forEach(node => {
      const nodeMaterial = new THREE.MeshPhongMaterial({
        color: NODE_BASE_COLOR, emissive: NODE_BASE_COLOR, emissiveIntensity: 0.2,
        transparent: true, opacity: 0.85, shininess: 30
      });
      const sphere = new THREE.Mesh(nodeGeometry.clone(), nodeMaterial);
      sphere.position.copy(node.position);
      sphere.scale.setScalar(node.size * 0.5);
      sphere.userData = { ...node, type: 'node', originalColor: NODE_BASE_COLOR.clone(), originalEmissiveIntensity: 0.2, originalScale: sphere.scale.x };
      nodesGroupRef.current?.add(sphere);
      nodeOriginalPositionsRef.current.set(node.id, node.position.clone());

      if (node.connectedTo) {
        node.connectedTo.forEach(targetId => {
          const targetNodeData = NODE_DATA.find(n => n.id === targetId);
          if (targetNodeData && !linesGroupRef.current?.children.find(l => (l.userData.from === targetId && l.userData.to === node.id) )) { // Avoid duplicate lines
            const lineMaterial = new THREE.LineBasicMaterial({ color: LINE_BASE_COLOR, transparent: true, opacity: 0.3, linewidth: 1.5 });
            const points = [node.position, targetNodeData.position];
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(lineGeometry, lineMaterial);
            line.userData = { type: 'line', from: node.id, to: targetId, originalColor: LINE_BASE_COLOR.clone(), originalOpacity: 0.3 };
            linesGroupRef.current?.add(line);
          }
        });
      }
    });

    // Holo Panel Setup
    holoCanvasRef.current = document.createElement('canvas');
    holoCanvasRef.current.width = 512; // Texture resolution
    holoCanvasRef.current.height = Math.floor(512 * (HOLO_PANEL_HEIGHT / HOLO_PANEL_WIDTH));
    holoTextureRef.current = new THREE.CanvasTexture(holoCanvasRef.current);
    const holoPanelMaterial = new THREE.MeshBasicMaterial({
      map: holoTextureRef.current, transparent: true, opacity: 0,
      side: THREE.DoubleSide, color: 0xffffff, // Color will come from texture mostly
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const holoPanelGeometry = new THREE.PlaneGeometry(HOLO_PANEL_WIDTH, HOLO_PANEL_HEIGHT);
    holographicPanelRef.current = new THREE.Mesh(holoPanelGeometry, holoPanelMaterial);
    holographicPanelRef.current.visible = false;
    sceneRef.current.add(holographicPanelRef.current);
    
    // Projection Line Setup
    const projLineMaterial = new THREE.LineBasicMaterial({color: HOLO_PANEL_COLOR, transparent: true, opacity: 0, linewidth: 2});
    const projLineGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    holoPanelProjectionLineRef.current = new THREE.Line(projLineGeom, projLineMaterial);
    holoPanelProjectionLineRef.current.visible = false;
    sceneRef.current.add(holoPanelProjectionLineRef.current);


    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true; controlsRef.current.dampingFactor = 0.05;
    controlsRef.current.minDistance = 3; controlsRef.current.maxDistance = 50;

    const handleResize = () => { /* ... */ }; window.addEventListener('resize', handleResize);
    const handleContextLost = (event: Event) => { event.preventDefault(); console.warn("WebGL Context Lost"); /* Handle recovery if needed */ };
    rendererRef.current.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    
    // Animation Loop
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      if(!rendererRef.current || !sceneRef.current || !cameraRef.current || !nodesGroupRef.current) return;
      const delta = clockRef.current.getDelta();
      controlsRef.current?.update();

      // Node pulsation & re-orientation
      nodesGroupRef.current.children.forEach(child => {
        const nodeMesh = child as THREE.Mesh;
        if (nodeMesh.userData.type === 'node') {
          // Pulsation
          let pulseSpeed = 0.002; let scaleFactor = 0.05;
          if (hoveredNodeRef.current === nodeMesh || selectedNodeMeshRef.current === nodeMesh) {
            pulseSpeed = 0.005; scaleFactor = 0.1;
          }
          const pulse = Math.sin(Date.now() * pulseSpeed) * scaleFactor + (nodeMesh.userData.originalScale * (1-scaleFactor*0.5));
          nodeMesh.scale.setScalar(pulse);

          // Re-orientation (Lerp to target position)
          if(nodeMesh.userData.targetPosition) {
            nodeMesh.position.lerp(nodeMesh.userData.targetPosition, delta * 2.0); // Adjust speed as needed
            if(nodeMesh.position.distanceTo(nodeMesh.userData.targetPosition) < 0.01) {
              delete nodeMesh.userData.targetPosition; // Stop lerping
            }
          }
        }
      });
      // Line updates if nodes are moving
      linesGroupRef.current?.children.forEach(lineObj => {
        const line = lineObj as THREE.Line;
        const fromNode = nodesGroupRef.current?.children.find(n => n.userData.id === line.userData.from) as THREE.Mesh;
        const toNode = nodesGroupRef.current?.children.find(n => n.userData.id === line.userData.to) as THREE.Mesh;
        if(fromNode && toNode) {
            const positions = line.geometry.attributes.position as THREE.BufferAttribute;
            positions.setXYZ(0, fromNode.position.x, fromNode.position.y, fromNode.position.z);
            positions.setXYZ(1, toNode.position.x, toNode.position.y, toNode.position.z);
            positions.needsUpdate = true;
        }
      });


      // Camera animation
      if (cameraTargetPosRef.current && cameraTargetLookAtRef.current && cameraRef.current) { /* ... same as before ... */ }

      // Holographic Panel Animation & Content Update
      updateHoloPanelAnimation(delta);
      if (holoPanelStateRef.current === 'active' && holographicPanelRef.current?.visible) {
        drawHoloPanelContent();
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };
    animate();

    const handleMouseMove = (event: MouseEvent) => { /* ... */ updateHoverState(); };
    const handleClick = (event: MouseEvent) => {
      if (holoPanelStateRef.current === 'active' && holographicPanelRef.current?.visible && cameraRef.current) {
        // Raycast against panel first
        raycasterRef.current.setFromCamera(mouseNDCRef.current, cameraRef.current);
        const panelIntersects = raycasterRef.current.intersectObject(holographicPanelRef.current, false);
        if (panelIntersects.length > 0 && panelIntersects[0].uv) {
          const uv = panelIntersects[0].uv;
          // Check if click is on "Jump Button" area (approx bottom 15% of panel texture)
          if (uv.y < 0.20) { // Assuming button is at the bottom (UV Y is 0 at bottom)
            if (activeNodeDataRef.current?.moduleTarget !== undefined) {
              handleReplayModule(activeNodeDataRef.current.moduleTarget);
            }
            return;
          }
        }
      }
      // If not clicked on panel button, or panel not active, try node click or close panel
      if (!handleNodeClick()) { // handleNodeClick returns true if it consumed the click
        if (holoPanelStateRef.current === 'active') { // Clicked empty space while panel is active
             startHoloPanelDematerialization();
        }
      }
    };

    currentMount.addEventListener('mousemove', handleMouseMove);
    currentMount.addEventListener('click', handleClick);
    // Cleanup
    return () => { /* ... same as before ... */ };
  }, []);

  const updateHoloPanelAnimation = (delta: number) => {
    if(!holographicPanelRef.current || !holoPanelProjectionLineRef.current || !selectedNodeMeshRef.current) return;
    const panel = holographicPanelRef.current;
    const line = holoPanelProjectionLineRef.current;
    const panelMaterial = panel.material as THREE.MeshBasicMaterial;
    const lineMaterial = line.material as THREE.LineBasicMaterial;
    const targetNodePos = selectedNodeMeshRef.current.position;
    
    const panelOffsetDirection = cameraRef.current ? cameraRef.current.getWorldDirection(new THREE.Vector3()).cross(new THREE.Vector3(0,1,0)).normalize() : new THREE.Vector3(1,0,0);
    const panelTargetPosition = targetNodePos.clone().add(panelOffsetDirection.multiplyScalar(HOLO_PANEL_WIDTH / 2 + 0.5));
    panelTargetPosition.y = targetNodePos.y; // Keep at same height as node for now

    if (holoPanelStateRef.current === 'projecting') {
      holoPanelAnimationProgressRef.current = Math.min(1, holoPanelAnimationProgressRef.current + delta * 2.0); // 0.5s to project
      const progress = holoPanelAnimationProgressRef.current;
      
      line.visible = true;
      const linePositions = line.geometry.attributes.position as THREE.BufferAttribute;
      linePositions.setXYZ(0, targetNodePos.x, targetNodePos.y, targetNodePos.z);
      const currentLineEnd = targetNodePos.clone().lerp(panelTargetPosition, progress);
      linePositions.setXYZ(1, currentLineEnd.x, currentLineEnd.y, currentLineEnd.z);
      linePositions.needsUpdate = true;
      lineMaterial.opacity = progress < 0.5 ? progress * 2 : 1 - (progress - 0.5) * 2; // Fade in then out

      if (progress >= 0.5 && !panel.visible) { // Line reached target, start drawing panel
        panel.visible = true;
        panel.position.copy(panelTargetPosition);
        panel.lookAt(cameraRef.current ? cameraRef.current.position : new THREE.Vector3(0,0,100));
      }
      if(panel.visible) {
        const drawProgress = (progress - 0.4) / 0.6; // Panel draws from 0.4 to 1.0 progress
        panel.scale.set(Math.max(0.01, drawProgress * 1.1), Math.max(0.01, drawProgress), 1); // Expand with slight overshoot
        panelMaterial.opacity = Math.min(0.8, drawProgress * 1.5); // Flicker in
        if (drawProgress >= 0.3 && drawProgress < 0.6) panelMaterial.opacity *= (Math.sin(clockRef.current.getElapsedTime()*50) * 0.2 + 0.8); // Flicker
      }

      if (progress >= 1) {
        holoPanelStateRef.current = 'active';
        line.visible = false; lineMaterial.opacity = 0;
        panel.scale.set(1,1,1); panelMaterial.opacity = 0.85; // Stabilize
      }
    } else if (holoPanelStateRef.current === 'dematerializing') {
      holoPanelAnimationProgressRef.current = Math.max(0, holoPanelAnimationProgressRef.current - delta * 2.5); // Faster dematerialize
      const progress = holoPanelAnimationProgressRef.current;

      panel.scale.set(progress, progress, 1);
      panelMaterial.opacity = progress * 0.85;
      if (progress <= 0.01) {
        holoPanelStateRef.current = 'idle';
        panel.visible = false;
        activeNodeDataRef.current = null;
        selectedNodeMeshRef.current = null; // Clear selection state
        // Restore non-selected nodes immediately for simplicity
        nodesGroupRef.current?.children.forEach(child => {
            const nodeMesh = child as THREE.Mesh;
            const mat = nodeMesh.material as THREE.MeshPhongMaterial;
            mat.opacity = 0.85;
            mat.color.copy(nodeMesh.userData.originalColor);
            mat.emissiveIntensity = nodeMesh.userData.originalEmissiveIntensity;
            const originalPos = nodeOriginalPositionsRef.current.get(nodeMesh.userData.id);
            if(originalPos) nodeMesh.userData.targetPosition = originalPos.clone();
        });
        linesGroupRef.current?.children.forEach(lineObj => {
            const line = lineObj as THREE.Line;
            (line.material as THREE.LineBasicMaterial).color.copy(line.userData.originalColor);
            (line.material as THREE.LineBasicMaterial).opacity = line.userData.originalOpacity;
        });
        if(controlsRef.current) controlsRef.current.enabled = true;
      }
    } else if (holoPanelStateRef.current === 'active' && panel.visible && cameraRef.current) {
        // Keep panel oriented towards camera and positioned relative to selected node
        panel.position.copy(panelTargetPosition);
        panel.lookAt(cameraRef.current.position);
        panelMaterial.opacity = 0.85 + Math.sin(clockRef.current.getElapsedTime() * 5) * 0.05; // Subtle flicker
    }
  };


  const updateHoverState = () => { /* ... same as before, ensures visual feedback on nodes */ };

  const handleNodeClick = (): boolean => {
    if (!hoveredNodeRef.current || !cameraRef.current || !nodesGroupRef.current || !controlsRef.current) {
      return false; // Did not consume click
    }
    // If clicking the currently selected node while panel is active, do nothing (or close panel)
    if (selectedNodeMeshRef.current === hoveredNodeRef.current && holoPanelStateRef.current === 'active') {
        // startHoloPanelDematerialization(); // Option: click selected node again to close
        return true; // Consumed click
    }
    
    // If a panel is already active for another node, dematerialize it first
    if ((holoPanelStateRef.current === 'active' || holoPanelStateRef.current === 'projecting') && selectedNodeMeshRef.current !== hoveredNodeRef.current) {
        startHoloPanelDematerialization(true); // silent = true (don't restore nodes yet)
    }

    const clickedNodeMesh = hoveredNodeRef.current;
    selectedNodeMeshRef.current = clickedNodeMesh;
    activeNodeDataRef.current = clickedNodeMesh.userData as StreamNodeData;
    
    if(controlsRef.current) controlsRef.current.enabled = false;
    const nodeData = activeNodeDataRef.current;
    const targetLookAt = clickedNodeMesh.position.clone();
    // Calculate camera position to frame node and panel. Panel appears to its side.
    const cameraDirection = cameraRef.current.getWorldDirection(new THREE.Vector3());
    const offsetDistance = nodeData.size * 3 + HOLO_PANEL_WIDTH; // Distance to see node and panel
    const cameraPosition = targetLookAt.clone().sub(cameraDirection.multiplyScalar(offsetDistance));
    cameraPosition.y = targetLookAt.y + nodeData.size; // Slightly elevated view

    cameraTargetPosRef.current = cameraPosition;
    cameraTargetLookAtRef.current = targetLookAt;

    // Constellation Re-orientation
    nodesGroupRef.current.children.forEach(child => {
      const node = child as THREE.Mesh;
      const mat = node.material as THREE.MeshPhongMaterial;
      if (node === clickedNodeMesh) {
        mat.color.copy(NODE_SELECTED_HIGHLIGHT_COLOR);
        mat.emissiveIntensity = 0.7;
        mat.opacity = 1.0;
        node.userData.targetPosition = nodeOriginalPositionsRef.current.get(node.userData.id)?.clone(); // Ensure selected stays or returns to original
      } else {
        mat.opacity = 0.4;
        mat.emissiveIntensity = 0.1;
        // Calculate background position: further away, perhaps on a sphere around selected node
        const direction = node.position.clone().sub(clickedNodeMesh.position).normalize();
        const distance = 10 + Math.random() * 5; // Scatter them in background
        node.userData.targetPosition = clickedNodeMesh.position.clone().add(direction.multiplyScalar(distance));
        node.userData.targetPosition.y += (Math.random()-0.5) * 5; // Add some vertical spread
      }
    });
    linesGroupRef.current?.children.forEach(lineObj => { /* Dim lines */ });

    holoPanelAnimationProgressRef.current = 0;
    holoPanelStateRef.current = 'projecting';
    if(holographicPanelRef.current) holographicPanelRef.current.visible = false; // Ensure starts invisible
    if(holoPanelProjectionLineRef.current) holoPanelProjectionLineRef.current.visible = false;
    console.log(`Holographic panel projecting for ${nodeData.title}`);
    return true; // Consumed click
  };
  
  const startHoloPanelDematerialization = (silent = false) => {
    if (holoPanelStateRef.current !== 'active' && holoPanelStateRef.current !== 'projecting') return;
    holoPanelStateRef.current = 'dematerializing';
    holoPanelAnimationProgressRef.current = 1; // Start from full
    if(holoPanelProjectionLineRef.current) holoPanelProjectionLineRef.current.visible = false;

    if (!silent) {
      // Restore non-selected nodes
      nodesGroupRef.current?.children.forEach(child => {
        const nodeMesh = child as THREE.Mesh;
        if (nodeMesh !== selectedNodeMeshRef.current) { // Don't touch the one that was selected until panel fully gone
            const mat = nodeMesh.material as THREE.MeshPhongMaterial;
            mat.opacity = 0.85;
            mat.color.copy(nodeMesh.userData.originalColor);
            mat.emissiveIntensity = nodeMesh.userData.originalEmissiveIntensity;
            const originalPos = nodeOriginalPositionsRef.current.get(nodeMesh.userData.id);
            if(originalPos) nodeMesh.userData.targetPosition = originalPos.clone();
        }
      });
      linesGroupRef.current?.children.forEach(lineObj => { /* Restore lines */ });
      if(controlsRef.current) controlsRef.current.enabled = true;
      cameraTargetPosRef.current = null; cameraTargetLookAtRef.current = null;
    }
  };

  const handleReplayModule = (moduleTarget: CalibrationModule | undefined) => {
    if (moduleTarget !== undefined) {
      onJumpToSimulation(moduleTarget);
      startHoloPanelDematerialization();
    }
  };

  return (
    <div className="w-full h-[75vh] md:h-[85vh] relative text-white">
      <div ref={mountRef} className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing"></div>
      {holoPanelStateRef.current === 'idle' && !selectedNodeMeshRef.current && (
         <div className="absolute top-4 left-1/2 -translate-x-1/2 p-3 bg-black/50 rounded-lg backdrop-blur-sm text-center pointer-events-none animate-fadeIn">
            <h2 className="text-2xl md:text-3xl font-bold text-glow-magenta">DATA-STREAM MAP</h2>
            <p className="text-xs text-purple-300">Explore the Quantum Vault's architecture.</p>
        </div>
      )}
    </div>
  );
};

export default DataStreamMap3D;

