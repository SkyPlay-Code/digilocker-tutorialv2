import React, { useState, useEffect, useCallback, useRef } from 'react';

const IDLE_COLOR = "#00BFFF"; // Neutral Blue
const TRACED_COLOR = "#00FF7F"; // Verified Green
const ERROR_COLOR = "#EF4444"; // Red-500

const NODE_RADIUS = 10;
const LINE_WIDTH = 4;
const TRACE_TOLERANCE = 10; // Pixels from line center
const TIMER_DURATION = 7; // seconds

interface Node {
  id: number;
  x: number;
  y: number;
  isTraced: boolean;
  isStart?: boolean;
  isEnd?: boolean;
}

interface Line {
  id: string;
  fromNodeId: number;
  toNodeId: number;
  isTraced: boolean;
  length: number;
  angle: number;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  opacity: number;
  size: number;
  createdAt: number;
}

const generateRandomId = () => Math.random().toString(36).substring(2, 9);

const INITIAL_NODES: Node[] = [
  { id: 1, x: 100, y: 200, isTraced: false, isStart: true },
  { id: 2, x: 250, y: 100, isTraced: false },
  { id: 3, x: 400, y: 200, isTraced: false },
  { id: 4, x: 300, y: 300, isTraced: false },
  { id: 5, x: 150, y: 300, isTraced: false, isEnd: true },
];

const calculateLineProperties = (node1: Node, node2: Node): Pick<Line, 'length' | 'angle'> => {
    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    return {
        length: Math.sqrt(dx * dx + dy * dy),
        angle: Math.atan2(dy, dx)
    };
};

const INITIAL_LINES: Line[] = INITIAL_NODES.slice(0, -1).map((node, i) => {
    const nextNode = INITIAL_NODES[i + 1];
    const props = calculateLineProperties(node, nextNode);
    return {
      id: `l-${node.id}-${nextNode.id}`,
      fromNodeId: node.id,
      toNodeId: nextNode.id,
      isTraced: false,
      length: props.length,
      angle: props.angle,
    };
});

interface AuthenticationSigilProps {
  onSuccess: () => void;
  onRetryPrompt: () => void;
}

const AuthenticationSigil: React.FC<AuthenticationSigilProps> = ({ onSuccess, onRetryPrompt }) => {
  const [status, setStatus] = useState<'idle' | 'materializing' | 'awaitingInput' | 'tracing' | 'success' | 'failure' | 'resetting'>('idle');
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES.map(n => ({...n, isTraced: false})));
  const [lines, setLines] = useState<Line[]>(INITIAL_LINES.map(l => ({...l, isTraced: false})));
  const [currentTracingNodeIndex, setCurrentTracingNodeIndex] = useState(0); // Index in INITIAL_NODES
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [particleTrail, setParticleTrail] = useState<Particle[]>([]);

  const svgRef = useRef<SVGSVGElement>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const particleTimeoutRef = useRef<number | null>(null);
  const materializationTimerRef = useRef<number | null>(null);

  const resetSigilState = useCallback(() => {
    setNodes(INITIAL_NODES.map(n => ({ ...n, isTraced: false })));
    setLines(INITIAL_LINES.map(l => ({ ...l, isTraced: false })));
    setCurrentTracingNodeIndex(0);
    setIsMouseDown(false);
    setMousePosition(null);
    setTimeLeft(TIMER_DURATION);
    setFeedbackMessage(null);
    setParticleTrail([]);
  }, []);

  useEffect(() => {
    resetSigilState();
    setStatus('materializing');
  }, [resetSigilState, attemptCount]); // Rerun on new attempts

  useEffect(() => {
    if (status === 'materializing') {
      // Simulate line drawing animation end
      if(materializationTimerRef.current) clearTimeout(materializationTimerRef.current);
      materializationTimerRef.current = window.setTimeout(() => {
        setStatus('awaitingInput');
      }, 1000 * lines.length * 0.2 + 500); // Rough estimate for line draw + node fade
    }

    if (status === 'awaitingInput' || status === 'tracing') {
      if(timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleFailure('timer');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (particleTimeoutRef.current) clearTimeout(particleTimeoutRef.current);
      if (materializationTimerRef.current) clearTimeout(materializationTimerRef.current);
    };
  }, [status]);


  // Particle Trail Cleanup
  useEffect(() => {
    if (particleTrail.length > 0) {
      const newTrail = particleTrail.map(p => ({...p, opacity: p.opacity - 0.1})).filter(p => p.opacity > 0);
      if (particleTimeoutRef.current) clearTimeout(particleTimeoutRef.current);
      particleTimeoutRef.current = window.setTimeout(() => setParticleTrail(newTrail), 50);
    }
    return () => { if (particleTimeoutRef.current) clearTimeout(particleTimeoutRef.current); };
  }, [particleTrail]);


  const getLocalCoordinates = (event: React.MouseEvent): { x: number; y: number } | null => {
    if (svgRef.current) {
      const svgPoint = svgRef.current.createSVGPoint();
      svgPoint.x = event.clientX;
      svgPoint.y = event.clientY;
      const screenCTM = svgRef.current.getScreenCTM();
      if (screenCTM) {
        const localPoint = svgPoint.matrixTransform(screenCTM.inverse());
        return { x: localPoint.x, y: localPoint.y };
      }
    }
    return null;
  };

  const isPointNearLine = (point: { x: number; y: number }, line: Line, nodesMap: Map<number, Node>): boolean => {
    const p1 = nodesMap.get(line.fromNodeId);
    const p2 = nodesMap.get(line.toNodeId);
    if (!p1 || !p2) return false;

    const len2 = (p1.x - p2.x)**2 + (p1.y - p2.y)**2;
    if (len2 === 0) return Math.sqrt((point.x - p1.x)**2 + (point.y - p1.y)**2) < NODE_RADIUS; // near node

    let t = ((point.x - p1.x) * (p2.x - p1.x) + (point.y - p1.y) * (p2.y - p1.y)) / len2;
    t = Math.max(0, Math.min(1, t)); // Clamp t to the segment

    const projX = p1.x + t * (p2.x - p1.x);
    const projY = p1.y + t * (p2.y - p1.y);
    const dist = Math.sqrt((point.x - projX)**2 + (point.y - projY)**2);
    
    return dist < TRACE_TOLERANCE;
  };

  const handleMouseDown = (event: React.MouseEvent, nodeId: number) => {
    if (status !== 'awaitingInput' && status !== 'tracing') return;
    const startNode = nodes[currentTracingNodeIndex];
    if (startNode && startNode.id === nodeId) {
      setIsMouseDown(true);
      setStatus('tracing');
      const coords = getLocalCoordinates(event);
      if (coords) setMousePosition(coords);
    } else if (status === 'awaitingInput') {
       // Allow click on first node only
       const firstNode = nodes.find(n => n.isStart);
       if(firstNode && firstNode.id === nodeId){
            setIsMouseDown(true);
            setStatus('tracing');
            const coords = getLocalCoordinates(event);
            if (coords) setMousePosition(coords);
            setNodes(prev => prev.map(n => n.id === nodeId ? {...n, isTraced: true} : n));
       }
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    const currentMousePos = getLocalCoordinates(event);
    if (currentMousePos) setMousePosition(currentMousePos);

    if (!isMouseDown || status !== 'tracing' || !currentMousePos) return;

    // Particle Trail
    setParticleTrail(prev => [...prev.slice(-20), { id: generateRandomId(), x: currentMousePos.x, y: currentMousePos.y, opacity: 1, size: Math.random() * 3 + 2, createdAt: Date.now() }]);

    const nodesMap = new Map(nodes.map(n => [n.id, n]));
    const currentLine = lines[currentTracingNodeIndex];
    
    if (currentLine && !currentLine.isTraced) {
      if (isPointNearLine(currentMousePos, currentLine, nodesMap)) {
        // Check if approaching target node of current line
        const targetNode = nodesMap.get(currentLine.toNodeId);
        if (targetNode) {
          const distToTargetNode = Math.sqrt((currentMousePos.x - targetNode.x)**2 + (currentMousePos.y - targetNode.y)**2);
          if (distToTargetNode < NODE_RADIUS * 1.5) { // Reached target node
            setLines(prev => prev.map(l => l.id === currentLine.id ? { ...l, isTraced: true } : l));
            setNodes(prev => prev.map(n => n.id === targetNode.id ? { ...n, isTraced: true } : n));
            setCurrentTracingNodeIndex(prev => prev + 1);

            if (targetNode.isEnd) { // Check if it's the final node
                handleSuccess(); // Success if final node is reached and traced
            }
          }
        }
      } else {
        // Straying off path
        // handleFailure('strayed'); // Could be too sensitive, let mouse up handle this or a more robust check
      }
    }
  };

  const handleMouseUp = () => {
    if (!isMouseDown || status !== 'tracing') return;
    setIsMouseDown(false);

    const allLinesTraced = lines.every(l => l.isTraced);
    const endNode = nodes.find(n => n.isEnd);
    if(endNode && endNode.isTraced && allLinesTraced) {
         // This check is a bit redundant if reaching end node in mouseMove already calls handleSuccess
        handleSuccess();
    } else {
        handleFailure('incomplete');
    }
  };
  
  const handleMouseLeave = () => {
    if (isMouseDown && status === 'tracing') {
        handleFailure('strayed_leave');
    }
  };

  const handleSuccess = () => {
    if (status === 'success') return; // Prevent multiple calls
    setStatus('success');
    setFeedbackMessage({ text: "SIGNATURE VERIFIED", type: 'success' });
    console.log("Audio: SUCCESS CHIME");
    if(timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setTimeout(() => {
        onSuccess();
         // Optionally reset for a new display if component isn't unmounted
        // setStatus('idle'); resetSigilState(); setAttemptCount(0); 
    }, 2000); // Allow time for animation
  };

  const handleFailure = (reason: string) => {
    if (status === 'failure' || status === 'success') return; // Prevent multiple calls
    console.log(`Failure reason: ${reason}`);
    setStatus('failure');
    setFeedbackMessage({ text: "SIGNATURE CORRUPTED. RE-ATTEMPTING...", type: 'error' });
    console.log("Audio: ERROR BUZZER");
    if(timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    setTimeout(() => {
      setStatus('resetting');
      setAttemptCount(prev => prev + 1);
      if (attemptCount > 0 || reason === 'timer') { // Ensure prompt on first timer fail too
        onRetryPrompt();
      }
      // resetSigilState() is called by useEffect on attemptCount change
    }, 1500); // Time for error message and animation
  };

  const timerPathCircumference = 2 * Math.PI * 45; // Assuming radius 45 for timer circle
  const timerPathDashoffset = (timeLeft / TIMER_DURATION) * timerPathCircumference;

  return (
    <div className={`relative flex flex-col items-center justify-center p-4 pointer-events-auto
                    ${status === 'success' || status === 'failure' ? 
                        (status === 'success' ? 'animate-sigil-success-flash' : 'animate-sigil-failure-flash') 
                        : ''}
                    ${status === 'failure' ? 'animate-sigil-glitch' : ''}
                    ${status === 'idle' || status === 'resetting' ? 'opacity-0' : 'opacity-100 animate-fadeIn'}
                    transition-opacity duration-300
                    `}
          style={{ width: 500, height: 400 }} // Fixed size for SVG content
    >
      <svg 
        ref={svgRef} 
        viewBox="0 0 500 400" 
        className="overflow-visible"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave} // Handle if mouse leaves SVG while tracing
        style={{ cursor: isMouseDown && status==='tracing' ? 'none' : 'default' }}
      >
        {/* Timer */}
        { (status === 'awaitingInput' || status === 'tracing') && (
            <circle 
                cx="250" cy="200" r="45" 
                fill="none" 
                stroke="rgba(0,191,255,0.3)" 
                strokeWidth="3"
            />
        )}
        { (status === 'awaitingInput' || status === 'tracing') && (
            <circle 
                cx="250" cy="200" r="45" 
                fill="none" 
                stroke={IDLE_COLOR} 
                strokeWidth="4"
                strokeLinecap="round"
                transform="rotate(-90 250 200)"
                className="sigil-timer-path"
                style={{ strokeDasharray: timerPathCircumference, strokeDashoffset: timerPathDashoffset, transition: 'stroke-dashoffset 1s linear' }}
            />
        )}
         { (status === 'awaitingInput' || status === 'tracing') && (
            <text x="250" y="205" textAnchor="middle" fill={IDLE_COLOR} fontSize="18" className="font-roboto-mono select-none">{timeLeft}</text>
         )}


        {/* Lines */}
        {lines.map((line, index) => {
          const fromNode = nodes.find(n => n.id === line.fromNodeId);
          const toNode = nodes.find(n => n.id === line.toNodeId);
          if (!fromNode || !toNode) return null;
          const animationDelay = status === 'materializing' ? `${index * 0.15}s` : '0s';
          return (
            <line
              key={line.id}
              x1={fromNode.x} y1={fromNode.y}
              x2={toNode.x} y2={toNode.y}
              stroke={line.isTraced ? TRACED_COLOR : IDLE_COLOR}
              strokeWidth={LINE_WIDTH}
              strokeLinecap="round"
              className={status === 'materializing' ? 'sigil-line-draw' : ''}
              style={{ animationDelay, '--line-length': line.length } as React.CSSProperties}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node, index) => {
          const isCurrentActiveStartNode = currentTracingNodeIndex < lines.length && lines[currentTracingNodeIndex]?.fromNodeId === node.id && !lines[currentTracingNodeIndex]?.isTraced;
          const isNextTargetNode = currentTracingNodeIndex < lines.length && lines[currentTracingNodeIndex]?.toNodeId === node.id && !lines[currentTracingNodeIndex]?.isTraced;
          let nodeClass = status === 'materializing' ? 'sigil-node-materialize opacity-0' : 'sigil-node-idle';
          if (status === 'tracing' && (isCurrentActiveStartNode || isNextTargetNode) ) {
            nodeClass = 'sigil-node-target';
          }
           const animationDelay = status === 'materializing' ? `${lines.length * 0.15 + index * 0.05}s` : '0s';
          return (
            <circle
              key={node.id}
              cx={node.x} cy={node.y}
              r={NODE_RADIUS}
              fill={node.isTraced ? TRACED_COLOR : IDLE_COLOR}
              className={`${nodeClass}`}
              style={{ animationDelay, '--node-radius': NODE_RADIUS, '--node-color': node.isTraced ? TRACED_COLOR : IDLE_COLOR } as React.CSSProperties}
              onMouseDown={(e) => handleMouseDown(e, node.id)}
              cursor={ (status === 'awaitingInput' && node.isStart) || (status==='tracing' && isCurrentActiveStartNode) ? 'pointer' : 'default'}
            />
          );
        })}
        
        {/* Particle Trail on SVG - for simplicity, actual trail is divs */}

        {/* Feedback Text */}
        {feedbackMessage && (
          <text
            x="250" y={status === 'success' ? "200" : "360"} // Position above for success, below for error
            textAnchor="middle"
            alignmentBaseline="middle"
            fill={feedbackMessage.type === 'success' ? TRACED_COLOR : ERROR_COLOR}
            fontSize="24"
            className={`font-roboto-mono animate-sigil-feedback-text select-none ${feedbackMessage.type === 'success' ? 'text-glow-green' : 'text-glow-red font-orbitron'}`}
            style={{animationDelay: '0.2s'}}
          >
            {feedbackMessage.text}
          </text>
        )}
      </svg>
      
      {/* Custom Cursor */}
      {isMouseDown && status === 'tracing' && mousePosition && (
        <div 
          className="absolute w-3 h-3 bg-green-400 rounded-full pointer-events-none shadow-[0_0_8px_2px_rgba(0,255,127,0.7)]"
          style={{ 
            left: mousePosition.x - 6, 
            top: mousePosition.y - 6,
            transform: `translateZ(0)` // Promote to own layer
          }}
        />
      )}

      {/* Particle Trail - Rendered as divs for easier animation/styling */}
      {particleTrail.map(p => (
        <div 
            key={p.id}
            className="absolute rounded-full bg-green-400 pointer-events-none"
            style={{
                left: p.x - p.size / 2,
                top: p.y - p.size / 2,
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                transition: 'opacity 0.2s linear',
                boxShadow: `0 0 ${p.size*1.5}px ${p.size*0.5}px rgba(0,255,127,${p.opacity * 0.7})`,
                transform: `translateZ(0)` // Promote to own layer
            }}
        />
      ))}

      {(status === 'success' || status === 'failure') && (feedbackMessage?.text.startsWith("SIGNATURE VERIFIED") || feedbackMessage?.text.startsWith("SIGNATURE CORRUPTED")) && (
         <div className="absolute inset-0 animate-sigil-dissolve pointer-events-none" style={{animationDelay: '1.5s'}}></div>
      )}

    </div>
  );
};

export default AuthenticationSigil;