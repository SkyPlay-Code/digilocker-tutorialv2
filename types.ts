
export enum AppView {
  Hero,
  Calibration,
  DataMap, // If DataMap becomes a separate view rather than a scroll section
}

export enum CalibrationModule {
  Intro, // Not explicitly used as a UI state, but good for logic
  Authentication,
  DocumentUpload,
  PinEncryption,
  Completed,
}

export interface KeyPoint {
  id: string;
  title: string;
  description: string;
  timestamp: string; // e.g., "0:07"
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

export interface TimelineModuleConfig {
  id: CalibrationModule;
  label: string;
  progressAtStart: number;
}
