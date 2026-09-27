"use client";

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task, TaskStatus } from '@/lib/types';
import { TaskCard } from './TaskCard';

interface ColumnProps {
  status: TaskStatus;
  tasks: Task[];
  allTasks: Task[];
  criticalTaskIds?: number[];
  affectedTaskIds?: number[];
  onOpenEdit: (task: Task) => void;
  onRefresh?: () => void;
}

export const Column: React.FC<ColumnProps> = ({
  status,
  tasks,
  allTasks,
  criticalTaskIds = [],
  affectedTaskIds = [],
  onOpenEdit,
  onRefresh,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: 'Column',
      status: status,
    },
  });

  const getStatusColor = (colStatus: TaskStatus) => {
    switch (colStatus) {
      case 'Backlog': return 'border-t-slate-400';
      case 'In Progress': return 'border-t-blue-500';
      case 'Review': return 'border-t-purple-500';
      case 'Done': return 'border-t-emerald-500';
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-1 min-w-[260px] bg-slate-50/90 rounded-2xl p-3 border-t-4 ${getStatusColor(
        status
      )} border border-slate-200/80 shadow-sm min-h-[620px] transition-all ${
        isOver ? 'bg-indigo-50/70 ring-2 ring-indigo-400' : ''
      }`}
    >
      <div className="flex items-center justify-between px-2 py-2 mb-2 pointer-events-none">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-700">{status}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600 font-semibold">
            {tasks.length}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-[500px]">
        <SortableContext
          items={tasks.map(t => t.id.toString())}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              allTasks={allTasks}
              isCritical={criticalTaskIds.includes(task.id)}
              isSimulatedShift={affectedTaskIds.includes(task.id)}
              onOpenEdit={onOpenEdit}
              onRefresh={onRefresh}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex-1 min-h-[450px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl m-1 text-xs text-slate-400 pointer-events-none select-none">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
};
