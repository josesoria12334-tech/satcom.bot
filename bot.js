import express from 'express';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

const PORT = process.env.PORT || 3000;
const NUMERO_ADMIN = "521XXXXXXXXXX@s.whatsapp.net"; // CAMBIA A TU NUMERO

const app = express();
app.get('/', (req, res) => res.send('Streamer Hub LATAM GMT-5 ✅ Online'));
app.listen(PORT, () => console.log(`Puerto ${PORT}`));

let calendario = [];
let streamers = [];
let contador = 1;

function getSaludoLATAM() {
  const h = parseInt(new Date().toLocaleString("es-CO", { timeZone: "America/Bogota", hour: "numeric", hour12: false }));
  if (h >= 5 && h < 12) return "☀️ Hola, buenos días 👋";
  if (h >= 12 && h < 19) return "🌤️ Hola, buenas tardes 👋";
  return "🌙 Hola, buenas noches 👋";
}

function getHoraLATAM() {
  const hora = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota", hour: '2-digit', minute: '2-digit', hour12: true });
  const fecha = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota", weekday: 'long', day: 'numeric', month: 'long' });
  return { fecha, hora };
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
      if (statusCode!== DisconnectReason.loggedOut) startBot();
    }
    if (connection === 'open') console.log('✅ BOT ONLINE');
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const textoOriginal = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const texto = textoOriginal.toLowerCase().trim();

    // CALENDARIO
    if (texto === 'calendario' || texto === 'hola' || texto === 'menu' || texto.includes('calendario creator')) {
      const saludo = getSaludoLATAM();
      const { fecha, hora } = getHoraLATAM();
      let lista = calendario.map((e) => `${e.id}. 📌 ${e.texto}`).join('\n') || "✨ _Sin eventos aún_";

      await sock.sendMessage(from, {
        text: `${saludo}

💜 *Este es el Calendario Creator LATAM* 💚
📍 *Zona horaria:* LATINOAMÉRICA GMT-5
🌎 Bogotá • Lima • Quito • Panamá
🗓️ ${fecha} • ⏰ ${hora}

📅 *Próximos Streams:*
${lista}

🔗 Escribe *canales* para ver los canales
📖 Escribe *ayuda*`
      });

      // ESTE ES EL FIX PARA QUE APAREZCA PARA ENTRAR AL CANAL
      for (const s of streamers) {
        await sock.sendMessage(from, {
          text: `🔴 *• ${s.nombre} — ${s.juego} •* 🎮

💜 *Twitch:*
${s.twitch}

💚 *Kick:*
${s.kick}

🎵 *TikTok:*
${s.tiktok}

❤️ *YouTube:*
${s.youtube}

✨ Toca cualquier link para entrar al canal 🌎`
        });
      }
    }

    // AGREGAR
    else if (texto.startsWith('agregar ')) {
      if (texto.startsWith('agregar canal ')) {
        const partes = textoOriginal.split(' ');
        if (partes.length < 7) {
          await sock.sendMessage(from, { text: "❌ Usa:\nagregar canal NOMBRE JUEGO LINK_TWITCH LINK_KICK LINK_TIKTOK LINK_YOUTUBE" });
          return;
        }
        const nombre = partes[2].toUpperCase();
        const juego = partes[3];
        streamers.push({
          nombre, juego,
          twitch: partes[4],
          kick: partes[5],
          tiktok: partes[6],
          youtube: partes[7],
          owner: sender,
          id: contador++
        });
        await sock.sendMessage(from, { text: `✅ Canal *${nombre}* agregado 💜💚\nID: ${contador-1}\nAhora escribe *canales* o *calendario* para verlo con links clickeables ✨` });
      } else {
        const contenido = textoOriginal.substring(8).trim();
        if (!contenido) return;
        calendario.push({ id: contador++, texto: contenido, owner: sender });
        await sock.sendMessage(from, { text: `✅ 📌 Agregado: *${contenido}* ✨\n🆔 ID: ${contador-1}` });
      }
    }

    // BORRAR - CADA UNO BORRA LO SUYO, ADMIN TODO
    else if (texto.startsWith('borrar ')) {
      if (texto === 'borrar todo') {
        if (!esAdmin(sender)) {
          await sock.sendMessage(from, { text: "❌ 👑 Solo el administrador puede usar *borrar todo*" });
          return;
        }
        calendario = [];
        streamers = [];
        contador = 1;
        await sock.sendMessage(from, { text: "🗑️ ✅ *Todo borrado por admin* 👑" });
      } else {
        const num = parseInt(texto.replace('borrar', '').trim());
        if (isNaN(num)) return;
        let e = calendario.find(x => x.id === num);
        if (e) {
          if (e.owner!== sender &&!esAdmin(sender)) {
            await sock.sendMessage(from, { text: "❌ 🔒 Solo puedes borrar lo que tú agregaste." });
            return;
          }
          calendario = calendario.filter(x => x.id!== num);
          await sock.sendMessage(from, { text: `✅ Borrado ID ${num}: ${e.texto}` });
          return;
        }
        let s = streamers.find(x => x.id === num);
        if (s) {
          if (s.owner!== sender &&!esAdmin(sender)) {
            await sock.sendMessage(from, { text: "❌ 🔒 Solo puedes borrar el canal que tú agregaste." });
            return;
          }
          streamers = streamers.filter(x => x.id!== num);
          await sock.sendMessage(from, { text: `✅ Canal borrado: ${s.nombre}` });
          return;
        }
        await sock.sendMessage(from, { text: `❌ No existe ID ${num}` });
      }
    }

    else if (texto === 'canales') {
      if (streamers.length === 0) {
        await sock.sendMessage(from, { text: "✨ _Sin canales aún_ 🔗\nUsa: agregar canal NOMBRE JUEGO LINKS" });
        return;
      }
      for (const s of streamers) {
        await sock.sendMessage(from, {
          text: `🆔 ${s.id} • 💜 *${s.nombre}* — ${s.juego} 🎮

💜 ${s.twitch}
💚 ${s.kick}
🎵 ${s.tiktok}
❤️ ${s.youtube}

✨ Toca para entrar 🌎`
        });
      }
    }

    else if (texto === 'ayuda') {
      await sock.sendMessage(from, {
        text: `📖 *AYUDA STREAMER HUB LATAM GMT-5* 🌎

💜 *calendario / hola / menu* — Ver calendario estético
🔗 *canales* — Ver canales con links clickeables
📌 *agregar texto* — Agregar evento
   Ej: agregar stream zAndyMoon 07:00 p.m Lunes
🎮 *agregar canal* — Agregar streamer
   Ej: agregar canal ZANDYMOON Dota https://twitch.tv/zandymoon https://kick.com/zandymoon https://tiktok.com/@zandymoon https://youtube.com/@zandymoon

🗑️ *borrar 2* — Borras solo lo que tú agregaste 🔒
👑 *borrar todo* — Solo admin borra todo`
      });
    }
  });
}

startBot();
