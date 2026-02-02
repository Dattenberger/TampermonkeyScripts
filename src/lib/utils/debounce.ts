export function debounce<T extends (...args: unknown[]) => void>(func: T, waitTime: number = 150): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitTime);
  };
}
