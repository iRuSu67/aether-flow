/**
 * FlowScript Lexer
 * Tokenizer for the AetherFlow declarative multi-agent pipeline language (.flow)
 */

export type TokenType =
  | 'SWARM'
  | 'AGENT'
  | 'MODEL'
  | 'ROLE'
  | 'PIPELINE'
  | 'TOOL'
  | 'CHANNEL'
  | 'ARROW' // ->
  | 'IDENTIFIER'
  | 'STRING'
  | 'NUMBER'
  | 'LBRACE' // {
  | 'RBRACE' // }
  | 'LPAREN' // (
  | 'RPAREN' // )
  | 'COLON'  // :
  | 'COMMA'  // ,
  | 'EQUALS' // =
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export class FlowScriptLexer {
  private source: string;
  private cursor = 0;
  private line = 1;
  private column = 1;

  constructor(source: string) {
    this.source = source;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.cursor < this.source.length) {
      const char = this.source[this.cursor];

      // Whitespace
      if (/\s/.test(char)) {
        if (char === '\n') {
          this.line++;
          this.column = 1;
        } else {
          this.column++;
        }
        this.cursor++;
        continue;
      }

      // Comments (# or //)
      if (char === '#' || (char === '/' && this.source[this.cursor + 1] === '/')) {
        while (this.cursor < this.source.length && this.source[this.cursor] !== '\n') {
          this.cursor++;
        }
        continue;
      }

      // Operators and Delimiters
      if (char === '-' && this.source[this.cursor + 1] === '>') {
        tokens.push(this.makeToken('ARROW', '->'));
        this.cursor += 2;
        this.column += 2;
        continue;
      }
      if (char === '{') { tokens.push(this.makeToken('LBRACE', '{')); this.advance(); continue; }
      if (char === '}') { tokens.push(this.makeToken('RBRACE', '}')); this.advance(); continue; }
      if (char === '(') { tokens.push(this.makeToken('LPAREN', '(')); this.advance(); continue; }
      if (char === ')') { tokens.push(this.makeToken('RPAREN', ')')); this.advance(); continue; }
      if (char === ':') { tokens.push(this.makeToken('COLON', ':')); this.advance(); continue; }
      if (char === ',') { tokens.push(this.makeToken('COMMA', ',')); this.advance(); continue; }
      if (char === '=') { tokens.push(this.makeToken('EQUALS', '=')); this.advance(); continue; }

      // String literals ("..." or '...')
      if (char === '"' || char === "'") {
        tokens.push(this.readString(char));
        continue;
      }

      // Numeric literals
      if (/[0-9]/.test(char)) {
        tokens.push(this.readNumber());
        continue;
      }

      // Identifiers / Keywords
      if (/[a-zA-Z_]/.test(char)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      throw new Error(`Unexpected character '${char}' at line ${this.line}, column ${this.column}`);
    }

    tokens.push(this.makeToken('EOF', ''));
    return tokens;
  }

  private advance(): void {
    this.cursor++;
    this.column++;
  }

  private makeToken(type: TokenType, value: string): Token {
    return { type, value, line: this.line, column: this.column };
  }

  private readString(quote: string): Token {
    const startCol = this.column;
    this.advance(); // skip opening quote
    let value = '';

    while (this.cursor < this.source.length && this.source[this.cursor] !== quote) {
      value += this.source[this.cursor];
      this.advance();
    }
    this.advance(); // skip closing quote

    return { type: 'STRING', value, line: this.line, column: startCol };
  }

  private readNumber(): Token {
    const startCol = this.column;
    let value = '';
    while (this.cursor < this.source.length && /[0-9.]/.test(this.source[this.cursor])) {
      value += this.source[this.cursor];
      this.advance();
    }
    return { type: 'NUMBER', value, line: this.line, column: startCol };
  }

  private readIdentifier(): Token {
    const startCol = this.column;
    let value = '';
    while (this.cursor < this.source.length && /[a-zA-Z0-9_]/.test(this.source[this.cursor])) {
      value += this.source[this.cursor];
      this.advance();
    }

    const keywords: Record<string, TokenType> = {
      swarm: 'SWARM',
      agent: 'AGENT',
      model: 'MODEL',
      role: 'ROLE',
      pipeline: 'PIPELINE',
      tool: 'TOOL',
      channel: 'CHANNEL',
    };

    const type = keywords[value.toLowerCase()] || 'IDENTIFIER';
    return { type, value, line: this.line, column: startCol };
  }
}
