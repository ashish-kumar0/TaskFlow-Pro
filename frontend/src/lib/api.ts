import axios from 'axios';
import { Task, Dependency, DependencyProposal } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const api = {
  getTasks: async (): Promise<Task[]> => {
    const res = await axios.get(`${API_BASE}/tasks`);
    return res.data;
  },
  createTask: async (task: Partial<Task>): Promise<Task> => {
    const res = await axios.post(`${API_BASE}/tasks`, task);
    return res.data;
  },
  updateTask: async (id: number, updates: Partial<Task>): Promise<Task> => {
    const res = await axios.put(`${API_BASE}/tasks/${id}`, updates);
    return res.data;
  },
  deleteTask: async (id: number): Promise<void> => {
    await axios.delete(`${API_BASE}/tasks/${id}`);
  },
  getDependencies: async (): Promise<Dependency[]> => {
    const res = await axios.get(`${API_BASE}/dependencies`);
    return res.data;
  },
  createDependency: async (prerequisite_id: number, dependent_id: number): Promise<Dependency> => {
    const res = await axios.post(`${API_BASE}/dependencies`, {
      prerequisite_id,
      dependent_id,
    });
    return res.data;
  },
  deleteDependency: async (id: number): Promise<void> => {
    await axios.delete(`${API_BASE}/dependencies/${id}`);
  },
  suggestDependencies: async (): Promise<{ proposals: DependencyProposal[] }> => {
    const res = await axios.post(`${API_BASE}/ai/suggest-dependencies`);
    return res.data;
  },

  getCriticalPath: async (): Promise<CriticalPathResponse> => {
  const res = await axios.get(`${API_BASE}/critical-path`);
  return res.data;
},
};
