import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { DriverAvatar } from '../components/DriverAvatar';
import { driverProfile } from '../features/order/orderData';
import { useColors } from '@/hooks/useColors';
import Toast from 'react-native-toast-message';
import { useOrderStore } from '../store/orderStore';
import { FlowHeader } from '../components/FlowUI';

const ratingTags = ['Service', 'Supportive', 'Friendly', 'Delivery'];

export default function RatingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const submitted = useRef(false);
  const completeLatestOrder = useOrderStore(
    (state) => state.completeLatestOrder,
  );

  const toggleTag = (tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((selected) => selected !== tag)
        : [...current, tag],
    );
  };

  const submitRating = () => {
    if (rating === 0 || submitted.current) return;
    submitted.current = true;
    completeLatestOrder();
    Toast.show({ type: 'success', text1: 'Thank you for your feedback!' });
    router.replace('/');
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <FlowHeader title="Rate your delivery" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarWrap}>
            <View
              style={[styles.avatarHalo, { backgroundColor: colors.accent }]}
            />
            <DriverAvatar size={112} />
          </View>
          <Text className="text-ink" style={styles.driverName}>
            {driverProfile.name}
          </Text>
          <Text style={[styles.prompt, { color: colors.mutedForeground }]}>
            How was your delivery?
          </Text>

          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Rate your delivery from one to five stars"
            style={styles.starsRow}
          >
            {Array.from({ length: 5 }, (_, index) => {
              const value = index + 1;
              const selected = value <= rating;
              return (
                <Pressable
                  key={value}
                  testID={`rating-star-${value}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                  accessibilityState={{ selected }}
                  onPress={() => setRating(value)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={selected ? 'star' : 'star-outline'}
                    size={33}
                    color={selected ? colors.primary : colors.border}
                  />
                </Pressable>
              );
            })}
          </View>

          <Text className="text-ink" style={styles.sectionTitle}>
            What stood out?
          </Text>
          <View style={styles.tagsWrap}>
            {ratingTags.map((tag) => {
              const selected = selectedTags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  testID={`rating-tag-${tag.toLowerCase()}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleTag(tag)}
                  className={selected ? 'bg-forest' : 'bg-card'}
                  style={[
                    styles.tag,
                    {
                      borderColor: selected
                        ? colors.accentForeground
                        : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagText,
                      {
                        color: selected
                          ? colors.primaryForeground
                          : colors.foreground,
                      },
                    ]}
                  >
                    {tag}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="text-ink" style={styles.sectionTitle}>
            Leave a note
          </Text>
          <TextInput
            testID="rating-feedback"
            accessibilityLabel="Delivery feedback"
            value={feedback}
            onChangeText={setFeedback}
            placeholder="Share a few words about your experience..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
            style={[
              styles.feedbackInput,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
          />
        </ScrollView>

        <View
          style={[
            styles.submitWrap,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <Pressable
            testID="submit-rating"
            accessibilityRole="button"
            accessibilityState={{ disabled: rating === 0 }}
            disabled={rating === 0}
            onPress={submitRating}
            className={rating > 0 ? 'bg-coral' : 'bg-sage'}
            style={styles.submitButton}
          >
            <Text
              style={[
                styles.submitText,
                {
                  color:
                    rating > 0
                      ? colors.primaryForeground
                      : colors.accentForeground,
                },
              ]}
            >
              Submit
            </Text>
            <Ionicons
              name="arrow-forward"
              size={17}
              color={
                rating > 0 ? colors.primaryForeground : colors.accentForeground
              }
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
  },
  avatarWrap: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  avatarHalo: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
  },
  driverName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 21,
    marginBottom: 5,
  },
  prompt: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 20,
    marginBottom: 31,
  },
  starButton: {
    width: 42,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    marginBottom: 11,
  },
  tagsWrap: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 25,
  },
  tag: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  feedbackInput: {
    alignSelf: 'stretch',
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  submitWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
});
