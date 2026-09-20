import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

interface Props {
  activeColorRGB?: string;
}

export default function CodeBackground({ activeColorRGB = '99, 102, 241' }: Props) {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Base Canvas */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#090A0F' }]} />

      {/* Subtle Ambient Radial Glow (Top / Center) */}
      <View
        style={{
          position: 'absolute',
          top: -height * 0.15,
          left: width * 0.1,
          width: width * 0.8,
          height: height * 0.45,
          borderRadius: width * 0.4,
          backgroundColor: `rgba(${activeColorRGB}, 0.06)`,
          transform: [{ scaleX: 1.4 }],
          // @ts-ignore - web filter support
          filter: 'blur(80px)',
        }}
      />

      {/* Subtle Secondary Ambient Glow (Bottom Right) */}
      <View
        style={{
          position: 'absolute',
          bottom: height * 0.05,
          right: -width * 0.2,
          width: width * 0.6,
          height: width * 0.6,
          borderRadius: width * 0.3,
          backgroundColor: 'rgba(56, 189, 248, 0.03)',
          // @ts-ignore - web filter support
          filter: 'blur(70px)',
        }}
      />

      {/* Subtle Vignette overlay */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: 'transparent',
            // @ts-ignore - web backdrop
            backgroundImage: 'radial-gradient(circle at 50% 30%, transparent 40%, rgba(9, 10, 15, 0.65) 100%)',
          },
        ]}
      />
    </View>
  );
}
