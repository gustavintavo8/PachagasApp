export default function HistoryLoading() {
    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8 space-y-2">
                <div className="skeleton h-8 w-48" />
                <div className="skeleton h-4 w-64" />
            </div>
            {/* Stats summary skeleton */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                    <div key={`history-stat-${i}`} className="skeleton h-24 rounded-2xl" />
                ))}
            </div>
            {/* Match cards skeleton */}
            <div className="space-y-4">
                {Array.from({ length: 5 }, (_, i) => (
                    <div key={`history-match-${i}`} className="skeleton h-28 rounded-2xl" />
                ))}
            </div>
        </div>
    );
}
