import React, { useState, useEffect } from 'react';

const MINT_STEPS = [
  'Fetching profile data...',
  'Loading recent posts...',
  'Analyzing engagement...',
  'Scanning followers...',
  'Building insights...',
];

const MintingLoader = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setStep(s => (s + 1) % MINT_STEPS.length), 2200);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-[60vh]">
      <style>{`
        @keyframes mintFloat { 0%,100%{transform:translateY(0) scale(1);opacity:.7} 50%{transform:translateY(-28px) scale(1.15);opacity:1} }
        @keyframes mintDot { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
        .mint-bubble { animation: mintFloat 2.4s ease-in-out infinite; }
        .mint-dot { animation: mintDot 1.4s ease-in-out infinite; }
      `}</style>
      <div className="flex gap-3 mb-6">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="mint-bubble rounded-full"
            style={{
              width: [18,26,20,24,16][i], height: [18,26,20,24,16][i],
              background: `linear-gradient(135deg, ${['#818cf8','#6366f1','#a78bfa','#7c3aed','#c084fc'][i]}, ${['#6366f1','#4f46e5','#7c3aed','#5b21b6','#a855f7'][i]})`,
              animationDelay: `${i * 0.35}s`,
            }}
          />
        ))}
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">
        Minting<span className="inline-flex ml-1">{[0,1,2].map(i => (
          <span key={i} className="mint-dot text-indigo-500 text-3xl leading-none" style={{ animationDelay: `${i * 0.3}s` }}>.</span>
        ))}</span>
      </h2>
      <p className="text-sm text-slate-500 h-5 transition-opacity duration-500">{MINT_STEPS[step]}</p>
    </div>
  );
};

export default MintingLoader;
