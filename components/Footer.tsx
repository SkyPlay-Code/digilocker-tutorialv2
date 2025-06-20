import React, { useState, useEffect, useRef } from 'react';
import { FOOTER_LINKS } from '../constants';

const Footer: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        } else {
          // Optional: hide again if scrolled up significantly, or keep visible once seen
          // setIsVisible(false); 
        }
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.1, // When 10% of the footer is visible
      }
    );

    const currentRef = footerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  return (
    <footer ref={footerRef} className="relative py-12 md:py-20 bg-black font-orbitron text-center overflow-hidden">
      {/* Quantum Aether Background Particles */}
      {[...Array(30)].map((_, i) => (
        <div
          key={`footer-particle-${i}`}
          className="absolute rounded-full bg-purple-500/30 animate-pulse"
          style={{
            width: `${Math.random() * 2 + 1}px`,
            height: `${Math.random() * 2 + 1}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${Math.random() * 5 + 3}s`,
            opacity: isVisible ? Math.random() * 0.5 + 0.1 : 0,
            transition: 'opacity 2s ease-in-out'
          }}
        />
      ))}
      
      <div className="relative z-10 container mx-auto px-4">
        <div className="flex justify-center space-x-6 mb-8">
          {FOOTER_LINKS.map((link, index) => (
            <a
              key={link.name}
              href={link.href}
              className={`text-sm text-purple-400 hover:text-purple-200 transition-all duration-500 ease-in-out
                          hover:text-glow-magenta
                          ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
              style={{ transitionDelay: `${isVisible ? index * 200 : 0}ms` }}
            >
              {link.name}
            </a>
          ))}
        </div>
        <div className={`text-xs text-indigo-500 transition-opacity duration-[3s] ease-in-out
                       ${isVisible ? 'opacity-70' : 'opacity-0'}`}>
          <span className="glitch-copyright">© 2024 Quantum Dynamics Corp. All Rights Reserved.</span>
        </div>
        <p className={`mt-2 text-[10px] text-indigo-700 transition-opacity duration-[3s] ease-in-out delay-500 ${isVisible ? 'opacity-50' : 'opacity-0'}`}>
            SYSTEM TERMINUS // STANDBY MODE
        </p>
      </div>
    </footer>
  );
};

export default Footer;
