import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { DriverAvatar } from '../components/DriverAvatar';
import {
  driverProfile,
  initialChatMessages,
  type ChatMessage,
} from '../features/order/orderData';
import { useColors } from '@/hooks/useColors';

function ChatBubble({ message }: { message: ChatMessage }) {
  const colors = useColors();
  const isUser = message.sender === 'user';

  return (
    <View
      style={[
        styles.messageRow,
        { justifyContent: isUser ? 'flex-end' : 'flex-start' },
      ]}
    >
      <View
        className={isUser ? 'bg-forest' : 'bg-card'}
        style={[
          styles.messageBubble,
          {
            backgroundColor: isUser ? colors.accentForeground : colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.messageText,
            { color: isUser ? colors.primaryForeground : colors.foreground },
          ]}
        >
          {message.text}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [draft, setDraft] = useState('');

  const handleCall = () => {
    Alert.alert(
      'Call driver',
      'Phone calls are not connected in this preview.',
    );
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;

    setMessages((current) => [
      ...current,
      { id: `message-${Date.now()}`, sender: 'user', text },
    ]);
    setDraft('');
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={[styles.headerIcon, { backgroundColor: colors.card }]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </Pressable>
          <DriverAvatar size={41} />
          <View style={styles.headerDriver}>
            <Text className="text-ink" style={styles.driverName}>
              {driverProfile.name}
            </Text>
            <View style={styles.activeRow}>
              <View
                style={[styles.activeDot, { backgroundColor: colors.primary }]}
              />
              <Text
                style={[styles.activeText, { color: colors.mutedForeground }]}
              >
                {driverProfile.status}
              </Text>
            </View>
          </View>
          <Pressable
            testID="chat-call-driver"
            accessibilityRole="button"
            accessibilityLabel="Call driver"
            onPress={handleCall}
            style={[styles.headerIcon, { backgroundColor: colors.accent }]}
          >
            <Ionicons
              name="call-outline"
              size={19}
              color={colors.accentForeground}
            />
          </Pressable>
          <Pressable
            testID="mark-delivered"
            accessibilityRole="button"
            onPress={() => router.push('/rating')}
            className="bg-forest"
            style={styles.deliveredButton}
          >
            <Text
              style={[
                styles.deliveredText,
                { color: colors.primaryForeground },
              ]}
            >
              Delivered
            </Text>
          </Pressable>
        </View>

        <FlatList<ChatMessage>
          testID="driver-chat-messages"
          data={messages}
          keyExtractor={(message) => message.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />

        <View
          style={[
            styles.composerWrap,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View
            style={[
              styles.composer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TextInput
              testID="chat-input"
              accessibilityLabel="Write a message"
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={handleSend}
              placeholder="Message John..."
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="send"
              style={[styles.input, { color: colors.foreground }]}
            />
            <Pressable
              testID="send-message"
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !draft.trim() }}
              disabled={!draft.trim()}
              onPress={handleSend}
              className={draft.trim() ? 'bg-coral' : 'bg-sage'}
              style={styles.sendButton}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={
                  draft.trim()
                    ? colors.primaryForeground
                    : colors.accentForeground
                }
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  header: {
    minHeight: 66,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDriver: {
    flex: 1,
    minWidth: 72,
  },
  driverName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    marginBottom: 3,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
  },
  deliveredButton: {
    minHeight: 34,
    borderRadius: 11,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveredText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 17,
    paddingTop: 20,
    paddingBottom: 18,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  messageText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  composerWrap: {
    paddingHorizontal: 15,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composer: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 42,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
