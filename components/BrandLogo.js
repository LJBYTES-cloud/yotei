import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../ThemeContext';

function BrandLogo() {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.logo} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={styles.left} /><View style={styles.right} />
  </View>;
}

export default memo(BrandLogo);

/** @param {import('../ThemeContext').ThemeColors} colors */
const createStyles = colors => StyleSheet.create({
  logo: { width: 36, height: 36, flexShrink: 0, borderRadius: 12, backgroundColor: colors.accent, overflow: 'hidden' },
  left: { position: 'absolute', width: 5, height: 22, borderRadius: 3, backgroundColor: colors.background, left: 12, top: 7, transform: [{ rotate: '28deg' }] },
  right: { position: 'absolute', width: 5, height: 14, borderRadius: 3, backgroundColor: colors.background, left: 21, top: 14, transform: [{ rotate: '-28deg' }] },
});
