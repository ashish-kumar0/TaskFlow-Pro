"use client";

import React from 'react';
import { Task } from '@/lib/types';
import { Sliders, AlertTriangle, RotateCcw, ArrowRight } from 'lucide-react';

interface SimulationBarProps {
  tasks: Task[];
  selectedTaskId: number | null;
  delayDays: number;
  affectedCount: number;
  slipDays: number;
  onSelectTask: (id: number | null) => void;
  onChangeDelay: (days: number) => void;
  onReset: () => void;
}

export const SimulationBar: React.FC<SimulationBarProps> = ({
  tasks,
  selectedTaskId,
  delayDays,
  affectedCount,
  slipDays,
  onSelectTask,
  onChangeDelay,
  onReset,
}) => {
  const isSimulating = selectedTaskId !== null && delayDays > 0;

  return (
    <div
      className={`mb-6 p-4 rounded-2xl border transition-all ${
        isSimulating
          ? 'bg-amber-50/90 border-amber-300 shadow-md ring-2 ring-amber-400/30'
          : 'bg-white border-slate-200/90 shadow-sm'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl ${
              isSimulating
                ? 'bg-amber-500 text-white animate-pulse'
                : 'bg-indigo-50 text-indigo-600'
            }`}
          >
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              What-If Delay Simulator
              {isSimulating && (
                <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Simulation Mode Active
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500">
              Model ripple effects on downstream dates without modifying actual records
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedTaskId || ''}
            onChange={(e) =>
              onSelectTask(e.target.value ? Number(e.target.value) : null)
            }
            className="text-xs px-3 py-2 border rounded-xl bg-white text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Select Task to simulate delay...</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.id} - {t.title} ({t.duration_days}d)
              </option>
            ))}
          </select>

          {selectedTaskId && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 border rounded-xl shadow-xs">
              <span className="text-xs font-semibold text-slate-600">Delay:</span>
              <input
                type="range"
                min="1"
                max="14"
                value={delayDays}
                onChange={(e) => onChangeDelay(Number(e.target.value))}
                className="w-24 accent-amber-600 cursor-pointer"
              />
              <span className="text-xs font-bold text-amber-700 min-w-[32px]">
                +{delayDays}d
              </span>
            </div>
          )}

          {isSimulating && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100/90 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>{affectedCount} Tasks Shifted</span>
                <ArrowRight className="w-3 h-3 text-rose-500" />
                <span>Delivery: +{slipDays}d Late</span>
              </div>

              <button
                onClick={onReset}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition"
                title="Reset simulation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
