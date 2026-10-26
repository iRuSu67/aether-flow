import json
import asyncio
from typing import Optional, Callable, Dict, Any, List
import urllib.request
import urllib.error
from .types import ExecutionResult, CognitiveEvent

class AetherFlowClient:
    """
    Asynchronous Python Client for the AetherFlow Autonomous Multi-Agent Microkernel.
    Connects to the AetherFlow runtime via REST and WebSocket streaming.
    """

    def __init__(self, host: str = "http://localhost:3000", ws_url: str = "ws://localhost:4884"):
        self.host = host.rstrip("/")
        self.ws_url = ws_url
        self.listeners: List[Callable[[CognitiveEvent], None]] = []

    def dispatch(self, goal: str, context: Optional[Dict[str, Any]] = None) -> ExecutionResult:
        """
        Synchronously dispatch an autonomous multi-agent goal to the AetherFlow microkernel.
        """
        endpoint = f"{self.host}/api/dispatch"
        payload = json.dumps({"goal": goal, "context": context or {}}).encode("utf-8")
        req = urllib.request.Request(endpoint, data=payload, headers={"Content-Type": "application/json"})

        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return ExecutionResult(
                    goal=data.get("goal", goal),
                    success=data.get("success", False),
                    final_synthesis=data.get("finalSynthesis", ""),
                    confidence_score=data.get("confidenceScore", 0.0),
                    synthesized_tools=data.get("synthesizedTools", []),
                    execution_time_ms=data.get("executionTimeMs", 0.0),
                    trace_events_count=data.get("traceEventsCount", 0),
                    plan=data.get("plan"),
                )
        except urllib.error.URLError as e:
            raise ConnectionError(f"Could not connect to AetherFlow daemon at {self.host}: {e}")

    def list_tools(self) -> List[Dict[str, Any]]:
        """
        List all standard, MCP, and JIT-synthesized tools currently registered.
        """
        endpoint = f"{self.host}/api/tools"
        req = urllib.request.Request(endpoint)
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def get_history(self) -> List[Dict[str, Any]]:
        """
        Retrieve cognitive trace history.
        """
        endpoint = f"{self.host}/api/history"
        req = urllib.request.Request(endpoint)
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
