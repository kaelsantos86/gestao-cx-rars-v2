import { redirect } from 'next/navigation';
import { hasSupabaseEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

export async function requireManager() {
  if (!hasSupabaseEnv()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) redirect('/login');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, role')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'manager') {
    await supabase.auth.signOut();
    redirect('/login?error=unauthorized');
  }

  return { supabase, user: data.user, profile };
}
