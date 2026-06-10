'use client';

import { useState } from 'react';
import { supabase, saoPauloLocalToUtcIso } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateMatchPage() {
  const [formData, setFormData] = useState({ matchNumber: '', teamA: '', teamB: '', kickoffTime: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);

    const { error } = await supabase.from('matches').insert([
      {
        match_number: parseInt(formData.matchNumber),
        team_a: formData.teamA,
        team_b: formData.teamB,
        kickoff_time: saoPauloLocalToUtcIso(formData.kickoffTime),
      },
    ]);

    if (error) {
      setIsError(true);
      setMessage('Erro: ' + error.message);
    } else {
      setMessage('Jogo criado com sucesso!');
      setTimeout(() => router.push('/dashboard'), 1500);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/dashboard">
            <button className="text-blue-600 hover:text-blue-800">← Voltar ao início</button>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Criar novo jogo</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Número do jogo</label>
            <input type="number" name="matchNumber" value={formData.matchNumber} onChange={handleChange}
              placeholder="1" required
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Time A</label>
              <input type="text" name="teamA" value={formData.teamA} onChange={handleChange}
                placeholder="Brasil" required
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Time B</label>
              <input type="text" name="teamB" value={formData.teamB} onChange={handleChange}
                placeholder="Argentina" required
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Data e hora do início <span className="text-gray-500">(horário de Brasília)</span>
            </label>
            <input type="datetime-local" name="kickoffTime" value={formData.kickoffTime} onChange={handleChange}
              required
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-500 mt-1">
              Informe o horário de Brasília. Os palpites fecham 30 minutos antes do início.
            </p>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Criando...' : 'Criar jogo'}
          </button>

          {message && (
            <p className={`mt-4 text-center ${isError ? 'text-red-600' : 'text-green-600'}`}>{message}</p>
          )}
        </form>
      </main>
    </div>
  );
}
