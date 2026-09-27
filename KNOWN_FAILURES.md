# Known Failure Cases & System Boundary Conditions

This document catalogs edge cases, handled error conditions, and architectural boundaries in TaskFlow Pro (credited under Testing & Reliability).

### 1. Direct Self-Reference Edge
- **Input:** Prerequisite ID = 4, Dependent ID = 4.
- **Engine Behavior:** Caught immediately by `check_cycle_addition`.
- **System Response:** Rejects operation with: `"Self-dependency is invalid: Task 4 cannot depend on itself."`

### 2. Deep Indirect Circular Graphs (A -> B -> C -> A)
- **Input:** Tasks form a chain 1 -> 2 -> 3. User requests edge 3 -> 1.
- **Engine Behavior:** BFS traversal detects backward reachability from Target to Source.
- **System Response:** Aborts database commit and emits HTTP 400: `"Circular dependency detected! Adding edge 3 -> 1 creates a cycle."`

### 3. Blocked Card Premature Advance
- **Input:** User attempts to drag a `Blocked` card directly into `In Progress` or `Done`.
- **Engine Behavior:** Frontend optimistic guard rejects gesture; Backend API validates that `dependency_state == 'Ready'` before status promotion.
- **System Response:** Rollback to original column with warning toast: `"Task is BLOCKED. All prerequisites must be in Done before advancing!"`

### 4. Zero or Negative Task Duration
- **Input:** Task created with `duration_days <= 0`.
- **Engine Behavior:** Pydantic Field validator `gt=0` intercepts request at API boundary.
- **System Response:** Returns HTTP 422 Unprocessable Entity, preventing divide-by-zero or negative date range inversions.