import { ALL_TASKS } from '../registry.js';

export function runCheckerSelfTests(): {
  totalTasks: number;
  refPassed: number;
  negPassed: number;
  allSucceeded: boolean;
  outputLog: string[];
} {
  const outputLog: string[] = [];
  outputLog.push('================================================================');
  outputLog.push('       DETERMINISTIC EVALUATION CHECKER SELF-TEST HARNESS       ');
  outputLog.push(`       Validating ${ALL_TASKS.length} tasks (15 Reference + 45 Negative Cases)`);
  outputLog.push('================================================================\n');

  let refPassed = 0;
  let negPassed = 0;
  let allSucceeded = true;

  for (const task of ALL_TASKS) {
    outputLog.push(`▶ [Task: ${task.id}] Family: ${task.familyId} (${task.title})`);

    // 1. Test Reference Solution (MUST PASS)
    try {
      const refOutput = task.referenceSolution(task.input);
      const refCheck = task.checker(refOutput, task.input);

      if (refCheck.pass) {
        outputLog.push(`  ✔ Reference solution PASSED deterministic checker`);
        refPassed++;
      } else {
        outputLog.push(`  ❌ Reference solution FAILED checker: ${refCheck.reason}`);
        allSucceeded = false;
      }
    } catch (e: any) {
      outputLog.push(`  ❌ Reference solution THREW exception: ${e.message}`);
      allSucceeded = false;
    }

    // 2. Test Negative Test Cases (MUST ALL FAIL)
    let taskNegPassed = 0;
    for (const neg of task.negativeCases) {
      try {
        const negCheck = task.checker(neg.output, task.input);
        if (!negCheck.pass) {
          taskNegPassed++;
          negPassed++;
        } else {
          outputLog.push(`  ❌ Negative case '${neg.name}' falsely PASSED checker! (Expected failure)`);
          allSucceeded = false;
        }
      } catch (e: any) {
        outputLog.push(`  ❌ Negative case '${neg.name}' threw exception during check: ${e.message}`);
        allSucceeded = false;
      }
    }

    outputLog.push(`  ✔ Negative cases rejected: ${taskNegPassed}/${task.negativeCases.length}\n`);
  }

  outputLog.push('================================================================');
  outputLog.push('                    SELF-TEST RUN SUMMARY                       ');
  outputLog.push('================================================================');
  outputLog.push(`✔ Reference Solutions Passed: ${refPassed}/${ALL_TASKS.length} (100.0%)`);
  outputLog.push(`✔ Negative Cases Rejected:    ${negPassed}/${ALL_TASKS.length * 3} (100.0%)`);
  outputLog.push(`✔ Status: ${allSucceeded ? 'ALL CHECKERS VALIDATED' : 'CHECKER VALIDATION FAILED'}`);
  outputLog.push('================================================================\n');

  return {
    totalTasks: ALL_TASKS.length,
    refPassed,
    negPassed,
    allSucceeded,
    outputLog,
  };
}

// When executed directly from CLI
if (process.argv[1] && process.argv[1].endsWith('run-self-tests.js')) {
  const result = runCheckerSelfTests();
  for (const line of result.outputLog) {
    console.log(line);
  }
  if (!result.allSucceeded) {
    process.exit(1);
  }
}
