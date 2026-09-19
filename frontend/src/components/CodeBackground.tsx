import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

// We use a high performant standard View-based implementation
// since expo/react-native-skia has volatile API surfaces across versions.
export default function CodeBackground({ activeColorRGB = '120, 130, 140' }: { activeColorRGB?: string }) {
  const { width, height } = useWindowDimensions();

  const cellWidth = 14;
  const cellHeight = 20;
  const gap = 2;

  const cols = Math.ceil(width / (cellWidth + gap));
  const rows = Math.ceil(height / (cellHeight + gap));
  const totalCells = cols * rows;

  const [alphas, setAlphas] = useState<Float32Array>(new Float32Array(totalCells));

  // Store mutable refs so animation frame doesn't recreate closures
  const alphasRef = useRef(new Float32Array(totalCells));
  const decaysRef = useRef(new Float32Array(totalCells));
  const frameRef = useRef<number>(0);

  useEffect(() => {
    // Initialization phase
    const initialAlphas = new Float32Array(totalCells);
    const initialDecays = new Float32Array(totalCells);

    for (let i = 0; i < totalCells; i++) {
      // Keep more cells slightly visible at rest so the screen feels fuller.
      initialAlphas[i] = 0.012 + Math.random() * 0.04;
      initialDecays[i] = 0.005 + Math.random() * 0.015;
    }

    alphasRef.current = initialAlphas;
    decaysRef.current = initialDecays;
    setAlphas(initialAlphas);

    const animate = () => {
      const nextAlphas = new Float32Array(alphasRef.current);
      const nextDecays = decaysRef.current;

      let changed = false;

      for (let i = 0; i < totalCells; i++) {
        // Increase activation frequency so more cells light up over time.
        if (Math.random() < 0.0022) {
          nextAlphas[i] = 0.18 + Math.random() * 0.28;
          changed = true;
        }

        if (nextAlphas[i] > 0.018) {
          // Decay a bit slower so active cells remain visible longer.
          nextAlphas[i] -= nextDecays[i] * 0.75;
          changed = true;
        } else if (nextAlphas[i] > 0.008) {
          nextAlphas[i] = 0.008 + Math.random() * 0.012;
          changed = true;
        }
      }

      if (changed) {
        alphasRef.current = nextAlphas;
        // Batch React renders roughly every 3-4 frames to save pure JS rendering power
        // since we are not using Canvas
        if (Date.now() % 3 === 0) setAlphas(nextAlphas);
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [totalCells]);

  const rects = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const idx = i * rows + j;
      const posX = i * (cellWidth + gap);
      const posY = j * (cellHeight + gap);

      const alpha = alphas[idx] || 0.01;

      if (alpha > 0.01) {
        rects.push(
          <View
            key={idx}
            style={{
              position: 'absolute',
              left: posX,
              top: posY,
              width: cellWidth,
              height: cellHeight,
              backgroundColor: `rgba(${activeColorRGB}, ${alpha})`
            }}
          />
        );
      }
    }
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#050505' }]} />
      {rects}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(5, 5, 5, 0.4)' }]} />
    </View>
  );
}
