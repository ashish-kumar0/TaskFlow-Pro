"use client";

import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Task, Dependency } from '@/lib/types';
import { Flame } from 'lucide-react';

interface DependencyGraphProps {
  tasks: Task[];
  dependencies: Dependency[];
  criticalTaskIds?: number[];
  criticalEdgeIds?: number[];
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  tasks,
  dependencies,
  criticalTaskIds = [],
  criticalEdgeIds = [],
}) => {
  const nodes: Node[] = useMemo(() => {
    const spacingX = 260;
    const spacingY = 160;
    const cols = 4;

    return tasks.map((task, idx) => {
      const colIndex = idx % cols;
      const rowIndex = Math.floor(idx / cols);
      const isCritical = criticalTaskIds.includes(task.id);
      const isBlocked = task.dependency_state === 'Blocked';

      return {
        id: task.id.toString(),
        position: { x: colIndex * spacingX + 40, y: rowIndex * spacingY + 40 },
        data: {
          label: (
            <div
              className={`p-3 rounded-xl border bg-white shadow-sm transition-all w-[220px] text-left ${
                isCritical
                  ? 'border-rose-500 ring-2 ring-rose-400 shadow-rose-100'
                  : isBlocked
                  ? 'border-amber-300 bg-amber-50/20'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                  #{task.id}
                </span>
                <div className="flex items-center gap-1">
                  {isCritical && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 flex items-center gap-0.5">
                      <Flame className="w-2.5 h-2.5 fill-rose-600" /> CPM
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      isBlocked
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {task.dependency_state}
                  </span>
                </div>
              </div>
              <div className="text-xs font-bold text-slate-800 truncate mb-1">
                {task.title}
              </div>
              <div className="text-[10px] text-slate-500 flex justify-between">
                <span>{task.duration_days} days</span>
                <span className="font-semibold">{task.status}</span>
              </div>
            </div>
          ),
        },
      };
    });
  }, [tasks, criticalTaskIds]);

  const edges: Edge[] = useMemo(() => {
    return dependencies.map(dep => {
      const isCriticalEdge = criticalEdgeIds.includes(dep.id);

      return {
        id: `e-${dep.prerequisite_id}-${dep.dependent_id}`,
        source: dep.prerequisite_id.toString(),
        target: dep.dependent_id.toString(),
        animated: true,
        style: {
          stroke: isCriticalEdge ? '#e11d48' : '#6366f1',
          strokeWidth: isCriticalEdge ? 3.5 : 1.8,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isCriticalEdge ? '#e11d48' : '#6366f1',
        },
      };
    });
  }, [dependencies, criticalEdgeIds]);

  return (
    <div className="w-full h-[650px] bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden relative">
      <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-200 text-xs flex items-center gap-3">
        <span className="flex items-center gap-1.5 font-semibold text-rose-600">
          <span className="w-3 h-1 bg-rose-600 rounded"></span> Critical Path (Longest Delay Chain)
        </span>
        <span className="flex items-center gap-1.5 text-slate-500">
          <span className="w-3 h-1 bg-indigo-500 rounded"></span> Normal Dependency
        </span>
      </div>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background gap={16} size={1} color="#cbd5e1" />
        <Controls />
      </ReactFlow>
    </div>
  );
};
