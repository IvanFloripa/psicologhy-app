import React, { useState } from 'react';
import './App.css'; // Ou App.css

function App() {
  const [clinicalNote, setClinicalNote] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const backendUrl = 'http://localhost:3005'; // URL do seu backend Node.js

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAnalysisResult(null);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/analyze-clinical-note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: clinicalNote }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Something went wrong with the analysis.');
      }

      const data = await response.json();
      setAnalysisResult(data);

    } catch (err) {
      console.error("Error during analysis:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Análise de Notas Clínicas com IA</h1>
      </header>
      <main className="App-main">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="clinicalNote">Insira a Nota Clínica:</label>
            <textarea
              id="clinicalNote"
              value={clinicalNote}
              onChange={(e) => setClinicalNote(e.target.value)}
              rows="10"
              placeholder="Ex: 'O paciente relatou fadiga extrema, dificuldade para dormir e perda de interesse em atividades que antes gostava. Mencionou sentir-se sem esperança em relação ao futuro.'"
              required
            ></textarea>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Analisando...' : 'Analisar Nota'}
          </button>
        </form>

        {error && <div className="error-message">Erro: {error}</div>}

        {analysisResult && (
          <div className="analysis-results">
            <h2>Resultados da Análise:</h2>

            {analysisResult.transtornos_humor && analysisResult.transtornos_humor.length > 0 ? (
              <>
                <h3>Transtornos de Humor:</h3>
                <ul>
                  {analysisResult.transtornos_humor.map((item, index) => (
                    <li key={`th-${index}`}>
                      <strong>Indicador:</strong> {item.indicador} <br />
                      <strong>Evidência:</strong> "{item.evidencia_linguistica}" <br />
                      <strong>Interpretação:</strong> {item.interpretacao}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Nenhum indicador de transtorno de humor detectado.</p>
            )}

            {analysisResult.risco_suicida && analysisResult.risco_suicida.length > 0 ? (
              <>
                <h3>Risco Suicida:</h3>
                <ul>
                  {analysisResult.risco_suicida.map((item, index) => (
                    <li key={`rs-${index}`}>
                      <strong>Indicador:</strong> {item.indicador} <br />
                      <strong>Evidência:</strong> "{item.evidencia_linguistica}" <br />
                      <strong>Interpretação:</strong> {item.interpretacao}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Nenhum indicador de risco suicida detectado.</p>
            )}

            {analysisResult.observacoes_gerais && analysisResult.observacoes_gerais.length > 0 && (
                <>
                  <h3>Observações Gerais:</h3>
                  <p>{analysisResult.observacoes_gerais}</p>
                </>
            )}

          </div>
        )}
      </main>
    </div>
  );
}

export default App;