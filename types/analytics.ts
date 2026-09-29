export interface Player {
  id: string;
  nickname: string;
  avatarUrl?: string;
  role?: string;
  country?: string;
  profileUrl?: string;
  rating2?: number;
  kd?: number;
  adr?: number;
  kast?: number;
}

export interface RecentMatch {
  id: string;
  date: string;
  tournament?: string;
  team1Id: string;
  team1Name: string;
  team2Id: string;
  team2Name: string;
  team1Score?: number;
  team2Score?: number;
  winnerId?: string;
  url?: string;
}

export interface TeamAnalytics {
  id: string;
  name: string;
  sourceName?: string;
  logoUrl?: string;
  rating?: number;
  players: Player[];
  recentMatches: RecentMatch[];
}

export interface HeadToHead {
  matches: RecentMatch[];
  wins: Record<string, number>;
}

export interface WinProbability {
  team1: number;
  team2: number;
  components: { name: string; weight: number; team1Share: number; sampleSize: number }[];
  label: string;
}

export interface MatchAnalytics {
  matchId: string;
  tournament?: string;
  matchDate?: string;
  teams: [TeamAnalytics, TeamAnalytics];
  headToHead: HeadToHead;
  winProbability: WinProbability | null;
  source: 'Liquipedia MediaWiki';
  warnings: string[];
}
