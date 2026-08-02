import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://ragxduxdwylyjmspzjbv.supabase.co','sb_publishable_94iZwRIbVdQzDrI4KxTtTQ__hte1Q00')

const PAISES = [
  { emoji: '🇲🇽', offset: -6 },
  { emoji: '🇨🇴', offset: -5 },
  { emoji: '🇵🇪', offset: -5 },
  { emoji: '🇦🇷', offset: -3 },
  { emoji: '🇨🇱', offset: -4 },
  { emoji: '🇪🇸', offset: 2 },
]

const INVITE_CODE = 'IgyfxZYyujL2wbESxiDhO7'
let CHAT_PERMITIDO = null

function convertirHoras(horaBase){
  const [h,m] = horaBase.split(':').map(Number)
  return PAISES.map(p=>{
    let nh = h + (p.offset - (-5))
    if(nh < 0) nh+=24
    if(nh >= 24) nh-=24
    return `${p.emoji} ${String(nh).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  }).join(' | ')
}

function extraerCanal(link){
  try{
    if(!link) return null
    const match = link.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i)
    return match? match[1] : null
  }catch(e){ return null }
}

async function startBot(){
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state, browser: ["Ubuntu", "Chrome", "22.04.4"] })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async (u)=>{
        if(u.qr) console.log(`LINK QR: https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(u.qr)}`)
        if(u.connection === 'open'){ console.log('✅ BOT ONLINE'); try{ CHAT_PERMITIDO = (await sock.groupGetInviteInfo(INVITE_CODE)).id }catch(e){} }
        if(u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot()
    })

    sock.ev.on('messages.upsert', async ({messages})=>{
        const msg = messages[0]; if(!msg.message || msg.key.fromMe) return
        const jid = msg.key.remoteJid
        const textoRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim()
        let texto = textoRaw.toLowerCase()
        if(texto.startsWith('!')) texto = texto.substring(1)
        if(CHAT_PERMITIDO && jid!== CHAT_PERMITIDO && jid.endsWith('@g.us')) return

        if(texto === 'calendario'){
            try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}
            const { data } = await supabase.from('calendario').select('*').order('created_at')
            if(!data || data.length===0){ await sock.sendMessage(jid, {text:'📅 *VACIO*\nEj:!agregar LUNES 18:00 GP Belgica https://twitch.tv/ibai'}); return }
            let r='🗓️ *CALENDARIO CREATOR GUILD*\n🕐 *Hora base LATAM*\n━━━━━━━━━━━━━━━\n\n'
            data.forEach((e,i)=>{
              r+=`*${i+1}.* 📍 *${e.dia}* *${e.hora}* - ${e.evento}\n`
              if(e.canal) r+=` 🟣 @${e.canal} - ${e.link}\n`
              else if(e.link) r+=` 🔗 ${e.link}\n`
              r+=` ${convertirHoras(e.hora)}\n\n`
            })
            await sock.sendMessage(jid, {text:r})
        }

        if(texto.startsWith('agregar ')){
            const m = textoRaw.match(/!?agregar\s+(?:(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\s+)?(\d{1,2}:\d{2})\s+(.+)/i)
            if(!m) return
            let dia = (m[1]||'LUNES').toUpperCase().replace('MIÉRCOLES','MIERCOLES').replace('SÁBADO','SABADO')
            let eventoCompleto = m[3]
            let link = null, canal = null
            const urlMatch = eventoCompleto.match(/(https?:\/\/[^\s]+|twitch\.tv\/[^\s]+)/i)
            if(urlMatch){
              link = urlMatch[0]
              if(!link.startsWith('http')) link = 'https://' + link
              canal = extraerCanal(link)
              eventoCompleto = eventoCompleto.replace(urlMatch[0], '').trim()
            }
            await supabase.from('calendario').insert([{dia, hora: m[2], evento: eventoCompleto, link, canal}])
            try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}
            await sock.sendMessage(jid, {text:`✅ Agregado ${dia} ${m[2]} LATAM - ${eventoCompleto}${canal?`\n🟣 @${canal}`:''}`})
        }

        if(texto === 'borrar todo'){
            await supabase.from('calendario').delete().neq('id',0)
            try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}
            await sock.sendMessage(jid, {text:'🗑️ Borrado todo'})
        }
        if(texto.startsWith('borrar ') && texto!== 'borrar todo'){
            const num = parseInt(texto.replace('borrar','').trim())
            if(isNaN(num)) return
            const { data } = await supabase.from('calendario').select('*').order('created_at')
            if(!data || data.length < num) return
            await supabase.from('calendario').delete().eq('id', data[num-1].id)
            try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}
            await sock.sendMessage(jid, {text:`🗑️ Borrado #${num}`})
        }
    })
}
startBot()
