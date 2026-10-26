import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { getMaterialUrl } from '../utils/materialLinks';
import { useStudy } from './StudyWorkspace';
import { createStudyStyles } from './studyStyles';
import { Button, Message } from './ui';

/** @param {{subjectId: number}} props */
export default function StudyMaterials({ subjectId }) {
  const { data, disabled, openMaterial, confirmDeleteMaterial, deletingMaterial } = useStudy();
  const { colors: p } = useTheme(), s = useThemedStyles(createStudyStyles);
  const [error, setError] = useState('');
  const materials = data.materials.filter(item => item.subject_id === subjectId);
  async function open(/** @type {import('../db/MaterialService').Material} */ material) {
    setError('');
    try { await Linking.openURL(getMaterialUrl(material.url_or_note || material.local_file_path || '')); }
    catch { setError('This location could not be opened. Check that it exists and is accessible on this device.'); }
  }
  return <View style={s.card}>
    <View style={s.section}><Text style={s.sectionTitle}>Study Materials</Text><Text style={s.sectionCount}>{materials.length}</Text></View>
    <Button label="Add Material" tone="outline" disabled={disabled} onPress={() => openMaterial(subjectId)} />
    <View style={{ gap: 24, marginTop: 24 }}>
      {materials.length === 0 && <Text style={s.hint}>No Study Materials Yet</Text>}
      {materials.map(item => <View key={item.id} style={{ gap: 12 }}>
        <Pressable accessibilityRole="link" accessibilityLabel={`Open ${item.title}`} onPress={() => void open(item)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 44 }}>
          <Ionicons name="document-text-outline" color={p.accent} size={22} /><View style={s.flex}><Text style={s.title}>{item.title}</Text><Text style={s.hint} numberOfLines={2}>{item.url_or_note || item.local_file_path}</Text></View><Ionicons name="open-outline" color={p.accent} size={18} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 12 }}><Button label="Edit" compact tone="quiet" disabled={disabled} onPress={() => openMaterial(subjectId, item)} /><Button label="Delete" compact tone="danger" disabled={disabled} busy={deletingMaterial === item.id} onPress={() => confirmDeleteMaterial(item)} /></View>
      </View>)}
    </View><Message text={error} />
  </View>;
}
