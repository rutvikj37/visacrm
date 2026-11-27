import { Skeleton } from "@heroui/react";

/** Grey placeholders shaped like the content, shown while it loads (feels faster than a spinner). */

export const LineSkeleton = ({ w = "w-full", h = "h-3" }: { w?: string; h?: string }) => <Skeleton className={`rounded-md ${w} ${h}`} />;

export const ListSkeleton = ({ rows = 6 }: { rows?: number }) => (
    <div className="flex flex-col divide-y divide-default-100" aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3 px-1">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 flex flex-col gap-2"><LineSkeleton w={i % 2 ? "w-2/5" : "w-1/3"} /><LineSkeleton w="w-1/4" h="h-2.5" /></div>
                <Skeleton className="h-6 w-16 rounded-full max-sm:hidden" />
                <Skeleton className="h-3 w-20 rounded-md max-md:hidden" />
            </div>
        ))}
    </div>
);

export const CardListSkeleton = ({ cards = 4 }: { cards?: number }) => (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
        {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="rounded-xl border border-default-200 p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2"><LineSkeleton w="w-1/2" h="h-4" /><Skeleton className="h-5 w-14 rounded-full ml-auto" /></div>
                <LineSkeleton w="w-2/3" h="h-2.5" />
                <div className="flex gap-2"><Skeleton className="h-8 flex-1 rounded-lg" /><Skeleton className="h-8 flex-1 rounded-lg" /><Skeleton className="h-8 flex-1 rounded-lg" /></div>
            </div>
        ))}
    </div>
);

export const TilesSkeleton = ({ tiles = 4 }: { tiles?: number }) => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-busy="true">
        {Array.from({ length: tiles }).map((_, i) => (
            <div key={i} className="rounded-xl border border-default-200 p-3 flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" /><div className="flex-1 flex flex-col gap-2"><LineSkeleton w="w-10" h="h-5" /><LineSkeleton w="w-2/3" h="h-2.5" /></div>
            </div>
        ))}
    </div>
);

export const BoardSkeleton = ({ columns = 4 }: { columns?: number }) => (
    <div className="flex gap-3 overflow-hidden" aria-busy="true">
        {Array.from({ length: columns }).map((_, c) => (
            <div key={c} className="w-64 shrink-0 rounded-xl bg-default-50 p-2 flex flex-col gap-2">
                <LineSkeleton w="w-1/2" h="h-4" />
                {Array.from({ length: 3 - (c % 2) }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
        ))}
    </div>
);

/** Whole page: title, tiles and a list - used while a page's code is downloading. */
export const PageSkeleton = () => (
    <div className="flex flex-col gap-4 py-2" aria-busy="true" aria-label="Loading">
        <div className="flex flex-col gap-2"><LineSkeleton w="w-48" h="h-7" /><LineSkeleton w="w-72" h="h-3" /></div>
        <TilesSkeleton />
        <div className="rounded-xl border border-default-200 p-3"><ListSkeleton rows={5} /></div>
    </div>
);

/**
 * Soft Suspense fallback for route changes.
 * A full PageSkeleton on every lazy navigation feels like a white flash;
 * reserve height only so the shell (sidebar/header) stays put.
 */
export const SoftRouteFallback = () => (
    <div className="min-h-[50vh] w-full flex flex-col gap-3 pt-1" aria-busy="true" aria-label="Loading page">
        <div className="h-2.5 w-40 rounded bg-default-200/70 animate-pulse" />
        <div className="h-2.5 w-64 max-w-full rounded bg-default-100/80 animate-pulse" />
    </div>
);
