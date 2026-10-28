# AetherFlow Mathematical & Algorithmic Foundations

This document provides formal descriptions of the algorithmic models and heuristics employed across the AetherFlow microkernel.

> [!NOTE]
> Implementation Status:
> - **Verified & Operational**: Propositional DPLL SAT Solver (`SymbolicSolver`), Cosine Similarity Search (`VectorMemory`), Join-Semilattice LWW (`CRDTStore`), Graph BFS (`KnowledgeGraph`).
> - **Heuristic / In-Development**: Hegelian Dialectic Consensus Loop (`HegelianEngine`), Monte Carlo Tree Search (`MCTSEngine`), Speculative Pruning (`SpeculativeEngine`).

---

## 1. Dialectic Consensus Model

The multi-agent consensus engine models structured debate between complementary cognitive roles over discrete refinement rounds $r \in \{1, \dots, R_{\max}\}$.

### 1.1 Triadic Debate Operator
Let $\mathcal{S}$ denote the state space of partial or proposed solutions. The debate operator $\mathcal{H}$ coordinates:
- **Architect ($\theta \in \mathcal{S}$)**: Generates a candidate solution (Thesis).
- **Critic ($\alpha$)**: Evaluates $\theta$ against requirements and failure modes (Antithesis).
- **Synthesizer ($\sigma \in \mathcal{S}$)**: Reconciles $\theta$ and objections in $\alpha$ into a refined solution (Synthesis).

$$\sigma = \mathcal{H}(\theta, \alpha)$$

### 1.2 Termination Semantics
Termination occurs when either:
1. The evaluation metric satisfies target acceptance threshold $\tau$:
   $$\text{Score}(\sigma_r) \ge \tau$$
2. The maximum round count is exhausted ($r = R_{\max}$), returning the highest-scoring candidate.

*Note on Convergence*: The prototype engine previously utilized a fixed monotonic step increment. In production, consensus convergence is not an analytic guarantee; it depends directly on model reasoning quality and verifiable automated test feedback.

---

## 2. Monte Carlo Tree Search & UCB1 Selection Policy

For non-linear search over multi-step decision spaces (`MCTSEngine`), candidate trajectories are structured as a search tree $\mathcal{T}$. Each node $s \in \mathcal{T}$ tracks visit count $N(s)$ and cumulative quality score $Q(s)$.

### 2.1 The UCB1 Selection Formula
During the selection phase, traversal chooses child $s'$ maximizing the Upper Confidence Bound (Auer et al., 2002):

$$\text{UCB1}(s') = \frac{Q(s')}{N(s')} + C \sqrt{\frac{\ln N(s)}{N(s')}}$$

where $C = \sqrt{2} \approx 1.414$ balances empirical exploitation against epistemic exploration.

---

## 3. Vector Embedding & Metric Space

Document embeddings are indexed in $\mathbb{R}^d$ ($d = 64$ in the lightweight built-in memory) and normalized onto the unit hypersphere $\mathbb{S}^{d-1}$.

### 3.1 Cosine Similarity
For normalized vectors $u, v \in \mathbb{S}^{d-1}$ where $\|u\|_2 = \|v\|_2 = 1$:

$$\mathcal{S}_{\cos}(u, v) = u \cdot v = \sum_{i=1}^d u_i v_i \in [-1, 1]$$

The angular distance metric:
$$d_{\theta}(u, v) = \frac{1}{\pi} \arccos(u \cdot v)$$
satisfies non-negativity, symmetry, and the triangle inequality over $\mathbb{S}^{d-1}$.

---

## 4. Conflict-Free Replicated Data Types (CRDT)

Distributed agent state synchronization is modeled as a state-based Join-Semilattice $\langle \mathcal{S}, \sqcup \rangle$:

1. **Commutativity**: $x \sqcup y = y \sqcup x$
2. **Associativity**: $(x \sqcup y) \sqcup z = x \sqcup (y \sqcup z)$
3. **Idempotence**: $x \sqcup x = x$

In the Last-Write-Wins Element Set (`CRDTStore`), concurrent updates resolve deterministically using monotonic timestamps:
$$\text{LWW}(e_1, e_2) = \begin{cases} e_1 & \text{if } t(e_1) \ge t(e_2) \\ e_2 & \text{otherwise} \end{cases}$$

---

## 5. Propositional Satisfiability (Backtracking Search)

The `SymbolicSolver` implements recursive backtracking search over Conjunctive Normal Form (CNF) propositional formulas:
$$\varphi = \bigwedge_{i=1}^m \bigvee_{j=1}^{k_i} l_{i,j}$$

The solver guarantees soundness and refutational completeness over finite propositional CNF inputs:
- If $\varphi$ is satisfiable, the backtracking search discovers a satisfying assignment $\mathcal{M} \models \varphi$.
- If $\varphi$ is unsatisfiable, the search refutes satisfiability after exhaustively pruning conflicting branches.
*(Note: Full DPLL with clause-level unit propagation and pure-literal elimination is planned on the formal verification roadmap).*
