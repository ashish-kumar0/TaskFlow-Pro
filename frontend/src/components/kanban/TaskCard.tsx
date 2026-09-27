"use client";

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/lib/types';
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  PlayCircle, 
  Eye, 
  Layers, 
  Link2, 
  Trash2,
  Flame,
  ArrowRight
} from 'lucide-react';
import { api } from '@/lib/api';

interface TaskCardProps {
  task: Task;
  allTasks: Task[];
  isCritical?: boolean;
  isSimulatedShift?: boolean;
  originalStartDate?: string;
  onOpenEdit: (task: Task) => void;
  onRefresh?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  allTasks, 
  isCritical, 
  isSimulatedShift,
  onOpenEdit, 
  onRefresh 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id.toString(),
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const isBlocked = task.dependency_state === 'Blocked';

  const pendingPrereqs = task.prerequisite_ids
    .map(id => allTasks.find(t => t.id === id))
    .filter(t => t && t.status !== 'Done')
    .map(t => t!.title);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete Task #${task.id}?`)) {
      try {
        await api.deleteTask(task.id);
        if (onRefresh) onRefresh();
      } catch (err) {
        alert("Failed to delete task.");
      }
    }
  };

  const renderStatusBadge = () => {
    if (task.status === 'Done') {
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Done
        </span>
      );
    }
    if (task.status === 'Review') {
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 bg-purple-100 text-purple-800 border border-purple-200">
          <Eye className="w-3 h-3 text-purple-600" /> In Review
        </span>
      );
    }
    if (task.status === 'In Progress') {
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 bg-blue-100 text-blue-800 border border-blue-200">
          <PlayCircle className="w-3 h-3 text-blue-600" /> In Progress
        </span>
      );
    }
    if (isBlocked) {
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200">
          <AlertCircle className="w-3 h-3 text-amber-600" /> Blocked
        </span>
      );
    }
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200">
        <Layers className="w-3 h-3 text-slate-500" /> Backlog
      </span>
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpenEdit(task)}
      className={`p-4 mb-3 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing select-none relative group ${
        isSimulatedShift
          ? 'border-amber-400 bg-amber-50/40 ring-2 ring-amber-300'
          : isCritical
          ? 'ring-2 ring-rose-500/80 border-rose-400 bg-rose-50/20'
          : isBlocked && task.status === 'Backlog'
          ? 'border-amber-300 bg-amber-50/20'
          : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
            #{task.id}
          </span>
          {renderStatusBadge()}
          {isCritical && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
              <Flame className="w-3 h-3 text-rose-600 fill-rose-600" /> Critical Path
            </span>
          )}
          {isSimulatedShift && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/90 text-amber-900 border border-amber-300 animate-bounce">
              ⚠️ Date Shifted
            </span>
          )}
        </div>

        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
          title="Delete task"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <h4 className="text-sm font-semibold text-slate-800 line-clamp-1 mb-1">
        {task.title}
      </h4>

      {task.description && (
        <p className="text-xs text-slate-500 line-clamp-2 mb-3">
          {task.description}
        </p>
      )}

      {task.status !== 'Done' && pendingPrereqs.length > 0 && (
        <div className="mb-2 text-[11px] text-amber-700 bg-amber-100/70 px-2 py-1 rounded flex items-center gap-1">
          <Link2 className="w-3 h-3 shrink-0" />
          <span className="truncate">Waiting on: {pendingPrereqs.join(', ')}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1 font-mono">
          <Calendar className="w-3 h-3 text-slate-400" />
          <span className={isSimulatedShift ? 'font-bold text-amber-800' : ''}>
            {task.start_date} → {task.end_date}
          </span>
        </div>
        <div className="flex items-center gap-1 font-medium">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{task.duration_days}d</span>
        </div>
      </div>
    </div>
  );
};
