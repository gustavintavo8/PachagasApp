export default function PlayersLoading() {
    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8 space-y-2">
                <div className="skeleton h-8 w-32" />
                <div className="skeleton h-4 w-56" />
            </div>
            {/* Search bar skeleton */}
            <div className="skeleton mb-4 h-12 w-full rounded-xl" />
            {/* Filter buttons */}
            <div className="mb-6 flex gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="skeleton h-8 w-16 rounded-full" />
                ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton h-36 rounded-2xl" />
                ))}
            </div>
        </div>
    );
}
