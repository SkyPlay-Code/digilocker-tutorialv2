
import React, { useRef, useEffect, useCallback } from 'react';

interface GravityWellProps {
  onClick: () => void;
  isVisible: boolean;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  color: string;
  angle: number;
  angularVelocity: number;
  distanceToCenter: number;
  initialDistance: number;
  opacity: number;
  isStretching?: boolean;
  stretchLength?: number;
  stretchAngle?: number;
}

const GravityWell: React.FC<GravityWellProps> = ({ onClick, isVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);

  const MAX_PARTICLES = 150;
  const VORTEX_RADIUS = 35; // Outer radius of particle generation
  const SINGULARITY_RADIUS = 3; // Where particles get "consumed"
  const CANVAS_SIZE = 100; // Keep canvas somewhat larger than vortex

  const generateParticle = useCallback((canvasWidth: number, canvasHeight: number): Particle => {
    const angle = Math.random() * Math.PI * 2;
    const distanceToCenter = VORTEX_RADIUS + Math.random() * 5; // Start just at/outside the edge
    return {
      x: canvasWidth / 2 + distanceToCenter * Math.cos(angle),
      y: canvasHeight / 2 + distanceToCenter * Math.sin(angle),
      radius: Math.random() * 1 + 0.5,
      color: Math.random() > 0.3 ? 'rgba(0, 255, 255, 0.8)' : 'rgba(200, 200, 255, 0.7)', // Cyan and whiteish
      angle: angle,
      angularVelocity: (0.01 + Math.random() * 0.01) * (Math.random() < 0.5 ? 1 : -1), // Random direction
      distanceToCenter: distanceToCenter,
      initialDistance: distanceToCenter,
      opacity: 0, // Fade in
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particlesRef.current.forEach((p, index) => {
      ctx.beginPath();
      if (p.isStretching && p.stretchLength) {
        const endX = p.x + p.stretchLength * Math.cos(p.stretchAngle || p.angle);
        const endY = p.y + p.stretchLength * Math.sin(p.stretchAngle || p.angle);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = p.color.replace(/[^,]+(?=\))/, `${p.opacity * 0.8}`); // Adjust opacity for stroke
        ctx.lineWidth = p.radius * 0.8; // Thinner line for stretch
        ctx.stroke();
      } else {
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(/[^,]+(?=\))/, `${p.opacity}`); // Adjust opacity for fill
        ctx.fill();
      }
    });
  }, []);

  const updateParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    particlesRef.current = particlesRef.current.map(p => {
      // Fade in
      if (p.opacity < 1) {
        p.opacity = Math.min(1, p.opacity + 0.05);
      }

      // Orbital mechanics
      p.angle += p.angularVelocity;
      
      // Pull towards center & increase angular velocity
      const pullFactor = Math.max(0.01, (p.initialDistance - p.distanceToCenter) / p.initialDistance); // Stronger pull as it gets closer from start
      p.distanceToCenter -= (0.05 + pullFactor * 0.2); // Base inward speed + accelerated pull

      // Increase angular velocity based on inverse square of distance (simplified)
      const distRatio = Math.max(0.1, p.distanceToCenter / VORTEX_RADIUS);
      p.angularVelocity = Math.sign(p.angularVelocity) * (0.01 + 0.03 / (distRatio * distRatio));
      
      p.x = centerX + p.distanceToCenter * Math.cos(p.angle);
      p.y = centerY + p.distanceToCenter * Math.sin(p.angle);

      // Stretching and consumption
      if (p.distanceToCenter < SINGULARITY_RADIUS + 5 && !p.isStretching) {
        p.isStretching = true;
        p.stretchLength = p.radius * (3 + Math.random() * 3); // Stretch effect
        // Calculate direction towards center for stretch
        p.stretchAngle = Math.atan2(centerY - p.y, centerX - p.x);

      }
      if (p.isStretching) {
         p.radius = Math.max(0.1, p.radius * 0.95); // Shrink while stretching
         p.stretchLength = Math.max(1, (p.stretchLength || 0) * 0.9);
      }


      if (p.distanceToCenter <= SINGULARITY_RADIUS) {
        return null; // Mark for removal
      }
      return p;
    }).filter(p => p !== null) as Particle[];

    // Replenish particles
    while (particlesRef.current.length < MAX_PARTICLES && Math.random() < 0.2) {
      particlesRef.current.push(generateParticle(canvas.width, canvas.height));
    }
  }, [generateParticle]);

  const animate = useCallback(() => {
    if (!isVisible) {
        // Clear particles when not visible to reset state when it becomes visible again
        if (particlesRef.current.length > 0) {
            particlesRef.current = [];
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        return;
    }
    updateParticles();
    draw();
    animationFrameIdRef.current = requestAnimationFrame(animate);
  }, [draw, updateParticles, isVisible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Set canvas size (could be dynamic based on parent or fixed)
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
    }
    // Initialize some particles if visible
    if (isVisible && particlesRef.current.length === 0) {
        for(let i=0; i< MAX_PARTICLES / 2; i++) { // Start with some particles
            particlesRef.current.push(generateParticle(CANVAS_SIZE, CANVAS_SIZE));
        }
    }

    if (isVisible) {
        animate();
    } else {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
         // Clear canvas when not visible
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [animate, isVisible, generateParticle]);

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 transition-all duration-500 ease-in-out z-20 group`}
      style={{
        bottom: isVisible ? '3vh' : '-15vh', // Slide in from bottom
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      <div
        onClick={onClick}
        className="relative w-[70px] h-[70px] cursor-pointer flex items-center justify-center"
        title="Scroll to next section"
        aria-label="Scroll to next section"
      >
        {/* Singularity CSS Effect (Behind Canvas) */}
        <div 
          className="absolute w-[10px] h-[10px] rounded-full bg-black "
          style={{ 
            boxShadow: `0 0 0 1px rgba(0,200,200,0.2), 
                        0 0 0 2px rgba(0,0,0,0.8), 
                        0 0 5px 3px rgba(0,50,70,0.3),
                        inset 0 0 2px 1px rgba(0,0,0,1)`,
            filter: 'blur(0.5px)', // Subtle pinch/distortion
          }}
        />
        <canvas ref={canvasRef} className="w-full h-full opacity-90 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};

export default GravityWell;
