# REVIEW_B_1: Checkpoint B Evaluation Harness, Dry-Run Verification, and Live API Readiness

## 1. SUMMARY
- Built the `@aether-flow/eval` workspace package conforming strictly to `EVAL_DESIGN.md` v2.
- Implemented 15 deterministic tasks across 5 algorithmic families (Markdown Table, Levenshtein Alignment, Dijkstra Turns, CSV Pivot, 0/1 Dual Knapsack).
- Implemented 5 domain checkers validating solution optimality/feasibility instead of string match. Self-tests passed 15/15 reference solutions and rejected 45/45 negative cases.
- Implemented Conditions A (zero-shot direct), B (restricted 5-toy-tool palette), C0 (single-shot synthesis in Docker, 0 retries), C (synthesis + retry feedback loop in Docker), and D (dynamic tool synthesis with family-indexed tool library).
- Executed MockProvider dry-run across all 15 tasks $\times$ 5 conditions (75 evaluations) inside isolated Docker containers: Condition D achieved 100% reuse hit rate across variants 'b' and 'c' with 0 synthesis tokens on hits.
- Verified live Gemini rate limiter, SHA-256 disk cache (incorporating provider, model, thinking budget, and run index), and execution checkpointhandler.
- `GEMINI_API_KEY` status: Not set in process environment or `.env` file. Verified that running live Gemini fails cleanly before network calls. Full API call estimation computed and documented.
- Still unverified: Live Gemini API execution awaiting user key; statistical hypothesis testing on live model outputs.

---

## 2. EVAL_DESIGN.md v2 SPECIFICATION & DESIGN EVOLUTION

In response to design review, `EVAL_DESIGN.md` was overhauled to v2 with the following architectural commitments:
1. **Task Families & Condition D Tool Reuse**:
   - 15 total tasks structured into 5 families $\times$ 3 variants (variant `a` synthesizes the baseline tool; variants `b` and `c` share identical specification logic on independent input data).
   - In Condition D, the tool library is reset at the start of each run repetition and indexed by `familyId`. Subsequent variants check the library for an existing synthesized tool, testing dynamic reuse.
2. **Condition C0 Added & Condition B Clarified**:
   - Added **Condition C0**: Dynamic code synthesis executed once in Docker with zero feedback and zero retries. Separates code execution benefit from the iterative feedback loop.
   - Condition B is formally designated as a restricted baseline (5 toy tools: `calculate`, `extract_regex`, `count_occurrences`, `sort_array`, `format_json`) to measure LLM degradation when forced into inadequate tool abstractions.
3. **Reasoning Models & Parameter Deprecation**:
   - Noted the deprecation of sampling knobs (`temperature`, `top_p`, `top_k`) in current Gemini reasoning models (Gemini 2.5 Flash / Gemini 3.x).
   - Reasoning effort is controlled via `thinkingConfig` (`thinkingBudget: 1024`), fixed identically across all conditions.
   - Thinking tokens are monitored and reported separately from standard output tokens.
4. **Algorithmic Checkers (Optimality & Feasibility)**:
   - Replaced naive string equality with deterministic checkers:
     - *Family 1*: Validates header schema, cell alignment, and row count.
     - *Family 2*: Validates alignment edit distance against the true Levenshtein distance, checks sequence reconstruction, and verifies valid edit operations.
     - *Family 3*: Validates that path start/end match endpoints, edges exist in the adjacency list, coordinates are non-diagonal grid neighbors, and cumulative turn penalties + edge weights equal optimal distance.
     - *Family 4*: Validates 2D pivot table row/column dimensions, headers, and exact aggregated group sums.
     - *Family 5*: Validates weight and volume constraints ($\le W$ and $\le V$), checks subset membership, and verifies sum of values matches DP optimal value.
5. **Security & Docker Fail-Closed Execution**:
   - Refuses evaluation under conditions C0, C, and D unless Docker is confirmed available (`Sandbox.isDockerAvailable() === true`) and `unsafeDevMode` is false.
   - Results extracted via internal `JSON.stringify()` in locked-down vm context within the container; no post-execution LLM rewriting.
6. **Detailed Error Taxonomy & AST False Rejections**:
   - Every failure categorized into: `SYNTAX_ERROR`, `POLICY_BLOCKED`, `RUNTIME_ERROR`, `TIMEOUT`, `WRONG_OUTPUT`, or `SUCCESS`.
   - Wilson score 95% confidence intervals computed for all sample proportions.

---

## 3. RAW DETERMINISTIC CHECKER SELF-TEST OUTPUT

Raw, unedited output of `node packages/eval/dist/tasks/checkers/run-self-tests.js`:

```text
================================================================
       DETERMINISTIC EVALUATION CHECKER SELF-TEST HARNESS       
       Validating 15 tasks (15 Reference + 45 Negative Cases)
================================================================

▶ [Task: task_1a_markdown_employees] Family: family1_markdown_table (Markdown Table: Employee Directory)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_1b_markdown_servers] Family: family1_markdown_table (Markdown Table: Server Telemetry Metrics)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_1c_markdown_transactions] Family: family1_markdown_table (Markdown Table: Financial Ledger Transactions)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_2a_levenshtein_dna] Family: family2_levenshtein_alignment (Levenshtein Alignment: DNA Sequences)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_2b_levenshtein_tokens] Family: family2_levenshtein_alignment (Levenshtein Alignment: Identifier Tokens)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_2c_levenshtein_sentences] Family: family2_levenshtein_alignment (Levenshtein Alignment: Natural Sentences with Typos)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_3a_dijkstra_city] Family: family3_dijkstra_turns (Dijkstra with Turn Penalties: City Grid)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_3b_dijkstra_circuit] Family: family3_dijkstra_turns (Dijkstra with Turn Penalties: Circuit Trace Routing)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_3c_dijkstra_warehouse] Family: family3_dijkstra_turns (Dijkstra with Turn Penalties: AGV Warehouse Aisle)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_4a_csv_sales] Family: family4_csv_pivot (CSV 2D Pivot: Retail Sales)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_4b_csv_telemetry] Family: family4_csv_pivot (CSV 2D Pivot: Infrastructure Telemetry)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_4c_csv_grades] Family: family4_csv_pivot (CSV 2D Pivot: Academic Exam Grades)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_5a_knapsack_cargo] Family: family5_knapsack_dual (0/1 Dual Knapsack: Freight Cargo Packing)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_5b_knapsack_payload] Family: family5_knapsack_dual (0/1 Dual Knapsack: Satellite Payload Instruments)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_5c_knapsack_cloud] Family: family5_knapsack_dual (0/1 Dual Knapsack: Cloud VM Packing)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

================================================================
                    SELF-TEST RUN SUMMARY                       
================================================================
✔ Reference Solutions Passed: 15/15 (100.0%)
✔ Negative Cases Rejected:    45/45 (100.0%)
✔ Status: ALL CHECKERS VALIDATED
================================================================
```

---

## 4. RAW MOCKPROVIDER DRY-RUN OUTPUT (PLUMBING ONLY)

Raw, unedited output of `node packages/eval/dist/index.js --dry-run` (15 tasks $\times$ 5 conditions = 75 evaluations in Docker):

```text
================================================================
            AETHERFLOW EVALUATION BENCHMARK HARNESS             
  Provider: MOCK | Model: gemini-2.5-flash
  Tasks: 15 | Conditions: A, B, C0, C, D | Runs: 1
  Rate Limits: 15 RPM | 1500 RPD | Max Calls Cap: 50
  Estimated API Calls: Min: 65 | Typical: 105 | Max: 195
================================================================


▶ [RUN REPETITION 1/1] (Resetting Condition D Tool Library)
  [Task 1/15] task_1a_markdown_employees (Markdown Table: Employee Directory)
    ↳ Condition A : ❌ FAIL | 4ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 7ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 4785ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 1627ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS | 1219ms | Tax: SUCCESS | Tokens: 250
  [Task 2/15] task_1b_markdown_servers (Markdown Table: Server Telemetry Metrics)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 5ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 1621ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 1372ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS [REUSE HIT] | 3056ms | Tax: SUCCESS | Tokens: 0
  [Task 3/15] task_1c_markdown_transactions (Markdown Table: Financial Ledger Transactions)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 6ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 2188ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 1056ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS [REUSE HIT] | 1039ms | Tax: SUCCESS | Tokens: 0
  [Task 4/15] task_2a_levenshtein_dna (Levenshtein Alignment: DNA Sequences)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 5ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 2100ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 1294ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS | 1148ms | Tax: SUCCESS | Tokens: 250
  [Task 5/15] task_2b_levenshtein_tokens (Levenshtein Alignment: Identifier Tokens)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 5ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 969ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 1097ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS [REUSE HIT] | 1080ms | Tax: SUCCESS | Tokens: 0
  [Task 6/15] task_2c_levenshtein_sentences (Levenshtein Alignment: Natural Sentences with Typos)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 5ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 1128ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 1266ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS [REUSE HIT] | 1164ms | Tax: SUCCESS | Tokens: 0
  [Task 7/15] task_3a_dijkstra_city (Dijkstra with Turn Penalties: City Grid)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 6ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 1116ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 886ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS | 796ms | Tax: SUCCESS | Tokens: 250
  [Task 8/15] task_3b_dijkstra_circuit (Dijkstra with Turn Penalties: Circuit Trace Routing)
    ↳ Condition A : ❌ FAIL | 1ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 4ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ❌ FAIL | 802ms | Tax: RUNTIME_ERROR | Tokens: 250
    ↳ Condition C : ❌ FAIL (retries: 3) | 4799ms | Tax: RUNTIME_ERROR | Tokens: 1000
    ↳ Condition D : ✔ PASS [REUSE HIT] | 1415ms | Tax: SUCCESS | Tokens: 0
  [Task 9/15] task_3c_dijkstra_warehouse (Dijkstra with Turn Penalties: AGV Warehouse Aisle)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 6ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ❌ FAIL | 894ms | Tax: RUNTIME_ERROR | Tokens: 250
    ↳ Condition C : ❌ FAIL (retries: 3) | 3246ms | Tax: RUNTIME_ERROR | Tokens: 1000
    ↳ Condition D : ✔ PASS [REUSE HIT] | 898ms | Tax: SUCCESS | Tokens: 0
  [Task 10/15] task_4a_csv_sales (CSV 2D Pivot: Retail Sales)
    ↳ Condition A : ❌ FAIL | 1ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 4ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 823ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 800ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS | 798ms | Tax: SUCCESS | Tokens: 250
  [Task 11/15] task_4b_csv_telemetry (CSV 2D Pivot: Infrastructure Telemetry)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 6ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 1389ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 1983ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS [REUSE HIT] | 3169ms | Tax: SUCCESS | Tokens: 0
  [Task 12/15] task_4c_csv_grades (CSV 2D Pivot: Academic Exam Grades)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 4ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 846ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 909ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS [REUSE HIT] | 1479ms | Tax: SUCCESS | Tokens: 0
  [Task 13/15] task_5a_knapsack_cargo (0/1 Dual Knapsack: Freight Cargo Packing)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 5ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 869ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 794ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS | 824ms | Tax: SUCCESS | Tokens: 250
  [Task 14/15] task_5b_knapsack_payload (0/1 Dual Knapsack: Satellite Payload Instruments)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 4ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 982ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 841ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS [REUSE HIT] | 857ms | Tax: SUCCESS | Tokens: 0
  [Task 15/15] task_5c_knapsack_cloud (0/1 Dual Knapsack: Cloud VM Packing)
    ↳ Condition A : ❌ FAIL | 1ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 4ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 818ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 857ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS [REUSE HIT] | 900ms | Tax: SUCCESS | Tokens: 0

================================================================
                   EVALUATION FINAL RESULTS                     
================================================================
Overall Tasks Evaluated: 75
Overall Pass Rate:       41/75 (54.7%) [95% CI: 43.4% - 65.4%]
Real API Calls Made:     0
Disk Cache Hits:         101
Condition D Reuse Rate:  100%

----------------------------------------------------------------
CONDITION PERFORMANCE BREAKDOWN:
----------------------------------------------------------------
Condition A : 0/15 (0.0%) [95% CI: 0%-20.4%] | Latency: 2ms | Tokens: 250 (Thinking: 45)
   Taxonomy: Success: 0, Syntax: 0, Blocked: 0, Runtime: 0, Timeout: 0, Wrong: 15
Condition B : 0/15 (0.0%) [95% CI: 0%-20.4%] | Latency: 5ms | Tokens: 750 (Thinking: 135)
   Taxonomy: Success: 0, Syntax: 0, Blocked: 0, Runtime: 0, Timeout: 0, Wrong: 15
Condition C0: 13/15 (86.7%) [95% CI: 62.1%-96.3%] | Latency: 1422ms | Tokens: 250 (Thinking: 45)
   Taxonomy: Success: 13, Syntax: 0, Blocked: 0, Runtime: 2, Timeout: 0, Wrong: 0
Condition C : 13/15 (86.7%) [95% CI: 62.1%-96.3%] | Latency: 1522ms | Tokens: 350 (Thinking: 63)
   Taxonomy: Success: 13, Syntax: 0, Blocked: 0, Runtime: 2, Timeout: 0, Wrong: 0
Condition D : 15/15 (100.0%) [95% CI: 79.6%-100%] | Latency: 1323ms | Tokens: 83 (Thinking: 15)
   Taxonomy: Success: 15, Syntax: 0, Blocked: 0, Runtime: 0, Timeout: 0, Wrong: 0

----------------------------------------------------------------
CONDITION D FAMILY REUSE BREAKDOWN:
----------------------------------------------------------------
  family1_markdown_table        : 2/2 (100.0% reuse hit rate)
  family2_levenshtein_alignment : 2/2 (100.0% reuse hit rate)
  family3_dijkstra_turns        : 2/2 (100.0% reuse hit rate)
  family4_csv_pivot             : 2/2 (100.0% reuse hit rate)
  family5_knapsack_dual         : 2/2 (100.0% reuse hit rate)
================================================================
```

---

## 5. SMALL REAL RUN STATUS & LIVE GEMINI API ESTIMATION

### 5.1 Environment Status
- `process.env.GEMINI_API_KEY`: **Not set** (verified via test).
- `.env` file: **Does not exist** (verified via test). `.env` is listed in `.gitignore`.
- Security policy: As required by Global Rule 4, no API calls may be attempted without explicit user key provision, and real API calls must have pre-computed estimates.

### 5.2 Verification of Missing-Key Guard
When running against the Gemini provider without a key (`node packages/eval/dist/index.js --small-run --provider=gemini`), the harness enforces immediate failure without leaking unauthenticated network requests:

```text
================================================================
            AETHERFLOW EVALUATION BENCHMARK HARNESS             
  Provider: GEMINI | Model: gemini-2.5-flash
  Tasks: 3 | Conditions: A, B, C0, C, D | Runs: 1
  Rate Limits: 15 RPM | 1500 RPD | Max Calls Cap: 50
  Estimated API Calls: Min: 13 | Typical: 21 | Max: 39
================================================================


▶ [RUN REPETITION 1/1] (Resetting Condition D Tool Library)
  [Task 1/3] task_1a_markdown_employees (Markdown Table: Employee Directory)
    ↳ Condition A : ❌ FAIL | 0ms | Tax: RUNTIME_ERROR | Tokens: 0
    ↳ Condition B : ❌ FAIL (retries: 1) | 0ms | Tax: RUNTIME_ERROR | Tokens: 0
    ↳ Condition C0: ❌ FAIL | 0ms | Tax: RUNTIME_ERROR | Tokens: 0
    ↳ Condition C : ❌ FAIL | 0ms | Tax: RUNTIME_ERROR | Tokens: 0
    ↳ Condition D : ❌ FAIL | 0ms | Tax: RUNTIME_ERROR | Tokens: 0
  [Task 2/3] task_1b_markdown_servers (Markdown Table: Server Telemetry Metrics)
    ↳ Condition A : ❌ FAIL | 0ms | Tax: RUNTIME_ERROR | Tokens: 0
    ↳ Condition B : ❌ FAIL (retries: 1) | 0ms | Tax: RUNTIME_ERROR | Tokens: 0
    ↳ Condition C0: ❌ FAIL | 0ms | Tax: RUNTIME_ERROR | Tokens: 0
    ↳ Condition C : ❌ FAIL | 0ms | Tax: RUNTIME_ERROR | Tokens: 0
    ↳ Condition D : ❌ FAIL | 0ms | Tax: RUNTIME_ERROR | Tokens: 0
  [Task 3/3] task_1c_markdown_transactions (Markdown Table: Financial Ledger Transactions)
    ↳ Condition A : ❌ FAIL | 0ms | Tax: RUNTIME_ERROR | Tokens: 0
    ↳ Condition B : ❌ FAIL (retries: 1) | 0ms | Tax: RUNTIME_ERROR | Tokens: 0
    ↳ Condition C0: ❌ FAIL | 0ms | Tax: RUNTIME_ERROR | Tokens: 0
    ↳ Condition C : ❌ FAIL | 0ms | Tax: RUNTIME_ERROR | Tokens: 0
    ↳ Condition D : ❌ FAIL | 0ms | Tax: RUNTIME_ERROR | Tokens: 0

================================================================
                   EVALUATION FINAL RESULTS                     
================================================================
Overall Tasks Evaluated: 15
Overall Pass Rate:       0/15 (0%) [95% CI: 0% - 20.4%]
Real API Calls Made:     0
Disk Cache Hits:         0
Condition D Reuse Rate:  0%
```

### 5.3 Live Gemini Call Estimation Formula
For a run of $T$ tasks across $N$ repetitions:
- **Condition A**: $N \times T$ calls.
- **Condition B**: $N \times T \times (1 + r_B)$ calls, where $r_B \in [0, 2]$ tool turns.
- **Condition C0**: $N \times T$ calls (single synthesis shot).
- **Condition C**: $N \times T \times (1 + r_C)$ calls, where $r_C \in [0, 3]$ retries.
- **Condition D**: $N \times [F \times (1 + r_D) + (T - F) \times (1 - \text{hitRate}) \times (1 + r_D)]$, where $F$ is the number of families.

#### Small Real Run (3 tasks from Family 1: 1a, 1b, 1c $\times$ 1 run):
- $T = 3, F = 1, N = 1$
- **Min** (all conditions succeed on first attempt; 100% reuse for D variants 1b, 1c):
  $A(3) + B(3) + C0(3) + C(3) + D(1) = \mathbf{13\text{ calls}}$
- **Typical** ($B$ uses 1 retry, $C$ has 1 task retry once, $D$ has 100% reuse):
  $A(3) + B(6) + C0(3) + C(4) + D(1) = \mathbf{17\text{ calls}}$
- **Max** ($B$ exhausts 2 retries, $C$ exhausts 3 retries, $D$ exhausts 3 retries and 0% reuse):
  $A(3) + B(9) + C0(3) + C(12) + D(12) = \mathbf{39\text{ calls}}$

With our configured rate limiter (`--rpm=15`, `--max-calls=50`), this small run requires under 2 minutes of wall clock time and stays safely within free-tier quotas (15 RPM / 1500 RPD).

---

## 6. SMALL 3-TASK DRY-RUN OUTPUT (Condition D Family Reuse Demonstration)

Raw output of `node packages/eval/dist/index.js --small-run --dry-run` validating that variants 1b and 1c hit the Condition D tool library:

```text
================================================================
            AETHERFLOW EVALUATION BENCHMARK HARNESS             
  Provider: MOCK | Model: gemini-2.5-flash
  Tasks: 3 | Conditions: A, B, C0, C, D | Runs: 1
  Rate Limits: 15 RPM | 1500 RPD | Max Calls Cap: 50
  Estimated API Calls: Min: 13 | Typical: 21 | Max: 39
================================================================


▶ [RUN REPETITION 1/1] (Resetting Condition D Tool Library)
  [Task 1/3] task_1a_markdown_employees (Markdown Table: Employee Directory)
    ↳ Condition A : ❌ FAIL | 3ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 6ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 892ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 945ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS | 860ms | Tax: SUCCESS | Tokens: 250
  [Task 2/3] task_1b_markdown_servers (Markdown Table: Server Telemetry Metrics)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 5ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 869ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 793ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS [REUSE HIT] | 827ms | Tax: SUCCESS | Tokens: 0
  [Task 3/3] task_1c_markdown_transactions (Markdown Table: Financial Ledger Transactions)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition B : ❌ FAIL (retries: 2) | 6ms | Tax: WRONG_OUTPUT | Tokens: 750
    ↳ Condition C0: ✔ PASS | 831ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 912ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition D : ✔ PASS [REUSE HIT] | 792ms | Tax: SUCCESS | Tokens: 0

================================================================
                   EVALUATION FINAL RESULTS                     
================================================================
Overall Tasks Evaluated: 15
Overall Pass Rate:       9/15 (60%) [95% CI: 35.7% - 80.2%]
Real API Calls Made:     0
Disk Cache Hits:         19
Condition D Reuse Rate:  100%

----------------------------------------------------------------
CONDITION PERFORMANCE BREAKDOWN:
----------------------------------------------------------------
Condition A : 0/3 (0.0%) [95% CI: 0%-56.2%] | Latency: 2ms | Tokens: 250 (Thinking: 45)
   Taxonomy: Success: 0, Syntax: 0, Blocked: 0, Runtime: 0, Timeout: 0, Wrong: 3
Condition B : 0/3 (0.0%) [95% CI: 0%-56.2%] | Latency: 6ms | Tokens: 750 (Thinking: 135)
   Taxonomy: Success: 0, Syntax: 0, Blocked: 0, Runtime: 0, Timeout: 0, Wrong: 3
Condition C0: 3/3 (100.0%) [95% CI: 43.8%-100%] | Latency: 864ms | Tokens: 250 (Thinking: 45)
   Taxonomy: Success: 3, Syntax: 0, Blocked: 0, Runtime: 0, Timeout: 0, Wrong: 0
Condition C : 3/3 (100.0%) [95% CI: 43.8%-100%] | Latency: 883ms | Tokens: 250 (Thinking: 45)
   Taxonomy: Success: 3, Syntax: 0, Blocked: 0, Runtime: 0, Timeout: 0, Wrong: 0
Condition D : 3/3 (100.0%) [95% CI: 43.8%-100%] | Latency: 826ms | Tokens: 83 (Thinking: 15)
   Taxonomy: Success: 3, Syntax: 0, Blocked: 0, Runtime: 0, Timeout: 0, Wrong: 0

----------------------------------------------------------------
CONDITION D FAMILY REUSE BREAKDOWN:
----------------------------------------------------------------
  family1_markdown_table        : 2/2 (100.0% reuse hit rate)
  family2_levenshtein_alignment : 0/0 (0.0% reuse hit rate)
  family3_dijkstra_turns        : 0/0 (0.0% reuse hit rate)
  family4_csv_pivot             : 0/0 (0.0% reuse hit rate)
  family5_knapsack_dual         : 0/0 (0.0% reuse hit rate)
================================================================
```

---

## 7. STILL UNVERIFIED LIST
1. **Live Gemini API Generation Quality**: We verified the rate limiter, error handling, disk cache, and call quota guards with MockProvider. Live generation against Google's Gemini endpoint requires the user's `GEMINI_API_KEY`.
2. **Empirical Pass Rates on Frontier Reasoning Models**: Whether Condition C dynamically outperforms Condition C0 under stochastic real-world LLM syntax errors will be observed only during the live evaluation run.
3. **AST Verifier False Rejection Rate Under Real LLM Code**: The rate at which the AST verifier rejects valid, benign algorithmic code synthesized by Gemini 2.5 Flash / Gemini 3.8.

---

## 8. GIT STAT & MODIFIED FILES

### 8.1 `git diff --stat`
```text
 .gitignore                                     |   3 +
 EVAL_DESIGN.md                                 | 399 +++++++++++++------------
 REVIEW_A_3.md                                  |   2 +-
 packages/core/src/tests/sandbox-escape.test.ts |   2 +-
 4 files changed, 214 insertions(+), 192 deletions(-)
```

### 8.2 Untracked Files Added in Checkpoint B
- `packages/eval/package.json`
- `packages/eval/tsconfig.json`
- `packages/eval/src/types.ts`
- `packages/eval/src/index.ts`
- `packages/eval/src/cache/ResponseCache.ts`
- `packages/eval/src/checkpoints/CheckpointManager.ts`
- `packages/eval/src/limiter/RateLimiter.ts`
- `packages/eval/src/providers/EvalModelClient.ts`
- `packages/eval/src/utils/json-extractor.ts`
- `packages/eval/src/conditions/ConditionA.ts`
- `packages/eval/src/conditions/ConditionB.ts`
- `packages/eval/src/conditions/ConditionC0.ts`
- `packages/eval/src/conditions/ConditionC.ts`
- `packages/eval/src/conditions/ConditionD.ts`
- `packages/eval/src/harness/EvalHarness.ts`
- `packages/eval/src/tasks/registry.ts`
- `packages/eval/src/tasks/checkers/markdown-checker.ts`
- `packages/eval/src/tasks/checkers/levenshtein-checker.ts`
- `packages/eval/src/tasks/checkers/dijkstra-checker.ts`
- `packages/eval/src/tasks/checkers/csv-pivot-checker.ts`
- `packages/eval/src/tasks/checkers/knapsack-checker.ts`
- `packages/eval/src/tasks/checkers/run-self-tests.ts`
- `packages/eval/src/tasks/definitions/family1_markdown_table.ts`
- `packages/eval/src/tasks/definitions/family2_levenshtein_alignment.ts`
- `packages/eval/src/tasks/definitions/family3_dijkstra_turns.ts`
- `packages/eval/src/tasks/definitions/family4_csv_pivot.ts`
- `packages/eval/src/tasks/definitions/family5_knapsack_dual.ts`
