import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ragxduxdwylyjmspzjxbv.supabase.co',
  'sb_publishable_94IZwRIbVdQzDrI4KxTtTQ__hte1QQ0'
)

function convertirHoras(texto) {
  return texto.replace(/(\d{1,2}:00)/g, (hora) => {
    const h = parseInt(hora.split(':')[0])
    const mx = h; const co = h+1; const cl = h+2; const ar = h+2; const br = h+3
    return `MX ${mx}:00 - CO/PE ${co}:00 - CL/VE ${cl}:00 - AR ${ar}:00 - BR ${br}:00`
  })
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state, printQRInTerminal: false })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update
        if(qr) {
          console.log('ESCANEA ESTE QR:')
          qrcode.generate(qr, { small: true })
        }
        if(connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode
            const shouldReconnect = statusCode!== DisconnectReason.loggedOut
            if(shouldReconnect) startBot()
        } else if(connection === 'open') {
            console.log('✅ BOT SATCOM MASTER LATAM ONLINE')
        }
    })
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if(!msg.message || msg.key.fromMe) return
        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
        if(texto.toLowerCase().includes('calendario')) {
            const { data } = await supabase.from('calendario').select('*').order('hora', { ascending: true })
            let respuesta = '📅 *CALENDARIO SATCOM LATAM*\n\n'
            data?.forEach(e => { respuesta += `${convertirHoras(e.hora)} - ${e.evento}\n` })
            respuesta += '\n@satcommaster'
            await sock.sendMessage(msg.key.remoteJid, { text: respuesta })
        }
    })
}
startBot()
