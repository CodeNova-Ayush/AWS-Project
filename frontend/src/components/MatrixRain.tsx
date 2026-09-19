import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Platform } from 'react-native';

const CHARS  = '01{}[]();=><+-*/abcdef!?#@$%^&_~';
const CELL_W = 16;
const CELL_H = 20;
const GAP    = 4;
const COL_W  = CELL_W + GAP;
const TRAIL  = 28;
const MONO   = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

function rchar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

interface Cell {
  key:    string;
  x:      number;
  y:      number;
  char:   string;
  alpha:  number;
  isHead: boolean;
}

export default function MatrixRain({ opacity = 0.35 }: { opacity?: number }) {
  const { width, height } = useWindowDimensions();

  const numCols = Math.floor(width / COL_W);
  const numRows = Math.ceil(height / CELL_H) + TRAIL + 2;

  const headsRef  = useRef<Float32Array>(new Float32Array(numCols));
  const speedsRef = useRef<Float32Array>(new Float32Array(numCols));
  const charsRef  = useRef<string[][]>([]);
  const frameRef  = useRef<number>(0);
  const countRef  = useRef<number>(0);

  const [cells, setCells] = useState<Cell[]>([]);

  useEffect(() => {
    const heads  = new Float32Array(numCols);
    const speeds = new Float32Array(numCols);
    const chars: string[][] = [];

    for (let c = 0; c < numCols; c++) {
      heads[c]  = -(Math.random() * numRows);
      speeds[c] = 0.06 + Math.random() * 0.10;
      chars[c]  = Array.from({ length: numRows }, rchar);
    }

    headsRef.current  = heads;
    speedsRef.current = speeds;
    charsRef.current  = chars;

    const animate = () => {
      const h  = headsRef.current;
      const s  = speedsRef.current;
      const ch = charsRef.current;

      for (let c = 0; c < numCols; c++) {
        h[c] += s[c];

        if (Math.random() < 0.04) {
          const r = Math.floor(h[c] - Math.random() * TRAIL);
          if (r >= 0 && r < numRows) ch[c][r] = rchar();
        }

        if (h[c] > numRows) {
          h[c] = -(4 + Math.random() * numRows * 0.6);
          s[c] = 0.06 + Math.random() * 0.10;
          for (let r = 0; r < numRows; r++) ch[c][r] = rchar();
        }
      }

      countRef.current++;

      if (countRef.current % 3 === 0) {
        const next: Cell[] = [];

        for (let c = 0; c < numCols; c++) {
          const head = h[c];
          if (head < 0) continue;

          const headRow  = Math.floor(head);
          const startRow = Math.max(0, headRow - TRAIL);

          for (let r = startRow; r <= headRow; r++) {
            if (r >= numRows) break;

            const dist  = headRow - r;
            const alpha = dist === 0
              ? 1.0
              : Math.pow(1 - dist / TRAIL, 2.2) * 0.85;

            if (alpha < 0.03) continue;

            next.push({
              key:    `${c}-${r}`,
              x:      c * COL_W,
              y:      r * CELL_H,
              char:   ch[c][r],
              alpha,
              isHead: dist === 0,
            });
          }
        }

        setCells(next);
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [numCols, numRows]);

  return (
    <View style={[StyleSheet.absoluteFillObject, { opacity }]} pointerEvents="none">
      {cells.map(cell => (
        <Text
          key={cell.key}
          style={{
            position:   'absolute',
            left:        cell.x,
            top:         cell.y,
            width:       CELL_W,
            height:      CELL_H,
            lineHeight:  CELL_H,
            fontSize:    11,
            fontFamily:  MONO,
            fontWeight:  cell.isHead ? '700' : '400',
            color:       cell.isHead
              ? `rgba(255, 255, 255, ${cell.alpha})`
              : `rgba(208, 253, 62, ${cell.alpha})`,
          }}
        >
          {cell.char}
        </Text>
      ))}
    </View>
  );
}
