const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');

// TU SUPABASE YA CONECTADO
const supabase = createClient(
  'https://ragxduxdwylyjmspzjbv.supabase.co',
  'sb_publishable_94iZwRIbVdQzDrI4KxTtTQ__hte1Q00'
);

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', (qr) => {
  console.log('ESCANEA ESTE QR CON TU WHATSAPP:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => console.log('✅ BOT SATCOM MASTER LATAM ONLINE'));

function convertirHoras(texto) {
  return texto
   .replace(/(\d{1,2}:00)/g, (hora) => {
      const h = parseInt(hora.split(':')[0]);
      const mx = h; const co = h+1; const cl = h+2; const ar = h+2; const br = h+3;
      return `🇲🇽 ${mx}:00 = 🇨🇴/🇵🇪 ${co}:00 = 🇨🇱/🇻🇪 ${cl}:00 = 🇦🇷 ${ar}:00 = 🇧🇷 ${br}:00`;
    });
}

client.on('message', async msg => {
  const text = msg.body.toLowerCase().trim();

  if (text.startsWith('calendario @') || text.startsWith('calendario ')) {
    const username = text.replace('calendario @','').replace('calendario','').trim();
    const { data } = await supabase.from('creadores').select('*').eq('username', username).single();

    if (!data) {
      msg.reply(`❌ No encontré a @${username}\n\nRegístrate en: satcom-master-latam.netlify.app`);
      return;
    }

    let cal = data.calendario.replaceAll('|','\n');
    cal = convertirHoras(cal);

    msg.reply(`🛰️ *${data.nombre || username}* - @${data.username}\n\n📅 *CALENDARIO 100% ONLINE - LATAM*\nHorario base CDMX (GMT-6) convertido auto:\n\n${cal}\n\n🎮 TikTok: @${data.tiktok || username}\nTwitch: ${data.twitch || username}\n\nLATAM • 100% Online • GMT-6 | GMT-5 | GMT-4 | GMT-3`);
  }

  if (text === 'creadores' || text === 'lista') {
    const { data } = await supabase.from('creadores').select('username');
    msg.reply(`🔥 *CREADORES REGISTRADOS LATAM*:\n\n${data.map(c=>`• @${c.username}`).join('\n')}\n\nEscribe CALENDARIO @usuario para ver su horario`);
  }
});

client.initialize();