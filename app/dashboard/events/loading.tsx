import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-24 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <Skeleton className="h-10 w-48 mb-2 bg-gray-200" />
                    <Skeleton className="h-6 w-96 bg-gray-100" />
                </div>
                <Skeleton className="h-12 w-40 rounded-2xl bg-black/10" />
            </div>

            {/* Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="rounded-3xl border border-gray-100 overflow-hidden h-full flex flex-col bg-white">
                        <div className="aspect-[4/3] bg-gray-100 relative">
                            {/* Poster Placeholder */}
                        </div>
                        <div className="p-6 flex-1 flex flex-col space-y-4">
                            <Skeleton className="h-6 w-3/4 bg-gray-200" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-1/2 bg-gray-100" />
                                <Skeleton className="h-4 w-1/3 bg-gray-100" />
                            </div>
                            <div className="pt-6 mt-auto border-t border-gray-50 flex gap-3">
                                <Skeleton className="h-10 flex-1 rounded-xl bg-gray-100" />
                                <Skeleton className="h-10 w-10 rounded-xl bg-gray-100" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
