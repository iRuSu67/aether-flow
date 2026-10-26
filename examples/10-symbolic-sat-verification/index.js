import { SymbolicSolver } from '@aether-flow/core';

async function main() {
  console.log('📐 [Showcase 10]: Formal Verification & First-Order DPLL SAT Solving\n');

  const solver = new SymbolicSolver();

  console.log('1. Proving Propositional SAT Invariants for Critical System:');
  console.log('   Clause 1: (AuditPassed OR FailSafeTriggered)');
  console.log('   Clause 2: (NOT AuditPassed OR DeployApproved)');
  console.log('   Clause 3: (NOT DeployApproved)');

  solver.addClause([{ name: 'AuditPassed' }, { name: 'FailSafeTriggered' }]);
  solver.addClause([{ name: 'AuditPassed', negated: true }, { name: 'DeployApproved' }]);
  solver.addClause([{ name: 'DeployApproved', negated: true }]);

  const satResult = solver.solveSAT();

  console.log('\n✔ Formal Proof Result:');
  console.log(`Satisfiable: ${satResult.satisfiable ? 'YES' : 'NO (CONTRADICTION)'}`);
  console.log('Model Assignments Discovered:', satResult.assignments);
  console.log('\nProof Steps:');
  satResult.proofSteps.forEach((step, i) => console.log(`  [${i + 1}] ${step}`));

  console.log('\n2. Asserting Numerical Boundary Invariants:');
  solver.setBound('executionTimeoutMs', 100, 10000, true);
  solver.setBound('riskTolerance', 0.0, 1.0);

  const check1 = solver.verifyNumericBounds({ executionTimeoutMs: 5000, riskTolerance: 0.25 });
  console.log('Valid Config Check:', check1.valid ? 'PASSED ✔' : 'FAILED ✖');

  const check2 = solver.verifyNumericBounds({ executionTimeoutMs: 50000, riskTolerance: 1.5 });
  console.log('Invalid Config Violations Caught:', check2.violations);
}

main().catch(console.error);
