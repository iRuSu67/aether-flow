import fs from 'node:fs';
import path from 'node:path';

export class DailyBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyBudgetExceededError';
  }
}

export class DailyQuotaExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyQuotaExhaustedError';
  }
}

export interface DailyBudgetRecord {
  date: string;
  timezone: string;
  callsToday: number;
  maxDailyBudget: number;
  note: string;
}

export function getLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class DailyBudgetManager {
  private filePath: string;
  private maxDailyBudget: number;
  private timezone: string;

  constructor(filePath = '.eval_daily_budget.json', maxDailyBudget = 18) {
    this.filePath = path.resolve(process.cwd(), filePath);
    this.maxDailyBudget = maxDailyBudget;
    try {
      this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      this.timezone = 'UTC';
    }
  }

  private readRecord(): DailyBudgetRecord {
    const today = getLocalDateString();
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw) as DailyBudgetRecord;
        if (parsed && parsed.date === today) {
          return parsed;
        }
      } catch {
        // Fall through on corrupt read
      }
    }

    // New day or missing record: initialize
    const initial: DailyBudgetRecord = {
      date: today,
      timezone: this.timezone,
      callsToday: 0,
      maxDailyBudget: this.maxDailyBudget,
      note: 'Date-keyed in local timezone; approximate vs Google API daily reset (00:00 UTC / midnight PT).',
    };
    this.writeRecord(initial);
    return initial;
  }

  private writeRecord(record: DailyBudgetRecord): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(record, null, 2), 'utf8');
    } catch (err) {
      console.warn(`[DailyBudgetManager] Warning: failed to persist daily budget to ${this.filePath}`);
    }
  }

  public getCallsToday(): number {
    return this.readRecord().callsToday;
  }

  public getRemainingCalls(): number {
    const record = this.readRecord();
    return Math.max(0, this.maxDailyBudget - record.callsToday);
  }

  public getMaxBudget(): number {
    return this.maxDailyBudget;
  }

  public setMaxBudget(max: number): void {
    this.maxDailyBudget = max;
    const record = this.readRecord();
    record.maxDailyBudget = max;
    this.writeRecord(record);
  }

  /**
   * Check if budget is exhausted before dispatching an API call.
   * Throws DailyBudgetExceededError if limit reached.
   */
  public checkBudgetOrThrow(): void {
    const record = this.readRecord();
    if (record.callsToday >= this.maxDailyBudget) {
      throw new DailyBudgetExceededError(
        `Daily API call budget exhausted (${record.callsToday}/${this.maxDailyBudget} calls used today on ${record.date} [${record.timezone}]). State saved. Run 'npm run eval:daily' tomorrow to resume.`
      );
    }
  }

  /**
   * Record every API call attempt (initial call, retry, or failed call).
   */
  public recordCall(): void {
    const record = this.readRecord();
    record.callsToday += 1;
    this.writeRecord(record);
  }
}
