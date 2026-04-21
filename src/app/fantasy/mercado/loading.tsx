export default function MercadoLoading() {
    return (
        <div className="space-y-4">
            <div className="skeleton h-12 rounded-xl" />
            <div className="skeleton h-10 rounded-xl" />
            <div className="flex gap-2">
                {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="skeleton h-7 w-14 rounded-full" />
                ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="skeleton h-20 rounded-2xl" />
                ))}
            </div>
        </div>
    );
}
