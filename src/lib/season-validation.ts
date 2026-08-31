export function isSeasonSlug(value: string): boolean {
    return /^season-[1-9][0-9]*$/.test(value);
}

export function normalizeAccessCode(value: string): string {
    return value.trim();
}
