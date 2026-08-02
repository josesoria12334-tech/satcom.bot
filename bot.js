import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://ragxduxdwylyjmspzjbv.supabase.co','sb_publishable_94iZwRIbVdQzDrI4KxTtTQ__hte1Q00')

const INVITE_CODE = 'IgyfxZYyujL2wbESxiDhO7'
let CHAT_PERMITIDO = null
const DIAS = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO']

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
        const texto = textoRaw.toLowerCase()
        if(CHAT_PERMITIDO && jid!== CHAT_PERMITIDO && jid.endsWith('@g.us')) return

        if(texto === 'calendario'){
            try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}
            const { data, error } = await supabase.from('calendario').select('*').order('created_at')
            if(error){ await sock.sendMessage(jid, {text:`❌ ${error.message}`}); return }
            if(!data || data.length===0){ await sock.sendMessage(jid, {text:'📅 VACIO. Ej: agregar LUNES 18:00 GP Belgica'}); return }
            let r='🗓️ *CALENDARIO CREATOR GUILD*\n━━━━━━━━━━━━━━━\n\n'
            for(const d of DIAS){ const ev = data.filter(x=>x.dia===d); if(ev.length>0){ r+=`📍 *${d}*\n`; ev.forEach(e=>{ r+=` 🔹 *${e.hora}* - ${e.evento}\n` }) ; r+=`\n` } }
            await sock.sendMessage(jid, {text:r})
        }
        if(texto.startsWith('agregar ')){
            const m = textoRaw.match(/agregar\s+(?:(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\s+)?(\d{1,2}:\d{2})\s+(.+)/i)
            if(!m){ await sock.sendMessage(jid, {text:'❌ Usa: agregar LUNES 18:00 GP Belgica'}); return }
            let dia = (m[1]||'LUNES').toUpperCase().replace('MIÉRCOLES','MIERCOLES').replace('SÁBADO','SABADO')
            const { error } = await supabase.from('calendario').insert([{dia, hora: m[2], evento: m[3]}])
            if(error){ await sock.sendMessage(jid, {text:`❌ ${error.message}`}); return }
            try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}
            await sock.sendMessage(jid, {text:`✅ Agregado ${dia} ${m[2]} - ${m[3]}`})
        }
        if(texto.startsWith('borrar todo')){
            await supabase.from('calendario').delete().neq('id',0)
            try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}
            await sock.sendMessage(jid, {text:'🗑️ Borrado'})
        }
    })
}
startBot()
