const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Configurações
const PORT = 3000;
const VER_JSON_COMPLETO = true; // Mude para false se o terminal ficar muito cheio

// Cores para o Terminal
const C = {
    RESET: "\x1b[0m",
    ENVIADO: "\x1b[32m", // Verde
    RECEBIDO: "\x1b[36m", // Ciano
    ERRO: "\x1b[31m",    // Vermelho
    INFO: "\x1b[33m"     // Amarelo
};

const wss = new WebSocket.Server({ port: PORT });

console.log(`${C.INFO}\n=== SUPER DEBUGGER WS INICIADO NA PORTA ${PORT} ===${C.RESET}`);
console.log(`${C.INFO}No Minecraft: /connect localhost:${PORT}${C.RESET}\n`);

wss.on('connection', async (ws) => {
    console.log(`${C.INFO}⚡ Cliente conectado! Iniciando protocolo...${C.RESET}`);

    // Mapa para guardar os pedidos pendentes (ID -> Função de Resolução)
    const pendingRequests = new Map();

    // --- FUNÇÃO DE ENVIO (LOG + SEND) ---
    const sendPacket = (packet) => {
        const jsonStr = JSON.stringify(packet);
        
        if (VER_JSON_COMPLETO) {
            console.log(`${C.ENVIADO}⬆️ [ENVIANDO] --------------------------------${C.RESET}`);
            console.log(JSON.stringify(packet, null, 2));
        } else {
            console.log(`${C.ENVIADO}⬆️ Enviando: ${packet.header.messagePurpose} (${packet.header.requestId})${C.RESET}`);
        }
        
        ws.send(jsonStr);
    };

    // --- FUNÇÃO PARA RODAR COMANDO COM AWAIT ---
    // Isso aqui é a "Robustez". Ele cria uma promessa e espera o jogo responder.
    const runCommand = (commandLine) => {
        return new Promise((resolve, reject) => {
            const requestId = uuidv4();
            
            // Guarda a promessa para resolver quando a resposta chegar
            pendingRequests.set(requestId, { resolve, reject });

            const packet = {
                header: {
                    requestId: requestId,
                    messagePurpose: "commandRequest",
                    version: 1,
                    messageType: "commandRequest"
                },
                body: {
                    origin: { type: "player" },
                    commandLine: commandLine,
                    version: 1
                }
            };

            sendPacket(packet);
        });
    };

    // --- OUVINTE DE MENSAGENS ---
    ws.on('message', (data) => {
        try {
            const res = JSON.parse(data);
            
            // Log do Recebimento
            if (VER_JSON_COMPLETO) {
                console.log(`${C.RECEBIDO}⬇️ [RECEBIDO] --------------------------------${C.RESET}`);
                console.log(JSON.stringify(res, null, 2));
            }

            // Tratamento de Erros do Jogo
            if (res.header.messagePurpose === 'error') {
                console.log(`${C.ERRO}❌ ERRO DO JOGO: ${res.body.statusMessage}${C.RESET}`);
            }

            // Se for resposta de comando, resolve a promessa
            if (res.header.messagePurpose === 'commandResponse') {
                const id = res.header.requestId;
                if (pendingRequests.has(id)) {
                    const { resolve, reject } = pendingRequests.get(id);
                    
                    if (res.body.statusCode === 0) {
                        resolve(res.body); // Sucesso
                    } else {
                        console.log(`${C.ERRO}⚠️ Comando falhou logicamente: ${res.body.statusMessage}${C.RESET}`);
                        resolve(res.body); // Resolve mesmo com erro pra não travar o script
                    }
                    pendingRequests.delete(id);
                }
            }

        } catch (e) {
            console.log(`${C.ERRO}Erro ao processar JSON: ${e.message}${C.RESET}`);
        }
    });

    ws.on('close', () => console.log(`${C.ERRO}🔌 Conexão fechada.${C.RESET}`));
    ws.on('error', (e) => console.log(`${C.ERRO}🔥 Erro de Socket: ${e.message}${C.RESET}`));

    // --- LÓGICA PRINCIPAL (O CÉREBRO) ---
    try {
        console.log(`${C.INFO}🔒 Realizando Handshake (Subscribe)...${C.RESET}`);
        
        // 1. Enviar Subscribe Manualmente (não usamos o runCommand pq não é um comando slash)
        const subId = uuidv4();
        sendPacket({
            header: {
                requestId: subId,
                messagePurpose: "subscribe",
                version: 1,
                messageType: "commandRequest"
            },
            body: { eventName: "PlayerMessage" }
        });

        // Esperar um pouco para garantir que o subscribe foi
        await new Promise(r => setTimeout(r, 1000));
        console.log(`${C.INFO}✅ Handshake enviado. Começando testes...${C.RESET}`);

        // 2. Agora podemos brincar com comandos sequenciais
        
        // Teste 1: Título
        console.log(`${C.INFO}▶️ Teste 1: Title${C.RESET}`);
        await runCommand("title @a actionbar §aConectado com Sucesso!");
        
        // Teste 2: Som
        console.log(`${C.INFO}▶️ Teste 2: Som${C.RESET}`);
        await runCommand("playsound random.levelup @a ~ ~ ~ 1 1");

        // Teste 3: Bloco (Verificando robustez)
        console.log(`${C.INFO}▶️ Teste 3: Setblock${C.RESET}`);
        // Coloca um bloco de vidro embaixo de você (CUIDADO se estiver no survival kkk)
        await runCommand("setblock ~ ~-1 ~ glass");

        console.log(`${C.INFO}🎉 Todos os testes automáticos concluídos! O socket continua aberto para ouvir logs.${C.RESET}`);

    } catch (error) {
        console.error(`${C.ERRO}💥 Erro fatal no script:`, error);
    }
});
