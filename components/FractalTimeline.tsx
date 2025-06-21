
import React, { useState, useEffect, useMemo } from 'react';
import { CalibrationModule, TimelineModuleConfig } from '../types';

interface FractalTimelineProps {
  moduleConfigs: TimelineModuleConfig[];
  completedModuleIds: CalibrationModule[];
  currentModuleId: CalibrationModule | null;
  onRewindToModule: (moduleId: CalibrationModule) => void;
}

const SVG_HEIGHT = 120; // Total height for the SVG canvas
const TIMELINE_Y = SVG_HEIGHT - 40; // Y position of the main horizontal timeline
const NODE_RADIUS = 8;
const SEGMENT_LENGTH_MAIN = 150;
const SEGMENT_LENGTH_BRANCH = 100;
const BRANCH_ANGLE_RAD = Math.PI / 4; // 45 degrees

const DORMANT_COLOR = "rgba(100, 116, 139, 0.5)"; // slate-500 with opacity
const NODE_START_COLOR = "#3b82f6"; // blue-500
const NODE_COMPLETED_COLOR = "#06b6d4"; // cyan-500 (same as activeColorActual)
const NODE_HOVER_COLOR = "#22d3ee"; // cyan-400
const TEXT_COLOR = "#e0f2fe"; // cyan-50


interface TimelineNode {
  id: string; // "START" or module ID string
  moduleId: CalibrationModule | 'START_NODE';
  label: string;
  x: number;
  y: number;
  isCompleted: boolean;
  isCurrent: boolean;
  segmentPath?: string; // Path from parent to this node
  branchPath?: string; // Dormant branch path originating from this node
  branchEndPoint?: { x: number; y: number };
  isBranchNode: boolean; // Is this node itself at the end of a branch?
  depth: number; // 0 for main, 1 for first branch, etc.
}

const FractalTimeline: React.FC<FractalTimelineProps> = ({
  moduleConfigs,
  completedModuleIds,
  currentModuleId,
  onRewindToModule,
}) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [activatingSegment, setActivatingSegment] = useState<{ fromX: number, fromY: number, toX: number, toY: number, pathLength: number } | null>(null);

  const activeColorActual = "#06b6d4"; // Tailwind cyan-500

  const timelineNodes = useMemo(() => {
    const nodes: TimelineNode[] = [];
    let currentX = 50; // Start padding
    let currentY = TIMELINE_Y;
    let lastBranchDirection = 1; // 1 for up, -1 for down
    let parentNodeCenter = { x: currentX, y: currentY };
    let currentDepth = 0;

    // Start Node
    nodes.push({
      id: 'START_NODE',
      moduleId: 'START_NODE',
      label: 'Sequence Initiated',
      x: currentX,
      y: currentY,
      isCompleted: true, // Start node is always "completed" in a sense
      isCurrent: currentModuleId === CalibrationModule.Intro || completedModuleIds.length === 0,
      isBranchNode: false,
      depth: 0,
    });
    
    let lastMainNodePosition = { x: currentX, y: currentY };

    moduleConfigs.forEach((config, index) => {
      if(config.id === CalibrationModule.Completed && moduleConfigs.length -1 !== index) return; // Skip 'Completed' if not last

      const isCompleted = completedModuleIds.includes(config.id);
      const isCurrent = currentModuleId === config.id;
      let segmentPathD = '';
      let branchPathD = '';
      let branchEndPointCoords;
      let newNodeX = 0, newNodeY = 0;
      let isBranch = false;

      if (index === 0 || nodes[nodes.length -1].isBranchNode) { // First module or previous was a branch - extend main line
        isBranch = false;
        currentDepth = 0; // Reset to main timeline
        currentX = lastMainNodePosition.x + SEGMENT_LENGTH_MAIN;
        currentY = TIMELINE_Y;
        newNodeX = currentX;
        newNodeY = currentY;
        segmentPathD = `M ${lastMainNodePosition.x} ${lastMainNodePosition.y} L ${newNodeX} ${newNodeY}`;
        lastMainNodePosition = { x: newNodeX, y: newNodeY };
        parentNodeCenter = { x: lastMainNodePosition.x, y: lastMainNodePosition.y };
      } else { // Branch off the previous main node
        isBranch = true;
        currentDepth = nodes[nodes.length -1].depth + 1;
        const parent = nodes[nodes.length -1];
        const angle = lastBranchDirection * BRANCH_ANGLE_RAD;
        
        newNodeX = parent.x + SEGMENT_LENGTH_BRANCH * Math.cos(angle);
        newNodeY = parent.y - SEGMENT_LENGTH_BRANCH * Math.sin(angle); // SVG Y is inverted
        segmentPathD = `M ${parent.x} ${parent.y} L ${newNodeX} ${newNodeY}`;
        parentNodeCenter = { x: newNodeX, y: newNodeY };
      }
      
      if (isCompleted && index < moduleConfigs.length - 1 && moduleConfigs[index+1].id !== CalibrationModule.Completed) {
          const nextBranchAngle = isBranch ? BRANCH_ANGLE_RAD * (Math.random() > 0.5 ? 1 : -0.5) : -lastBranchDirection * BRANCH_ANGLE_RAD;
          branchEndPointCoords = {
            x: newNodeX + SEGMENT_LENGTH_BRANCH * Math.cos(nextBranchAngle) * 0.8, 
            y: newNodeY - SEGMENT_LENGTH_BRANCH * Math.sin(nextBranchAngle) * 0.8,
          };
          branchPathD = `M ${newNodeX} ${newNodeY} L ${branchEndPointCoords.x} ${branchEndPointCoords.y}`;
      }


      nodes.push({
        id: config.id.toString(),
        moduleId: config.id,
        label: config.label,
        x: newNodeX,
        y: newNodeY,
        isCompleted,
        isCurrent,
        segmentPath: segmentPathD,
        branchPath: branchPathD,
        branchEndPoint: branchEndPointCoords,
        isBranchNode: isBranch,
        depth: currentDepth,
      });

      if (isCompleted && !isBranch) { 
        lastBranchDirection *= -1;
      }
    });

    return nodes;
  }, [moduleConfigs, completedModuleIds, currentModuleId]);
  
  useEffect(() => {
    if (activatingSegment) {
      const timer = setTimeout(() => setActivatingSegment(null), 1000); 
      return () => clearTimeout(timer);
    }
  }, [activatingSegment]);


  const handleNodeClick = (nodeModuleId: CalibrationModule | 'START_NODE') => {
    if (nodeModuleId === 'START_NODE') return; 
    const targetNode = timelineNodes.find(n => n.moduleId === nodeModuleId);
    if (targetNode && targetNode.isCompleted) { 
      console.log(`FractalTimeline: Rewind to ${targetNode.label}`);
      console.log("Audio: REWIND SOUND");
      console.log(`AI Voice: Reverting timeline. Re-engaging ${targetNode.label.split(':')[0]}.`);
      onRewindToModule(nodeModuleId as CalibrationModule);
    }
  };


  const getPathLength = (pathD: string | undefined): number => {
    if (!pathD) return 0;
    try {
        const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathElement.setAttribute("d", pathD);
        return pathElement.getTotalLength();
    } catch (e) { return 100; /* fallback */ }
  };

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[80vw] max-w-5xl h-[120px] z-50 pointer-events-none">
      <svg width="100%" height={SVG_HEIGHT} viewBox={`0 0 ${0.8 * (typeof window !== "undefined" ? window.innerWidth : 1200)} ${SVG_HEIGHT}`} className="overflow-visible">
        <defs>
          <filter id="glow-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
           <marker id="arrowhead-dormant" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill={DORMANT_COLOR} opacity="0.7"/>
          </marker>
          <marker id="arrowhead-active" markerWidth="8" markerHeight="5" refX="7" refY="2.5" orient="auto">
            <polygon points="0 0, 8 2.5, 0 5" fill={activeColorActual} />
          </marker>
        </defs>

        <line 
            x1={timelineNodes[0]?.x || 50} 
            y1={TIMELINE_Y} 
            x2={(timelineNodes[0]?.x || 50) + moduleConfigs.filter(mc => mc.id !== CalibrationModule.Completed).length * SEGMENT_LENGTH_MAIN} 
            y2={TIMELINE_Y} // Corrected from y1 to y2
            stroke={DORMANT_COLOR} 
            strokeWidth="2" 
            strokeDasharray="3 3"
        />

        {timelineNodes.map((node, index) => {
          const isHovered = hoveredNodeId === node.id;
          const segmentStroke = node.isCompleted ? activeColorActual : DORMANT_COLOR;
          const segmentStrokeWidth = node.isCompleted ? 3 : 2;
          const nodeFill = node.id === 'START_NODE' ? NODE_START_COLOR : (node.isCompleted ? NODE_COMPLETED_COLOR : DORMANT_COLOR);
          
          const pathLength = getPathLength(node.segmentPath);

          return (
            <g key={node.id} className="pointer-events-auto">
              {node.segmentPath && (
                <path
                  d={node.segmentPath}
                  stroke={segmentStroke}
                  strokeWidth={segmentStrokeWidth}
                  fill="none"
                  markerEnd={node.isCompleted ? "url(#arrowhead-active)" : "url(#arrowhead-dormant)"}
                  style={{
                    transition: 'stroke 0.5s ease, stroke-width 0.3s ease',
                    strokeDasharray: pathLength,
                    strokeDashoffset: node.isCompleted ? 0 : pathLength, 
                    animation: node.isCompleted && !completedModuleIds.includes(node.moduleId as CalibrationModule) && pathLength > 0 ? `draw-line ${0.5 + index*0.1}s ease-out forwards` : 'none'
                  }}
                />
              )}
              
              {activatingSegment && node.segmentPath && activatingSegment.toX === node.x && activatingSegment.toY === node.y && (
                <circle cx={activatingSegment.fromX} cy={activatingSegment.fromY} r="4" fill="white" filter="url(#glow-filter)">
                  <animateMotion
                    dur="0.5s"
                    path={node.segmentPath}
                    begin="0s"
                    fill="freeze"
                    keyPoints="0;1" 
                    keyTimes="0;1"
                  />
                </circle>
              )}

              {node.branchPath && node.isCompleted && (
                <path
                  d={node.branchPath}
                  stroke={DORMANT_COLOR}
                  strokeWidth="2"
                  strokeDasharray="3 3"
                  fill="none"
                  markerEnd="url(#arrowhead-dormant)"
                  className="animate-fadeIn" // Uses global CSS animation
                  style={{animationDelay: `${0.5 + index*0.1}s`}}
                />
              )}

              <circle
                cx={node.x}
                cy={node.y}
                r={isHovered && node.isCompleted ? NODE_RADIUS * 1.5 : NODE_RADIUS}
                fill={isHovered && node.isCompleted ? NODE_HOVER_COLOR : nodeFill}
                stroke={isHovered && node.isCompleted ? activeColorActual : (node.isCompleted ? activeColorActual : DORMANT_COLOR)}
                strokeWidth={isHovered ? 3 : 2}
                cursor={node.isCompleted && node.moduleId !== 'START_NODE' ? 'pointer' : 'default'}
                onMouseEnter={() => node.isCompleted && setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={() => node.isCompleted && handleNodeClick(node.moduleId)}
                style={{
                    transition: 'r 0.2s ease, fill 0.2s ease, stroke 0.2s ease, filter 0.2s ease',
                    filter: (node.isCurrent || (isHovered && node.isCompleted)) ? 'url(#glow-filter)' : 'none',
                    animation: (node.isCurrent || (isHovered && node.isCompleted)) ? `pulse-node 1.5s infinite ease-in-out` : 'none'
                }}
              />

              {isHovered && node.isCompleted && (
                <g transform={`translate(${node.x}, ${node.y - NODE_RADIUS * 2 - 5})`}>
                  <rect
                    x="-50" 
                    y="-25" 
                    width="100" 
                    height="20" 
                    rx="3" 
                    fill="rgba(0,0,0,0.7)" 
                    stroke={activeColorActual}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="-15"
                    textAnchor="middle"
                    fill={TEXT_COLOR}
                    fontSize="10px"
                    fontFamily="Roboto Mono, monospace"
                  >
                    {node.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default FractalTimeline;