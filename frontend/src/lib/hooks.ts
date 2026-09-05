import { useCallback, useEffect, useRef, useState } from 'react';

/** Small async-state helper: run a promise, track data/error/loading. */
export function useAsyncState<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fnRef.current());
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, run };
}

/** Poll `fn` while `enabled`; stop when `shouldStop(result)` is true. */
export function usePolling<T>(
  fn: () => Promise<T>,
  { enabled = true, intervalMs = 1500, shouldStop }: {
    enabled?: boolean;
    intervalMs?: number;
    shouldStop?: (result: T) => boolean;
  },
) {
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const stopRef = useRef(shouldStop);
  stopRef.current = shouldStop;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const tick = useCallback(async () => {
    if (!enabled) return;
    try {
      const value = await fnRef.current();
      setResult(value);
      setError(null);
      if (stopRef.current?.(value)) {
        stop();
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
    if (enabled && !timerRef.current) {
      timerRef.current = setTimeout(tick, intervalMs);
    }
  }, [enabled, intervalMs, stop]);

  useEffect(() => {
    if (!enabled) return;
    tick();
    return () => {
      stop();
    };
  }, [enabled, tick, stop]);

  return { result, error, stop };
}
