import { Token, TokenType } from './Lexer.js';

export interface AgentAST {
  name: string;
  role: string;
  model?: string;
}

export interface PipelineStepAST {
  agent: string;
  action?: string;
  arguments?: Record<string, string>;
}

export interface SwarmProgramAST {
  name: string;
  agents: AgentAST[];
  pipeline: PipelineStepAST[];
}

export class FlowScriptParser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parse(): SwarmProgramAST {
    this.consume('SWARM', 'Expected "swarm" keyword at start of file');
    const swarmName = this.consume('IDENTIFIER', 'Expected swarm identifier name').value;
    this.consume('LBRACE', 'Expected "{" after swarm name');

    const agents: AgentAST[] = [];
    const pipeline: PipelineStepAST[] = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      if (this.match('AGENT')) {
        agents.push(this.parseAgent());
      } else if (this.match('PIPELINE')) {
        this.parsePipeline(pipeline);
      } else {
        this.advance(); // Skip unknown token safely
      }
    }

    this.consume('RBRACE', 'Expected "}" at end of swarm declaration');

    return {
      name: swarmName,
      agents,
      pipeline,
    };
  }

  private parseAgent(): AgentAST {
    const name = this.consume('IDENTIFIER', 'Expected agent name').value;
    let role = 'custom';
    let model: string | undefined;

    while (!this.check('AGENT') && !this.check('PIPELINE') && !this.check('RBRACE') && !this.isAtEnd()) {
      if (this.match('ROLE')) {
        this.consume('EQUALS', 'Expected "=" after role');
        role = this.consume('IDENTIFIER', 'Expected role value').value;
      } else if (this.match('MODEL')) {
        this.consume('EQUALS', 'Expected "=" after model');
        model = this.consume('STRING', 'Expected model string literal').value;
      } else {
        break;
      }
    }

    return { name, role, model };
  }

  private parsePipeline(pipeline: PipelineStepAST[]): void {
    this.consume('LBRACE', 'Expected "{" after pipeline keyword');

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      const agent = this.consume('IDENTIFIER', 'Expected agent name in pipeline sequence').value;
      let action: string | undefined;

      if (this.match('LPAREN')) {
        if (this.check('STRING') || this.check('IDENTIFIER')) {
          action = this.advance().value;
        }
        this.consume('RPAREN', 'Expected ")" after pipeline step arguments');
      }

      pipeline.push({ agent, action });

      if (this.check('ARROW')) {
        this.advance(); // skip '->'
      }
    }

    this.consume('RBRACE', 'Expected "}" after pipeline sequence');
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`Parse Error [Line ${this.peek().line}, Col ${this.peek().column}]: ${message}`);
  }
}
