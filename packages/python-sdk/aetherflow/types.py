from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional

@dataclass
class CognitiveEvent:
    id: str
    type: str
    payload: Dict[str, Any]
    timestamp: int
    severity: str = "info"
    agent: Optional[str] = None

@dataclass
class ExecutionPlanStep:
    id: str
    title: str
    agent_role: str
    status: str
    output: Optional[Any] = None

@dataclass
class ExecutionPlan:
    id: str
    goal: str
    steps: List[ExecutionPlanStep]
    estimated_complexity: str
    created_at: int

@dataclass
class ExecutionResult:
    goal: str
    success: bool
    final_synthesis: str
    confidence_score: float
    synthesized_tools: List[str]
    execution_time_ms: float
    trace_events_count: int
    plan: Optional[Dict[str, Any]] = None
