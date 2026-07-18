import type { AudioFeatures, CalibrationBaseline, RecordingQuality } from '@/types';
import Meyda from 'meyda';
import { assessFrame, median, summarizeQuality } from './audioQuality';

export function createAudioContext(): AudioContext {
  return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
}

export function estimatePitch(timeDomainData: Float32Array, sampleRate: number): number {
  const n = timeDomainData.length;
  let maxSum = 0;
  let bestLag = 0;
  const minLag = Math.floor(sampleRate / 500);
  const maxLag = Math.floor(sampleRate / 60);

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) {
      sum += timeDomainData[i] * timeDomainData[i + lag];
    }
    if (sum > maxSum) {
      maxSum = sum;
      bestLag = lag;
    }
  }

  return bestLag > 0 ? sampleRate / bestLag : 0;
}

export function calculateHarmonicComplexity(frequencyData: Uint8Array, sampleRate: number): number {
  let totalEnergy = 0;
  let highFreqEnergy = 0;
  const binSize = sampleRate / 2 / frequencyData.length;

  for (let i = 0; i < frequencyData.length; i++) {
    const energy = frequencyData[i] * frequencyData[i];
    totalEnergy += energy;
    if (i * binSize > 2000) {
      highFreqEnergy += energy;
    }
  }

  return totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0;
}

export function calculateJitter(pitches: number[]): number {
  if (pitches.length < 2) return 0;
  let jitterSum = 0;
  for (let i = 1; i < pitches.length; i++) {
    jitterSum += Math.abs(pitches[i] - pitches[i - 1]);
  }
  return jitterSum / (pitches.length - 1);
}

/** 对每一维特征分别求平均 */
function averageMfcc(mfccFrames: number[][]): number[] {
  if (mfccFrames.length === 0) return new Array(13).fill(0);
  const dim = mfccFrames[0].length || 13;
  const sums = new Array(dim).fill(0);
  for (const frame of mfccFrames) {
    for (let i = 0; i < dim; i++) {
      sums[i] += frame[i] ?? 0;
    }
  }
  return sums.map((s) => s / mfccFrames.length);
}

export class AudioAnalyzer {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private source: MediaStreamAudioSourceNode | null = null;

  private timeDomainData: Float32Array;
  private frequencyData: Uint8Array;
  private previousTimeDomainData: Float32Array | null = null;

  private baseline: CalibrationBaseline | null = null;
  private calibrationRms: number[] = [];
  private calibrationCentroid: number[] = [];
  private calibrationZcr: number[] = [];
  private calibrationFlatness: number[] = [];

  private pitchSamples: number[] = [];
  private energySamples: number[] = [];
  private centroidSamples: number[] = [];
  private complexitySamples: number[] = [];
  private rolloffSamples: number[] = [];
  private fluxSamples: number[] = [];
  private flatnessSamples: number[] = [];
  private spreadSamples: number[] = [];
  private crestSamples: number[] = [];
  private zcrSamples: number[] = [];
  private mfccFrames: number[][] = [];
  private snrSamples: number[] = [];
  private validSnrSamples: number[] = [];

  private totalFrames = 0;
  private validFrames = 0;
  private clippingFrames = 0;
  private silentFrames = 0;

  private currentEnergy = 0;
  private currentSnr = 0;

  private calibrationFrameCount = 0;

  private readonly VALID_SAMPLE_MIN = 8;
  private readonly CALIBRATION_FRAMES = 30; // 30 * 50ms ≈ 1.5s

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.6;

    Meyda.bufferSize = this.analyser.fftSize;
    Meyda.sampleRate = audioContext.sampleRate;
    Meyda.numberOfMFCCCoefficients = 13;
    Meyda.windowingFunction = 'hanning';

    this.timeDomainData = new Float32Array(this.analyser.fftSize);
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
  }

  connect(stream: MediaStream): void {
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
  }

  disconnect(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
  }

  /** 重新校准时清空之前的校准数据 */
  resetCalibration(): void {
    this.calibrationRms = [];
    this.calibrationZcr = [];
    this.calibrationCentroid = [];
    this.calibrationFlatness = [];
    this.calibrationFrameCount = 0;
    this.baseline = null;
  }

  /** 采集一帧环境噪音样本，返回是否已采集足够 */
  collectCalibrationSample(): boolean {
    this.analyser.getFloatTimeDomainData(this.timeDomainData);
    this.analyser.getByteFrequencyData(this.frequencyData);

    const features = Meyda.extract(
      ['rms', 'zcr', 'spectralCentroid', 'spectralFlatness'],
      this.timeDomainData
    );

    this.calibrationRms.push(features?.rms ?? calculateRMS(this.timeDomainData));
    this.calibrationZcr.push(features?.zcr ?? 0);
    this.calibrationCentroid.push(features?.spectralCentroid ?? 0);
    this.calibrationFlatness.push(features?.spectralFlatness ?? 0);
    this.calibrationFrameCount += 1;

    return this.calibrationRms.length >= this.CALIBRATION_FRAMES;
  }

  /** 结束校准并生成基准 */
  finishCalibration(): CalibrationBaseline {
    const baseline: CalibrationBaseline = {
      noiseRms: Math.max(median(this.calibrationRms), 1e-4),
      noiseCentroid: median(this.calibrationCentroid),
      noiseZcr: median(this.calibrationZcr),
      noiseFlatness: median(this.calibrationFlatness),
      calibratedAt: Date.now(),
    };
    this.baseline = baseline;
    return baseline;
  }

  getBaseline(): CalibrationBaseline | null {
    return this.baseline;
  }

  isCalibrated(): boolean {
    return this.baseline !== null;
  }

  getCalibrationFrameCount(): number {
    return this.calibrationFrameCount;
  }

  /** 开始新一次录音前清空样本，但保留校准基准 */
  resetRecording(): void {
    this.pitchSamples = [];
    this.energySamples = [];
    this.centroidSamples = [];
    this.complexitySamples = [];
    this.rolloffSamples = [];
    this.fluxSamples = [];
    this.flatnessSamples = [];
    this.spreadSamples = [];
    this.crestSamples = [];
    this.zcrSamples = [];
    this.mfccFrames = [];
    this.snrSamples = [];
    this.validSnrSamples = [];

    this.totalFrames = 0;
    this.validFrames = 0;
    this.clippingFrames = 0;
    this.silentFrames = 0;

    this.currentEnergy = 0;
    this.currentSnr = 0;
    this.previousTimeDomainData = null;
  }

  /** 采集一帧有效录音样本，基于校准基准过滤低质数据 */
  collectSample(): void {
    if (!this.baseline) return;

    this.analyser.getFloatTimeDomainData(this.timeDomainData);
    this.analyser.getByteFrequencyData(this.frequencyData);

    // 在 Meyda 加窗前计算原始最大幅值和基频，避免加窗影响
    let maxAmplitude = 0;
    for (let i = 0; i < this.timeDomainData.length; i++) {
      const abs = Math.abs(this.timeDomainData[i]);
      if (abs > maxAmplitude) maxAmplitude = abs;
    }
    const pitch = estimatePitch(this.timeDomainData, this.audioContext.sampleRate);

    // 先保存当前原始时域信号，用于下一帧的 spectralFlux（当前先禁用，避免 Meyda 兼容问题）
    this.previousTimeDomainData = new Float32Array(this.timeDomainData);

    let features: Record<string, number | number[]> | null = null;
    try {
      features = Meyda.extract(
        [
          'rms',
          'zcr',
          'spectralCentroid',
          'spectralRolloff',
          'spectralFlatness',
          'spectralSpread',
          'spectralCrest',
          'mfcc',
        ],
        this.timeDomainData
      ) as Record<string, number | number[]> | null;
    } catch (err) {
      // Meyda 偶发报错时降级为手动计算基础特征
      console.warn('[AudioAnalyzer] Meyda.extract failed:', err);
    }

    const rms = (features?.rms as number) ?? calculateRMS(this.timeDomainData);
    const zcr = (features?.zcr as number) ?? calculateZCR(this.timeDomainData);
    const flatness = (features?.spectralFlatness as number) ?? 0;

    const quality = assessFrame(rms, zcr, flatness, maxAmplitude, this.baseline);

    this.totalFrames += 1;
    if (quality.clipped) this.clippingFrames += 1;
    if (quality.silent) this.silentFrames += 1;
    this.snrSamples.push(quality.snrDb);

    this.currentEnergy = rms;
    this.currentSnr = quality.snrDb;

    if (!quality.valid) return;

    this.validFrames += 1;
    this.validSnrSamples.push(quality.snrDb);

    if (pitch > 60 && pitch < 800) {
      this.pitchSamples.push(pitch);
    }

    const centroid = (features?.spectralCentroid as number) ?? 0;
    const complexity = calculateHarmonicComplexity(this.frequencyData, this.audioContext.sampleRate);

    this.energySamples.push(rms);
    this.centroidSamples.push(centroid);
    this.complexitySamples.push(complexity);
    this.rolloffSamples.push((features?.spectralRolloff as number) ?? 0);
    this.flatnessSamples.push(flatness);
    this.spreadSamples.push((features?.spectralSpread as number) ?? 0);
    this.crestSamples.push((features?.spectralCrest as number) ?? 0);
    this.zcrSamples.push(zcr);
    this.fluxSamples.push((features?.spectralFlux as number) ?? 0);

    if (features?.mfcc && Array.isArray(features.mfcc)) {
      this.mfccFrames.push([...(features.mfcc as number[])]);
    }
  }

  getCurrentEnergy(): number {
    return this.currentEnergy;
  }

  getCurrentSnr(): number {
    return this.currentSnr;
  }

  /** 调试用：返回当前帧数和有效样本数 */
  getDebugStats(): {
    totalFrames: number;
    validFrames: number;
    pitchSamples: number;
    energySamples: number;
    baseline: CalibrationBaseline | null;
  } {
    return {
      totalFrames: this.totalFrames,
      validFrames: this.validFrames,
      pitchSamples: this.pitchSamples.length,
      energySamples: this.energySamples.length,
      baseline: this.baseline,
    };
  }

  hasValidVoice(): boolean {
    const hasEnoughPitchSamples = this.pitchSamples.length >= this.VALID_SAMPLE_MIN;
    const hasEnoughEnergy = this.energySamples.length >= this.VALID_SAMPLE_MIN;
    return hasEnoughPitchSamples && hasEnoughEnergy;
  }

  getQuality(): RecordingQuality | null {
    if (!this.baseline) return null;
    return summarizeQuality({
      totalFrames: this.totalFrames,
      validFrames: this.validFrames,
      clippingFrames: this.clippingFrames,
      silentFrames: this.silentFrames,
      validSnrValues: this.validSnrSamples,
      baseline: this.baseline,
    });
  }

  getFeatures(duration: number, poemCharCount: number): { features: AudioFeatures; quality: RecordingQuality } | null {
    const quality = this.getQuality();
    if (!quality) return null;

    if (!this.hasValidVoice()) {
      return null;
    }

    const averagePitch = this.average(this.pitchSamples);
    const pitchVariance = this.calculateVariance(this.pitchSamples, averagePitch);
    const jitter = calculateJitter(this.pitchSamples);

    const energy = this.average(this.energySamples);
    const spectralCentroid = this.average(this.centroidSamples);
    const harmonicComplexity = this.average(this.complexitySamples);

    const speakingRate = duration > 0 ? poemCharCount / duration : 1;

    const avgSnr = this.validSnrSamples.length > 0
      ? this.validSnrSamples.reduce((a, b) => a + b, 0) / this.validSnrSamples.length
      : 0;

    return {
      features: {
        averagePitch,
        pitchVariance,
        speakingRate,
        energy: Math.min(energy * 10, 1),
        spectralCentroid,
        harmonicComplexity: Math.min(harmonicComplexity * 2, 1),
        jitter: Math.min(jitter / 100, 1),
        mfcc: averageMfcc(this.mfccFrames),
        spectralRolloff: this.average(this.rolloffSamples),
        spectralFlux: this.average(this.fluxSamples),
        spectralFlatness: this.average(this.flatnessSamples),
        spectralSpread: this.average(this.spreadSamples),
        spectralCrest: this.average(this.crestSamples),
        zcr: this.average(this.zcrSamples),
        snr: avgSnr,
      },
      quality,
    };
  }

  private average(samples: number[]): number {
    if (samples.length === 0) return 0;
    return samples.reduce((a, b) => a + b, 0) / samples.length;
  }

  private calculateVariance(samples: number[], mean: number): number {
    if (samples.length < 2) return 0;
    const sum = samples.reduce((acc, val) => acc + (val - mean) ** 2, 0);
    return sum / samples.length;
  }
}

export function calculateRMS(timeDomainData: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < timeDomainData.length; i++) {
    sum += timeDomainData[i] * timeDomainData[i];
  }
  return Math.sqrt(sum / timeDomainData.length);
}

export function calculateZCR(timeDomainData: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < timeDomainData.length; i++) {
    if ((timeDomainData[i] >= 0) !== (timeDomainData[i - 1] >= 0)) {
      crossings += 1;
    }
  }
  return crossings / (timeDomainData.length - 1);
}

export function calculateSpectralCentroid(frequencyData: Uint8Array, sampleRate: number): number {
  let weightedSum = 0;
  let total = 0;
  const binSize = sampleRate / 2 / frequencyData.length;

  for (let i = 0; i < frequencyData.length; i++) {
    const magnitude = frequencyData[i];
    const frequency = i * binSize;
    weightedSum += frequency * magnitude;
    total += magnitude;
  }

  return total > 0 ? weightedSum / total : 0;
}
