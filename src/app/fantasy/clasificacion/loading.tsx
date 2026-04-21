export default function ClasificacionLoading() {
    return (
        <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="skeleton h-20 rounded-2xl" />
            ))}
        </div>
    );
}
