import vm from 'node:vm';

interface RunnerPayload {
  code: string;
  args?: Record<string, unknown>;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

interface RunnerResponse {
  success: boolean;
  result?: unknown;
  logs: string[];
  error?: string;
  durationMs: number;
}

// Strip sensitive Node internal bindings from subprocess global immediately
try {
  delete (process as unknown as { mainModule?: unknown }).mainModule;
  delete (process as unknown as { binding?: unknown }).binding;
  delete (process as unknown as { _linkedBinding?: unknown })._linkedBinding;
} catch {
  // Ignore
}

// Global safety fallbacks for uncaught errors
process.on('unhandledRejection', (reason) => {
  const errMessage = reason instanceof Error ? reason.message : String(reason);
  const response: RunnerResponse = {
    success: false,
    error: `Unhandled rejection in sandbox: ${errMessage}`,
    logs: [],
    durationMs: 0,
  };
  try {
    process.stdout.write(JSON.stringify(response));
  } catch {
    // Ignore
  }
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  const response: RunnerResponse = {
    success: false,
    error: `Uncaught exception in sandbox: ${err.message}`,
    logs: [],
    durationMs: 0,
  };
  try {
    process.stdout.write(JSON.stringify(response));
  } catch {
    // Ignore
  }
  process.exit(1);
});

// Buffer stdin payload
let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', async () => {
  const startTime = performance.now();
  const logs: string[] = [];

  try {
    if (!inputData.trim()) {
      throw new Error('Empty payload received by sandbox runner');
    }

    const payload: RunnerPayload = JSON.parse(inputData);
    const timeoutMs = payload.timeoutMs || 4000;
    const maxOutputBytes = payload.maxOutputBytes || 512 * 1024;
    const maxLogBytes = Math.min(512 * 1024, maxOutputBytes);
    const args = payload.args || {};

    // If probing environment directly from test harness
    if (args.__probeEnv === true) {
      const envKeys = Object.keys(process.env);
      const response: RunnerResponse = {
        success: true,
        result: { envKeys, envCount: envKeys.length },
        logs: [],
        durationMs: performance.now() - startTime,
      };
      process.stdout.write(JSON.stringify(response));
      process.exit(0);
    }

    // Isolated VM context realm: NO host-realm objects are passed into contextGlobals.
    // Object, Array, JSON, Math, Date, Number, String, Boolean, RegExp, ArrayBuffer,
    // typed arrays, and DataView are provided intrinsically by the VM context itself.
    // args are passed as a JSON string primitive and parsed inside the context.
    const contextGlobals: Record<string, unknown> = {
      __rawArgs: JSON.stringify(args),
      __maxLogBytes: maxLogBytes,
    };

    const context = vm.createContext(contextGlobals, {
      codeGeneration: { strings: false, wasm: false },
    });

    // Transform code to extract return value into __result
    let runnableCode = payload.code;
    if (/export\s+default\s+async\s+function/i.test(runnableCode)) {
      runnableCode = runnableCode.replace(
        /export\s+default\s+async\s+function\s*([a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}/,
        'async function __fn($2) {$3}\n__result = await __fn(args);'
      );
    } else if (/export\s+default\s+function/i.test(runnableCode)) {
      runnableCode = runnableCode.replace(
        /export\s+default\s+function\s*([a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}/,
        'async function __fn($2) {$3}\n__result = await __fn(args);'
      );
    } else if (/function\s+execute\s*\(/i.test(runnableCode)) {
      runnableCode = `${runnableCode}\n__result = await execute(args);`;
    } else if (!runnableCode.includes('__result')) {
      runnableCode = `__result = await (async () => {\n${runnableCode}\n})();`;
    }

    const contextScript = `
      const __pristineStringify = JSON.stringify;
      const __pristineParse = JSON.parse;
      const __pristineThen = Promise.prototype.then;
      Object.defineProperty(Promise.prototype, 'then', {
        value: __pristineThen,
        writable: false,
        configurable: false,
      });

      const __logs = [];
      let __totalLogBytes = 0;

      function __calcUtf8Bytes(str) {
        let bytes = 0;
        for (let i = 0; i < str.length; i++) {
          const code = str.charCodeAt(i);
          if (code <= 0x7f) bytes += 1;
          else if (code <= 0x7ff) bytes += 2;
          else if (code >= 0xd800 && code <= 0xdbff) { bytes += 4; i++; }
          else bytes += 3;
        }
        return bytes;
      }

      function __appendLog(prefix, items) {
        const msg = prefix + items.map(String).join(' ');
        __totalLogBytes += __calcUtf8Bytes(msg);
        if (__totalLogBytes > __maxLogBytes) {
          throw new Error('Output limit exceeded: console logs exceeded ' + __maxLogBytes + ' bytes limit');
        }
        __logs.push(msg);
      }

      const console = {
        log: (...items) => __appendLog('', items),
        error: (...items) => __appendLog('[ERROR] ', items),
        warn: (...items) => __appendLog('[WARN] ', items),
        info: (...items) => __appendLog('[INFO] ', items),
      };

      const args = __pristineParse(__rawArgs);
      let __result;

      const __execPromise = (async () => {
        ${runnableCode}
      })();

      __pristineThen.call(
        __execPromise,
        () => {
          try {
            __serialized = __pristineStringify({ success: true, result: __result, logs: __logs });
          } catch (serErr) {
            __serialized = __pristineStringify({
              success: false,
              error: 'Failed to serialize return value: ' + (serErr instanceof Error ? serErr.message : String(serErr)),
              logs: __logs,
            });
          }
        },
        (err) => {
          __serialized = __pristineStringify({
            success: false,
            error: err instanceof Error ? err.message : String(err),
            logs: __logs,
          });
        }
      );
    `;

    const script = new vm.Script(contextScript);
    const executionPromise = script.runInContext(context, {
      timeout: timeoutMs,
    });

    if (executionPromise && typeof executionPromise.then === 'function') {
      await executionPromise;
    }

    const rawSerialized = (context as unknown as { __serialized?: string }).__serialized;
    if (typeof rawSerialized !== 'string') {
      throw new Error('Sandbox runner failed to produce serialized output');
    }

    if (Buffer.byteLength(rawSerialized, 'utf8') > maxOutputBytes) {
      throw new Error(
        `Output limit exceeded: Result size exceeds maximum allowed return size (${maxOutputBytes} bytes)`
      );
    }

    const parsedResult = JSON.parse(rawSerialized);
    const durationMs = performance.now() - startTime;
    const response: RunnerResponse = {
      success: Boolean(parsedResult.success),
      result: parsedResult.result,
      logs: Array.isArray(parsedResult.logs) ? parsedResult.logs : [],
      error: parsedResult.error,
      durationMs,
    };

    process.stdout.write(JSON.stringify(response));
    process.exit(0);
  } catch (err) {
    const durationMs = performance.now() - startTime;
    const response: RunnerResponse = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      logs,
      durationMs,
    };
    process.stdout.write(JSON.stringify(response));
    process.exit(0);
  }
});
