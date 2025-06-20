
import React, { useState, useCallback, useRef, useEffect } from 'react';
import HeroSection from './components/HeroSection';
import CalibrationSequence from './components/CalibrationSequence';
import DataStreamMap from './components/DataStreamMap';
import ShareSection from './components/ShareSection';
import ArchivesSection from './components/ArchivesSection';
import Footer from './components/Footer';
import { AppView, CalibrationModule } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.Hero);
  // For CalibrationSequence, jumpToModule is used when navigating from DataStreamMap
  const [calibrationStartModule, setCalibrationStartModule] = useState<CalibrationModule | undefined>(undefined);

  const dataStreamMapRef = useRef<HTMLElement>(null);
  const archivesRef = useRef<HTMLElement>(null); // Example if direct scroll needed

  const handleInitiateCalibration = useCallback(() => {
    setCalibrationStartModule(undefined); // Start from the beginning
    setCurrentView(AppView.Calibration);
    window.scrollTo(0,0); // Scroll to top for calibration view
  }, []);

  const handleCloseCalibration = useCallback(() => {
    setCurrentView(AppView.Hero); // Or to a different section if preferred
  }, []);

  const handleMapDataStream = useCallback(() => {
    // Scrolls to the DataStreamMap section if it's part of the main page flow
    // If DataStreamMap is a separate view, this would change setCurrentView
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
    // If returning from calibration, ensure Hero is the default view if not otherwise specified
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

      {/* Main page content, conditionally rendered or always present and scrolled to */}
      <div className={currentView === AppView.Calibration ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100 transition-opacity duration-500'}>
        <HeroSection 
          onInitiateCalibration={handleInitiateCalibration}
          onMapDataStream={handleMapDataStream}
        />
        
        {/* Wrap sections that need refs for scrolling */}
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
    