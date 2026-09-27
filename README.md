# TaskFlow Pro

> Intelligent DAG-backed Project Management Engine with Cascade Scheduling & AI Prerequisite Analysis.

TaskFlow Pro is a deterministic project planning application that models workflows as Directed Acyclic Graphs (DAG). It automatically handles cascade schedule recalculations without compounding parallel delays, prevents cyclic deadlocks, and enforces prerequisite completion before allowing task progression.

---

## Key Features
- **Deterministic DAG Scheduling Engine:** Powered by Kahn’s Algorithm for topological sorting and BFS-based cycle detection.
- **No-Compounding Date Cascade:** Diamond dependency convergences calculate schedule shifts using critical path maximums ($Start(D) = \max(End(P))$) rather than summing upstream durations.
- **Status Progression & Rollback Guards:** Cards marked `Blocked` cannot advance past `Backlog`. Reverting an upstream card from `Done` automatically cascades downstream re-blocking.
- **Visual DAG Canvas:** Interactive node-link graph view powered by `@xyflow/react`.
- **AI-Augmented Dependency Recommendations:** Generative suggestions via Google Gemini with a human-in-the-loop review and approval workflow.

---

## Quickstart Guide

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Run automated tests
python -m pytest tests/

# Seed initial tasks
python -m app.seed

# Start backend
uvicorn app.main:app --reload --port 8000