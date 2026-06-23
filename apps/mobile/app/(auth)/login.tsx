import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';
import { Typography } from '../../constants/typography';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={[Typography.heading, { marginBottom: Spacing.sm }]}>Entrar</Text>
      <TextInput label="Email" value={email} onChangeText={setEmail}
        keyboardType="email-address" autoCapitalize="none" style={styles.input} />
      <TextInput label="Contraseña" value={password} onChangeText={setPassword}
        secureTextEntry style={styles.input} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button mode="contained" onPress={handleLogin} loading={loading} style={styles.btn}>
        Entrar
      </Button>
      <Button mode="text" onPress={() => router.back()}>Volver</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.xl, justifyContent: 'center', backgroundColor: Colors.surface },
  input: { marginBottom: Spacing.sm },
  btn: { marginTop: Spacing.sm, borderRadius: 50 },
  error: { color: Colors.danger, marginBottom: Spacing.sm },
});
