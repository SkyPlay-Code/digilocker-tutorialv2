
import { KeyPoint, CalibrationModule } from './types';

export const APP_TITLE = "The Quantum Vault";

export const CALIBRATION_MODULES_TIMESTAMPS: { [key in CalibrationModule]?: string } = {
  [CalibrationModule.Authentication]: "0:07",
  [CalibrationModule.DocumentUpload]: "1:25",
  [CalibrationModule.PinEncryption]: "1:48",
};

export const KEY_POINTS_DATA: KeyPoint[] = [
  { 
    id: "auth", 
    title: "Identity Authentication", 
    description: "Verify your biometric signature to access the vault.", 
    timestamp: "0:07",
    moduleTarget: CalibrationModule.Authentication 
  },
  { 
    id: "docmat", 
    title: "Document Materialization", 
    description: "Upload and transform your files into secure data-constructs.", 
    timestamp: "1:25",
    moduleTarget: CalibrationModule.DocumentUpload
  },
  { 
    id: "pinencrypt", 
    title: "Quantum Pin Encryption", 
    description: "Set your unique 6-digit quantum entanglement key.", 
    timestamp: "1:48",
    moduleTarget: CalibrationModule.PinEncryption
  },
  {
    id: "overview",
    title: "Vault Overview",
    description: "Understand the core functionalities and secure nature of your Quantum Vault.",
    timestamp: "0:00 - 2:30" 
  },
];

export const RELATED_RESOURCES_DATA = [
  { id: "guide", title: "User Guide", icon: "📖", content: "Detailed instructions and walkthroughs for all Quantum Vault features. Learn about data-construct stability, quantum entanglement keys, and synaptic calibration protocols. Ensure you understand the responsibilities of managing your own pocket data-verse." },
  { id: "faq", title: "FAQ", icon: "❓", content: "Answers to frequently asked questions about The Quantum Vault. Topics include security protocols, data retrieval, multi-factor authentication, and aetherial data decay rates. If your query is not listed, please interface with a support chronometer." },
  { id: "app", title: "Mobile Synapse", icon: "📱", content: "Access your Quantum Vault on the go with our dedicated mobile interface. Full functionality, including biometric authentication and data-construct management, synchronized across all your calibrated devices. Requires Neural Link v3.0+." },
];

export const SOCIAL_PLATFORMS = [
  { id: "fb", name: "Sector FB", color: "bg-blue-600 hover:bg-blue-500", icon: "🌐" },
  { id: "tw", name: "TW-Band", color: "bg-sky-500 hover:bg-sky-400", icon: "📡" },
  { id: "ln", name: "Nexus LN", color: "bg-indigo-600 hover:bg-indigo-500", icon: "🔗" },
];

export const FOOTER_LINKS = [
  { name: "Privacy Protocol", href: "#privacy" },
  { name: "Terms of Entanglement", href: "#terms" },
  { name: "System Diagnostics", href: "#diag" },
];
    