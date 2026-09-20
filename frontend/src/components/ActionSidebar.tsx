import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

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
  onMergePR,
}: Props) {
  return (
    <View style={styles.container} testID="action-sidebar">
      {/* Discuss / AI Chat */}
      <SidebarButton
        testID="action-chat"
        iconElement={<Ionicons name="chatbubble-ellipses-outline" size={19} color={COLORS.textPrimary} />}
        label="Chat"
        onPress={onChat}
      />

      {/* Save */}
      <SidebarButton
        testID="action-save"
        iconElement={
          <Feather
            name="bookmark"
            size={18}
            color={isSaved ? COLORS.primaryLight : COLORS.textSecondary}
          />
        }
        label={isSaved ? 'Saved' : 'Save'}
        isActive={isSaved}
        activeColor={COLORS.primaryLight}
        onPress={onSave}
      />

      {/* Approve PR */}
      {isPR && onApprovePR && (
        <SidebarButton
          testID="action-approve-pr"
          iconElement={<Feather name="check-circle" size={18} color={COLORS.success} />}
          label="Approve"
          badgeColor="rgba(16, 185, 129, 0.15)"
          borderColor="rgba(16, 185, 129, 0.3)"
          textColor={COLORS.success}
          onPress={onApprovePR}
        />
      )}

      {/* Reject PR */}
      {isPR && onRejectPR && (
        <SidebarButton
          testID="action-reject-pr"
          iconElement={<Feather name="x-circle" size={18} color={COLORS.error} />}
          label="Reject"
          badgeColor="rgba(244, 63, 94, 0.15)"
          borderColor="rgba(244, 63, 94, 0.3)"
          textColor={COLORS.error}
          onPress={onRejectPR}
        />
      )}

      {/* Merge PR */}
      {isPR && onMergePR && (
        <SidebarButton
          testID="action-merge-pr"
          iconElement={<Feather name="git-merge" size={18} color={COLORS.primaryLight} />}
          label="Merge"
          badgeColor="rgba(99, 102, 241, 0.18)"
          borderColor="rgba(99, 102, 241, 0.35)"
          textColor={COLORS.primaryLight}
          onPress={onMergePR}
        />
      )}

      {/* Apply (non-PR) */}
      {!isPR && (
        <SidebarButton
          testID="action-apply"
          iconElement={<Feather name="play" size={18} color={isApplied ? COLORS.success : COLORS.primaryLight} />}
          label={isApplied ? 'Applied' : 'Apply'}
          onPress={onApply}
        />
      )}

      {/* Assign Agent */}
      {!isPR && onAssignAgent && (
        <SidebarButton
          testID="action-assign"
          iconElement={<Feather name="cpu" size={18} color={COLORS.textSecondary} />}
          label="Agent"
          onPress={onAssignAgent}
        />
      )}

      {/* View Trace */}
      {isPR && isAgentPR && onViewAgentTrace && (
        <SidebarButton
          testID="action-view-trace"
          iconElement={<Feather name="activity" size={18} color={COLORS.secondary} />}
          label="Trace"
          onPress={onViewAgentTrace}
        />
      )}

      {/* Share */}
      <SidebarButton
        testID="action-share"
        iconElement={<Feather name="share-2" size={17} color={COLORS.textSecondary} />}
        label="Share"
        onPress={onShare}
      />
    </View>
  );
}

function SidebarButton({
  testID,
  iconElement,
  label,
  onPress,
  isActive,
  activeColor,
  badgeColor,
  borderColor,
  textColor,
}: {
  testID: string;
  iconElement: React.ReactNode;
  label: string;
  onPress: () => void;
  isActive?: boolean;
  activeColor?: string;
  badgeColor?: string;
  borderColor?: string;
  textColor?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btnContainer,
        pressed && styles.btnPressed,
      ]}
      hitSlop={6}
    >
      <View
        style={[
          styles.iconCircle,
          badgeColor ? { backgroundColor: badgeColor } : null,
          borderColor ? { borderColor } : null,
          isActive ? styles.iconCircleActive : null,
        ]}
      >
        {iconElement}
      </View>
      <Text
        style={[
          styles.label,
          textColor ? { color: textColor } : null,
          isActive && activeColor ? { color: activeColor } : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    bottom: 96,
    alignItems: 'center',
    gap: 12,
    zIndex: 15,
  },
  btnContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.92 }],
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(17, 20, 30, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    // @ts-ignore
    backdropFilter: 'blur(16px)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  iconCircleActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  label: {
    fontSize: 10,
    marginTop: 3,
    fontWeight: '500',
    color: COLORS.textSecondary,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
