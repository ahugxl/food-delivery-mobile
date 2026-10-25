import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPersistedCartStore } from './cartPersistence';

export const useCartStore = createPersistedCartStore(AsyncStorage);
