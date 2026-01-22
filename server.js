const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Conexão MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://Funchal:Funchal*123@sitefunchal.ouk1vxr.mongodb.net/quiz')
.then(() => console.log('✅ MongoDB conectado'))
.catch(err => console.error('❌ Erro MongoDB:', err.message));

// Schema
const userSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, required: true },
    cargo: { type: String, required: true },
    telefone: { type: String, required: true },
    administradora: { type: String, required: true },
    estado: { type: String, required: true },
    cidade: { type: String, required: true },
    produtos: [String],
    outros: String,
    respostas: [{
        pergunta: String,
        resposta: String,
        correta: Boolean
    }],
    pontuacao: { type: Number, default: 0 },
    tempo: { type: Number, default: 0 }, // Tempo em segundos
    dataRegistro: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Rotas
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        message: 'API Quiz Funchal rodando!',
        version: '1.0.0'
    });
});

app.post('/api/users', async (req, res) => {
    try {
        console.log('📨 Criando usuário...');
        const user = new User(req.body);
        await user.save();
        console.log('✅ Usuário criado:', user._id);
        res.status(201).json({ 
            success: true, 
            userId: user._id,
            message: 'Usuário registrado' 
        });
    } catch (error) {
        console.error('❌ Erro:', error.message);
        res.status(400).json({ 
            success: false, 
            message: error.message 
        });
    }
});

app.put('/api/users/:id/respostas', async (req, res) => {
    try {
        const { respostas, pontuacao, tempo } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { respostas, pontuacao, tempo },
            { new: true }
        );
        console.log('✅ Respostas salvas:', user._id, '- Pontos:', pontuacao, '- Tempo:', tempo);
        res.json({ success: true, user });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find().sort({ dataRegistro: -1 });
        res.json({ success: true, users, total: users.length });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 🏆 ROTAS DE RANKING

// GET - Buscar ranking/resultados
app.get('/api/results', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 0;
        
        // Busca usuários que completaram o quiz (têm pontuação)
        const results = await User.find({ pontuacao: { $gt: 0 } })
            .sort({ pontuacao: -1, tempo: 1 }) // Ordena: maior pontuação, menor tempo
            .limit(limit)
            .select('nome email pontuacao tempo dataRegistro'); // Seleciona apenas campos necessários
        
        console.log(`📊 Ranking solicitado - ${limit ? `Top ${limit}` : 'Completo'} - ${results.length} resultados`);
        
        res.json(results);
    } catch (error) {
        console.error('❌ Erro ao buscar ranking:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST - Salvar resultado no ranking
app.post('/api/results', async (req, res) => {
    try {
        const { nome, email, telefone, cargo, administradora, cidade, estado, score, tempo } = req.body;
        
        console.log('💾 Salvando resultado:', nome, '-', score, 'acertos -', tempo, 'segundos');
        
        // Cria um novo usuário COM pontuação (para o ranking)
        const user = new User({
            nome,
            email,
            telefone,
            cargo,
            administradora,
            cidade,
            estado,
            pontuacao: score,
            tempo: tempo
        });
        
        await user.save();
        console.log('✅ Resultado salvo no ranking:', user._id);
        
        res.status(201).json({ 
            success: true, 
            id: user._id 
        });
    } catch (error) {
        console.error('❌ Erro ao salvar resultado:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API rodando na porta ${PORT}`);
});
