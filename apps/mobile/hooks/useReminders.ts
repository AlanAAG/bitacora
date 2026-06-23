import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Reminder } from '../types';

export function useReminders(carIds: string[]) {
  const [activeReminders, setActiveReminders] = useState<Reminder[]>([]);

  const key = carIds.join(',');
  const fetch = useCallback(async () => {
    if (carIds.length === 0) return;
    const { data } = await supabase
      .from('reminders')
      .select('*')
      .in('car_id', carIds)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false });
    if (data) setActiveReminders(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { fetch(); }, [fetch]);

  const dismissReminder = async (id: string) => {
    await supabase.from('reminders').update({ is_dismissed: true }).eq('id', id);
    setActiveReminders(prev => prev.filter(r => r.id !== id));
  };

  return { activeReminders, dismissReminder, refetch: fetch };
}
