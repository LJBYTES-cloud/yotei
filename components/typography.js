// Explicit face names keep the same weight on Android, iOS and web.
export const fonts = {
  body: 'Inter_400Regular', medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold',
  serif: 'Merriweather_400Regular', serifBold: 'Merriweather_700Bold',
};

// One scale for every screen. Metric is reserved for timer/workload numerals.
export const typeScale = { h1: 28, h2: 22, h3: 18, body: 14, small: 12, button: 14, metric: 36 };
export const typeLeading = { h1: 42, h2: 32, h3: 28, body: 22, small: 18, button: 22, metric: 44 };

export const cardShadow = {
  shadowColor: '#101C14', shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.07, shadowRadius: 14, elevation: 2,
};
