import ts from 'typescript';

export interface VerificationReport {
  isSafe: boolean;
  warnings: string[];
  bannedPatternsDetected: string[];
  complexityScore: number;
}

/**
 * ASTVerifier
 * Defense-in-depth static analysis engine powered by the TypeScript compiler API.
 * Detects prohibited identifiers, computed property traversal, prototype pollution,
 * dynamic imports, string concatenation evasions, and obvious infinite loops.
 */
export class ASTVerifier {
  private bannedIdentifiers = new Set([
    'process',
    'child_process',
    'require',
    'eval',
    'Function',
    'global',
    'globalThis',
    'window',
    'document',
    'WebSocket',
    'Worker',
    'XMLHttpRequest',
  ]);

  private dangerousProperties = new Set([
    'constructor',
    '__proto__',
    'prototype',
    'process',
    'child_process',
    'mainmodule',
  ]);

  /**
   * Recursively evaluates static string expressions, including string concatenations
   * and template literal expressions (e.g. "con" + "structor" or `con${"struc"}tor`).
   */
  private evaluateStaticString(node: ts.Node): string | null {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return node.text;
    }

    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = this.evaluateStaticString(node.left);
      const right = this.evaluateStaticString(node.right);
      if (left !== null && right !== null) {
        return left + right;
      }
    }

    if (ts.isTemplateExpression(node)) {
      let result = node.head.text;
      for (const span of node.templateSpans) {
        const spanVal = this.evaluateStaticString(span.expression);
        if (spanVal === null) return null;
        result += spanVal + span.literal.text;
      }
      return result;
    }

    if (ts.isParenthesizedExpression(node)) {
      return this.evaluateStaticString(node.expression);
    }

    return null;
  }

  /**
   * Statically verify synthesized JavaScript/TypeScript code before sandbox ingestion.
   */
  public verify(code: string): VerificationReport {
    const warnings: string[] = [];
    const bannedDetected: string[] = [];
    let complexityScore = 1;

    // Parse AST using TypeScript compiler API
    const sourceFile = ts.createSourceFile(
      'synthesized_tool.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    // Check syntax diagnostics if present on parsed source
    const rawDiagnostics = (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics;
    if (rawDiagnostics && rawDiagnostics.length > 0) {
      for (const diag of rawDiagnostics) {
        const message = typeof diag.messageText === 'string' ? diag.messageText : diag.messageText.messageText;
        warnings.push(`SYNTAX_ERROR: ${message}`);
      }
    }

    let hasExecutableSignature = false;

    const walk = (node: ts.Node) => {
      // 1. Cyclomatic complexity tracking
      if (
        ts.isIfStatement(node) ||
        ts.isForStatement(node) ||
        ts.isForInStatement(node) ||
        ts.isForOfStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node) ||
        ts.isCaseClause(node) ||
        ts.isCatchClause(node) ||
        ts.isConditionalExpression(node)
      ) {
        complexityScore++;
      }

      // 2. Detect executable export / function signatures
      if (
        ts.isExportAssignment(node) ||
        (ts.isFunctionDeclaration(node) && node.name?.text === 'execute') ||
        (ts.isFunctionDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      ) {
        hasExecutableSignature = true;
      }

      // 3. Prohibited Identifiers
      if (ts.isIdentifier(node)) {
        if (this.bannedIdentifiers.has(node.text)) {
          // If identifier is not merely a non-computed property assignment in an object literal
          const parent = node.parent;
          const isPropertyAssignmentName = ts.isPropertyAssignment(parent) && parent.name === node;
          if (!isPropertyAssignmentName) {
            bannedDetected.push(`BANNED_IDENTIFIER: ${node.text}`);
          }
        }
      }

      // 4. Dynamic import()
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        bannedDetected.push('DYNAMIC_IMPORT: Dynamic import() calls are prohibited');
      }

      // 5. Static import declaration
      if (ts.isImportDeclaration(node)) {
        bannedDetected.push('STATIC_IMPORT: Module imports are prohibited in synthesized tools');
      }

      // 6. Computed Property Access & Concatenation (e.g. this["con" + "structor"])
      if (ts.isElementAccessExpression(node)) {
        const evaluatedProp = this.evaluateStaticString(node.argumentExpression);
        if (evaluatedProp && this.dangerousProperties.has(evaluatedProp.toLowerCase())) {
          bannedDetected.push(`BANNED_COMPUTED_PROPERTY: Attempted access to dangerous property "${evaluatedProp}"`);
        }
      }

      // 7. Property Access Chains (e.g. this.constructor or obj.__proto__)
      if (ts.isPropertyAccessExpression(node)) {
        const propName = node.name.text.toLowerCase();
        if (this.dangerousProperties.has(propName)) {
          bannedDetected.push(`BANNED_PROPERTY_ACCESS: Access to "${node.name.text}" is prohibited`);
        }
      }

      // 8. Infinite Loops: only flag if loop body lacks a reachable break or return statement
      if (ts.isWhileStatement(node)) {
        const isConstTrue =
          node.expression.kind === ts.SyntaxKind.TrueKeyword ||
          (ts.isNumericLiteral(node.expression) && node.expression.text !== '0');
        if (isConstTrue && !this.hasReachableLoopExit(node.statement)) {
          bannedDetected.push('POTENTIAL_INFINITE_LOOP: while(true)');
        }
      } else if (ts.isForStatement(node)) {
        if (!node.condition && !node.initializer && !node.incrementor && !this.hasReachableLoopExit(node.statement)) {
          bannedDetected.push('POTENTIAL_INFINITE_LOOP: for(;;)');
        }
      }

      ts.forEachChild(node, walk);
    };

    walk(sourceFile);

    // Heuristic execution signature check fallback
    if (!hasExecutableSignature && !code.includes('export default') && !code.includes('function execute') && !code.includes('return')) {
      warnings.push('MISSING_EXECUTION_SIGNATURE: Code does not appear to export an execute function');
    }

    if (complexityScore > 25) {
      warnings.push(`HIGH_CYCLOMATIC_COMPLEXITY: Score ${complexityScore} exceeds standard threshold`);
    }

    const isSafe = bannedDetected.length === 0;

    return {
      isSafe,
      warnings,
      bannedPatternsDetected: bannedDetected,
      complexityScore,
    };
  }

  private hasReachableLoopExit(statement: ts.Statement): boolean {
    let hasExit = false;

    const checkExit = (node: ts.Node) => {
      if (hasExit) return;

      if (ts.isReturnStatement(node)) {
        hasExit = true;
        return;
      }

      if (ts.isBreakStatement(node) && !node.label) {
        hasExit = true;
        return;
      }

      if (
        ts.isForStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node) ||
        ts.isForInStatement(node) ||
        ts.isForOfStatement(node) ||
        ts.isSwitchStatement(node)
      ) {
        const checkReturnOnly = (innerNode: ts.Node) => {
          if (hasExit) return;
          if (ts.isReturnStatement(innerNode)) {
            hasExit = true;
            return;
          }
          ts.forEachChild(innerNode, checkReturnOnly);
        };
        ts.forEachChild(node, checkReturnOnly);
        return;
      }

      ts.forEachChild(node, checkExit);
    };

    checkExit(statement);
    return hasExit;
  }
}
