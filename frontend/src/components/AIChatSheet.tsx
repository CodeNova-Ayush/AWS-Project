import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard,
  Modal, ScrollView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
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
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
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
      }
    } catch {
      // Keep defaults
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
      const response = await sendChatMessage(issueId, textToSend, issueContext, activeProvider, activeModel);
      setMessages(prev => [...prev, response]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please ensure your API key for ' + (activeProvider ? activeProvider.toUpperCase() : 'your selected provider') + ' is saved in Settings > Profile.',
        timestamp: new Date().toISOString(),
        provider: activeProvider,
        model: activeModel,
      }]);
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
                <Ionicons name="chatbubbles" size={16} color={COLORS.primary} />
              </View>
              <View style={styles.headerLabels}>
                <Text style={styles.sheetTitle} numberOfLines={1}>{issue.title}</Text>
                <Text style={styles.sheetSubtitle}>{issue.project} · {activeProvider.toUpperCase()} ({activeModel})</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} testID="close-chat">
              <Feather name="x" size={18} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          {/* Messages */}
          {loadingHistory ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(_, i) => String(i)}
              style={styles.messageList}
              contentContainerStyle={messages.length === 0 ? styles.emptyList : { paddingVertical: SPACING.md }}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyHeader}>
                    <View style={styles.emptyIconRing}>
                      <Ionicons name="sparkles" size={20} color={COLORS.primary} />
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
                          <Feather name={action.icon as any} size={13} color={COLORS.primary} />
                          <Text style={styles.promptCardTitle}>{action.title}</Text>
                        </View>
                        <Text style={styles.promptCardDesc}>{action.desc}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.contextChip}>
                    <Feather name="zap" size={11} color={COLORS.primary} />
                    <Text style={styles.contextChipText}>Context loaded · {activeProvider.toUpperCase()}</Text>
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
                      <Ionicons name="chatbubbles" size={10} color={COLORS.primary} />
                      <Text style={styles.aiLabelText}>
                        {item.provider ? `${item.provider.toUpperCase()}${item.model ? ` · ${item.model}` : ''}` : `${activeProvider.toUpperCase()} · ${activeModel}`}
                      </Text>
                    </View>
                  )}
                  <MarkdownMessage content={item.content} isUser={item.role === 'user'} />
                </View>
              )}
            />
          )}

          {/* Typing indicator */}
          {loading && (
            <View style={styles.typingIndicator}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.typingText}>{activeProvider.toUpperCase()} is analyzing PR…</Text>
            </View>
          )}

          {/* Quick prompt chips bar */}
          <View style={styles.quickChipsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickChipsScroll}>
              {QUICK_ACTIONS.map(action => (
                <Pressable
                  key={action.label}
                  style={styles.quickChip}
                  onPress={() => handleSend(action.query)}
                  disabled={loading}
                >
                  <Feather name={action.icon as any} size={11} color={COLORS.primary} />
                  <Text style={styles.quickChipText}>{action.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Input row — sits above the safe area */}
          <View style={[styles.inputRow, { paddingBottom: insets.bottom + SPACING.md }]}>
            <TextInput
              style={styles.input}
              placeholder="Ask about this code, bugs, conflicts…"
              placeholderTextColor={COLORS.textTertiary}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
              editable={!loading}
              testID="chat-input"
            />
            <Pressable
              onPress={() => handleSend()}
              style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
              disabled={!input.trim() || loading}
              testID="chat-send-btn"
            >
              <Feather name="send" size={16} color={input.trim() ? COLORS.primaryFg : COLORS.textTertiary} />
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
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    minHeight: 340,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border,
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
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${COLORS.primary}18`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}35`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLabels: {
    flex: 1,
    gap: 2,
  },
  sheetTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  sheetSubtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
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
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: `${COLORS.primary}12`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
  },
  contextChipText: {
    color: COLORS.primary,
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
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: BORDER_RADIUS.sm,
    maxWidth: '85%',
  },
  aiBubble: {
    backgroundColor: COLORS.surfaceHighlight,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: `${COLORS.primary}25`,
    width: '100%',
    maxWidth: '94%',
  },
  aiLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  aiLabelText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  messageText: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  userText: { color: COLORS.primaryFg },
  aiText: { color: COLORS.textPrimary },

  // ── Typing + Input ──
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  typingText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
  },
  quickChipsContainer: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  quickChipsScroll: {
    paddingHorizontal: SPACING.lg,
    gap: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${COLORS.primary}12`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickChipText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyHeader: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyIconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${COLORS.primary}18`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}35`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: 10,
  },
  promptCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  promptCardTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  promptCardDesc: {
    color: COLORS.textTertiary,
    fontSize: 10,
    lineHeight: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: 6,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.surfaceHighlight,
  },
});
