# AetherFlow Python SDK

Official Python bindings for the **AetherFlow Autonomous Multi-Agent Microkernel**.

## Installation

```bash
pip install -e packages/python-sdk
```

## Quickstart

```python
from aetherflow import AetherFlowClient

# Connect to the local AetherFlow microkernel
client = AetherFlowClient(host="http://localhost:3000")

# Dispatch complex reasoning goal
result = client.dispatch(
    goal="Synthesize high-frequency arbitrage risk model and calculate volatility metrics",
    context={"ticker": "BTC/USD", "timeframe": "1h"}
)

print(f"Status: {result.success}")
print(f"Consensus Confidence: {result.confidence_score * 100}%")
print(f"Synthesized Tools: {result.synthesized_tools}")
print(f"Latency: {result.execution_time_ms}ms")
```
