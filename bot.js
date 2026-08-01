import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ragxduxdwylyjmspzjxbv.supabase.co',
  'sb_publishable_94IZwRIbVdQzDrI4KxTtTQ__hte1QQ0'
)

const INVITE_CODE = 'IgyfxZYyujL2wbESxiDhO7'
let CHAT_PERMITIDO = null

function convertirHoras(t){
  if(!t) return ''
  return t.replace(/(\d{1,2}:\d{2})/g, (m)=>{
    const h=parseInt(m.split(':')[0])
    return `MX ${h}:00 | CO ${h+1}:00 | AR ${h+2}:00`
  })
}

async function startBot(){
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state, printQRInTerminal: false })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update)=>{
        const { connection, lastDisconnect, qr } = update
        if(qr){
            console.log('ESCANEA ESTE QR:')
            qrcode.generate(qr, {small:false})
        }
        if(connection === 'open'){
            console.log('✅ BOT SATCOM ONLINE')
            try{
                const info = await sock.groupGetInviteInfo(INVITE_CODE)
                CHAT_PERMITIDO = info.id
                console.log('🔒 BLOQUEADO PARA GRUPO:', CHAT_PERMITIDO, info.subject)
            }catch(e){
                console.log('⚠️ No pude leer el grupo del link, usaré cualquier grupo donde me escriban. Asegúrate que tu número está en el grupo')
                // Si falla, no bloqueamos aún, dejamos que el primer mensaje de grupo lo defina
            }
        }
        if(connection === 'close'){
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
            console.log('Conexión cerrada, reconectando:', shouldReconnect)
            if(shouldReconnect) startBot()
        }
    })

    sock.ev.on('messages.upsert', async ({messages})=>{
        try{
            const msg = messages[0]
            if(!msg.message || msg.key.fromMe) return
            const jid = msg.key.remoteJid
            const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim()
            if(!texto) return

            // Si no pudimos obtener el ID antes, lo tomamos del primer grupo que hable
            if(!CHAT_PERMITIDO && jid.endsWith('@g.us')){
                CHAT_PERMITIDO = jid
                console.log('🔒 Auto-bloqueado al primer grupo que habló:', jid)
            }

            if(CHAT_PERMITIDO && jid!== CHAT_PERMITIDO) return

            console.log(`📩 ${jid}: ${texto}`)

            if(texto.toLowerCase() === 'calendario'){
                const { data } = await supabase.from('calendario').select('*').order('hora')
                if(!data || data.length===0){
                    await sock.sendMessage(jid, {text:'📅 *CALENDARIO VACIO*\n\nAgrega con:\n`agregar 18:00 GP Belgica Qualy`'})
                    return
                }
                let r='📅 *CALENDARIO SATCOM LATAM*\n\n'
                data.forEach((e,i)=>{ r+=`${i+1}. ${convertirHoras(e.hora)} - ${e.evento}\n` })
                r+='\n_Agregar: agregar HORA EVENTO_\n_Borrar: borrar NUMERO_'
                await sock.sendMessage(jid, {text:r})
            }

            if(texto.toLowerCase().startsWith('agregar ')){
                const m=texto.match(/agregar\s+(\d{1,2}:\d{2})\s+(.+)/i)
                if(!m){ await sock.sendMessage(jid, {text:'❌ Usa: `agregar 18:00 Nombre evento`'}); return }
                await supabase.from('calendario').insert([{hora:m[1], evento:m[2]}])
                await sock.sendMessage(jid, {text:`✅ Agregado: ${m[1]} - ${m[2]}`})
            }

            if(texto.toLowerCase().startsWith('borrar ')){
                const num=parseInt(texto.replace(/borrar /i,''))
                const { data } = await supabase.from('calendario').select('*').order('hora')
                if(data && data[num-1]){
                    await supabase.from('calendario').delete().eq('id', data[num-1].id)
                    await sock.sendMessage(jid, {text:`🗑️ Borrado #${num}`})
                }else{
                    await sock.sendMessage(jid, {text:'❌ Ese número no existe'})
                }
            }
        }catch(err){
            console.log('Error en mensaje:', err.message)
        }
    })
}
startBot()
