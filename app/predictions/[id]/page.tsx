'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Match {
  id: string;
  team_a: string;
  team_b: string;
}

// Ordena os buckets de gols: '5+' -> 5, '3+' -> 3, senão o número.
const goalRank = (b: string) => (b === '5+' ? 5 : b === '3+' ? 3 : parseInt(b, 10));
// Ordena as faixas de amarelos: 0-2 < 3-4 < 5+
const yellowRank = (r: string) => (r === '0-2' ? 0 : r === '3-4' ? 1 : 2);
const boolRank = (v: boolean) => (v ? 1 : 0);
const koRank = (s: string) => (s === 'A' ? 0 : 1);

export default function AllPredictionsPage() {
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
      .select('id, team_a, team_b')
      .eq('id', matchId)
      .single();
    setMatch(matchData);

    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .eq('match_id', matchId);

    const { data: users } = await supabase.from('users').select('id, name');

    const merged = (preds || []).map((p) => ({
      ...p,
      name: users?.find((u) => u.id === p.user_id)?.name || 'Anônimo',
    }));

    // Ordem crescente: gols final A, gols final B, gols 1º tempo A, gols 1º tempo B,
    // cartões amarelos, pênalti, cartão vermelho, pontapé inicial (Time A antes do Time B).
    merged.sort(
      (a, b) =>
        goalRank(a.pred_final_team_a_goals) - goalRank(b.pred_final_team_a_goals) ||
        goalRank(a.pred_final_team_b_goals) - goalRank(b.pred_final_team_b_goals) ||
        goalRank(a.pred_halftime_team_a_goals) - goalRank(b.pred_halftime_team_a_goals) ||
        goalRank(a.pred_halftime_team_b_goals) - goalRank(b.pred_halftime_team_b_goals) ||
        yellowRank(a.pred_yellow_cards_range) - yellowRank(b.pred_yellow_cards_range) ||
        boolRank(a.pred_penalty_kicks) - boolRank(b.pred_penalty_kicks) ||
        boolRank(a.pred_red_card) - boolRank(b.pred_red_card) ||
        koRank(a.pred_starting_possession) - koRank(b.pred_starting_possession)
    );

    setRows(merged);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  if (!match) return <div className="flex justify-center items-center h-screen">Jogo não encontrado</div>;

  const possessionName = (side: string) => (side === 'B' ? match.team_b : match.team_a);
  const yesNo = (v: boolean) => (v ? 'Sim' : 'Não');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/dashboard">
            <button className="text-blue-600 hover:text-blue-800">← Voltar ao início</button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">
          Todos os palpites — {match.team_a} x {match.team_b}
        </h1>
        <p className="text-gray-600 mb-8">{rows.length} palpite(s) até agora</p>

        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Jogador</th>
                <th className="px-4 py-3 text-center font-semibold">Final</th>
                <th className="px-4 py-3 text-center font-semibold">1º tempo</th>
                <th className="px-4 py-3 text-center font-semibold">Amarelos</th>
                <th className="px-4 py-3 text-center font-semibold">Pênalti</th>
                <th className="px-4 py-3 text-center font-semibold">Vermelho</th>
                <th className="px-4 py-3 text-center font-semibold">Pontapé</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Nenhum palpite ainda
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3 text-center font-medium">
                      {r.pred_final_team_a_goals} - {r.pred_final_team_b_goals}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.pred_halftime_team_a_goals} - {r.pred_halftime_team_b_goals}
                    </td>
                    <td className="px-4 py-3 text-center">{r.pred_yellow_cards_range}</td>
                    <td className="px-4 py-3 text-center">{yesNo(r.pred_penalty_kicks)}</td>
                    <td className="px-4 py-3 text-center">{yesNo(r.pred_red_card)}</td>
                    <td className="px-4 py-3 text-center">{possessionName(r.pred_starting_possession)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          As colunas Final e 1º tempo são exibidas como {match.team_a} - {match.team_b}.
        </p>
      </main>
    </div>
  );
}
