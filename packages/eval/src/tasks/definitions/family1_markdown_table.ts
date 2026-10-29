import { BenchmarkTask } from '../../types.js';
import {
  checkMarkdownTable,
  parseMarkdownTableReference,
  MarkdownTableInput,
} from '../checkers/markdown-checker.js';

const markdownTableExample = {
  input: {
    markdown: `| Key | Value |\n| :--- | :--- |\n| alpha | 10 |`,
  },
  output: [{ Key: 'alpha', Value: 10 }],
};

export const task_1a_markdown_employees: BenchmarkTask = {
  id: 'task_1a_markdown_employees',
  familyId: 'family1_markdown_table',
  variant: 'a',
  title: 'Markdown Table: Employee Directory',
  domain: 'Text & Delimiter Parsing',
  prompt: `Parse the following markdown table into an array of JSON objects where each object represents a row.
Columns should be keys. Whitespace around headers and cells should be trimmed.
Escaped pipes (\\|) in cell text should be preserved as literal '|'.
Boolean strings ("true"/"false") should be parsed as booleans.
Numeric strings should be parsed as numbers.

Markdown input:
| Name | Role | Salary | Active | Notes |
| :--- | :--- | :--- | :---: | :--- |
| Alice Smith | Lead Engineer | 145000 | true | Full-time \\| Remote |
| Bob Jones | Designer | 95000 | false | On leave |
| Charlie Brown | Product Manager | 120000 | true | Core \\| Platform |`,
  example: markdownTableExample,
  input: {
    markdown: `| Name | Role | Salary | Active | Notes |
| :--- | :--- | :--- | :---: | :--- |
| Alice Smith | Lead Engineer | 145000 | true | Full-time \\| Remote |
| Bob Jones | Designer | 95000 | false | On leave |
| Charlie Brown | Product Manager | 120000 | true | Core \\| Platform |`,
  } as MarkdownTableInput,
  referenceSolution: (inp) => parseMarkdownTableReference(inp as MarkdownTableInput),
  negativeCases: [
    {
      name: 'Wrong structure (flat object instead of array)',
      output: { error: 'Failed to parse' },
      expectedFailureReason: 'Expected candidate output to be an array of row objects',
    },
    {
      name: 'Unescaped pipe corrupted fields',
      output: [
        { Name: 'Alice Smith', Role: 'Lead Engineer', Salary: 145000, Active: true, Notes: 'Full-time' },
        { Name: 'Bob Jones', Role: 'Designer', Salary: 95000, Active: false, Notes: 'On leave' },
      ],
      expectedFailureReason: 'Row count mismatch',
    },
    {
      name: 'Wrong data values',
      output: [
        { Name: 'Alice Smith', Role: 'Lead Engineer', Salary: 999999, Active: true, Notes: 'Full-time | Remote' },
        { Name: 'Bob Jones', Role: 'Designer', Salary: 95000, Active: false, Notes: 'On leave' },
        { Name: 'Charlie Brown', Role: 'Product Manager', Salary: 120000, Active: true, Notes: 'Core | Platform' },
      ],
      expectedFailureReason: 'mismatch',
    },
  ],
  checker: checkMarkdownTable,
};

export const task_1b_markdown_servers: BenchmarkTask = {
  id: 'task_1b_markdown_servers',
  familyId: 'family1_markdown_table',
  variant: 'b',
  title: 'Markdown Table: Server Telemetry Metrics',
  domain: 'Text & Delimiter Parsing',
  prompt: `Parse the following markdown table of cloud servers into an array of JSON objects.
Columns should be keys. Strip edge pipes and trim whitespace.
Escaped pipes (\\|) should become literal '|'.
Booleans and numbers should be properly typed.

Markdown input:
| Hostname | IP Address | LoadAvg | Provisioned | Tags |
| :--- | :--- | :--- | :---: | :--- |
| web-prod-01 | 10.0.1.12 | 1.45 | true | aws \\| us-east-1 |
| db-replica-02 | 10.0.2.25 | 4.80 | true | db \\| postgres |
| staging-test | 10.0.3.99 | 0.12 | false | test \\| ephemeral |`,
  example: markdownTableExample,
  input: {
    markdown: `| Hostname | IP Address | LoadAvg | Provisioned | Tags |
| :--- | :--- | :--- | :---: | :--- |
| web-prod-01 | 10.0.1.12 | 1.45 | true | aws \\| us-east-1 |
| db-replica-02 | 10.0.2.25 | 4.80 | true | db \\| postgres |
| staging-test | 10.0.3.99 | 0.12 | false | test \\| ephemeral |`,
  } as MarkdownTableInput,
  referenceSolution: (inp) => parseMarkdownTableReference(inp as MarkdownTableInput),
  negativeCases: [
    {
      name: 'Wrong structure',
      output: 'Hostname, IP Address, LoadAvg',
      expectedFailureReason: 'Expected candidate output to be an array of row objects',
    },
    {
      name: 'Missing row',
      output: [
        { Hostname: 'web-prod-01', 'IP Address': '10.0.1.12', LoadAvg: 1.45, Provisioned: true, Tags: 'aws | us-east-1' },
      ],
      expectedFailureReason: 'Row count mismatch',
    },
    {
      name: 'Untyped string instead of number',
      output: [
        { Hostname: 'web-prod-01', 'IP Address': '10.0.1.12', LoadAvg: '1.45', Provisioned: true, Tags: 'aws | us-east-1' },
        { Hostname: 'db-replica-02', 'IP Address': '10.0.2.25', LoadAvg: '4.80', Provisioned: true, Tags: 'db | postgres' },
        { Hostname: 'staging-test', 'IP Address': '10.0.3.99', LoadAvg: '0.12', Provisioned: false, Tags: 'test | ephemeral' },
      ],
      expectedFailureReason: 'mismatch',
    },
  ],
  checker: checkMarkdownTable,
};

export const task_1c_markdown_transactions: BenchmarkTask = {
  id: 'task_1c_markdown_transactions',
  familyId: 'family1_markdown_table',
  variant: 'c',
  title: 'Markdown Table: Financial Ledger Transactions',
  domain: 'Text & Delimiter Parsing',
  prompt: `Parse the following markdown financial transaction ledger into an array of JSON objects.
Columns should be keys. Escaped pipes should be unescaped. Types should be coerced.

Markdown input:
| TxID | Account | Amount | Cleared | RoutingInfo |
| :--- | :--- | :--- | :---: | :--- |
| TX-8821 | ACC-901 | 4250.75 | true | wire \\| fedwire |
| TX-8822 | ACC-402 | 120.00 | true | ach \\| standard |
| TX-8823 | ACC-119 | 8500.00 | false | international \\| swift |`,
  example: markdownTableExample,
  input: {
    markdown: `| TxID | Account | Amount | Cleared | RoutingInfo |
| :--- | :--- | :--- | :---: | :--- |
| TX-8821 | ACC-901 | 4250.75 | true | wire \\| fedwire |
| TX-8822 | ACC-402 | 120.00 | true | ach \\| standard |
| TX-8823 | ACC-119 | 8500.00 | false | international \\| swift |`,
  } as MarkdownTableInput,
  referenceSolution: (inp) => parseMarkdownTableReference(inp as MarkdownTableInput),
  negativeCases: [
    {
      name: 'Wrong structure',
      output: null,
      expectedFailureReason: 'Expected candidate output to be an array of row objects',
    },
    {
      name: 'Missing row key Cleared',
      output: [
        { TxID: 'TX-8821', Account: 'ACC-901', Amount: 4250.75, RoutingInfo: 'wire | fedwire' },
        { TxID: 'TX-8822', Account: 'ACC-402', Amount: 120.00, RoutingInfo: 'ach | standard' },
        { TxID: 'TX-8823', Account: 'ACC-119', Amount: 8500.00, RoutingInfo: 'international | swift' },
      ],
      expectedFailureReason: 'key count mismatch',
    },
    {
      name: 'Corrupted amount',
      output: [
        { TxID: 'TX-8821', Account: 'ACC-901', Amount: 0, Cleared: true, RoutingInfo: 'wire | fedwire' },
        { TxID: 'TX-8822', Account: 'ACC-402', Amount: 120.00, Cleared: true, RoutingInfo: 'ach | standard' },
        { TxID: 'TX-8823', Account: 'ACC-119', Amount: 8500.00, Cleared: false, RoutingInfo: 'international | swift' },
      ],
      expectedFailureReason: 'mismatch',
    },
  ],
  checker: checkMarkdownTable,
};
