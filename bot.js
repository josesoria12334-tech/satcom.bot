import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://ragxduxdwylyjmspzjbv.supabase.co','sb_publishable_94iZwRIbVdQzDrI4KxTtTQ__hte1Q00')

// CONFIGURA TUS PAISES AQUI - cambia banderas y offset si quieres
const PAISES = [
  { emoji: '🇲🇽', nombre: 'MX', offset: -6 },
  { emoji: '🇨🇴', nombre: 'CO', offset: -5 },
  { emoji: '🇦🇷', nombre: 'AR', offset: -3 },
  { emoji: '🇪🇸', nombre: 'ES', offset: 2 },
  { emoji: '🇺🇸', nombre: 'US-ET', offset: -4 },
]

const INVITE_CODE = 'IgyfxZYyujL2wbESxiDhO7'
let CHAT_PERMITIDO = null

function convertirHoras(horaBase){
  const [h,m] = horaBase.split(':').map(Number)
  return PAISES.map(p=>{
    let nh = h + (p.offset - (-6)) // base es -6
    if(nh < 0) nh+=24
    if(nh >= 24) nh-=24
    return `${p.emoji} ${String(nh).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  }).join(' | ')
}

async function startBot(){
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state, browser: ["Ubuntu", "Chrome", "22.04.4"] })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async (u)=>{
        if(u.qr) console.log(`LINK QR: https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(u.qr)}`)
        if(u.connection === 'open'){
            console.log('✅ BOT SEMANAL ONLINE');
            try{ const info = await sock.groupGetInviteInfo(INVITE_CODE); CHAT_PERMITIDO = info.id }catch(e){}
        }
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
            if(!data || data.length===0){ await sock.sendMessage(jid, {text:'📅 *VACIO*\nEj:!agregar LUNES 18:00 GP Belgica'}); return }
            let r='🗓️ *CALENDARIO CREATOR GUILD*\n━━━━━━━━━━━━━━━\n_Horas base Cd. Juárez_\n\n'
            data.forEach((e,i)=>{
              r+=`*${i+1}.* 📍 *${e.dia}* *${e.hora}* - ${e.evento}\n ${convertirHoras(e.hora)}\n\n`
            })
            r+=`_Borrar:!borrar 2 |!borrar todo_`
            await sock.sendMessage(jid, {text:r})
        }

        if(texto.startsWith('agregar ')){
            const m = textoRaw.match(/!?agregar\s+(?:(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\s+)?(\d{1,2}:\d{2})\s+(.+)/i)
            if(!m) return
            let dia = (m[1]||'LUNES').toUpperCase().replace('MIÉRCOLES','MIERCOLES').replace('SÁBADO','SABADO')
            await supabase.from('calendario').insert([{dia, hora: m[2], evento: m[3]}])
            try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}
            await sock.sendMessage(jid, {text:`✅ Agregado ${dia} ${m[2]} - ${m[3]}\n${convertirHoras(m[2])}`})
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
            const aBorrar = data[num-1]
            await supabase.from('calendario').delete().eq('id', aBorrar.id)
            try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}
            await sock.sendMessage(jid, {text:`🗑️ Borrado #${num}`})
        }
    })
}
startBot()
