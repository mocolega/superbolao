'use client';

import { useEffect, useState } from 'react';
import { supabase, formatKickoff, isBettingClosed } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Match {
  id: string;
  match_number: number;
  team_a: string;
  team_b: string;
  kickoff_time: string;
  is_closed: boolean;
}

const FINAL_GOALS = ['0', '1', '2', '3', '4', '5+'];
const HALFTIME_GOALS = ['0', '1', '2', '3+'];
const YELLOW_RANGES = ['0-2', '3-4', '5+'];

export default function PredictPage() {
  const params = useParams();
  const matchId = params.id as string;
  const [match, setMatch] = useState<Match | null>(null);
  const [existingPrediction, setExistingPrediction] = useState<any>(null);
  const [formData, setFormData] = useState({
    finalTeamAGoals: '0',
    finalTeamBGoals: '0',
    halftimeTeamAGoals: '0',
    halftimeTeamBGoals: '0',
    penaltyKicks: false,
    redCard: false,
    yellowCardsRange: '0-2',
    startingPossession: 'A',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/');
      return;
    }
    setUser(session.user);

    const { data: matchData } = await supabase.from('matches').select('*').eq('id', matchId).single();
    setMatch(matchData);

    const { data: predData } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('match_id', matchId)
      .single();

    if (predData) {
      setExistingPrediction(predData);
      setFormData({
        finalTeamAGoals: predData.pred_final_team_a_goals ?? '0',
        finalTeamBGoals: predData.pred_final_team_b_goals ?? '0',
        halftimeTeamAGoals: predData.pred_halftime_team_a_goals ?? '0',
        halftimeTeamBGoals: predData.pred_halftime_team_b_goals ?? '0',
        penaltyKicks: predData.pred_penalty_kicks,
        redCard: predData.pred_red_card,
        yellowCardsRange: predData.pred_yellow_cards_range ?? '0-2',
        startingPossession: predData.pred_starting_possession ?? 'A',
      });
    }

    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (match && (match.is_closed || isBettingClosed(match.kickoff_time))) {
      setIsError(true);
      setMessage('Erro: os palpites para este jogo estão encerrados.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    setIsError(false);

    const payload = {
      pred_final_team_a_goals: formData.finalTeamAGoals,
      pred_final_team_b_goals: formData.finalTeamBGoals,
      pred_halftime_team_a_goals: formData.halftimeTeamAGoals,
      pred_halftime_team_b_goals: formData.halftimeTeamBGoals,
      pred_penalty_kicks: formData.penaltyKicks,
      pred_red_card: formData.redCard,
      pred_yellow_cards_range: formData.yellowCardsRange,
      pred_starting_possession: formData.startingPossession,
    };

    try {
      if (existingPrediction) {
        const { error } = await supabase.from('predictions').update(payload).eq('id', existingPrediction.id);
        if (error) throw error;
        setMessage('Palpite atualizado!');
      } else {
        const { error } = await supabase
          .from('predictions')
          .insert([{ user_id: user.id, match_id: matchId, ...payload }]);
        if (error) throw error;
        setMessage('Palpite enviado!');
      }

      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: any) {
      setIsError(true);
      if (err.code === '23505') {
        setMessage('Erro: esse palpite exato já foi escolhido. Mude pelo menos uma opção para deixá-lo único.');
      } else {
        setMessage('Erro: ' + err.message);
      }
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  if (!match) return <div className="flex justify-center items-center h-screen">Jogo não encontrado</div>;

  const bettingClosed = match.is_closed || isBettingClosed(match.kickoff_time);

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
        <h1 className="text-3xl font-bold mb-2">
          {match.team_a} x {match.team_b}
        </h1>
        <p className="text-gray-600 mb-2">Início: {formatKickoff(match.kickoff_time)}</p>
        <Link href={`/predictions/${matchId}`} className="inline-block mb-8 text-sm text-blue-600 hover:text-blue-800">
          Ver os palpites de todos →
        </Link>

        {bettingClosed && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8">
            Os palpites para este jogo estão encerrados (fecham 30 minutos antes do início).
          </div>
        )}

        {!bettingClosed && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-semibold mb-6">Seu palpite</h2>

            <div className="mb-8 pb-8 border-b">
              <h3 className="text-lg font-semibold mb-4">Placar final</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Gols do {match.team_a}</label>
                  <select name="finalTeamAGoals" value={formData.finalTeamAGoals} onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {FINAL_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Gols do {match.team_b}</label>
                  <select name="finalTeamBGoals" value={formData.finalTeamBGoals} onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {FINAL_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="mb-8 pb-8 border-b">
              <h3 className="text-lg font-semibold mb-4">Placar do primeiro tempo</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Gols do {match.team_a}</label>
                  <select name="halftimeTeamAGoals" value={formData.halftimeTeamAGoals} onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {HALFTIME_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Gols do {match.team_b}</label>
                  <select name="halftimeTeamBGoals" value={formData.halftimeTeamBGoals} onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {HALFTIME_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="mb-8 pb-8 border-b">
              <h3 className="text-lg font-semibold mb-4">Eventos do jogo</h3>
              <div className="space-y-4 mb-6">
                <div className="flex items-center">
                  <input type="checkbox" name="penaltyKicks" checked={formData.penaltyKicks} onChange={handleChange}
                    className="w-4 h-4 cursor-pointer" />
                  <label className="ml-3 text-sm font-medium">Vai ter pênalti</label>
                </div>
                <div className="flex items-center">
                  <input type="checkbox" name="redCard" checked={formData.redCard} onChange={handleChange}
                    className="w-4 h-4 cursor-pointer" />
                  <label className="ml-3 text-sm font-medium">Vai ter cartão vermelho</label>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Total de cartões amarelos</label>
                  <select name="yellowCardsRange" value={formData.yellowCardsRange} onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {YELLOW_RANGES.map((r) => <option key={r} value={r}>{r} cartões</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Quem dá o pontapé inicial</label>
                  <select name="startingPossession" value={formData.startingPossession} onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="A">{match.team_a}</option>
                    <option value="B">{match.team_b}</option>
                  </select>
                </div>
              </div>
            </div>

            <button type="submit" disabled={submitting}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Enviando...' : existingPrediction ? 'Atualizar palpite' : 'Enviar palpite'}
            </button>

            {message && (
              <p className={`mt-4 text-center ${isError ? 'text-red-600' : 'text-green-600'}`}>{message}</p>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
