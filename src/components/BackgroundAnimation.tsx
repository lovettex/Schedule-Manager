import React from 'react';

export default function BackgroundAnimation() {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
      {/* Water droplets / Glass bubbles */}
      <div className="absolute top-[15%] left-[10%] w-32 h-32 rounded-full glass-bubble animate-float" style={{ animationDelay: '0s' }}></div>
      <div className="absolute top-[35%] right-[15%] w-48 h-48 rounded-full glass-bubble animate-float" style={{ animationDelay: '-2s' }}></div>
      <div className="absolute bottom-[20%] left-[25%] w-24 h-24 rounded-full glass-bubble animate-float" style={{ animationDelay: '-4s' }}></div>
      <div className="absolute top-[10%] right-[35%] w-16 h-16 rounded-full glass-bubble animate-float" style={{ animationDelay: '-1s' }}></div>
      <div className="absolute bottom-[25%] right-[10%] w-20 h-20 rounded-full glass-bubble animate-float" style={{ animationDelay: '-3s' }}></div>
      <div className="absolute top-[60%] left-[5%] w-12 h-12 rounded-full glass-bubble animate-float" style={{ animationDelay: '-5s' }}></div>
      
      {/* Tiny droplets */}
      <div className="absolute top-[25%] left-[25%] w-4 h-4 rounded-full glass-bubble animate-float" style={{ animationDelay: '-0.5s' }}></div>
      <div className="absolute top-[45%] right-[30%] w-6 h-6 rounded-full glass-bubble animate-float" style={{ animationDelay: '-2.5s' }}></div>
      <div className="absolute bottom-[35%] left-[40%] w-5 h-5 rounded-full glass-bubble animate-float" style={{ animationDelay: '-4.5s' }}></div>
      <div className="absolute top-[75%] right-[25%] w-8 h-8 rounded-full glass-bubble animate-float" style={{ animationDelay: '-1.5s' }}></div>
    </div>
  );
}
