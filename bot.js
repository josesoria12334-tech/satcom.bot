import fs from 'fs'
try{ fs.rmSync('auth', {recursive:true, force:true}); console.log('auth borrada') }catch(e){}
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://ragxduxdwylyjmspzjxbv.supabase.co','sb_publishable_94IZwRIbVdQzDrI4KxTtTQ__hte1QQ0')
const INVITE_CODE = 'IgyfxZYyujL2wbESxiDhO7'
let CHAT_PERMITIDO = null
const DIAS = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO']

async function startBot(){
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state, printQRInTerminal: false, browser: ["Ubuntu", "Chrome", "22.04.4"] })
    sock.ev.on('creds.update', saveCreds)

    if(!sock.authState.creds.registered){
        setTimeout(async ()=>{
            try{
                const code = await sock.requestPairingCode('526563235799')
                console.log(`\n\n============================\nCODIGO: ${code}\n============================\n\n`)
            }catch(e){ console.log(e.message) }
        }, 5000)
    }

    sock.ev.on('connection.update', async (u)=>{
        if(u.connection === 'open'){ console.log('✅ BOT SEMANAL ONLINE'); try{ const info = await sock.groupGetInviteInfo(INVITE_CODE); CHAT_PERMITIDO = info.id }catch(e){} }
        if(u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot()
    })

    sock.ev.on('messages.upsert', async ({messages})=>{
        const msg = messages[0]; if(!msg.message || msg.key.fromMe) return
        const jid = msg.key.remoteJid; const nombre = msg.pushName || 'Alguien'
        const textoRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim()
        const texto = textoRaw.toLowerCase()
        if(!CHAT_PERMITIDO && jid.endsWith('@g.us')) CHAT_PERMITIDO = jid
        if(CHAT_PERMITIDO && jid!== CHAT_PERMITIDO) return

        if(texto === 'calendario'){
            try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}
            const { data } = await supabase.from('calendario').select('*').order('hora')
            if(!data || data.length===0){ await sock.sendMessage(jid, {text:'📅 *CALENDARIO SEMANAL*\n\n😴 Vacío\n✏️ Ej: `agregar LUNES 18:00 GP Belgica`'}); return }
            let r='🗓️ *CALENDARIO CREATOR GUILD - SEMANA*\n━━━━━━━━━━━━━━━\n\n'
            for(const d of DIAS){ const ev = data.filter(x=>x.dia===d); if(ev.length>0){ r+=`📍 *${d}*\n`; ev.forEach(e=>{ r+=` 🔹 *${e.hora}* - ${e.evento}\n` }) ; r+=`\n` } }
            await sock.sendMessage(jid, {text:r})
        }
        if(texto.startsWith('agregar ')){
            const m = textoRaw.match(/agregar\s+(?:(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\s+)?(\d{1,2}:\d{2})\s+(.+)/i)
            if(!m) return
            let dia = (m[1]||'LUNES').toUpperCase().replace('MIÉRCOLES','MIERCOLES').replace('SÁBADO','SABADO')
            await supabase.from('calendario').insert([{ dia, hora: m[2], evento: m[3], agregado_por: nombre }])
            try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}
            const sent = await sock.sendMessage(jid, {text:`✅ Agregado ${dia} ${m[2]} - ${m[3]}`})
            setTimeout(()=> sock.sendMessage(jid, {delete: sent.key}).catch(()=>{}), 5000)
        }
        if(texto.startsWith('borrar todo')){ await supabase.from('calendario').delete().neq('id',0); try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){} }
    })
}
startBot()
