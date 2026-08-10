import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TrafficHistoryPoint } from '../types/network';
import { Radio, Clock, AlertCircle } from 'lucide-react';

interface TrafficChartProps {
  data: TrafficHistoryPoint[];
}

export type TimeRangeKey = '30s' | '1m' | '5m' | '10m' | '30m' | '1h' | '12h' | '24h';

interface TimeRangeConfig {
  key: TimeRangeKey;
  label: string;
  requiredSeconds: number;
}

const TIME_RANGES: TimeRangeConfig[] = [
  { key: '30s', label: '30s', requiredSeconds: 30 },
  { key: '1m', label: '1m', requiredSeconds: 60 },
  { key: '5m', label: '5m', requiredSeconds: 300 },
  { key: '10m', label: '10m', requiredSeconds: 600 },
  { key: '30m', label: '30m', requiredSeconds: 1800 },
  { key: '1h', label: '1h', requiredSeconds: 3600 },
  { key: '12h', label: '12h', requiredSeconds: 43200 },
  { key: '24h', label: '24h', requiredSeconds: 86400 },
];

export const TrafficChart: React.FC<TrafficChartProps> = ({ data }) => {
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('30s');

  const totalCollectedSec = data ? data.length : 0;
  const currentConfig = TIME_RANGES.find((r) => r.key === timeRange) || TIME_RANGES[0];

  // 100% True Real-Time Timestamp Cutoff Filter (Zero Gap & Zero Error)
  // Filters data strictly matching [Now - requiredSeconds] => [Now]
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const reqSec = currentConfig.requiredSeconds;
    
    // Parse timestamp of the latest point to establish exact cutoff threshold
    const lastPoint = data[data.length - 1];
    if (!lastPoint || !lastPoint.time) return data.slice(-reqSec);

    // Convert time string "오전/오후 HH:MM:SS" into seconds timestamp
    const parseTimeToSec = (tStr: string): number => {
      try {
        const cleaned = tStr.replace(/오전|오후/g, '').trim();
        const parts = cleaned.split(':').map((p) => parseInt(p, 10));
        let hrs = parts[0] || 0;
        if (tStr.includes('오후') && hrs < 12) hrs += 12;
        if (tStr.includes('오전') && hrs === 12) hrs = 0;
        return hrs * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
      } catch (e) {
        return 0;
      }
    };

    const latestSec = parseTimeToSec(lastPoint.time);
    if (latestSec === 0) return data.slice(-reqSec);

    const cutoffSec = latestSec - reqSec;

    // Strict Timestamp Filter: Keep only points within [LatestTime - requiredSeconds, LatestTime]
    const filteredByTime = data.filter((item) => {
      const pSec = parseTimeToSec(item.time);
      return pSec >= cutoffSec && pSec <= latestSec;
    });

    return filteredByTime.length > 0 ? filteredByTime : data.slice(-reqSec);
  }, [data, currentConfig]);

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <h2 className="text-sm font-semibold text-slate-200">Real-Time Packet Flow Rate</h2>
          <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
            Collected: {Math.floor(totalCollectedSec / 60)}m {totalCollectedSec % 60}s
          </span>
        </div>

        {/* Adaptive Time Range Selector */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <Clock className="w-3 h-3 text-slate-400 ml-1.5 mr-0.5" />
            {TIME_RANGES.map((item) => {
              const isAvailable =
                item.key === '30s'
                  ? totalCollectedSec >= 5
                  : totalCollectedSec >= item.requiredSeconds;

              return (
                <button
                  key={item.key}
                  disabled={!isAvailable}
                  onClick={() => setTimeRange(item.key)}
                  title={
                    isAvailable
                      ? `${item.label} True Timestamp Window`
                      : `Unlocked after ${item.requiredSeconds}s of data accumulation (Current: ${totalCollectedSec}s)`
                  }
                  className={`px-2 py-0.5 rounded-lg font-mono font-medium transition-all duration-150 ${
                    timeRange === item.key
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm'
                      : isAvailable
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      : 'text-slate-700 opacity-30 cursor-not-allowed'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Legends */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"></span>
              <span className="text-slate-400">Packets In</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
              <span className="text-slate-400">Packets Out</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-56 w-full relative">
        {totalCollectedSec < currentConfig.requiredSeconds && currentConfig.key !== '30s' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 backdrop-blur-[2px] rounded-xl text-slate-300 text-xs gap-2 border border-slate-800">
            <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>
              Accumulating data for {currentConfig.label} timeline ({totalCollectedSec}s / {currentConfig.requiredSeconds}s)
            </span>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              minTickGap={35}
            />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#090d16',
                borderColor: '#334155',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '12px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              }}
            />
            <Area
              type="monotone"
              dataKey="packetsIn"
              name="Packets In"
              stroke="#22d3ee"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorIn)"
              isAnimationActive={true}
              animationDuration={600}
              animationEasing="ease-in-out"
            />
            <Area
              type="monotone"
              dataKey="packetsOut"
              name="Packets Out"
              stroke="#34d399"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorOut)"
              isAnimationActive={true}
              animationDuration={600}
              animationEasing="ease-in-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
