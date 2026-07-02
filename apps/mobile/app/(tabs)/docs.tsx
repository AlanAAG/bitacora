import { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, Card, FAB, Portal, Dialog, TextInput, SegmentedButtons, Button } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../lib/supabase';
import { useCars } from '../../hooks/useCars';
import { EmptyState } from '../../components/EmptyState';
import { Document, DocType } from '../../types';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function DocsScreen() {
  const { cars } = useCars();
  const primary = cars[0];
  const [docs, setDocs] = useState<Document[]>([]);
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState('');
  const [docType, setDocType] = useState<DocType>('insurance');
  const [expiry, setExpiry] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchDocs = useCallback(async () => {
    if (!primary) return;
    const { data } = await supabase.from('documents').select('*')
      .eq('car_id', primary.id).order('created_at', { ascending: false });
    if (data) setDocs(data);
  }, [primary]);

  useEffect(() => { void Promise.resolve().then(fetchDocs); }, [fetchDocs]);

  if (!primary) return <EmptyState icon="📄" title="Sin auto registrado" body="Agrega un auto primero." quote={null} />;

  const save = async () => {
    setSaving(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (picked.canceled) { setSaving(false); return; }
      const asset = picked.assets[0];
      const path = `${primary.id}/${Date.now()}-${asset.name}`;
      const blob = await (await fetch(asset.uri)).blob();
      const { error: upErr } = await supabase.storage.from('car-documents')
        .upload(path, blob, { contentType: asset.mimeType ?? 'application/octet-stream', upsert: true });
      if (upErr) throw upErr;
      await supabase.from('documents').insert({
        car_id: primary.id,
        doc_type: docType,
        name: name || asset.name,
        file_url: `car-documents/${path}`,
        expiry_date: expiry || null,
      });
      setDialog(false); setName(''); setExpiry(''); setDocType('insurance');
      await fetchDocs();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[Typography.heading, styles.header]}>Documentos — {primary.display_name}</Text>
      <FlatList
        data={docs}
        keyExtractor={d => d.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const left = daysUntil(item.expiry_date);
          const urgent = left !== null && left < 30;
          return (
            <Card style={styles.card}>
              <Card.Content style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={Typography.label}>{item.name}</Text>
                  <Text style={Typography.caption}>{item.doc_type}</Text>
                </View>
                {item.expiry_date && (
                  <Text style={[Typography.caption, { color: urgent ? Colors.danger : Colors.textSecondary }]}>
                    {left! < 0 ? 'Vencido' : `${left} días`}
                  </Text>
                )}
              </Card.Content>
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState icon="📁" title="Sin documentos" body="Guarda tu seguro, verificación y placas en un solo lugar." quote={null} />
        }
      />

      <Portal>
        <Dialog visible={dialog} onDismiss={() => setDialog(false)}>
          <Dialog.Title>Nuevo documento</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Nombre" value={name} onChangeText={setName} style={styles.input} />
            <SegmentedButtons value={docType} onValueChange={v => setDocType(v as DocType)}
              buttons={[
                { value: 'insurance', label: 'Seguro' },
                { value: 'verification', label: 'Verif.' },
                { value: 'plates', label: 'Placas' },
                { value: 'other', label: 'Otro' },
              ]} style={styles.input} />
            <TextInput label="Vence (YYYY-MM-DD, opcional)" value={expiry} onChangeText={setExpiry} style={styles.input} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialog(false)}>Cancelar</Button>
            <Button onPress={save} loading={saving}>Seleccionar archivo</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB icon="plus" style={styles.fab} color={Colors.surface} customSize={56} onPress={() => setDialog(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 56 },
  header: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  card: { marginBottom: Spacing.sm, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { marginBottom: Spacing.sm },
  fab: { position: 'absolute', bottom: Spacing.xl, right: Spacing.md, backgroundColor: Colors.primary },
});
