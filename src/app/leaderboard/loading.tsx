export default function LeaderboardLoading() {
    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8 space-y-2">
                <div className="skeleton h-8 w-40" />
                <div className="skeleton h-4 w-64" />
            </div>
            <div className="mb-6 flex gap-2">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="skeleton h-10 w-28 rounded-xl" />
                ))}
            </div>
            <div className="mb-8 grid gap-4 sm:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-52 rounded-2xl" />
                ))}
            </div>
            <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton h-16 rounded-xl" />
                ))}
            </div>
        </div>
    );
}
