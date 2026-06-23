import { useEffect, useState } from 'react';
import { View, StyleSheet, Share, Alert, ScrollView } from 'react-native';
import { Text, Switch, Button, Divider } from 'react-native-paper';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Profile } from '../../types';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

export default function PrivacySettingsScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      setProfile(data);
    })();
  }, []);

  const toggle = async (key: 'consent_location' | 'consent_audio' | 'consent_transcripts', value: boolean) => {
    if (!profile) return;
    setProfile({ ...profile, [key]: value });
    await supabase.from('profiles').update({ [key]: value }).eq('id', profile.id);
  };

  const exportData = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('export_my_data');
    setBusy(false);
    if (error) { Alert.alert('Error', 'No se pudo exportar.'); return; }
    await Share.share({ message: JSON.stringify(data, null, 2) });
  };

  const deleteAccount = () => {
    Alert.alert('Eliminar cuenta', 'Esto borra permanentemente tu cuenta y todos tus datos. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        setBusy(true);
        const { error } = await supabase.functions.invoke('delete-account');
        setBusy(false);
        if (error) { Alert.alert('Error', 'No se pudo eliminar la cuenta.'); return; }
        await supabase.auth.signOut();
        router.replace('/(auth)/onboarding');
      } },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[Typography.heading, { marginBottom: Spacing.lg }]}>Privacidad</Text>

      <Text style={[Typography.label, { marginBottom: Spacing.sm }]}>Consentimientos</Text>
      <Row label="Ubicación para recordatorios" value={!!profile?.consent_location} onChange={v => toggle('consent_location', v)} />
      <Row label="Grabación de audio (Modo Guardia)" value={!!profile?.consent_audio} onChange={v => toggle('consent_audio', v)} />
      <Row label="Transcripción y análisis con IA" value={!!profile?.consent_transcripts} onChange={v => toggle('consent_transcripts', v)} />

      <Divider style={{ marginVertical: Spacing.lg }} />

      <Text style={[Typography.label, { marginBottom: Spacing.sm }]}>Tus derechos ARCO</Text>
      <Button mode="outlined" icon="download" loading={busy} onPress={exportData} style={styles.btn}>
        Exportar mis datos
      </Button>
      <Button mode="contained" buttonColor={Colors.danger} icon="delete" loading={busy} onPress={deleteAccount} style={styles.btn}>
        Eliminar mi cuenta
      </Button>
      <Button mode="text" onPress={() => router.back()}>Volver</Button>
    </ScrollView>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={[Typography.body, { flex: 1 }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  btn: { borderRadius: 50, marginBottom: Spacing.sm },
});
