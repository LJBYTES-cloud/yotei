import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { cardShadow, fonts, typeScale, typeLeading } from './typography';

/** @param {{message: string, noticeId: number, hidden?: boolean, onDismiss: () => void}} props */
export default function Toast({ message, noticeId, hidden = false, onDismiss }) {
  const { colors: p } = useTheme();
  const s = useThemedStyles(createStyles);
  const [progress] = useState(() => new Animated.Value(0));
  const dismiss = useRef(onDismiss);
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => dismiss.current(), 3000);
    return () => clearTimeout(timeout);
  }, [message, noticeId]);
  useEffect(() => {
    if (!message || hidden) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [message, noticeId, hidden, progress]);
  if (!message || hidden) return null;
  return <View pointerEvents="none" style={s.anchor}>
    <Animated.View style={[s.toast, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <Ionicons name="checkmark-circle-outline" size={22} color={p.accent} />
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.message}>{message}</Text>
    </Animated.View>
  </View>;
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  anchor: { position: 'absolute', bottom: '100%', left: 20, right: 20, paddingBottom: 8, alignItems: 'center', zIndex: 10 },
  toast: { ...cardShadow, width: '100%', maxWidth: 600, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    borderWidth: 1, borderColor: p.line, borderRadius: 16, backgroundColor: p.surface },
  message: { flex: 1, fontFamily: fonts.body, fontSize: typeScale.body, lineHeight: typeLeading.body, color: p.text },
});
