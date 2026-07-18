import { useNavigate } from 'react-router-dom';
import { User, UserRound } from 'lucide-react';
import { useVoiceStore } from '@/store/useVoiceStore';
import type { Gender } from '@/types';

export default function Home() {
  const navigate = useNavigate();
  const setGender = useVoiceStore((state) => state.setGender);

  const handleSelect = (gender: Gender) => {
    setGender(gender);
    navigate('/recite');
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-pink-300 mb-4 tracking-tight">
            发现你的声音音色
          </h1>
          <p className="text-slate-400 text-base">
            朗读一首古诗，解锁属于你的声音标签
          </p>
        </div>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => handleSelect('male')}
            className="group relative w-full overflow-hidden rounded-3xl bg-gradient-to-r from-blue-500 to-blue-700 p-6 text-left shadow-lg shadow-blue-900/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-blue-500/40 active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <User className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">男生</div>
                <div className="text-sm text-blue-100">低沉磁性 · 清亮少年</div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelect('female')}
            className="group relative w-full overflow-hidden rounded-3xl bg-gradient-to-r from-pink-500 to-pink-700 p-6 text-left shadow-lg shadow-pink-900/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-pink-500/40 active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <UserRound className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">女生</div>
                <div className="text-sm text-pink-100">甜美少女 · 空灵仙气</div>
              </div>
            </div>
          </button>
        </div>

        <p className="mt-10 text-center text-xs text-slate-500">
          录音仅在本地分析，不会上传至服务器
        </p>
      </div>
    </div>
  );
}
