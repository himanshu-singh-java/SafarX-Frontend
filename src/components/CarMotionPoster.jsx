import React, { useState, useEffect } from 'react';

const SHOWCASE_VEHICLES = [
  {
    id: 'gt',
    badge: '01 / PREMIER GT',
    name: 'SafarX 718 Cayman GT',
    subtitle: 'High-Performance Aerodynamic Coupe',
    image: '/luxury_sports_car.jpg',
    power: '300 HP',
    accel: '3.8s',
    topSpeed: '275 km/h',
    fareEstimate: '₹145.00',
    color: '#d4af37',
  },
  {
    id: 'prime',
    badge: '02 / PRIME EXECUTIVE',
    name: 'SafarX Prime Executive Sedan',
    subtitle: 'Luxury Comfort & Whisper Quiet Cabin',
    image: '/vehicle_car.jpg',
    power: '240 HP',
    accel: '5.2s',
    topSpeed: '220 km/h',
    fareEstimate: '₹124.90',
    color: '#38bdf8',
  },
  {
    id: 'moto',
    badge: '03 / SUPER MOTO',
    name: 'SafarX Stealth Moto',
    subtitle: 'Swift Urban Transit & Zero Traffic Delay',
    image: '/vehicle_moto.jpg',
    power: '45 HP',
    accel: '4.1s',
    topSpeed: '160 km/h',
    fareEstimate: '₹50.00',
    color: '#eab308',
  },
];

export default function CarMotionPoster({ onOpenAuth }) {
  const [activeCarIdx, setActiveCarIdx] = useState(0);
  const [animationMode, setAnimationMode] = useState('cruise');
  const activeCar = SHOWCASE_VEHICLES[activeCarIdx];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveCarIdx((prev) => (prev + 1) % SHOWCASE_VEHICLES.length);
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[520px] lg:min-h-[590px] rounded-3xl overflow-hidden bg-gradient-to-br from-[#0a0c10] via-[#12151c] to-[#0a0c10] border border-neutral-800/80 shadow-2xl flex flex-col justify-between p-6 sm:p-8 select-none text-white isolate">
      
      
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        
        <div className="absolute -top-32 right-1/4 w-[350px] h-[750px] bg-gradient-to-b from-white/10 via-[#d4af37]/5 to-transparent rotate-[28deg] blur-2xl" />
        
        
        <div className="absolute top-12 left-6 right-6 flex items-center justify-between text-neutral-800/40 font-black tracking-tighter select-none">
          <span className="text-5xl sm:text-7xl lg:text-8xl opacity-30 font-mono">2026</span>
          <span className="text-4xl sm:text-6xl font-black opacity-20 uppercase tracking-widest hidden sm:inline">
            SAFAR<span className="text-[#d4af37]">X</span>
          </span>
        </div>

        
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-[#d4af37]/10 rounded-full blur-3xl" />
      </div>

      
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1 bg-white/10 backdrop-blur-md border border-white/15 rounded-full text-[11px] font-black uppercase tracking-wider text-[#d4af37]">
            {activeCar.badge}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-mono text-neutral-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE MOTION CRUISE</span>
          </span>
        </div>

        
        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md p-1 rounded-2xl border border-white/10">
          {SHOWCASE_VEHICLES.map((car, idx) => (
            <button
              key={car.id}
              onClick={() => setActiveCarIdx(idx)}
              className={`px-3 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                activeCarIdx === idx
                  ? 'bg-gradient-to-r from-[#d4af37] via-amber-300 to-[#d4af37] text-black shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {car.id === 'gt' ? 'Coupe GT' : car.id === 'prime' ? 'Executive' : 'Moto'}
            </button>
          ))}
        </div>
      </div>

      
      <div className="relative my-auto py-8 sm:py-12 overflow-hidden flex flex-col justify-end min-h-[260px] sm:min-h-[300px]">
        
        
        <div className="text-center sm:text-left mb-2 z-10 px-2">
          <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md">
            {activeCar.name}
          </h3>
          <p className="text-xs text-neutral-400 font-medium">
            {activeCar.subtitle} • Available on SafarX Hyderabad Fleet
          </p>
        </div>

        
        <div className="relative w-full h-20 bg-gradient-to-b from-[#11141b] to-[#090b0e] border-y border-neutral-800 flex items-center overflow-hidden shadow-inner">
          
          
          <div className="absolute inset-0 flex items-center justify-around animate-road-travel opacity-75">
            {[...Array(16)].map((_, i) => (
              <span key={i} className="inline-block w-8 sm:w-12 h-1 bg-amber-400/80 rounded-full mx-3 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
            ))}
          </div>

          
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          
          
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/5 to-transparent animate-speed-streaks pointer-events-none" />
        </div>

        
        <div className="absolute bottom-3 left-0 right-0 h-44 sm:h-52 pointer-events-none overflow-hidden flex items-end">
          
          <div className="relative w-full flex items-end animate-car-drive-across">
            
            
            <div className="relative w-[310px] sm:w-[390px] lg:w-[430px] shrink-0 drop-shadow-[0_20px_25px_rgba(0,0,0,0.9)] animate-suspension-bob">
              
              
              <div className="absolute right-[-140px] top-[30%] w-[180px] h-[90px] bg-gradient-to-r from-amber-200/40 via-amber-300/15 to-transparent rotate-[-6deg] blur-md pointer-events-none -z-10" />
              
              
              <div className="absolute left-[-25px] top-[40%] w-[50px] h-[35px] bg-red-600/50 rounded-full blur-lg pointer-events-none -z-10" />

              
              <img
                src={activeCar.image}
                alt={activeCar.name}
                className="w-full h-auto object-contain max-h-[170px] sm:max-h-[200px] drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] filter brightness-105 contrast-105"
              />

              
              <div className="absolute bottom-1.5 left-[14%] w-10 h-10 rounded-full border border-amber-300/30 animate-spin-fast pointer-events-none opacity-60" />
              <div className="absolute bottom-1.5 right-[18%] w-10 h-10 rounded-full border border-amber-300/30 animate-spin-fast pointer-events-none opacity-60" />

              
              <div className="absolute bottom-0 left-10 right-10 h-3 bg-gradient-to-r from-red-600/30 via-[#d4af37]/40 to-amber-300/50 blur-md rounded-full" />
            </div>

          </div>

        </div>

      </div>

      
      <div className="relative z-10 pt-4 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        
        <div className="grid grid-cols-3 gap-4 sm:gap-6 text-center sm:text-left">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">Max Power</span>
            <span className="text-base sm:text-lg font-black font-mono text-white tracking-tight">{activeCar.power}</span>
          </div>

          <div className="space-y-0.5 border-x border-neutral-800 px-3 sm:px-6">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">0 - 100 KM/H</span>
            <span className="text-base sm:text-lg font-black font-mono text-[#d4af37] tracking-tight">{activeCar.accel}</span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">Base Fare</span>
            <span className="text-base sm:text-lg font-black font-mono text-white tracking-tight">{activeCar.fareEstimate}</span>
          </div>
        </div>

        
        <button
          type="button"
          onClick={() => {
            if (onOpenAuth) {
              onOpenAuth('login', 'Sign in to confirm and dispatch your SafarX ride.');
            }
          }}
          className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-[#d4af37] via-amber-400 to-[#d4af37] hover:brightness-110 active:scale-95 text-black font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-xl shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <span>Sign In to Book Ride</span>
          <span>→</span>
        </button>

      </div>

      
      <style>{`
        @keyframes carDriveAcross {
          0% {
            transform: translateX(-120%);
          }
          20% {
            transform: translateX(-15%);
          }
          65% {
            transform: translateX(18%);
          }
          85% {
            transform: translateX(50%);
          }
          100% {
            transform: translateX(160%);
          }
        }

        @keyframes suspensionBob {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-2px) rotate(0.4deg);
          }
          50% {
            transform: translateY(1.5px) rotate(-0.3deg);
          }
          75% {
            transform: translateY(-1px) rotate(0.2deg);
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

        @keyframes speedStreaks {
          0% {
            transform: translateX(100%);
            opacity: 0;
          }
          50% {
            opacity: 0.8;
          }
          100% {
            transform: translateX(-100%);
            opacity: 0;
          }
        }

        .animate-car-drive-across {
          animation: carDriveAcross 7.5s cubic-bezier(0.25, 1, 0.5, 1) infinite;
        }

        .animate-suspension-bob {
          animation: suspensionBob 0.6s ease-in-out infinite;
        }

        .animate-road-travel {
          animation: roadTravel 0.75s linear infinite;
        }

        .animate-speed-streaks {
          animation: speedStreaks 1.8s ease-in-out infinite;
        }

        .animate-spin-fast {
          animation: spin 0.25s linear infinite;
        }
      `}</style>

    </div>
  );
}
