import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Part } from '../types';

export function useParts(carId?: string) {
  const [parts, setParts] = useState<Part[]>([]);

  const fetch = useCallback(async () => {
    if (!carId) return;
    const { data } = await supabase.from('parts').select('*').eq('car_id', carId);
    if (data) setParts(data);
  }, [carId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addPart = async (part: Omit<Part, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('parts').insert(part).select().single();
    if (!error && data) setParts(prev => [...prev, data]);
    return { data, error };
  };

  // Returns parts that are due soon: within 2000km of current mileage
  const getUpcoming = (currentMileage: number) =>
    parts.filter(p => {
      if (!p.expected_lifetime_km) return false;
      const dueAt = p.installed_mileage + p.expected_lifetime_km;
      return dueAt - currentMileage <= 2000 && dueAt > currentMileage;
    });

  return { parts, addPart, getUpcoming, refetch: fetch };
}
