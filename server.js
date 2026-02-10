const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

const path = require('path');

// SERVIR A PASTA DO FRONT (onde estão images, styles, js, etc.)
app.use(express.static(path.join(__dirname)));

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
        version: '2.0.0'
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

// 🔍 NOVA ROTA - Buscar usuário existente por múltiplos campos
app.get('/api/results/find', async (req, res) => {
    try {
        const { nome, telefone, email, cargo } = req.query;
        
        console.log('🔍 Buscando usuário:', { nome, telefone, email, cargo });
        
        // Busca com prioridade: nome, telefone, email, cargo
        let user = null;
        
        // 1. Tenta buscar por nome primeiro
        if (nome) {
            user = await User.findOne({ nome: { $regex: new RegExp(`^${nome.trim()}$`, 'i') } })
                .sort({ dataRegistro: -1 }); // Pega o mais recente
        }
        
        // 2. Se não achou por nome, tenta por telefone
        if (!user && telefone) {
            const cleanPhone = telefone.replace(/\D/g, '');
            user = await User.findOne({ telefone: { $regex: new RegExp(cleanPhone) } })
                .sort({ dataRegistro: -1 });
        }
        
        // 3. Se não achou, tenta por email
        if (!user && email) {
            user = await User.findOne({ email: email.toLowerCase().trim() })
                .sort({ dataRegistro: -1 });
        }
        
        // 4. Por último, tenta por cargo
        if (!user && cargo) {
            user = await User.findOne({ cargo: { $regex: new RegExp(`^${cargo.trim()}$`, 'i') } })
                .sort({ dataRegistro: -1 });
        }
        
        if (user) {
            console.log('✅ Usuário encontrado:', user._id, '-', user.nome, '- Pontuação:', user.pontuacao, '- Tempo:', user.tempo);
        } else {
            console.log('ℹ️ Usuário não encontrado');
        }
        
        res.json(user);
    } catch (error) {
        console.error('❌ Erro ao buscar usuário:', error.message);
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

// 🔄 NOVA ROTA - Atualizar resultado existente
app.put('/api/results/:id', async (req, res) => {
    try {
        const { nome, email, telefone, cargo, administradora, cidade, estado, score, tempo } = req.body;
        
        console.log('🔄 Atualizando resultado:', req.params.id, '-', score, 'acertos -', tempo, 'segundos');
        
        // Atualiza o usuário existente com novo resultado
        const user = await User.findByIdAndUpdate(
            req.params.id,
            {
                nome,
                email,
                telefone,
                cargo,
                administradora,
                cidade,
                estado,
                pontuacao: score,
                tempo: tempo,
                dataRegistro: new Date()
            },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }
        
        console.log('✅ Resultado atualizado:', user._id, '-', user.nome, '- Nova pontuação:', user.pontuacao, '- Tempo:', user.tempo);
        
        res.json({ 
            success: true, 
            id: user._id,
            user: user 
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar resultado:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 🔄 NOVA ROTA - Resetar usuário (zera tempo e pontuação para retry)
app.put('/api/results/:id/reset', async (req, res) => {
    try {
        console.log('🔄 Resetando usuário:', req.params.id);
        
        // Reseta tempo e pontuação do usuário
        const user = await User.findByIdAndUpdate(
            req.params.id,
            {
                pontuacao: 0,
                tempo: 0,
                dataRegistro: new Date()
            },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }
        
        console.log('✅ Usuário resetado:', user._id, '-', user.nome, '- Tempo: 0 - Pontuação: 0');
        
        res.json({ 
            success: true, 
            id: user._id,
            user: user 
        });
    } catch (error) {
        console.error('❌ Erro ao resetar usuário:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API rodando na porta ${PORT}`);
    console.log(`📍 Rotas disponíveis:`);
    console.log(`   GET  /api/results - Buscar ranking`);
    console.log(`   GET  /api/results/find - Buscar usuário existente`);
    console.log(`   POST /api/results - Criar novo resultado`);
    console.log(`   PUT  /api/results/:id - Atualizar resultado`);
    console.log(`   PUT  /api/results/:id/reset - Resetar usuário (retry)`);
});

