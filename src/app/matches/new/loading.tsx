export default function NewMatchLoading() {
    return (
        <div aria-hidden="true">
            <div className="space-y-7 px-4 pb-6 pt-1">
                <div>
                    <div className="skeleton h-8 w-44" />
                    <div className="skeleton mt-3 h-14 w-56" />
                </div>
                <div className="space-y-3">
                    <div className="skeleton h-6 w-32" />
                    <div className="flex gap-1 overflow-hidden">
                        {Array.from({ length: 8 }, (_, i) => (
                            <div key={i} className="skeleton h-16 w-[52px] flex-none" />
                        ))}
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                        {Array.from({ length: 5 }, (_, i) => (
                            <div key={i} className="skeleton h-12" />
                        ))}
                    </div>
                    <div className="skeleton h-12 w-full" />
                </div>
                <div className="space-y-3">
                    <div className="skeleton h-6 w-28" />
                    <div className="skeleton h-12 w-full" />
                    <div className="skeleton h-12 w-full" />
                </div>
            </div>
            <div className="sticky bottom-[var(--barra-inferior)] border-t border-border bg-background px-4 py-3">
                <div className="skeleton h-[52px] w-full" />
            </div>
        </div>
    );
}
