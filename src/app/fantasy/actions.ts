"use server";

import type { ActionResult } from "@/lib/types";

const FANTASY_DISABLED_ERROR = "Fantasy está desactivado temporalmente.";

function fantasyDisabledResult(): ActionResult {
    return { success: false, error: FANTASY_DISABLED_ERROR };
}

export async function createFantasyTeam(_name: string): Promise<ActionResult> {
    return fantasyDisabledResult();
}

export async function buyPlayer(_teamId: string, _playerId: string): Promise<ActionResult> {
    return fantasyDisabledResult();
}

export async function sellPlayer(_teamId: string, _playerId: string): Promise<ActionResult> {
    return fantasyDisabledResult();
}

export async function setCaptain(_teamId: string, _playerId: string): Promise<ActionResult> {
    return fantasyDisabledResult();
}

export async function saveLineup(_teamId: string, _starterIds: string[]): Promise<ActionResult> {
    return fantasyDisabledResult();
}
