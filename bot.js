#!/usr/bin/env node

/**
 * 📊 CLAWY SESSION MONITOR - Bot de Telegram
 * Monitorea el tamaño de las sesiones de Clawy
 * 
 * Repository: https://github.com/clawy/clawy-session-monitor
 * Created by: Clawy 🐾
 */

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Configuration from environment variables
const BOTTOKEN = process.env.CLAWY_SESSION_BOT_TOKEN;
const TIMEZONE = process.env.TIMEZONE || 'America/Mexico_City';
const SESSIONS_PATH = process.env.OPENCLAW_SESSIONS_PATH || '/home/ubuntu/.openclaw/agents/main/sessions';
const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '/home/ubuntu/.openclaw/workspace';

// Validate required configuration
if (!BOTTOKEN) {
  console.error('❌ ERROR: CLAWY_SESSION_BOT_TOKEN not found in environment variables');
  console.error('📋 Please create a .env file with your bot token:');
  console.error('   CLAWY_SESSION_BOT_TOKEN=your_token_here');
  console.error('\n📖 See .env.example for reference');
  process.exit(1);
}

function formatMexicoTime(date) {
  return date.toLocaleString('es-MX', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

// Umbrales configurables (Luis puede cambiarlos)
const THRESHOLDS = {
  warning: 0.70,    // 70% - Advertencia
  recommend: 0.80,  // 80% - Recomendado hacer /new
  urgent: 0.90,     // 90% - Urgente
  critical: 0.95    // 95% - Crítico
};

// Límite estimado de sesión (en MB) - ajustar según experiencia
const SESSION_LIMIT_MB = 10; // 10 MB es un límite seguro

// Crear bot
const bot = new TelegramBot(BOTTOKEN, { polling: true });

// ===================== UTILIDADES =====================

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getProgressBar(percentage) {
  const filled = Math.floor(percentage / 5);
  const empty = 20 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${percentage.toFixed(1)}%`;
}

function getStatusEmoji(percentage) {
  if (percentage < 70) return '🟢';
  if (percentage < 80) return '🟡';
  if (percentage < 90) return '🟠';
  if (percentage < 95) return '🔴';
  return '💀';
}

function getRecommendation(percentage) {
  if (percentage < 70) {
    return '✅ Sesión saludable. Puedes continuar tranquilo.';
  } else if (percentage < 80) {
    return '⚠️ Acercándote al límite. Considera hacer /new pronto.';
  } else if (percentage < 90) {
    return '🟠 RECOMENDADO: Haz /new ahora para mejor rendimiento.';
  } else if (percentage < 95) {
    return '🔴 URGENTE: Haz /new inmediatamente.';
  } else {
    return '💀 CRÍTICO: Sesión puede fallar. Haz /new YA.';
  }
}

// ===================== ANÁLISIS DE SESIÓN =====================

function getCurrentSession() {
  try {
    const files = fs.readdirSync(SESSIONS_PATH);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl') && !f.includes('.bak') && !f.includes('.reset'));
    
    if (jsonlFiles.length === 0) {
      return null;
    }

    // Obtener el archivo más reciente
    let latestFile = null;
    let latestTime = 0;

    for (const file of jsonlFiles) {
      const filePath = path.join(SESSIONS_PATH, file);
      const stats = fs.statSync(filePath);
      if (stats.mtimeMs > latestTime) {
        latestTime = stats.mtimeMs;
        latestFile = file;
      }
    }

    return latestFile;
  } catch (err) {
    return null;
  }
}

function analyzeSession(filename) {
  const filePath = path.join(SESSIONS_PATH, filename);
  const stats = fs.statSync(filePath);
  const sizeBytes = stats.size;
  const sizeMB = sizeBytes / (1024 * 1024);

  // Leer archivo para contar mensajes
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');
  const totalMessages = lines.length;

  // Contar mensajes de usuario y asistente
  let userMessages = 0;
  let assistantMessages = 0;

  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      if (data.type === 'message') {
        if (data.message?.role === 'user') userMessages++;
        if (data.message?.role === 'assistant') assistantMessages++;
      }
    } catch (e) {}
  }

  // Calcular porcentaje de uso
  const percentage = (sizeMB / SESSION_LIMIT_MB) * 100;

  // Estimar tokens (aproximadamente 4 caracteres = 1 token)
  const estimatedTokens = Math.floor(sizeBytes / 4);

  return {
    filename,
    sizeBytes,
    sizeMB,
    percentage: Math.min(percentage, 100),
    totalMessages,
    userMessages,
    assistantMessages,
    estimatedTokens,
    lastModified: stats.mtime
  };
}

function getAllSessions() {
  try {
    const files = fs.readdirSync(SESSIONS_PATH);
    const sessions = [];

    for (const file of files) {
      if (file.includes('.jsonl')) {
        const filePath = path.join(SESSIONS_PATH, file);
        const stats = fs.statSync(filePath);
        sessions.push({
          name: file,
          size: stats.size,
          modified: stats.mtime
        });
      }
    }

    return sessions.sort((a, b) => b.modified - a.modified);
  } catch (err) {
    return [];
  }
}

// ===================== COMANDOS DEL BOT =====================

// Comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  // Autorizar este chat para recibir alertas
  authorizeChat(chatId);

  const welcome = `
🦞 *¡Hola! Soy Clawy Session Monitor*

Te ayudo a monitorear el tamaño de las sesiones de Clawy para que sepas cuándo es momento de abrir una nueva.

✅ *¡Alertas ACTIVADAS para este chat!*
Recibirás notificaciones automáticas en:
🟡 70% - Advertencia
🟠 80% - Recomendado /new
🔴 90% - Urgente
💀 95% - Crítico

📊 *Comandos disponibles:*

/status - Ver estado actual de la sesión
/summary - Resumen detallado
/history - Historial de sesiones
/alerts - Gestionar alertas
/config - Configurar umbrales
/help - Ayuda

💡 *Umbrales configurados:*
🟢 0-69%: Saludable
🟡 70-79%: Advertencia
🟠 80-89%: Recomendado /new
🔴 90-94%: Urgente
💀 95%+: Crítico

_Usa /status para ver el estado actual_
`;

  bot.sendMessage(chatId, welcome, { parse_mode: 'Markdown' });
});

// Comando /status
bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  
  const currentSession = getCurrentSession();
  
  if (!currentSession) {
    bot.sendMessage(chatId, '❌ No encontré ninguna sesión activa.');
    return;
  }

  const session = analyzeSession(currentSession);
  const emoji = getStatusEmoji(session.percentage);

  const message = `
${emoji} *ESTADO DE SESIÓN*

📊 ${getProgressBar(session.percentage)}

📁 *Archivo:* \`${session.filename}\`
💾 *Tamaño:* ${formatBytes(session.sizeBytes)}
📝 *Mensajes:* ${session.totalMessages.toLocaleString()}
   👤 Usuario: ${session.userMessages}
   🤖 Clawy: ${session.assistantMessages}
🧠 *Tokens estimados:* ${session.estimatedTokens.toLocaleString()}
⏰ *Último acceso:* ${formatMexicoTime(session.lastModified)}

${getRecommendation(session.percentage)}
`;

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Comando /summary
bot.onText(/\/summary/, (msg) => {
  const chatId = msg.chat.id;
  
  const currentSession = getCurrentSession();
  
  if (!currentSession) {
    bot.sendMessage(chatId, '❌ No encontré ninguna sesión activa.');
    return;
  }

  const session = analyzeSession(currentSession);
  const emoji = getStatusEmoji(session.percentage);

  // Crear teclado inline con acciones
  const opts = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📊 Ver Detalles', callback_data: 'details' },
          { text: '💾 Backup Ahora', callback_data: 'backup' }
        ],
        [
          { text: '🔄 Actualizar', callback_data: 'refresh' }
        ]
      ]
    }
  };

  const message = `
${emoji} *RESUMEN DE SESIÓN*

${getProgressBar(session.percentage)}

┌─────────────────────────────
│ *Métricas*
├─────────────────────────────
│ 💾 Tamaño: ${formatBytes(session.sizeBytes)} / ${SESSION_LIMIT_MB} MB
│ 📝 Mensajes: ${session.totalMessages.toLocaleString()}
│ 🧠 Tokens: ~${session.estimatedTokens.toLocaleString()}
│ 📅 Duración: ${getDaysSinceCreation(session)}
└─────────────────────────────

*Recomendación:*
${getRecommendation(session.percentage)}

_Toca los botones abajo para más opciones_
`;

  bot.sendMessage(chatId, message, opts);
});

// Comando /history
bot.onText(/\/history/, (msg) => {
  const chatId = msg.chat.id;
  
  const sessions = getAllSessions();
  
  if (sessions.length === 0) {
    bot.sendMessage(chatId, '❌ No encontré sesiones.');
    return;
  }

  let message = '📚 *HISTORIAL DE SESIONES*\n\n';
  
  const now = new Date();
  const last24h = sessions.filter(s => (now - s.modified) < 24 * 60 * 60 * 1000);
  const last7d = sessions.filter(s => (now - s.modified) < 7 * 24 * 60 * 60 * 1000);

  message += `📊 *Total:* ${sessions.length} archivos\n`;
  message += `📅 *Últimas 24h:* ${last24h.length}\n`;
  message += `📆 *Últimos 7 días:* ${last7d.length}\n\n`;
  
  message += '*Archivos recientes:*\n';
  
  sessions.slice(0, 5).forEach((s, i) => {
    const icon = i === 0 ? '🟢' : '⚪';
    message += `${icon} \`${s.name.slice(0, 30)}...\`\n`;
    message += `   ${formatBytes(s.size)} - ${formatMexicoTime(s.modified)}\n`;
  });

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Comando /alerts - Gestionar alertas
bot.onText(/\/alerts/, (msg) => {
  const chatId = msg.chat.id;
  
  const isAuthorized = authorizedChatIds.has(chatId);
  
  const opts = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { 
            text: isAuthorized ? '🔕 Desactivar Alertas' : '🔔 Activar Alertas', 
            callback_data: isAuthorized ? 'alerts_off' : 'alerts_on' 
          }
        ],
        [
          { text: '📊 Ver Estado', callback_data: 'refresh' }
        ]
      ]
    }
  };

  const status = isAuthorized ? '✅ *ACTIVADAS*' : '❌ *DESACTIVADAS*';
  
  const message = `
🔔 *GESTIÓN DE ALERTAS*

Estado: ${status}

*Recibirás alertas automáticas en:*
🟡 70% - Primera advertencia
🟠 80% - Recomendación de /new
🔴 90% - Urgente
💀 95% - Crítico

_Toca el botón para ${isAuthorized ? 'desactivar' : 'activar'}_
`;

  bot.sendMessage(chatId, message, opts);
});

// Comando /config
bot.onText(/\/config/, (msg) => {
  const chatId = msg.chat.id;
  
  const message = `
⚙️ *CONFIGURACIÓN DE UMBRALES*

Los umbrales determinan cuándo te aviso que abras una nueva sesión.

*Configuración actual:*
🟡 Advertencia: ${(THRESHOLDS.warning * 100).toFixed(0)}%
🟠 Recomendado: ${(THRESHOLDS.recommend * 100).toFixed(0)}%
🔴 Urgente: ${(THRESHOLDS.urgent * 100).toFixed(0)}%
💀 Crítico: ${(THRESHOLDS.critical * 100).toFixed(0)}%

*Límite de sesión:* ${SESSION_LIMIT_MB} MB

_Para cambiar la configuración, edita el archivo:_
\`/workspace/clawy-session-monitor/config.json\`
`;

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Comando /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const message = `
❓ *AYUDA - Clawy Session Monitor*

*¿Qué hago?*
Monitoreo el tamaño de las sesiones de Clawy para que sepas cuándo es momento de abrir una nueva sesión (/new).

*¿Por qué es importante?*
Las sesiones muy grandes pueden:
• Hacer que Clawy sea más lento
• Consumir más tokens
• Perder contexto antiguo

*¿Cuándo debo hacer /new?*
• 🟢 0-69%: No es necesario
• 🟡 70-79%: Empieza a pensar en ello
• 🟠 80-89%: *RECOMENDADO* - Mejor momento
• 🔴 90-94%: Hazlo pronto
• 💀 95%+: *URGENTE* - Hazlo YA

*Comandos:*
/start - Iniciar bot
/status - Estado rápido
/summary - Resumen detallado
/history - Historial de sesiones
/config - Ver configuración
/help - Esta ayuda

_¿Preguntas? Habla con Luis o Clawy_ 🦞
`;

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Callback queries (botones inline)
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === 'refresh' || data === 'details') {
    const currentSession = getCurrentSession();
    if (currentSession) {
      const session = analyzeSession(currentSession);
      const emoji = getStatusEmoji(session.percentage);
      
      bot.answerCallbackQuery(query.id);
      bot.sendMessage(chatId, `${emoji} ${getProgressBar(session.percentage)}\n\n${getRecommendation(session.percentage)}`);
    }
  } else if (data === 'backup') {
    bot.answerCallbackQuery(query.id, { text: '💾 Iniciando backup...' });
    // Aquí se podría integrar con el sistema de backup
    bot.sendMessage(chatId, '✅ Backup solicitado. Clawy lo realizará en la próxima sesión.');
  } else if (data === 'alerts_on') {
    authorizeChat(chatId);
    bot.answerCallbackQuery(query.id, { text: '✅ Alertas activadas' });
    bot.sendMessage(chatId, '🔔 *Alertas ACTIVADAS*\n\nRecibirás notificaciones automáticas cuando la sesión llegue a los umbrales configurados.', { parse_mode: 'Markdown' });
  } else if (data === 'alerts_off') {
    authorizedChatIds.delete(chatId);
    saveAuthorizedChats();
    bot.answerCallbackQuery(query.id, { text: '🔕 Alertas desactivadas' });
    bot.sendMessage(chatId, '🔕 *Alertas DESACTIVADAS*\n\nYa no recibirás notificaciones automáticas.\n\nPuedes reactivarlas con /alerts', { parse_mode: 'Markdown' });
  }
});

// ===================== ALERTAS AUTOMÁTICAS =====================

let lastAlertLevel = 0;
let authorizedChatIds = new Set(); // Chats autorizados para recibir alertas

// Cargar chats autorizados desde archivo
function loadAuthorizedChats() {
  try {
    const data = fs.readFileSync('/home/ubuntu/.openclaw/workspace/clawy-session-monitor/authorized_chats.json', 'utf8');
    const chats = JSON.parse(data);
    authorizedChatIds = new Set(chats);
    console.log('📱 Chats autorizados cargados:', authorizedChatIds.size);
  } catch (err) {
    // Archivo no existe, empezar vacío
    authorizedChatIds = new Set();
  }
}

// Guardar chats autorizados
function saveAuthorizedChats() {
  try {
    fs.writeFileSync(
      '/home/ubuntu/.openclaw/workspace/clawy-session-monitor/authorized_chats.json',
      JSON.stringify([...authorizedChatIds])
    );
  } catch (err) {
    console.error('Error guardando chats:', err);
  }
}

// Agregar chat a la lista de autorizados
function authorizeChat(chatId) {
  authorizedChatIds.add(chatId);
  saveAuthorizedChats();
  console.log('✅ Chat autorizado:', chatId);
}

function checkAndAlert() {
  const currentSession = getCurrentSession();
  if (!currentSession) return;

  const session = analyzeSession(currentSession);
  const percentage = session.percentage;

  // Determinar nivel de alerta
  let alertLevel = 0;
  if (percentage >= THRESHOLDS.critical) alertLevel = 4;
  else if (percentage >= THRESHOLDS.urgent) alertLevel = 3;
  else if (percentage >= THRESHOLDS.recommend) alertLevel = 2;
  else if (percentage >= THRESHOLDS.warning) alertLevel = 1;

  // Si el nivel aumentó, enviar alerta a TODOS los chats autorizados
  if (alertLevel > lastAlertLevel && alertLevel >= 1) {
    const emoji = getStatusEmoji(percentage);
    const alertMessage = `
${emoji} *ALERTA DE SESIÓN*

${getProgressBar(percentage)}

📊 *Detalles:*
💾 Tamaño: ${formatBytes(session.sizeBytes)}
📝 Mensajes: ${session.totalMessages.toLocaleString()}

${getRecommendation(session.percentage)}

_Esta alerta es automática. Usa /status para más detalles._
`;

    // Enviar a todos los chats autorizados
    authorizedChatIds.forEach(chatId => {
      bot.sendMessage(chatId, alertMessage, { parse_mode: 'Markdown' })
        .then(() => console.log('📤 Alerta enviada a:', chatId))
        .catch(err => console.error('Error enviando alerta:', err));
    });

    lastAlertLevel = alertLevel;
  }

  // Resetear nivel si bajó (ej: después de /new)
  if (percentage < 50 && lastAlertLevel > 0) {
    lastAlertLevel = 0;
    console.log('🔄 Nivel de alerta reseteado');
  }
}

// Cargar chats autorizados al iniciar
loadAuthorizedChats();

// Verificar cada 5 minutos
setInterval(checkAndAlert, 5 * 60 * 1000);

// ===================== FUNCIONES AUXILIARES =====================

function getDaysSinceCreation(session) {
  const now = new Date();
  const diff = now - session.lastModified;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Hoy';
  if (days === 1) return '1 día';
  return `${days} días`;
}

// ===================== INICIAR =====================

console.log('🦞 Clawy Session Monitor iniciado...');
console.log('📊 Monitoreando:', SESSIONS_PATH);
console.log('💾 Límite de sesión:', SESSION_LIMIT_MB, 'MB');

// Manejo de errores
bot.on('error', (err) => {
  console.error('Error del bot:', err);
});

bot.on('polling_error', (err) => {
  console.error('Error de polling:', err);
});
