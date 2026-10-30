import fs from 'node:fs';
import path from 'node:path';
import { TaskRunResult } from '../types.js';

export interface CheckpointData {
  updatedAt: string;
  completedTasks: TaskRunResult[];
}

export class CheckpointManager {
  private filePath: string;

  constructor(filename = 'eval_checkpoint.json') {
    this.filePath = path.resolve(process.cwd(), filename);
  }

  public load(): CheckpointData {
    if (!fs.existsSync(this.filePath)) {
      return { updatedAt: new Date().toISOString(), completedTasks: [] };
    }
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as CheckpointData;
    } catch {
      return { updatedAt: new Date().toISOString(), completedTasks: [] };
    }
  }

  public record(result: TaskRunResult): void {
    const data = this.load();
    // Replace or append
    const existingIdx = data.completedTasks.findIndex(
      (t) =>
        t.taskId === result.taskId &&
        t.condition === result.condition &&
        t.runIndex === result.runIndex
    );
    if (existingIdx >= 0) {
      data.completedTasks[existingIdx] = result;
    } else {
      data.completedTasks.push(result);
    }
    data.updatedAt = new Date().toISOString();
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error(`Failed to write checkpoint to ${this.filePath}:`, e);
    }
  }

  public isCompleted(taskId: string, condition: string, runIndex: number): boolean {
    const data = this.load();
    return data.completedTasks.some(
      (t) => t.taskId === taskId && t.condition === condition && t.runIndex === runIndex
    );
  }
}
