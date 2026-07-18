import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Music, Sparkles, BarChart3, Clock, Activity } from 'lucide-react';
import { useVoiceStore } from '@/store/useVoiceStore';

export default function Result() {
  const navigate = useNavigate();
  const { result, reset } = useVoiceStore();

  useEffect(() => {
    if (!result) {
      navigate('/');
    }
  }, [result, navigate]);

  if (!result) return null;

  const { voiceType, features, recordingDuration, quality } = result;

  const rarityLabels: Record<number, string> = {
    1: '常见',
    2: '普通',
    3: '少见',
    4: '稀有',
    5: '超稀有',
  };

  const handleRestart = () => {
    reset();
    navigate('/');
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/recite')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-white">音色分析报告</h1>
          <button
            type="button"
            onClick={handleRestart}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6 text-center">
          <p className="mb-2 text-sm text-slate-400">你的音色是</p>
          <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-pink-300">
            {voiceType.label}
          </h2>
        </div>

        <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <div className="mb-4 flex items-center gap-2 text-slate-300">
            <Sparkles className="h-5 w-5 text-yellow-400" />
            <span className="font-bold">音色稀有度</span>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <svg
                key={index}
                className={`h-8 w-8 ${
                  index < voiceType.rarity ? 'text-yellow-400' : 'text-slate-600'
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {voiceType.rarity} 星 · {rarityLabels[voiceType.rarity] || '稀有'}
          </p>
        </div>

        <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <div className="mb-3 flex items-center gap-2 text-slate-300">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
            <span className="font-bold">判断理由</span>
          </div>
          <p className="leading-relaxed text-slate-300">{voiceType.reason}</p>
          <p className="mt-3 text-sm text-slate-500">
            核心特征：{voiceType.features}
          </p>
        </div>

        <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <div className="mb-3 flex items-center gap-2 text-slate-300">
            <Music className="h-5 w-5 text-pink-400" />
            <span className="font-bold">适合演唱的音乐类型</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {voiceType.musicStyles.map((style) => (
              <span
                key={style}
                className="rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-4 py-2 text-sm text-pink-200"
              >
                {style}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <div className="mb-3 flex items-center gap-2 text-slate-300">
            <Activity className="h-5 w-5 text-green-400" />
            <span className="font-bold">录音质量</span>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`inline-flex h-3 w-3 rounded-full ${quality.passed ? 'bg-green-400' : 'bg-yellow-400'}`}
            />
            <span className="text-sm text-slate-300">{quality.passed ? '质量合格' : quality.reason}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-slate-500">信噪比</p>
              <p className="text-lg font-bold text-white">{quality.snr.toFixed(1)} dB</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-slate-500">环境噪音</p>
              <p className="text-lg font-bold text-white">{quality.noiseLevelDb.toFixed(1)} dB</p>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <div className="mb-3 flex items-center gap-2 text-slate-300">
            <Clock className="h-5 w-5 text-green-400" />
            <span className="font-bold">录音数据</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-slate-500">录音时长</p>
              <p className="text-lg font-bold text-white">{recordingDuration.toFixed(2)}s</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-slate-500">平均基频</p>
              <p className="text-lg font-bold text-white">{features.averagePitch.toFixed(0)}Hz</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-slate-500">语速</p>
              <p className="text-lg font-bold text-white">{features.speakingRate.toFixed(1)}字/s</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-slate-500">能量指数</p>
              <p className="text-lg font-bold text-white">{(features.energy * 100).toFixed(0)}%</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-slate-500">频谱质心</p>
              <p className="text-lg font-bold text-white">{features.spectralCentroid.toFixed(0)}Hz</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-slate-500">频谱平坦度</p>
              <p className="text-lg font-bold text-white">{features.spectralFlatness.toFixed(3)}</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-slate-500">过零率</p>
              <p className="text-lg font-bold text-white">{features.zcr.toFixed(3)}</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-slate-500">谐波复杂度</p>
              <p className="text-lg font-bold text-white">{features.harmonicComplexity.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRestart}
          className="w-full rounded-3xl bg-gradient-to-r from-cyan-500 to-blue-600 py-4 font-bold text-white shadow-lg shadow-blue-900/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          再测一次
        </button>
      </div>
    </div>
  );
}
