import type { AudioFeatures } from '@/types';

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

export function calculateRMS(timeDomainData: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < timeDomainData.length; i++) {
    sum += timeDomainData[i] * timeDomainData[i];
  }
  return Math.sqrt(sum / timeDomainData.length);
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

export class AudioAnalyzer {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private source: MediaStreamAudioSourceNode | null = null;
  private pitchSamples: number[] = [];
  private energySamples: number[] = [];
  private centroidSamples: number[] = [];
  private complexitySamples: number[] = [];
  private currentEnergy = 0;

  // 能量阈值：低于此值视为环境噪音/静音，不采集基频
  private readonly ENERGY_THRESHOLD = 0.015;
  // 有效样本数量阈值：至少采集到这么多次有效人声才认为是有效录音
  private readonly VALID_SAMPLE_MIN = 8;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
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

  collectSample(): void {
    const bufferLength = this.analyser.fftSize;
    const timeDomainData = new Float32Array(bufferLength);
    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

    this.analyser.getFloatTimeDomainData(timeDomainData);
    this.analyser.getByteFrequencyData(frequencyData);

    const pitch = estimatePitch(timeDomainData, this.audioContext.sampleRate);
    const rms = calculateRMS(timeDomainData);
    const centroid = calculateSpectralCentroid(frequencyData, this.audioContext.sampleRate);
    const complexity = calculateHarmonicComplexity(frequencyData, this.audioContext.sampleRate);

    this.currentEnergy = rms;
    this.energySamples.push(rms);
    this.centroidSamples.push(centroid);
    this.complexitySamples.push(complexity);

    // 只有在能量足够高、且基频在人声范围内时才记录为有效样本
    if (rms >= this.ENERGY_THRESHOLD && pitch > 60 && pitch < 800) {
      this.pitchSamples.push(pitch);
    }
  }

  getCurrentEnergy(): number {
    return this.currentEnergy;
  }

  hasValidVoice(): boolean {
    const hasEnoughPitchSamples = this.pitchSamples.length >= this.VALID_SAMPLE_MIN;
    const hasEnoughEnergy = this.energySamples.length > 0 &&
      this.energySamples.filter((e) => e >= this.ENERGY_THRESHOLD).length >= this.VALID_SAMPLE_MIN;
    return hasEnoughPitchSamples && hasEnoughEnergy;
  }

  getFeatures(duration: number, poemCharCount: number): AudioFeatures | null {
    if (!this.hasValidVoice()) {
      return null;
    }

    const validEnergySamples = this.energySamples.filter((e) => e >= this.ENERGY_THRESHOLD);

    const averagePitch = this.pitchSamples.reduce((a, b) => a + b, 0) / this.pitchSamples.length;

    const pitchVariance = this.calculateVariance(this.pitchSamples, averagePitch);

    const energy = validEnergySamples.length > 0
      ? validEnergySamples.reduce((a, b) => a + b, 0) / validEnergySamples.length
      : 0.05;

    const spectralCentroid = this.centroidSamples.length > 0
      ? this.centroidSamples.reduce((a, b) => a + b, 0) / this.centroidSamples.length
      : 1000;

    const harmonicComplexity = this.complexitySamples.length > 0
      ? this.complexitySamples.reduce((a, b) => a + b, 0) / this.complexitySamples.length
      : 0.3;

    const speakingRate = duration > 0 ? poemCharCount / duration : 1;
    const jitter = calculateJitter(this.pitchSamples);

    return {
      averagePitch,
      pitchVariance,
      speakingRate,
      energy: Math.min(energy * 10, 1),
      spectralCentroid,
      harmonicComplexity: Math.min(harmonicComplexity * 2, 1),
      jitter: Math.min(jitter / 100, 1),
    };
  }

  private calculateVariance(samples: number[], mean: number): number {
    if (samples.length < 2) return 0;
    const sum = samples.reduce((acc, val) => acc + (val - mean) ** 2, 0);
    return sum / samples.length;
  }
}
