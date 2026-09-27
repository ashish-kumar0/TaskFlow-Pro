import { Task, Dependency } from './types';

const addDaysToDateString = (dateStr: string, days: number): string => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export interface SimulatedOutput {
  simulatedTasks: Task[];
  affectedTaskIds: number[];
  projectEndSlipDays: number;
}

export function runWhatIfSimulation(
  tasks: Task[],
  dependencies: Dependency[],
  delayedTaskId: number | null,
  delayDays: number
): SimulatedOutput {
  if (!delayedTaskId || delayDays <= 0) {
    return {
      simulatedTasks: tasks,
      affectedTaskIds: [],
      projectEndSlipDays: 0,
    };
  }

  // 1. Build Adjacency Graph
  const childrenMap = new Map<number, number[]>();
  const parentsMap = new Map<number, number[]>();
  tasks.forEach(t => {
    childrenMap.set(t.id, []);
    parentsMap.set(t.id, []);
  });

  dependencies.forEach(d => {
    childrenMap.get(d.prerequisite_id)?.push(d.dependent_id);
    parentsMap.get(d.dependent_id)?.push(d.prerequisite_id);
  });

  // 2. Clone tasks for in-memory simulation
  const taskMap = new Map<number, Task>();
  tasks.forEach(t => taskMap.set(t.id, { ...t }));

  const affected = new Set<number>();
  affected.add(delayedTaskId);

  // Apply delay to target task
  const target = taskMap.get(delayedTaskId)!;
  const newTargetEnd = addDaysToDateString(target.end_date, delayDays);
  taskMap.set(delayedTaskId, {
    ...target,
    duration_days: target.duration_days + delayDays,
    end_date: newTargetEnd,
  });

  // 3. BFS Cascade to push downstream tasks
  const queue: number[] = [delayedTaskId];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const currTask = taskMap.get(currId)!;
    const children = childrenMap.get(currId) || [];

    for (const childId of children) {
      const childTask = taskMap.get(childId)!;
      // Child start date must be >= parent end date
      if (childTask.start_date < currTask.end_date) {
        affected.add(childId);
        const childDuration = childTask.duration_days;
        const newChildStart = currTask.end_date;
        const newChildEnd = addDaysToDateString(newChildStart, childDuration);

        taskMap.set(childId, {
          ...childTask,
          start_date: newChildStart,
          end_date: newChildEnd,
        });

        queue.push(childId);
      }
    }
  }

  // 4. Calculate total project slip
  const originalMaxEnd = tasks.reduce((max, t) => (t.end_date > max ? t.end_date : max), '');
  const newMaxEnd = Array.from(taskMap.values()).reduce((max, t) => (t.end_date > max ? t.end_date : max), '');
  
  const diffTime = Math.abs(new Date(newMaxEnd).getTime() - new Date(originalMaxEnd).getTime());
  const slipDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return {
    simulatedTasks: Array.from(taskMap.values()),
    affectedTaskIds: Array.from(affected),
    projectEndSlipDays: slipDays,
  };
}
