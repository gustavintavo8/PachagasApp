export default function CalendarLoading() {
    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8 space-y-2">
                <div className="skeleton h-8 w-40" />
                <div className="skeleton h-4 w-56" />
            </div>
            <div className="skeleton h-[500px] rounded-2xl" />
        </div>
    );
}
