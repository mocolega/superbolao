import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ----- Helpers de horário (referência Brasília, UTC-3 o ano todo, sem horário de verão) -----

const SAO_PAULO_TZ = 'America/Sao_Paulo';

// Converte um valor de datetime-local ("2026-06-13T19:00"), informado pelo
// admin no horário de Brasília, para uma string ISO em UTC para armazenamento.
export function saoPauloLocalToUtcIso(localValue: string) {
  const withSeconds = localValue.length === 16 ? localValue + ':00' : localValue;
  return new Date(withSeconds + '-03:00').toISOString();
}

// Formata um horário armazenado para exibição no horário de Brasília (igual para todos).
export function formatKickoff(iso: string) {
  const formatted = new Date(iso).toLocaleString('pt-BR', {
    timeZone: SAO_PAULO_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${formatted} (horário de Brasília)`;
}

// Os palpites fecham 30 minutos antes do início.
export function isBettingClosed(kickoffIso: string) {
  const cutoff = new Date(kickoffIso).getTime() - 30 * 60 * 1000;
  return Date.now() >= cutoff;
}

// ----- Helpers de autenticação -----

// Envia o código de acesso por e-mail (OTP de 6 dígitos).
export async function signInWithEmail(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email,
  });
  return { error };
}

// Verifica o código de 6 dígitos.
export async function verifyOtp(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email,
    token: token,
    type: 'email',
  });
  return { data, error };
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user || null;
}

export async function isUserAdmin(userId: string) {
  const { data } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .single();
  return data?.is_admin || false;
}
