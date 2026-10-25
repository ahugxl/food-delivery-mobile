import { recommendedRestaurants } from './home/restaurants';
import { catalog } from './search/catalog';

export function loadMockData<T>(
  data: T,
  signal?: AbortSignal,
  delay = 900,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Request aborted'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Request aborted'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(data);
    }, delay);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export const fetchRestaurants = (signal?: AbortSignal) =>
  loadMockData(recommendedRestaurants, signal);
export const fetchFood = (id: string, signal?: AbortSignal) =>
  loadMockData(catalog.find((item) => item.food.id === id) ?? null, signal);
