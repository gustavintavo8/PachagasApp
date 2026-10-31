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
            <div className="px-4 pb-6 pt-5">
                <div className="skeleton h-[min(107px,27vw)] w-4/5" />
                <div className="skeleton mt-3 h-6 w-2/3" />
                <div className="mt-5 flex items-end justify-between gap-3">
                    <div className="skeleton h-[min(78px,20vw)] w-[52%]" />
                    <div className="skeleton mb-1 h-12 w-20" />
                </div>
                <div className="skeleton mt-3 h-[33px] w-full" />
            </div>
            <div className="skeleton h-24 w-full" />
            <div className="flex items-start gap-3 px-4 py-3">
                <div className="skeleton size-9 flex-none" />
                <div className="min-w-0 flex-1">
                    <div className="skeleton h-8 w-4/5" />
                    <div className="skeleton mt-1 h-[18px] w-2/3" />
                </div>
            </div>
            <div className="pt-5">
                <div className="skeleton mx-4 mb-2 h-8 w-24" />
                <div className="flex items-start gap-3 border-y border-border px-4 py-3">
                    <div className="min-w-0 flex-1">
                        <div className="skeleton h-8 w-32" />
                        <div className="skeleton mt-1 h-[18px] w-2/3" />
                        <div className="skeleton mt-2 h-4 w-[196px] max-w-full" />
                    </div>
                    <div className="skeleton h-12 w-20 flex-none" />
                </div>
            </div>
        </div>
    );
}
