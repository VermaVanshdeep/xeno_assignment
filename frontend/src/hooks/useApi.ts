import { useState, useEffect, useCallback } from 'react';

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (...args: any[]) => Promise<T>;
  refetch: () => Promise<T>;
}

export function useApi<T>(
  apiFunc: (...args: any[]) => Promise<T>,
  immediate = true,
  dependencies: any[] = []
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: any[]): Promise<T> => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFunc(...args);
        setData(result);
        return result;
      } catch (err: any) {
        const parsedError = err instanceof Error ? err : new Error(err.message || 'API request failed');
        setError(parsedError);
        throw parsedError;
      } finally {
        setLoading(false);
      }
    },
    [apiFunc]
  );

  useEffect(() => {
    if (immediate) {
      execute().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute, immediate, ...dependencies]);

  return {
    data,
    loading,
    error,
    execute,
    refetch: execute
  };
}
export default useApi;
