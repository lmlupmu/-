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
  /** Meyda 提取的 13 维 MFCC 均值 */
  mfcc: number[];
  /** 频谱滚降点，反映高频能量占比 */
  spectralRolloff: number;
  /** 相邻帧频谱变化量，反映发音清晰度/动态 */
  spectralFlux: number;
  /** 频谱平坦度，接近 1 表示噪音，接近 0 表示谐波丰富 */
  spectralFlatness: number;
  /** 频谱展宽，反映音色明暗 */
  spectralSpread: number;
  /** 频谱峰值，反映共振峰集中度 */
  spectralCrest: number;
  /** 过零率，反映信号噪声/清辅音程度 */
  zcr: number;
  /** 基于校准基准的信噪比（dB） */
  snr: number;
}

export interface RecordingQuality {
  passed: boolean;
  /** 估计的环境噪音水平（dB，相对值） */
  noiseLevelDb: number;
  /** 录音平均信噪比（dB） */
  snr: number;
  /** 削波/过载帧占比 0-1 */
  clippingRatio: number;
  /** 静音/过低帧占比 0-1 */
  silentRatio: number;
  /** 质量不达标的主要 human-readable 原因 */
  reason: string;
}

export interface CalibrationBaseline {
  /** 环境噪音 RMS */
  noiseRms: number;
  /** 环境噪音频谱质心 */
  noiseCentroid: number;
  /** 环境噪音过零率 */
  noiseZcr: number;
  /** 环境噪音频谱平坦度 */
  noiseFlatness: number;
  /** 校准时间戳 */
  calibratedAt: number;
}

export interface AnalysisResult {
  voiceType: VoiceType;
  features: AudioFeatures;
  recordingDuration: number;
  quality: RecordingQuality;
}
