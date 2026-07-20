// scripts/operador_config.js
// ================================================================
// ===== GERENCIAMENTO DE IDENTIFICAÇÃO DO OPERADOR =====
// ================================================================

const CHAVE_OPERADOR_ID = 'operador_id';
const CHAVE_OPERADOR_NOME = 'operador_nome';

// ===== FUNÇÕES =====

function getOperadorId() {
    return new Promise((resolve) => {
        chrome.storage.local.get([CHAVE_OPERADOR_ID], (result) => {
            resolve(result[CHAVE_OPERADOR_ID] || null);
        });
    });
}

function getOperadorNome() {
    return new Promise((resolve) => {
        chrome.storage.local.get([CHAVE_OPERADOR_NOME], (result) => {
            resolve(result[CHAVE_OPERADOR_NOME] || null);
        });
    });
}

function getOperador() {
    return new Promise((resolve) => {
        chrome.storage.local.get([CHAVE_OPERADOR_ID, CHAVE_OPERADOR_NOME], (result) => {
            resolve({
                id: result[CHAVE_OPERADOR_ID] || null,
                nome: result[CHAVE_OPERADOR_NOME] || null
            });
        });
    });
}

function setOperador(id, nome) {
    return new Promise((resolve) => {
        chrome.storage.local.set({
            [CHAVE_OPERADOR_ID]: id,
            [CHAVE_OPERADOR_NOME]: nome
        }, resolve);
    });
}

function clearOperador() {
    return new Promise((resolve) => {
        chrome.storage.local.remove([CHAVE_OPERADOR_ID, CHAVE_OPERADOR_NOME], resolve);
    });
}

function gerarIdUnico(nome) {
    // Converte nome para slug (ex: "Bruno Ferreira" -> "bruno_ferreira")
    return nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9]/g, '_') // Substitui caracteres especiais por _
        .replace(/_+/g, '_') // Remove underscores duplicados
        .replace(/^_|_$/g, ''); // Remove underscores no início/fim
}

// ===== CONFIGURAÇÃO INICIAL (primeiro uso) =====

async function verificarOuConfigurarOperador() {
    const operador = await getOperador();
    
    if (operador.id && operador.nome) {
        console.log(`✅ Operador identificado: ${operador.nome} (${operador.id})`);
        return operador;
    }
    
    // Se não tiver configuração, solicita ao usuário
    return new Promise((resolve) => {
        // Cria um prompt customizado
        const nome = prompt(
            '🔑 Configuração do Operador\n\n' +
            'Digite seu nome completo para identificação na dashboard:\n' +
            '(Ex: Bruno Ferreira)'
        );
        
        if (nome && nome.trim()) {
            const nomeLimpo = nome.trim();
            const id = gerarIdUnico(nomeLimpo);
            
            setOperador(id, nomeLimpo).then(() => {
                console.log(`✅ Operador configurado: ${nomeLimpo} (${id})`);
                resolve({ id, nome: nomeLimpo });
            });
        } else {
            alert('⚠️ Você precisa configurar seu nome para usar a extensão!');
            // Tenta novamente
            verificarOuConfigurarOperador().then(resolve);
        }
    });
}

// ===== EXPORTA FUNÇÕES =====
window.OperadorConfig = {
    getOperadorId,
    getOperadorNome,
    getOperador,
    setOperador,
    clearOperador,
    gerarIdUnico,
    verificarOuConfigurarOperador
};

console.log('📋 OperadorConfig carregado!');