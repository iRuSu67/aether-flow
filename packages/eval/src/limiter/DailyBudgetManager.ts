import fs from 'node:fs';
import path from 'node:path';
import {
  DailyBudgetExceededError,
  DailyQuotaExhaustedError,
} from '../utils/errors.js';

export { DailyBudgetExceededError, DailyQuotaExhaustedError };

export interface DailyBudgetRecord {
  datePacific: string;
  callsToday: number;
  maxDailyBudget: number;
  blockedUntil?: string; // ISO string if daily quota was exhausted by Google
  lastUpdated: string;
  note: string;
}

/**
 * Returns the current calendar date in America/Los_Angeles (Pacific Time) as YYYY-MM-DD.
 * Google AI Studio daily free-tier quotas reset at midnight Pacific Time.
 */
export function getPacificDateString(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Computes the exact Date when the next midnight occurs in America/Los_Angeles.
 */
export function getNextPacificMidnight(now = new Date()): Date {
  const pacificDateStr = getPacificDateString(now);
  const [year, month, day] = pacificDateStr.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = tomorrow.getUTCFullYear();
  const nextMonth = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(tomorrow.getUTCDate()).padStart(2, '0');
  const targetIsoDate = `${nextYear}-${nextMonth}-${nextDay}`;

  for (let h = 5; h <= 10; h++) {
    const candidate = new Date(Date.UTC(nextYear, Number(nextMonth) - 1, Number(nextDay), h, 0, 0, 0));
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(candidate);
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const min = parts.find((p) => p.type === 'minute')?.value;
    const pDate = getPacificDateString(candidate);
    if (pDate === targetIsoDate && hour === '00' && min === '00') {
      return candidate;
    }
  }
  // Standard fallback
  return new Date(Date.UTC(nextYear, Number(nextMonth) - 1, Number(nextDay), 7, 0, 0, 0));
}

/**
 * Formats a Date in a specific timezone for user-friendly display.
 */
export function formatInTimezone(date: Date, timeZone = 'Africa/Casablanca'): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

export class DailyBudgetManager {
  private filePath: string;
  private maxDailyBudget: number;

  constructor(filePath = '.eval_daily_budget.json', maxDailyBudget = 18) {
    this.filePath = path.resolve(process.cwd(), filePath);
    this.maxDailyBudget = maxDailyBudget;
  }

  private readRecord(): DailyBudgetRecord {
    const todayPacific = getPacificDateString();
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw) as DailyBudgetRecord;
        if (parsed && parsed.datePacific === todayPacific) {
          return parsed;
        }
      } catch {
        // Fall through on corrupt read
      }
    }

    // New Pacific day: reset call count
    const initial: DailyBudgetRecord = {
      datePacific: todayPacific,
      callsToday: 0,
      maxDailyBudget: this.maxDailyBudget,
      lastUpdated: new Date().toISOString(),
      note: 'Keyed strictly to America/Los_Angeles calendar date (Google AI Studio reset boundary).',
    };
    this.writeRecord(initial);
    return initial;
  }

  private writeRecord(record: DailyBudgetRecord): void {
    try {
      record.lastUpdated = new Date().toISOString();
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

  public getPacificDate(): string {
    return this.readRecord().datePacific;
  }

  public getBlockedUntil(): Date | null {
    const record = this.readRecord();
    if (record.blockedUntil) {
      const d = new Date(record.blockedUntil);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  public isBlocked(now = new Date()): boolean {
    const blockedUntil = this.getBlockedUntil();
    if (!blockedUntil) return false;
    return now.getTime() < blockedUntil.getTime();
  }

  public setBlockedUntil(date: Date): void {
    const record = this.readRecord();
    record.blockedUntil = date.toISOString();
    this.writeRecord(record);
  }

  public getNextResetTime(): Date {
    return getNextPacificMidnight();
  }

  public getNextResetDisplay(userTimezone = 'Africa/Casablanca'): { casablanca: string; pacific: string } {
    const resetDate = this.getNextResetTime();
    return {
      casablanca: formatInTimezone(resetDate, userTimezone),
      pacific: formatInTimezone(resetDate, 'America/Los_Angeles'),
    };
  }

  /**
   * Check if calls are blocked by daily budget exhaustion or previous daily quota limit.
   */
  public checkBudgetOrThrow(now = new Date()): void {
    const record = this.readRecord();

    // 1. Check if blocked by a previous daily-quota 429
    if (this.isBlocked(now)) {
      const reset = this.getNextResetDisplay('Africa/Casablanca');
      throw new DailyQuotaExhaustedError(
        `[DAILY QUOTA BLOCKED] Google API daily quota is exhausted. Blocked until next Pacific midnight (${reset.casablanca} Casablanca time / ${reset.pacific} Pacific). Refusing API calls until reset.`,
        { resetTimeCasablanca: reset.casablanca, blockedUntil: record.blockedUntil }
      );
    }

    // 2. Check if daily budget call count reached
    if (record.callsToday >= this.maxDailyBudget) {
      const reset = this.getNextResetDisplay('Africa/Casablanca');
      throw new DailyBudgetExceededError(
        `Daily API call budget reached (${record.callsToday}/${this.maxDailyBudget} calls used today on Pacific date ${record.datePacific}). Next reset at ${reset.casablanca} (Casablanca) / ${reset.pacific} (Pacific). State saved. Run 'npm run eval:daily' tomorrow to resume.`
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
