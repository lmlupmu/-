import type { AudioFeatures, Gender, VoiceType } from '@/types';
import { maleVoiceTypes, femaleVoiceTypes } from '@/data/voiceTypes';

interface MatchScore {
  voiceType: VoiceType;
  score: number;
}

export function matchVoiceType(features: AudioFeatures, gender: Gender): VoiceType {
  const candidates = gender === 'male' ? maleVoiceTypes : femaleVoiceTypes;
  const scores: MatchScore[] = candidates.map((voiceType) => {
    let score = 0;

    score += pitchScore(features.averagePitch, voiceType, gender);
    score += energyScore(features.energy, features.spectralCentroid, voiceType);
    score += complexityScore(features.harmonicComplexity, voiceType);
    score += rateScore(features.speakingRate, voiceType);
    score += jitterScore(features.jitter, voiceType);

    return { voiceType, score };
  });

  scores.sort((a, b) => b.score - a.score);
  return scores[0].voiceType;
}

function pitchScore(pitch: number, voiceType: VoiceType, gender: Gender): number {
  const basePitch = gender === 'male' ? 130 : 220;
  const lowThreshold = basePitch * 0.8;
  const highThreshold = basePitch * 1.3;

  const isLow = pitch < lowThreshold;
  const isMid = pitch >= lowThreshold && pitch <= highThreshold;
  const isHigh = pitch > highThreshold;

  const lowKeywords = ['低音炮', '大叔', '烟嗓', '女王'];
  const midKeywords = ['中音', '温润', '暖男', '知性', '御姐'];
  const highKeywords = ['少年', '奶音', '少女', '萝莉', '仙气'];

  if (isLow && lowKeywords.some((k) => voiceType.label.includes(k))) return 3;
  if (isMid && midKeywords.some((k) => voiceType.label.includes(k))) return 3;
  if (isHigh && highKeywords.some((k) => voiceType.label.includes(k))) return 3;

  return 0;
}

function energyScore(energy: number, centroid: number, voiceType: VoiceType): number {
  const heavyKeywords = ['低音炮', '大叔', '女王', '烟嗓'];
  const brightKeywords = ['清亮', '少年', '少女', '阳光', '萝莉', '仙气'];

  const isHeavy = energy > 0.4 && centroid < 1800;
  const isBright = energy < 0.4 || centroid > 2200;

  if (isHeavy && heavyKeywords.some((k) => voiceType.label.includes(k))) return 2;
  if (isBright && brightKeywords.some((k) => voiceType.label.includes(k))) return 2;

  return 0;
}

function complexityScore(complexity: number, voiceType: VoiceType): number {
  const roughKeywords = ['烟嗓', '气泡音'];
  const pureKeywords = ['温润', '清亮', '少女', '少年', '仙气'];

  const isRough = complexity > 0.45;
  const isPure = complexity < 0.35;

  if (isRough && roughKeywords.some((k) => voiceType.label.includes(k))) return 2;
  if (isPure && pureKeywords.some((k) => voiceType.label.includes(k))) return 1.5;

  return 0;
}

function rateScore(rate: number, voiceType: VoiceType): number {
  const fastKeywords = ['少年', '少女', '清亮', '活力'];
  const slowKeywords = ['大叔', '知性', '温柔', '仙气'];

  const isFast = rate > 2.5;
  const isSlow = rate < 1.8;

  if (isFast && fastKeywords.some((k) => voiceType.label.includes(k))) return 1;
  if (isSlow && slowKeywords.some((k) => voiceType.label.includes(k))) return 1;

  return 0;
}

function jitterScore(jitter: number, voiceType: VoiceType): number {
  const bubbleKeywords = ['气泡音', '烟嗓'];
  if (jitter > 0.3 && bubbleKeywords.some((k) => voiceType.label.includes(k))) return 1;
  return 0;
}
