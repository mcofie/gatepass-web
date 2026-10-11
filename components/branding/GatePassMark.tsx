import Image from 'next/image'
import { cn } from '@/lib/utils'

export function GatePassMark({ className, invertOnDark = true }: { className?: string; invertOnDark?: boolean }) {
    return (
        <Image
            src="/icon.svg"
            alt=""
            aria-hidden="true"
            width={36}
            height={36}
            className={cn('size-9 shrink-0', invertOnDark && 'dark:invert', className)}
        />
    )
}
