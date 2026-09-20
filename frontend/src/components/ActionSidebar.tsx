import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

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
        iconElement={<Ionicons name="chatbubble-ellipses-outline" size={19} color="#18181B" />}
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
            color={isSaved ? '#4F46E5' : '#18181B'}
          />
        }
        label={isSaved ? 'Saved' : 'Save'}
        isActive={isSaved}
        activeColor="#4F46E5"
        onPress={onSave}
      />

      {/* Approve PR */}
      {isPR && onApprovePR && (
        <SidebarButton
          testID="action-approve-pr"
          iconElement={<Feather name="check-circle" size={18} color="#059669" />}
          label="Approve"
          badgeColor="rgba(5, 150, 105, 0.1)"
          borderColor="rgba(5, 150, 105, 0.25)"
          textColor="#059669"
          onPress={onApprovePR}
        />
      )}

      {/* Reject PR */}
      {isPR && onRejectPR && (
        <SidebarButton
          testID="action-reject-pr"
          iconElement={<Feather name="x-circle" size={18} color="#E11D48" />}
          label="Reject"
          badgeColor="rgba(225, 29, 72, 0.1)"
          borderColor="rgba(225, 29, 72, 0.25)"
          textColor="#E11D48"
          onPress={onRejectPR}
        />
      )}

      {/* Merge PR */}
      {isPR && onMergePR && (
        <SidebarButton
          testID="action-merge-pr"
          iconElement={<Feather name="git-merge" size={18} color="#4F46E5" />}
          label="Merge"
          badgeColor="rgba(79, 70, 229, 0.1)"
          borderColor="rgba(79, 70, 229, 0.25)"
          textColor="#4F46E5"
          onPress={onMergePR}
        />
      )}

      {/* Apply / Quick Action */}
      {!isPR && (
        <SidebarButton
          testID="action-apply"
          iconElement={
            <Feather
              name="play"
              size={18}
              color={isApplied ? '#059669' : '#18181B'}
            />
          }
          label={isApplied ? 'Applied' : 'Apply'}
          isActive={isApplied}
          activeColor="#059669"
          onPress={onApply}
        />
      )}

      {/* Assign Agent / Agent Traces */}
      {isAgentPR && onViewAgentTrace ? (
        <SidebarButton
          testID="action-agent-trace"
          iconElement={<Feather name="cpu" size={18} color="#4F46E5" />}
          label="Agent"
          onPress={onViewAgentTrace}
        />
      ) : onAssignAgent ? (
        <SidebarButton
          testID="action-assign-agent"
          iconElement={<Feather name="cpu" size={18} color="#18181B" />}
          label="Agent"
          onPress={onAssignAgent}
        />
      ) : null}

      {/* Share */}
      <SidebarButton
        testID="action-share"
        iconElement={<Feather name="share-2" size={18} color="#18181B" />}
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
  isActive = false,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    // @ts-ignore
    backdropFilter: 'blur(20px)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  iconCircleActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    borderColor: 'rgba(79, 70, 229, 0.3)',
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
    color: '#52525B',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
