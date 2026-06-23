import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Copy } from '../constants/copy';

export function useReferral() {
  const [code, setCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: prof }, { count }] = await Promise.all([
        supabase.from('profiles').select('referral_code').eq('id', user.id).single(),
        supabase.from('referral_events').select('*', { count: 'exact', head: true }).eq('referrer_id', user.id),
      ]);
      if (prof) setCode(prof.referral_code);
      if (count !== null) setReferralCount(count ?? 0);
    })();
  }, []);

  const shareLink = code ? `https://bitacora.app/r/${code}` : null;
  const shareText = code ? Copy.referralShareText(code) : '';

  return { code, referralCount, shareLink, shareText };
}
