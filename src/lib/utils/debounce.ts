// Trailing-edge debounce. Each invocation resets the timer; the wrapped
// function fires exactly once `ms` milliseconds after the last call.
//
// Behaviour notes:
//   - Calls that arrive within `ms` of each other collapse into a single
//     trailing call with the args from the LAST invocation.
//   - The first invocation is NOT immediate (no leading edge).
//   - Negative or non-finite `ms` is silently coerced by `setTimeout`.
export function debounce<TArgs extends readonly unknown[]>(
    fn: (...args: TArgs) => void,
    ms: number,
): (...args: TArgs) => void {
    let timer: ReturnType<typeof setTimeout> | undefined
    return (...args: TArgs): void => {
        if (timer !== undefined) clearTimeout(timer)
        timer = setTimeout(() => {
            timer = undefined
            fn(...args)
        }, ms)
    }
}
