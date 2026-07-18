import { create } from 'zustand';
import type { Gender, AnalysisResult } from '@/types';

interface VoiceState {
  gender: Gender | null;
  result: AnalysisResult | null;
  setGender: (gender: Gender) => void;
  setResult: (result: AnalysisResult) => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  gender: null,
  result: null,
  setGender: (gender) => set({ gender }),
  setResult: (result) => set({ result }),
  reset: () => set({ gender: null, result: null }),
}));
