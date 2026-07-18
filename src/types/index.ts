export type Gender = 'male' | 'female';

export interface VoiceType {
  id: string;
  label: string;
  gender: Gender;
  rarity: number;
  features: string;
  reason: string;
  musicStyles: string[];
  tags: string[];
}

export interface Poem {
  id: string;
  title: string;
  author: string;
  content: string[];
}

export interface AudioFeatures {
  averagePitch: number;
  pitchVariance: number;
  speakingRate: number;
  energy: number;
  spectralCentroid: number;
  harmonicComplexity: number;
  jitter: number;
}

export interface AnalysisResult {
  voiceType: VoiceType;
  features: AudioFeatures;
  recordingDuration: number;
}
