import express from 'express';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

const PORT = process.env.PORT || 3000;
const NUMERO_ADMIN = "521XXXXXXXXXX@s.whatsapp.net";

const app = express();
app.get('/', (req, res) => res.send('Streamer Hub LATAM GMT-5 ✅'));
app.listen(PORT, () => console.log(`Puerto ${PORT}`));

let calendario = []; // {id, texto, owner}
let streamers = []; // {nombre, juego, twitch, kick, tiktok, youtube, owner}
let contador = 1;

function getSaludoLATAM() {
  const h = parseInt(new Date().toLocaleString("es-CO", { timeZone: "America/Bogota", hour: "numeric", hour12: false }));
  if (h >= 5 && h < 12) return "☀️ Hola, buenos días";
  if (h >= 12 && h < 19) return "🌤️ Hola, buenas tardes";
  return "🌙 Hola, buenas noches";
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
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const textoOriginal = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const texto = textoOriginal.toLowerCase().trim();

    // HOLA / MENU / CALENDARIO
    if (texto.includes('hola') || texto === 'menu' || texto === 'calendario') {
      const saludo = getSaludoLATAM();
      const { fecha, hora } = getHoraLATAM();
      let listaCal = calendario.map((e) => `${e.id}. 📌 ${e.texto}`).join('\n') || "✨ _Sin eventos aún_";

      await sock.sendMessage(from, {
        text: `${saludo} 👋

💜 *Este es el Calendario Creator LATAM* 💚
📍 *Zona horaria:* LATINOAMÉRICA GMT-5
🌎 Bogotá • Lima • Quito • Panamá
🗓️ ${fecha} • ⏰ ${hora}

📅 *Próximos Streams:*
${listaCal}

🔗 Escribe *canales* para ver los canales
📖 Escribe *ayuda*`
      });

      for (const s of streamers) {
        await sock.sendMessage(from, {
          text: `🔴 *• ${s.nombre} — ${s.juego} •* 🎮`,
          footer: "✨ Calendario Creator LATAM 🌎",
          templateButtons: [
            { index: 1, urlButton: { displayText: `💜 Twitch • ${s.nombre}`, url: s.twitch } },
            { index: 2, urlButton: { displayText: `💚 Kick • ${s.nombre}`, url: s.kick } },
            { index: 3, urlButton: { displayText: `🎵 TikTok`, url: s.tiktok } },
            { index: 4, urlButton: { displayText: `❤️ YouTube`, url: s.youtube } },
          ]
        });
      }
    }

    // AGREGAR EVENTO
    else if (texto.startsWith('agregar ')) {
      if (texto.startsWith('agregar canal ')) {
        const partes = textoOriginal.split(' ');
        if (partes.length < 7) {
          await sock.sendMessage(from, { text: "❌ Usa: agregar canal NOMBRE JUEGO LINK_TWITCH LINK_KICK LINK_TIKTOK LINK_YOUTUBE\nEjemplo: agregar canal LUNA Valorant https://twitch.tv/luna https://kick.com/luna https://tiktok.com/@luna https://youtube.com/@luna" });
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
        await sock.sendMessage(from, { text: `✅ 💜 Canal *${nombre}* agregado con estilo ✨\nAhora aparece con botones 🔗` });
      } else {
        const contenido = textoOriginal.substring(8).trim();
        if (!contenido) {
          await sock.sendMessage(from, { text: "❌ Escribe que quieres agregar. Ej: agregar Stream IRL mañana 8pm" });
          return;
        }
        calendario.push({ id: contador++, texto: contenido, owner: sender });
        await sock.sendMessage(from, { text: `✅ 📌 Agregado: *${contenido}* ✨\n🆔 ID: ${contador-1}` });
      }
    }

    // BORRAR - CADA UNO BORRA LO SUYO, ADMIN BORRA TODO
    else if (texto.startsWith('borrar ')) {
      if (texto === 'borrar todo') {
        if (!esAdmin(sender)) {
          await sock.sendMessage(from, { text: "❌ 👑 Solo el administrador puede usar *borrar todo*" });
          return;
        }
        calendario = [];
        streamers = [];
        contador = 1;
        await sock.sendMessage(from, { text: "🗑️ ✅ *Todo borrado por admin* 👑 ✨" });
      } else {
        const num = parseInt(texto.replace('borrar', '').trim());
        if (isNaN(num)) {
          await sock.sendMessage(from, { text: "❌ Usa: borrar 1 o borrar todo" });
          return;
        }
        let encontrado = calendario.find(e => e.id === num);
        if (encontrado) {
          if (encontrado.owner!== sender &&!esAdmin(sender)) {
            await sock.sendMessage(from, { text: "❌ 🔒 Solo puedes borrar lo que tú agregaste. Este evento es de otro usuario." });
            return;
          }
          calendario = calendario.filter(e => e.id!== num);
          await sock.sendMessage(from, { text: `✅ 🗑️ Borrado: ${encontrado.texto}` });
          return;
        }
        let encontradoS = streamers.find(e => e.id === num);
        if (encontradoS) {
          if (encontradoS.owner!== sender &&!esAdmin(sender)) {
            await sock.sendMessage(from, { text: "❌ 🔒 Solo puedes borrar el canal que tú agregaste." });
            return;
          }
          streamers = streamers.filter(e => e.id!== num);
          await sock.sendMessage(from, { text: `✅ 🗑️ Canal borrado: ${encontradoS.nombre}` });
          return;
        }
        await sock.sendMessage(from, { text: `❌ No existe el ID ${num}` });
      }
    }

    else if (texto === 'canales') {
      if (streamers.length === 0 && calendario.length === 0) {
        await sock.sendMessage(from, { text: "✨ _Sin canales aún_ 🔗\nUsa: agregar canal NOMBRE JUEGO LINKS" });
        return;
      }
      let txt = "🔗 *CANALES OFICIALES* 🌎\n";
      streamers.forEach((s) => {
        txt += `\n🆔 ${s.id} • 💜 *${s.nombre}* 🎮 ${s.juego}\n`;
      });
      await sock.sendMessage(from, { text: txt });
    }

    else if (texto === 'ayuda') {
      await sock.sendMessage(from, {
        text: `📖 *AYUDA ✨ STREAMER HUB LATAM* 🌎

💜 *Comandos:*
• 🌤️ *hola / menu* — Ver calendario estético + botones clickeables
• 🔗 *canales* — Ver lista de IDs y nombres
• 📌 *agregar* — Agregar evento
   Ej: agregar Torneo el viernes 8pm
• 🎮 *agregar canal* — Agregar streamer con 4 redes
   Ej: agregar canal LUNA Valorant https://twitch.tv/luna https://kick.com/luna https://tiktok.com/@luna https://youtube.com/@luna

🗑️ *Borrado:*
• *borrar 1* — Borra lo que TÚ agregaste con ID 1 🔒
• *borrar todo* — Solo admin 👑 borra todo

📍 GMT-5 Bogotá/Lima/Quito
✨ Todo con estética de emojis`
      });
    }
  });
}

startBot();
