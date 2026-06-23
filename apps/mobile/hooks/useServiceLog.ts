import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ServiceRecord } from '../types';

export function useServiceLog(carId?: string) {
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!carId) { setLoading(false); return; }
    const { data } = await supabase
      .from('service_records')
      .select('*')
      .eq('car_id', carId)
      .order('service_date', { ascending: false });
    if (data) setRecords(data);
    setLoading(false);
  }, [carId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addRecord = async (record: Omit<ServiceRecord, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('service_records').insert(record).select().single();
    if (!error && data) setRecords(prev => [data, ...prev]);
    return { data, error };
  };

  return { records, loading, addRecord, refetch: fetch };
}
