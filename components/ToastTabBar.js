import { useEffect, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { BottomTabBar } from 'expo-router/js-tabs';
import { useStudy } from './StudyWorkspace';
import Toast from './Toast';

/** @param {import('expo-router/js-tabs').BottomTabBarProps} props */
export default function ToastTabBar(props) {
  const { notice, noticeId, dismissNotice, blocked } = useStudy();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const settings = props.state.routes[props.state.index]?.name === 'settings';
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    // Discard rather than defer messages from Settings, including backup notices.
    if (settings && notice) dismissNotice();
  }, [settings, notice, noticeId, dismissNotice]);
  return <View>
    <BottomTabBar {...props} />
    <Toast message={notice} noticeId={noticeId} hidden={settings || keyboardOpen || blocked} onDismiss={dismissNotice} />
  </View>;
}
