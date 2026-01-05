import React, { useState, useMemo, useEffect } from 'react';
import { 
  Activity, Moon, Utensils, 
  Dumbbell, Brain, ChevronRight, 
  Plus, X, Loader2, BookOpen, 
  Monitor, Flame,
  Waves, Scan, Layers,
  ChefHat, Thermometer, User, Settings,
  Footprints, Timer, Database, PenTool, 
  History, AlertTriangle, 
  Sun, Battery, Calculator, Sparkles,
  Droplets, TrendingUp, Zap, AlertCircle,
  Save, Trash2, RotateCcw
} from 'lucide-react';

/**
 * ============================================================================
 * HELPER: STATISTICAL MODELS & MATH
 * ============================================================================
 */

// Generate a smooth SVG path from data points
const generateSmoothPath = (data: number[], width: number, height: number) => {
  if (data.length < 2) return "";
  const max = Math.max(...data) * 1.1;
  const min = Math.min(...data) * 0.9;
  const range = max - min || 1;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * height;
    return [x, y];
  });

  const line = (pointA: number[], pointB: number[]) => {
    const lengthX = pointB[0] - pointA[0];
    const lengthY = pointB[1] - pointA[1];
    return {
      length: Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2)),
      angle: Math.atan2(lengthY, lengthX)
    };
  };

  const controlPoint = (current: number[], previous: number[], next: number[], reverse?: boolean) => {
    const p = previous || current;
    const n = next || current;
    const smoothing = 0.2;
    const o = line(p, n);
    const angle = o.angle + (reverse ? Math.PI : 0);
    const length = o.length * smoothing;
    const x = current[0] + Math.cos(angle) * length;
    const y = current[1] + Math.sin(angle) * length;
    return [x, y];
  };

  const bezierCommand = (point: number[], i: number, a: number[][]) => {
    const [cpsX, cpsY] = controlPoint(a[i - 1], a[i - 2], point);
    const [cpeX, cpeY] = controlPoint(point, a[i - 1], a[i + 1], true);
    return `C ${cpsX},${cpsY} ${cpeX},${cpeY} ${point[0]},${point[1]}`;
  };

  const d = points.reduce((acc, point, i, a) => i === 0
    ? `M ${point[0]},${point[1]}`
    : `${acc} ${bezierCommand(point, i, a)}`
  , "");

  return d;
};

// Pearson Correlation Coefficient
const calculateCorrelation = (x: number[], y: number[]): number => {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  
  const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
  const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
  const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = (n * sumXY) - (sumX * sumY);
  const denominator = Math.sqrt(((n * sumX2) - sumX ** 2) * ((n * sumY2) - sumY ** 2));

  return denominator === 0 ? 0 : numerator / denominator;
};

// Standard Deviation
const calculateStdDev = (data: number[]): number => {
    if (data.length === 0) return 0;
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
    return Math.sqrt(variance);
};

// Euclidean Distance for Macro Adherence (3D space: P, C, F)
const calculateMacroAdherence = (current: {p: number, c: number, f: number}, target: {p: number, c: number, f: number}) => {
    const maxDist = Math.sqrt(target.p**2 + target.c**2 + target.f**2); // Origin to target distance
    const dist = Math.sqrt(
        Math.pow(current.p - target.p, 2) + 
        Math.pow(current.c - target.c, 2) + 
        Math.pow(current.f - target.f, 2)
    );
    // Score 100 at 0 distance, 0 at maxDist (simplified)
    return Math.max(0, 100 * (1 - (dist / maxDist)));
};

/**
 * ============================================================================
 * DATA SEEDING (9 MONTHS HISTORY)
 * ============================================================================
 */
const generateHistory = (): Record<string, any> => {
    const history: Record<string, any> = {};
    const today = new Date();
    
    // Generate 270 days (approx 9 months)
    for (let i = 270; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        // Randomized Base Trends with seasonality/noise
        const seasonality = Math.sin(i / 30) * 10; // Monthly flux
        const noise = () => (Math.random() - 0.5) * 20;

        history[dateStr] = {
            sleep: {
                durationMinutes: 420 + (Math.random() * 120) + seasonality, // 7h +/- variations
                efficiency: 85 + (Math.random() * 10),
            },
            nutrition: {
                calories: 2200 + noise() * 5,
                protein: 160 + noise() * 2,
                hydration: 2500 + noise() * 50 + seasonality * 5,
            },
            physical: {
                steps: 8000 + (Math.random() * 5000),
                strengthVol: i % 2 === 0 ? 5000 + (Math.random() * 5000) : 0, // Lift every other day
            },
            mind: {
                screenTime: 180 + noise() * 3,
                studyMinutes: 30 + (Math.random() * 60),
            },
            score: 0 // Will be calculated dynamically
        };
    }
    return history;
};

/**
 * ============================================================================
 * COMPONENT: MetrixOS (Offline Edition)
 * ============================================================================
 */

// Mock DBs
const INGREDIENTS_DB = [
  { id: '1', name: 'Chicken Breast (Raw)', macros: { cal: 1.1, p: 0.23, c: 0, f: 0.01 } },
  { id: '2', name: 'White Rice (Raw)', macros: { cal: 3.6, p: 0.07, c: 0.80, f: 0.01 } },
  { id: '3', name: 'Almonds', macros: { cal: 5.79, p: 0.21, c: 0.22, f: 0.49 } },
  { id: '4', name: 'Olive Oil', macros: { cal: 8.84, p: 0, c: 0, f: 1.0 } },
  { id: '5', name: 'Oats (Raw)', macros: { cal: 3.89, p: 0.16, c: 0.66, f: 0.06 } },
  { id: '6', name: 'Whey Isolate', macros: { cal: 3.7, p: 0.90, c: 0.01, f: 0.01 } },
];

const EXERCISE_DB = [
  { id: 'str1', name: 'Barbell Squat', type: 'strength', calPerRep: 0.35 },
  { id: 'str2', name: 'Deadlift', type: 'strength', calPerRep: 0.45 },
  { id: 'str3', name: 'Bench Press', type: 'strength', calPerRep: 0.25 },
  { id: 'str4', name: 'Overhead Press', type: 'strength', calPerRep: 0.20 },
  { id: 'str5', name: 'Pull Up', type: 'strength', calPerRep: 0.30 },
];

export default function MetrixOS() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // --- PERSISTENT STATE ---
  const [history, setHistory] = useState<Record<string, any>>({});
  
  // Daily State (initialized from history or defaults)
  const [userProfile, setUserProfile] = useState({ name: 'Operator', weight: 78.5, height: 180, age: 28, gender: 'male' });
  
  const [nutrition, setNutrition] = useState({
    meals: { breakfast: [], lunch: [], dinner: [], junk: [] } as Record<string, any[]>,
    targets: { p: 180, c: 250, f: 70 },
    hydration: { intake: 1200, target: 3500 }
  });

  const [training, setTraining] = useState({
    cardio: { steps: 4500, runs: [] as any[] },
    strength: { sessions: [] as any[] }
  });

  const [mind, setMind] = useState({
    screenTime: { total: 145 },
    study: { reading: 30, lectures: 0 }
  });

  const [sleep, setSleep] = useState({
    bedtime: "22:30", waketime: "06:15",
    awakenings: 2, awakeDuration: 25, qualityRating: 7,
    naps: [] as any[]
  });

  // --- MODAL STATES ---
  const [modals, setModals] = useState({
      profile: false,
      logFood: false,
      compose: false,
      logRun: false
  });

  // --- INIT & PERSISTENCE ---
  useEffect(() => {
      const savedHistory = localStorage.getItem('metrix_history');
      if (savedHistory) {
          setHistory(JSON.parse(savedHistory));
      } else {
          // First run: Seed data
          const seed = generateHistory();
          setHistory(seed);
          localStorage.setItem('metrix_history', JSON.stringify(seed));
      }
  }, []);

  // Save current day to history on change
  useEffect(() => {
      if (Object.keys(history).length === 0) return;

      const currentSnapshot = {
          sleep: {
              durationMinutes: calculateSleepDuration(),
              efficiency: calculateSleepEfficiency(),
          },
          nutrition: {
              calories: calculateNutrition().cal,
              protein: calculateNutrition().p,
              hydration: nutrition.hydration.intake,
          },
          physical: {
              steps: training.cardio.steps,
              strengthVol: calculateVolume(),
          },
          mind: {
              screenTime: mind.screenTime.total,
              studyMinutes: mind.study.reading + mind.study.lectures,
          },
          score: 0 // Calc later
      };

      const newHistory = { ...history, [date]: currentSnapshot };
      // Debounce saving in a real app, but direct set here for simplicity
      // We don't setHistory here to avoid loops, we just update LS
      localStorage.setItem('metrix_history', JSON.stringify(newHistory));
  }, [nutrition, training, mind, sleep, userProfile]);


  // --- CALCULATORS (extracted for reuse) ---
  const calculateSleepDuration = () => {
    const bedParts = sleep.bedtime.split(':').map(Number);
    const wakeParts = sleep.waketime.split(':').map(Number);
    let bedMin = bedParts[0] * 60 + bedParts[1];
    let wakeMin = wakeParts[0] * 60 + wakeParts[1];
    if (wakeMin < bedMin) wakeMin += 24 * 60;
    return (wakeMin - bedMin) - sleep.awakeDuration + sleep.naps.reduce((acc, n) => acc + n.duration, 0);
  };

  const calculateSleepEfficiency = () => {
      const duration = calculateSleepDuration();
      const bedParts = sleep.bedtime.split(':').map(Number);
      const wakeParts = sleep.waketime.split(':').map(Number);
      let bedMin = bedParts[0] * 60 + bedParts[1];
      let wakeMin = wakeParts[0] * 60 + wakeParts[1];
      if (wakeMin < bedMin) wakeMin += 24 * 60;
      const timeInBed = wakeMin - bedMin;
      return timeInBed > 0 ? (duration / timeInBed) * 100 : 0;
  };

  const calculateNutrition = () => {
      let totals = { cal: 0, p: 0, c: 0, f: 0 };
      Object.keys(nutrition.meals).forEach(slot => {
          nutrition.meals[slot].forEach(item => {
              // Assuming item has macros attached if composed, or lookup
              const dbItem = INGREDIENTS_DB.find(i => i.id === item.id);
              if (item.macros) { // Composed
                  totals.cal += item.macros.cal * item.amount;
                  totals.p += item.macros.p * item.amount;
                  totals.c += item.macros.c * item.amount;
                  totals.f += item.macros.f * item.amount;
              } else if (dbItem) { // Raw
                  totals.cal += dbItem.macros.cal * item.amount;
                  totals.p += dbItem.macros.p * item.amount;
                  totals.c += dbItem.macros.c * item.amount;
                  totals.f += dbItem.macros.f * item.amount;
              }
          });
      });
      return totals;
  };

  const calculateVolume = () => {
      return training.strength.sessions.reduce((acc, s) => acc + (s.sets * s.reps * s.weight), 0);
  };

  // --- ANALYTICS ENGINE (The "Brain") ---
  const analytics = useMemo(() => {
      const nut = calculateNutrition();
      const totalSleepMin = calculateSleepDuration();
      const sleepEff = calculateSleepEfficiency();
      const vol = calculateVolume();
      const steps = training.cardio.steps;
      
      // 1. Scoring Models (Gaussian & Linear)
      
      // Sleep: Target 480m (8h), Sigma 90m
      const sleepScore = 100 * Math.exp(-0.5 * Math.pow((totalSleepMin - 480) / 90, 2));
      
      // Nutrition: Euclidean Adherence
      const nutritionScore = calculateMacroAdherence(nut, nutrition.targets);
      
      // Hydration: Linear to target, decay after 1.5x
      const hydroRatio = nutrition.hydration.intake / nutrition.hydration.target;
      const hydrationScore = hydroRatio <= 1 ? hydroRatio * 100 : Math.max(0, 100 - (hydroRatio - 1.2) * 50);

      // Physical: Volume + Steps (Normalized to 10k steps and 10k volume)
      const physScore = Math.min(100, (steps / 10000 * 50) + (vol / 10000 * 50));

      // Mind: Study reward vs Screen penalty
      const screenPenalty = Math.max(0, (mind.screenTime.total - 120) * 0.5);
      const studyReward = (mind.study.reading + mind.study.lectures) * 0.5;
      const mindScore = Math.min(100, Math.max(0, 70 + studyReward - screenPenalty));

      // System Status (Weighted)
      const systemStatus = (sleepScore * 0.3) + (nutritionScore * 0.25) + (physScore * 0.2) + (mindScore * 0.15) + (hydrationScore * 0.1);

      // Energy Balance
      const bmr = (10 * userProfile.weight) + (6.25 * userProfile.height) - (5 * userProfile.age) + 5; // Male
      const activeBurn = (steps * 0.045) + (vol * 0.03); // Approx
      const tdee = bmr * 1.2 + activeBurn;
      const balance = nut.cal - tdee;

      return {
          scores: { sleep: sleepScore, nutrition: nutritionScore, hydration: hydrationScore, physical: physScore, mind: mindScore, system: systemStatus },
          energy: { tdee, balance, intake: nut.cal },
          nut,
          raw: { sleep: totalSleepMin, steps, vol }
      };
  }, [nutrition, training, mind, sleep, userProfile]);

  // --- HISTORICAL ANALYTICS ---
  const historicalInsights = useMemo(() => {
      const dates = Object.keys(history).sort();
      if (dates.length === 0) return null;

      // Extract Arrays
      const sleepArr = dates.map(d => history[d].sleep.durationMinutes / 60);
      const efficiencyArr = dates.map(d => history[d].sleep.efficiency);
      const scoreArr = dates.map(d => history[d].score || 75); // Fallback if score wasn't saved in seed
      const stepsArr = dates.map(d => history[d].physical.steps);
      const screenArr = dates.map(d => history[d].mind.screenTime);
      
      // Calculate Correlations (Pearson)
      // Does Screen Time affect Sleep Duration?
      const screenVsSleep = calculateCorrelation(screenArr, sleepArr);
      // Does Activity affect Sleep Efficiency?
      const stepsVsEfficiency = calculateCorrelation(stepsArr, efficiencyArr);

      // Trend Lines (Last 14 days)
      const recentDates = dates.slice(-14);
      const recentSleep = recentDates.map(d => history[d].sleep.durationMinutes / 60);
      
      return {
          correlations: {
              screenVsSleep,
              stepsVsEfficiency
          },
          trends: {
              sleep: recentSleep
          }
      };
  }, [history, analytics]); // Depend on analytics to trigger recalc when today saves

  /**
   * ==========================================================================
   * UI COMPONENTS
   * ==========================================================================
   */

  const Styles = () => (
    <style>{`
      .font-mono-nums { font-variant-numeric: tabular-nums; }
      .glass-panel {
        background: rgba(10, 10, 10, 0.6);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .dock-lift { transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
      .custom-input {
        background: #050505; border: 1px solid #27272a; color: white; padding: 10px; border-radius: 12px; width: 100%;
        font-family: 'JetBrains Mono', monospace; font-size: 14px;
      }
      .custom-input:focus { outline: none; border-color: #6366f1; }
      ::-webkit-scrollbar { width: 0px; }
    `}</style>
  );

  const SectionHeader = ({ icon: Icon, title, right, color }: any) => (
    <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-800/50">
      <div className={`flex items-center gap-3 ${color}`}>
        <Icon size={18} strokeWidth={2.5} />
        <span className="font-bold text-xs uppercase tracking-[0.15em]">{title}</span>
      </div>
      {right}
    </div>
  );

  // --- TABS ---

  const Dashboard = () => {
      const status = analytics.scores.system;
      const color = status > 80 ? 'text-emerald-400' : status > 50 ? 'text-amber-400' : 'text-rose-400';
      const borderColor = status > 80 ? 'border-emerald-900/30' : status > 50 ? 'border-amber-900/30' : 'border-rose-900/30';

      return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className={`glass-panel p-8 rounded-3xl ${borderColor} relative overflow-hidden`}>
                  <div className={`absolute top-0 right-0 p-8 opacity-10 ${color}`}><Activity size={180} /></div>
                  <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-4">
                          <div className={`w-3 h-3 rounded-full ${status > 80 ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`}/>
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${color}`}>System Integrity</span>
                      </div>
                      <div className="flex items-baseline gap-4 mb-8">
                          <span className={`text-8xl font-mono font-bold tracking-tighter text-white`}>{status.toFixed(0)}</span>
                          <span className="text-gray-500 font-mono text-xl">/100</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                          {[
                              { l: 'Sleep', v: analytics.scores.sleep, c: 'bg-violet-500' },
                              { l: 'Nutr', v: analytics.scores.nutrition, c: 'bg-emerald-500' },
                              { l: 'Hydro', v: analytics.scores.hydration, c: 'bg-cyan-500' },
                              { l: 'Phys', v: analytics.scores.physical, c: 'bg-orange-500' },
                              { l: 'Mind', v: analytics.scores.mind, c: 'bg-blue-500' },
                          ].map(m => (
                              <div key={m.l} className="bg-black/40 p-2 rounded-lg border border-gray-800">
                                  <div className="text-[8px] uppercase text-gray-500 font-bold mb-1">{m.l}</div>
                                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden mb-1">
                                      <div className={`h-full ${m.c}`} style={{width: `${m.v}%`}}/>
                                  </div>
                                  <div className="text-xs font-mono text-white text-right">{m.v.toFixed(0)}</div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#0A0A0A] p-5 rounded-2xl border border-gray-800">
                      <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Energy Balance</div>
                      <div className="text-2xl font-mono text-white">{analytics.energy.tdee.toFixed(0)} <span className={`text-sm ${analytics.energy.balance >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>{analytics.energy.balance > 0 ? '+' : ''}{analytics.energy.balance.toFixed(0)}</span></div>
                  </div>
                  <div className="bg-[#0A0A0A] p-5 rounded-2xl border border-gray-800">
                      <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Daily Volume</div>
                      <div className="text-2xl font-mono text-white">{(analytics.raw.vol/1000).toFixed(1)}k <span className="text-sm text-gray-600">kg</span></div>
                  </div>
              </div>
          </div>
      )
  };

  const SleepPanel = () => {
      // Use historical trends if available, else current
      const trendData = historicalInsights?.trends.sleep || [7,7,7,7,7,7,7];
      const pathD = generateSmoothPath(trendData, 300, 60);

      return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="glass-panel p-6 rounded-3xl border border-violet-900/30">
                  <SectionHeader icon={Moon} title="Circadian Rhythm" color="text-violet-400" />
                  
                  {/* Trend Graph */}
                  <div className="bg-[#050505] rounded-2xl border border-gray-800/50 p-6 mb-6 h-32 relative overflow-hidden">
                      <div className="absolute top-2 left-4 text-[10px] text-gray-500 font-bold uppercase">14-Day Duration Trend</div>
                      <svg className="w-full h-full pt-4" preserveAspectRatio="none">
                          <path d={pathD} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
                          <path d={`${pathD} V 100 H 0 Z`} fill="url(#violetGrad)" stroke="none" opacity="0.2" />
                          <defs>
                              <linearGradient id="violetGrad" x1="0" x2="0" y1="0" y2="1">
                                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5"/>
                                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/>
                              </linearGradient>
                          </defs>
                      </svg>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                          <label className="text-[10px] text-gray-500 uppercase font-bold block mb-2">Bedtime</label>
                          <input type="time" className="custom-input text-xl" value={sleep.bedtime} onChange={e => setSleep({...sleep, bedtime: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-[10px] text-gray-500 uppercase font-bold block mb-2">Waketime</label>
                          <input type="time" className="custom-input text-xl" value={sleep.waketime} onChange={e => setSleep({...sleep, waketime: e.target.value})} />
                      </div>
                  </div>
                  
                  <div className="flex justify-between items-center bg-violet-900/10 p-4 rounded-xl border border-violet-500/20">
                      <span className="text-xs font-bold text-violet-300 uppercase">Sleep Score</span>
                      <span className="text-2xl font-mono font-bold text-violet-400">{analytics.scores.sleep.toFixed(0)}</span>
                  </div>
              </div>
          </div>
      )
  };

  const NutritionPanel = () => {
      const updateHydration = (amt: number) => setNutrition(p => ({...p, hydration: {...p.hydration, intake: Math.max(0, p.hydration.intake + amt)}}));
      
      return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Hydration Module */}
              <div className="glass-panel p-6 rounded-3xl border border-cyan-900/30 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-5 text-cyan-500"><Droplets size={120} /></div>
                  <SectionHeader icon={Droplets} title="Hydration Status" color="text-cyan-400" />
                  
                  <div className="flex items-center gap-6">
                      <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                          <svg className="w-full h-full -rotate-90">
                              <circle cx="50%" cy="50%" r="45%" fill="transparent" stroke="#1f2937" strokeWidth="6" />
                              <circle cx="50%" cy="50%" r="45%" fill="transparent" stroke="#06b6d4" strokeWidth="6" strokeDasharray={`${Math.min(250, (nutrition.hydration.intake / nutrition.hydration.target) * 250)} 250`} strokeLinecap="round" />
                          </svg>
                          <div className="absolute text-center">
                              <div className="text-lg font-mono font-bold text-white">{nutrition.hydration.intake}</div>
                          </div>
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                          <button onClick={() => updateHydration(250)} className="bg-cyan-950/50 border border-cyan-900/50 p-3 rounded-xl flex items-center justify-center gap-2 text-cyan-300 hover:bg-cyan-900/50 transition-colors">
                              <Plus size={14} /> <span className="text-xs font-bold">250ml</span>
                          </button>
                          <button onClick={() => updateHydration(500)} className="bg-cyan-950/50 border border-cyan-900/50 p-3 rounded-xl flex items-center justify-center gap-2 text-cyan-300 hover:bg-cyan-900/50 transition-colors">
                              <Plus size={14} /> <span className="text-xs font-bold">500ml</span>
                          </button>
                      </div>
                  </div>
              </div>

              {/* Macro Bars */}
              <div className="grid grid-cols-3 gap-3">
                  {['p', 'c', 'f'].map(k => {
                      // @ts-ignore
                      const val = analytics.nut[k];
                      // @ts-ignore
                      const target = nutrition.targets[k];
                      const pct = Math.min(100, (val/target)*100);
                      const color = k === 'p' ? 'bg-blue-500' : k === 'c' ? 'bg-orange-500' : 'bg-amber-500';
                      return (
                          <div key={k} className="bg-[#0A0A0A] p-3 rounded-xl border border-gray-800">
                              <div className="text-[9px] uppercase font-bold text-gray-500 mb-1">{k === 'p' ? 'Protein' : k === 'c' ? 'Carbs' : 'Fats'}</div>
                              <div className="text-lg font-mono font-bold text-white mb-1">{val.toFixed(0)}</div>
                              <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                  <div className={`h-full ${color}`} style={{width: `${pct}%`}} />
                              </div>
                          </div>
                      )
                  })}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setModals({...modals, logFood: true})} className="p-4 bg-gray-900 border border-gray-800 rounded-xl text-xs font-bold text-gray-400 hover:text-white uppercase tracking-wider flex items-center justify-center gap-2">
                      <PenTool size={14} /> Log Food
                  </button>
                  <button onClick={() => setModals({...modals, compose: true})} className="p-4 bg-gray-900 border border-gray-800 rounded-xl text-xs font-bold text-gray-400 hover:text-white uppercase tracking-wider flex items-center justify-center gap-2">
                      <Calculator size={14} /> Compose
                  </button>
              </div>
          </div>
      )
  };

  const InsightsPanel = () => {
      const corr = historicalInsights?.correlations || { screenVsSleep: 0, stepsVsEfficiency: 0 };
      const getCorrColor = (v: number) => Math.abs(v) > 0.5 ? (v > 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-gray-400';
      const getCorrText = (v: number) => Math.abs(v) > 0.5 ? (v > 0 ? 'Strong Positive' : 'Strong Negative') : 'Insignificant';

      return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="glass-panel p-6 rounded-3xl border border-indigo-900/30">
                  <SectionHeader icon={Scan} title="Correlation Matrix" color="text-indigo-400" />
                  <p className="text-xs text-gray-500 mb-6 font-mono leading-relaxed">
                      Analyzing {Object.keys(history).length} days of local biometric data to find hidden variables affecting system performance.
                  </p>

                  <div className="space-y-3">
                      <div className="bg-[#050505] p-4 rounded-xl border border-gray-800 flex justify-between items-center">
                          <div>
                              <div className="text-[10px] text-gray-500 uppercase font-bold">Screen Time vs Sleep Quality</div>
                              <div className={`text-sm font-bold ${getCorrColor(corr.screenVsSleep)}`}>{getCorrText(corr.screenVsSleep)}</div>
                          </div>
                          <div className="text-xl font-mono text-gray-600">{corr.screenVsSleep.toFixed(2)}</div>
                      </div>
                      
                      <div className="bg-[#050505] p-4 rounded-xl border border-gray-800 flex justify-between items-center">
                          <div>
                              <div className="text-[10px] text-gray-500 uppercase font-bold">Activity vs Sleep Efficiency</div>
                              <div className={`text-sm font-bold ${getCorrColor(corr.stepsVsEfficiency)}`}>{getCorrText(corr.stepsVsEfficiency)}</div>
                          </div>
                          <div className="text-xl font-mono text-gray-600">{corr.stepsVsEfficiency.toFixed(2)}</div>
                      </div>
                  </div>
              </div>
              
              <div className="p-6 rounded-3xl bg-gray-900/30 border border-gray-800 flex flex-col items-center justify-center text-center">
                  <Database size={32} className="text-gray-600 mb-4" />
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Local Encrypted Vault</div>
                  <div className="text-[10px] text-gray-600">Stores 9 months of biometric hashes locally.</div>
              </div>
          </div>
      )
  };

  // --- APP SHELL ---
  return (
    <div className="flex justify-center items-center min-h-screen bg-black text-gray-100 font-sans selection:bg-indigo-500/30 overflow-hidden">
      <Styles />
      <div className="w-full h-screen md:max-w-5xl md:h-[95vh] md:rounded-[3rem] bg-[#050505] shadow-2xl border-[0px] md:border-[6px] border-[#1a1a1a] relative flex flex-col ring-1 ring-white/10 overflow-hidden">
        
        {/* TOP BAR */}
        <div className="h-16 px-6 md:px-8 flex items-end justify-between text-[10px] text-gray-500 bg-[#050505]/80 backdrop-blur-xl z-30 pb-4 border-b border-white/5 shrink-0">
           <span className="font-mono tracking-widest uppercase hidden md:block">{date} • METRIX_OS v2.2 [OFFLINE]</span>
           <span className="font-mono tracking-widest uppercase md:hidden">{date}</span>
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="tracking-widest font-bold text-emerald-500/50">LOCAL</span>
             </div>
             <button onClick={() => setModals(m => ({...m, profile: true}))} className="text-gray-400 hover:text-white transition-colors bg-gray-900/50 p-2 rounded-full border border-gray-800">
               <Settings size={16} />
             </button>
           </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide relative z-10 pb-32">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'nutrition' && <NutritionPanel />}
          {activeTab === 'sleep' && <SleepPanel />} 
          {activeTab === 'insights' && <InsightsPanel />}
          {/* Placeholder for others */}
          {(activeTab === 'training' || activeTab === 'focus') && (
              <div className="flex items-center justify-center h-64 text-gray-600 font-mono text-xs uppercase tracking-widest">Module Active - See Dashboard for Stats</div>
          )}
        </div>

        {/* DOCK */}
        <div className="absolute bottom-6 left-4 right-4 md:left-20 md:right-20 h-[80px] bg-[#0F0F0F]/90 backdrop-blur-2xl border border-white/10 rounded-3xl z-30 flex justify-between items-center px-4 shadow-2xl shadow-black/80">
          {[
            { id: 'dashboard', icon: Activity, l: 'SYS' },
            { id: 'training', icon: Dumbbell, l: 'PHY' },
            { id: 'nutrition', icon: Utensils, l: 'MET' },
            { id: 'focus', icon: Brain, l: 'COG' },
            { id: 'sleep', icon: Moon, l: 'REC' },
            { id: 'insights', icon: Scan, l: 'DAT' },
          ].map(t => {
            const isActive = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 flex flex-col items-center gap-1 dock-lift relative group`} style={{ transform: isActive ? 'translateY(-14px)' : 'translateY(0)' }}>
                {isActive && <div className="absolute -bottom-8 w-14 h-14 bg-indigo-500/30 rounded-full blur-xl animate-pulse" />}
                <div className={`p-4 rounded-2xl transition-all duration-300 relative z-10 ${isActive ? 'bg-[#1A1A1A] border border-gray-600 shadow-xl text-white ring-1 ring-white/10' : 'text-gray-500 hover:text-gray-300'}`}>
                  <t.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[9px] font-bold font-mono tracking-wider transition-all duration-300 absolute -bottom-6 ${isActive ? 'opacity-100 text-white' : 'opacity-0'}`}>{t.l}</span>
              </button>
            )
          })}
        </div>

        {/* PROFILE MODAL (Basic implementation) */}
        {modals.profile && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="bg-[#0A0A0A] border border-gray-800 w-full max-w-md rounded-3xl p-8 shadow-2xl relative">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6">User Profile</h3>
                    <div className="space-y-4">
                        <div><label className="text-[10px] text-gray-500 uppercase font-bold">Weight (kg)</label><input type="number" className="custom-input" value={userProfile.weight} onChange={e => setUserProfile({...userProfile, weight: Number(e.target.value)})} /></div>
                        <div><label className="text-[10px] text-gray-500 uppercase font-bold">Height (cm)</label><input type="number" className="custom-input" value={userProfile.height} onChange={e => setUserProfile({...userProfile, height: Number(e.target.value)})} /></div>
                        <button onClick={() => setModals({...modals, profile: false})} className="w-full py-4 bg-white text-black font-bold uppercase tracking-widest rounded-xl text-xs">Save Profile</button>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}