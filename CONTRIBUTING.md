# Contributing to AetherFlow

We welcome contributions from systems architects, security researchers, and AI engineers!

## Architectural Principles

1. **Fail-Closed Security**: Default execution must always enforce the strongest isolation boundary (`mode: 'docker'`). Subprocess execution without Docker is strictly an insecure development mode requiring explicit opt-in (`unsafeDevMode: true`).
2. **Defense-in-Depth**: Never rely on a single layer of containment. Defenses must include static AST inspection, isolated VM realms with stripped host prototypes, and containerized OS kernel sandboxing (`--network none`, `--read-only`, non-root user, capability dropping, cgroups limits).
3. **No Unverified Claims**: Any performance, security, or benchmark claim must be backed by a deterministic test or reproducible benchmark script.
4. **Scope Integrity**: v0.1 scope is frozen to the verified sandbox and dynamic tool synthesis loop. Experimental subsystems remain quarantined in `packages/core/src/experimental/`.

---

## Development Setup

### 1. Prerequisites
- **Node.js**: $\ge$ 20.0.0
- **Docker**: Docker Engine or Docker Desktop (required for default sandbox execution)

### 2. Clean Installation & Build
```bash
git clone https://github.com/iRuSu67/aether-flow.git
cd aether-flow
npm ci
npm run build
```

### 3. Verification Commands
```bash
# Typecheck across monorepo
npm run typecheck

# Lint across monorepo
npm run lint

# Run the 57 automated unit and security tests
npm test

# Run Docker mutation defense verification (7 layers)
node scripts/verify_mutations.js --mode=docker

# Run Subprocess mutation defense verification (6 layers)
node scripts/verify_mutations.js --mode=subprocess

# Run the interactive quickstart demo
npm run demo
```

---

## Pull Request Guidelines
- Follow TypeScript strict mode conventions.
- Ensure all unit tests pass cleanly with `npm test`.
- Add tests for new sandbox boundaries, attack vectors, or synthesizer behaviors.
- Ensure any modifications to sandbox containment are tested against `scripts/verify_mutations.js`.
- Keep commit messages concise, imperative, and structured (`feat:`, `fix:`, `test:`, `docs:`, `perf:`).
