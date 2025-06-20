
export enum AppView {
  Hero,
  Calibration, // Existing step-by-step calibration form
  DataMap, 
  DataCoreEnvironment, // New environment for video tutorial after Orb transition
}

export enum CalibrationModule {
  Intro, 
  Authentication,
  DocumentUpload,
  PinEncryption,
  Completed,
}

export interface KeyPoint {
  id: string;
  title: string;
  description: string;
  timestamp: string; 
  moduleTarget?: CalibrationModule; 
}

export interface ParticleStyle {
  left: string;
  top: string;
  animationDuration: string;
  animationDelay: string;
  size: string;
  opacity: number;
}