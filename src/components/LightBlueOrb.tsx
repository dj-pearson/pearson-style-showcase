import React from 'react';

interface LightBlueOrbProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const LightBlueOrb: React.FC<LightBlueOrbProps> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-32 h-32',
    md: 'w-48 h-48',
    lg: 'w-64 h-64',
    xl: 'w-96 h-96'
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {/* Main orb */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-300/30 via-blue-400/40 to-indigo-500/30 animate-pulse-slow">
        {/* Inner glow */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-cyan-200/50 via-blue-300/60 to-indigo-400/40 animate-pulse-slower">
          {/* Core light */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-cyan-100/70 via-blue-200/80 to-indigo-300/60 animate-pulse-fastest">
            {/* Bright center */}
            <div className="absolute inset-6 rounded-full bg-gradient-to-br from-white/80 via-cyan-100/90 to-blue-200/70 animate-shimmer">
              {/* Central spark */}
              <div className="absolute inset-8 rounded-full bg-gradient-to-br from-white/95 via-cyan-50/95 to-blue-100/80 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Outer glow effect */}
      <div className="absolute -inset-4 rounded-full bg-gradient-radial from-cyan-400/20 via-blue-500/10 to-transparent animate-pulse-slow" />
      
      {/* Particle effects */}
      <div className="absolute inset-0">
        {/* Floating particles */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-300/80 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 4}s`,
              animationDuration: `${3 + Math.random() * 2}s`
            }}
          />
        ))}
        
        {/* Sparkle effects */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`sparkle-${i}`}
            className="absolute w-0.5 h-0.5 bg-white/90 rounded-full animate-twinkle"
            style={{
              left: `${20 + Math.random() * 60}%`,
              top: `${20 + Math.random() * 60}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>
      
      {/* Rotating ring effect */}
      <div className="absolute inset-0 rounded-full border border-cyan-300/30 animate-spin-slow" />
      <div className="absolute inset-2 rounded-full border border-blue-400/20 animate-spin-reverse" />
    </div>
  );
};