import vm from 'node:vm';

export interface SandboxExecutionResult {
  success: boolean;
  result?: unknown;
  logs: string[];
  error?: string;
  durationMs: number;
}

/**
 * Safe execution sandbox for running synthesized tool code and dynamic scripts.
 * Employs timeouts, custom contexts, and captured console logs.
 */
export class Sandbox {
  private timeoutMs: number;

  constructor(timeoutMs = 5000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Execute raw JS code or an exported function in a fortified vm context.
   */
  async execute(code: string, args: Record<string, unknown> = {}): Promise<SandboxExecutionResult> {
    const startTime = performance.now();
    const logs: string[] = [];

    const customConsole = {
      log: (...items: unknown[]) => logs.push(items.map(String).join(' ')),
      error: (...items: unknown[]) => logs.push('[ERROR] ' + items.map(String).join(' ')),
      warn: (...items: unknown[]) => logs.push('[WARN] ' + items.map(String).join(' ')),
    };

    const sandboxGlobals = {
      console: customConsole,
      Math,
      Date,
      JSON,
      Number,
      String,
      Boolean,
      Array,
      Object,
      RegExp,
      Buffer,
      args,
      __result: undefined as unknown,
    };

    const context = vm.createContext(sandboxGlobals);

    // Transform ES export or bare function to context execution
    let runnableCode = code;
    if (runnableCode.includes('export default async function')) {
      runnableCode = runnableCode.replace(
        /export default async function\s*([a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}/,
        'async function __fn($2) {$3}\n__result = await __fn(args);'
      );
    } else if (runnableCode.includes('export default function')) {
      runnableCode = runnableCode.replace(
        /export default function\s*([a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}/,
        'function __fn($2) {$3}\n__result = __fn(args);'
      );
    } else if (!runnableCode.includes('__result')) {
      runnableCode = `(async () => {\n${runnableCode}\n})().then(res => { __result = res; });`;
    }

    try {
      const script = new vm.Script(`
        (async () => {
          ${runnableCode}
        })()
      `);

      await script.runInContext(context, {
        timeout: this.timeoutMs,
      });

      const durationMs = performance.now() - startTime;
      return {
        success: true,
        result: sandboxGlobals.__result,
        logs,
        durationMs,
      };
    } catch (err) {
      const durationMs = performance.now() - startTime;
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        logs,
        durationMs,
      };
    }
  }
}
