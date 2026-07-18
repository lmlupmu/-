import type { AudioFeatures, Gender, VoiceType } from '@/types';
import { maleVoiceTypes, femaleVoiceTypes } from '@/data/voiceTypes';

interface VoiceProfile {
  voiceType: VoiceType;
  /** 目标基频 (Hz) */
  pitch: number;
  /** 目标能量 (0-1) */
  energy: number;
  /** 目标频谱质心 (Hz) */
  centroid: number;
  /** 目标谐波复杂度 (0-1) */
  complexity: number;
  /** 目标语速 (字/s) */
  rate: number;
  /** 目标基频抖动 */
  jitter: number;
  /** 目标频谱平坦度 */
  flatness: number;
  /** 目标过零率 */
  zcr: number;
}

interface MatchScore {
  voiceType: VoiceType;
  score: number;
  details: Record<string, number>;
}

/** 各维度权重，总和为 1 */
const WEIGHTS = {
  pitch: 0.28,
  energy: 0.14,
  centroid: 0.14,
  complexity: 0.16,
  rate: 0.10,
  jitter: 0.08,
  flatness: 0.05,
  zcr: 0.05,
};

/** 各维度容差 */
const TOLERANCES = {
  pitch: 35,
  energy: 0.18,
  centroid: 350,
  complexity: 0.18,
  rate: 0.5,
  jitter: 0.12,
  flatness: 0.12,
  zcr: 0.04,
};

/** 计算单维度得分：在目标值容差范围内线性衰减 */
function featureScore(value: number, target: number, tolerance: number): number {
  const distance = Math.abs(value - target) / tolerance;
  return Math.max(0, 1 - Math.min(distance, 1));
}

function createProfile(voiceType: VoiceType, overrides: Partial<Omit<VoiceProfile, 'voiceType'>>): VoiceProfile {
  return {
    voiceType,
    pitch: 150,
    energy: 0.45,
    centroid: 1800,
    complexity: 0.30,
    rate: 2.0,
    jitter: 0.10,
    flatness: 0.20,
    zcr: 0.07,
    ...overrides,
  };
}

const maleProfiles: VoiceProfile[] = [
  createProfile(maleVoiceTypes[0], {
    pitch: 95, energy: 0.65, centroid: 1400, complexity: 0.55, rate: 1.8, jitter: 0.15, flatness: 0.25, zcr: 0.08,
  }),
  createProfile(maleVoiceTypes[1], {
    pitch: 130, energy: 0.45, centroid: 1700, complexity: 0.30, rate: 2.0, jitter: 0.10, flatness: 0.20, zcr: 0.07,
  }),
  createProfile(maleVoiceTypes[2], {
    pitch: 180, energy: 0.45, centroid: 2200, complexity: 0.25, rate: 2.4, jitter: 0.10, flatness: 0.18, zcr: 0.08,
  }),
  createProfile(maleVoiceTypes[3], {
    pitch: 125, energy: 0.50, centroid: 2000, complexity: 0.60, rate: 1.9, jitter: 0.35, flatness: 0.35, zcr: 0.10,
  }),
  createProfile(maleVoiceTypes[4], {
    pitch: 110, energy: 0.40, centroid: 1500, complexity: 0.28, rate: 1.5, jitter: 0.08, flatness: 0.22, zcr: 0.06,
  }),
  createProfile(maleVoiceTypes[5], {
    pitch: 160, energy: 0.50, centroid: 2100, complexity: 0.32, rate: 2.2, jitter: 0.10, flatness: 0.20, zcr: 0.07,
  }),
  createProfile(maleVoiceTypes[6], {
    pitch: 220, energy: 0.30, centroid: 2400, complexity: 0.20, rate: 2.3, jitter: 0.12, flatness: 0.15, zcr: 0.09,
  }),
  createProfile(maleVoiceTypes[7], {
    pitch: 115, energy: 0.40, centroid: 1600, complexity: 0.45, rate: 1.7, jitter: 0.40, flatness: 0.30, zcr: 0.08,
  }),
];

const femaleProfiles: VoiceProfile[] = [
  createProfile(femaleVoiceTypes[0], {
    pitch: 280, energy: 0.45, centroid: 2300, complexity: 0.22, rate: 2.4, jitter: 0.10, flatness: 0.18, zcr: 0.08,
  }),
  createProfile(femaleVoiceTypes[1], {
    pitch: 240, energy: 0.55, centroid: 2200, complexity: 0.25, rate: 2.2, jitter: 0.08, flatness: 0.17, zcr: 0.07,
  }),
  createProfile(femaleVoiceTypes[2], {
    pitch: 210, energy: 0.35, centroid: 1800, complexity: 0.22, rate: 1.7, jitter: 0.08, flatness: 0.18, zcr: 0.06,
  }),
  createProfile(femaleVoiceTypes[3], {
    pitch: 180, energy: 0.50, centroid: 2000, complexity: 0.58, rate: 1.8, jitter: 0.32, flatness: 0.35, zcr: 0.10,
  }),
  createProfile(femaleVoiceTypes[4], {
    pitch: 340, energy: 0.30, centroid: 2600, complexity: 0.18, rate: 2.5, jitter: 0.10, flatness: 0.14, zcr: 0.09,
  }),
  createProfile(femaleVoiceTypes[5], {
    pitch: 260, energy: 0.30, centroid: 2500, complexity: 0.20, rate: 1.6, jitter: 0.12, flatness: 0.16, zcr: 0.07,
  }),
  createProfile(femaleVoiceTypes[6], {
    pitch: 190, energy: 0.60, centroid: 1700, complexity: 0.35, rate: 2.0, jitter: 0.10, flatness: 0.22, zcr: 0.07,
  }),
  createProfile(femaleVoiceTypes[7], {
    pitch: 250, energy: 0.35, centroid: 1900, complexity: 0.24, rate: 1.8, jitter: 0.09, flatness: 0.19, zcr: 0.07,
  }),
];

function scoreProfile(features: AudioFeatures, profile: VoiceProfile): MatchScore {
  const details = {
    pitch: featureScore(features.averagePitch, profile.pitch, TOLERANCES.pitch),
    energy: featureScore(features.energy, profile.energy, TOLERANCES.energy),
    centroid: featureScore(features.spectralCentroid, profile.centroid, TOLERANCES.centroid),
    complexity: featureScore(features.harmonicComplexity, profile.complexity, TOLERANCES.complexity),
    rate: featureScore(features.speakingRate, profile.rate, TOLERANCES.rate),
    jitter: featureScore(features.jitter, profile.jitter, TOLERANCES.jitter),
    flatness: featureScore(features.spectralFlatness, profile.flatness, TOLERANCES.flatness),
    zcr: featureScore(features.zcr, profile.zcr, TOLERANCES.zcr),
  };

  const score =
    details.pitch * WEIGHTS.pitch +
    details.energy * WEIGHTS.energy +
    details.centroid * WEIGHTS.centroid +
    details.complexity * WEIGHTS.complexity +
    details.rate * WEIGHTS.rate +
    details.jitter * WEIGHTS.jitter +
    details.flatness * WEIGHTS.flatness +
    details.zcr * WEIGHTS.zcr;

  return { voiceType: profile.voiceType, score, details };
}

export function matchVoiceType(features: AudioFeatures, gender: Gender): VoiceType {
  const profiles = gender === 'male' ? maleProfiles : femaleProfiles;
  const scores = profiles.map((profile) => scoreProfile(features, profile));

  scores.sort((a, b) => b.score - a.score);

  // 调试输出：保留最高分配音色的详细得分
  const best = scores[0];
  if (import.meta.env.DEV) {
    console.debug('[voiceMatcher] best match:', best.voiceType.label, best.score.toFixed(3), best.details);
  }

  return best.voiceType;
}
