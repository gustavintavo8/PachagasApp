export default function MatchesLoading() {
    return (
        <div aria-hidden="true" className="pb-6">
            <div className="flex items-center justify-between gap-4 px-4 pb-2 pt-1">
                <div className="skeleton h-8 w-28" />
                <div className="skeleton h-11 w-[72px]" />
            </div>
            <div className="flex gap-6 border-b border-border px-4">
                <div className="my-3 h-5 w-24 skeleton" />
                <div className="my-3 h-5 w-28 skeleton" />
            </div>
            <div className="border-b border-border px-4 pb-5 pt-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="skeleton h-14 w-48" />
                    <div className="skeleton mt-1 h-6 w-20" />
                </div>
                <div className="skeleton mt-2 h-5 w-56" />
                <div className="mt-3 flex items-end justify-between gap-4">
                    <div className="skeleton h-6 w-[236px] max-w-[60%]" />
                    <div className="skeleton h-8 w-20" />
                </div>
            </div>
            <div className="border-b border-border px-4 py-4">
                <div className="skeleton h-10 w-40" />
                <div className="skeleton mt-2 h-5 w-56" />
                <div className="skeleton mt-3 h-6 w-[236px] max-w-[60%]" />
            </div>
            <div className="mt-6">
                <div className="skeleton mx-4 mb-2 h-8 w-32" />
                <div className="flex items-center gap-3 border-y border-border px-4 py-3">
                    <div className="skeleton size-9 flex-none" />
                    <div className="min-w-0 flex-1">
                        <div className="skeleton h-5 w-full" />
                        <div className="skeleton mt-1 h-4 w-2/3" />
                    </div>
                    <div className="skeleton h-12 w-[104px] flex-none" />
                </div>
            </div>
        </div>
    );
}
