import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, Button, Checkbox } from 'react-native-paper';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

// Aviso de privacidad (LFPDPPP, vigente desde marzo 2025). Autoridad: Secretaría
// Anticorrupción y Buen Gobierno (el INAI fue disuelto). Texto base — revisar con asesoría
// legal antes de producción.
export default function PrivacyScreen() {
  const [audio, setAudio] = useState(false);
  const [transcripts, setTranscripts] = useState(false);
  const [location, setLocation] = useState(false);
  const [saving, setSaving] = useState(false);

  const accept = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({
        privacy_accepted_at: new Date().toISOString(),
        consent_audio: audio,
        consent_transcripts: transcripts,
        consent_location: location,
      }).eq('id', user.id);
    }
    setSaving(false);
    router.replace('/(tabs)');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[Typography.heading, { marginBottom: Spacing.md }]}>Aviso de privacidad</Text>

      <Text style={[Typography.body, styles.p]}>
        Bitácora es responsable del tratamiento de tus datos personales conforme a la Ley Federal de
        Protección de Datos Personales en Posesión de los Particulares (LFPDPPP). La autoridad en la
        materia es la Secretaría Anticorrupción y Buen Gobierno.
      </Text>
      <Text style={[Typography.title, styles.h]}>Datos que tratamos</Text>
      <Text style={[Typography.body, styles.p]}>
        Datos de tu cuenta (nombre, correo), datos de tu vehículo (marca, modelo, placas, kilometraje),
        documentos que subas, tu estado/ubicación, y —solo si lo activas— el audio del Modo Guardia y su
        transcripción. El audio y la transcripción pueden contener datos sensibles, por lo que requieren tu
        consentimiento expreso.
      </Text>
      <Text style={[Typography.title, styles.h]}>Finalidades</Text>
      <Text style={[Typography.body, styles.p]}>
        Llevar el historial de tu auto, enviarte recordatorios (verificación, Hoy No Circula, refrendo,
        mantenimiento) y, con tu consentimiento, analizar conversaciones con mecánicos para detectar posibles
        cobros indebidos. El audio se elimina automáticamente tras el análisis; solo se conserva la
        transcripción y el resultado, accesibles únicamente por ti.
      </Text>
      <Text style={[Typography.title, styles.h]}>Transferencias</Text>
      <Text style={[Typography.body, styles.p]}>
        Para transcribir y analizar usamos proveedores de inteligencia artificial (OpenAI y Anthropic). No
        vendemos tus datos.
      </Text>
      <Text style={[Typography.title, styles.h]}>Tus derechos ARCO</Text>
      <Text style={[Typography.body, styles.p]}>
        Puedes Acceder, Rectificar, Cancelar u Oponerte al tratamiento, y revocar tu consentimiento, desde
        Configuración → Privacidad (exportar o eliminar tu cuenta) en cualquier momento.
      </Text>

      <Text style={[Typography.title, styles.h]}>Consentimiento</Text>
      <Checkbox.Item label="Acepto el tratamiento de mis datos de ubicación para recordatorios locales"
        status={location ? 'checked' : 'unchecked'} onPress={() => setLocation(v => !v)} />
      <Checkbox.Item label="Consiento la grabación de audio del Modo Guardia (datos sensibles)"
        status={audio ? 'checked' : 'unchecked'} onPress={() => setAudio(v => !v)} />
      <Checkbox.Item label="Consiento la transcripción y análisis del audio con IA"
        status={transcripts ? 'checked' : 'unchecked'} onPress={() => setTranscripts(v => !v)} />

      <Text style={[Typography.caption, { color: Colors.textMuted, marginVertical: Spacing.md }]}>
        Puedes usar Bitácora sin activar audio/transcripción; en ese caso el Modo Guardia no estará disponible.
      </Text>

      <Button mode="contained" loading={saving} onPress={accept} style={styles.btn}>
        Acepto el aviso de privacidad
      </Button>
      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.xl },
  h: { marginTop: Spacing.md, marginBottom: Spacing.xs },
  p: { color: Colors.textSecondary, marginBottom: Spacing.sm },
  btn: { borderRadius: 50, marginTop: Spacing.md },
});
