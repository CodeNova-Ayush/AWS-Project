import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Responsive scaling to guarantee all 7 buttons fit comfortably on any mobile screen
  const isCompact = windowHeight < 760;
  const buttonSize = isCompact ? 36 : 40;
  const iconSize = isCompact ? 16 : 18;
  const buttonGap = isCompact ? 5 : 7;
  const labelSize = isCompact ? 8.5 : 9.5;
  const sidebarBottom = Math.max(insets.bottom + 62, 74);

  return (
    <View
      style={[
        styles.container,
        {
          bottom: sidebarBottom,
          gap: buttonGap,
        },
      ]}
      testID="action-sidebar"
    >
      {/* Discuss / AI Chat */}
      <SidebarButton
        testID="action-chat"
        iconElement={<Ionicons name="chatbubble-ellipses-outline" size={iconSize} color="#18181B" />}
        label="Chat"
        size={buttonSize}
        labelSize={labelSize}
        onPress={onChat}
      />

      {/* Save */}
      <SidebarButton
        testID="action-save"
        iconElement={
          <Feather
            name="bookmark"
            size={iconSize}
            color={isSaved ? '#4F46E5' : '#18181B'}
          />
        }
        label={isSaved ? 'Saved' : 'Save'}
        isActive={isSaved}
        activeColor="#4F46E5"
        size={buttonSize}
        labelSize={labelSize}
        onPress={onSave}
      />

      {/* Approve PR */}
      {isPR && onApprovePR && (
        <SidebarButton
          testID="action-approve-pr"
          iconElement={<Feather name="check-circle" size={iconSize} color="#059669" />}
          label="Approve"
          badgeColor="rgba(5, 150, 105, 0.1)"
          borderColor="rgba(5, 150, 105, 0.25)"
          textColor="#059669"
          size={buttonSize}
          labelSize={labelSize}
          onPress={onApprovePR}
        />
      )}

      {/* Reject PR */}
      {isPR && onRejectPR && (
        <SidebarButton
          testID="action-reject-pr"
          iconElement={<Feather name="x-circle" size={iconSize} color="#E11D48" />}
          label="Reject"
          badgeColor="rgba(225, 29, 72, 0.1)"
          borderColor="rgba(225, 29, 72, 0.25)"
          textColor="#E11D48"
          size={buttonSize}
          labelSize={labelSize}
          onPress={onRejectPR}
        />
      )}

      {/* Merge PR */}
      {isPR && onMergePR && (
        <SidebarButton
          testID="action-merge-pr"
          iconElement={<Feather name="git-merge" size={iconSize} color="#4F46E5" />}
          label="Merge"
          badgeColor="rgba(79, 70, 229, 0.1)"
          borderColor="rgba(79, 70, 229, 0.25)"
          textColor="#4F46E5"
          size={buttonSize}
          labelSize={labelSize}
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
              size={iconSize}
              color={isApplied ? '#059669' : '#18181B'}
            />
          }
          label={isApplied ? 'Applied' : 'Apply'}
          isActive={isApplied}
          activeColor="#059669"
          size={buttonSize}
          labelSize={labelSize}
          onPress={onApply}
        />
      )}

      {/* Assign Agent / Agent Traces */}
      {isAgentPR && onViewAgentTrace ? (
        <SidebarButton
          testID="action-agent-trace"
          iconElement={<Feather name="cpu" size={iconSize} color="#4F46E5" />}
          label="Agent"
          size={buttonSize}
          labelSize={labelSize}
          onPress={onViewAgentTrace}
        />
      ) : onAssignAgent ? (
        <SidebarButton
          testID="action-assign-agent"
          iconElement={<Feather name="cpu" size={iconSize} color="#18181B" />}
          label="Agent"
          size={buttonSize}
          labelSize={labelSize}
          onPress={onAssignAgent}
        />
      ) : null}

      {/* Share */}
      <SidebarButton
        testID="action-share"
        iconElement={<Feather name="share-2" size={iconSize} color="#18181B" />}
        label="Share"
        size={buttonSize}
        labelSize={labelSize}
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
  size = 38,
  labelSize = 9,
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
  size?: number;
  labelSize?: number;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btnContainer,
        pressed && styles.btnPressed,
      ]}
      hitSlop={8}
    >
      <View
        style={[
          styles.iconCircle,
          { width: size, height: size, borderRadius: size / 2 },
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
          { fontSize: labelSize },
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
    right: 10,
    alignItems: 'center',
    zIndex: 25,
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
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    // @ts-ignore
    backdropFilter: 'blur(20px)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  iconCircleActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    borderColor: 'rgba(79, 70, 229, 0.3)',
  },
  label: {
    marginTop: 2,
    fontWeight: '600',
    color: '#52525B',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
