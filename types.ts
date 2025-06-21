
import * as THREE from 'three';

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

export interface KeyPoint { // Used by the old DataStreamMap and potentially other UI
  id: string;
  title: string;
  description: string;
  timestamp: string; // e.g., "0:07"
  moduleTarget?: CalibrationModule; 
}

export interface StreamNodeData { // For the new DataStreamMap3D
  id: string;
  title: string;
  moduleShortName: string; // For concise display on holo-panel
  description: string;
  position: THREE.Vector3;
  size: number;
  moduleTarget?: CalibrationModule;
  connectedTo?: string[]; // IDs of other nodes it's connected to by lines
  holovidId: string; // Identifier for which holovid animation to play
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
