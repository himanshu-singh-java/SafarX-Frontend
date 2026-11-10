import React from 'react';

/**
 * Realistic Luxury Sports Coupe SVG
 * Transparent, pixel-perfect, scalable vector asset with:
 * - Aerodynamic body lines inspired by Porsche 718 Cayman / Taycan
 * - Ice-silver metallic gradient finish with specular highlights
 * - Tinted cabin glass with pillar reflections
 * - Quad-LED projector headlights with long projected light cone
 * - Ruby-red continuous rear LED lightbar with trailing light streak
 * - Rotating multi-spoke alloy wheels with red Brembo brake calipers
 * - Zero rectangular borders or photographic artifacts!
 */
export function RealisticLuxuryCar({ className = '', scale = 1 }) {
  return (
    <div className={`relative inline-block ${className}`} style={{ transform: `scale(${scale})` }}>
      {/* Dynamic Projected Headlight Beam on Asphalt */}
      <div 
        className="absolute right-[-260px] bottom-2 w-[340px] h-[110px] pointer-events-none -z-10"
        style={{
          background: 'radial-gradient(ellipse at 0% 50%, rgba(254, 240, 138, 0.45) 0%, rgba(253, 224, 71, 0.18) 35%, rgba(254, 240, 138, 0.04) 70%, transparent 100%)',
          transform: 'rotate(-4deg)',
          filter: 'blur(8px)',
        }}
      />

      {/* Dynamic Red Taillight Glow Trail Behind */}
      <div 
        className="absolute left-[-60px] bottom-5 w-[100px] h-[50px] pointer-events-none -z-10"
        style={{
          background: 'radial-gradient(ellipse at 100% 50%, rgba(239, 68, 68, 0.6) 0%, rgba(220, 38, 38, 0.2) 50%, transparent 100%)',
          filter: 'blur(10px)',
        }}
      />

      {/* Main Vector Car SVG */}
      <svg
        viewBox="0 0 540 180"
        className="w-[360px] sm:w-[460px] lg:w-[520px] h-auto drop-shadow-[0_20px_25px_rgba(0,0,0,0.85)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Metallic Body Gradient */}
          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="25%" stopColor="#cbd5e1" />
            <stop offset="50%" stopColor="#f8fafc" />
            <stop offset="75%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>

          {/* Roof & Window Gradient */}
          <linearGradient id="glassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="60%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          {/* Underbody Shadow Gradient */}
          <linearGradient id="underGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#020617" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>

          {/* Wheel Rim Gradient */}
          <radialGradient id="rimGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="60%" stopColor="#1e293b" />
            <stop offset="85%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#0f172a" />
          </radialGradient>

          {/* Wheel Caliper Red */}
          <linearGradient id="caliperGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
        </defs>

        {/* 1. Ground Contact Shadow */}
        <ellipse cx="270" cy="168" rx="245" ry="10" fill="#000000" opacity="0.85" filter="blur(3px)" />
        <ellipse cx="270" cy="166" rx="210" ry="6" fill="#020617" opacity="0.95" />

        {/* 2. Car Chassis / Main Body Silhouette */}
        {/* Rear Bumper & Diffuser */}
        <path
          d="M 32 135 C 30 145, 38 152, 54 154 L 88 154 C 88 140, 102 124, 126 124 C 150 124, 164 140, 164 154 L 376 154 C 376 140, 390 124, 414 124 C 438 124, 452 140, 452 154 L 500 154 C 516 152, 526 142, 520 126 C 516 116, 502 108, 482 104 L 434 94 C 382 82, 334 50, 268 46 C 210 42, 166 48, 120 74 L 74 98 C 48 106, 34 118, 32 135 Z"
          fill="url(#bodyGrad)"
        />

        {/* 3. Aerodynamic Body Sculpting & Shadow Creases */}
        {/* Lower Door Sill / Rocker Panel */}
        <path d="M 164 150 L 376 150 L 370 142 L 170 142 Z" fill="#475569" />

        {/* Mid-body Character Line */}
        <path
          d="M 68 102 Q 130 94, 250 90 T 476 98"
          stroke="#f8fafc"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M 70 104 Q 130 96, 250 92 T 474 100"
          stroke="#475569"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Muscular Rear Haunch Contour */}
        <path
          d="M 74 98 Q 110 82, 168 84 Q 176 108, 164 126"
          stroke="#f1f5f9"
          strokeWidth="1.5"
          fill="none"
          opacity="0.8"
        />

        {/* 4. Greenhouse / Cabin Roof & Tinted Windows */}
        {/* Black Roofline Arch */}
        <path
          d="M 136 78 C 172 54, 222 48, 276 50 C 330 52, 362 76, 404 88 L 136 78 Z"
          fill="#090d16"
        />

        {/* Tinted Cabin Glass (Side Windows) */}
        <path
          d="M 148 76 C 182 56, 226 52, 272 54 L 272 84 L 158 84 Z"
          fill="url(#glassGrad)"
          stroke="#334155"
          strokeWidth="1"
        />
        <path
          d="M 280 54 C 322 56, 350 72, 386 84 L 280 84 Z"
          fill="url(#glassGrad)"
          stroke="#334155"
          strokeWidth="1"
        />

        {/* B-Pillar Divider */}
        <rect x="272" y="53" width="7" height="32" fill="#0f172a" />

        {/* Windshield Reflection Line */}
        <line x1="288" y1="56" x2="378" y2="82" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />

        {/* 5. Aerodynamic Side Mirror */}
        <path
          d="M 282 82 C 282 78, 298 78, 304 82 C 304 86, 292 88, 284 86 Z"
          fill="#1e293b"
          stroke="#475569"
          strokeWidth="1"
        />

        {/* 6. Front LED Headlight System */}
        <path
          d="M 478 100 L 512 108 C 504 116, 484 114, 472 108 Z"
          fill="#e2e8f0"
        />
        {/* Glowing Headlight Jewel DRLs */}
        <circle cx="488" cy="106" r="3.5" fill="#fef08a" />
        <circle cx="498" cy="109" r="3" fill="#ffffff" />
        <path d="M 474 102 L 508 110" stroke="#fef08a" strokeWidth="2" strokeLinecap="round" />

        {/* 7. Rear Ruby-Red LED Lightbar */}
        <path
          d="M 32 128 L 52 128 C 54 133, 44 136, 34 136 Z"
          fill="#ef4444"
          filter="drop-shadow(0 0 6px #ef4444)"
        />
        <line x1="33" y1="130" x2="50" y2="130" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />

        {/* 8. Front Bumper Air Intake & Splitter */}
        <path d="M 494 132 L 518 134 L 516 148 L 476 148 Z" fill="#0f172a" />
        <rect x="496" y="146" width="22" height="4" rx="2" fill="#020617" />

        {/* 9. WHEELS & BRAKES (Spinning alloy rims) */}
        
        {/* REAR WHEEL ASSEMBLY */}
        <g className="animate-wheel-spin" style={{ transformOrigin: '126px 154px' }}>
          {/* Outer Tire */}
          <circle cx="126" cy="154" r="34" fill="#090d16" stroke="#1e293b" strokeWidth="3" />
          <circle cx="126" cy="154" r="28" fill="#1e293b" />
          {/* Rim Rotor */}
          <circle cx="126" cy="154" r="23" fill="url(#rimGrad)" />
          {/* Red Brake Caliper */}
          <path d="M 112 140 Q 120 134, 130 136 L 126 144 Z" fill="url(#caliperGrad)" />
          {/* Multi-Spoke Alloy Design */}
          <line x1="126" y1="133" x2="126" y2="175" stroke="#cbd5e1" strokeWidth="2.5" />
          <line x1="105" y1="154" x2="147" y2="154" stroke="#cbd5e1" strokeWidth="2.5" />
          <line x1="111" y1="139" x2="141" y2="169" stroke="#94a3b8" strokeWidth="2" />
          <line x1="111" y1="169" x2="141" y2="139" stroke="#94a3b8" strokeWidth="2" />
          {/* Center Hub */}
          <circle cx="126" cy="154" r="5" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
        </g>

        {/* FRONT WHEEL ASSEMBLY */}
        <g className="animate-wheel-spin" style={{ transformOrigin: '414px 154px' }}>
          {/* Outer Tire */}
          <circle cx="414" cy="154" r="34" fill="#090d16" stroke="#1e293b" strokeWidth="3" />
          <circle cx="414" cy="154" r="28" fill="#1e293b" />
          {/* Rim Rotor */}
          <circle cx="414" cy="154" r="23" fill="url(#rimGrad)" />
          {/* Red Brake Caliper */}
          <path d="M 400 140 Q 408 134, 418 136 L 414 144 Z" fill="url(#caliperGrad)" />
          {/* Multi-Spoke Alloy Design */}
          <line x1="414" y1="133" x2="414" y2="175" stroke="#cbd5e1" strokeWidth="2.5" />
          <line x1="393" y1="154" x2="435" y2="154" stroke="#cbd5e1" strokeWidth="2.5" />
          <line x1="399" y1="139" x2="429" y2="169" stroke="#94a3b8" strokeWidth="2" />
          <line x1="399" y1="169" x2="429" y2="139" stroke="#94a3b8" strokeWidth="2" />
          {/* Center Hub */}
          <circle cx="414" cy="154" r="5" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
        </g>

        {/* Wheel Arch Moldings */}
        <path d="M 94 154 C 94 136, 108 122, 126 122 C 144 122, 158 136, 158 154" stroke="#475569" strokeWidth="2" fill="none" />
        <path d="M 382 154 C 382 136, 396 122, 414 122 C 432 122, 446 136, 446 154" stroke="#475569" strokeWidth="2" fill="none" />
      </svg>
    </div>
  );
}

/**
 * FullPageCarMotionScene Component
 * Renders full-width behind the left floating card:
 * - Night highway environment with horizon city silhouette
 * - Smooth continuous perspective lane dashes
 * - Smooth luxury vehicle driving across from left to right periodically
 * - Completely transparent vector asset (NO photo borders, NO fake square artifacts)
 * - Zero intrusive text or fake stats!
 */
export default function FullPageCarMotionScene() {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none bg-[#07090e]">
      
      {/* 1. ATMOSPHERIC NIGHT SKY & CITY HORIZON */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#05070a] via-[#0a0e17] to-[#0e121a]">
        
        {/* Soft Ambient Horizon Light Glow */}
        <div className="absolute top-[38%] left-0 right-0 h-40 bg-gradient-to-t from-cyan-900/10 via-[#d4af37]/5 to-transparent blur-3xl" />

        {/* Distant City Skyline Silhouette & Bokeh Windows */}
        <div className="absolute top-[32%] sm:top-[36%] left-0 right-0 h-28 opacity-25 flex items-end justify-around">
          <div className="w-16 h-20 bg-slate-900/80 rounded-t-sm" />
          <div className="w-12 h-28 bg-slate-800/80 rounded-t-sm" />
          <div className="w-24 h-16 bg-slate-900/70 rounded-t-sm" />
          <div className="w-14 h-32 bg-slate-800/70 rounded-t-sm relative">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping absolute -top-2 left-1/2 -translate-x-1/2" />
          </div>
          <div className="w-20 h-24 bg-slate-900/80 rounded-t-sm" />
          <div className="w-10 h-16 bg-slate-800/80 rounded-t-sm" />
          <div className="w-28 h-20 bg-slate-900/70 rounded-t-sm" />
          <div className="w-16 h-36 bg-slate-800/90 rounded-t-sm relative">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse absolute -top-2 left-1/2 -translate-x-1/2" />
          </div>
          <div className="w-14 h-20 bg-slate-900/80 rounded-t-sm" />
          <div className="w-20 h-28 bg-slate-800/80 rounded-t-sm" />
        </div>

        {/* Highway Overpass Structure Line */}
        <div className="absolute top-[48%] left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-neutral-700/40 to-transparent" />
      </div>

      {/* 2. THE HIGHWAY & ASPHALT ROADBED */}
      <div className="absolute bottom-0 left-0 right-0 h-[48%] sm:h-[46%] bg-gradient-to-b from-[#11141b] via-[#090b0f] to-[#040507] border-t border-neutral-800/60 flex flex-col justify-between shadow-2xl">
        
        {/* Upper Road Shoulder / Guardrail with Reflectors */}
        <div className="w-full h-3 border-b border-neutral-800/80 flex items-center justify-around px-4 opacity-60">
          {[...Array(24)].map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-amber-500/60 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
          ))}
        </div>

        {/* Active Moving Highway Lane Dashes (Continuous Speed Flow) */}
        <div className="relative w-full h-10 flex items-center overflow-hidden my-auto opacity-80">
          <div className="absolute inset-0 flex items-center animate-road-travel">
            {[...Array(32)].map((_, i) => (
              <span
                key={i}
                className="inline-block w-12 sm:w-16 h-1.5 bg-amber-400 rounded-full mx-6 shrink-0 shadow-[0_0_12px_rgba(251,191,36,0.7)]"
              />
            ))}
          </div>
        </div>

        {/* Lower Road Shoulder / Curb Line */}
        <div className="w-full h-6 bg-[#040507] border-t border-neutral-800/80 flex items-center justify-between px-6">
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>

      </div>

      {/* 3. THE ANIMATED LUXURY VEHICLE GLIDING LEFT TO RIGHT */}
      <div className="absolute bottom-8 sm:bottom-12 left-0 right-0 w-full overflow-hidden flex items-end pointer-events-none">
        <div className="inline-block animate-car-drive-across">
          <div className="animate-suspension-bob">
            <RealisticLuxuryCar scale={1} />
          </div>
        </div>
      </div>

      {/* 4. PASSING OVERHEAD HIGHWAY LIGHTS (Adds Realistic Lighting Passing Overhead) */}
      <div className="absolute top-[35%] left-0 right-0 h-44 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute inset-0 flex items-center animate-ambient-lights">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="w-32 h-44 bg-gradient-to-b from-amber-200/25 via-amber-300/5 to-transparent mx-36 shrink-0 blur-xl"
            />
          ))}
        </div>
      </div>

      {/* 5. EMBEDDED HIGH-PERFORMANCE FLUID CSS ANIMATIONS */}
      <style>{`
        @keyframes carDriveAcross {
          0% {
            transform: translateX(-560px);
          }
          15% {
            transform: translateX(12vw);
          }
          45% {
            transform: translateX(45vw);
          }
          75% {
            transform: translateX(calc(100vw + 350px));
          }
          75.001% {
            transform: translateX(-560px);
          }
          100% {
            transform: translateX(-560px);
          }
        }

        @keyframes suspensionBob {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-1.5px) rotate(0.2deg);
          }
          50% {
            transform: translateY(1.2px) rotate(-0.15deg);
          }
          75% {
            transform: translateY(-0.8px) rotate(0.1deg);
          }
        }

        @keyframes roadTravel {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @keyframes ambientLights {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }

        @keyframes wheelSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .animate-car-drive-across {
          animation: carDriveAcross 8.5s ease-in-out infinite;
        }

        .animate-suspension-bob {
          animation: suspensionBob 0.5s ease-in-out infinite;
        }

        .animate-road-travel {
          animation: roadTravel 0.65s linear infinite;
        }

        .animate-ambient-lights {
          animation: ambientLights 4s linear infinite;
        }

        .animate-wheel-spin {
          animation: wheelSpin 0.28s linear infinite;
        }
      `}</style>

    </div>
  );
}
