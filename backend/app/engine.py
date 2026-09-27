from datetime import timedelta
from typing import Dict, List
from collections import defaultdict, deque
from sqlalchemy.orm import Session
from .models import Task, TaskDependency, TaskStatus, DependencyState

class DAGCycleException(Exception):
    pass

def build_graph(db: Session):
    tasks = db.query(Task).all()
    deps = db.query(TaskDependency).all()

    tasks_map = {t.id: t for t in tasks}
    adj = defaultdict(list)
    in_degree = {t.id: 0 for t in tasks}

    for d in deps:
        if d.prerequisite_id in tasks_map and d.dependent_id in tasks_map:
            adj[d.prerequisite_id].append(d.dependent_id)
            in_degree[d.dependent_id] += 1

    return adj, in_degree, tasks_map

def check_cycle_addition(db: Session, prereq_id: int, dep_id: int) -> bool:
    if prereq_id == dep_id:
        raise DAGCycleException(f"Self-dependency is invalid: Task {prereq_id} cannot depend on itself.")

    adj, _, _ = build_graph(db)

    visited = set()
    queue = deque([dep_id])

    while queue:
        curr = queue.popleft()
        if curr == prereq_id:
            raise DAGCycleException(f"Circular dependency detected! Adding edge {prereq_id} -> {dep_id} creates a cycle.")
        if curr not in visited:
            visited.add(curr)
            for neighbor in adj[curr]:
                if neighbor not in visited:
                    queue.append(neighbor)
    return True

def recalculate_schedule_and_statuses(db: Session):
    adj, in_degree, tasks_map = build_graph(db)

    queue = deque([task_id for task_id, deg in in_degree.items() if deg == 0])
    topo_order = []

    while queue:
        curr = queue.popleft()
        topo_order.append(curr)
        for neighbor in adj[curr]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(topo_order) != len(tasks_map):
        raise DAGCycleException("Database contains an existing circular dependency cycle!")

    prereqs_map = defaultdict(list)
    deps = db.query(TaskDependency).all()
    for d in deps:
        prereqs_map[d.dependent_id].append(d.prerequisite_id)

    for task_id in topo_order:
        task = tasks_map[task_id]
        upstream_ids = prereqs_map.get(task_id, [])

        if upstream_ids:
            max_prereq_end = max(tasks_map[p_id].end_date for p_id in upstream_ids)
            if task.start_date < max_prereq_end:
                task.start_date = max_prereq_end
            
            task.end_date = task.start_date + timedelta(days=task.duration_days)

            all_done = all(tasks_map[p_id].status == TaskStatus.DONE.value for p_id in upstream_ids)
            task.dependency_state = DependencyState.READY.value if all_done else DependencyState.BLOCKED.value
        else:
            task.end_date = task.start_date + timedelta(days=task.duration_days)
            task.dependency_state = DependencyState.READY.value

    db.commit()
    return tasks_map

def compute_critical_path(db: Session) -> dict:
    tasks = db.query(Task).all()
    deps = db.query(TaskDependency).all()

    if not tasks:
        return {"critical_task_ids": [], "critical_edge_ids": []}

    adj = {t.id: [] for t in tasks}
    in_degree = {t.id: 0 for t in tasks}
    task_durations = {t.id: t.duration_days for t in tasks}
    edge_map = {(d.prerequisite_id, d.dependent_id): d.id for d in deps}

    for d in deps:
        if d.prerequisite_id in adj and d.dependent_id in adj:
            adj[d.prerequisite_id].append(d.dependent_id)
            in_degree[d.dependent_id] += 1

    # Topological Sort (Kahn's Algorithm)
    queue = deque([t_id for t_id, deg in in_degree.items() if deg == 0])
    topo_order = []

    while queue:
        curr = queue.popleft()
        topo_order.append(curr)
        for nxt in adj[curr]:
            in_degree[nxt] -= 1
            if in_degree[nxt] == 0:
                queue.append(nxt)

    # Longest Path calculation (CPM - Earliest Finish)
    dist = {t.id: task_durations[t.id] for t in tasks}
    parent = {t.id: None for t in tasks}

    for u in topo_order:
        for v in adj[u]:
            if dist[u] + task_durations[v] > dist[v]:
                dist[v] = dist[u] + task_durations[v]
                parent[v] = u

    # End node jiska distance sabse maximum ho
    if not dist:
        return {"critical_task_ids": [], "critical_edge_ids": []}

    max_node = max(dist, key=dist.get)
    path = []
    curr = max_node
    while curr is not None:
        path.append(curr)
        curr = parent[curr]

    path.reverse()

    # Path ke edges extract karein
    critical_edges = []
    for i in range(len(path) - 1):
        edge_key = (path[i], path[i+1])
        if edge_key in edge_map:
            critical_edges.append(edge_map[edge_key])

    return {
        "critical_task_ids": path,
        "critical_edge_ids": critical_edges
    }
