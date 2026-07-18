import type { CalibrationBaseline, RecordingQuality } from '@/types';

export interface FrameQuality {
  /** 该帧是否可用于后续特征分析 */
  valid: boolean;
  /** 该帧的信噪比（dB） */
  snrDb: number;
  /** 是否发生削波 */
  clipped: boolean;
  /** 是否低于有效人声阈值 */
  silent: boolean;
  /** 是否被判定为噪音主导 */
  noisy: boolean;
}

/** dB 转换：避免 log(0) */
export function toDb(rms: number): number {
  return 20 * Math.log10(Math.max(rms, 1e-10));
}

/** 基于校准基准计算单帧质量 */
export function assessFrame(
  rms: number,
  zcr: number,
  flatness: number,
  maxAmplitude: number,
  baseline: CalibrationBaseline
): FrameQuality {
  const signalDb = toDb(rms);
  const noiseDb = toDb(baseline.noiseRms);
  const snrDb = signalDb - noiseDb;

  // 静音阈值：比环境噪音高不到 5dB，或绝对能量过低（兼容低增益麦克风）
  const silent = snrDb < 5 || rms < 0.003;

  // 削波：任意采样点接近最大幅值（0.98）视为过载
  const clipped = maxAmplitude > 0.98;

  // 噪音判定：过零率/平坦度显著高于环境基准，且信噪比不高，则视为噪音/清辅音
  const zcrAnomaly = zcr > baseline.noiseZcr * 2.0 + 0.08;
  const flatnessAnomaly = flatness > baseline.noiseFlatness * 1.8 + 0.08;
  const noisy = snrDb < 8 && (zcrAnomaly || flatnessAnomaly);

  return {
    valid: !silent && !clipped && !noisy,
    snrDb,
    clipped,
    silent,
    noisy,
  };
}

export interface QualitySummaryInput {
  totalFrames: number;
  validFrames: number;
  clippingFrames: number;
  silentFrames: number;
  validSnrValues: number[];
  baseline: CalibrationBaseline;
}

/** 汇总整段录音质量 */
export function summarizeQuality(input: QualitySummaryInput): RecordingQuality {
  const { totalFrames, validFrames, clippingFrames, silentFrames, validSnrValues, baseline } = input;

  const clippingRatio = totalFrames > 0 ? clippingFrames / totalFrames : 0;
  const silentRatio = totalFrames > 0 ? silentFrames / totalFrames : 0;
  const validRatio = totalFrames > 0 ? validFrames / totalFrames : 0;
  const avgSnr = validSnrValues.length > 0
    ? validSnrValues.reduce((a, b) => a + b, 0) / validSnrValues.length
    : 0;

  const noiseLevelDb = toDb(baseline.noiseRms);

  const reasons: string[] = [];
  if (validRatio < 0.12) reasons.push('有效声音片段太少，请靠近麦克风并大声朗读');
  if (avgSnr < 5) reasons.push('环境噪音过大或声音太小，信噪比偏低');
  if (clippingRatio > 0.08) reasons.push('声音过大导致削波，请离麦克风稍远一些');
  if (silentRatio > 0.85) reasons.push('录音中静音片段过多，请确保完整朗读');

  const passed = reasons.length === 0;

  return {
    passed,
    noiseLevelDb,
    snr: avgSnr,
    clippingRatio,
    silentRatio,
    reason: passed ? '质量合格' : reasons.join('；'),
  };
}

/** 计算数组中位数 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
