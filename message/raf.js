"use strict";

//Module
const fs = require("fs");
const convertRupiah = require('rupiah-format');
const axios = require('axios');
const path = require('path');
const { exec } = require('child_process');

//Library
const { color, bgcolor } = require("../lib/color");
const { getBuffer, fetchJson, fetchText, getRandom, getGroupAdmins, runtime, sleep, convert, convertGif, html2Txt } = require("../lib/myfunc");
const { wifimenu, menupaket, menubelivoucher, menupasang, menuowner, customermenu, techinisionmenu, menuvoucher } = require("./wifi");
const { setPassword, setSSIDName, getSSIDInfo, rebootRouter } = require("../lib/wifi");
const { getPppStats, getHotspotStats, statusap, getvoucher, addpppoe, addbinding, addqueue } = require("../lib/mikrotik");
// const { addReseller, unReseller, cekReseller } = require("../lib/reseller");
const { addvoucher, checkhargavc, checkprofvc, checkhargavoucher, checknamavc, checkdurasivc, checkprofvoucher, delvoucher } = require("../lib/voucher");
const { addStatik, checkLimitAt, checkMaxLimit, checkStatik, delStatik } = require("../lib/statik")
const { addATM, addKoinUser, checkATMuser, confirmATM, checkRegisteredATM, delSaldo } = require("../lib/saldo");
const { addPayment } = require("../lib/payment");
// const { getIntentFromGemini, getConversationalResponse } = require("../lib/gemini"); // DISABLED - Gemini removed
const { getIntentFromKeywords } = require('../lib/wifi_template_handler'); // Impor handler template WiFi
const { templatesCache } = require("../lib/templating"); // Import the live cache
const { savePackageChangeRequests, saveSpeedRequests } = require("../lib/database");
// Import Smart Report Handler with device detection
const { 
    handleGangguanMati, 
    handleGangguanLemot,
    handleGangguanMatiOfflineResponse,
    handleGangguanMatiOnlineResponse,
    handleGangguanLemotResponse
} = require('./handlers/smart-report-handler');
const { 
    handleProsesTicket, 
    handleVerifikasiOTP,
    handleCompletionConfirmation,
    handleRemoteRequest,
    handleRemoteResponse
} = require('./handlers/ticket-process-handler');
const { getUserState, deleteUserState } = require('./handlers/conversation-handler');
// Import Location Tracking Handler
const {
    handleMulaiPerjalanan,
    handleTeknisiShareLocation,
    handleCekLokasiTeknisi,
    handleTiketSaya
} = require('./handlers/simple-location-handler');
const qr = require('qr-image')
const pay = require("../lib/ipaymu")

// --- Template Formatting Helper ---
const format = (key, data = {}) => {
    let template = templatesCache.responseTemplates[key]?.template || '';
    for (const placeholder in data) {
        const regex = new RegExp(`\\$\\{${placeholder}\\}`, 'g');
        template = template.replace(regex, data[placeholder]);
    }
    return template;
};

const mess = {
    get owner() { return format('mess_owner'); },
    get userNotRegister() { return format('mess_userNotRegister'); },
    get notRegister() { return format('mess_notRegister'); },
    get notProfile() { return format('mess_notProfile'); },
    get onlyMonthly() { return format('mess_onlyMonthly'); },
    get wrongFormat() { return format('mess_wrongFormat'); },
    get mustNumber() { return format('mess_mustNumber'); },
    get teknisiOrOwnerOnly() { return format('mess_teknisiOrOwnerOnly'); },
    get teknisiOnly() { return format('mess_teknisiOnly'); },
    get reportNotFound() { return format('mess_reportNotFound'); },
    get reportAlreadyDone() { return format('mess_reportAlreadyDone'); },
    get reportNotFound_detail() { return format('mess_reportNotFound_detail'); },
    get reportAlreadyDone_detail() { return format('mess_reportAlreadyDone_detail'); },
}

// Path ke file reports.json (jika ingin menyimpan langsung dari raf.js)
const reportsDbPathRaf = path.join(__dirname, '../database/reports.json'); // Sesuaikan path jika struktur folder berbeda

// Import ticket creation handler functions
const { generateTicketId, saveReportsToFile, buatLaporanGangguan } = require('./handlers/ticket-creation-handler');
// Import payment processor functions  
const { processVoucherPurchase } = require('./handlers/payment-processor-handler');

// Extract config values - with safety check for when module is loaded directly
let ownerNumber, nama, namabot, parentbinding, telfon;

if (global.config) {
    ({
        ownerNumber,
        nama,
        namabot,
        parentbinding,
        telfon
    } = global.config);
} else {
    // Default values for testing/loading module directly
    ownerNumber = [];
    nama = 'Service Name';
    namabot = 'Bot Name';
    parentbinding = '';
    telfon = '';
}
let temp = {};

module.exports = async(raf, msg, m) => {
    const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = await import('@whiskeysockets/baileys');
    
    // Get users and accounts from global
    const users = global.users || [];
    const accounts = global.accounts || [];

    if (((msg.key.id.startsWith("BAE5") && msg.key.id.length < 32) || (msg.key.id.startsWith("3EB0") && msg.key.id.length < 32)) && msg.key?.fromMe) return;
    // const fromMe = msg.key.fromMe
    const from = msg.key.remoteJid
    const type = Object.keys(msg.message)[0]
    // const content = JSON.stringify(msg.message)
    const chats = type === "conversation" && msg.message.conversation ? msg.message.conversation : type == "imageMessage" && msg.message.imageMessage.caption ? msg.message.imageMessage.caption : type == "documentMessage" && msg.message.documentMessage.caption ? msg.message.documentMessage.caption : type == "videoMessage" && msg.message.videoMessage.caption ? msg.message.videoMessage.caption : type == "extendedTextMessage" && msg.message.extendedTextMessage.text ? msg.message.extendedTextMessage.text : type == "buttonsResponseMessage" && msg.message.buttonsResponseMessage.selectedButtonId ? msg.message.buttonsResponseMessage.selectedButtonId : type == "templateButtonReplyMessage" && msg.message.templateButtonReplyMessage.selectedId ? msg.message.templateButtonReplyMessage.selectedId : type == "messageContextInfo" ? (msg.message.buttonsResponseMessage?.selectedButtonId || msg.message.listResponseMessage?.singleSelectReply.selectedRowId) : type == "listResponseMessage" && msg.message.listResponseMessage.singleSelectReply.selectedRowId ? msg.message.listResponseMessage.singleSelectReply.selectedRowId : ""  
    // console.log(msg.message.interactiveResponseMessage.nativeFlowResponseMessage)
    // if (raf.multi){
    //     var prefix = /^[°•π÷×¶∆£¢€¥®™✓=|!?#%^&.+,\/\\©^]/.test(chats) ? chats.match(/^[°•π÷×¶∆£¢€¥®™✓=|!?#%^&.+,\/\\©^]/gi) : '#'
    // } else {
    //     if (raf.nopref){
    //         prefix = ''
    //     } else {
    //         prefix = raf.prefa
    //     }
    // }
    // Safety check: ensure chats is never undefined
    if (!chats && chats !== '') {
        console.log('[WARNING] chats is undefined, using empty string');
        return; // Skip processing if no valid message
    }
    
    const args = chats.split(' ')
    const command = chats.toLowerCase().split(' ')[0] || ''
    const isGroup = msg.key.remoteJid.endsWith('@g.us')
    if (isGroup) return;
    const sender = isGroup ? msg.participant : msg.key.remoteJid
    if(!sender) return;
    const pushname = msg.pushName
    // const isCmd = command.startsWith(prefix)
    const q = chats.slice(command.length + 1, chats.length)
    // const body = chats.startsWith(prefix) ? chats : ''
    // const botNumber = raf.user.id.split(':')[0] + '@s.whatsapp.net'
    // const groupMetadata = isGroup ? await raf.groupMetadata(from) : ''
    // const groupName = isGroup ? groupMetadata.subject : ''
    // const groupId = isGroup ? groupMetadata.jid : ''
    // const groupMembers = isGroup ? groupMetadata.participants : ''
    // const groupAdmins = isGroup ? getGroupAdmins(groupMembers) : ''
    // const isBotGroupAdmins = groupAdmins.includes(botNumber) || false
    // const isGroupAdmins = groupAdmins.includes(sender) || false
    const isSaldo = checkATMuser(sender)
    // const isReseller = cekReseller(sender, reseller)

    const plainSenderNumber = sender.split('@')[0]; // Ekstrak nomor telepon bersih dari JID
    const isOwner = ownerNumber.includes(sender)
    const isTeknisi = accounts.find(a => a.phone_number && a.phone_number == plainSenderNumber); // Cari teknisi berdasarkan nomor bersih
    const isUrl = (uri) => {
        return uri.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%.+#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%+.#?&/=]*)/, 'gi'))
    }

    // const isImage = (type === 'imageMessage')
    // const isVideo = (type === 'videoMessage')
    // const isSticker = (type == 'stickerMessage')
    // const isList = (type == 'listResponseMessage')
    // const isButton = (type == 'buttonsResponseMessage') ? msg.message.buttonsResponseMessage.selectedDisplayText : ''
    // const isSelectedButton = (type == 'buttonsResponseMessage') ? msg.message.buttonsResponseMessage.selectedButtonId : ''
    // const isViewOnce = (type == 'viewOnceMessage')
    // const isQuotedMsg = (type == 'extendedTextMessage')
    // const isQuotedImage = isQuotedMsg ? content.includes('imageMessage') ? true : false : false
    // const isQuotedAudio = isQuotedMsg ? content.includes('audioMessage') ? true : false : false
    // const isQuotedVideo = isQuotedMsg ? content.includes('videoMessage') ? true : false : false
    // const isQuotedSticker = isQuotedMsg ? content.includes('stickerMessage') ? true : false : false
    // const isQuotedList = isQuotedMsg ? content.includes('listResponseMessage') ? true : false : false
    // const isQuotedButton = isQuotedMsg ? content.includes('buttonsResponseMessage') ? true : false : false
    // const isQuotedContact = isQuotedMsg ? content.includes('contactMessage') ? true : false : false
    const reply = (teks) => {
        // Return a promise to allow for 'await'
        return new Promise(resolve => {
            setTimeout(() => {
                raf.sendMessage(from, { text: teks }, { quoted: msg }).finally(resolve);
            }, 500);
        });
    }

    // DEPRECATED: Button tidak work untuk personal account
    // WhatsApp telah deprecated button untuk non-business account
    // Gunakan text menu sebagai gantinya
    /*
    const sendButton = (text, footer, buttons, opts = {}) => {
        return new Promise(async(resolve, reject) => {
            try {
                let media = {};
                if (typeof opts.media ==="object") media = await prepareWAMessageMedia(opts.media, { upload: raf.waUploadToServer });
                if (!Array.isArray(buttons)) return reject("Button type must be type an array example: [{ type: \"type_button\", content: <ContentButton> } ...other]");
                buttons = buttons.map(({ type, content }) => ({ name: type, buttonParamsJson: JSON.stringify(content) }));
                let msg = generateWAMessageFromContent(from, {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadata: {},
                                deviceListMetadataVersion: 2
                            },
                            interactiveMessage: proto.Message.InteractiveMessage.create({
                                header: proto.Message.InteractiveMessage.Header.create({
                                    ...media,
                                    title: "",
                                    subtitle: "",
                                    hasMediaAttachment: false,
                                }),
                                body: proto.Message.InteractiveMessage.Body.create({ text }),
                                footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
                                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons })
                            }),
                            contextInfo: {
                                mentionedJid: opts.mentions
                            }
                        },
                    }
                }, {})
                await raf.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id });
                resolve(msg);
            } catch(err) {
                reject(err)
            }
        })
    }
    */
    let sendContact = (jid, numbers, name, quoted) => {
        let number = numbers.replace(/[^0-9]/g, '')
        const vcard = 'BEGIN:VCARD\n' 
        + 'VERSION:3.0\n' 
        + 'FN:' + name + '\n'
        + 'ORG:;\n'
        + 'TEL;type=CELL;type=VOICE;waid=' + number + ':+' + number + '\n'
        + 'END:VCARD'
        return raf.sendMessage(from, { contacts: { displayName: name, contacts: [{ vcard }] } },{ quoted: quoted })
    }

    //function Saldo
    if (!isSaldo) {
        const checkATM = checkATMuser(sender)
        try {
            if (checkATM === undefined) addATM(sender)
            const uangsaku = 0
            addKoinUser(sender, uangsaku)
        } catch (err) {
            console.error(err)
        }
    }
    // Konvert Ke Rupiah
    const rupiah = checkATMuser(sender)
    const rupiah123 = convertRupiah.convert(rupiah)

    try {
        
        // ==================================================================
        //           HANDLER UNTUK PERCAKAPAN MULTI-LANGKAH
        // ==================================================================
        
        // CRITICAL: Check if message is a command that should break out of state
        // But WiFi input states should be protected from global command interception
        const smartReportState = getUserState(sender);
        
        // Define WiFi input states that should NOT check for global commands
        const wifiInputStates = [
            'ASK_NEW_NAME_FOR_SINGLE',
            'ASK_NEW_NAME_FOR_SINGLE_BULK',
            'ASK_NEW_NAME_FOR_BULK',
            'ASK_NEW_NAME_FOR_BULK_AUTO',
            'ASK_NEW_PASSWORD',
            'ASK_NEW_PASSWORD_BULK',
            'ASK_NEW_PASSWORD_BULK_AUTO'
        ];
        
        // Check if user is in a WiFi input state (check BOTH smartReportState AND temp[sender])
        const isInWifiInputState = 
            (smartReportState && wifiInputStates.includes(smartReportState.step)) ||
            (temp[sender] && temp[sender].step && wifiInputStates.includes(temp[sender].step));
        
        // Only check for global commands if NOT in WiFi input state
        let isGlobalCommand = false;
        if (!isInWifiInputState) {
            const keywordCheck = getIntentFromKeywords(chats);
            const commandCheck = chats.toLowerCase().split(' ')[0];
            const globalCommands = ['menu', 'bantuan', 'help', 'lapor', 'ceksaldo', 'saldo'];
            isGlobalCommand = globalCommands.includes(commandCheck) || keywordCheck !== null;
        }
        
        // Always allow "batal" command to work
        if (chats.toLowerCase().trim() === 'batal') {
            isGlobalCommand = true;
        }
        
        // If user has state but typed a global command, clear the state
        if (smartReportState && isGlobalCommand && !isInWifiInputState) {
            console.log(`[GLOBAL_COMMAND] User ${sender} broke out of state with command: "${chats}"`);
            deleteUserState(sender);
            // Don't process state handler, let command continue normally
        }
        else if (smartReportState && (!isGlobalCommand || isInWifiInputState)) {
            // User is in conversation state and didn't type a global command
            // Continue with state handling
            const stateStep = smartReportState.step;
            
            // Handle report menu selection
            if (stateStep === 'REPORT_MENU') {
                const { handleMenuSelection } = require('./handlers/smart-report-text-menu');
                const result = await handleMenuSelection({
                    sender,
                    choice: chats,
                    reply
                });
                
                if (result.message) {
                    await reply(result.message);
                }
                if (result.success && (chats.trim() === '3' || chats.includes('lain'))) {
                    deleteUserState(sender);
                }
                return;
            }
            
            // Handle troubleshoot result for LEMOT
            if (stateStep === 'TROUBLESHOOT_LEMOT') {
                const { handleTroubleshootResult } = require('./handlers/smart-report-text-menu');
                const result = await handleTroubleshootResult({
                    sender,
                    response: chats,
                    reply
                });
                
                if (result.message) {
                    await reply(result.message);
                }
                return;
            }
            
            // Handle confirmation for MATI report
            if (stateStep === 'CONFIRM_MATI_REPORT') {
                const { handleMatiConfirmation } = require('./handlers/smart-report-text-menu');
                const result = await handleMatiConfirmation({
                    sender,
                    response: chats,
                    reply
                });
                
                if (result.message) {
                    await reply(result.message);
                }
                return;
            }
            
            // Handle MATI Troubleshoot Options (1/2/3)
            if (stateStep === 'MATI_TROUBLESHOOT_OPTIONS') {
                const { handleMatiTroubleshootOptions } = require('./handlers/smart-report-text-menu');
                const result = await handleMatiTroubleshootOptions({
                    sender,
                    response: chats,
                    reply
                });
                
                if (result.message) {
                    await reply(result.message);
                }
                return;
            }
            
            // Handle Photo Upload for MATI Report
            if (stateStep === 'MATI_AWAITING_PHOTO') {
                const { handleMatiPhotoUpload } = require('./handlers/smart-report-text-menu');
                
                // Handle text responses (SKIP/LANJUT)
                if (type === 'conversation') {
                    const result = await handleMatiPhotoUpload({
                        sender,
                        response: chats,
                        photoPath: null,
                        reply
                    });
                    
                    if (result.message) {
                        await reply(result.message);
                    }
                    return;
                }
                
                // Handle image upload
                if (type === 'imageMessage') {
                    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
                    
                    try {
                        // Download the image
                        const buffer = await downloadMediaMessage(msg, 'buffer', {});
                        const fileName = `photo_${Date.now()}.jpg`;
                        const photoPath = path.join(__dirname, '../../uploads', fileName);
                        
                        // Ensure uploads directory exists
                        const uploadsDir = path.join(__dirname, '../../uploads');
                        if (!fs.existsSync(uploadsDir)) {
                            fs.mkdirSync(uploadsDir, { recursive: true });
                        }
                        
                        // Save the image
                        fs.writeFileSync(photoPath, buffer);
                        console.log('[PHOTO_UPLOAD] Image saved:', photoPath);
                        
                        // Handle the photo upload with full relative path
                        const result = await handleMatiPhotoUpload({
                            sender,
                            response: null,
                            photoPath: fileName,  // Keep filename only
                            photoBuffer: buffer,   // Add buffer for immediate sending
                            reply
                        });
                        
                        if (result.message) {
                            await reply(result.message);
                        }
                    } catch (error) {
                        console.error('[PHOTO_UPLOAD_ERROR]', error);
                        await reply('❌ Gagal menerima foto. Silakan coba lagi atau ketik *SKIP* untuk lewati.');
                    }
                    return;
                }
            }
            
            // Handle DIRECT report confirmations (Hybrid System)
            if (stateStep === 'CONFIRM_DIRECT_MATI') {
                const { handleDirectConfirmation } = require('./handlers/smart-report-hybrid');
                const result = await handleDirectConfirmation({
                    sender,
                    response: chats,
                    reply
                });
                
                if (result.message) {
                    await reply(result.message);
                }
                return;
            }
            
            // Handle DIRECT lemot troubleshoot response
            if (stateStep === 'DIRECT_LEMOT_TROUBLESHOOT') {
                const { handleDirectLemotResponse } = require('./handlers/smart-report-hybrid');
                const result = await handleDirectLemotResponse({
                    sender,
                    response: chats,
                    reply
                });
                
                if (result.message) {
                    await reply(result.message);
                }
                return;
            }
            
            // Handle teknisi resolution notes
            if (global.teknisiStates && global.teknisiStates[sender] && 
                global.teknisiStates[sender].step === 'AWAITING_RESOLUTION_NOTES') {
                const state = global.teknisiStates[sender];
                
                // Check if input is valid
                if (chats.length < 10) {
                    await reply('❌ *CATATAN TERLALU PENDEK*\n\n📌 *PERSYARATAN:*\n• Minimal 10 karakter\n• Jelaskan apa yang diperbaiki\n\n📌 *CONTOH YANG BENAR:*\n✅ "Restart router, internet normal"\n✅ "Ganti kabel LAN rusak"\n✅ "Setting ulang konfigurasi"\n\n➡️ Silakan ketik ulang catatan Anda...');
                    return;
                }
                
                // Save resolution notes
                state.resolutionNotes = chats;
                state.step = 'AWAITING_CONFIRMATION';
                
                // Show confirmation
                await reply(`📝 *REVIEW SEBELUM FINALISASI*
━━━━━━━━━━━━━━━━

📋 *ID Tiket:* ${state.ticketId}
📸 *Dokumentasi:* ${state.uploadedPhotos.length} foto
📝 *Catatan Resolusi:*
${chats}

━━━━━━━━━━━━━━━━
⚠️ *KONFIRMASI PENYELESAIAN*

Apakah perbaikan sudah selesai dan data di atas sudah benar?

📌 *STEP TERAKHIR:*
➡️ Ketik *ya* = Selesaikan tiket & kirim ke pelanggan
➡️ Ketik *tidak* = Edit ulang catatan`);
                return;
            }
            
            // Handle teknisi confirmation
            if (global.teknisiStates && global.teknisiStates[sender] && 
                global.teknisiStates[sender].step === 'AWAITING_CONFIRMATION') {
                const state = global.teknisiStates[sender];
                const response = chats.toLowerCase().trim();
                
                if (response === 'ya' || response === 'yes') {
                    // Complete the ticket
                    const { handleCompleteTicket } = require('./handlers/teknisi-workflow-handler');
                    const result = await handleCompleteTicket(sender, state, reply);
                    
                    if (result.message) {
                        await reply(result.message);
                    }
                    
                    // Clear state
                    delete global.teknisiStates[sender];
                } else if (response === 'tidak' || response === 'no') {
                    // Go back to notes
                    state.step = 'AWAITING_RESOLUTION_NOTES';
                    await reply('🔄 *EDIT CATATAN DIBATALKAN*\n\n📌 *STEP SELANJUTNYA:*\n➡️ Silakan ketik ulang catatan resolusi perbaikan\n   (minimal 10 karakter)\n\n💡 Tips: Jelaskan masalah dan solusi yang dilakukan');
                } else {
                    await reply('⚠️ *PILIHAN TIDAK VALID*\n\nSilakan ketik:\n• *ya* = Selesaikan tiket\n• *tidak* = Kembali edit catatan');
                }
                return;
            }
            
            // Handle image upload for TEKNISI documentation with queue support
            if (global.teknisiStates && global.teknisiStates[sender] && 
                global.teknisiStates[sender].step === 'AWAITING_COMPLETION_PHOTOS' && 
                type === 'imageMessage') {
                const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
                const { handleTeknisiPhotoUpload } = require('./handlers/teknisi-photo-handler-v3');
                
                try {
                    // Download the image
                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                    
                    // Generate unique filename with random suffix to prevent overwrites
                    const timestamp = Date.now();
                    const randomSuffix = Math.random().toString(36).substring(7);
                    const fileName = `teknisi_${timestamp}_${randomSuffix}.jpg`;
                    const photoPath = path.join(__dirname, '../../uploads/teknisi', fileName);
                    
                    // Ensure uploads directory exists
                    const uploadsDir = path.join(__dirname, '../../uploads/teknisi');
                    if (!fs.existsSync(uploadsDir)) {
                        fs.mkdirSync(uploadsDir, { recursive: true });
                    }
                    
                    // Save the image
                    fs.writeFileSync(photoPath, buffer);
                    console.log('[TEKNISI_PHOTO] Image saved:', fileName);
                    
                    // Handle the photo upload with queue support
                    const result = await handleTeknisiPhotoUpload(sender, fileName, buffer, reply);
                    
                    // Result.message is null because reply is handled inside the handler
                    if (result.message) {
                        await reply(result.message);
                    }
                } catch (error) {
                    console.error('[TEKNISI_PHOTO_ERROR]', error);
                    await reply('❌ Gagal menerima foto. Silakan coba lagi.');
                }
                return;
            }
            
            // Handle image upload for CUSTOMER reporting (optional photos)
            if (stateStep === 'GANGGUAN_MATI_AWAITING_PHOTO' && type === 'imageMessage') {
                const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
                
                try {
                    // Check photo limit (max 3)
                    if (smartReportState.uploadedPhotos && smartReportState.uploadedPhotos.length >= 3) {
                        await reply('⚠️ Maksimal 3 foto. Ketik *lanjut* untuk melanjutkan.');
                        return;
                    }
                    
                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                    const date = new Date();
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const ticketId = smartReportState.ticketData.ticketId;
                    const timestamp = Date.now();
                    
                    // Create filename for customer upload
                    const fileName = `customer_${ticketId}_${timestamp}.jpg`;
                    
                    // Create upload directory
                    const uploadDir = require('path').join(__dirname, '../uploads/reports', String(year), month, ticketId);
                    const fs = require('fs');
                    
                    if (!fs.existsSync(uploadDir)) {
                        fs.mkdirSync(uploadDir, { recursive: true });
                    }
                    
                    // Save the image
                    const filePath = require('path').join(uploadDir, fileName);
                    fs.writeFileSync(filePath, buffer);
                    
                    // Update state with uploaded photo AND buffer for sending
                    smartReportState.uploadedPhotos = smartReportState.uploadedPhotos || [];
                    smartReportState.uploadedPhotos.push({
                        fileName: fileName,
                        path: filePath,
                        uploadedAt: date.toISOString(),
                        size: buffer.length,
                        buffer: buffer, // Keep buffer for sending to teknisi
                        uploadedBy: 'customer'
                    });
                    
                    // Update timeout
                    smartReportState.startTime = smartReportState.startTime || Date.now();
                    
                    const { setUserState } = require('./handlers/conversation-handler');
                    setUserState(sender, smartReportState);
                    
                    const photoCount = smartReportState.uploadedPhotos.length;
                    const remaining = 3 - photoCount;
                    
                    await reply(`📸 Foto ${photoCount} berhasil diterima!

${remaining > 0 ? `• Bisa upload ${remaining} foto lagi` : '• Maksimal 3 foto tercapai'}
• Ketik *lanjut* untuk selesai
• Ketik *skip* jika cukup

_Foto akan membantu teknisi diagnosis masalah_`);
                    
                } catch (error) {
                    console.error('[CUSTOMER_PHOTO_UPLOAD_ERROR]', error);
                    await reply('❌ Gagal upload foto. Silakan coba lagi atau ketik *skip*.');
                }
                return;
            }
            
            // Handle image upload for ticket resolution (with OTP verification) - TEKNISI
            if ((stateStep === 'TICKET_RESOLVE_UPLOAD_PHOTOS' || stateStep === 'TICKET_VERIFIED_AWAITING_PHOTOS') && type === 'imageMessage') {
                const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
                
                // Check if teknisi is verified (for new flow)
                if (stateStep === 'TICKET_VERIFIED_AWAITING_PHOTOS' && !smartReportState.otpVerifiedAt) {
                    await reply('❌ Anda belum terverifikasi. Minta OTP dari pelanggan terlebih dahulu.');
                    return;
                }
                
                try {
                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                    const ticketId = smartReportState.ticketIdToResolve || smartReportState.ticketId;
                    const teknisiName = isTeknisi ? isTeknisi.username : 'teknisi';
                    
                    // Use queue manager to prevent close connection
                    const { addPhotoToQueue } = require('./handlers/photo-upload-queue');
                    
                    const result = await addPhotoToQueue({
                        sender,
                        buffer,
                        state: smartReportState,
                        teknisiName,
                        ticketId,
                        reply
                    });
                    
                    if (result.queued) {
                        // Photo added to queue, will be processed with rate limiting
                        console.log(`[PHOTO_QUEUE] Photo ${result.count} queued for ${sender}`);
                        
                        // No immediate reply to prevent flooding
                        // Queue manager will handle acknowledgments with proper delays
                    }
                    
                } catch (error) {
                    console.error('[UPLOAD_PHOTO_ERROR]', error);
                    // Queue manager handles error replies with rate limiting
                    // Don't reply here to avoid flooding
                }
                return;
            }
            
            // Handle customer photo upload state (text responses)
            if (stateStep === 'GANGGUAN_MATI_AWAITING_PHOTO') {
                const { handleCustomerPhotoUpload } = require('./handlers/customer-photo-handler');
                const result = await handleCustomerPhotoUpload({
                    sender,
                    state: smartReportState,
                    chats,
                    reply
                });
                
                if (result.message) {
                    await reply(result.message);
                }
                return;
            }
            
            // Handle teknisi ticket resolution states (photos, notes, confirmation)
            const resolutionStates = [
                'TICKET_VERIFIED_AWAITING_PHOTOS',
                'TICKET_RESOLVE_UPLOAD_PHOTOS', 
                'TICKET_RESOLVE_ASK_NOTES',
                'TICKET_RESOLVE_CONFIRM'
            ];
            
            if (resolutionStates.includes(stateStep)) {
                const { handleGeneralSteps } = require('./handlers/steps/general-steps');
                const { setUserState, deleteUserState } = require('./handlers/conversation-handler');
                
                console.log(`[${stateStep}] Handling text: "${chats}" from ${sender}`);
                
                const result = await handleGeneralSteps({
                    userState: smartReportState,
                    sender,
                    chats,
                    pushname,
                    reply,
                    setUserState,
                    deleteUserState
                });
                
                if (result.message) {
                    await reply(result.message);
                }
                
                // If success, state will be updated by handleGeneralSteps
                // If failed, keep state for retry
                return;
            }
            
            // ===================== HANDLE LOCATION MESSAGES =====================
            // Handle location message for teknisi tracking
            if ((type === 'locationMessage' || type === 'liveLocationMessage') && smartReportState) {
                // Check if teknisi is sharing location for journey
                if (smartReportState.step === 'AWAITING_LOCATION_FOR_JOURNEY') {
                    // Extract location data based on message type
                    let locationData;
                    if (type === 'locationMessage') {
                        locationData = msg.message.locationMessage;
                    } else if (type === 'liveLocationMessage') {
                        locationData = msg.message.liveLocationMessage;
                    }
                    
                    if (!locationData || !locationData.degreesLatitude || !locationData.degreesLongitude) {
                        console.error('[LOCATION_ERROR] Invalid location data:', locationData);
                        await reply('❌ Data lokasi tidak valid. Silakan coba lagi.');
                        return;
                    }
                    
                    // Teknisi sharing location for journey
                    const locationResult = await handleTeknisiShareLocation(
                        sender,
                        {
                            degreesLatitude: locationData.degreesLatitude,
                            degreesLongitude: locationData.degreesLongitude,
                            accuracyInMeters: locationData.accuracyInMeters
                        },
                        reply
                    );
                    if (locationResult && locationResult.message) {
                        await reply(locationResult.message);
                    }
                    return;
                }
            }
            
            // Auto-update location for active ticket (without state)
            if ((type === 'locationMessage' || type === 'liveLocationMessage')) {
                const reports = global.reports || [];
                const activeTicket = reports.find(r => 
                    (r.processedByTeknisiId === sender || r.teknisiId === sender) && 
                    (r.status === 'otw' || r.status === 'arrived' || r.status === 'diproses teknisi' || r.status === 'process')
                );
                
                if (activeTicket) {
                    // Extract location data based on message type
                    let locationData;
                    if (type === 'locationMessage') {
                        locationData = msg.message.locationMessage;
                    } else if (type === 'liveLocationMessage') {
                        locationData = msg.message.liveLocationMessage;
                    }
                    
                    if (!locationData || !locationData.degreesLatitude || !locationData.degreesLongitude) {
                        console.error('[LOCATION_ERROR] Invalid location data for active ticket:', locationData);
                        return; // Silent fail for auto-update
                    }
                    
                    // Auto update location for active ticket (will notify customer)
                    const locationResult = await handleTeknisiShareLocation(
                        sender,
                        {
                            degreesLatitude: locationData.degreesLatitude,
                            degreesLongitude: locationData.degreesLongitude,
                            accuracyInMeters: locationData.accuracyInMeters
                        },
                        reply
                    );
                    if (locationResult && locationResult.message) {
                        await reply(locationResult.message);
                    }
                    return;
                }
            }
            // ===================== END LOCATION HANDLING =====================
            
            // Handle smart report conversation states
            if (stateStep === 'GANGGUAN_MATI_DEVICE_OFFLINE') {
                // Device offline response - user responding to troubleshooting steps
                const result = await handleGangguanMatiOfflineResponse({
                    sender,
                    body: chats,
                    reply,
                    findUserByPhone: (phone) => global.users.find(u => 
                        u.phone_number && u.phone_number.split("|").some(num =>
                            num.trim() === phone || `62${num.trim().substring(1)}` === phone
                        )
                    )
                });
                
                if (result && result.message) {
                    await reply(result.message);
                }
                return;
            }
            
            if (stateStep === 'GANGGUAN_MATI_DEVICE_ONLINE') {
                // Device online but user reports no connection - WiFi issue
                const result = await handleGangguanMatiOnlineResponse({
                    sender,
                    body: chats,
                    reply
                });
                
                if (result && result.message) {
                    await reply(result.message);
                }
                return;
            }
            
            if (stateStep === 'GANGGUAN_LEMOT_ANALYSIS' || 
                stateStep === 'GANGGUAN_LEMOT_AWAITING_RESPONSE' ||
                stateStep === 'GANGGUAN_LEMOT_CONFIRM_TICKET') {
                // Internet lemot analysis response
                const { handleGangguanLemotResponse } = require('./handlers/smart-report-handler');
                const result = await handleGangguanLemotResponse({
                    sender,
                    body: chats,
                    reply
                });
                
                if (result && result.message) {
                    await reply(result.message);
                }
                return;
            }
        }
        
        // Cek apakah ada proses yang sedang berjalan untuk user ini
        // BUT: If user typed a global command, clear the temp state (unless in WiFi input state)
        const tempWifiInputStates = [
            'ASK_NEW_NAME_FOR_SINGLE',
            'ASK_NEW_NAME_FOR_SINGLE_BULK', 
            'ASK_NEW_NAME_FOR_BULK',
            'ASK_NEW_NAME_FOR_BULK_AUTO',
            'ASK_NEW_PASSWORD',
            'ASK_NEW_PASSWORD_BULK',
            'ASK_NEW_PASSWORD_BULK_AUTO'
        ];
        
        const isInTempWifiInputState = temp[sender] && tempWifiInputStates.includes(temp[sender].step);
        
        if (temp[sender] && isGlobalCommand && !isInTempWifiInputState) {
            console.log(`[GLOBAL_COMMAND] Clearing temp state for ${sender}`);
            delete temp[sender];
        }
        else if (temp[sender]) {
            // --- AWAL LOGIKA BARU UNTUK PERCAKAPAN NATURAL ---
            // Jika bot sedang menunggu pertanyaan dari pengguna
            if (temp[sender].step === 'AWAITING_QUESTION') {
                // Hapus state agar tidak terjebak di mode ini
                delete temp[sender]; 

                // Gemini disabled - arahkan ke menu bantuan
                reply("Maaf, fitur tanya jawab otomatis sudah tidak tersedia.\n\nSilakan gunakan perintah berikut:\n• *menu* - Lihat menu utama\n• *bantuan* - Lihat panduan\n• Atau hubungi admin untuk bantuan lebih lanjut.");
                // Hentikan eksekusi lebih lanjut setelah menjawab pertanyaan
                return; 
            }
            // --- AKHIR LOGIKA BARU ---
        } // CLOSING THE smartReportState if block that started at line 247
        
        // --- AWAL LANGKAH BARU: MEMBELI VOUCHER ---
            if (temp[sender]?.step === 'ASK_VOUCHER_CHOICE' && !isGlobalCommand) {
                const chosenPrice = chats.trim().replace(/\D/g, ''); // Ambil angka saja dari balasan user

                if (!chosenPrice) {
                    return reply("Mohon balas dengan *harga* voucher yang ingin Anda beli (contoh: `1000`). Atau ketik *batal* untuk membatalkan.");
                }

                // Validasi pilihan user
                if (!checkhargavoucher(chosenPrice)) {
                    return reply(`Maaf, voucher seharga Rp ${chosenPrice} tidak tersedia. Silakan pilih salah satu dari daftar yang ada, atau ketik *batal*.`);
                }

                // Hapus state karena sudah dapat jawaban
                delete temp[sender];

                // Panggil fungsi proses pembelian
                const helpers = {
                    checkhargavoucher,
                    checkprofvc,
                    checkdurasivc,
                    checkhargavc,
                    checkATMuser,
                    confirmATM,
                    getvoucher
                };
                await processVoucherPurchase(sender, pushname, chosenPrice, reply, helpers, global);

                return; // Hentikan eksekusi setelah memproses pembelian
            }
            // --- AKHIR LANGKAH BARU ---

        // Check if there's an ongoing conversation state
        if (temp[sender] && !isGlobalCommand) {
            const { handleConversationState } = require('./handlers/conversation-state-handler');
            return await handleConversationState({
                sender,
                chats,
                temp,
                reply,
                global,
                isOwner,
                isTeknisi,
                users,
                args,
                entities: {}, // Will be populated if needed
                plainSenderNumber,
                pushname,
                mess,
                sleep,
                getSSIDInfo,
                namabot,
                buatLaporanGangguan
            });
        }

        let intent;
        let entities = {}; // Default entitas kosong
        let matchedKeywordLength = 0; // Menyimpan jumlah kata dari keyword yang cocok

        // --- ALUR BARU DENGAN PRE-FILTER UNTUK MENGHEMAT API GEMINI ---
        // Jangan proses jika pesan kosong atau hanya spasi
        if (!chats || chats.trim() === '') return;

        // Check if user is in WiFi input state BEFORE checking staticIntents
        let skipStaticIntents = false;
        if (temp[sender] && temp[sender].step) {
            const wifiInputStates = [
                'ASK_NEW_NAME_FOR_SINGLE',
                'ASK_NEW_NAME_FOR_SINGLE_BULK',
                'ASK_NEW_NAME_FOR_BULK',
                'ASK_NEW_NAME_FOR_BULK_AUTO',
                'ASK_NEW_PASSWORD',
                'ASK_NEW_PASSWORD_BULK',
                'ASK_NEW_PASSWORD_BULK_AUTO'
            ];
            
            if (wifiInputStates.includes(temp[sender].step)) {
                // Handle batal command
                if (chats.toLowerCase().trim() === 'batal') {
                    delete temp[sender];
                    reply('✅ Proses dibatalkan');
                    return;
                }
                
                // Skip staticIntents for WiFi input
                skipStaticIntents = true;
            }
        }

        const staticIntents = {
            // Menu & Informasi Umum
            'menu': 'MENU_UTAMA',
            'menuwifi': 'MENU_UTAMA',
            'help': 'MENU_UTAMA',
            'menupelanggan': 'MENU_PELANGGAN',
            'pasang': 'TANYA_CARA_PASANG',
            'bulanan': 'TANYA_PAKET_BULANAN',
            'tutorial': 'TUTORIAL_TOPUP',
            'voucher': 'TANYA_HARGA_VOUCHER',
            'bantuan': 'BANTUAN',
            'admin': 'admin', // Kontak admin

            // Fitur Pelanggan
            'ceksaldo': 'CEK_SALDO',
            'topup': 'TOPUP_SALDO', // Perintah statis untuk topup
            'buynow': 'TOPUP_SALDO', // Perintah statis untuk topup via ipaymu

            // Fitur Teknisi & Owner
            'statusppp': 'statusppp',
            'statushotspot': 'statushotspot',
            'monitorwifi': 'monitorwifi',
            'allsaldo': 'allsaldo',
            'alluser': 'alluser',
            'listprofstatik': 'listprofstatik',
            'listprofvoucher': 'listprofvoucher',
            
            // Access Management Commands
            'access': 'ACCESS_MANAGEMENT',
            'hp': 'ACCESS_MANAGEMENT',
            'akses': 'ACCESS_MANAGEMENT',
            'tiketdone': 'SELESAIKAN_TIKET',
            'selesaikantiket': 'SELESAIKAN_TIKET',
            'proses': 'PROSES_TIKET',
            'prosestiket': 'PROSES_TIKET',  // Support both formats
            'remote': 'REMOTE_VERIFICATION',
            'verifikasi': 'VERIFIKASI_OTP',
            'konfirmasi': 'KONFIRMASI_SELESAI',
            'selesai': 'CUSTOMER_CONFIRM_DONE',
            'addprofvoucher': 'addprofvoucher',
            'delprofvoucher': 'delprofvoucher',
            'addprofstatik': 'addprofstatik',
            'delprofstatik': 'delprofstatik',
            'addbinding': 'addbinding',
            'addppp': 'addppp',
            '<topup': '<topup',
            '<delsaldo': '<delsaldo',
            'transfer': 'transfer',

            // Sapaan Umum (untuk mengurangi panggilan AI yang tidak perlu)
            'hallo': 'SAPAAN_UMUM',
            'halo': 'SAPAAN_UMUM',
            'hi': 'SAPAAN_UMUM',
            'hai': 'SAPAAN_UMUM',
            'p': 'SAPAAN_UMUM',
            'min': 'SAPAAN_UMUM',
            'kak': 'SAPAAN_UMUM',
            'mas': 'SAPAAN_UMUM',

            // Perintah Pelanggan - HANYA yang tidak ada di wifi_templates.json
            'lapor': 'LAPOR_GANGGUAN',
            'cektiket': 'CEK_TIKET',
            'batalkantiket': 'BATALKAN_TIKET',
            'belivoucher': 'BELI_VOUCHER',
            'speedboost': 'REQUEST_SPEED_BOOST',
            'sod': 'REQUEST_SPEED_BOOST',
            'speedondemand': 'REQUEST_SPEED_BOOST'
        };

        // --- ALUR DETEKSI INTENT BARU (DIPERBAIKI) ---

        // 1. Cek Intent dari Keyword Handler (Prioritas Utama)
        const keywordResult = getIntentFromKeywords(chats);
        if (keywordResult) {
            intent = keywordResult.intent;
            matchedKeywordLength = keywordResult.matchedKeywordLength;
            console.log(color('[KEYWORD_COMMAND]'), `Phrase: "${chats}" -> Intent: ${intent} (Matched ${matchedKeywordLength} words)`);
        } else if (!skipStaticIntents) {
            // 2. Jika tidak ada, cek perintah statis satu kata (Prioritas Kedua)
            // ONLY check staticIntents if NOT in WiFi input state
            const staticIntent = staticIntents[command];
            if (staticIntent) {
                intent = staticIntent;
                matchedKeywordLength = 1; // Static intent selalu 1 kata

                // Pengecualian khusus untuk 'lapor'
                if (intent === 'LAPOR_GANGGUAN' && command !== 'lapor') {
                    intent = undefined; // Batalkan intent jika tidak diawali dengan 'lapor'
                }

                console.log(color('[STATIC_COMMAND]'), `Command: "${command}" -> Intent: ${intent}`);
            }
        }

        // Lanjutkan ke switch case dengan `intent` yang sudah ditentukan

        switch (intent) {
            case 'MULAI_BERTANYA': {
                // Set state sementara bahwa bot sedang menunggu pertanyaan
                temp[sender] = {
                    step: 'AWAITING_QUESTION'
                };
                // Balas dengan ramah untuk memancing pertanyaan
                reply("Tentu, silakan. Apa yang ingin Anda tanyakan? 😊");
                break;
            }
            case 'TANYA_JAWAB_UMUM': {
                // Gemini disabled - arahkan ke menu bantuan
                reply("Maaf, fitur tanya jawab otomatis sudah tidak tersedia.\n\nSilakan gunakan perintah berikut:\n• *menu* - Lihat menu utama\n• *bantuan* - Lihat panduan\n• Atau hubungi admin untuk bantuan lebih lanjut.");
                break;
            }
            case 'LAPOR_PANDUAN': {
                // Tampilkan panduan smart untuk laporan
                const user = global.users.find(v => v.phone_number && v.phone_number.split("|").includes(plainSenderNumber));
                if (!user) {
                    return reply(mess.userNotRegister);
                }
                
                const panduan = `📋 *PANDUAN LAPORAN CERDAS*\n\n` +
                    `Halo ${pushname || 'Kak'}! Saya siap membantu Anda melaporkan gangguan.\n\n` +
                    `*Cara Cepat Melapor:*\n` +
                    `Langsung ketik keluhan Anda, contoh:\n` +
                    `• "lapor wifi mati"\n` +
                    `• "lapor internet lemot"\n` +
                    `• "lapor tidak bisa browsing"\n` +
                    `• "lapor putus nyambung"\n\n` +
                    `*Keuntungan:*\n` +
                    `✅ Otomatis deteksi jenis gangguan\n` +
                    `✅ Langsung dapat nomor tiket\n` +
                    `✅ Teknisi segera ditugaskan\n\n` +
                    `💡 *Tips:* Semakin detail laporan Anda, semakin cepat kami bisa membantu!\n\n` +
                    `Silakan langsung ketik keluhan Anda sekarang.`;
                
                reply(panduan);
                break;
            }
            case 'LAPOR_GANGGUAN': {
                // General report - show menu for selection
                console.log('[REPORT] Starting report flow with menu');
                
                const { deleteUserState } = require('./handlers/conversation-handler');
                deleteUserState(sender);
                
                const { startReportFlow } = require('./handlers/smart-report-text-menu');
                const result = await startReportFlow({
                    sender,
                    pushname,
                    reply
                });
                
                if (result.message) {
                    await reply(result.message);
                }
                break;
            }
            
            case 'LAPOR_GANGGUAN_MATI': {
                console.log('[REPORT] Processing MATI report with proper SOP');
                
                const { deleteUserState } = require('./handlers/conversation-handler');
                deleteUserState(sender);
                
                await reply(`⏳ Sedang memeriksa status perangkat Anda...`);
                
                // Use proper handler from smart-report-handler.js
                const { handleGangguanMati } = require('./handlers/smart-report-handler');
                
                const result = await handleGangguanMati({
                    sender,
                    pushname,
                    userPelanggan: null, // Will be found in handler
                    reply,
                    findUserByPhone: null // Will use global.users
                });
                
                if (result.message) {
                    await reply(result.message);
                }
                break;
            }
            
            case 'LAPOR_GANGGUAN_LEMOT': {
                console.log('[REPORT] Processing LEMOT report with proper SOP');
                
                const { deleteUserState } = require('./handlers/conversation-handler');
                deleteUserState(sender);
                
                // Use proper handler from smart-report-handler.js
                const { handleGangguanLemot } = require('./handlers/smart-report-handler');
                
                const result = await handleGangguanLemot({
                    sender,
                    pushname,
                    userPelanggan: null, // Will be found in handler
                    reply,
                    findUserByPhone: null // Will use global.users
                });
                
                if (result.message) {
                    await reply(result.message);
                }
                break;
            }
            case 'statusppp': {
                const { handleStatusPpp } = require('./handlers/monitoring-handler');
                await handleStatusPpp(isOwner, isTeknisi, reply, mess, global.config);
            }
            break;
            case 'statushotspot': {
                const { handleStatusHotspot } = require('./handlers/monitoring-handler');
                await handleStatusHotspot(isOwner, isTeknisi, reply, mess, global.config);
            }
            break;
            // LAPOR_GANGGUAN already handled in combined case above
            case 'CEK_TIKET': { 
                const { handleCekTiket } = require('./handlers/utility-handler');
                handleCekTiket(q, pushname, sender, isOwner, isTeknisi, global.config, global, reply);
                break;
            }
            case 'BATALKAN_TIKET': {
                // Fitur ini hanya untuk pelanggan, bukan admin/teknisi via WA
                if (isOwner || isTeknisi) {
                    return reply(`Fitur ini khusus untuk pelanggan. Admin dapat membatalkan tiket melalui antarmuka web.`);
                }

                // Extract ticket ID from original chats (not from q which might be empty)
                let ticketId = '';
                const originalMessage = chats.trim();
                
                // Remove "batalkantiket" or "batalkan tiket" from the beginning (case insensitive)
                const cleanedMessage = originalMessage.replace(/^batalkan\s*tiket\s*/i, '').trim();
                
                // The remaining part should be the ticket ID
                if (cleanedMessage && cleanedMessage.length > 0) {
                    ticketId = cleanedMessage.toUpperCase();
                }

                if (!ticketId || ticketId.length < 5) {
                    // If no ID provided, show active tickets (both 'baru' and 'pending' status)
                    const userReports = global.reports.filter(
                        r => r.pelangganId === sender && (r.status === 'baru' || r.status === 'pending')
                    );

                    if (userReports.length === 0) {
                        return reply(`Halo Kak ${pushname}, saat ini Anda tidak memiliki laporan aktif yang bisa dibatalkan.\n\nFormat: *batalkantiket [ID_TIKET]*`);
                    }

                    let listMessage = `📋 *Laporan Anda yang bisa dibatalkan:*\n\n`;
                    userReports.forEach(r => {
                        listMessage += `ID: *${r.ticketId}*\nStatus: ${r.status}\nTanggal: ${new Date(r.createdAt).toLocaleString('id-ID')}\n\n`;
                    });
                    listMessage += `Untuk membatalkan, ketik:\n*batalkantiket [ID_TIKET]*`;
                    return reply(listMessage);
                }

                // Find the specific ticket
                const activeReport = global.reports.find(
                    r => r.ticketId === ticketId
                );

                if (!activeReport) {
                    return reply(`❌ Tiket dengan ID *${ticketId}* tidak ditemukan.\n\nSilakan cek kembali ID tiket Anda.`);
                }

                // Verify ticket belongs to sender
                if (activeReport.pelangganId !== sender) {
                    return reply(`❌ Tiket dengan ID *${ticketId}* bukan milik Anda.`);
                }

                // Check if already cancelled
                if (activeReport.status === 'dibatalkan' || activeReport.status === 'dibatalkan pelanggan') {
                    return reply(`ℹ️ Tiket dengan ID *${ticketId}* sudah dibatalkan sebelumnya.`);
                }

                // Check if already completed
                if (activeReport.status === 'selesai') {
                    return reply(`ℹ️ Tiket dengan ID *${ticketId}* sudah selesai ditangani.`);
                }

                // Jika laporan sudah diproses teknisi, tidak bisa dibatalkan
                if (activeReport.status === 'diproses teknisi' || activeReport.status === 'otw' || activeReport.status === 'sampai lokasi') {
                    return reply(`⚠️ Maaf, laporan Anda dengan ID *${ticketId}* sudah dalam penanganan teknisi dan tidak dapat dibatalkan.\n\nStatus: *${activeReport.status}*\n\nSilakan hubungi Admin jika ada keperluan mendesak.`);
                }

                // Jika laporan masih 'baru' atau 'pending', bisa dibatalkan
                if (activeReport.status === 'baru' || activeReport.status === 'pending') {
                    const reportDetails = activeReport.laporanText ? 
                        activeReport.laporanText.substring(0, 75) + (activeReport.laporanText.length > 75 ? '...' : '') : 
                        'Tidak ada deskripsi';

                    // Simpan state untuk langkah konfirmasi
                    temp[sender] = {
                        step: 'CONFIRM_CANCEL_TICKET',
                        ticketIdToCancel: activeReport.ticketId
                    };

                    return reply(`📋 *Konfirmasi Pembatalan Tiket*\n\nID: *${activeReport.ticketId}*\nLaporan: _"${reportDetails}"_\nStatus: ${activeReport.status}\n\nAnda yakin ingin membatalkan laporan ini?\n\nBalas *ya* untuk konfirmasi pembatalan\nBalas *tidak* untuk membatalkan`);
                }

                // CATCH-ALL: Handle unexpected status (should not happen now)
                return reply(`⚠️ Tiket dengan ID *${ticketId}* memiliki status: *${activeReport.status}*\n\nStatus ini tidak dapat diproses untuk pembatalan. Silakan hubungi admin untuk bantuan.`);
                break;
            }
            
            case 'KONFIRMASI_SELESAI': {
                if (!isTeknisi && !isOwner) return reply(mess.teknisiOrOwnerOnly);
                const args = q.split(' ');
                if (args.length < 2) return reply("Format: konfirmasi [ID_TIKET] [KODE]");
                
                const ticketId = args[0];
                const code = args[1];
                
                const result = await handleFinalConfirmation({
                    ticketId,
                    completionCode: code,
                    isFromCustomer: false,
                    sender
                });
                
                if (result.message) {
                    await reply(result.message);
                }
                break;
            }
            
            case 'CUSTOMER_CONFIRM_DONE': {
                // Check for customer remote verification response
                // This should be early in the flow to catch responses like "OK", "VIDEO", etc.
                if (!isOwner && !isTeknisi) { // Only for customers
                    const remoteResponse = await handleRemoteResponse({
                        customerId: sender,
                        response: lowerMessage,
                        reply
                    });
                    
                    if (remoteResponse) {
                        return reply(remoteResponse.message);
                    }
                }
                
                // Find if customer has this ticket
                const report = global.reports.find(r => 
                    r.ticketId === ticketId && 
                    r.pelangganId === sender
                );
                
                if (!report) {
                    return reply("❌ Tiket tidak ditemukan atau bukan milik Anda.");
                }
                
                const result = await handleFinalConfirmation({
                    ticketId,
                    completionCode: code,
                    isFromCustomer: true,
                    sender
                });
                
                if (result.message) {
                    await reply(result.message);
                }
                break;
            }
            
            case 'SELESAIKAN_TIKET': // Old flow - redirect to new flow
            case 'tiketdone': {
                if (!isTeknisi && !isOwner) return reply(mess.teknisiOrOwnerOnly);
                if (!q) return reply("Mohon sertakan nomor tiket yang ingin diselesaikan. Contoh: tiketdone [ID_TIKET]");

                const ticketIdToResolve = q.trim();
                const reportIndex = global.reports.findIndex(r => r.ticketId === ticketIdToResolve);

                if (reportIndex === -1) {
                    return reply(`❌ Tiket dengan ID *${ticketIdToResolve}* tidak ditemukan.\n\nPastikan ID tiket benar.`);
                }

                const report = global.reports[reportIndex];

                if (report.status === 'selesai') {
                    return reply(`⚠️ Tiket *${ticketIdToResolve}* sudah selesai sebelumnya.`);
                }

                // Inisiasi proses upload foto dokumentasi
                const { setUserState } = require('./handlers/conversation-handler');
                setUserState(sender, {
                    step: 'TICKET_RESOLVE_UPLOAD_PHOTOS',
                    ticketIdToResolve: ticketIdToResolve,
                    uploadedPhotos: [],
                    uploadStartTime: Date.now()
                });

                await reply(`📸 *Dokumentasi Penyelesaian Tiket*

ID Tiket: *${ticketIdToResolve}*
Pelanggan: ${report.pelangganName || report.pelangganPushName || 'N/A'}

Silakan upload foto dokumentasi perbaikan:
• Foto ONT/Router setelah perbaikan
• Foto kabel yang sudah diperbaiki
• Screenshot speedtest (jika ada)
• Foto lainnya yang relevan

📤 *Cara Upload:*
1. Kirim foto satu per satu
2. Setelah selesai, ketik *selesai*
3. Atau ketik *skip* untuk lewati foto

⏱️ Timeout: 10 menit`);
            }
            break;
            case 'TOPUP_SALDO': // Sesuaikan dengan intent yang mungkin dari Gemini
            case 'buynow': {
                const { handleTopupSaldoPayment } = require('./handlers/payment-processor-handler');
                await handleTopupSaldoPayment({
                    sender,
                    pushname,
                    command,
                    q,
                    from,
                    msg,
                    reply,
                    raf: global.raf,
                    pay,
                    checkprofvc,
                    checkhargavoucher,
                    checkhargavc,
                    addPayment
                });
            }
            break;
            case 'BELI_VOUCHER': {
                const { handleBeliVoucher } = require('./handlers/payment-processor-handler');
                const helpers = {
                    checkhargavoucher,
                    checkprofvc,
                    checkdurasivc,
                    checkhargavc,
                    checkATMuser,
                    confirmATM,
                    getvoucher
                };
                await handleBeliVoucher({
                    sender,
                    pushname,
                    entities,
                    q,
                    reply,
                    temp,
                    global,
                    helpers
                });
            }
            break
            case 'button': {
                // Button deprecated, gunakan text menu
                await reply(`Hi Kak ${pushname}! 👋

📋 *MENU UTAMA*

Silakan pilih menu:

*1️⃣ MENU WIFI*
   List menu untuk WiFi

*2️⃣ MENU PELANGGAN*  
   List menu pelanggan

*3️⃣ INFO PASANG*
   Harga pasang WiFi

━━━━━━━━━━━━━━━━
Ketik angka pilihan Anda (1/2/3)
atau ketik:
• *menuwifi* - Menu WiFi
• *menupelanggan* - Menu Pelanggan  
• *pasang* - Info Pasang`);
            }
            break;
            case 'BANTUAN': {
                const { handleBantuan } = require('./handlers/utility-handler');
                handleBantuan(pushname, global.config, reply);
                break;
            }
            case 'SAPAAN_UMUM': {
                const { handleSapaanUmum } = require('./handlers/utility-handler');
                handleSapaanUmum(pushname, reply);
                break;
            }
            case 'MENU_PELANGGAN': {
                const { handleMenuPelanggan } = require('./handlers/menu-handler');
                handleMenuPelanggan(global.config, reply, pushname, sender);
            }
            break;
            case 'MENU_UTAMA':
            case 'help':
            case 'menu wifi' :
            case 'menuwifi': {
                const { handleMenuUtama } = require('./handlers/menu-handler');
                handleMenuUtama(global.config, reply, pushname, sender);
            }
            break;
            case 'MENU_TEKNISI': {
                const { handleMenuTeknisi } = require('./handlers/menu-handler');
                handleMenuTeknisi(global.config, reply, pushname, sender);
            }
            break;
            // case 'menuvoucher': {
            //     reply(menuvoucher(global.config.nama, global.config.namabot))
            // }
            break;
            case 'MENU_OWNER': {
                const { handleMenuOwner } = require('./handlers/menu-handler');
                handleMenuOwner(global.config, isOwner, reply, pushname, sender);
            }
            break;
            case 'TANYA_CARA_PASANG': {
                const { handleTanyaCaraPasang } = require('./handlers/menu-handler');
                handleTanyaCaraPasang(global.config, reply, pushname, sender);
            }
            break;
            case 'TANYA_PAKET_BULANAN': {
                const { handleTanyaPaketBulanan } = require('./handlers/menu-handler');
                handleTanyaPaketBulanan(global.config, reply, pushname, sender);
            }
            break;
            case 'TUTORIAL_TOPUP': {
                const { handleTutorialTopup } = require('./handlers/menu-handler');
                handleTutorialTopup(global.config, reply, pushname, sender);
            }
            break;
            case 'listprofstatik': {
                const { handleListProfStatik } = require('./handlers/monitoring-handler');
                handleListProfStatik(isOwner, reply, mess, statik);
            }
            break;
            case 'listprofvoucher': {
                const { handleListProfVoucher } = require('./handlers/monitoring-handler');
                handleListProfVoucher(isOwner, reply, mess, voucher);
            }
            break;
            case 'CEK_SALDO': {
                const { handleCekSaldo } = require('./handlers/saldo-voucher-handler');
                handleCekSaldo(sender, pushname, global.config, format, reply);
            }
            break;
            case 'TANYA_HARGA_VOUCHER': {
                const { handleTanyaHargaVoucher } = require('./handlers/saldo-voucher-handler');
                handleTanyaHargaVoucher(pushname, global.config, global.voucher, format, reply);
            }
            break;
            case 'ACCESS_MANAGEMENT': {
                const { handleAccessManagement } = require('./handlers/access-management-handler');
                handleAccessManagement({
                    sender,
                    args,
                    users: global.users,
                    reply,
                    global,
                    db
                });
            }
            break;
            case 'admin': {
                const { handleAdminContact } = require('./handlers/utility-handler');
                handleAdminContact(from, ownerNumber, global.config, msg, sendContact);
            }
            break;
            case 'statusap': {
                const { handleStatusAp } = require('./handlers/monitoring-handler');
                await handleStatusAp(isOwner, reply, mess);
            }
            break
            case 'allsaldo': {
                const { handleAllSaldo } = require('./handlers/monitoring-handler');
                handleAllSaldo(isOwner, reply, mess, global.config, atm);
            }
            break
            // Respon Button Wifi
            case 'vc123': {
                const { handleVc123 } = require('./handlers/saldo-voucher-handler');
                handleVc123(global.config, voucher, reply);
            }
            break
            case 'alluser': {
                const { handleAllUser } = require('./handlers/monitoring-handler');
                handleAllUser(reply, users);
            }
            break
case 'GANTI_NAMA_WIFI': {
    const { handleGantiNamaWifi } = require('./handlers/wifi-management-handler');
    await handleGantiNamaWifi({
        sender,
        args,
        matchedKeywordLength,
        isOwner,
        isTeknisi,
        pushname,
        users,
        reply,
        global,
        temp,
        mess
    });
    break;
}
            //GenieACS Change Pass
case 'GANTI_SANDI_WIFI': {
    const { handleGantiSandiWifi } = require('./handlers/wifi-management-handler');
    await handleGantiSandiWifi({
        sender,
        args,
        matchedKeywordLength,
        isOwner,
        isTeknisi,
        pushname,
        users,
        reply,
        global,
        temp,
        mess
    });
    break;
}
            //Change Power Modem
            case 'GANTI_POWER_WIFI': {
                const { handleGantiPowerWifi } = require('./handlers/wifi-power-handler');
                await handleGantiPowerWifi({
                    sender,
                    args,
                    q,
                    isOwner,
                    isTeknisi,
                    users,
                    reply,
                    global,
                    mess
                });
                break;
            }
            //Reboot Modem
            case 'REBOOT_MODEM': {
                const { handleRebootModem } = require('./handlers/reboot-modem-handler');
                handleRebootModem({
                    sender,
                    entities,
                    isOwner,
                    isTeknisi,
                    plainSenderNumber,
                    pushname,
                    users,
                    reply,
                    temp,
                    mess
                });
                break;
            }
case 'CEK_WIFI': {
    const { handleCekWifi } = require('./handlers/wifi-check-handler');
    await handleCekWifi({
        sender,
        args,
        isOwner,
        isTeknisi,
        pushname,
        users,
        reply,
        global,
        mess
    });
    break;
}

case 'HISTORY_WIFI': {
    const { handleHistoryWifi } = require('./handlers/wifi-history-handler');
    await handleHistoryWifi(sender, reply, global);
    break;
}

            //Monitoring All Modem
            case 'monitorwifi': {
                const { handleMonitorWifi } = require('./handlers/monitoring-handler');
                handleMonitorWifi(isOwner, isTeknisi, reply, mess);
                break;
            }
            case 'addprofvoucher': {
                const { handleAddProfVoucher } = require('./handlers/voucher-management-handler');
                await handleAddProfVoucher({ q, isOwner, reply, mess, checkprofvoucher, addvoucher });
                break;
            }
            case 'delprofvoucher': {
                const { handleDelProfVoucher } = require('./handlers/voucher-management-handler');
                await handleDelProfVoucher({ q, isOwner, reply, mess, checkprofvoucher, voucher });
                break;
            }
            case 'addprofstatik': {
                const { handleAddProfStatik } = require('./handlers/voucher-management-handler');
                await handleAddProfStatik({ q, isOwner, reply, mess, checkStatik, addStatik });
                break;
            }
            case 'delprofstatik': {
                const { handleDelProfStatik } = require('./handlers/voucher-management-handler');
                await handleDelProfStatik({ q, isOwner, reply, mess, checkStatik, statik });
                break;
            }
            case 'addbinding': {
                const { handleAddBinding } = require('./handlers/network-management-handler');
                await handleAddBinding({ 
                    q, 
                    isOwner, 
                    reply, 
                    mess, 
                    global, 
                    checkStatik, 
                    checkLimitAt, 
                    checkMaxLimit, 
                    addbinding, 
                    addqueue 
                });
                break;
            }
            case 'addppp': {
                const { handleAddPPP } = require('./handlers/network-management-handler');
                await handleAddPPP({ q, isOwner, reply, mess, addpppoe });
                break;
            }
            //     case '>':
            //         if(!isOwner) throw mess.owner
            // 	try {
            //         let evaled = await eval(chats.slice(2))
            // 		if (typeof evaled !== 'string') evaled = require('util').inspect(evaled)
            //     	raf.sendMessage(from, {text: evaled}, {quoted: msg})
            // 	} catch (err) {
            // 		raf.sendMessage(from, {text: `${err}`}, {quoted: msg})
            // 	}
            // 	  break
            // 	  case '$':
            //         if(!isOwner) throw mess.owner
            // 	  exec(chats.slice(2), (err, stdout) => {
            // 		 if (err) return raf.sendMessage(from, {text: `${err}`}, {quoted:msg})
            // 	     if (stdout) raf.sendMessage(from, {text: `${stdout}`}, {quoted:msg})
            // 	  })
            //   break
            case '<topup': {
                const { handleTopup } = require('./handlers/balance-management-handler');
                await handleTopup({ q, isOwner, sender, reply, msg, mess, raf, checkATMuser, addATM, addKoinUser });
                break;
            }
            case '<delsaldo': {
                const { handleDelSaldo } = require('./handlers/balance-management-handler');
                await handleDelSaldo({ q, isOwner, reply, mess, checkATMuser, delSaldo });
                break;
            }
            case 'transfer': {
                const { handleTransfer } = require('./handlers/balance-management-handler');
                await handleTransfer({ q, sender, reply, msg, mess, raf, checkATMuser, addATM, addKoinUser, confirmATM, format });
                break;
            }
                // case 'addreseller':
                //         if (!isOwner) return await reply('Fitur Ini Hanya Khusus Owner Wifi !!!')
                //         if (!qthrreply('Fomat Salah !!! Ketik addreseller (nomor yang dituju) dengan awalan 62 jangan 0.')
                // 		if(isNaN(q)) throw mess.mustNumber
                // 		const nomortujuan = `${q.replace("@", '')}@s.whatsapp.net`
                // 	    reseller.push(nomortujuan)
                // 	    fs.writeFileSync('./database/reseller.json', JSON.stringify(reseller))
                // 		reply(`Pendaftaran Akun Berhasil Dengan Format\n\nNomor Hp : ${q}`)
                //     break
                // case '<addreseller':
                    // if (!isOwner) return await reply('Fitur Ini Hanya Khusus Owner Wifi !!!')
                    // let men = msg.message.extendedTextMessage.contextInfo.mentionedJid
                    // //via tag
                    // if (men.length > 1) {
                    // for (let ids of men) {
                    // reseller.push(ids)
                    // fs.writeFileSync('./database/reseller.json', JSON.stringify(reseller))
                    // reply('Sukses menambahkan User Di Database Reseller')
                    // }
                    // } else {
                    // reseller.push(men[0])
                    // fs.writeFileSync('./database/reseller.json', JSON.stringify(reseller))
                    // reply('Sukses menambahkan User Di Database Reseller')
                    // } else {
                    // //Via quoted
                    // let men = msg.message.extendedTextMessage.contextInfo.participant
                    // reseller.push(men)
                    // fs.writeFileSync('./database/reseller.json', JSON.stringify(reseller))
                    // reply('Sukses menambahkan User Di Database Reseller')
                    // }
                    // break
                    // case '<unreseller':
                    //     if (!isOwner) return await reply('Fitur Ini Hanya Khusus Owner Wifi !!!')
                    //     if (mentioned.length !== 0){
                    //         for (let i = 0; i < mentioned.length; i++){
                    //             unReseller(mentioned[i], reseller)
                    //         }
                    //         reply('Sukses menghapus User Di Database Reseller')
                    //     }if (isQuotedMsg) {
                    //         unReseller(quotedMsg.sender, reseller)
                    //         reply(`Sukses menghapus User Di Database Reseller`)
                    //     } else if (!isNaN(args[1])) {
                    //         unReseller(args[1] + '@s.whatsapp.net', reseller)
                    //         reply('Sukses menghapus User Di Database Reseller')
                    //     } else {
                    //         reply(`Kirim perintah unreseller @tag atau nomor atau reply pesan orang yang ingin dihapus di Database Reseller`)
                    //     }
                    //     break
            case 'CEK_TAGIHAN': {
                const { handleCekTagihan } = require('./handlers/billing-management-handler');
                await handleCekTagihan({ plainSenderNumber, pushname, reply, mess, global, renderTemplate });
                break;
            }
            case 'UBAH_PAKET': {
                const { handleUbahPaket } = require('./handlers/package-management-handler');
                await handleUbahPaket({ sender, plainSenderNumber, pushname, reply, mess, global, temp });
                break;
            }
            case 'REQUEST_SPEED_BOOST': {
                const { handleRequestSpeedBoost } = require('./handlers/package-management-handler');
                await handleRequestSpeedBoost({ sender, plainSenderNumber, pushname, reply, mess, global, temp });
                break;
            }
            
            // ===================== LOCATION TRACKING CASES =====================
            
            case 'CEK_LOKASI_TEKNISI': {
                // Skip matched keyword words to get the actual argument
                const commandArgs = chats.split(' ').slice(matchedKeywordLength || 1);
                const ticketIdLokasi = commandArgs[0];
                
                if (!ticketIdLokasi) {
                    return reply('❌ Format: lokasi [ID_TIKET]\n\nContoh: lokasi UH4P8XJ');
                }
                
                const lokasiResult = await handleCekLokasiTeknisi(
                    sender,
                    ticketIdLokasi,
                    reply
                );
                return reply(lokasiResult.message);
            }
            
            // REMOVED - Using the one from teknisi-workflow-handler below
            // case 'SAMPAI_LOKASI' handled in TEKNISI WORKFLOW section
            
            case 'TIKET_SAYA': {
                const tiketResult = await handleTiketSaya(sender, reply);
                return reply(tiketResult.message);
            }
            
            // ===================== END LOCATION TRACKING =====================
            
            // ===================== TEKNISI WORKFLOW COMMANDS =====================
            
            case 'LIST_TIKET': {
                if (!isTeknisi && !isOwner) return reply(mess.teknisiOrOwnerOnly);
                
                // Get pending tickets
                const pendingTickets = global.reports?.filter(r => 
                    r.status === 'pending' || r.status === 'open'
                ) || [];
                
                if (pendingTickets.length === 0) {
                    return reply(`📋 *TIDAK ADA TIKET TERSEDIA*
━━━━━━━━━━━━━━━━

Saat ini tidak ada tiket yang perlu ditangani.

📌 *Tips:*
• Cek berkala dengan *list tiket*
• Akan ada notifikasi jika ada tiket baru
• Siap siaga untuk respons cepat

Terima kasih! 👍`);
                }
                
                // Sort by priority and time
                pendingTickets.sort((a, b) => {
                    // HIGH priority first
                    if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
                    if (a.priority !== 'HIGH' && b.priority === 'HIGH') return 1;
                    // Then by time
                    return new Date(a.createdAt) - new Date(b.createdAt);
                });
                
                let message = `📋 *DAFTAR TIKET TERSEDIA*
━━━━━━━━━━━━━━━━

*Total: ${pendingTickets.length} tiket menunggu*\n\n`;
                
                pendingTickets.forEach((ticket, index) => {
                    const createdTime = new Date(ticket.createdAt);
                    const waitingMinutes = Math.floor((Date.now() - createdTime) / (1000 * 60));
                    const priorityEmoji = ticket.priority === 'HIGH' ? '🔴' : '🟡';
                    
                    message += `${index + 1}. *ID: ${ticket.ticketId}*
   ${priorityEmoji} Prioritas: ${ticket.priority}
   👤 ${ticket.pelangganName}
   📍 ${ticket.pelangganAddress || 'Alamat tidak tersedia'}
   ⏱️ Menunggu: ${waitingMinutes} menit
   📝 ${ticket.issueType || 'Gangguan'}
   
`;
                });
                
                message += `━━━━━━━━━━━━━━━━
📌 *STEP SELANJUTNYA:*
➡️ Ambil tiket dengan ketik:
   *proses [ID_TIKET]*

Contoh: proses ${pendingTickets[0].ticketId}

💡 *Tips:* Prioritaskan tiket 🔴 HIGH`;
                
                return reply(message);
            }
            
            case 'PROSES_TIKET': {
                if (!isTeknisi && !isOwner) return reply(mess.teknisiOrOwnerOnly);
                
                // Extract ticket ID after matched keywords (support multi-word keywords)
                const words = chats.split(' ');
                const ticketId = words[matchedKeywordLength] || words[1];
                if (!ticketId) {
                    return reply('❌ Format: proses [ID_TIKET]\n\nContoh: proses ABC123');
                }
                
                const { handleProsesTicket } = require('./handlers/teknisi-workflow-handler');
                const result = await handleProsesTicket(sender, ticketId, reply);
                return reply(result.message);
            }
            
            case 'OTW_TIKET': {
                if (!isTeknisi && !isOwner) return reply(mess.teknisiOrOwnerOnly);
                
                // Extract ticket ID after matched keywords (support multi-word keywords like "mulai perjalanan")
                const words = chats.split(' ');
                const ticketId = words[matchedKeywordLength] || words[1];
                if (!ticketId) {
                    return reply('❌ Format: otw/mulai perjalanan [ID_TIKET]\n\nContoh:\n• otw ABC123\n• mulai perjalanan ABC123\n\nTips: Share lokasi setelah perintah');
                }
                
                const { handleOTW } = require('./handlers/teknisi-workflow-handler');
                const result = await handleOTW(sender, ticketId, null, reply);
                return reply(result.message);
            }
            
            case 'SAMPAI_LOKASI': {
                if (!isTeknisi && !isOwner) return reply(mess.teknisiOrOwnerOnly);
                
                // Extract ticket ID after matched keywords (support multi-word keywords like "sampai lokasi")
                const words = chats.split(' ');
                const ticketId = words[matchedKeywordLength] || words[1];
                if (!ticketId) {
                    return reply('❌ Format: sampai/sampai lokasi [ID_TIKET]\n\nContoh:\n• sampai ABC123\n• sampai lokasi ABC123');
                }
                
                const { handleSampaiLokasi } = require('./handlers/teknisi-workflow-handler');
                const result = await handleSampaiLokasi(sender, ticketId, reply);
                return reply(result.message);
            }
            
            case 'VERIFIKASI_OTP': {
                if (!isTeknisi && !isOwner) return reply(mess.teknisiOrOwnerOnly);
                
                // Extract parameters after matched keywords
                const args = chats.split(' ');
                const ticketId = args[matchedKeywordLength] || args[1];
                const otp = args[matchedKeywordLength + 1] || args[2];
                
                if (!ticketId || !otp) {
                    return reply('❌ Format: verifikasi [ID_TIKET] [OTP]\n\nContoh: verifikasi ABC123 456789');
                }
                
                const { handleVerifikasiOTP } = require('./handlers/teknisi-workflow-handler');
                const result = await handleVerifikasiOTP(sender, ticketId, otp, reply);
                return reply(result.message);
            }
            
            case 'DONE_UPLOAD_PHOTOS': {
                if (!isTeknisi && !isOwner) return reply(mess.teknisiOrOwnerOnly);
                
                // Check if teknisi has active state
                const state = global.teknisiStates && global.teknisiStates[sender];
                
                if (!state || state.step !== 'AWAITING_COMPLETION_PHOTOS') {
                    return reply('❌ *TIDAK ADA SESI AKTIF*\n\n📌 *Urutan yang benar:*\n1️⃣ proses [ID]\n2️⃣ otw [ID]\n3️⃣ sampai [ID]\n4️⃣ verifikasi [ID] [OTP]\n5️⃣ Upload foto\n6️⃣ done/lanjut/next \u2190 Anda di sini\n\nSilakan mulai dari awal dengan *proses [ID_TIKET]*');
                }
                
                if (!state.uploadedPhotos || state.uploadedPhotos.length < 2) {
                    return reply(`❌ *FOTO BELUM CUKUP!*\n\n📌 *STATUS:*\n• Foto terupload: ${state.uploadedPhotos?.length || 0}\n• Minimum required: 2 foto\n• Kurang: ${2 - (state.uploadedPhotos?.length || 0)} foto\n\n📌 *STEP SELANJUTNYA:*\n➡️ Upload ${2 - (state.uploadedPhotos?.length || 0)} foto lagi\n   Kemudian ketik *done*`);
                }
                
                // Move to resolution notes step
                state.step = 'AWAITING_RESOLUTION_NOTES';
                
                return reply(`✅ *DOKUMENTASI SELESAI - ${state.uploadedPhotos.length} FOTO TERSIMPAN*

📌 *STEP SELANJUTNYA:*
📝 *ISI CATATAN RESOLUSI PERBAIKAN*
━━━━━━━━━━━━━━━━

Silakan ketik catatan perbaikan Anda.

*Format Bebas (min. 10 karakter):*
🔸 "Restart modem, sudah normal"
🔸 "Ganti kabel drop, sinyal OK" 
🔸 "Setting ulang router, speed normal"

*Atau Format Detail:*
*Masalah:* [apa masalahnya]
*Solusi:* [apa yang diperbaiki]
*Status:* [hasil akhir]

➡️ Ketik catatan Anda sekarang...`);
            }
            
            case 'SELESAI_TIKET': {
                if (!isTeknisi && !isOwner) return reply(mess.teknisiOrOwnerOnly);
                
                const ticketId = chats.split(' ')[1];
                if (!ticketId) {
                    return reply('❌ Format: selesai [ID_TIKET]\n\nContoh: selesai ABC123\n\n⚠️ Pastikan sudah upload minimal 2 foto!');
                }
                
                const { handleSelesaiTicket } = require('./handlers/teknisi-workflow-handler');
                const result = await handleSelesaiTicket(sender, ticketId, reply);
                return reply(result.message);
            }
            
            // ===================== END TEKNISI WORKFLOW =====================
            
            default:
                if (intent === "TIDAK_DIKENALI") {
                    // Do nothing to avoid spamming user conversations.
                }
                break;
        }
        // End of switch statement
        
    } catch (err) {
        if (typeof err === "string") return reply(String(err));
        console.log(err)
    }
}

// Functions now imported from handlers above
