import { ToolDefinition } from '../types.js';
import { VectorMemory } from './VectorMemory.js';

export interface PersistentSkill {
  name: string;
  description: string;
  code: string;
  parameters: ToolDefinition['parameters'];
  successCount: number;
  failureCount: number;
  averageExecutionMs: number;
  createdAt: number;
  tags: string[];
}

export class SkillRegistry {
  private skills: Map<string, PersistentSkill> = new Map();
  private vectorIndex: VectorMemory<{ skillName: string }>;

  constructor() {
    this.vectorIndex = new VectorMemory<{ skillName: string }>(64);
  }

  /**
   * Register a newly verified tool as a permanent skill in the library
   */
  public saveSkill(tool: ToolDefinition, tags: string[] = []): PersistentSkill {
    const skill: PersistentSkill = {
      name: tool.name,
      description: tool.description,
      code: tool.synthesizedCode || '',
      parameters: tool.parameters,
      successCount: 1,
      failureCount: 0,
      averageExecutionMs: 12.0,
      createdAt: Date.now(),
      tags,
    };

    this.skills.set(tool.name, skill);
    // Index into semantic vector store for fuzzy retrieval
    this.vectorIndex.insert(
      `skill_${tool.name}`,
      `${tool.name}: ${tool.description} ${tags.join(' ')}`,
      { skillName: tool.name }
    );

    return skill;
  }

  /**
   * Search for pre-learned skills relevant to a subtask
   */
  public findSkills(query: string, topK = 3): PersistentSkill[] {
    const matches = this.vectorIndex.search(query, topK, 0.0);
    const results: PersistentSkill[] = [];

    for (const match of matches) {
      const skillName = match.record.metadata.skillName;
      const skill = this.skills.get(skillName);
      if (skill) {
        results.push(skill);
      }
    }

    return results;
  }

  public recordSuccess(name: string, durationMs: number): void {
    const skill = this.skills.get(name);
    if (skill) {
      skill.successCount += 1;
      skill.averageExecutionMs = (skill.averageExecutionMs + durationMs) / 2;
    }
  }

  public listSkills(): PersistentSkill[] {
    return Array.from(this.skills.values());
  }

  public size(): number {
    return this.skills.size;
  }
}
