'use client';

import { useState, useEffect } from 'react';
import { signInWithEmail, verifyOtp, supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  // Se já houver uma sessão, vai direto para o início.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) router.push('/dashboard');
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);

    const { error } = await signInWithEmail(email);

    if (error) {
      setIsError(true);
      setMessage('Erro: ' + error.message);
    } else {
      setMessage('Enviamos um código de 6 dígitos para o seu e-mail.');
      setStep('code');
    }
    setLoading(false);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);

    const { error } = await verifyOtp(email, code);

    if (error) {
      setIsError(true);
      setMessage('Código inválido. Tente novamente.');
    } else {
      router.push('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="bg-white rounded-lg shadow-lg p-8 w-96">
        <h1 className="text-3xl font-bold text-center mb-2">⚽ Super Bolão da Copa</h1>
        <p className="text-center text-gray-600 mb-6">Dê seu palpite nos jogos</p>

        {step === 'email' ? (
          <form onSubmit={sendCode}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <div className="mb-2">
              <label className="block text-sm font-medium mb-2">Código de 8 dígitos</label>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="00000000"
                required
                autoFocus
                className="w-full px-4 py-2 border rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setMessage('');
                setIsError(false);
              }}
              className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              Usar outro e-mail
            </button>
          </form>
        )}

        {message && (
          <p className={`mt-4 text-center text-sm ${isError ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
