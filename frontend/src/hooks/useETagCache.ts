// ETag caching hook for Customer Profile API
// Manages ETag storage and If-None-Match header logic per PRD contract
// Handles 304 Not Modified responses with cached data

import { useRef } from 'react';

interface ETagEntry {
  etag: string;
  data: unknown;
  timestamp: number;
}

// Global ETag cache - persists across component unmounts
const etagCache = new Map<string, ETagEntry>();

export function useETagCache<TData = unknown>(cacheKey: string) {
  const currentDataRef = useRef<TData | null>(null);

  const getCachedData = (): TData | null => {
    const entry = etagCache.get(cacheKey);
    if (!entry) return null;

    // Optional: Implement cache expiration (e.g., 1 hour)
    const maxAge = 60 * 60 * 1000; // 1 hour in ms
    if (Date.now() - entry.timestamp > maxAge) {
      etagCache.delete(cacheKey);
      return null;
    }

    return entry.data as TData;
  };

  const getETag = (): string | null => {
    const entry = etagCache.get(cacheKey);
    return entry?.etag || null;
  };

  const storeETagData = (etag: string, data: TData): void => {
    currentDataRef.current = data;
    etagCache.set(cacheKey, {
      etag,
      data,
      timestamp: Date.now(),
    });
  };

  const getIfNoneMatchHeader = (): Record<string, string> => {
    const etag = getETag();
    return etag ? { 'If-None-Match': etag } : {};
  };

  const handleResponse = (response: { status: number; headers?: { etag?: string }; data?: TData }): TData | null => {
    // 304 Not Modified - return cached data
    if (response.status === 304) {
      const cached = getCachedData() || currentDataRef.current;
      return cached;
    }

    // Successful response with data
    if (response.status >= 200 && response.status < 300 && response.data) {
      const etag = response.headers?.etag;
      if (etag) {
        storeETagData(etag, response.data);
      }
      return response.data;
    }

    return null;
  };

  return {
    getCachedData,
    getETag,
    storeETagData,
    getIfNoneMatchHeader,
    handleResponse,
  };
}
