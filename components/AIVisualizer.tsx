
import React from 'react';

interface AIVisualizerProps {
  isUserSpeaking: boolean;
  isAiSpeaking: boolean;
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

const AIVisualizer: React.FC<AIVisualizerProps> = ({ isUserSpeaking, isAiSpeaking, status, size = 'lg' }) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-32 h-32',
    lg: 'w-48 h-48'
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className={`relative ${sizeClasses[size]} flex items-center justify-center`}>
        {/* Outer Glow Ring (AI Speaking) */}
        <div 
            className={`absolute inset-0 rounded-full border-2 transition-all duration-100 ease-out 
            ${isAiSpeaking 
                ? 'border-cine-gold scale-125 opacity-100 shadow-[0_0_50px_rgba(212,175,55,0.8)] animate-pulse' 
                : 'border-gray-800 scale-100 opacity-20'}`}
        ></div>
        
        {/* Inner Input Ring (User Speaking) */}
        <div 
            className={`absolute inset-2 rounded-full border-2 transition-all duration-100 ease-out
            ${isUserSpeaking 
                ? 'border-green-500 scale-110 opacity-100 shadow-[0_0_30px_rgba(34,197,94,0.6)]' 
                : 'border-transparent scale-95 opacity-0'}`}
        ></div>

        {/* Core Orb */}
        <div className={`
            relative z-10 rounded-full flex items-center justify-center overflow-hidden shadow-2xl transition-all duration-500
            ${size === 'sm' ? 'w-10 h-10' : size === 'md' ? 'w-24 h-24' : 'w-36 h-36'}
            ${isAiSpeaking ? 'bg-cine-gold' : 'bg-black'}
        `}>
            {/* Core Texture/Animation */}
            <div className={`absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-50`}></div>
            
            {isAiSpeaking ? (
                <div className="absolute inset-0 bg-gradient-to-tr from-yellow-600 to-cine-gold animate-spin-slow opacity-80"></div>
            ) : (
                <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black"></div>
            )}
            
            {/* Status Icon / Initial */}
            <span className={`font-black tracking-tighter relative z-20 ${isAiSpeaking ? 'text-black' : 'text-gray-700'} ${size === 'sm' ? 'text-xs' : 'text-3xl'}`}>
                AI
            </span>
        </div>
      </div>
      
      {/* Status Text */}
      {status && size !== 'sm' && (
          <div className="mt-4 px-4 py-1 bg-black/50 rounded-full border border-gray-800 backdrop-blur-sm">
              <p className="text-cine-gold font-mono text-xs uppercase tracking-widest animate-pulse">
                  {status}
              </p>
          </div>
      )}
    </div>
  );
};

export default AIVisualizer;
