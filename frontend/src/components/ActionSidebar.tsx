import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';

interface Props {
  isSaved: boolean;
  isApplied: boolean;
  onChat: () => void;
  onSave: () => void;
  onApply: () => void;
  onShare: () => void;
  onAssignAgent?: () => void;
  onViewAgentTrace?: () => void;
  isAgentPR?: boolean;
  isPR?: boolean;
  onApprovePR?: () => void;
  onRejectPR?: () => void;
  onMergePR?: () => void;
}

export default function ActionSidebar({
  isSaved,
  isApplied,
  onChat,
  onSave,
  onApply,
  onShare,
  onAssignAgent,
  onViewAgentTrace,
  isAgentPR,
  isPR,
  onApprovePR,
  onRejectPR,
  onMergePR
}: Props) {
  return (
    <View style={styles.container} testID="action-sidebar">
      <ChatButton onPress={onChat} />
      <ActionButton
        testID="action-save"
        icon="bookmark"
        label={isSaved ? 'Saved' : 'Save'}
        color={isSaved ? COLORS.primary : COLORS.textPrimary}
        filled={isSaved}
        onPress={onSave}
      />
      {!isPR && (
        <ActionButton
          testID="action-apply"
          icon="play"
          label={isApplied ? 'Applied' : 'Apply'}
          color={isApplied ? COLORS.success : COLORS.primary}
          onPress={onApply}
        />
      )}
      {!isPR && onAssignAgent && (
        <ActionButton
          testID="action-assign"
          icon="cpu"
          label="Assign"
          color={COLORS.primary}
          onPress={onAssignAgent}
        />
      )}
      {isPR && isAgentPR && onViewAgentTrace && (
        <ActionButton
          testID="action-view-trace"
          icon="activity"
          label="Trace"
          color={COLORS.secondary}
          onPress={onViewAgentTrace}
        />
      )}
      {isPR && onApprovePR && (
        <ActionButton
          testID="action-approve-pr"
          icon="check"
          label="Approve"
          color={COLORS.success}
          onPress={onApprovePR}
        />
      )}
      {isPR && onRejectPR && (
        <ActionButton
          testID="action-reject-pr"
          icon="x"
          label="Reject"
          color={COLORS.error}
          onPress={onRejectPR}
        />
      )}
      {isPR && onMergePR && (
        <ActionButton
          testID="action-merge-pr"
          icon="git-merge"
          label="Merge"
          color={COLORS.primary}
          onPress={onMergePR}
        />
      )}
      <ActionButton
        testID="action-share"
        icon="send"
        label="Share"
        color={COLORS.textPrimary}
        onPress={onShare}
      />
    </View>
  );
}

/** Dedicated chat button with the dual-bubble discussion icon */
function ChatButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      testID="action-chat"
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      hitSlop={8}
    >
      <Ionicons
        name="chatbubbles"
        size={30}
        color={COLORS.textPrimary}
        style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}
      />
      <Text style={[styles.label, { color: COLORS.textPrimary, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }]}>
        Discuss
      </Text>
    </Pressable>
  );
}

function ActionButton({
  testID, icon, label, color, bgColor, filled, onPress,
}: {
  testID: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  bgColor?: string;
  filled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, bgColor ? { backgroundColor: bgColor } : null]}
      hitSlop={8}
    >
      <Feather name={icon} size={28} color={color} style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }} />
      <Text style={[styles.label, { color, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    alignItems: 'center',
    gap: SPACING.lg,
    zIndex: 10,
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
  label: {
    fontSize: FONT_SIZES.xs - 2,
    marginTop: 2,
    fontWeight: '600',
    textAlign: 'center',
  },
});
