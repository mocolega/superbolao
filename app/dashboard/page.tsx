'use client';

import { useEffect, useState } from 'react';
import { supabase, formatKickoff, isBettingClosed } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Match {
  id: string;
  match_number: number;
  team_a: string;
  team_b: string;
  kickoff_time: string;
  is_closed: boolean;
  final_team_a_goals?: string;
  final_team_b_goals?: string;
}

export default function DashboardPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [myName, setMyName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');

  const [showRules, setShowRules] = useState(false);

  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/');
      return;
    }
    setUser(session.user);

    const { data: userData } = await supabase
      .from('users')
      .select('is_admin, name')
      .eq('id', session.user.id)
      .single();

    setIsAdmin(userData?.is_admin || false);
    setMyName(userData?.name || '');
    setNameInput(userData?.name || '');

    const { data: matchesData } = await supabase
      .from('matches')
      .select('*')
      .order('kickoff_time', { ascending: true });

    setMatches(matchesData || []);
    setLoading(false);
  };

  const saveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameMessage('Digite um nome.');
      return;
    }
    setSavingName(true);
    setNameMessage('');

    const { error } = await supabase.from('users').update({ name: trimmed }).eq('id', user.id);

    if (error) {
      setNameMessage('Erro: ' + error.message);
    } else {
      setMyName(trimmed);
      setEditingName(false);
    }
    setSavingName(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Carregando...</div>;

  // Primeiro acesso: sem nome ainda -> exige um nome antes de mostrar qualquer coisa.
  if (!myName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="bg-white rounded-lg shadow-lg p-8 w-96">
          <h1 className="text-2xl font-bold text-center mb-2">⚽ Bem-vindo!</h1>
          <p className="text-center text-gray-600 mb-6">
            Escolha um nome para começar. É o que os outros veem na classificação e nos
            palpites — seu e-mail nunca aparece.
          </p>

          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName();
            }}
            placeholder="ex.: Diego"
            maxLength={40}
            autoFocus
            className="w-full px-4 py-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={saveName}
            disabled={savingName}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {savingName ? 'Salvando...' : 'Continuar'}
          </button>

          {nameMessage && <p className="mt-4 text-center text-sm text-red-600">{nameMessage}</p>}

          <button onClick={handleLogout} className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700">
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">⚽ Super Bolão da Copa</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">{myName}</span>
            {isAdmin && <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">Admin</span>}
            <button
              onClick={() => setShowRules(true)}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50"
            >
              Regras
            </button>
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {editingName ? (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-2">Editar seu nome</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={40}
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={saveName}
                disabled={savingName}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {savingName ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => {
                  setNameInput(myName);
                  setEditingName(false);
                  setNameMessage('');
                }}
                className="px-4 py-2 rounded-lg border hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
            {nameMessage && <p className="mt-3 text-sm text-red-600">{nameMessage}</p>}
          </div>
        ) : (
          <div className="mb-8 text-sm text-gray-600">
            Jogando como <span className="font-semibold">{myName}</span>{' '}
            <button onClick={() => setEditingName(true)} className="text-blue-600 hover:text-blue-800 ml-2">
              Editar
            </button>
          </div>
        )}

        {isAdmin ? (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Painel do administrador</h2>
            <Link href="/admin/create-match">
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-semibold">
                + Criar novo jogo
              </button>
            </Link>
          </div>
        ) : (
          <div className="mb-8">
            <h2 className="text-2xl font-bold">🎯 Faça seus palpites</h2>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => {
            const hasResult =
              match.final_team_a_goals !== null && match.final_team_a_goals !== undefined;
            const bettingClosed = match.is_closed || isBettingClosed(match.kickoff_time);

            return (
              <div key={match.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                <div className="text-sm text-gray-500 mb-2">Jogo nº {match.match_number}</div>

                <div className="text-center mb-4">
                  <div className="text-xl font-bold">{match.team_a}</div>
                  <div className="text-gray-500 my-2">x</div>
                  <div className="text-xl font-bold">{match.team_b}</div>
                </div>

                {hasResult ? (
                  <div className="bg-green-50 p-3 rounded mb-4 text-center">
                    <div className="text-2xl font-bold">
                      {match.final_team_a_goals} - {match.final_team_b_goals}
                    </div>
                    <div className="text-sm text-gray-600">Placar atual</div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 mb-4">{formatKickoff(match.kickoff_time)}</div>
                )}

                {isAdmin ? (
                  <Link href={`/admin/match/${match.id}`}>
                    <button className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                      {match.is_closed ? 'Editar resultado' : 'Lançar resultado'}
                    </button>
                  </Link>
                ) : bettingClosed ? (
                  <button disabled className="w-full bg-gray-400 text-white px-4 py-2 rounded cursor-not-allowed">
                    Palpites encerrados
                  </button>
                ) : (
                  <Link href={`/predict/${match.id}`}>
                    <button className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                      Fazer palpite
                    </button>
                  </Link>
                )}

                <Link href={`/predictions/${match.id}`}>
                  <button className="w-full mt-2 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
                    Ver todos os palpites
                  </button>
                </Link>
                <Link href={`/leaderboard/${match.id}`}>
                  <button className="w-full mt-1 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
                    🏆 Classificação
                  </button>
                </Link>
              </div>
            );
          })}
        </div>
      </main>

      {/* Modal de regras */}
      {showRules && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowRules(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold">📋 Regras do Super Bolão da Copa</h2>
              <button
                onClick={() => setShowRules(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-6 text-gray-700">
              <section>
                <h3 className="font-semibold text-gray-900 mb-2">Como funciona</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Em cada jogo você dá um palpite único — não é permitido repetir exatamente o mesmo palpite de outra pessoa no mesmo jogo. Quem registrar primeiro garante a combinação.</li>
                  <li>Os palpites fecham 30 minutos antes do início de cada jogo (horário de Brasília).</li>
                  <li>Cada jogo tem a sua própria classificação.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">Pontuação — Placar final</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Acertar o resultado (vitória ou empate): <strong>30 pontos</strong></li>
                  <li>Acertar os gols do primeiro time: <strong>10 pontos</strong></li>
                  <li>Acertar os gols do segundo time: <strong>10 pontos</strong></li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">Pontuação — Primeiro tempo</h3>
                <p className="text-sm mb-2">Mesma pontuação do placar final:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Acertar o resultado: <strong>30 pontos</strong></li>
                  <li>Acertar os gols do primeiro time: <strong>10 pontos</strong></li>
                  <li>Acertar os gols do segundo time: <strong>10 pontos</strong></li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">Critérios de desempate (nesta ordem)</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Pontos do placar final</li>
                  <li>Pontos do primeiro tempo</li>
                  <li>Acertar o total de cartões amarelos</li>
                  <li>Acertar se vai ter pênalti</li>
                  <li>Acertar se vai ter cartão vermelho</li>
                  <li>Acertar quem dá o pontapé inicial</li>
                </ol>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">🏆 Premiação</h3>
                <ul className="space-y-1 text-sm">
                  <li>🥇 1º lugar: <strong>70%</strong> do prêmio</li>
                  <li>🥈 2º lugar: <strong>20%</strong> do prêmio</li>
                  <li>🥉 3º lugar: <strong>10%</strong> do prêmio</li>
                </ul>
              </section>
            </div>

            
              <section>
                <h3 className="font-semibold text-gray-900 mb-2">Valor da aposta</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Valor da aposta por jogo: <strong>R$ 20,00</strong></li>
                  <li>Caso ocorra empate entre dois apostadores na primeira colocação, o total de 90% do prêmio será dividido igualmente entre eles, e o restante (10%) será destinado ao terceiro colocado. Não haverá segundo colocado nesse cenário.</li>
                  <li>Caso ocorra empate de três ou mais apostadores na primeira colocação, o total de 100% do prêmio será dividido igualmente entre eles, e não haverá segundo ou terceiro colocado.</li>
                  <li>O mesmo vale para empates entre dois ou mais apostadores para a segunda e terceira colocação.</li>
                </ol>
              </section>

            <div className="px-6 py-4 border-t sticky bottom-0 bg-white">
              <button
                onClick={() => setShowRules(false)}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
