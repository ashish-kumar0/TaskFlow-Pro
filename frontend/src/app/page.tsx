"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  CollisionDetection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { Task, TaskStatus, Dependency, DependencyProposal } from '@/lib/types';
import { api } from '@/lib/api';
import { Column } from '@/components/kanban/Column';
import { TaskCard } from '@/components/kanban/TaskCard';
import { AISuggestModal } from '@/components/modals/AISuggestModal';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { DependencyGraph } from '@/components/graph/DependencyGraph';
import { SimulationBar } from '@/components/simulator/SimulationBar';
import { runWhatIfSimulation } from '@/lib/simulator';
import { Sparkles, RefreshCw, AlertTriangle, LayoutDashboard, GitFork, Plus } from 'lucide-react';

const VALID_COLUMNS: TaskStatus[] = ['Backlog', 'In Progress', 'Review', 'Done'];

const parseErrorMessage = (err: any): string => {
  const detail = err.response?.data?.detail;
  if (!detail) return err.message || 'An unexpected error occurred.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
  }
  return String(detail);
};

const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return rectIntersection(args);
};

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [criticalTaskIds, setCriticalTaskIds] = useState<number[]>([]);
  const [criticalEdgeIds, setCriticalEdgeIds] = useState<number[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [proposals, setProposals] = useState<DependencyProposal[]>([]);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'graph'>('kanban');

  // Simulator state
  const [selectedSimTaskId, setSelectedSimTaskId] = useState<number | null>(null);
  const [simDelayDays, setSimDelayDays] = useState<number>(3);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tasksData, depsData, cpmData] = await Promise.all([
        api.getTasks(),
        api.getDependencies(),
        api.getCriticalPath(),
      ]);
      setTasks(tasksData);
      setDependencies(depsData);
      setCriticalTaskIds(cpmData.critical_task_ids || []);
      setCriticalEdgeIds(cpmData.critical_edge_ids || []);
    } catch (err: any) {
      setErrorMessage(parseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute What-If Simulation
  const { displayTasks, affectedTaskIds, slipDays } = useMemo(() => {
    if (!selectedSimTaskId || simDelayDays <= 0) {
      return { displayTasks: tasks, affectedTaskIds: [], slipDays: 0 };
    }
    const result = runWhatIfSimulation(tasks, dependencies, selectedSimTaskId, simDelayDays);
    return {
      displayTasks: result.simulatedTasks,
      affectedTaskIds: result.affectedTaskIds,
      slipDays: result.projectEndSlipDays,
    };
  }, [tasks, dependencies, selectedSimTaskId, simDelayDays]);

  const resolveTargetStatus = (over: any): TaskStatus | null => {
    if (!over) return null;
    const overId = String(over.id);

    if (VALID_COLUMNS.includes(overId as TaskStatus)) {
      return overId as TaskStatus;
    }
    if (over.data?.current?.status && VALID_COLUMNS.includes(over.data.current.status)) {
      return over.data.current.status as TaskStatus;
    }

    const targetTask = displayTasks.find(t => t.id.toString() === overId);
    if (targetTask && VALID_COLUMNS.includes(targetTask.status)) {
      return targetTask.status;
    }

    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = displayTasks.find(t => t.id.toString() === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = Number(active.id);
    const task = displayTasks.find(t => t.id === taskId);
    if (!task) return;

    const targetStatus = resolveTargetStatus(over);
    if (!targetStatus || task.status === targetStatus) return;

    if (task.dependency_state === 'Blocked' && targetStatus !== 'Backlog') {
      setErrorMessage(`Task #${task.id} is BLOCKED. All upstream prerequisites must be in 'Done' before moving forward!`);
      return;
    }

    try {
      setErrorMessage(null);
      setTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, status: targetStatus } : t))
      );

      await api.updateTask(taskId, { status: targetStatus });
      await fetchData();
    } catch (err: any) {
      setErrorMessage(parseErrorMessage(err));
      await fetchData();
    }
  };

  const triggerAISuggestions = async () => {
    try {
      setAiLoading(true);
      setErrorMessage(null);
      const res = await api.suggestDependencies();
      setProposals(res.proposals);
      setIsAiModalOpen(true);
    } catch (err: any) {
      setErrorMessage(parseErrorMessage(err));
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAISuggestions = async (selected: DependencyProposal[]) => {
    try {
      for (const edge of selected) {
        await api.createDependency(edge.prerequisite_id, edge.dependent_id);
      }
      await fetchData();
    } catch (err: any) {
      setErrorMessage(parseErrorMessage(err));
    }
  };

  return (
    <main className="min-h-screen bg-slate-100/60 p-6 md:p-8">
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            TaskFlow <span className="text-indigo-600">Pro</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Intelligent DAG-backed Kanban Engine with Cascade Propagation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'kanban'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'graph'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              DAG Graph
            </button>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>

          <button
            onClick={triggerAISuggestions}
            disabled={aiLoading}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {aiLoading ? 'Analyzing...' : 'AI Suggest'}
          </button>

          <button
            onClick={fetchData}
            className="p-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition shadow-sm"
            title="Refresh Board"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="max-w-7xl mx-auto mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* What-If Delay Simulator Bar */}
      <div className="max-w-7xl mx-auto">
        <SimulationBar
          tasks={tasks}
          selectedTaskId={selectedSimTaskId}
          delayDays={simDelayDays}
          affectedCount={affectedTaskIds.length}
          slipDays={slipDays}
          onSelectTask={setSelectedSimTaskId}
          onChangeDelay={setSimDelayDays}
          onReset={() => {
            setSelectedSimTaskId(null);
            setSimDelayDays(3);
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto">
        {viewMode === 'kanban' ? (
          <DndContext
            sensors={sensors}
            collisionDetection={kanbanCollisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {VALID_COLUMNS.map(col => (
                <Column
                  key={col}
                  status={col}
                  tasks={displayTasks.filter(t => t.status === col)}
                  allTasks={displayTasks}
                  criticalTaskIds={criticalTaskIds}
                  affectedTaskIds={affectedTaskIds}
                  onOpenEdit={() => {}}
                  onRefresh={fetchData}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask ? (
                <div className="w-[280px]">
                  <TaskCard
                    task={activeTask}
                    allTasks={displayTasks}
                    isCritical={criticalTaskIds.includes(activeTask.id)}
                    isSimulatedShift={affectedTaskIds.includes(activeTask.id)}
                    onOpenEdit={() => {}}
                    onRefresh={fetchData}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <DependencyGraph
            tasks={displayTasks}
            dependencies={dependencies}
            criticalTaskIds={criticalTaskIds}
            criticalEdgeIds={criticalEdgeIds}
          />
        )}
      </div>

      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onTaskCreated={fetchData}
      />

      <AISuggestModal
        isOpen={isAiModalOpen}
        proposals={proposals}
        tasks={tasks}
        onClose={() => setIsAiModalOpen(false)}
        onApply={handleApplyAISuggestions}
      />
    </main>
  );
}
