'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Match {
  id: string;
  team_a: string;
  team_b: string;
  is_closed: boolean;
  final_team_a_goals?: string;
  final_team_b_goals?: string;
}

export default function MatchLeaderboardPage() {
  const params = useParams();
  const matchId = params.id as string;
  const [match, setMatch] = useState<Match | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/');
      return;
    }

    const { data: matchData } = await supabase
      .from('matches')
      .select('id, team_a, team_b, is_closed, final_team_a_goals, final_team_b_goals')
      .eq('id', matchId)
      .single();
    setMatch(matchData);

    const { data: scores } = await supabase
      .from('scores')
      .select('*')
      .eq('match_id', matchId);

    const { data: users } = await supabase.from('users').select('id, name');
    // submitted_at is the final, silent tiebreaker (earliest prediction wins).
    const { data: preds } = await supabase
      .from('predictions')
      .select('id, submitted_at')
      .eq('match_id', matchId);

    const merged = (scores || []).map((s) => ({
      ...s,
      name: users?.find((u) => u.id === s.user_id)?.name || 'Anônimo',
      submitted_at: preds?.find((p) => p.id === s.prediction_id)?.submitted_at || '',
    }));

    // Cascade: final pts, then halftime pts, then yellow, penalty, red, kickoff,
    // then earliest submission.
    const bool = (v: boolean) => (v ? 1 : 0);
    merged.sort((a, b) => {
      if (b.final_pts !== a.final_pts) return b.final_pts - a.final_pts;
      if (b.halftime_pts !== a.halftime_pts) return b.halftime_pts - a.halftime_pts;
      if (bool(b.yellow_correct) !== bool(a.yellow_correct)) return bool(b.yellow_correct) - bool(a.yellow_correct);
      if (bool(b.penalty_correct) !== bool(a.penalty_correct)) return bool(b.penalty_correct) - bool(a.penalty_correct);
      if (bool(b.red_correct) !== bool(a.red_correct)) return bool(b.red_correct) - bool(a.red_correct);
      if (bool(b.kickoff_correct) !== bool(a.kickoff_correct)) return bool(b.kickoff_correct) - bool(a.kickoff_correct);
      return String(a.submitted_at).localeCompare(String(b.submitted_at));
    });

    setRows(merged);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  if (!match) return <div className="flex justify-center items-center h-screen">Jogo não encontrado</div>;

  const tick = (v: boolean) => (v ? '✓' : '–');
  const hasResult = match.final_team_a_goals !== null && match.final_team_a_goals !== undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">🏆 Classificação do jogo</h1>
          <Link href="/dashboard">
            <button className="text-blue-600 hover:text-blue-800">← Voltar ao início</button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-1">
          {match.team_a} x {match.team_b}
        </h2>
        {hasResult ? (
          <p className="text-gray-600 mb-8">
            Resultado final: {match.final_team_a_goals} - {match.final_team_b_goals}
          </p>
        ) : (
          <p className="text-gray-600 mb-8">Nenhum resultado lançado ainda — a classificação aparece quando o administrador registrar um.</p>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Posição</th>
                <th className="px-4 py-3 text-left font-semibold">Jogador</th>
                <th className="px-4 py-3 text-center font-semibold">Pts final</th>
                <th className="px-4 py-3 text-center font-semibold">Pts 1º tempo</th>
                <th className="px-4 py-3 text-center font-semibold">Amarelos</th>
                <th className="px-4 py-3 text-center font-semibold">Pênalti</th>
                <th className="px-4 py-3 text-center font-semibold">Vermelho</th>
                <th className="px-4 py-3 text-center font-semibold">Pontapé</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Nenhuma pontuação ainda
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id} className={`border-b hover:bg-gray-50 ${i === 0 ? 'bg-yellow-50' : ''}`}>
                    <td className="px-4 py-3 font-bold">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </td>
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3 text-center font-bold">{r.final_pts}</td>
                    <td className="px-4 py-3 text-center">{r.halftime_pts}</td>
                    <td className="px-4 py-3 text-center">{tick(r.yellow_correct)}</td>
                    <td className="px-4 py-3 text-center">{tick(r.penalty_correct)}</td>
                    <td className="px-4 py-3 text-center">{tick(r.red_correct)}</td>
                    <td className="px-4 py-3 text-center">{tick(r.kickoff_correct)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Classificado por pontos do placar final, depois pontos do 1º tempo, depois cartões
          amarelos, pênalti, cartão vermelho e pontapé inicial. Empates além disso vão para o palpite mais antigo.
        </p>
      </main>
    </div>
  );
}
