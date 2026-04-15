import React from 'react';

export default function BackgroundAnimation() {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-slate-100">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        src="/background.mp4"
      >
        <source src="/background.mp4" type="video/mp4" />
      </video>
      {/* Overlay to ensure text remains readable against the bright concrete */}
      <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]"></div>
    </div>
  );
}
