export default function Loading() {
    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            {/* Header skeleton */}
            <div className="mb-8 flex items-center justify-between">
                <div className="space-y-2">
                    <div className="skeleton h-8 w-48" />
                    <div className="skeleton h-4 w-64" />
                </div>
                <div className="skeleton h-12 w-36 rounded-xl" />
            </div>

            {/* Stats skeleton */}
            <div className="mb-8 grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }, (_, i) => (
                    <div key={`stat-skeleton-${i}`} className="skeleton h-28 rounded-2xl" />
                ))}
            </div>

            {/* Cards skeleton */}
            <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }, (_, i) => (
                    <div key={`card-skeleton-${i}`} className="skeleton h-36 rounded-2xl" />
                ))}
            </div>
        </div>
    );
}
