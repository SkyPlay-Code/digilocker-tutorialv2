
import React, { useState, useCallback, useRef, useEffect } from 'react';
import HeroSection from './components/HeroSection';
import CalibrationSequence from './components/CalibrationSequence';
import DataStreamMap from './components/DataStreamMap';
import ShareSection from './components/ShareSection';
import ArchivesSection from './components/ArchivesSection';
import Footer from './components/Footer';
import DataCoreEnvironment from './components/DataCoreEnvironment'; // New Import
import { AppView, CalibrationModule } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.Hero);
  const [calibrationStartModule, setCalibrationStartModule] = useState<CalibrationModule | undefined>(undefined);

  const dataStreamMapRef = useRef<HTMLElement>(null);
  const archivesRef = useRef<HTMLElement>(null);

  const handleInitiateCalibration = useCallback(() => {
    // This will now be handled by HeroSection triggering onTransitionToDataCoreComplete
    // For now, let HeroSection manage its internal transition state.
    // setCurrentView might be set by onTransitionToDataCoreComplete
    // If you still need the old calibration:
    // setCalibrationStartModule(undefined); 
    // setCurrentView(AppView.Calibration);
    // window.scrollTo(0,0); 
  }, []);
  
  const handleTransitionToDataCoreComplete = useCallback(() => {
    setCurrentView(AppView.DataCoreEnvironment);
    window.scrollTo(0,0);
  }, []);

  const handleCloseCalibration = useCallback(() => {
    setCurrentView(AppView.Hero); 
  }, []);

  // This is for the OLD CalibrationSequence. The new environment has its own video.
  const handleCloseDataCoreEnvironment = useCallback(() => {
    setCurrentView(AppView.Hero);
  }, []);


  const handleMapDataStream = useCallback(() => {
    if (dataStreamMapRef.current) {
      dataStreamMapRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleJumpToSimulation = useCallback((module: CalibrationModule) => {
    setCalibrationStartModule(module);
    setCurrentView(AppView.Calibration); // This still points to the old form-based calibration
    window.scrollTo(0,0);
  }, []);
  
  useEffect(() => {
    if(currentView === AppView.Hero) {
       // Reset scroll or other states if needed
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

      {currentView === AppView.DataCoreEnvironment && (
        <DataCoreEnvironment onClose={handleCloseDataCoreEnvironment} />
      )}
      
      <div 
        className={
          currentView === AppView.Calibration || currentView === AppView.DataCoreEnvironment 
          ? 'opacity-0 pointer-events-none h-0 overflow-hidden' 
          : 'opacity-100 transition-opacity duration-500'
        }
      >
        <HeroSection 
          onInitiateCalibration={handleInitiateCalibration} // Orb click will now start internal transition
          onTransitionToDataCoreComplete={handleTransitionToDataCoreComplete} // New prop
          onMapDataStream={handleMapDataStream}
        />
        
        <section ref={dataStreamMapRef}>
            <DataStreamMap onJumpToSimulation={handleJumpToSimulation} />
        </section>
        
        <ShareSection />
        
        <section ref={archivesRef}>
            <ArchivesSection />
        </section>
        
        <Footer />
      </div>
    </div>
  );
};

export default App;