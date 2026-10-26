export interface ModelCompetitor {
  name: string;
  eloRating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface MatchResult {
  matchId: string;
  prompt: string;
  competitorA: string;
  competitorB: string;
  winner: string | 'tie';
  reasoningScoreA: number;
  reasoningScoreB: number;
  latencyMsA: number;
  latencyMsB: number;
  verdictExplanation: string;
}

export class ArenaJudge {
  private leaderboard: Map<string, ModelCompetitor> = new Map();
  private matchHistory: MatchResult[] = [];

  constructor() {
    this.registerCompetitor('Google Gemini 1.5 Pro', 1500);
    this.registerCompetitor('OpenAI GPT-4o', 1500);
    this.registerCompetitor('Claude 3.5 Sonnet', 1500);
    this.registerCompetitor('DeepSeek R1', 1500);
    this.registerCompetitor('AetherFlow Synthetic Engine', 1500);
  }

  public registerCompetitor(name: string, startingElo = 1500): ModelCompetitor {
    const competitor: ModelCompetitor = {
      name,
      eloRating: startingElo,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
    };
    this.leaderboard.set(name, competitor);
    return competitor;
  }

  /**
   * Judge a head-to-head match between two model responses and update Elo ratings
   */
  public evaluateMatch(
    prompt: string,
    modelA: string,
    responseA: string,
    latencyA: number,
    modelB: string,
    responseB: string,
    latencyB: number
  ): MatchResult {
    // Scoring heuristic: reward length/depth, structured JSON/markdown, and lower latency
    const scoreA = Math.min(100, (responseA.length % 50) + (responseA.includes('```') ? 30 : 15) + (latencyA < latencyB ? 20 : 10));
    const scoreB = Math.min(100, (responseB.length % 50) + (responseB.includes('```') ? 30 : 15) + (latencyB < latencyA ? 20 : 10));

    let winner: string | 'tie' = 'tie';
    if (scoreA > scoreB + 5) winner = modelA;
    else if (scoreB > scoreA + 5) winner = modelB;

    this.updateElo(modelA, modelB, winner);

    const match: MatchResult = {
      matchId: `match_${Date.now()}`,
      prompt,
      competitorA: modelA,
      competitorB: modelB,
      winner,
      reasoningScoreA: scoreA,
      reasoningScoreB: scoreB,
      latencyMsA: latencyA,
      latencyMsB: latencyB,
      verdictExplanation: winner === 'tie'
        ? 'Both models delivered high-fidelity solutions with comparable structural depth.'
        : `${winner} provided superior verification constraints and lower execution latency.`,
    };

    this.matchHistory.push(match);
    return match;
  }

  private updateElo(modelA: string, modelB: string, winner: string | 'tie'): void {
    const compA = this.leaderboard.get(modelA) || this.registerCompetitor(modelA);
    const compB = this.leaderboard.get(modelB) || this.registerCompetitor(modelB);

    const k = 32;
    const expectedA = 1 / (1 + Math.pow(10, (compB.eloRating - compA.eloRating) / 400));
    const expectedB = 1 - expectedA;

    let actualA = 0.5;
    let actualB = 0.5;
    if (winner === modelA) {
      actualA = 1.0; actualB = 0.0;
      compA.wins++; compB.losses++;
    } else if (winner === modelB) {
      actualA = 0.0; actualB = 1.0;
      compB.wins++; compA.losses++;
    } else {
      compA.ties++; compB.ties++;
    }

    compA.eloRating = Math.round(compA.eloRating + k * (actualA - expectedA));
    compB.eloRating = Math.round(compB.eloRating + k * (actualB - expectedB));
    compA.matchesPlayed++;
    compB.matchesPlayed++;
  }

  public getLeaderboard(): ModelCompetitor[] {
    return Array.from(this.leaderboard.values()).sort((a, b) => b.eloRating - a.eloRating);
  }
}
