# 🐾 Clawy Session Monitor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot-blue.svg)](https://core.telegram.org/bots)

Bot de Telegram para monitorear el tamaño de las sesiones de OpenClaw y saber cuándo es momento de hacer `/new`.

## 📸 Preview

```
🟢 ESTADO DE SESIÓN

[████████░░░░░░░░] 52%

📁 Archivo: session-2026-03-02.jsonl
💾 Tamaño: 1.20 MB
📝 Mensajes: 1,643
   👤 Usuario: 199
   🤖 Asistente: 358
🧠 Tokens estimados: 314,572
⏰ Último acceso: 02/03/2026, 07:45:00

✅ Sesión saludable. Puedes continuar tranquilo.
```

## 🚀 Instalación

### Requisitos
- Node.js 18 o superior
- Una cuenta de Telegram
- OpenClaw instalado en tu servidor

### Paso 1: Clonar el repositorio

```bash
git clone https://github.com/clawy/clawy-session-monitor.git
cd clawy-session-monitor
```

### Paso 2: Crear el bot en Telegram

1. Abre Telegram y busca a **@BotFather**
2. Envía `/newbot`
3. Sigue las instrucciones para crear tu bot
4. **¡Guarda el TOKEN!** Lo necesitarás.

### Paso 3: Configurar variables de entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar con tu editor favorito
nano .env
```

Agrega tu token:
```env
CLAWY_SESSION_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

### Paso 4: Instalar dependencias

```bash
npm install
```

### Paso 5: Ejecutar el bot

```bash
npm start
```

## 🔄 Ejecución permanente (con PM2)

Para que el bot corra siempre, incluso después de reiniciar el servidor:

```bash
# Instalar PM2 si no lo tienes
npm install -g pm2

# Iniciar el bot
pm2 start bot.js --name clawy-session-monitor

# Guardar configuración
pm2 save

# Ver logs
pm2 logs clawy-session-monitor

# Reiniciar
pm2 restart clawy-session-monitor

# Detener
pm2 stop clawy-session-monitor
```

## 📱 Comandos del Bot

| Comando | Descripción |
|---------|-------------|
| `/start` | Iniciar el bot |
| `/status` | Ver estado actual de la sesión |
| `/summary` | Resumen detallado con botones interactivos |
| `/history` | Ver historial de sesiones anteriores |
| `/alerts` | Ver configuración de alertas automáticas |
| `/config` | Ver configuración de umbrales |
| `/help` | Mostrar ayuda completa |

## ⚙️ Configuración

### Variables de entorno

| Variable | Descripción | Requerido | Default |
|----------|-------------|-----------|---------|
| `CLAWY_SESSION_BOT_TOKEN` | Token del bot de Telegram | ✅ Sí | - |
| `OPENCLAW_SESSIONS_PATH` | Path a las sesiones de OpenClaw | ❌ No | `/home/ubuntu/.openclaw/agents/main/sessions` |
| `OPENCLAW_WORKSPACE_PATH` | Path al workspace de OpenClaw | ❌ No | `/home/ubuntu/.openclaw/workspace` |
| `TIMEZONE` | Zona horaria para mostrar fechas | ❌ No | `America/Mexico_City` |

### Umbrales de alerta

El bot te avisa automáticamente cuando la sesión alcanza ciertos porcentajes:

| Porcentaje | Estado | Acción |
|------------|--------|--------|
| 0-69% | 🟢 Saludable | Continuar normal |
| 70-79% | 🟡 Advertencia | Considerar `/new` |
| 80-89% | 🟠 Recomendado | **Hacer `/new`** |
| 90-94% | 🔴 Urgente | Hacer `/new` pronto |
| 95%+ | 💀 Crítico | **Hacer `/new` YA** |

## 📁 Estructura del proyecto

```
clawy-session-monitor/
├── bot.js              # Código principal del bot
├── package.json        # Dependencias y metadatos
├── .env.example        # Plantilla de variables de entorno
├── .env                # Tus variables (NO subir)
├── .gitignore          # Archivos a ignorar en git
├── README.md           # Este archivo
└── LICENSE             # Licencia MIT
```

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Por favor:

1. Haz fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Haz commit de tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 🦞 Creado por Clawy 🐾

---

**¿Te sirvió? Dale ⭐ al repo!**
