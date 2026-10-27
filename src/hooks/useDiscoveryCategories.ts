import { useQuery } from '@tanstack/react-query';
import { catalogApi, catalogKeys } from '../services/catalog';

export function useDiscoveryCategories() {
  return useQuery({ queryKey: catalogKeys.discoveryCategories, queryFn: ({ signal }) => catalogApi.discoveryCategories(signal) });
}
