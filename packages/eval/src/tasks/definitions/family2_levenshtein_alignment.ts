import { BenchmarkTask } from '../../types.js';
import {
  checkLevenshteinAlignment,
  solveLevenshteinReference,
  LevenshteinInput,
} from '../checkers/levenshtein-checker.js';

const levenshteinExample = {
  input: {
    source: 'CAT',
    target: 'BAT',
  },
  output: {
    editDistance: 1,
    operations: [
      { op: 'substitute', char: 'C', replaceWith: 'B' },
      { op: 'keep', char: 'A' },
      { op: 'keep', char: 'T' },
    ],
  },
};

export const task_2a_levenshtein_dna: BenchmarkTask = {
  id: 'task_2a_levenshtein_dna',
  familyId: 'family2_levenshtein_alignment',
  variant: 'a',
  title: 'Levenshtein Alignment: DNA Sequences',
  domain: 'Algorithmic String Alignment',
  prompt: `Compute the optimal Levenshtein edit distance and operation alignment script transforming the source DNA string into the target DNA string.
Valid operations are: 'keep' (matching char), 'substitute' (replace char with new char), 'insert' (add char), 'delete' (remove char).
The total non-keep operations must equal editDistance, and applying operations sequentially to source must reproduce target.

Input:
source = "ATGCGATCGATCGATCGATCGATCGATCGATCGATC"
target = "ATGCTATCGATCGCTCGATCAATCGATCGATCGTTC"`,
  example: levenshteinExample,
  input: {
    source: 'ATGCGATCGATCGATCGATCGATCGATCGATCGATC',
    target: 'ATGCTATCGATCGCTCGATCAATCGATCGATCGTTC',
  } as LevenshteinInput,
  referenceSolution: (inp) => solveLevenshteinReference(inp as LevenshteinInput),
  negativeCases: [
    {
      name: 'Wrong structure',
      output: 4,
      expectedFailureReason: 'Candidate output must be an object',
    },
    {
      name: 'Feasibility violation (script does not produce target)',
      output: {
        editDistance: 4,
        operations: [{ op: 'keep', char: 'A' }, { op: 'keep', char: 'T' }],
      },
      expectedFailureReason: 'did not consume entire source string',
    },
    {
      name: 'Sub-optimal distance reported',
      output: {
        editDistance: 99,
        operations: solveLevenshteinReference({
          source: 'ATGCGATCGATCGATCGATCGATCGATCGATCGATC',
          target: 'ATGCTATCGATCGCTCGATCAATCGATCGATCGTTC',
        }).operations,
      },
      expectedFailureReason: 'Sub-optimal or incorrect editDistance',
    },
  ],
  checker: checkLevenshteinAlignment,
};

export const task_2b_levenshtein_tokens: BenchmarkTask = {
  id: 'task_2b_levenshtein_tokens',
  familyId: 'family2_levenshtein_alignment',
  variant: 'b',
  title: 'Levenshtein Alignment: Identifier Tokens',
  domain: 'Algorithmic String Alignment',
  prompt: `Compute the optimal Levenshtein edit distance and edit script between two program identifier strings.
Output JSON: { "editDistance": number, "operations": [ { "op": "keep"|"insert"|"delete"|"substitute", "char"?: string } ] }

Input:
source = "getComputedStyleFromElementTree"
target = "setComputedLayoutForElementNode"`,
  example: levenshteinExample,
  input: {
    source: 'getComputedStyleFromElementTree',
    target: 'setComputedLayoutForElementNode',
  } as LevenshteinInput,
  referenceSolution: (inp) => solveLevenshteinReference(inp as LevenshteinInput),
  negativeCases: [
    {
      name: 'Wrong structure',
      output: 'Distance is 11',
      expectedFailureReason: 'Candidate output must be an object',
    },
    {
      name: 'Corrupted operations char',
      output: {
        editDistance: 11,
        operations: [{ op: 'substitute', char: 'Z' }],
      },
      expectedFailureReason: 'did not consume entire source string',
    },
    {
      name: 'Sub-optimal distance claim',
      output: {
        editDistance: 2,
        operations: solveLevenshteinReference({
          source: 'getComputedStyleFromElementTree',
          target: 'setComputedLayoutForElementNode',
        }).operations,
      },
      expectedFailureReason: 'Sub-optimal or incorrect editDistance',
    },
  ],
  checker: checkLevenshteinAlignment,
};

export const task_2c_levenshtein_sentences: BenchmarkTask = {
  id: 'task_2c_levenshtein_sentences',
  familyId: 'family2_levenshtein_alignment',
  variant: 'c',
  title: 'Levenshtein Alignment: Natural Sentences with Typos',
  domain: 'Algorithmic String Alignment',
  prompt: `Compute the optimal Levenshtein edit distance and edit operations script transforming source into target.
Output JSON: { "editDistance": number, "operations": [ { "op": "keep"|"insert"|"delete"|"substitute", "char"?: string } ] }

Input:
source = "The quick brown fox jumps over the lazy dog"
target = "A quick brown dog leaps above the lazy fox"`,
  example: levenshteinExample,
  input: {
    source: 'The quick brown fox jumps over the lazy dog',
    target: 'A quick brown dog leaps above the lazy fox',
  } as LevenshteinInput,
  referenceSolution: (inp) => solveLevenshteinReference(inp as LevenshteinInput),
  negativeCases: [
    {
      name: 'Missing operations',
      output: { editDistance: 16 },
      expectedFailureReason: 'Candidate missing operations array',
    },
    {
      name: 'Wrong operation count',
      output: {
        editDistance: 16,
        operations: [{ op: 'keep', char: 'T' }],
      },
      expectedFailureReason: 'Operation count mismatch',
    },
    {
      name: 'Wrong edit distance',
      output: {
        editDistance: 0,
        operations: solveLevenshteinReference({
          source: 'The quick brown fox jumps over the lazy dog',
          target: 'A quick brown dog leaps above the lazy fox',
        }).operations,
      },
      expectedFailureReason: 'Sub-optimal or incorrect editDistance',
    },
  ],
  checker: checkLevenshteinAlignment,
};
