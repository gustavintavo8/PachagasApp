export type Profile = {
    id: string;
    username: string | null;
    avatar_url: string | null;
    position: "GK" | "DEF" | "MID" | "FWD" | null;
    skill_level: number | null;
    matches_played: number;
    goals_scored: number;
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
