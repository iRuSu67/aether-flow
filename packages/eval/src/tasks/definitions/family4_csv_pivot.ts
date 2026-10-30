import { BenchmarkTask } from '../../types.js';
import {
  checkCSVPivot,
  solveCSVPivotReference,
  CSVPivotInput,
} from '../checkers/csv-pivot-checker.js';

const csvPivotExample = {
  input: {
    csv: "Region,Quarter,Revenue,Margin\nNorth,Q1,100,0.20\nNorth,Q1,200,0.30",
    rowField: 'Region',
    colField: 'Quarter',
    sumField: 'Revenue',
    avgField: 'Margin',
  },
  output: {
    North: {
      Q1: { sum: 300, avg: 0.25 },
    },
  },
};

export const task_4a_csv_sales: BenchmarkTask = {
  id: 'task_4a_csv_sales',
  familyId: 'family4_csv_pivot',
  variant: 'a',
  title: 'CSV 2D Pivot: Retail Sales',
  domain: 'Tabular Data Aggregation',
  prompt: `Perform a two-dimensional pivot aggregation on the provided CSV sales records.
Group by row 'Region' and column 'Quarter'.
Aggregate 'Revenue' by sum and 'Margin' by average (rounded to 2 decimal places).
Output JSON: { [region: string]: { [quarter: string]: { "sum": number, "avg": number } } }

CSV:
Region,Quarter,Revenue,Margin
North,Q1,12000,0.25
North,Q1,8000,0.35
North,Q2,15000,0.20
South,Q1,9000,0.18
South,Q2,11000,0.22
South,Q2,7000,0.30`,
  example: csvPivotExample,
  input: {
    csv: `Region,Quarter,Revenue,Margin
North,Q1,12000,0.25
North,Q1,8000,0.35
North,Q2,15000,0.20
South,Q1,9000,0.18
South,Q2,11000,0.22
South,Q2,7000,0.30`,
    rowField: 'Region',
    colField: 'Quarter',
    sumField: 'Revenue',
    avgField: 'Margin',
  } as CSVPivotInput,
  referenceSolution: (inp) => solveCSVPivotReference(inp as CSVPivotInput),
  negativeCases: [
    {
      name: 'Wrong structure (array instead of 2D map)',
      output: [{ Region: 'North', Quarter: 'Q1', sum: 20000, avg: 0.3 }],
      expectedFailureReason: 'Expected candidate output to be a 2D nested map object',
    },
    {
      name: 'Missing row key South',
      output: {
        North: {
          Q1: { sum: 20000, avg: 0.3 },
          Q2: { sum: 15000, avg: 0.2 },
        },
      },
      expectedFailureReason: 'Row keys count mismatch',
    },
    {
      name: 'Wrong avg calculation',
      output: {
        North: {
          Q1: { sum: 20000, avg: 0.99 },
          Q2: { sum: 15000, avg: 0.2 },
        },
        South: {
          Q1: { sum: 9000, avg: 0.18 },
          Q2: { sum: 18000, avg: 0.26 },
        },
      },
      expectedFailureReason: 'avg mismatch',
    },
  ],
  checker: checkCSVPivot,
};

export const task_4b_csv_telemetry: BenchmarkTask = {
  id: 'task_4b_csv_telemetry',
  familyId: 'family4_csv_pivot',
  variant: 'b',
  title: 'CSV 2D Pivot: Infrastructure Telemetry',
  domain: 'Tabular Data Aggregation',
  prompt: `Perform a 2D pivot table aggregation on server telemetry logs.
Group by 'Cluster' as row and 'Tier' as column.
Aggregate 'Requests' by sum and 'LatencyMs' by average (rounded to 2 decimal places).
Output JSON format: { [cluster: string]: { [tier: string]: { "sum": number, "avg": number } } }

CSV:
Cluster,Tier,Requests,LatencyMs
us-east,frontend,45000,12.4
us-east,frontend,55000,14.6
us-east,backend,18000,45.2
eu-west,frontend,32000,18.1
eu-west,backend,12000,52.3
eu-west,backend,14000,48.7`,
  example: csvPivotExample,
  input: {
    csv: `Cluster,Tier,Requests,LatencyMs
us-east,frontend,45000,12.4
us-east,frontend,55000,14.6
us-east,backend,18000,45.2
eu-west,frontend,32000,18.1
eu-west,backend,12000,52.3
eu-west,backend,14000,48.7`,
    rowField: 'Cluster',
    colField: 'Tier',
    sumField: 'Requests',
    avgField: 'LatencyMs',
  } as CSVPivotInput,
  referenceSolution: (inp) => solveCSVPivotReference(inp as CSVPivotInput),
  negativeCases: [
    {
      name: 'Wrong structure',
      output: 'Total requests: 176000',
      expectedFailureReason: 'Expected candidate output to be a 2D nested map object',
    },
    {
      name: 'Missing tier column',
      output: {
        'us-east': { frontend: { sum: 100000, avg: 13.5 } },
        'eu-west': { frontend: { sum: 32000, avg: 18.1 } },
      },
      expectedFailureReason: 'column count mismatch',
    },
    {
      name: 'Wrong sum value',
      output: {
        'us-east': {
          frontend: { sum: 999, avg: 13.5 },
          backend: { sum: 18000, avg: 45.2 },
        },
        'eu-west': {
          frontend: { sum: 32000, avg: 18.1 },
          backend: { sum: 26000, avg: 50.5 },
        },
      },
      expectedFailureReason: 'sum mismatch',
    },
  ],
  checker: checkCSVPivot,
};

export const task_4c_csv_grades: BenchmarkTask = {
  id: 'task_4c_csv_grades',
  familyId: 'family4_csv_pivot',
  variant: 'c',
  title: 'CSV 2D Pivot: Academic Exam Grades',
  domain: 'Tabular Data Aggregation',
  prompt: `Perform a 2D pivot table aggregation on exam records.
Group by 'Subject' (row) and 'GradeLevel' (column).
Aggregate 'Credits' by sum and 'Score' by average (rounded to 2 decimal places).
Output JSON: { [subject: string]: { [gradeLevel: string]: { "sum": number, "avg": number } } }

CSV:
Subject,GradeLevel,Credits,Score
Math,Grade10,4,88.5
Math,Grade10,4,91.5
Math,Grade11,3,78.0
Physics,Grade10,4,84.0
Physics,Grade11,3,92.0
Physics,Grade11,3,86.0`,
  example: csvPivotExample,
  input: {
    csv: `Subject,GradeLevel,Credits,Score
Math,Grade10,4,88.5
Math,Grade10,4,91.5
Math,Grade11,3,78.0
Physics,Grade10,4,84.0
Physics,Grade11,3,92.0
Physics,Grade11,3,86.0`,
    rowField: 'Subject',
    colField: 'GradeLevel',
    sumField: 'Credits',
    avgField: 'Score',
  } as CSVPivotInput,
  referenceSolution: (inp) => solveCSVPivotReference(inp as CSVPivotInput),
  negativeCases: [
    {
      name: 'Wrong structure',
      output: null,
      expectedFailureReason: 'Expected candidate output to be a 2D nested map object',
    },
    {
      name: 'Missing row Math',
      output: {
        Physics: {
          Grade10: { sum: 4, avg: 84.0 },
          Grade11: { sum: 6, avg: 89.0 },
        },
      },
      expectedFailureReason: 'Row keys count mismatch',
    },
    {
      name: 'Wrong average',
      output: {
        Math: {
          Grade10: { sum: 8, avg: 0 },
          Grade11: { sum: 3, avg: 78.0 },
        },
        Physics: {
          Grade10: { sum: 4, avg: 84.0 },
          Grade11: { sum: 6, avg: 89.0 },
        },
      },
      expectedFailureReason: 'avg mismatch',
    },
  ],
  checker: checkCSVPivot,
};
