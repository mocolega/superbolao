'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Match {
  id: string;
  match_number: number;
  team_a: string;
  team_b: string;
  is_closed: boolean;
  final_team_a_goals?: string;
  final_team_b_goals?: string;
  halftime_team_a_goals?: string;
  halftime_team_b_goals?: string;
  has_penalty_kicks?: boolean;
  has_red_card?: boolean;
  yellow_cards_range?: string;
  starting_possession_team?: string;
}

const FINAL_GOALS = ['0', '1', '2', '3', '4', '5+'];
const HALFTIME_GOALS = ['0', '1', '2', '3+'];
const YELLOW_RANGES = ['0-2', '3-4', '5+'];

// Map a goal bucket to a number so we can decide winner / tie.
// '5+' -> 5, '3+' -> 3, otherwise the integer value.
function rank(bucket: string) {
  if (bucket === '5+') return 5;
  if (bucket === '3+') return 3;
  return parseInt(bucket, 10);
}

export default function AdminMatchPage() {
  const params = useParams();
  const matchId = params.id as string;
  const [match, setMatch] = useState<Match | null>(null);
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
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadMatch();
  }, []);

  const loadMatch = async () => {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (data) {
      setMatch(data);
      // Prefill from whatever result is already recorded (so live edits start
      // from the current values rather than resetting to zero).
      if (data.final_team_a_goals !== null && data.final_team_a_goals !== undefined) {
        setFormData({
          finalTeamAGoals: data.final_team_a_goals ?? '0',
          finalTeamBGoals: data.final_team_b_goals ?? '0',
          halftimeTeamAGoals: data.halftime_team_a_goals ?? '0',
          halftimeTeamBGoals: data.halftime_team_b_goals ?? '0',
          penaltyKicks: data.has_penalty_kicks || false,
          redCard: data.has_red_card || false,
          yellowCardsRange: data.yellow_cards_range ?? '0-2',
          startingPossession: data.starting_possession_team ?? 'A',
        });
      }
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

  const calculateScores = async () => {
    // Clear any scores from a previous save so live updates don't stack up.
    await supabase.from('scores').delete().eq('match_id', matchId);

    const { data: predictions } = await supabase
      .from('predictions')
      .select('*')
      .eq('match_id', matchId);

    if (!predictions) return;

    const actualFinalA = rank(formData.finalTeamAGoals);
    const actualFinalB = rank(formData.finalTeamBGoals);
    const finalWinner =
      actualFinalA > actualFinalB ? 'A' : actualFinalA < actualFinalB ? 'B' : 'TIE';

    const actualHalfA = rank(formData.halftimeTeamAGoals);
    const actualHalfB = rank(formData.halftimeTeamBGoals);
    const halftimeWinner =
      actualHalfA > actualHalfB ? 'A' : actualHalfA < actualHalfB ? 'B' : 'TIE';

    for (const pred of predictions) {
      // ---- Final score (result 30 + each team's goals 10, all independent) ----
      const predFinalWinner =
        rank(pred.pred_final_team_a_goals) > rank(pred.pred_final_team_b_goals)
          ? 'A'
          : rank(pred.pred_final_team_a_goals) < rank(pred.pred_final_team_b_goals)
          ? 'B'
          : 'TIE';

      const finalResultPts = predFinalWinner === finalWinner ? 30 : 0;
      const finalTeamAPts = pred.pred_final_team_a_goals === formData.finalTeamAGoals ? 10 : 0;
      const finalTeamBPts = pred.pred_final_team_b_goals === formData.finalTeamBGoals ? 10 : 0;
      const finalPts = finalResultPts + finalTeamAPts + finalTeamBPts;

      // ---- Halftime score (same point values as final) ----
      const predHalftimeWinner =
        rank(pred.pred_halftime_team_a_goals) > rank(pred.pred_halftime_team_b_goals)
          ? 'A'
          : rank(pred.pred_halftime_team_a_goals) < rank(pred.pred_halftime_team_b_goals)
          ? 'B'
          : 'TIE';

      const halftimeResultPts = predHalftimeWinner === halftimeWinner ? 30 : 0;
      const halftimeTeamAPts = pred.pred_halftime_team_a_goals === formData.halftimeTeamAGoals ? 10 : 0;
      const halftimeTeamBPts = pred.pred_halftime_team_b_goals === formData.halftimeTeamBGoals ? 10 : 0;
      const halftimePts = halftimeResultPts + halftimeTeamAPts + halftimeTeamBPts;

      // ---- Tiebreakers (correct / not correct, no point value) ----
      const yellowCorrect = pred.pred_yellow_cards_range === formData.yellowCardsRange;
      const penaltyCorrect = pred.pred_penalty_kicks === formData.penaltyKicks;
      const redCorrect = pred.pred_red_card === formData.redCard;
      const kickoffCorrect = pred.pred_starting_possession === formData.startingPossession;

      await supabase.from('scores').insert([
        {
          prediction_id: pred.id,
          user_id: pred.user_id,
          match_id: matchId,
          final_result_pts: finalResultPts,
          final_team_a_pts: finalTeamAPts,
          final_team_b_pts: finalTeamBPts,
          final_pts: finalPts,
          halftime_result_pts: halftimeResultPts,
          halftime_team_a_pts: halftimeTeamAPts,
          halftime_team_b_pts: halftimeTeamBPts,
          halftime_pts: halftimePts,
          yellow_correct: yellowCorrect,
          penalty_correct: penaltyCorrect,
          red_correct: redCorrect,
          kickoff_correct: kickoffCorrect,
        },
      ]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('matches')
        .update({
          final_team_a_goals: formData.finalTeamAGoals,
          final_team_b_goals: formData.finalTeamBGoals,
          halftime_team_a_goals: formData.halftimeTeamAGoals,
          halftime_team_b_goals: formData.halftimeTeamBGoals,
          has_penalty_kicks: formData.penaltyKicks,
          has_red_card: formData.redCard,
          yellow_cards_range: formData.yellowCardsRange,
          starting_possession_team: formData.startingPossession,
          is_closed: true,
        })
        .eq('id', matchId);

      if (error) throw error;

      await calculateScores();

      setMessage('Salvo. Classificação recalculada.');
      // Refresh local match state but stay on the page so you can keep updating live.
      await loadMatch();
    } catch (err: any) {
      setMessage('Erro: ' + err.message);
    }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    setDeleteMessage('');

    // Cascade removes this match's predictions and scores automatically.
    const { error } = await supabase.from('matches').delete().eq('id', matchId);

    if (error) {
      setDeleteMessage('Erro: ' + error.message);
      setDeleting(false);
    } else {
      router.push('/dashboard');
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  if (!match) return <div className="flex justify-center items-center h-screen">Jogo não encontrado</div>;

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
        <p className="text-gray-600 mb-8">Jogo nº {match.match_number}</p>

        {match.is_closed && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-8">
            Um resultado já foi lançado. Você pode atualizá-lo ao vivo — a classificação
            é recalculada cada vez que você salva.
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-semibold mb-6">Resultado do jogo</h2>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Final: gols do {match.team_a}</label>
              <select
                name="finalTeamAGoals"
                value={formData.finalTeamAGoals}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FINAL_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Final: gols do {match.team_b}</label>
              <select
                name="finalTeamBGoals"
                value={formData.finalTeamBGoals}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FINAL_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">1º tempo: gols do {match.team_a}</label>
              <select
                name="halftimeTeamAGoals"
                value={formData.halftimeTeamAGoals}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {HALFTIME_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">1º tempo: gols do {match.team_b}</label>
              <select
                name="halftimeTeamBGoals"
                value={formData.halftimeTeamBGoals}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {HALFTIME_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                name="penaltyKicks"
                checked={formData.penaltyKicks}
                onChange={handleChange}
                className="w-4 h-4 cursor-pointer"
              />
              <label className="ml-3 text-sm font-medium">Teve pênalti</label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="redCard"
                checked={formData.redCard}
                onChange={handleChange}
                className="w-4 h-4 cursor-pointer"
              />
              <label className="ml-3 text-sm font-medium">Teve cartão vermelho</label>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Total de cartões amarelos</label>
              <select
                name="yellowCardsRange"
                value={formData.yellowCardsRange}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {YELLOW_RANGES.map((r) => <option key={r} value={r}>{r} cartões</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Quem deu o pontapé inicial</label>
              <select
                name="startingPossession"
                value={formData.startingPossession}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="A">{match.team_a}</option>
                <option value="B">{match.team_b}</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : match.is_closed ? 'Atualizar resultado' : 'Salvar resultado'}
          </button>

          {message && (
            <p className={`mt-4 text-center ${message.includes('Erro') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </p>
          )}
        </form>

        {/* Zona de perigo: apagar o jogo e tudo relacionado a ele */}
        <div className="bg-white rounded-lg shadow-md p-8 mt-8 border border-red-300">
          <h2 className="text-xl font-semibold text-red-700 mb-2">Zona de perigo</h2>
          <p className="text-sm text-gray-600 mb-4">
            Apagar este jogo remove permanentemente o jogo e <strong>todos os palpites e
            pontuações</strong> relacionados a ele. Esta ação não pode ser desfeita. Para
            confirmar, digite <span className="font-mono font-semibold">DELETE</span> abaixo.
          </p>

          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
            className="w-full px-4 py-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
          />

          <button
            onClick={handleDelete}
            disabled={deleteConfirm !== 'DELETE' || deleting}
            className="w-full bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? 'Apagando...' : 'Apagar este jogo'}
          </button>

          {deleteMessage && <p className="mt-4 text-center text-red-600">{deleteMessage}</p>}
        </div>
      </main>
    </div>
  );
}
