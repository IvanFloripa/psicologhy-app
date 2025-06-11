require('dotenv').config(); // Carrega variáveis de ambiente do .env
const express = require('express');
const path = require('path'); // Importe o módulo 'path'
const fs = require('fs');     // Importe o módulo 'fs
const cors = require('cors');
const { VertexAI } = require('@google-cloud/vertexai');

const app = express();
const port = process.env.PORT || 3005;
// --- CARREGAMENTO EXPLÍCITO DA CHAVE JSON ---
let credentials;
let projectId;
const keyFilePath = path.join(__dirname, 'key.json'); // Ajuste 'minha-chave.json' para o nome exato do seu arquivo

try {
    const keyFileContent = fs.readFileSync(keyFilePath, 'utf8');
    credentials = JSON.parse(keyFileContent);
    projectId = credentials.project_id; // O Project ID está dentro do JSON
    console.log('Credenciais carregadas com sucesso de:', keyFilePath);
    console.log('Project ID extraído do JSON:', projectId);
} catch (err) {
    console.error('ERRO: Não foi possível carregar ou parsear o arquivo de credenciais:', err.message);
    console.error('Caminho esperado do arquivo:', keyFilePath);
    // Saia do processo se as credenciais não puderem ser carregadas, pois é fatal.
    process.exit(1);
}
// --- FIM DO CARREGAMENTO EXPLÍCITO ---
// Configura o Vertex AI
// Certifique-se que GOOGLE_APPLICATION_CREDENTIALS está setado no seu ambiente
const project = process.env.GOOGLE_CLOUD_PROJECT || 'your-gcp-project-id'; // Substitua pelo seu ID do projeto GCP
const location = 'us-central1'; // Exemplo: 'us-central1', 'southamerica-east1'

// AQUI: Adicione estes logs, APÓS o dotenv.config()
console.log('--- DEPURANDO CREDENCIAIS ANTES DE INSTANCIAR VERTEXAI ---');
console.log('Caminho das Credenciais (process.env.GOOGLE_APPLICATION_CREDENTIALS):', process.env.GOOGLE_APPLICATION_CREDENTIALS);
console.log('Project ID (process.env.GOOGLE_CLOUD_PROJECT):', process.env.GOOGLE_CLOUD_PROJECT);
console.log('Região (location):', location); // Certifique-se que 'location' está definido antes
console.log('---------------------------------------------------------');

const vertex_ai = new VertexAI({ project: project, location: location });
const model = 'gemini-1.5-flash-preview-0514'; // Ou 'gemini-pro', 'gemini-1.0-pro'
const generativeModel = vertex_ai.getGenerativeModel({ // <-- No space between 'get' and 'GenerativeModel'
    model: model,
    generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.2,
        topP: 0.9,
        topK: 40
    },
    safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
    ],
});

app.use(cors());
app.use(express.json()); // Para parsear o corpo das requisições JSON

// Rota de análise NLP
app.post('/analyze-clinical-note', async (req, res) => {
    const { note } = req.body;

    if (!note) {
        return res.status(400).json({ error: 'Clinical note is required.' });
    }

    try {
        // --- Prompt Engineering: A arte de criar instruções para o LLM ---
        // Este é o coração da análise. Seja o mais específico possível.
        const prompt = `Analise a seguinte nota clínica, identificando padrões de linguagem que possam indicar transtornos de humor (depressão, ansiedade) ou risco suicida. Para cada indicador, descreva a evidência linguística e sua possível interpretação. Responda em formato JSON com as seguintes chaves: "transtornos_humor": [], "risco_suicida": [], "observacoes_gerais": "".
        Se não houver indicadores claros, os arrays devem estar vazios.

        Exemplo de formato de saída esperado para um indicador:
        { "indicador": "Depressão", "evidencia_linguistica": "uso frequente de 'sem esperança', 'triste'", "interpretacao": "linguagem pessimista, desespero" }

        Nota clínica:
        "${note}"
        `;

        const parts = [{ text: prompt }];

        const result = await generativeModel.generateContent({ contents: [{ role: 'user', parts }] });
        const responseText = result.response.candidates[0].content.parts[0].text;

        // Tenta parsear a resposta como JSON
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse LLM response as JSON:', responseText, parseError);
            // Se o LLM não responder em JSON, podemos retornar a resposta bruta ou um erro formatado.
            return res.status(500).json({ error: 'Failed to parse AI response.', rawResponse: responseText });
        }

        res.json(parsedResponse);

    } catch (error) {
        console.error('Error calling Vertex AI:', error.message);
        // Em um ambiente de produção, você não exporia detalhes de erro internos.
        res.status(500).json({ error: 'Failed to analyze clinical note.', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
});