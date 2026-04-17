export type Profile = {
    id: string;
    username: string | null;
    avatar_url: string | null;
    position: "GK" | "DEF" | "MID" | "FWD" | null;
    skill_level: number | null;
    elo_rating: number;
    matches_played: number;
    goals_scored: number;
    market_value: number | null;
};

export type FantasyTeam = {
    id: string;
    user_id: string;
    name: string;
    logo_url: string | null;
    budget: number;
    total_points: number;
};

export type FantasyRoster = {
    team_id: string;
    player_id: string;
    is_captain: boolean;
};

export type MatchStatus = "open" | "closed" | "finished" | "cancelled";

export type Match = {
    id: string;
    date: string;
    location: string;
    max_players: number;
    status: MatchStatus;
    team_a_score: number | null;
    team_b_score: number | null;
    created_by: string;
    finished_at: string | null;
};

export type MatchParticipant = {
    match_id: string;
    user_id: string;
    team: "A" | "B" | null;
    goals: number;
    is_mvp: boolean;
};

export type MatchWithParticipants = Match & {
    participants: (MatchParticipant & { profiles: Profile })[];
};
