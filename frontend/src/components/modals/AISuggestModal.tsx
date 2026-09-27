"use client";

import React, { useState, useEffect } from 'react';
import { DependencyProposal, Task } from '@/lib/types';
import { Sparkles, Check, CheckCircle2 } from 'lucide-react';

interface AISuggestModalProps {
  isOpen: boolean;
  proposals: DependencyProposal[];
  tasks: Task[];
  onClose: () => void;
  onApply: (selectedProposals: DependencyProposal[]) => void;
}

export const AISuggestModal: React.FC<AISuggestModalProps> = ({
  isOpen,
  proposals,
  tasks,
  onClose,
  onApply,
}) => {
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    if (proposals.length > 0) {
      setSelected(proposals.map((_, i) => i));
    } else {
      setSelected([]);
    }
  }, [proposals]);

  if (!isOpen) return null;

  const toggleSelect = (index: number) => {
    setSelected(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const getTaskTitle = (id: number) => tasks.find(t => t.id === id)?.title || `Task #${id}`;

  const handleConfirm = () => {
    const chosen = proposals.filter((_, i) => selected.includes(i));
    onApply(chosen);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">AI Dependency Recommendations</h2>
            <p className="text-xs text-slate-500">Human-in-the-loop review: Approve or reject suggested DAG edges.</p>
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto space-y-3 mb-6 pr-1">
          {proposals.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500 bg-slate-50 border border-slate-200/60 rounded-xl flex flex-col items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <p className="font-semibold text-slate-700">Project Graph is Fully Optimized!</p>
              <p className="text-xs text-slate-400">All logical dependencies have been successfully integrated without cycles.</p>
            </div>
          ) : (
            proposals.map((p, idx) => {
              const isChecked = selected.includes(idx);
              return (
                <div
                  key={idx}
                  onClick={() => toggleSelect(idx)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    isChecked
                      ? 'border-indigo-500 bg-indigo-50/40 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                      isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-semibold text-slate-800 mb-1">
                      <span className="text-indigo-600">{getTaskTitle(p.prerequisite_id)}</span>
                      <span className="mx-2 text-slate-400">➔</span>
                      <span className="text-slate-900">{getTaskTitle(p.dependent_id)}</span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">{p.reason}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            Close
          </button>
          {proposals.length > 0 && (
            <button
              onClick={handleConfirm}
              disabled={selected.length === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition shadow-sm"
            >
              Apply {selected.length} Selected Links
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
