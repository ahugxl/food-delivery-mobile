import AsyncStorage from '@react-native-async-storage/async-storage';
import { createRecipientStorage } from '../features/location/recipientStorage';

export const deliveryRecipientStorage = createRecipientStorage(AsyncStorage);
