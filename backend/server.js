require('dotenv').config(); // Carrega variáveis de ambiente do .env

// 🔥 Polyfills para Node.js compatível com Vertex AI SDK
const fetch = require('node-fetch');
global.fetch = fetch;
global.Headers = fetch.Headers;
global.Request = fetch.Request;
global.Response = fetch.Response;

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { VertexAI } = require('@google-cloud/vertexai');

const app = express();
const port = process.env.PORT || 3005;

// --- CARREGAMENTO DA CHAVE JSON ---
let credentials;
let projectId;
const keyFilePath = path.join(__dirname, 'admin-key1.json');

try {
    const keyFileContent = fs.readFileSync(keyFilePath, 'utf8');
    credentials = JSON.parse(keyFileContent);
    projectId = credentials.project_id;
    console.log('Credenciais carregadas com sucesso de:', keyFilePath);
    console.log('Project ID extraído do JSON:', projectId);
} catch (err) {
    console.error('ERRO: Não foi possível carregar ou parsear o arquivo de credenciais:', err.message);
    console.error('Caminho esperado do arquivo:', keyFilePath);
    process.exit(1);
}

// --- CONFIG VERTEX AI ---
const project = process.env.GOOGLE_CLOUD_PROJECT || projectId;
const location = 'us-central1'; // Regiões válidas: us-central1, europe-west4 etc.
console.log('--- DEPURANDO CREDENCIAIS ---');
console.log('Project ID:', project);
console.log('Região:', location);
console.log('--------------------------------');

// ⚠️ ATUALIZE ESTE NOME SE NECESSÁRIO
const model = 'gemini-2.0-flash-lite-001';

const vertex_ai = new VertexAI({ project, location });
const generativeModel = vertex_ai.getGenerativeModel({
    model,
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
app.use(express.json());

app.post('/analyze-clinical-note', async (req, res) => {
    const { note } = req.body;

    if (!note) {
        return res.status(400).json({ error: 'Clinical note is required.' });
    }

    try {
        const prompt = `Analise a seguinte nota clínica, identificando padrões de linguagem que possam indicar transtornos de humor (depressão, ansiedade) ou risco suicida. Para cada indicador, descreva a evidência linguística e sua possível interpretação. Responda em formato JSON com as seguintes chaves: "transtornos_humor": [], "risco_suicida": [], "observacoes_gerais": "".
Se não houver indicadores claros, os arrays devem estar vazios.

Exemplo de formato de saída esperado para um indicador:
{ "indicador": "Depressão", "evidencia_linguistica": "uso frequente de 'sem esperança', 'triste'", "interpretacao": "linguagem pessimista, desespero" }

Nota clínica:
"${note}"`;

        const parts = [{ text: prompt }];

        const result = await generativeModel.generateContent({
            contents: [{ role: 'user', parts }]
        });
        console.log('Resposta completa do modelo:', result.response.candidates[0].content.parts[0].text);
        const responseText = result.response.candidates[0].content.parts[0].text;

        // 👇 Sanitização da resposta
        let cleanText = responseText.trim();

        // Remove blocos markdown ```json ... ```
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/```(?:json)?\n?/i, '').replace(/```$/, '');
        }

        // Remove prefixo tipo 'json\n'
        if (cleanText.toLowerCase().startsWith('json')) {
            cleanText = cleanText.replace(/^json\s*/i, '');
        }

        const parsedResponse = JSON.parse(cleanText);
        res.json(parsedResponse);

    } catch (error) {
        console.error('--- ERRO AO ANALISAR NOTA ---');
        console.error(error);

        return res.status(500).json({
            error: 'Failed to analyze clinical note.',
            details: error.message,
            fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
        });
    }
});

app.listen(port, () => {
    console.log(`Servidor backend rodando em http://localhost:${port}`);
});
