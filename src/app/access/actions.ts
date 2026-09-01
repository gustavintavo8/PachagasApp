"use server";

import { revalidatePath } from "next/cache";

import { redeemAccessCode } from "@/lib/access";
import type { ActionResult } from "@/lib/types";

export async function redeemCommunityAccess(code: string): Promise<ActionResult> {
    const result = await redeemAccessCode(code);

    if (!result.success) {
        return result;
    }

    revalidatePath("/");
    return { success: true, data: undefined };
}
