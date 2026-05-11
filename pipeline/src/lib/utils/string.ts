export function nonEmpty(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.length > 0
}

export function truncate(value: string, max: number, ellipsis = '…'): string {
    if (value.length <= max) return value
    if (max <= ellipsis.length) return value.slice(0, max)
    return value.slice(0, max - ellipsis.length) + ellipsis
}
