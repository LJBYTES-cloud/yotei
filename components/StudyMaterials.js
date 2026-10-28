import { memo, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { getMaterialUrl } from '../utils/materialLinks';
import { getShareableMaterialUri } from '../utils/materialFiles';
import { useStudyList } from './StudyWorkspace';
import { createStudyStyles } from './studyStyles';
import { Button, Message } from './ui';
import ItemActionsMenu from './ItemActionsMenu';

/** @param {{subjectId: number}} props */
function StudyMaterials({ subjectId }) {
  const { user, data, disabled, openMaterial, confirmDeleteMaterial, deletingMaterial } = useStudyList();
  const { colors: p } = useTheme(), s = useThemedStyles(createStudyStyles);
  const [error, setError] = useState('');
  const opening = useRef(false);
  const materials = useMemo(() => data.materials.filter(item => item.subject_id === subjectId), [data.materials, subjectId]);
  async function open(/** @type {import('../db/MaterialService').Material} */ material) {
    if (opening.current) return;
    opening.current = true;
    setError('');
    let file = false;
    try {
      const url = getMaterialUrl(material.url_or_note || material.local_file_path || '');
      file = /^(file|content):\/\//i.test(url);
      if (file) {
        // Android's Sharing module grants read access through its FileProvider.
        // It requires a local file, so provider references need a cache copy first.
        const localUri = await getShareableMaterialUri(user.id, url, material.title);
        await Sharing.shareAsync(localUri, { mimeType: '*/*', dialogTitle: 'Open Material' });
      } else await Linking.openURL(url);
    } catch {
      setError(file
        ? 'Could not share this file. Check that it is still available, or edit the material and select it again.'
        : 'This location could not be opened. Check that it exists and is accessible on this device.');
    } finally { opening.current = false; }
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
