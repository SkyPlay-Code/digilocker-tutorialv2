
import React, { useState, useCallback, useRef, useEffect } from 'react';
import HeroSection from './components/HeroSection';
import CalibrationSequence from './components/CalibrationSequence';
import DataStreamMap3D from './components/DataStreamMap3D'; // Updated import
import ShareSection from './components/ShareSection';
import ArchivesSection from './components/ArchivesSection';
import Footer from './components/Footer';
import { AppView, CalibrationModule } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.Hero);
  const [calibrationStartModule, setCalibrationStartModule] = useState<CalibrationModule | undefined>(undefined);
  
  const [isTransitioningToCalibration, setIsTransitioningToCalibration] = useState(false);
  const [showTransitionFlash, setShowTransitionFlash] = useState(false);

  const dataStreamMapRef = useRef<HTMLElement>(null);
  const archivesRef = useRef<HTMLElement>(null); 

  const handleInitiateCalibration = useCallback(() => {
    console.log("Initiate calibration triggered");
    setCalibrationStartModule(undefined); 
    setIsTransitioningToCalibration(true);

    // Timing for the "Light Speed" transition (total 1.5s)
    // T=1.2s: Start flash
    setTimeout(() => {
      console.log("Transition: Breach flash starts");
      setShowTransitionFlash(true);
    }, 1200);

    // T=1.2s + 0.1s (flash duration) = 1.3s: End flash
    setTimeout(() => {
      console.log("Transition: Breach flash ends");
      setShowTransitionFlash(false);
    }, 1300);
    
    // T=1.5s: End transition, switch view
    setTimeout(() => {
      console.log("Transition: Complete, switching to Calibration view");
      setCurrentView(AppView.Calibration);
      setIsTransitioningToCalibration(false);
      window.scrollTo(0,0); 
    }, 1500);

  }, []);

  const handleCloseCalibration = useCallback(() => {
    setCurrentView(AppView.Hero); 
  }, []);

  const handleMapDataStream = useCallback(() => {
    if (dataStreamMapRef.current) {
      dataStreamMapRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleJumpToSimulation = useCallback((module: CalibrationModule) => {
    setCalibrationStartModule(module);
    setCurrentView(AppView.Calibration);
    window.scrollTo(0,0);
  }, []);
  
  useEffect(() => {
    if(currentView === AppView.Hero) {
       // Potentially reset scroll or other states if needed
    }
  }, [currentView]);


  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen font-orbitron">
      {currentView === AppView.Calibration && (
        <CalibrationSequence 
            onClose={handleCloseCalibration} 
            jumpToModule={calibrationStartModule}
        />
      )}

      {showTransitionFlash && (
        <div className="fixed inset-0 bg-white z-[1000] animate-screen-flash-white pointer-events-none"></div>
      )}

      {/* Main page content, conditionally rendered or always present and scrolled to */}
      {/* Hero section is always mounted to handle its transition animation even when view changes */}
      <div className={currentView === AppView.Calibration && !isTransitioningToCalibration ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100 transition-opacity duration-500'}>
        <HeroSection 
          onInitiateCalibration={handleInitiateCalibration}
          onMapDataStream={handleMapDataStream}
          isTransitioning={isTransitioningToCalibration}
        />
        
        {/* Only render other sections if not in calibration and not transitioning away from hero */}
        {currentView === AppView.Hero && !isTransitioningToCalibration && (
          <>
            <section ref={dataStreamMapRef} id="data-stream-map" className="min-h-screen bg-black relative"> {/* Ensure section has height for 3D map */}
                <DataStreamMap3D onJumpToSimulation={handleJumpToSimulation} />
            </section>
            
            <ShareSection />
            
            <section ref={archivesRef}>
                <ArchivesSection />
            </section>
            
            <Footer />
          </>
        )}
      </div>
    </div>
  );
};

export default App;