export default function MatchesLoading() {
    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8 flex items-center justify-between">
                <div className="space-y-2">
                    <div className="skeleton h-8 w-40" />
                    <div className="skeleton h-4 w-56" />
                </div>
                <div className="skeleton h-12 w-36 rounded-xl" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton h-44 rounded-2xl" />
                ))}
            </div>
        </div>
    );
}
