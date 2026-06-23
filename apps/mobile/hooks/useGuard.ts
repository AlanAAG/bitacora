import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { GuardSession } from '../types';

export function useGuard(carId?: string) {
  const [sessions, setSessions] = useState<GuardSession[]>([]);
  const [currentSession, setCurrentSession] = useState<GuardSession | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!carId) return;
    const { data } = await supabase.from('guard_sessions')
      .select('*').eq('car_id', carId)
      .order('started_at', { ascending: false }).limit(20);
    if (data) setSessions(data);
  }, [carId]);

  const createSession = async (shopName?: string): Promise<string> => {
    const { data, error } = await supabase.from('guard_sessions').insert({
      car_id: carId,
      status: 'recording',
      shop_name: shopName,
    }).select().single();
    if (error) throw error;
    setCurrentSession(data);
    return data.id;
  };

  const analyzeSession = async (sessionId: string): Promise<any> => {
    const { data, error } = await supabase.functions.invoke('guard-agent', {
      body: { session_id: sessionId },
    });
    if (error) throw error;
    await fetchSessions();
    return data;
  };

  return { sessions, currentSession, fetchSessions, createSession, analyzeSession };
}
