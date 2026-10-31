export default function HistoryLoading() {
    return (
        <div aria-hidden="true" className="pb-6">
            <div className="flex items-center justify-between gap-4 px-4 pb-2 pt-1">
                <div className="skeleton h-8 w-28" />
                <div className="skeleton my-1.5 h-8 w-28" />
            </div>
            <div className="px-4 pb-5 pt-3">
                <div className="skeleton h-14 w-full" />
                <div className="skeleton mt-4 h-12 w-full" />
                <div className="mt-4 grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }, (_, i) => (
                        <div key={i}>
                            <div className="skeleton h-11 w-10" />
                            <div className="skeleton mt-1 h-[18px] w-full" />
                        </div>
                    ))}
                </div>
                <div className="mt-5 flex items-center gap-3">
                    <div className="skeleton size-11 flex-none" />
                    <div className="skeleton h-6 w-full" />
                </div>
            </div>
            <div className="border-t border-border">
                {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3">
                        <div className="skeleton size-9 flex-none" />
                        <div className="min-w-0 flex-1">
                            <div className="skeleton h-5 w-full" />
                            <div className="skeleton mt-1 h-4 w-2/3" />
                        </div>
                        <div className="skeleton h-12 w-[104px] flex-none" />
                    </div>
                ))}
            </div>
        </div>
    );
}
