import { useEffect, useState } from 'react';
import { UserLocation } from '../types';
import type { AstroWorkerRequestType, AstroWorkerResponse } from '../services/astroWorker';

let sharedWorker: Worker | null = null;

function getAstroWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(new URL('../services/astroWorker.ts', import.meta.url), { type: 'module' });
  }
  return sharedWorker;
}

let nextRequestId = 1;

/**
 * Runs a heavy multi-decade astronomy calculation on a background Worker so
 * switching location/year doesn't block the main thread and freeze the UI.
 */
export function useAstroWorkerData<T>(
  type: AstroWorkerRequestType,
  location: UserLocation
): { data: T | null; isLoading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const worker = getAstroWorker();
    const requestId = nextRequestId++;

    const handleMessage = (event: MessageEvent<AstroWorkerResponse>) => {
      if (event.data.id !== requestId) return;
      setData(event.data.result as T);
      setIsLoading(false);
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ id: requestId, type, location });

    return () => {
      worker.removeEventListener('message', handleMessage);
    };
  }, [type, location]);

  return { data, isLoading };
}
