import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ApiClientError } from '../api/client';

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApi<T>(path: string | null): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const fetchData = useCallback(async () => {
    const currentPath = pathRef.current;
    if (!currentPath) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<T>(currentPath);
      setData(result);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [path, fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

interface UseMutationState<T, V> {
  mutate: (variables: V) => Promise<T>;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}

export function useMutation<T, V = unknown>(
  fn: (variables: V) => Promise<T>,
): UseMutationState<T, V> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (variables: V): Promise<T> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fn(variables);
      return result;
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'An unexpected error occurred';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fn]);

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  return { mutate, isLoading, error, reset };
}
