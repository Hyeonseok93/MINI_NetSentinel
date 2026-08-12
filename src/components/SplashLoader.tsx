import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, Globe, CheckCircle2 } from 'lucide-react';

interface SplashLoaderProps {
  onComplete: () => void;
}

const steps = [
  { step: 1, text: '[1/4] Npcap 커널 보안 드라이버 검사 중...', percent: 25, icon: ShieldCheck },
  { step: 2, text: '[2/4] 윈도우 Live Netstat API 바인딩 중...', percent: 50, icon: Cpu },
  { step: 3, text: '[3/4] GeoIP 트래픽 지형 데이터 로딩 중...', percent: 75, icon: Globe },
  { step: 4, text: '[4/4] 관제 대시보드 100% 준비 완료!', percent: 100, icon: CheckCircle2 },
];

export const SplashLoader: React.FC<SplashLoaderProps> = ({ onComplete }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setCurrentStepIndex(1), 500);
    const timer2 = setTimeout(() => setCurrentStepIndex(2), 1000);
    const timer3 = setTimeout(() => setCurrentStepIndex(3), 1500);
    const timer4 = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => {
        onComplete();
      }, 500);
    }, 2000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onComplete]);

  const currentStep = steps[currentStepIndex];
  const StepIcon = currentStep.icon;

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 transition-opacity duration-500 selection:bg-cyan-500 select-none ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Cyber Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center space-y-6">
        {/* Project Original Logo */}
        <div className="relative group">
          <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-3xl opacity-30 blur-xl group-hover:opacity-50 transition-all duration-500 animate-pulse" />
          <img
            src="/logo.png"
            alt="NetSentinel Logo"
            className="h-16 w-auto object-contain relative z-10 filter drop-shadow-[0_0_15px_rgba(0,180,216,0.5)]"
          />
        </div>

        {/* Brand Title */}
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-[#00b4d8] tracking-tight">NetSentinel</h1>
          <p className="text-xs text-slate-400 font-mono">Real-time Packet & Anomaly Sentinel Enterprise</p>
        </div>

        {/* Step Status Icon & Text */}
        <div className="w-full p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-2xl space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-cyan-300 font-bold">
              <StepIcon className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>{currentStep.text}</span>
            </div>
            <span className="font-bold text-emerald-400">{currentStep.percent}%</span>
          </div>

          {/* Neon Integrated Progress Bar */}
          <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 overflow-hidden border border-slate-800 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-purple-500 transition-all duration-500 shadow-[0_0_12px_rgba(34,211,238,0.8)]"
              style={{ width: `${currentStep.percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
