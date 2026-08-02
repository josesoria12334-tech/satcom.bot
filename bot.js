import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import { createClient } from '@supabase/supabase-js'

// --- CONFIG SUPABASE ---
const supabase = createClient(
  'https://ragxduxdwylyjmspzjxbv.supabase.co',
  'sb_publishable_94IZwRIbVdQzDrI4KxTtTQ__hte1QQ0'
)

const INVITE_CODE = 'IgyfxZYyujL2wbESxiDhO7' // Tu grupo CREATOR GUILD
let CHAT_PERMITIDO = null

async function startBot(){
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ 
        auth: state, 
        printQRInTerminal: false, 
        browser: ["Ubuntu", "Chrome", "22.04.4"] 
    })
    
    sock.ev.on('creds.update', saveCreds)

    // --- 1. CODIGO DE 8 DIGITOS EN VEZ DE QR ---
    if(!sock.authState.creds.registered){
        const phoneNumber = '529381256943' // Tu numero sin + 
        setTimeout(async ()=>{
            try{
                const code = await sock.requestPairingCode(phoneNumber)
                console.log('========================================')
                console.log(`TU CODIGO CREATOR GUILD ES: ${code}`)
                console.log('WhatsApp > Dispositivos vinculados > Vincular con numero')
                console.log('========================================')
            }catch(e){ console.log('Error codigo', e.message) }
        }, 3000)
    }

    sock.ev.on('connection.update', async (u)=>{
        const { connection, lastDisconnect } = u
        if(connection === 'open'){
            console.log('✅ BOT CREATOR GUILD ONLINE - MODO LIMPIO')
            try{
                const info = await sock.groupGetInviteInfo(INVITE_CODE)
                CHAT_PERMITIDO = info.id
                console.log('🔒 BLOQUEADO PARA GRUPO:', info.subject, CHAT_PERMITIDO)
            }catch(e){ console.log('Detecto grupo al primer mensaje') }
        }
        if(connection === 'close'){
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            if(shouldReconnect) startBot()
        }
    })

    sock.ev.on('messages.upsert', async ({messages})=>{
        try{
            const msg = messages[0]
            if(!msg.message || msg.key.fromMe) return
            
            const jid = msg.key.remoteJid
            const nombre = msg.pushName || 'Alguien'
            const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim()

            // --- 2. BLOQUEO A UN SOLO GRUPO ---
            if(!CHAT_PERMITIDO && jid.endsWith('@g.us')) CHAT_PERMITIDO = jid
            if(CHAT_PERMITIDO && jid !== CHAT_PERMITIDO) return

            // --- 3. CALENDARIO CON ESTILO ---
            if(texto.toLowerCase() === 'calendario'){
                // Auto-borra el comando "calendario" para limpieza
                try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}

                const { data } = await supabase.from('calendario').select('*').order('hora')
                if(!data || data.length === 0){
                    await sock.sendMessage(jid, {text:'📅 *CALENDARIO CREATOR GUILD*\n━━━━━━━━━━━━━━━\n\n😴 *Vacío por ahora*\n\n✏️ Agrega con:\n`agregar 18:00 Nombre del evento`'})
                    return
                }
                let r='🛡️ *CALENDARIO CREATOR GUILD*\n'
                r+='━━━━━━━━━━━━━━━\n\n'
                data.forEach((e,i)=>{
                    const quien = e.agregado_por || 'alguien'
                    r+=`🔹 *${i+1}. ${e.hora}* - ${e.evento}\n👤 _por ${quien}_\n\n`
                })
                r+='━━━━━━━━━━━━━━━\n'
                r+='✏️ *Agregar:* `agregar HORA EVENTO`\n'
                r+='🗑️ *Borrar:* `borrar NUMERO`'
                await sock.sendMessage(jid, {text:r})
            }

            // --- 4. AGREGAR CON NOMBRE + AUTO-BORRADO ---
            if(texto.toLowerCase().startsWith('agregar ')){
                const m=texto.match(/agregar\s+(\d{1,2}:\d{2})\s+(.+)/i)
                if(!m){
                    const err = await sock.sendMessage(jid, {text:'❌ Formato mal. Usa: *agregar 18:00 Nombre del evento*'})
                    setTimeout(()=> sock.sendMessage(jid, {delete: err.key}).catch(()=>{}), 10000)
                    return
                }

                await supabase.from('calendario').insert([{ hora: m[1], evento: m[2], agregado_por: nombre }]).then(async res=>{
                    if(res.error) await supabase.from('calendario').insert([{ hora: m[1], evento: m[2] }])
                })

                // Borra mensaje del usuario al instante
                try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){ console.log('Necesito ser ADMIN para borrar') }

                // Confirmación con estilo
                const sent = await sock.sendMessage(jid, {text:`✅ *¡Agregado a CREATOR GUILD!*\n\n🕒 *Hora:* ${m[1]}\n📌 *Evento:* ${m[2]}\n👤 *Por:* ${nombre}\n\n_🗑️ Este mensaje se borrará en 10s_`})

                // Borra confirmación a los 10s
                setTimeout(async ()=>{
                    try{ await sock.sendMessage(jid, { delete: sent.key }) }catch(e){}
                }, 10000)
            }

            // --- 5. BORRAR CON AUTO-BORRADO ---
            if(texto.toLowerCase().startsWith('borrar ')){
                const num=parseInt(texto.replace(/borrar /i,''))
                const { data } = await supabase.from('calendario').select('*').order('hora')
                if(data && data[num-1]){
                    await supabase.from('calendario').delete().eq('id', data[num-1].id)
                    try{ await sock.sendMessage(jid, { delete: msg.key }) }catch(e){}
                    const sent = await sock.sendMessage(jid, {text:`🗑️ *Borrado de CREATOR GUILD #${num}*\n\n📌 _${data[num-1].evento}_\n👤 _Borrado por ${nombre}_\n\n_🗑️ Se borra en 10s_`})
                    setTimeout(async ()=>{
                        try{ await sock.sendMessage(jid, { delete: sent.key }) }catch(e){}
                    }, 10000)
                }
            }

        }catch(e){ console.log('Error:', e.message) }
    })
}
startBot()
