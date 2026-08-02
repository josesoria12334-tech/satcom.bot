import express from 'express';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

const PORT = process.env.PORT || 3000;
const NUMERO_ADMIN = "521XXXXXXXXXX@s.whatsapp.net";

const app = express();
app.get('/', (req, res) => res.send('Streamer Hub LATAM GMT-5 Online ✅'));
app.listen(PORT, () => console.log(`Puerto ${PORT}`));

let calendario = [];
let streamers = [];

function getSaludoLATAM() {
  const h = parseInt(new Date().toLocaleString("es-CO", { timeZone: "America/Bogota", hour: "numeric", hour12: false }));
  if (h >= 5 && h < 12) return "Hola, buenos días ☀️";
  if (h >= 12 && h < 19) return "Hola, buenas tardes 🌤️";
  return "Hola, buenas noches 🌙";
}

function getHoraLATAM() {
  const horaBogota = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota", hour: '2-digit', minute: '2-digit', hour12: true });
  const horaMX = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City", hour: '2-digit', minute: '2-digit', hour12: true });
  const horaAR = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: '2-digit', minute: '2-digit', hour12: true });
  const fecha = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota", weekday: 'long', day: 'numeric', month: 'long' });
  return { fecha, detalle: `🇨🇴 BOG ${horaBogota} | 🇲🇽 MEX ${horaMX} | 🇦🇷 ARG ${horaAR}` };
}

function esAdmin(remitente) {
  return remitente === NUMERO_ADMIN;
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ auth: state, printQRInTerminal: false });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) console.log(`QR: https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qr)}`);
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode!== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    }
    if (connection === 'open') console.log('✅ BOT ONLINE LATAM');
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const textoOriginal = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const texto = textoOriginal.toLowerCase().trim();

    if (texto.includes('hola') || texto === 'menu' || texto === 'calendario' || texto.includes('streamer')) {
      const saludo = getSaludoLATAM();
      const { fecha, detalle } = getHoraLATAM();
      let lista = calendario.map((e,i) => `${i+1}. ${e}`).join('\n') || "_Sin eventos_";

      await sock.sendMessage(from, {
        text: `${saludo}
*Este es el Calendario Creator LATAM*

📍 Zona horaria: *LATINOAMÉRICA GMT-5*
🌎 Bogotá • Lima • Quito • Panamá
🗓️ ${fecha}
⏰ ${detalle}

*📅 Calendario:*
${lista}`
      });

      for (const s of streamers) {
        await sock.sendMessage(from, {
          text: `*• ${s.nombre} — ${s.juego} •*`,
          footer: "Calendario Creator LATAM",
          templateButtons: [
            { index: 1, urlButton: { displayText: `💜 Twitch - ${s.nombre}`, url: s.twitch } },
            { index: 2, urlButton: { displayText: `💚 Kick - ${s.nombre}`, url: s.kick } },
            { index: 3, urlButton: { displayText: `🎵 TikTok`, url: s.tiktok } },
            { index: 4, urlButton: { displayText: `❤️ YouTube`, url: s.youtube } },
          ]
        });
      }
    }

    else if (texto === 'emojis' || texto === 'emoji') {
      await sock.sendMessage(from, {
        text: `*✨ PACK EMOJIS STREAMER LATAM*

☀️ 🌤️ 🌙 👋 ✨
💜 Twitch
💚 Kick
🎵 TikTok
❤️ YouTube
🔴 LIVE
🎙️ 🎧 🎮
📅 🗓️ ⏰ 📌 ✅ 🔥 🚀
🌎 🇲🇽 🇨🇴 🇵🇪 🇦🇷 🇨🇱 🇪🇨 🇵🇦`
      });
    }

    else if (texto.startsWith('borrar ')) {
      if (!esAdmin(sender)) {
        await sock.sendMessage(from, { text: "❌ *Solo el administrador puede borrar* 👑" });
        return;
      }
      if (texto === 'borrar todo' || texto === 'borrar todos') {
        calendario = [];
        streamers = [];
        await sock.sendMessage(from, { text: "🗑️ *TODO BORRADO por administrador* ✅" });
      } else {
        const num = parseInt(texto.replace('borrar', '').trim());
        if (!isNaN(num) && num <= calendario.length) {
          const borrado = calendario.splice(num - 1, 1);
          await sock.sendMessage(from, { text: `✅ Borrado: ${borrado[0]}` });
        } else {
          const idx = num - calendario.length - 1;
          if (streamers[idx]) {
            const borrado = streamers.splice(idx, 1);
            await sock.sendMessage(from, { text: `✅ Streamer borrado: ${borrado[0].nombre}` });
          }
        }
      }
    }

    else if (texto === 'ayuda') {
      await sock.sendMessage(from, {
        text: `*📖 AYUDA STREAMER HUB LATAM GMT-5*

*hola / menu* — Ver calendario + canales con botones
*canales* — Ver links
*emojis* — Pack de emojis
*ayuda* — Este menú

*SOLO ADMIN 👑:*
- borrar 1
- borrar todo`
      });
    }

    else if (texto === 'canales') {
      let txt = "*🔗 CANALES:*\n";
      streamers.forEach((s) => {
        txt += `\n*${s.nombre}*\n💜 ${s.twitch}\n💚 ${s.kick}\n🎵 ${s.tiktok}\n❤️ ${s.youtube}\n`;
      });
      await sock.sendMessage(from, { text: txt || "_Sin canales_" });
    }
  });
}

startBot();
