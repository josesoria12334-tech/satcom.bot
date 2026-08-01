import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ragxduxdwylyjmspzjxbv.supabase.co',
  'sb_publishable_94IZwRIbVdQzDrI4KxTtTQ__hte1QQ0'
)

function convertirHoras(texto) {
  if(!texto) return ''
  return texto.replace(/(\d{1,2}:\d{2})/g, (match) => {
    const h = parseInt(match.split(':')[0])
    return `MX ${h}:00 | CO ${h+1}:00 | AR ${h+2}:00`
  })
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => {
        const { connection, qr } = u
        if(qr) qrcode.generate(qr, { small: false })
        if(connection === 'open') console.log('✅ BOT SATCOM ONLINE')
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if(!msg.message || msg.key.fromMe) return
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim()
        const jid = msg.key.remoteJid

        // COMANDO 1: VER CALENDARIO
        if(texto.toLowerCase() === 'calendario') {
            const { data } = await supabase.from('calendario').select('*').order('hora', {ascending: true})
            if(!data || data.length === 0){
                await sock.sendMessage(jid, { text: '📅 *CALENDARIO SATCOM LATAM*\n\nAún no hay eventos.\nAgrega uno con:\n`agregar 18:00 GP Belgica - Qualy`' })
                return
            }
            let resp = '📅 *CALENDARIO SATCOM LATAM*\n\n'
            data.forEach((e,i) => {
                resp += `${i+1}. ${convertirHoras(e.hora)} - ${e.evento}\n`
            })
            resp += '\n@satcommaster - Agrega eventos con: `agregar HORA EVENTO`'
            await sock.sendMessage(jid, { text: resp })
        }

        // COMANDO 2: AGREGAR EVENTO
        // Formato: agregar 18:00 GP Belgica Qualy
        if(texto.toLowerCase().startsWith('agregar ')) {
            const match = texto.match(/agregar\s+(\d{1,2}:\d{2})\s+(.+)/i)
            if(!match){
                await sock.sendMessage(jid, { text: '❌ Formato incorrecto.\nUsa así:\n`agregar 18:00 GP Belgica Qualy`' })
                return
            }
            const hora = match[1]
            const evento = match[2]
            const { error } = await supabase.from('calendario').insert([{ hora, evento }])
            if(error){
                await sock.sendMessage(jid, { text: '❌ Error al guardar: ' + error.message })
            } else {
                await sock.sendMessage(jid, { text: `✅ Agregado:\n🕒 ${hora} - ${evento}\n\nEscribe *calendario* para verlo.` })
            }
        }

        // COMANDO 3: BORRAR (opcional)
        if(texto.toLowerCase().startsWith('borrar ')){
            const num = parseInt(texto.replace('borrar ',''))
            const { data } = await supabase.from('calendario').select('*').order('hora')
            if(data && data[num-1]){
                await supabase.from('calendario').delete().eq('id', data[num-1].id)
                await sock.sendMessage(jid, { text: `🗑️ Borrado evento #${num}` })
            }
        }
    })
}
startBot()
