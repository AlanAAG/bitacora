import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Car } from '../types';

export function useCars() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('cars').select('*')
      .order('is_primary', { ascending: false })
      .order('created_at');
    if (data) setCars(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const addCar = async (car: Omit<Car, 'id' | 'owner_id' | 'health_score' | 'display_name' | 'created_at' | 'updated_at'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('cars')
      .insert({ ...car, owner_id: user!.id })
      .select().single();
    if (!error && data) setCars(prev => [...prev, data]);
    return { data, error };
  };

  const updateCar = async (id: string, updates: Partial<Car>) => {
    const { data, error } = await supabase.from('cars')
      .update(updates).eq('id', id).select().single();
    if (!error && data) setCars(prev => prev.map(c => c.id === id ? data : c));
    return { data, error };
  };

  const updateMileage = (id: string, km: number) => updateCar(id, { current_mileage: km });
  const deleteCar = async (id: string) => {
    const { error } = await supabase.from('cars').delete().eq('id', id);
    if (!error) setCars(prev => prev.filter(c => c.id !== id));
    return { error };
  };

  return { cars, loading, addCar, updateCar, updateMileage, deleteCar, refetch: fetch };
}
