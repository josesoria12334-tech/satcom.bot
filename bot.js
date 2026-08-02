import express from 'express';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

const PORT = process.env.PORT || 3000;
const NUMERO_ADMIN = "521XXXXXXXXXX@s.whatsapp.net";

const app = express();
app.get('/', (req, res) => res.send('Bot Online ✅'));
app.listen(PORT, () => console.log(`Puerto ${PORT}`));

let calendario = [];
let streamers = [];
let contador = 1;

function limpiarLink(url) {
  if (!url) return "";
  return url.replace(/https?:\/\/(www\.|m\.)?/, '').split('?')[0].split('&')[0].replace(/\/home\/?/, '').replace(/\/$/, '');
}

function detectarLinks(texto) {
  let links = texto.match(/https?:\/\/[^\s]+/g) || [];
  let data = { twitch: null, kick: null, tiktok: null, youtube: null };
  links.forEach(l => {
    const low = l.toLowerCase();
    if (low.includes('twitch')) data.twitch = l;
    else if (low.includes('kick')) data.kick = l;
    else if (low.includes('tiktok')) data.tiktok = l;
    else if (low.includes('youtube') || low.includes('youtu.be')) data.youtube = l;
  });
  return data;
}

function tarjetaEstetica(s) {
  let card = `╭━━━ 🔴 *${s.nombre} — ${s.juego}* 🎮 ━━━╮\n`;
  card += `│ 🆔 ID: ${s.id}\n│\n`;
  if (s.twitch) card += `│ 💜 Twitch: ${limpiarLink(s.twitch)}\n│ 🔗 ${s.twitch}\n│\n`;
  if (s.kick) card += `│ 💚 Kick: ${limpiarLink(s.kick)}\n│ 🔗 ${s.kick}\n│\n`;
  if (s.tiktok) card += `│ 🎵 TikTok: ${limpiarLink(s.tiktok)}\n│ 🔗 ${s.tiktok}\n│\n`;
  if (s.youtube) card += `│ ❤️ YouTube: ${limpiarLink(s.youtube)}\n│ 🔗 ${s.youtube}\n│\n`;
  card += `╰━━━━━━ ✨ Toca el link para entrar 🌎 ━━━━━━╯`;
  return card;
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) console.log(`QR: https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qr)}`);
    if (connection === 'close' && lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot();
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const textoOriginal = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const texto = textoOriginal.toLowerCase().trim();

    if (texto === 'calendario' || texto === 'hola' || texto === 'menu') {
      const lista = calendario.map(e => `│ ${e.id}. 📌 ${e.texto}`).join('\n') || "│ ✨ Sin eventos";
      await sock.sendMessage(from, { text: `╭━━━ 🌤️ *CALENDARIO CREATOR LATAM* 🌎 ━━━╮\n${lista}\n╰━━━━━━━━━━━━━━━━━━━━━━━╯\n\n✨ *canales*` });
      for (const s of streamers) await sock.sendMessage(from, { text: tarjetaEstetica(s) });
    }

    else if (texto.startsWith('agregar canal')) {
      const partes = textoOriginal.split(' ');
      const nombre = partes[2]?.toUpperCase();
      const juego = partes[3] || "Variedad";
      if (!nombre) { await sock.sendMessage(from, { text: "❌ Usa: agregar canal NOMBRE JUEGO LINK" }); return; }
      const links = detectarLinks(textoOriginal);
      if (!links.twitch &&!links.kick &&!links.tiktok &&!links.youtube) { await sock.sendMessage(from, { text: "❌ Pon al menos 1 link" }); return; }
      streamers.push({ id: contador++, nombre, juego,...links, owner: sender });
      await sock.sendMessage(from, { text: `✅ Canal *${nombre}* agregado\n${tarjetaEstetica(streamers[streamers.length-1])}` });
    }

    else if (texto.startsWith('agregar ')) {
      const contenido = textoOriginal.substring(8).trim();
      if (!contenido) return;
      calendario.push({ id: contador++, texto: contenido, owner: sender });
      await sock.sendMessage(from, { text: `✅ 📌 Agregado ID ${contador-1}: *${contenido}*` });
    }

    else if (texto.startsWith('borrar ')) {
      if (texto === 'borrar todo') {
        if (sender!== NUMERO_ADMIN) { await sock.sendMessage(from, { text: "❌ Solo admin 👑" }); return; }
        calendario = []; streamers = []; contador = 1;
        await sock.sendMessage(from, { text: "🗑️ Todo borrado" });
      } else {
        const num = parseInt(texto.replace('borrar','').trim());
        let item = calendario.find(x=>x.id===num) || streamers.find(x=>x.id===num);
        if (!item) { await sock.sendMessage(from, { text: `❌ No existe ID ${num}` }); return; }
        if (item.owner!== sender && sender!== NUMERO_ADMIN) { await sock.sendMessage(from, { text: "🔒 Solo puedes borrar lo que tú agregaste" }); return; }
        calendario = calendario.filter(x=>x.id!==num);
        streamers = streamers.filter(x=>x.id!==num);
        await sock.sendMessage(from, { text: `✅ Borrado ID ${num}` });
      }
    }

    else if (texto === 'canales') {
      if (!streamers.length) { await sock.sendMessage(from, { text: "🔗 Sin canales aún" }); return; }
      for (const s of streamers) await sock.sendMessage(from, { text: tarjetaEstetica(s) });
    }

    else if (texto === 'ayuda') {
      await sock.sendMessage(from, {
        text: `📖 *AYUDA*

agregar canal NOMBRE JUEGO LINK
agregar TEXTO
canales
calendario
borrar ID
borrar todo`
      });
    }
  });
}

startBot();
