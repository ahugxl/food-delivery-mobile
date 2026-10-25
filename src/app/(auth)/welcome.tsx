import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { AuthButton, AuthScreen } from '@/src/components/auth/AuthUI';
import colors from '@/constants/colors';

export default function WelcomeScreen() {
  return (
    <AuthScreen>
      <View className="flex-1 items-center justify-center py-12">
        <View className="mb-10 h-64 w-64 items-center justify-center rounded-full bg-sage">
          <View className="h-44 w-44 items-center justify-center rounded-full bg-forest">
            <Ionicons
              name="restaurant"
              size={86}
              color={colors.light.background}
            />
          </View>
          <View className="absolute bottom-2 right-2 h-16 w-16 items-center justify-center rounded-full border-4 border-cream bg-coral">
            <Ionicons name="heart" size={28} color="white" />
          </View>
        </View>
        <Text className="mb-4 font-semibold text-xs uppercase tracking-widest text-coral">
          Food Delivery
        </Text>
        <Text
          accessibilityRole="header"
          className="mb-5 text-center font-bold text-4xl leading-tight text-ink"
        >
          Good food.{'\n'}Great moments.
        </Text>
        <Text className="px-3 text-center font-regular text-base leading-7 text-muted">
          Your favorite flavors, delivered to your door. A delicious day starts
          here.
        </Text>
      </View>
      <View className="gap-4 pb-6">
        <AuthButton
          title="Login"
          onPress={() => router.push('/(auth)/login')}
        />
        <AuthButton
          title="Sign Up"
          secondary
          onPress={() => router.push('/(auth)/register')}
        />
        <Text className="mt-2 text-center font-regular text-xs text-muted">
          Made for your everyday cravings.
        </Text>
      </View>
    </AuthScreen>
  );
}
