
import React, { useState, useCallback, useRef, useEffect } from 'react';
import HeroSection from './components/HeroSection';
import CalibrationSequence from './components/CalibrationSequence';
import DataStreamMap3D from './components/DataStreamMap3D'; // Updated import
import ShareSection from './components/ShareSection';
import ArchivesSection from './components/ArchivesSection';
import Footer from './components/Footer';
import SignalLostScreen from './components/SignalLostScreen'; // New import
import { AppView, CalibrationModule } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.Hero);
  const [calibrationStartModule, setCalibrationStartModule] = useState<CalibrationModule | undefined>(undefined);
  
  const [isTransitioningToCalibration, setIsTransitioningToCalibration] = useState(false);
  const [showTransitionFlash, setShowTransitionFlash] = useState(false);
  const [signalLostDismissed, setSignalLostDismissed] = useState(false); // New state

  const dataStreamMapRef = useRef<HTMLElement>(null);
  const archivesRef = useRef<HTMLElement>(null); 

  const handleInitiateCalibration = useCallback(() => {
    console.log("Initiate calibration triggered");
    setCalibrationStartModule(undefined); 
    setIsTransitioningToCalibration(true);

    setTimeout(() => setShowTransitionFlash(true), 1200);
    setTimeout(() => setShowTransitionFlash(false), 1300);
    
    setTimeout(() => {
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

  const handleAccessArchive = useCallback(() => {
    setSignalLostDismissed(true);
  }, []);
  
  useEffect(() => {
    if(currentView === AppView.Hero && signalLostDismissed) {
       // Potentially reset scroll or other states if needed when returning to Hero
    }
  }, [currentView, signalLostDismissed]);


  if (!signalLostDismissed) {
    return <SignalLostScreen onAccessArchive={handleAccessArchive} />;
  }

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

      <div className={currentView === AppView.Calibration && !isTransitioningToCalibration ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100 transition-opacity duration-500'}>
        <HeroSection 
          onInitiateCalibration={handleInitiateCalibration}
          onMapDataStream={handleMapDataStream}
          isTransitioning={isTransitioningToCalibration}
        />
        
        {currentView === AppView.Hero && !isTransitioningToCalibration && (
          <>
            <section ref={dataStreamMapRef} id="data-stream-map" className="min-h-screen bg-black relative">
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