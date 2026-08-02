import express from 'express';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

// ============================================
// CONFIGURACIÓN
// ============================================
const PORT = process.env.PORT || 3000;
const NUMERO_ADMIN = "521XXXXXXXXXX@s.whatsapp.net";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

const app = express();
app.get('/', (req, res) => res.send('Bot Mundial + Avisos ✅'));
app.listen(PORT, () => console.log(PORT));

// ============================================
// VARIABLES
// ============================================
let calendario = [];
let streamers = [];
let contador = 1;
let gruposActivos = new Set();

// ============================================
// FUNCIONES DE LINKS
// ============================================
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

// ============================================
// HORARIO MUNDIAL
// ============================================
function parsearHora(texto) {
  const m = texto.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  let min = parseInt(m[2] || "0");
  const ampm = (m[3] || "").toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (h > 23) return null;
  return { h, min };
}
function formato12(h, m) {
  const ampm = h >= 12? "PM" : "AM";
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}:${m.toString().padStart(2,'0')} ${ampm}`;
}
function horariosMundo(horaMX) {
  // Base: hora en MX GMT-6
  const h = horaMX.h;
  const m = horaMX.min;
  const zonas = [
    { pais: "🇲🇽 MX (GMT-6)", offset: 0 },
    { pais: "🇨🇴 COL/PER/ECU (GMT-5)", offset: 1 },
    { pais: "🇺🇸 EST USA (GMT-4)", offset: 2 },
    { pais: "🇦🇷 ARG/CHL/URU (GMT-3)", offset: 3 },
    { pais: "🇪🇸 ESP (GMT+2)", offset: 8 },
  ];
  return zonas.map(z => {
    let nh = (h + z.offset) % 24;
    return `${z.pais}: ${formato12(nh, m)}`;
  }).join('\n');
}

// ============================================
// TARJETA ESTÉTICA
// ============================================
function tarjetaEstetica(s) {
  let card = `╭━━━ 🔴 *${s.nombre} — ${s.juego}* 🎮 ━━━╮\n│ 🆔 ID: ${s.id}\n│\n`;
  if (s.twitch) card += `│ 💜 Twitch: ${limpiarLink(s.twitch)}\n│ 🔗 ${s.twitch}\n│\n`;
  if (s.kick) card += `│ 💚 Kick: ${limpiarLink(s.kick)}\n│ 🔗 ${s.kick}\n│\n`;
  if (s.tiktok) card += `│ 🎵 TikTok: ${limpiarLink(s.tiktok)}\n│ 🔗 ${s.tiktok}\n│\n`;
  if (s.youtube) card += `│ ❤️ YouTube: ${limpiarLink(s.youtube)}\n│ 🔗 ${s.youtube}\n│\n`;
  card += `╰━━━━━━ ✨ Toca el link 🌎 ━━━━━━╯`;
  return card;
}

// ============================================
// IA MULTI-RED
// ============================================
async function ideasMultiRed(pregunta) {
  const q = pregunta.toLowerCase();
  let red = "general";
  if (q.includes('tiktok')) red = "tiktok";
  else if (q.includes('youtube') || q.includes('short')) red = "youtube";
  else if (q.includes('insta') || q.includes('reel')) red = "instagram";
  else if (q.includes('twitch') || q.includes('kick') || q.includes('clip')) red = "twitch";
  const banco = {
    tiktok: `🎵 *TIKTOK 2026*\n━━━━━━━━━━━━━━━\n1. "Mala jugando, buena fregando" 😭\n2. "Si gano hago 10 flexiones"\n3. Loop infinito\n4. "¿Report o mal jugado?"\n5. Cuarto real sin filtro`,
    youtube: `❤️ *YOUTUBE SHORTS*\n━━━━━━━━━━━━━━━\n1. Día 3 siendo Global\n2. Juego que nadie juega\n3. Lees "juegas como bot"\n4. Tutorial 15s Dust2\n5. Clip 2023 vs 2026`,
    instagram: `💜 *INSTA REELS*\n━━━━━━━━━━━━━━━\n1. GRWM stream noche\n2. Foto Dump 5 fotos\n3. POV duo deja 1vs4\n4. Dúo quién juega peor\n5. Estiramientos gamer`,
    twitch: `💚 *TWITCH/KICK*\n━━━━━━━━━━━━━━━\n1. NO LOOTEEEN\n2. Me banearon por reírme\n3. Chat elige arma\n4. Juego de 2 dólares\n5. Gracias sub`,
    general: `🚀 *MULTI-RED*\n━━━━━━━━━━━━━━━\n🎵 TikTok: Mala jugando, buena fregando\n❤️ YouTube: Día 1 Global\n💜 Insta: GRWM\n💚 Twitch: NO LOOTEEEN`
  };
  return `🤖 *IA MULTI-RED* ✨\n━━━━━━━━━━━━━━━\n\n${banco[red]}`;
}
async function preguntarIA(pregunta) {
  if (pregunta.toLowerCase().match(/idea|viral|que subo|contenido|tiktok|youtube|insta|reel|short|twitch|kick/)) {
    return await ideasMultiRed(pregunta);
  }
  if (!OPENAI_KEY) return `🤖 *IA LATAM* 💜\n━━━━━━━━━━━━━━━\nEj: ideas tiktok\nEj: ideas youtube\nEj: ideas insta\nEj: ideas twitch`;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: "Eres IA LATAM gamer corta." }, { role: "user", content: pregunta }], max_tokens: 350 })
    });
    const data = await res.json();
    return `🤖 *IA* ✨\n━━━━━━━━━━━━━━━\n\n${data.choices[0].message.content}`;
  } catch (e) { return `❌ ${e.message}`; }
}

// ============================================
// BOT
// ============================================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) console.log(`QR: https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qr)}`);
    if (connection === 'close' && lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot();
  });

  // --------------------------------------------
  // AVISADOR 10 MIN ANTES - CHEQUEO CADA MINUTO
  // --------------------------------------------
  setInterval(async () => {
    const ahora = new Date();
    const horaMX = ahora.getHours();
    const minMX = ahora.getMinutes();
    for (const ev of calendario) {
      if (!ev.hora || ev.avisado) continue;
      let diff = (ev.hora.h * 60 + ev.hora.min) - (horaMX * 60 + minMX);
      if (diff >= 9 && diff <= 11) {
        ev.avisado = true;
        const textoAviso = `🔴 *¡AVISO 10 MIN!* ⏰\n━━━━━━━━━━━━━━━\n📌 ${ev.texto}\n🕐 ${formato12(ev.hora.h, ev.hora.min)} MX\n\n${horariosMundo(ev.hora)}\n\n¡Prepara el stream! 🚀`;
        for (const grupo of gruposActivos) {
          try { await sock.sendMessage(grupo, { text: textoAviso }); } catch {}
        }
      }
      if (diff < -5) ev.avisado = false;
    }
  }, 60 * 1000);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    gruposActivos.add(from);
    const textoOriginal = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const texto = textoOriginal.toLowerCase().trim();

    // --------------------------------------------
    // CALENDARIO CON HORARIO MUNDIAL
    // --------------------------------------------
    if (texto === 'calendario' || texto === 'hola' || texto === 'menu') {
      let lista = "│ ✨ Sin eventos\n│ Ej: agregar Stream PRO 8pm CSGO";
      if (calendario.length) {
        lista = calendario.map(e => {
          let extra = e.hora? `\n│ 🕐 ${formato12(e.hora.h, e.hora.min)} MX` : "";
          return `│ ${e.id}. 📌 ${e.texto}${extra}`;
        }).join('\n│\n');
      }
      await sock.sendMessage(from, { text: `╭━━━ 🌤️ *CALENDARIO LATAM + MUNDIAL* 🌎 ━━━╮\n${lista}\n╰━━━━━━━━━━━━━━━╯\n\nEj: agregar Stream PRO 8pm\nEj: horario 8pm` });
      for (const s of streamers) await sock.sendMessage(from, { text: tarjetaEstetica(s) });
      return;
    }

    // --------------------------------------------
    // HORARIO MUNDIAL MANUAL
    // --------------------------------------------
    if (texto.startsWith('horario ')) {
      const h = parsearHora(textoOriginal);
      if (!h) { await sock.sendMessage(from, { text: "❌ Ej: horario 8pm\nEj: horario 20:30" }); return; }
      await sock.sendMessage(from, { text: `🕐 *HORARIO MUNDIAL* 🌎\n━━━━━━━━━━━━━━━\nBase: ${formato12(h.h, h.min)} MX\n\n${horariosMundo(h)}\n\nEj: agregar Stream 8pm` });
      return;
    }

    // --------------------------------------------
    // AGREGAR CANAL
    // --------------------------------------------
    if (texto.startsWith('agregar canal')) {
      const partes = textoOriginal.split(' ');
      const nombre = partes[2]?.toUpperCase();
      const juego = partes[3] || "Variedad";
      if (!nombre) { await sock.sendMessage(from, { text: `❌ Ej: agregar canal NOMBRE JUEGO LINK\n━━━━━━━━━━━━━━━\nEj: agregar canal PRO CSGO https://twitch.tv/pro` }); return; }
      const links = detectarLinks(textoOriginal);
      if (!links.twitch &&!links.kick &&!links.tiktok &&!links.youtube) { await sock.sendMessage(from, { text: "❌ Pon 1 link\nEj: agregar canal PRO CSGO https://twitch.tv/pro" }); return; }
      streamers.push({ id: contador++, nombre, juego,...links, owner: sender });
      await sock.sendMessage(from, { text: `✅ Agregado\n━━━━━━━━━━━━━━━\n${tarjetaEstetica(streamers[streamers.length-1])}` });
      return;
    }

    // --------------------------------------------
    // AGREGAR EVENTO CON HORA + AVISO
    // --------------------------------------------
    if (texto.startsWith('agregar ')) {
      const contenido = textoOriginal.substring(8).trim();
      if (!contenido) { await sock.sendMessage(from, { text: "❌ Ej: agregar Stream PRO 8pm CSGO" }); return; }
      const hora = parsearHora(contenido);
      calendario.push({ id: contador++, texto: contenido, owner: sender, from, hora, avisado: false });
      let resp = `✅ Agregado ID ${contador-1}: ${contenido}`;
      if (hora) resp += `\n━━━━━━━━━━━━━━━\n🕐 *HORARIOS MUNDIALES:*\n${horariosMundo(hora)}\n━━━━━━━━━━━━━━━\n🔔 Te aviso 10 min antes`;
      else resp += `\n\n💡 Pon hora para aviso\nEj: agregar Stream 8pm`;
      await sock.sendMessage(from, { text: resp });
      return;
    }

    if (texto.startsWith('borrar ')) {
      if (texto === 'borrar todo') {
        if (sender!== NUMERO_ADMIN) { await sock.sendMessage(from, { text: "❌ Solo admin" }); return; }
        calendario = []; streamers = []; contador = 1;
        await sock.sendMessage(from, { text: "🗑️ Todo borrado" });
      } else {
        const num = parseInt(texto.replace('borrar','').trim());
        if (isNaN(num)) { await sock.sendMessage(from, { text: "❌ Ej: borrar 2" }); return; }
        let item = calendario.find(x=>x.id===num) || streamers.find(x=>x.id===num);
        if (!item) { await sock.sendMessage(from, { text: `❌ No existe ID ${num}` }); return; }
        if (item.owner!== sender && sender!== NUMERO_ADMIN) { await sock.sendMessage(from, { text: "🔒 Solo tuyo" }); return; }
        calendario = calendario.filter(x=>x.id!==num);
        streamers = streamers.filter(x=>x.id!==num);
        await sock.sendMessage(from, { text: `✅ Borrado ID ${num}` });
      }
      return;
    }

    if (texto === 'canales') {
      if (!streamers.length) { await sock.sendMessage(from, { text: "🔗 Sin canales\nEj: agregar canal PRO CSGO https://twitch.tv/pro" }); return; }
      for (const s of streamers) await sock.sendMessage(from, { text: tarjetaEstetica(s) });
      return;
    }

    if (texto === 'ayuda') {
      await sock.sendMessage(from, {
        text: `📖 *AYUDA + MUNDIAL + AVISOS*\n━━━━━━━━━━━━━━━\n*CALENDARIO MUNDIAL*\nEj: calendario\nEj: horario 8pm -> convierte a todo el mundo\n\n*AGREGAR CON AVISO*\nEj: agregar Stream PRO 8pm CSGO\n-> Guarda y avisa 10 min antes\n-> Muestra hora MX, COL, USA, ARG, ESP\n\n*CANAL*\nEj: agregar canal PRO CSGO https://twitch.tv/pro\n\n*BORRAR*\nEj: borrar 2\nEj: borrar todo\n\n*IA*\nEj: ideas tiktok\nEj: ideas youtube\nEj: ideas insta\nEj: ideas twitch`
      });
      return;
    }

    if (textoOriginal.length > 1) {
      await sock.sendMessage(from, { text: "🤖 ✨..." });
      const r = await preguntarIA(textoOriginal);
      await sock.sendMessage(from, { text: r });
    }
  });
}
startBot();
