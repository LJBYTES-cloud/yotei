import { memo, useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { getMaterialUrl } from '../utils/materialLinks';
import { useStudyList } from './StudyWorkspace';
import { createStudyStyles } from './studyStyles';
import { Button, Message } from './ui';
import ItemActionsMenu from './ItemActionsMenu';

/** @param {{subjectId: number}} props */
function StudyMaterials({ subjectId }) {
  const { data, disabled, openMaterial, confirmDeleteMaterial, deletingMaterial } = useStudyList();
  const { colors: p } = useTheme(), s = useThemedStyles(createStudyStyles);
  const [error, setError] = useState('');
  const materials = useMemo(() => data.materials.filter(item => item.subject_id === subjectId), [data.materials, subjectId]);
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
      {materials.map(item => <View key={item.id} style={{ gap: 12, flexDirection: 'row', alignItems: 'flex-start' }}>
        <Pressable accessibilityRole="link" accessibilityLabel={`Open ${item.title}`} onPress={() => void open(item)} style={{ flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 44 }}>
          <Ionicons name="document-text-outline" color={p.accent} size={22} /><View style={s.flex}><Text style={s.title}>{item.title}</Text><Text style={s.hint} numberOfLines={2}>{item.url_or_note || item.local_file_path}</Text></View><Ionicons name="open-outline" color={p.accent} size={18} />
        </Pressable>
        <ItemActionsMenu label={item.title} disabled={disabled} busy={deletingMaterial === item.id} onEdit={() => openMaterial(subjectId, item)} onDelete={() => confirmDeleteMaterial(item)} />
      </View>)}
    </View><Message text={error} />
  </View>;
}

export default memo(StudyMaterials);
