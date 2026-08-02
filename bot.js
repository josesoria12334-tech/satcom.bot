import fs from 'fs'
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
    sock.ev.on('connection.update', async (u)=>{
        if(u.qr){
            console.log(`\n\nLINK QR: https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(u.qr)}\n\n`)
        }
        if(u.connection === 'open'){
            console.log('✅ BOT SEMANAL ONLINE');
            try{ const info = await sock.groupGetInviteInfo(INVITE_CODE); CHAT_PERMITIDO = info.id; console.log('Grupo:', CHAT_PERMITIDO) }catch(e){ console.log('No pude obtener grupo:', e.message) }
        }
        if(u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot()
    })

    sock.ev.on('messages.upsert', async ({messages})=>{
        try{
        const msg = messages[0]; if(!msg.message || msg.key.fromMe) return
        const jid = msg.key.remoteJid; const nombre = msg.pushName || 'Alguien'
        const textoRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim()
        const texto = textoRaw.toLowerCase()
        if(!CHAT_PERMITIDO && jid.endsWith('@g.us')) CHAT_PERMITIDO = jid
        if(CHAT_PERMITIDO && jid!== CHAT_PERMITIDO) return

        console.log(`Mensaje recibido: ${textoRaw} en ${jid}`)

        if(texto === 'calendario'){
            try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}
            const { data, error } = await supabase.from('calendario').select('*').order('hora')
            console.log('Calendario data:', data, 'error:', error)
            if(error){ await sock.sendMessage(jid, {text:`Error Supabase: ${error.message}`}); return }
            if(!data || data.length===0){ await sock.sendMessage(jid, {text:'📅 *CALENDARIO SEMANAL*\n\n😴 Vacío\n✏️ Ej: `agregar LUNES 18:00 GP Belgica`'}); return }
            let r='🗓️ *CALENDARIO CREATOR GUILD - SEMANA*\n━━━━━━━━━━━━━━━\n\n'
            for(const d of DIAS){ const ev = data.filter(x=>x.dia===d); if(ev.length>0){ r+=`📍 *${d}*\n`; ev.forEach(e=>{ r+=` 🔹 *${e.hora}* - ${e.evento}\n` }) ; r+=`\n` } }
            await sock.sendMessage(jid, {text:r})
        }
        if(texto.startsWith('agregar ')){
            const m = textoRaw.match(/agregar\s+(?:(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\s+)?(\d{1,2}:\d{2})\s+(.+)/i)
            if(!m){ await sock.sendMessage(jid, {text:'❌ Formato: `agregar LUNES 18:00 GP Belgica`'}); return }
            let dia = (m[1]||'LUNES').toUpperCase().replace('MIÉRCOLES','MIERCOLES').replace('SÁBADO','SABADO')
            console.log(`Intentando guardar: ${dia} ${m[2]} ${m[3]}`)
            const { data, error } = await supabase.from('calendario').insert([{ dia, hora: m[2], evento: m[3], agregado_por: nombre }]).select()
            if(error){
                console.log('Error insert:', error)
                await sock.sendMessage(jid, {text:`❌ No guardó: ${error.message}\n\nVe a Supabase > SQL Editor y corre: ALTER TABLE calendario DISABLE ROW LEVEL SECURITY;`})
                return
            }
            console.log('Guardado OK:', data)
            try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}
            const sent = await sock.sendMessage(jid, {text:`✅ Agregado ${dia} ${m[2]} - ${m[3]}`})
            setTimeout(()=> sock.sendMessage(jid, {delete: sent.key}).catch(()=>{}), 8000)
        }
        if(texto.startsWith('borrar todo')){
            const { error } = await supabase.from('calendario').delete().neq('id',0)
            if(error) await sock.sendMessage(jid, {text:`Error borrando: ${error.message}`})
            else { try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}; await sock.sendMessage(jid, {text:'🗑️ Calendario borrado'}) }
        }
        }catch(e){ console.log('Error general:', e) }
    })
}
startBot()
