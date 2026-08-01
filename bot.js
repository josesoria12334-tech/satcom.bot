import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ragxduxdwylyjmspzjxbv.supabase.co',
  'sb_publishable_94IZwRIbVdQzDrI4KxTtTQ__hte1QQ0'
)

const INVITE_CODE = 'IgyfxZYyujL2wbESxiDhO7' // Tu grupo
let CHAT_PERMITIDO = null

function convertirHoras(texto) {
  if(!texto) return ''
  return texto.replace(/(\d{1,2}:\d{2})/g, (m) => {
    const h = parseInt(m.split(':')[0])
    return `MX ${h}:00 | CO ${h+1}:00 | AR ${h+2}:00`
  })
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state })
    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (u) => {
        if(u.qr) qrcode.generate(u.qr, { small: false })
        if(u.connection === 'open') {
            console.log('✅ BOT ONLINE')
            try {
                // Auto-detecta el ID de tu grupo desde el link
                const groupInfo = await sock.groupGetInviteInfo(INVITE_CODE)
                CHAT_PERMITIDO = groupInfo.id
                console.log('🔒 BLOQUEADO SOLO PARA GRUPO:', CHAT_PERMITIDO, '-', groupInfo.subject)
            } catch(e){
                console.log('No pude obtener ID del grupo, asegurate que tu numero este dentro del grupo', e.message)
            }
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if(!msg.message || msg.key.fromMe) return
        const jid = msg.key.remoteJid
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim()

        // 🔒 Solo permite el grupo del link
        if(CHAT_PERMITIDO && jid!== CHAT_PERMITIDO) return

        console.log('Mensaje en grupo permitido:', texto)

        if(texto.toLowerCase() === 'calendario') {
            const { data } = await supabase.from('calendario').select('*').order('hora')
            if(!data || data.length === 0){
                await sock.sendMessage(jid, { text: '📅 *CALENDARIO SATCOM LATAM*\n\nVacio.\nAgrega: `agregar 18:00 GP Belgica`' })
                return
            }
            let resp = '📅 *CALENDARIO SATCOM LATAM*\n\n'
            data.forEach((e,i) => { resp += `${i+1}. ${convertirHoras(e.hora)} - ${e.evento}\n` })
            resp += '\n_Agregar: agregar HORA EVENTO_\n_Borrar: borrar NUMERO_'
            await sock.sendMessage(jid, { text: resp })
        }

        if(texto.toLowerCase().startsWith('agregar ')) {
            const m = texto.match(/agregar\s+(\d{1,2}:\d{2})\s+(.+)/i)
            if(!m){ await sock.sendMessage(jid, { text: '❌ Usa: `agregar 18:00 Nombre del evento`' }); return }
            await supabase.from('calendario').insert([{ hora: m[1], evento: m[2] }])
            await sock.sendMessage(jid, { text: `✅ Agregado: ${m[1]} - ${m[2]}` })
        }

        if(texto.toLowerCase().startsWith('borrar ')){
            const num = parseInt(texto.replace(/borrar /i,''))
            const { data } = await supabase.from('calendario').select('*').order('hora')
            if(data && data[num-1]){
                await supabase.from('calendario').delete().eq('id', data[num-1].id)
                await sock.sendMessage(jid, { text: `🗑️ Borrado #${num}` })
            }
        }
    })
}
startBot()
