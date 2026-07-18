import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, Loader2, Volume2, Activity } from 'lucide-react';
import { useVoiceStore } from '@/store/useVoiceStore';
import { poems } from '@/data/poems';
import { AudioAnalyzer, createAudioContext } from '@/utils/audioAnalysis';
import { matchVoiceType } from '@/utils/voiceMatcher';

export default function Recite() {
  const navigate = useNavigate();
  const gender = useVoiceStore((state) => state.gender);
  const setResult = useVoiceStore((state) => state.setResult);

  const [currentPoem, setCurrentPoem] = useState(() => poems[Math.floor(Math.random() * poems.length)]);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [volume, setVolume] = useState(0);
  const [errorTip, setErrorTip] = useState<string | null>(null);

  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [qualityTip, setQualityTip] = useState<string | null>(null);
  const [debugStats, setDebugStats] = useState<{
    totalFrames: number;
    validFrames: number;
    pitchSamples: number;
    energySamples: number;
    currentEnergy: number;
    currentSnr: number;
    noiseRms: number;
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const sampleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const calibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!gender) {
      navigate('/');
    }
  }, [gender, navigate]);

  // 页面卸载时释放麦克风与音频上下文
  useEffect(() => {
    return () => {
      releaseAudioResources();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const releaseAudioResources = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (sampleIntervalRef.current) {
      clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }
    if (calibrationIntervalRef.current) {
      clearInterval(calibrationIntervalRef.current);
      calibrationIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    analyzerRef.current?.disconnect();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsRecording(false);
    setIsCalibrating(false);
    setVolume(0);
  }, []);

  const refreshPoem = useCallback(() => {
    setCurrentPoem((prev) => {
      let next = poems[Math.floor(Math.random() * poems.length)];
      while (next.id === prev.id) {
        next = poems[Math.floor(Math.random() * poems.length)];
      }
      return next;
    });
  }, []);

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    const ms = Math.floor((seconds % 1) * 100).toString().padStart(2, '0');
    return `${m}:${s}.${ms}`;
  };

  const initAudio = async (): Promise<boolean> => {
    if (streamRef.current && analyzerRef.current) return true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      const audioContext = createAudioContext();
      audioContextRef.current = audioContext;

      // 某些浏览器需要显式 resume 才能采集音频
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const analyzer = new AudioAnalyzer(audioContext);
      analyzer.connect(stream);
      analyzerRef.current = analyzer;

      return true;
    } catch (error) {
      alert('无法访问麦克风，请检查权限设置');
      console.error(error);
      return false;
    }
  };

  const startCalibration = async () => {
    if (isCalibrating || isRecording || !gender) return;

    setErrorTip(null);
    setQualityTip(null);

    const ready = await initAudio();
    if (!ready || !analyzerRef.current) return;

    analyzerRef.current.resetCalibration();
    setIsCalibrated(false);
    setIsCalibrating(true);
    setCalibrationProgress(0);

    calibrationIntervalRef.current = setInterval(() => {
      const analyzer = analyzerRef.current;
      if (!analyzer) return;

      const done = analyzer.collectCalibrationSample();
      const frames = analyzer.getCalibrationFrameCount();
      const progress = Math.min((frames / 30) * 100, 99);
      setCalibrationProgress(progress);

      if (done) {
        analyzer.finishCalibration();
        setIsCalibrating(false);
        setIsCalibrated(true);
        setCalibrationProgress(100);
        if (calibrationIntervalRef.current) {
          clearInterval(calibrationIntervalRef.current);
          calibrationIntervalRef.current = null;
        }
      }
    }, 50);
  };

  const startRecording = async () => {
    if (isRecording || isAnalyzing || !gender || !isCalibrated) return;

    setErrorTip(null);
    setQualityTip(null);

    if (!streamRef.current || !analyzerRef.current) {
      const ready = await initAudio();
      if (!ready || !analyzerRef.current) return;
    }

    // 每次录音前清空上一次采集的样本，但保留校准基准
    analyzerRef.current.resetRecording();

    const mediaRecorder = new MediaRecorder(streamRef.current!);
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();

    setIsRecording(true);
    setDuration(0);
    setVolume(0);
    startTimeRef.current = performance.now();

    intervalRef.current = setInterval(() => {
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      setDuration(elapsed);
    }, 50);

    sampleIntervalRef.current = setInterval(() => {
      analyzerRef.current?.collectSample();
      const currentEnergy = analyzerRef.current?.getCurrentEnergy() || 0;
      const currentSnr = analyzerRef.current?.getCurrentSnr() || 0;
      // 用对数尺度显示音量，范围 -70dB ~ -10dB，低能量也能看到波动
      const db = currentEnergy > 0 ? 20 * Math.log10(currentEnergy) : -100;
      const normalizedVolume = Math.min(Math.max((db + 70) / 60, 0), 1);
      setVolume(normalizedVolume);

      const baseline = analyzerRef.current?.getBaseline();
      setDebugStats({
        totalFrames: analyzerRef.current?.getDebugStats().totalFrames ?? 0,
        validFrames: analyzerRef.current?.getDebugStats().validFrames ?? 0,
        pitchSamples: analyzerRef.current?.getDebugStats().pitchSamples ?? 0,
        energySamples: analyzerRef.current?.getDebugStats().energySamples ?? 0,
        currentEnergy,
        currentSnr,
        noiseRms: baseline?.noiseRms ?? 0,
      });

      if (currentEnergy > 0.5) {
        setQualityTip('声音过大，建议离麦克风稍远');
      } else if (currentSnr < 5) {
        setQualityTip('声音太小或环境嘈杂，请靠近麦克风朗读');
      } else if (currentSnr < 10) {
        setQualityTip('当前信噪比一般，请尽量保持环境安静');
      } else {
        setQualityTip('声音质量良好');
      }
    }, 50);
  };

  const stopRecording = useCallback(() => {
    if (!isRecording) return;

    setIsRecording(false);
    setVolume(0);
    setQualityTip(null);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (sampleIntervalRef.current) {
      clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }

    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    setDuration(elapsed);

    mediaRecorderRef.current?.stop();

    if (!gender) return;

    if (elapsed < 1) {
      setErrorTip('录音时间太短啦，请按住按钮完整朗读古诗~');
      return;
    }

    if (!analyzerRef.current?.hasValidVoice()) {
      setErrorTip('没有检测到有效声音哦，请确保麦克风正常并大声朗读~');
      return;
    }

    const poemCharCount = currentPoem.content.join('').length;
    const result = analyzerRef.current?.getFeatures(elapsed, poemCharCount);

    if (!result) {
      setErrorTip('声音分析失败，请重新朗读~');
      return;
    }

    const { features, quality } = result;

    if (!quality.passed) {
      setErrorTip(`录音质量未达标：${quality.reason}`);
      return;
    }

    const voiceType = matchVoiceType(features, gender);

    setIsAnalyzing(true);

    setTimeout(() => {
      setResult({
        voiceType,
        features,
        recordingDuration: elapsed,
        quality,
      });
      setIsAnalyzing(false);
      navigate('/result');
    }, 1200);
  }, [isRecording, gender, currentPoem, setResult, navigate]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="text-sm text-slate-400">
            当前选择：<span className="font-medium text-white">{gender === 'male' ? '男声' : '女声'}</span>
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{currentPoem.title}</h2>
              <p className="text-sm text-slate-400">{currentPoem.author}</p>
            </div>
            <button
              type="button"
              onClick={refreshPoem}
              disabled={isRecording || isCalibrating}
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-white/20 disabled:opacity-50"
            >
              换一首
            </button>
          </div>
          <div className="space-y-2 text-center">
            {currentPoem.content.map((line, index) => (
              <p key={index} className="text-lg leading-relaxed text-slate-200">
                {line}
              </p>
            ))}
          </div>
        </div>

        {!isCalibrated ? (
          <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-6 text-center backdrop-blur-md">
            <Activity className="mx-auto mb-3 h-8 w-8 text-cyan-400" />
            <h3 className="mb-2 text-lg font-bold text-white">环境校准</h3>
            <p className="mb-4 text-sm text-slate-300">
              点击开始后保持安静 1.5 秒，让系统检测当前环境噪音，后续录音会据此过滤杂音。
            </p>
            {isCalibrating ? (
              <div>
                <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all duration-100"
                    style={{ width: `${calibrationProgress}%` }}
                  />
                </div>
                <p className="text-sm text-cyan-300">正在检测环境噪音... {Math.round(calibrationProgress)}%</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={startCalibration}
                className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                开始校准
              </button>
            )}
          </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-center backdrop-blur-md">
            <p className="mb-2 text-sm text-green-300">环境校准完成，可以开始朗读</p>
            <button
              type="button"
              onClick={startCalibration}
              disabled={isRecording || isCalibrating}
              className="text-xs text-green-400 underline disabled:opacity-50"
            >
              重新校准
            </button>
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <Volume2 className="h-4 w-4" />
              麦克风音量
            </span>
            <span>{isRecording ? '收集中' : '等待录音'}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-700">
            <div
              className={`h-full rounded-full transition-all duration-75 ${
                volume > 0.3 ? 'bg-green-400' : volume > 0.1 ? 'bg-yellow-400' : 'bg-slate-500'
              }`}
              style={{ width: `${Math.round(volume * 100)}%` }}
            />
          </div>
          {qualityTip && (
            <p className={`mt-2 text-xs ${qualityTip === '声音质量良好' ? 'text-green-400' : 'text-yellow-400'}`}>
              {qualityTip}
            </p>
          )}
        </div>

        {debugStats && isRecording && (
          <div className="mb-4 rounded-xl border border-white/10 bg-black/30 p-3 text-xs font-mono text-slate-400 backdrop-blur-md">
            <div className="mb-1 text-slate-500">调试信息</div>
            <div>总帧数: {debugStats.totalFrames}</div>
            <div>有效帧: {debugStats.validFrames}</div>
            <div>基频样本: {debugStats.pitchSamples}</div>
            <div>能量样本: {debugStats.energySamples}</div>
            <div>当前能量: {debugStats.currentEnergy.toFixed(5)}</div>
            <div>当前 SNR: {debugStats.currentSnr.toFixed(2)} dB</div>
            <div>环境噪音: {debugStats.noiseRms.toFixed(5)}</div>
          </div>
        )}

        <div className="flex flex-col items-center">
          <div className="mb-6 text-center">
            <div className="text-3xl font-mono font-bold text-white">
              {formatDuration(duration)}
            </div>
            <p className="mt-2 text-sm text-slate-400">
              {isRecording ? '录音中，松开按钮结束' : isCalibrated ? '按住下方按钮朗读古诗' : '请先完成环境校准'}
            </p>
          </div>

          <button
            type="button"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={isRecording ? stopRecording : undefined}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={isAnalyzing || !isCalibrated || isCalibrating}
            className={`relative flex h-28 w-28 items-center justify-center rounded-full transition-all duration-200 active:scale-95 disabled:opacity-70 ${
              isRecording
                ? 'bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.5)]'
                : 'bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_40px_rgba(59,130,246,0.4)]'
            }`}
          >
            {isRecording && (
              <>
                <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40" />
                <span className="absolute -inset-4 rounded-full border border-red-500/30 animate-pulse" />
              </>
            )}
            <Mic className="h-10 w-10 text-white" />
          </button>

          {errorTip && (
            <div className="mt-6 max-w-xs text-center text-sm text-red-300">
              {errorTip}
            </div>
          )}

          {isAnalyzing && (
            <div className="mt-8 flex items-center gap-2 text-cyan-300">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>正在分析音色特征...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
