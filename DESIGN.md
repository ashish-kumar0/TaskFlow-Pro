# TaskFlow Pro — System Architecture & Design Document

## 1. System Architecture Overview
TaskFlow Pro is a real-time, DAG-backed project management engine combining interactive Kanban operations with Directed Acyclic Graph topology and date cascade propagation.

### Tech Stack
- **Backend:** FastAPI (Python 3.11+), SQLAlchemy 2.0 ORM, SQLite database.
- **Frontend:** Next.js 14+ (App Router), React Flow / @xyflow/react, dnd-kit (Kanban drag-and-drop), Tailwind CSS.
- **Scheduling & Graph Engine:** Custom topological dependency scheduler implementing Kahn's algorithm, cycle-prevention guards, and Critical Path Method (CPM) using Dynamic Programming.

---

## 2. Data Model & Entity Relations

### 2.1 Task Entity (`tasks`)
- `id` (Integer, Primary Key, Auto-increment)
- `title` (String, Required)
- `description` (Text, Optional)
- `duration_days` (Integer, Required, strictly > 0)
- `start_date` (Date, Required)
- `end_date` (Date, Calculated: `start_date + duration_days`)
- `status` (Enum: `Backlog`, `In Progress`, `Review`, `Done`)
- `dependency_state` (Enum: `Ready`, `Blocked`)
- `position` (Integer, For Kanban column sort order)

### 2.2 Dependency Entity (`task_dependencies`)
- `id` (Integer, Primary Key, Auto-increment)
- `prerequisite_id` (Integer, Foreign Key -> `tasks.id`, ON DELETE CASCADE)
- `dependent_id` (Integer, Foreign Key -> `tasks.id`, ON DELETE CASCADE)
- **Constraint:** Unique pair constraint on `(prerequisite_id, dependent_id)` to prevent duplicate links.

---

## 3. Core Algorithms & Guarantees

### 3.1 Cycle Prevention (Topological Integrity)
Before adding any directed edge `A -> B`, the engine runs a depth-first / Kahn's check on whether a path already exists from `B` to `A`. If a path exists, the operation is rejected with HTTP 400 and `DAGCycleException`.

### 3.2 Critical Path Method (CPM)
The system calculates the longest path of non-slack task durations from DAG source nodes to terminal sink nodes. Tasks and edges on this path receive highest scheduling priority and visual highlights (`Critical Path`).

### 3.3 What-If Delay Simulation
In-memory forward BFS date propagation models downstream schedule slippage without mutating production records.

---

## 4. Key Design Decisions & Semantics

### 4.1 Upstream Rollback Semantics (Human Intent Preservation)
- **Forward Enforcement:** Dependent tasks are blocked from entering active execution columns (`In Progress`, `Review`, `Done`) until all upstream prerequisites reach `Done`.
- **Downstream Preservation:** If an upstream task is moved back to `Backlog`, dependent tasks flag the broken prerequisite state but do not destroy completed work already performed downstream.

---

## 5. Known Limitations
1. **Calendar Modeling:** Durations assume continuous calendar days rather than excluding regional holidays and non-working weekends.
2. **Concurrency:** SQLite WAL mode is configured for fast local evaluation; a distributed deployment would utilize PostgreSQL with optimistic row-version locking (`row_version`).