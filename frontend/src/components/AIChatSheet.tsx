import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { ChatMessage, CodeIssue } from '../constants/types';
import { fetchChatHistory, sendChatMessage, getUserKeyStatus } from '../services/api';
import MarkdownMessage from './MarkdownMessage';

const QUICK_ACTIONS = [
  {
    icon: 'search',
    label: 'Bugs & Risks',
    title: 'Find Bugs & Risks',
    desc: 'Scan diff for logic bugs, null errors, and security issues',
    query: 'Analyze all changed files in this PR for bugs, edge cases, exceptions, and security risks as per info.md. Give a risk rating and specific code fixes.',
  },
  {
    icon: 'alert-triangle',
    label: 'Merge Conflicts',
    title: 'Check Merge Conflicts',
    desc: 'Verify if branch can merge cleanly into base and conflict status',
    query: 'Are there any merge conflicts with the base branch? Detail mergeability, conflict causes, and exact git resolution steps.',
  },
  {
    icon: 'check-circle',
    label: 'CI / Tests',
    title: 'Analyze CI & Checks',
    desc: 'Check GitHub Actions build & test runs status',
    query: 'Review the CI/CD checks and test runs for this PR. Are there any broken checks or missing test coverage?',
  },
  {
    icon: 'file-text',
    label: 'Explain PR',
    title: 'Explain Changes',
    desc: 'Understand what changed, previous vs new behavior, and impact',
    query: 'Explain what changed in this PR, comparing previous behavior vs new behavior and potential impact as per info.md.',
  },
];

interface Props {
  issueId: string;
  issue: CodeIssue;
  visible: boolean;
  onClose: () => void;
}

export default function AIChatSheet({ issueId, issue, visible, onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [activeProvider, setActiveProvider] = useState<string>('groq');
  const [activeModel, setActiveModel] = useState<string>('llama-3.3-70b-versatile');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible) {
      loadHistory();
      loadActiveProvider();
    }
  }, [visible, issueId]);

  async function loadActiveProvider() {
    try {
      const status = await getUserKeyStatus();
      if (status) {
        if (status.active_provider) setActiveProvider(status.active_provider);
        if (status.active_model) setActiveModel(status.active_model);

        const configuredProviders = status.providers
          ? Object.keys(status.providers).filter(k => status.providers[k])
          : [];
        const hasKey =
          configuredProviders.length > 0 ||
          Boolean(status.has_openai_key) ||
          Boolean(status.has_anthropic_key);
        setHasApiKey(hasKey);
      } else {
        setHasApiKey(false);
      }
    } catch {
      setHasApiKey(false);
    }
  }

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const history = await fetchChatHistory(issueId);
      setMessages(history);
    } catch {
      // No history yet
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleSend(customText?: string) {
    if (hasApiKey === false) {
      onClose();
      router.push('/profile');
      return;
    }

    const textToSend = (typeof customText === 'string' ? customText : input).trim();
    if (!textToSend || loading) return;
    setInput('');
    Keyboard.dismiss();

    const userMessage: ChatMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    const issueContext = {
      ...issue,
      issue_id: issue.issue_id,
      project: issue.project,
      branch: issue.branch,
      type: issue.type,
      title: issue.title,
      description: issue.description,
      language: issue.language,
      diff_lines: issue.diff_lines,
      trajectory_steps: issue.trajectory_steps,
      agent_summary: issue.agent_summary,
    };

    try {
      const response = await sendChatMessage(
        issueId,
        textToSend,
        issueContext,
        activeProvider,
        activeModel
      );
      setMessages(prev => [...prev, response]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Something went wrong. Please ensure your API key for ' +
            (activeProvider ? activeProvider.toUpperCase() : 'your selected provider') +
            ' is configured in Profile > BYOK.',
          timestamp: new Date().toISOString(),
          provider: activeProvider,
          model: activeModel,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Tap-outside-to-close backdrop */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheet}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.iconRing}>
                <Ionicons name="chatbubbles" size={16} color={COLORS.primaryLight} />
              </View>
              <View style={styles.headerLabels}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {issue.title}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {issue.project} · {activeProvider.toUpperCase()} ({activeModel})
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} testID="close-chat">
              <Feather name="x" size={18} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          {/* Missing API Key Warning Banner with 1-Tap Redirect */}
          {hasApiKey === false && (
            <View style={styles.missingKeyBanner}>
              <View style={styles.missingKeyLeft}>
                <View style={styles.missingKeyIconRing}>
                  <Feather name="key" size={16} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.missingKeyTitle}>No AI Provider Key Configured</Text>
                  <Text style={styles.missingKeyDesc}>
                    To chat with this PR, ask questions, or run automated reviews, please add your
                    API key (Anthropic, OpenAI, Groq, or Mistral) in Profile.
                  </Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [styles.addKeyBtn, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  onClose();
                  router.push('/profile');
                }}
                testID="redirect-to-add-api-key"
              >
                <Feather name="plus-circle" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.addKeyBtnText}>Add API Key in Profile →</Text>
              </Pressable>
            </View>
          )}

          {/* Messages */}
          {loadingHistory ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={COLORS.primaryLight} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(_, i) => String(i)}
              style={styles.messageList}
              contentContainerStyle={
                messages.length === 0 ? styles.emptyList : { paddingVertical: SPACING.md }
              }
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyHeader}>
                    <View style={styles.emptyIconRing}>
                      <Ionicons name="sparkles" size={20} color={COLORS.primaryLight} />
                    </View>
                    <Text style={styles.emptyTitle}>PR Intelligence & Review</Text>
                    <Text style={styles.emptySubtitle}>
                      Ask anything or tap a one-click review action:
                    </Text>
                  </View>
                  <View style={styles.promptCardsGrid}>
                    {QUICK_ACTIONS.map(action => (
                      <Pressable
                        key={action.label}
                        style={styles.promptCard}
                        onPress={() => handleSend(action.query)}
                        disabled={loading}
                      >
                        <View style={styles.promptCardHeader}>
                          <Feather name={action.icon as any} size={13} color={COLORS.primaryLight} />
                          <Text style={styles.promptCardTitle}>{action.title}</Text>
                        </View>
                        <Text style={styles.promptCardDesc}>{action.desc}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.contextChip}>
                    <Feather name="zap" size={11} color={COLORS.primaryLight} />
                    <Text style={styles.contextChipText}>
                      Context loaded · {activeProvider.toUpperCase()}
                    </Text>
                  </View>
                </View>
              }
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.messageBubble,
                    item.role === 'user' ? styles.userBubble : styles.aiBubble,
                  ]}
                  testID={`chat-message-${item.role}`}
                >
                  {item.role === 'assistant' && (
                    <View style={styles.aiLabel}>
                      <Ionicons name="chatbubbles" size={10} color={COLORS.primaryLight} />
                      <Text style={styles.aiLabelText}>
                        {(item.provider || activeProvider).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {item.role === 'assistant' ? (
                    <MarkdownMessage content={item.content} />
                  ) : (
                    <Text style={[styles.messageText, styles.userText]}>{item.content}</Text>
                  )}
                </View>
              )}
            />
          )}

          {/* Typing indicator */}
          {loading && (
            <View style={styles.typingIndicator}>
              <ActivityIndicator size="small" color={COLORS.primaryLight} />
              <Text style={styles.typingText}>
                {activeProvider.toUpperCase()} analyzing diff & generating review…
              </Text>
            </View>
          )}

          {/* Quick-action chips scroll */}
          <View style={styles.quickChipsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickChipsScroll}
            >
              {QUICK_ACTIONS.map(action => (
                <Pressable
                  key={action.label}
                  style={styles.quickChip}
                  onPress={() => handleSend(action.query)}
                  disabled={loading}
                >
                  <Feather name={action.icon as any} size={12} color={COLORS.primaryLight} />
                  <Text style={styles.quickChipText}>{action.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Input row */}
          <View style={[styles.inputRow, { paddingBottom: insets.bottom + SPACING.md }]}>
            <TextInput
              style={[styles.input, hasApiKey === false && styles.inputDisabled]}
              placeholder={
                hasApiKey === false
                  ? 'Configure API key in Profile to enable chat...'
                  : 'Ask about this code, bugs, conflicts…'
              }
              placeholderTextColor={COLORS.textTertiary}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
              editable={hasApiKey !== false && !loading}
              testID="chat-input"
            />
            <Pressable
              onPress={() =>
                hasApiKey === false ? (onClose(), router.push('/profile')) : handleSend()
              }
              style={[
                styles.sendBtn,
                hasApiKey === false
                  ? styles.sendBtnRedirect
                  : (!input.trim() || loading) && styles.sendBtnDisabled,
              ]}
              testID="chat-send-btn"
            >
              <Feather
                name={hasApiKey === false ? 'key' : 'send'}
                size={16}
                color={
                  hasApiKey === false
                    ? '#FFFFFF'
                    : input.trim()
                    ? COLORS.primaryFg
                    : COLORS.textTertiary
                }
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: '#0F121A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    minHeight: 380,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...SHADOWS.lg,
  },
  handle: {
    width: 38,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  // ── Header ──
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    gap: SPACING.sm,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(99, 102, 241, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLabels: {
    flex: 1,
    gap: 2,
  },
  sheetTitle: {
    color: '#F8FAFC',
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    color: '#94A3B8',
    fontSize: FONT_SIZES.xs,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },

  // ── Missing Key Banner ──
  missingKeyBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    gap: 10,
  },
  missingKeyLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  missingKeyIconRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  missingKeyTitle: {
    color: '#F59E0B',
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  missingKeyDesc: {
    color: '#94A3B8',
    fontSize: FONT_SIZES.xs,
    lineHeight: 16,
  },
  addKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addKeyBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },

  // ── Loading / Empty ──
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxxl,
  },
  messageList: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(99, 102, 241, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  contextChipText: {
    color: '#818CF8',
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },

  // ── Bubbles ──
  messageBubble: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    maxWidth: '92%',
  },
  userBubble: {
    backgroundColor: '#4F46E5',
    alignSelf: 'flex-end',
    borderBottomRightRadius: BORDER_RADIUS.sm,
    maxWidth: '85%',
    ...SHADOWS.sm,
  },
  aiBubble: {
    backgroundColor: '#171B26',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    width: '100%',
    maxWidth: '94%',
    ...SHADOWS.sm,
  },
  aiLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  aiLabelText: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '700',
  },
  messageText: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  userText: { color: '#FFFFFF' },

  // ── Typing + Input ──
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  typingText: {
    color: '#94A3B8',
    fontSize: FONT_SIZES.xs,
  },
  quickChipsContainer: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#0F121A',
  },
  quickChipsScroll: {
    paddingHorizontal: SPACING.lg,
    gap: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#171B26',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickChipText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyHeader: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyIconRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: FONT_SIZES.xs,
    textAlign: 'center',
  },
  promptCardsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: SPACING.sm,
  },
  promptCard: {
    width: '48%',
    backgroundColor: '#171B26',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 12,
  },
  promptCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  promptCardTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  promptCardDesc: {
    color: '#94A3B8',
    fontSize: 10,
    lineHeight: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: 8,
    paddingBottom: 4,
    gap: SPACING.sm,
    backgroundColor: '#0F121A',
  },
  input: {
    flex: 1,
    backgroundColor: '#05070A',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    color: '#F8FAFC',
    fontSize: FONT_SIZES.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputDisabled: {
    opacity: 0.5,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  sendBtnRedirect: {
    backgroundColor: '#F59E0B',
  },
});
