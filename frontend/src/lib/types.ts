export type TaskStatus = 'Backlog' | 'In Progress' | 'Review' | 'Done';
export type DependencyState = 'Ready' | 'Blocked';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  duration_days: number;
  start_date: string;
  end_date: string;
  status: TaskStatus;
  dependency_state: DependencyState;
  position: number;
  prerequisite_ids: number[];
  dependent_ids: number[];
}

export interface Dependency {
  id: number;
  prerequisite_id: number;
  dependent_id: number;
}

export interface DependencyProposal {
  prerequisite_id: number;
  dependent_id: number;
  reason: string;
}

export interface CriticalPathResponse {
  critical_task_ids: number[];
  critical_edge_ids: number[];
}

export interface SimulatedTask extends Task {
  original_start_date?: string;
  original_end_date?: string;
  delay_days?: number;
}
