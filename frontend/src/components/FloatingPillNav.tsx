import React from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';

// Map Expo Router tab route names to icons
const TAB_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  feed:     'layers',
  sessions: 'activity',
  profile:  'user',
};

export default function FloatingPillNav({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom + 12, 20) }]} pointerEvents="box-none">
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const isActive = state.index === index;
          const icon = TAB_ICONS[route.name] ?? 'circle';

          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
              hitSlop={8}
            >
              <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                <Feather
                  name={icon}
                  size={19}
                  color={isActive ? COLORS.textPrimary : COLORS.textTertiary}
                />
                {isActive && <View style={styles.activeDot} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(15, 18, 28, 0.88)',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    // @ts-ignore
    backdropFilter: 'blur(24px)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
    gap: 12,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 44,
    height: 38,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  activeDot: {
    position: 'absolute',
    bottom: 4,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.primaryLight,
  },
});
