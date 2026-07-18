import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, Loader2, Volume2 } from 'lucide-react';
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const sampleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!gender) {
      navigate('/');
    }
  }, [gender, navigate]);

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

  const startRecording = async () => {
    if (isRecording || isAnalyzing || !gender) return;

    setErrorTip(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = createAudioContext();
      audioContextRef.current = audioContext;

      const analyzer = new AudioAnalyzer(audioContext);
      analyzer.connect(stream);
      analyzerRef.current = analyzer;

      const mediaRecorder = new MediaRecorder(stream);
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
        setVolume(Math.min(currentEnergy * 20, 1));
      }, 50);
    } catch (error) {
      alert('无法访问麦克风，请检查权限设置');
      console.error(error);
    }
  };

  const stopRecording = useCallback(() => {
    if (!isRecording) return;

    setIsRecording(false);
    setVolume(0);

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
    analyzerRef.current?.disconnect();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

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
    const features = analyzerRef.current?.getFeatures(elapsed, poemCharCount);

    if (!features) {
      setErrorTip('声音分析失败，请重新朗读~');
      return;
    }

    const voiceType = matchVoiceType(features, gender);

    setIsAnalyzing(true);

    setTimeout(() => {
      setResult({
        voiceType,
        features,
        recordingDuration: elapsed,
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
              disabled={isRecording}
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
        </div>

        <div className="flex flex-col items-center">
          <div className="mb-6 text-center">
            <div className="text-3xl font-mono font-bold text-white">
              {formatDuration(duration)}
            </div>
            <p className="mt-2 text-sm text-slate-400">
              {isRecording ? '录音中，松开按钮结束' : '按住下方按钮朗读古诗'}
            </p>
          </div>

          <button
            type="button"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={isRecording ? stopRecording : undefined}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={isAnalyzing}
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
