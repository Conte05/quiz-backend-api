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
    servicosSelecionados: [String],
    respostas: [{
        pergunta: String,
        resposta: String,
        correta: Boolean
    }],
    pontuacao: { type: Number, default: 0 },
    tempo: { type: Number, default: 0 },
    dataRegistro: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Rotas
app.get('/api/status', (req, res) => {
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
        const { respostas, pontuacao, tempo, servicosSelecionados } = req.body;
        const updateData = { respostas, pontuacao, tempo };
        if (servicosSelecionados) {
            updateData.servicosSelecionados = servicosSelecionados;
        }
        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
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

// 📥 Exportar dados como CSV (planilha)
app.get('/api/export', async (req, res) => {
    try {
        const users = await User.find().sort({ dataRegistro: -1 });

        // Cabeçalho CSV
        const header = 'Nome,Email,Cargo,Telefone,Administradora,Cidade,Estado,Produtos,Servicos Selecionados,Resposta P1,Resposta P2,Resposta P3,Resposta P4,Resposta P5,Resposta P6,Resposta P7,Resposta P8,Resposta P9,Resposta P10,Resposta P11,Resposta P12,Resposta P13,Resposta P14,Resposta P15,Resposta P16,Resposta P17,Resposta P18,Data Registro';

        const rows = users.map(u => {
            const produtos = (u.produtos || []).join(' | ');
            const servicos = (u.servicosSelecionados || []).join(' | ');
            const data = u.dataRegistro ? new Date(u.dataRegistro).toLocaleString('pt-BR') : '';

            // Escapa campos com vírgula ou aspas
            const esc = (val) => {
                const s = String(val || '');
                return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
            };

            const respostaCols = Array.from({ length: 18 }, (_, i) => {
                const r = (u.respostas || [])[i];
                return r ? esc(r.resposta) : '';
            });

            return [
                esc(u.nome), esc(u.email), esc(u.cargo), esc(u.telefone),
                esc(u.administradora), esc(u.cidade), esc(u.estado),
                esc(produtos), esc(servicos), ...respostaCols,
                esc(data)
            ].join(',');
        });

        const csv = '\uFEFF' + header + '\n' + rows.join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=quiz-participantes.csv');
        res.send(csv);

        console.log(`📥 Exportação CSV - ${users.length} registros`);
    } catch (error) {
        console.error('❌ Erro na exportação:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API rodando na porta ${PORT}`);
    console.log(`📍 Rotas disponíveis:`);
    console.log(`   GET  /api/users - Listar usuários`);
    console.log(`   POST /api/users - Criar usuário`);
    console.log(`   PUT  /api/users/:id/respostas - Salvar respostas`);
});
