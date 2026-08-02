import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://ragxduxdwylyjmspzjbv.supabase.co','sb_publishable_94iZwRIbVdQzDrI4KxTtTQ__hte1Q00')

const PAISES = [
  { emoji: '🇲🇽', offset: -6 },
  { emoji: '🇨🇴', offset: -5 },
  { emoji: '🇦🇷', offset: -3 },
  { emoji: '🇪🇸', offset: 2 },
]

function convertirHoras(horaBase){
  const [h,m] = horaBase.split(':').map(Number)
  return PAISES.map(p=>{
    let nh = h + (p.offset - (-5))
    if(nh < 0) nh+=24
    if(nh >= 24) nh-=24
    return `${p.emoji} ${String(nh).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  }).join(' | ')
}

async function buscarCreador(texto){
  const { data } = await supabase.from('creadores').select('*')
  if(!data) return null
  const lower = texto.toLowerCase()
  return data.find(c => lower.includes(c.username.toLowerCase()))
}

async function esAdmin(sock, jid, senderId){
  try{
    if(!jid.endsWith('@g.us')) return true
    const metadata = await sock.groupMetadata(jid)
    const participant = metadata.participants.find(p => p.id === senderId)
    return participant && (participant.admin === 'admin' || participant.admin === 'superadmin')
  }catch(e){ return false }
}

async function startBot(){
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state, browser: ["Ubuntu", "Chrome", "22.04.4"] })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async (u)=>{
        if(u.qr) console.log(`QR: https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(u.qr)}`)
        if(u.connection === 'open') console.log('✅ BOT ONLINE')
        if(u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot()
    })

    sock.ev.on('messages.upsert', async ({messages})=>{
        const msg = messages[0]; if(!msg.message || msg.key.fromMe) return
        const jid = msg.key.remoteJid
        const senderId = msg.key.participant || msg.key.remoteJid
        const textoRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim()
        let texto = textoRaw.toLowerCase()
        if(texto.startsWith('!')) texto = texto.substring(1)

        if(texto === 'ayuda'){
            await sock.sendMessage(jid, {text: `!calendario\n!agregar LUNES 18:00 satcommaster GP Belgica\n!borrar 1\n!borrar todo (solo admin)`})
        }

        if(texto === 'calendario'){
            const { data, error } = await supabase.from('calendario').select('*').order('created_at')
            if(error){ await sock.sendMessage(jid, {text:`❌ Error leyendo calendario: ${error.message}`}); return }
            if(!data || data.length===0){ await sock.sendMessage(jid, {text:'📅 VACIO'}); return }
            let r='🗓️ *CALENDARIO*\n\n'
            for(const e of data){
              const creador = await buscarCreador(e.canal || e.evento || '')
              let tituloLimpio = e.evento || ''
              if(creador){ tituloLimpio = tituloLimpio.replace(new RegExp(creador.username, 'gi'), '').trim() }
              if(tituloLimpio === '') tituloLimpio = 'Directo'
              r+=`*${data.indexOf(e)+1}.* 📍 *${e.dia}* *${e.hora}* - ${tituloLimpio}\n`
              if(creador){ r+=` 👤 ${creador.nombre}\n 🟣 ${creador.twitch||''}\n 🎵 ${creador.tiktok||''}\n 🟢 ${creador.kick||''}\n` }
              r+=` ${convertirHoras(e.hora)}\n\n`
            }
            await sock.sendMessage(jid, {text:r})
        }

        if(texto.startsWith('agregar ')){
            const m = textoRaw.match(/!?agregar\s+(?:(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\s+)?(\d{1,2}:\d{2})\s+(.+)/i)
            if(!m){ await sock.sendMessage(jid, {text:'❌ Usa:!agregar LUNES 18:00 satcommaster GP Belgica'}); return }
            let dia = (m[1]||'LUNES').toUpperCase().replace('MIÉRCOLES','MIERCOLES').replace('SÁBADO','SABADO')
            let eventoCompleto = m[3]
            const creador = await buscarCreador(eventoCompleto)
            let canal = creador?.username || eventoCompleto.split(' ')[0]

            // INTENTO DE GUARDADO CON DEBUG
            const { data, error } = await supabase.from('calendario').insert([{dia, hora: m[2], evento: eventoCompleto, canal, link: creador?.twitch || null}]).select()
            if(error){
              await sock.sendMessage(jid, {text:`❌ ERROR AL GUARDAR:\n${error.message}\n\nEsto pasa porque tu tabla calendario no tiene la columna canal o link. Ve a Supabase > SQL y corre el SQL que te mande.`})
              console.log(error)
            } else {
              await sock.sendMessage(jid, {text:`✅ Guardado: ${dia} ${m[2]} - ${eventoCompleto}`})
            }
        }

        if(texto === 'borrar todo'){
            const admin = await esAdmin(sock, jid, senderId)
            if(!admin){ await sock.sendMessage(jid, {text:'⛔ Solo admins'}); return }
            await supabase.from('calendario').delete().neq('id',0)
            await sock.sendMessage(jid, {text:'🗑️ Borrado todo'})
        }
        if(texto.startsWith('borrar ') && texto!== 'borrar todo'){
            const num = parseInt(texto.replace('borrar','').trim())
            if(isNaN(num)) return
            const { data } = await supabase.from('calendario').select('*').order('created_at')
            if(!data || data.length < num) return
            await supabase.from('calendario').delete().eq('id', data[num-1].id)
            await sock.sendMessage(jid, {text:`🗑️ Borrado #${num}`})
        }
    })
}
startBot()
