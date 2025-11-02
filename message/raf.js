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

// Fungsi untuk menyimpan laporan langsung dari raf.js
// Ini adalah alternatif jika Anda tidak ingin memodifikasi index.js untuk saveReports()
// atau jika saveReports() tidak diekspor dari index.js
function saveReportsToFile(data) {
    try {
        fs.writeFileSync(reportsDbPathRaf, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('[RAF_JS_SAVE_ERROR] Gagal menyimpan data laporan:', error);
    }
}
// FUNGSI BARU UNTUK GENERATE ID TIKET
function generateTicketId(length = 7) { // Default 7 digit, bisa diubah antara 6-8
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return `${result}`; // Tambahkan prefix LP- agar mudah dikenali
}

let {
    ownerNumber
    // nama,
    // namabot,
    // parentbinding,
    // telfon
} = global.config
let temp = {};

module.exports = async(raf, msg, m) => {
    const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = await import('@whiskeysockets/baileys');

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
        // Check Smart Report Handler States first (using conversation-handler)
        const smartReportState = getUserState(sender);
        if (smartReportState) {
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
        if (temp[sender]) {
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

            // --- AWAL LANGKAH BARU: MEMBELI VOUCHER ---
            if (temp[sender]?.step === 'ASK_VOUCHER_CHOICE') {
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
                await processVoucherPurchase(sender, pushname, chosenPrice, reply);

                return; // Hentikan eksekusi setelah memproses pembelian
            }
            // --- AKHIR LANGKAH BARU ---


            const userState = temp[sender];
            const userReply = chats.toLowerCase().trim();

            // Perintah universal untuk membatalkan proses - HAPUS 'tidak' dari daftar ini
            if (['batal', 'cancel', 'ga jadi', 'gak jadi'].includes(userReply)) {
                delete temp[sender];
                return reply("Baik, permintaan sebelumnya telah dibatalkan. Ada lagi yang bisa saya bantu?");
            }

            // Tangani sesuai langkah (step) yang tersimpan
            switch (userState.step) {
                // --- AWAL LANGKAH BARU: GANTI NAMA WIFI (BULK) ---
                case 'SELECT_CHANGE_MODE_FIRST': // Jika nama belum diberikan
                case 'SELECT_CHANGE_MODE': { // Jika nama sudah diberikan
                    const choice = userReply.trim();
                    if (choice === '1') { // Ubah satu SSID
                        userState.step = 'SELECT_SSID_TO_CHANGE';
                        const ssidList = userState.ssid_info || userState.bulk_ssids.map((id, index) => `${index + 1}. SSID ${id}`).join('\n');
                        return reply(`Baik, Anda memilih untuk mengubah satu SSID.\n\nBerikut daftar SSID Anda:\n${ssidList}\n\nSilakan balas dengan *nomor* SSID yang ingin Anda ubah (misalnya: \`1\`).`);
                    } else if (choice === '2') { // Ubah semua SSID
                        if (userState.nama_wifi_baru) { // Jika nama sudah ada, langsung konfirmasi
                            userState.step = 'CONFIRM_GANTI_NAMA_BULK';
                            userState.selected_ssid_indices = userState.bulk_ssids.map((_, index) => index); // Pilih semua
                            return reply(`Siap! Nama untuk *semua SSID* akan diubah menjadi *"${userState.nama_wifi_baru}"*.\n\nSudah benar? Balas *'ya'* untuk melanjutkan.`);
                        } else { // Jika nama belum ada, tanya dulu
                            userState.step = 'ASK_NEW_NAME_FOR_BULK';
                            return reply("Oke, Anda memilih untuk mengubah semua SSID sekaligus. Silakan ketik nama WiFi baru yang Anda inginkan.\n\n📝 *Ketentuan nama WiFi:*\n• Maksimal 32 karakter\n• Boleh menggunakan huruf, angka, spasi, titik, dan tanda hubung\n• Contoh: WiFiRumah, Keluarga-Bahagia\n\n💡 Ketik *batal* jika ingin membatalkan proses ini.");
                        }
                    } else {
                        return reply("Pilihan tidak valid. Mohon balas dengan angka *1* atau *2*.");
                    }
                }
                case 'SELECT_SSID_TO_CHANGE': {
                    const choiceIndex = parseInt(userReply, 10) - 1;
                    if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= userState.bulk_ssids.length) {
                        return reply("Nomor SSID tidak valid. Mohon balas dengan nomor yang sesuai dari daftar.");
                    }
                    userState.selected_ssid_indices = [choiceIndex]; // Simpan index SSID yang dipilih

                    if (userState.nama_wifi_baru) { // Jika nama sudah ada, langsung konfirmasi
                        userState.step = 'CONFIRM_GANTI_NAMA_BULK';
                        const selectedSsidId = userState.bulk_ssids[choiceIndex];
                        return reply(`Baik. Nama untuk *SSID ${selectedSsidId}* akan diubah menjadi *"${userState.nama_wifi_baru}"*.\n\nSudah benar? Balas *'ya'* untuk melanjutkan.`);
                    } else { // Jika nama belum ada, tanya dulu
                        userState.step = 'ASK_NEW_NAME_FOR_SINGLE_BULK';
                        return reply("Oke. Sekarang, silakan ketik nama WiFi baru yang Anda inginkan untuk SSID tersebut.\n\n📝 *Ketentuan nama WiFi:*\n• Maksimal 32 karakter\n• Boleh menggunakan huruf, angka, spasi, titik, dan tanda hubung\n• Contoh: WiFiRumah, Keluarga-Bahagia\n\n💡 Ketik *batal* jika ingin membatalkan proses ini.");
                    }
                }
                case 'ASK_NEW_NAME_FOR_SINGLE_BULK':
                case 'ASK_NEW_NAME_FOR_BULK': {
                    const newName = chats.trim();
                    if (newName.length === 0) return reply(`Nama WiFi tidak boleh kosong ya, Kak. Silakan ketik nama yang baru atau ketik *batal*.`);
                    if (newName.length > 32) return reply(`Wah, nama WiFi-nya terlalu panjang (maksimal 32 karakter). Coba yang lebih pendek ya, atau ketik *batal*.`);
                    if (/[^\w\s\-.]/.test(newName)) return reply(`⚠️ Nama WiFi mengandung karakter yang tidak diperbolehkan. Gunakan hanya huruf, angka, spasi, titik, dan tanda hubung.`);

                    userState.nama_wifi_baru = newName;
                    userState.step = 'CONFIRM_GANTI_NAMA_BULK';

                    if (userState.selected_ssid_indices && userState.selected_ssid_indices.length === 1) {
                        const selectedSsidId = userState.bulk_ssids[userState.selected_ssid_indices[0]];
                        return reply(`Siap. Saya konfirmasi ya, nama untuk *SSID ${selectedSsidId}* akan diubah menjadi *"${newName}"*. Sudah benar?\n\nBalas *'ya'* untuk melanjutkan.`);
                }
            }
            case 'ASK_NEW_NAME_FOR_SINGLE_BULK':
            case 'ASK_NEW_NAME_FOR_BULK': {
                const newName = chats.trim();
                if (newName.length === 0) return reply(`Nama WiFi tidak boleh kosong ya, Kak. Silakan ketik nama yang baru atau ketik *batal*.`);
                if (newName.length > 32) return reply(`Wah, nama WiFi-nya terlalu panjang (maksimal 32 karakter). Coba yang lebih pendek ya, atau ketik *batal*.`);
                if (/[^\w\s\-.]/.test(newName)) return reply(`⚠️ Nama WiFi mengandung karakter yang tidak diperbolehkan. Gunakan hanya huruf, angka, spasi, titik, dan tanda hubung.`);

                userState.nama_wifi_baru = newName;
                userState.step = 'CONFIRM_GANTI_NAMA_BULK';

                if (userState.selected_ssid_indices && userState.selected_ssid_indices.length === 1) {
                    const selectedSsidId = userState.bulk_ssids[userState.selected_ssid_indices[0]];
                    return reply(`Siap. Saya konfirmasi ya, nama untuk *SSID ${selectedSsidId}* akan diubah menjadi *"${newName}"*. Sudah benar?\n\nBalas *'ya'* untuk melanjutkan.`);
                } else {
                    userState.selected_ssid_indices = userState.bulk_ssids.map((_, index) => index); // Pilih semua jika dari ASK_NEW_NAME_FOR_BULK
                    return reply(`Siap. Saya konfirmasi ya, nama untuk *semua SSID* akan diubah menjadi *"${newName}"*. Sudah benar?\n\nBalas *'ya'* untuk melanjutkan.`);
                }
            }
            case 'ASK_NEW_NAME_FOR_BULK_AUTO': {
                const newName = chats.trim();
                
                if (newName.length === 0) return reply(`Nama WiFi tidak boleh kosong ya, Kak. Silakan ketik nama yang baru atau ketik *batal*.`);
                if (newName.length > 32) return reply(`Wah, nama WiFi-nya terlalu panjang (maksimal 32 karakter). Coba yang lebih pendek ya, atau ketik *batal*.`);
                if (/[^\w\s\-.]/.test(newName)) return reply(`⚠️ Nama WiFi mengandung karakter yang tidak diperbolehkan. Gunakan hanya huruf, angka, spasi, titik, dan tanda hubung.`);

                const { targetUser, bulk_ssids, ssid_info } = userState;

                // Tampilkan daftar SSID yang akan diubah
                if (ssid_info) {
                    reply(`📋 *Daftar SSID yang akan diubah:*\n${ssid_info}\n\n⏳ Sedang mengubah semua nama WiFi menjadi *"${newName}"*...`);
                } else {
                    reply(`⏳ Sedang mengubah semua nama WiFi menjadi *"${newName}"*...`);
                }

                // Langsung eksekusi tanpa konfirmasi untuk nama WiFi
                const parameterValues = bulk_ssids.map(ssidId => {
                    return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.SSID`, newName, "xsd:string"];
                });

                axios.post(`${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`, {
                    name: 'setParameterValues',
                    parameterValues: parameterValues
                })
                .then(async response => {
                    // Log WiFi change
                    try {
                        const { logWifiChange } = require('../lib/wifi-logger');
                        
                        const nameChangeDetails = bulk_ssids.map(ssidId => 
                            `SSID ${ssidId} name changed to "${newName}"`
                        ).join('; ');
                        
                        const logData = {
                            userId: targetUser.id,
                            deviceId: targetUser.device_id,
                            changeType: 'ssid_name',
                            changes: {
                                oldSsidName: 'Multiple SSIDs',
                                newSsidName: nameChangeDetails
                            },
                            changedBy: 'customer',
                            changeSource: 'wa_bot',
                            customerName: targetUser.name,
                            customerPhone: sender.replace('@s.whatsapp.net', ''),
                            reason: 'Perubahan nama WiFi melalui WhatsApp Bot (Mode Kustom Nonaktif)',
                            notes: `Mengubah nama untuk ${bulk_ssids.length} SSID secara otomatis`,
                            ipAddress: 'WhatsApp',
                            userAgent: 'WhatsApp Bot'
                        };

                        await logWifiChange(logData);
                        console.log(`[WA_WIFI_LOG] WiFi name changed (auto): ${bulk_ssids.length} SSID(s) for user ${targetUser.id}`);
                    } catch (logError) {
                        console.error(`[WA_WIFI_LOG_ERROR] ${logError.message}`);
                    }
                    
                    reply(`✨ Berhasil! Nama WiFi untuk *semua SSID* Anda sudah diubah menjadi *"${newName}"*.\n\nSilakan cari nama WiFi baru tersebut di perangkat Anda dan sambungkan kembali menggunakan kata sandi yang sama ya. Jika ada kendala, jangan ragu hubungi saya lagi! 😊`);
                })
                .catch(error => {
                    console.error("[GANTI_NAMA_BULK_AUTO_ERROR]", error.response ? error.response.data : error.message);
                    reply(`⚠️ Aduh, maaf Kak. Sepertinya ada kendala teknis saat saya mencoba mengubah nama WiFi Anda. Mohon pastikan modem dalam keadaan menyala dan coba lagi beberapa saat, ya.`);
                });

                    delete temp[sender];
                    return;
                }
                case 'CONFIRM_GANTI_NAMA_BULK': {
                    if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
                        const { targetUser, nama_wifi_baru, bulk_ssids, selected_ssid_indices } = userState;

                        const parameterValues = selected_ssid_indices.map(index => {
                            const ssidId = bulk_ssids[index];
                            return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.SSID`, nama_wifi_baru, "xsd:string"];
                        });

                        reply(`Oke, ditunggu sebentar ya. Saya sedang proses perubahan nama WiFi untuk *${targetUser.name}*... ⏳`);

                        axios.post(`${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`, {
                            name: 'setParameterValues',
                            parameterValues: parameterValues
                        })
                        .then(async response => {
                            // Log WiFi change
                            try {
                                const { logWifiChange } = require('../lib/wifi-logger');
                                const { getSSIDInfo } = require('../lib/wifi');
                                
                                // Get current SSID info to log actual old names
                                let ssidChangeDetails = [];
                                try {
                                    const { ssid } = await getSSIDInfo(targetUser.device_id);
                                    
                                    selected_ssid_indices.forEach(index => {
                                        const ssidId = bulk_ssids[index];
                                        const matchedSSID = ssid.find(s => String(s.id) === String(ssidId));
                                        const oldName = matchedSSID?.name || 'Unknown';
                                        ssidChangeDetails.push(`SSID ${ssidId}: "${oldName}" → "${nama_wifi_baru}"`);
                                    });
                                } catch (ssidError) {
                                    console.warn(`[WA_WIFI_LOG] SSID info unavailable: ${ssidError.message}`);
                                    // Fallback to generic info
                                    selected_ssid_indices.forEach(index => {
                                        const ssidId = bulk_ssids[index];
                                        ssidChangeDetails.push(`SSID ${ssidId}: "Unknown" → "${nama_wifi_baru}"`);
                                    });
                                }
                                
                                const logData = {
                                    userId: targetUser.id,
                                    deviceId: targetUser.device_id,
                                    changeType: 'ssid_name',
                                    changes: {
                                        oldSsidName: selected_ssid_indices.length === 1 ? 'Single SSID' : 'Multiple SSIDs',
                                        newSsidName: ssidChangeDetails.join('; ')
                                    },
                                    changedBy: 'customer',
                                    changeSource: 'wa_bot',
                                    customerName: targetUser.name,
                                    customerPhone: sender.replace('@s.whatsapp.net', ''),
                                    reason: 'Perubahan nama WiFi melalui WhatsApp Bot',
                                    notes: `Mengubah ${selected_ssid_indices.length} SSID dari total ${bulk_ssids.length} SSID`,
                                    ipAddress: 'WhatsApp',
                                    userAgent: 'WhatsApp Bot'
                                };

                                await logWifiChange(logData);
                                console.log(`[WA_WIFI_LOG] WiFi name changed: ${ssidChangeDetails.length} SSID(s) for user ${targetUser.id}`);
                            } catch (logError) {
                                console.error(`[WA_WIFI_LOG_ERROR] ${logError.message}`);
                            }
                            
                            reply(`✨ Berhasil! Nama WiFi Anda sudah saya ubah menjadi *"${nama_wifi_baru}"*.\n\nSilakan cari nama WiFi baru tersebut di perangkat Anda dan sambungkan kembali menggunakan kata sandi yang sama ya. Jika ada kendala, jangan ragu hubungi saya lagi! 😊`);
                        })
                        .catch(error => {
                            console.error("[GANTINAMA_BULK_ERROR]", error.response ? error.response.data : error.message);
                            reply(`⚠️ Aduh, maaf Kak. Sepertinya ada kendala teknis saat saya mencoba mengubah nama WiFi Anda. Mohon pastikan modem dalam keadaan menyala dan coba lagi beberapa saat, ya. Jika masih gagal, silakan hubungi Admin.`);
                        });
                        delete temp[sender];
                    } else {
                        reply("Mohon balas *'ya'* untuk melanjutkan atau ketik *'batal'* untuk membatalkan.");
                    }
                    return;
                }
                // --- AKHIR LANGKAH BARU: GANTI NAMA WIFI (BULK) ---
case 'SELECT_CHANGE_PASSWORD_MODE':
case 'SELECT_CHANGE_PASSWORD_MODE_FIRST': {
    const choice = userReply.trim();
    const userData = temp[sender];

    if (choice === '1') {
        // Pilihan 1: Ubah satu SSID saja
        if (userData.step === 'SELECT_CHANGE_PASSWORD_MODE') {
            // Jika password sudah ada, langsung pilih SSID
            temp[sender] = {
                step: 'SELECT_SSID_PASSWORD',
                targetUser: userData.targetUser,
                sandi_wifi_baru: userData.sandi_wifi_baru,
                bulk_ssids: userData.bulk_ssids
            };

            const ssidOptions = userData.bulk_ssids.map((id, index) =>
                `${index + 1}. SSID ID: ${id}${userData.ssid_info ? ' - ' + userData.ssid_info.split('\n')[index].split(': ')[1] : ''}`
            ).join('\n');

            reply(`Pilih nomor SSID yang ingin diubah kata sandinya:\n\n${ssidOptions}\n\nBalas dengan angka pilihan Anda.`);
        } else {
            // Jika password belum ada, tanya SSID dulu
            temp[sender] = {
                step: 'SELECT_SSID_PASSWORD_FIRST',
                targetUser: userData.targetUser,
                bulk_ssids: userData.bulk_ssids,
                ssid_info: userData.ssid_info
            };

            const ssidOptions = userData.bulk_ssids.map((id, index) =>
                `${index + 1}. SSID ID: ${id}${userData.ssid_info ? ' - ' + userData.ssid_info.split('\n')[index].split(': ')[1] : ''}`
            ).join('\n');

            reply(`Pilih nomor SSID yang ingin diubah kata sandinya:\n\n${ssidOptions}\n\nBalas dengan angka pilihan Anda.`);
        }
    } else if (choice === '2') {
        // Pilihan 2: Ubah semua SSID sekaligus
        if (userData.step === 'SELECT_CHANGE_PASSWORD_MODE') {
            // Jika password sudah ada, langsung konfirmasi
            temp[sender] = {
                step: 'CONFIRM_GANTI_SANDI_BULK',
                targetUser: userData.targetUser,
                sandi_wifi_baru: userData.sandi_wifi_baru,
                bulk_ssids: userData.bulk_ssids
            };

            reply(`Anda yakin ingin mengubah kata sandi SEMUA SSID menjadi: \`${userData.sandi_wifi_baru}\` ?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
        } else {
            // Jika password belum ada, tanya password dulu
            temp[sender] = {
                step: 'ASK_NEW_PASSWORD_BULK',
                targetUser: userData.targetUser,
                bulk_ssids: userData.bulk_ssids
            };

            reply("Silakan ketik kata sandi WiFi baru yang Anda inginkan untuk SEMUA SSID.\n\n🔐 *Ketentuan kata sandi WiFi:*\n• Minimal 8 karakter\n• Boleh menggunakan huruf, angka, dan simbol\n• Contoh: Password123, MyWiFi2024!\n\n💡 Ketik *batal* jika ingin membatalkan proses ini.");
        }
    } else {
        reply("Pilihan tidak valid. Silakan pilih 1 untuk mengubah satu SSID atau 2 untuk mengubah semua SSID sekaligus.");
    }
    return;
}

case 'SELECT_SSID_PASSWORD':
case 'SELECT_SSID_PASSWORD_FIRST': {
    const choice = parseInt(userReply.trim());
    const userData = temp[sender];

    if (isNaN(choice) || choice < 1 || choice > userData.bulk_ssids.length) {
        return reply(`Pilihan tidak valid. Silakan pilih nomor antara 1 dan ${userData.bulk_ssids.length}.`);
    }

    const selectedSsidId = userData.bulk_ssids[choice - 1];

    if (userData.step === 'SELECT_SSID_PASSWORD') {
        // Jika password sudah ada, langsung konfirmasi
        temp[sender] = {
            step: 'CONFIRM_GANTI_SANDI',
            targetUser: userData.targetUser,
            sandi_wifi_baru: userData.sandi_wifi_baru,
            ssid_id: selectedSsidId
        };

        reply(`Anda yakin ingin mengubah kata sandi WiFi SSID ${selectedSsidId} menjadi: \`${userData.sandi_wifi_baru}\` ?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
    } else {
        // Jika password belum ada, tanya password dulu
        temp[sender] = {
            step: 'ASK_NEW_PASSWORD',
            targetUser: userData.targetUser,
            ssid_id: selectedSsidId
        };

        reply(`Silakan ketik kata sandi WiFi baru yang Anda inginkan untuk SSID ${selectedSsidId}.\n\n🔐 *Ketentuan kata sandi WiFi:*\n• Minimal 8 karakter\n• Boleh menggunakan huruf, angka, dan simbol\n• Contoh: Password123, MyWiFi2024!\n\n💡 Ketik *batal* jika ingin membatalkan proses ini.`);
    }
    return;
}

case 'ASK_NEW_PASSWORD': {
    const newPassword = chats.trim();
    const userData = temp[sender];

    // Validasi password WiFi
    if (newPassword.length < 8) {
        return reply(`⚠️ Kata sandi terlalu pendek, minimal harus 8 karakter.`);
    }

    temp[sender] = {
        step: 'CONFIRM_GANTI_SANDI',
        targetUser: userData.targetUser,
        sandi_wifi_baru: newPassword,
        ssid_id: userData.ssid_id,
        current_ssid: userData.current_ssid
    };

    const ssidInfo = userData.current_ssid ? `SSID: *"${userData.current_ssid}"*\n\n` : '';
    reply(`${ssidInfo}Anda yakin ingin mengubah kata sandi WiFi${userData.ssid_id ? ` SSID ${userData.ssid_id}` : ''} menjadi: \`${newPassword}\` ?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
    return;
}

case 'ASK_NEW_PASSWORD_BULK': {
    const newPassword = chats.trim();
    const userData = temp[sender];

    // Validasi password WiFi
    if (newPassword.length < 8) {
        return reply(`⚠️ Kata sandi terlalu pendek, minimal harus 8 karakter.`);
    }

    temp[sender] = {
        step: 'CONFIRM_GANTI_SANDI_BULK',
        targetUser: userData.targetUser,
        sandi_wifi_baru: newPassword,
        bulk_ssids: userData.bulk_ssids
    };

    reply(`Anda yakin ingin mengubah kata sandi SEMUA SSID menjadi: \`${newPassword}\` ?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
    return;
}

case 'ASK_NEW_PASSWORD_BULK_AUTO': {
    const newPassword = chats.trim();
    const userData = temp[sender];

    // Validasi password WiFi
    if (newPassword.length < 8) {
        return reply(`⚠️ Kata sandi terlalu pendek, minimal harus 8 karakter.`);
    }

    const { targetUser, bulk_ssids, ssid_info } = userData;

    // Tampilkan daftar SSID yang akan diubah
    if (ssid_info) {
        reply(`📋 *Daftar SSID yang akan diubah:*\n${ssid_info}\n\n⏳ Sedang mengubah kata sandi untuk *semua SSID*...`);
    } else {
        reply(`⏳ Sedang mengubah kata sandi untuk *semua SSID*...`);
    }

    // Langsung eksekusi tanpa konfirmasi
    const parameterValues = bulk_ssids.map(ssidId => {
        return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.PreSharedKey.1.PreSharedKey`, newPassword, "xsd:string"];
    });

    axios.post(`${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`, {
        name: 'setParameterValues',
        parameterValues: parameterValues
    })
    .then(async response => {
        // Log WiFi password change for bulk
        try {
            const { logWifiChange } = require('../lib/wifi-logger');
            
            const passwordChangeDetails = bulk_ssids.map(ssidId => 
                `SSID ${ssidId} password: "${newPassword}"`
            ).join('; ');
            
            const logData = {
                userId: targetUser.id,
                deviceId: targetUser.device_id,
                changeType: 'password',
                changes: {
                    oldPassword: 'ada',
                    newPassword: passwordChangeDetails
                },
                changedBy: 'customer',
                changeSource: 'wa_bot',
                customerName: targetUser.name,
                customerPhone: sender.replace('@s.whatsapp.net', ''),
                reason: 'Perubahan password WiFi melalui WhatsApp Bot (Mode Kustom Nonaktif)',
                notes: `Mengubah password untuk ${bulk_ssids.length} SSID secara otomatis tanpa konfirmasi: ${bulk_ssids.join(', ')}`,
                ipAddress: 'WhatsApp',
                userAgent: 'WhatsApp Bot'
            };

            await logWifiChange(logData);
            console.log(`[WA_WIFI_LOG] Bulk password changed (auto): ${bulk_ssids.length} SSID(s)`);
        } catch (logError) {
            console.error(`[WA_WIFI_LOG_ERROR] ${logError.message}`);
        }
        
        reply(`✨ Berhasil! Kata sandi untuk *semua SSID* Anda sudah diubah menjadi *"${newPassword}"*.\n\nSilakan sambungkan kembali perangkat Anda dengan kata sandi yang baru.`);
    })
    .catch(error => {
        console.error("[GANTI_SANDI_BULK_AUTO_ERROR]", error.response ? error.response.data : error.message);
        reply(`⚠️ Aduh, maaf. Sepertinya ada kendala teknis saat saya mencoba mengubah kata sandi WiFi Anda. Mohon pastikan modem dalam keadaan menyala dan coba lagi beberapa saat, ya.`);
    });

    delete temp[sender];
    return;
}

case 'CONFIRM_GANTI_SANDI': {
    const response = userReply.toLowerCase().trim();
    const userData = temp[sender];

    if (response === 'ya' || response === 'yes' || response === 'y') {
        reply(`⏳ Sedang mengubah kata sandi untuk SSID ${userData.ssid_id}, mohon tunggu...`);

        axios.post(`${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(userData.targetUser.device_id)}/tasks?connection_request`, {
            name: 'setParameterValues',
            parameterValues: [
                [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${userData.ssid_id}.PreSharedKey.1.PreSharedKey`, userData.sandi_wifi_baru, "xsd:string"]
            ]
        })
        .then(async response => {
            // Log WiFi password change
            try {
                const { logWifiChange } = require('../lib/wifi-logger');
                
                const logData = {
                    userId: userData.targetUser.id,
                    deviceId: userData.targetUser.device_id,
                    changeType: 'password',
                    changes: {
                        oldPassword: 'ada',
                        newPassword: `SSID ${userData.ssid_id} password: "${userData.sandi_wifi_baru}"`
                    },
                    changedBy: 'customer',
                    changeSource: 'wa_bot',
                    customerName: userData.targetUser.name,
                    customerPhone: sender.replace('@s.whatsapp.net', ''),
                    reason: 'Perubahan password WiFi melalui WhatsApp Bot',
                    notes: `Mengubah password untuk SSID ${userData.ssid_id}`,
                    ipAddress: 'WhatsApp',
                    userAgent: 'WhatsApp Bot'
                };

                await logWifiChange(logData);
                console.log(`[WA_WIFI_LOG] Password changed for SSID ${userData.ssid_id}`);
            } catch (logError) {
                console.error(`[WA_WIFI_LOG_ERROR] ${logError.message}`);
            }
            
            reply(`✅ Berhasil! Kata sandi untuk SSID ${userData.ssid_id} sudah diubah menjadi *"${userData.sandi_wifi_baru}"*.\n\nSilakan sambungkan kembali perangkat Anda dengan kata sandi yang baru.`);
        })
        .catch(error => {
            console.error("[GANTI_SANDI_ERROR]", error.response ? error.response.data : error.message);
            reply(`⚠️ Aduh, maaf. Sepertinya ada kendala teknis saat saya mencoba mengubah kata sandi WiFi Anda. Mohon pastikan modem dalam keadaan menyala dan coba lagi beberapa saat, ya.`);
        });

        delete temp[sender];
    } else if (response === 'tidak' || response === 'no' || response === 'n' || response === 'batal' || response === 'cancel') {
        reply(`❌ Perubahan kata sandi WiFi dibatalkan.`);
        delete temp[sender];
    } else {
        reply(`Mohon balas dengan *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
    }
    return;
}

case 'CONFIRM_GANTI_SANDI_BULK': {
    const response = userReply.toLowerCase().trim();
    const userData = temp[sender];

    if (response === 'ya' || response === 'yes' || response === 'y') {
        reply(`⏳ Oke, sedang mengubah kata sandi untuk *semua SSID*, mohon tunggu...`);

        const parameterValues = userData.bulk_ssids.map(ssidId => {
            return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.PreSharedKey.1.PreSharedKey`, userData.sandi_wifi_baru, "xsd:string"];
        });

        axios.post(`${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(userData.targetUser.device_id)}/tasks?connection_request`, {
            name: 'setParameterValues',
            parameterValues: parameterValues
        })
        .then(async response => {
            // Log WiFi password change for bulk
            try {
                const { logWifiChange } = require('../lib/wifi-logger');
                
                // Build detailed password change info
                const passwordChangeDetails = userData.bulk_ssids.map(ssidId => 
                    `SSID ${ssidId} password: "${userData.sandi_wifi_baru}"`
                ).join('; ');
                
                const logData = {
                    userId: userData.targetUser.id,
                    deviceId: userData.targetUser.device_id,
                    changeType: 'password',
                    changes: {
                        oldPassword: 'ada',
                        newPassword: passwordChangeDetails
                    },
                    changedBy: 'customer',
                    changeSource: 'wa_bot',
                    customerName: userData.targetUser.name,
                    customerPhone: sender.replace('@s.whatsapp.net', ''),
                    reason: 'Perubahan password WiFi melalui WhatsApp Bot',
                    notes: `Mengubah password untuk ${userData.bulk_ssids.length} SSID: ${userData.bulk_ssids.join(', ')}`,
                    ipAddress: 'WhatsApp',
                    userAgent: 'WhatsApp Bot'
                };

                await logWifiChange(logData);
                console.log(`[WA_WIFI_LOG] Bulk password changed: ${userData.bulk_ssids.length} SSID(s)`);
            } catch (logError) {
                console.error(`[WA_WIFI_LOG_ERROR] ${logError.message}`);
            }
            
            reply(`✅ Berhasil! Kata sandi untuk *semua SSID* Anda sudah diubah menjadi *"${userData.sandi_wifi_baru}"*.\n\nSilakan sambungkan kembali perangkat Anda dengan kata sandi yang baru.`);
        })
        .catch(error => {
            console.error("[GANTI_SANDI_BULK_ERROR]", error.response ? error.response.data : error.message);
            reply(`⚠️ Aduh, maaf. Sepertinya ada kendala teknis saat saya mencoba mengubah kata sandi WiFi Anda. Mohon pastikan modem dalam keadaan menyala dan coba lagi beberapa saat, ya.`);
        });

        delete temp[sender];
    } else if (response === 'tidak' || response === 'no' || response === 'n' || response === 'batal' || response === 'cancel') {
        reply(`❌ Perubahan kata sandi WiFi dibatalkan.`);
        delete temp[sender];
    } else {
        reply(`Mohon balas dengan *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
    }
    return;
}
                // --- Langkah-langkah untuk BATALKAN TIKET ---
                case 'CONFIRM_CANCEL_TICKET': {
                    if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
                        const { ticketIdToCancel } = userState;
                        const reportIndex = global.reports.findIndex(r => r.ticketId === ticketIdToCancel);
                        if (reportIndex === -1) {
                            delete temp[sender];
                            return reply("Maaf, tiket tersebut sepertinya sudah tidak ada. Mungkin sudah diproses atau dibatalkan sebelumnya.");
                        }

                        const report = global.reports[reportIndex];
                        report.status = 'dibatalkan pelanggan';
                        report.cancellationReason = 'Dibatalkan oleh pelanggan via WhatsApp';
                        report.cancellationTimestamp = new Date().toISOString();
                        report.cancelledBy = { id: sender, name: pushname, type: 'pelanggan' };

                        saveReportsToFile(global.reports);

                        reply(`✅ *Tiket Berhasil Dibatalkan!*\n\nTiket laporan Anda dengan ID *${ticketIdToCancel}* telah berhasil Anda batalkan.`);

                        // Hapus state setelah selesai
                        delete temp[sender];

                    } else {
                        reply("Mohon balas *'ya'* untuk melanjutkan pembatalan, atau *'batal'* untuk membatalkan aksi ini.");
                    }
                    return;
                }

                // --- Langkah-langkah untuk LAPOR GANGGUAN ---
                case 'LAPOR_GANGGUAN_AWAITING_DESCRIPTION': {
                    const laporanText = chats.trim();
                    
                    if (!laporanText || laporanText === "") {
                        return reply("📝 *FORMULIR LAPORAN GANGGUAN INTERNET*\n\n🔹 *Langkah 1 dari 6: Deskripsi Masalah*\n\nHalo Kak! 👋\nSaya akan membantu Anda melaporkan gangguan internet.\n\nMohon jelaskan *detail masalah* yang sedang Anda alami saat ini.\n\n📌 *Contoh Keluhan yang Baik:*\n• \"Internet mati total dari jam 8 pagi\"\n• \"WiFi sangat lambat terutama malam hari\"\n• \"Tidak bisa browsing tapi WhatsApp masih jalan\"\n• \"Koneksi putus-nyambung setiap 5-10 menit\"\n• \"Tidak bisa connect WiFi padahal password benar\"\n\n💬 *Silakan ketik keluhan Anda dengan detail:*");
                    }
                    
                    // Analisis awal keluhan untuk kategorisasi
                    const keluhanLower = laporanText.toLowerCase();
                    let kategoriMasalah = 'Gangguan Umum';
                    let prioritas = 'Normal';
                    
                    if (keluhanLower.includes('mati total') || keluhanLower.includes('tidak ada internet')) {
                        kategoriMasalah = 'Internet Mati Total';
                        prioritas = 'Tinggi';
                    } else if (keluhanLower.includes('lemot') || keluhanLower.includes('lambat')) {
                        kategoriMasalah = 'Koneksi Lambat';
                        prioritas = 'Sedang';
                    } else if (keluhanLower.includes('putus-putus') || keluhanLower.includes('intermittent')) {
                        kategoriMasalah = 'Koneksi Tidak Stabil';
                        prioritas = 'Sedang';
                    } else if (keluhanLower.includes('wifi') && (keluhanLower.includes('tidak bisa') || keluhanLower.includes('gak bisa'))) {
                        kategoriMasalah = 'Masalah WiFi';
                        prioritas = 'Sedang';
                    }
                    
                    // Simpan keluhan dan kategori
                    userState.step = 'LAPOR_GANGGUAN_ASK_REBOOT';
                    userState.keluhan = laporanText;
                    userState.kategoriMasalah = kategoriMasalah;
                    userState.prioritas = prioritas;
                    
                    return reply(`✅ *KELUHAN BERHASIL DICATAT*\n\n📊 *Analisis Awal:*\n├ 📁 Kategori: ${kategoriMasalah}\n├ ⚡ Prioritas: ${prioritas}\n└ 📝 Keluhan: "${laporanText}"\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🔧 *Langkah 2 dari 6: Troubleshooting Awal*\n\nSebelum teknisi kami datang, mari kita coba solusi sederhana yang sering berhasil mengatasi masalah.\n\n🔌 *PERTANYAAN: Restart Modem*\n\nApakah Anda sudah mencoba *merestart/reboot modem*?\n\n📖 *Cara restart modem yang benar:*\n1️⃣ Cabut kabel power dari modem\n2️⃣ Tunggu minimal 10 detik\n3️⃣ Pasang kembali kabel power\n4️⃣ Tunggu 2-3 menit hingga lampu stabil\n\n✏️ *Silakan jawab:*\n• Ketik *'ya'* → jika sudah mencoba restart\n• Ketik *'tidak'* → jika belum mencoba`);
                }
                
                case 'LAPOR_GANGGUAN_ASK_REBOOT': {
                    const response = userReply.toLowerCase().trim();
                    
                    if (response === 'ya' || response === 'yes' || response === 'y' || response === 'sudah') {
                        userState.sudah_reboot = 'Ya';
                        userState.step = 'LAPOR_GANGGUAN_ASK_LOS';
                        return reply(`✅ *Terima kasih sudah mencoba restart modem*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🔍 *Langkah 3 dari 6: Pemeriksaan Lampu LOS*\n\nSekarang saya perlu memeriksa kondisi lampu indikator pada modem Anda untuk mendeteksi masalah jaringan fiber optik.\n\n🔴 *PERTANYAAN PENTING:*\n\nApakah ada lampu *LOS* berwarna *MERAH* yang menyala di modem Anda?\n\n📍 *Cara Menemukan Lampu LOS:*\n• Lihat panel depan modem\n• Cari tulisan \"LOS\" di dekat lampu\n• Biasanya terletak di antara lampu Power dan PON\n• Jika menyala, warnanya MERAH terang\n\n⚠️ *Mengapa ini penting?*\nLampu LOS merah menandakan gangguan serius pada kabel fiber optik yang memerlukan penanganan teknisi segera.\n\n✏️ *Silakan jawab:*\n• Ketik *'ya'* → jika ada lampu LOS merah menyala\n• Ketik *'tidak'* → jika tidak ada lampu merah`);
                        
                    } else if (response === 'tidak' || response === 'no' || response === 'n' || response === 'belum') {
                        userState.sudah_reboot = 'Tidak';
                        userState.step = 'LAPOR_GANGGUAN_ASK_LOS';
                        return reply(`📌 *Catatan: Belum mencoba restart*\n\n💡 *REKOMENDASI PENTING:*\nRestart modem dapat mengatasi 60% masalah koneksi. Sangat disarankan untuk mencoba restart sebelum teknisi datang.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🔍 *Langkah 3 dari 6: Pemeriksaan Lampu LOS*\n\nMari kita lanjutkan pemeriksaan untuk diagnosis yang akurat.\n\n🔴 *PERTANYAAN PENTING:*\n\nApakah ada lampu *LOS* berwarna *MERAH* yang menyala di modem?\n\n📍 *Panduan Mencari Lampu LOS:*\n• Perhatikan panel depan modem\n• Cari tulisan \"LOS\" (Loss of Signal)\n• Posisi: biasanya di antara Power dan PON\n• Jika ada masalah, lampunya MERAH terang\n\n⚠️ *Info Penting:*\nLOS merah = gangguan kabel fiber (urgent)\nLOS mati = koneksi fiber normal\n\n✏️ *Silakan jawab:*\n• Ketik *'ya'* → ada lampu LOS merah\n• Ketik *'tidak'* → tidak ada lampu merah`);
                        
                    } else {
                        return reply(`⚠️ *Maaf, saya tidak mengerti jawaban Anda*\n\nMohon jawab dengan salah satu pilihan berikut:\n\n✅ Ketik *'ya'* → jika sudah mencoba restart modem\n❌ Ketik *'tidak'* → jika belum mencoba restart\n\n📝 *Pengingat:*\nRestart modem = cabut kabel power selama 10 detik, kemudian pasang kembali dan tunggu 2-3 menit.\n\nSilakan ketik jawaban Anda:`);
                    }
                }
                
                case 'LAPOR_GANGGUAN_ASK_LOS': {
                    const response = userReply.toLowerCase().trim();
                    
                    if (response === 'ya' || response === 'yes' || response === 'y' || response === 'ada') {
                        userState.lampu_los = 'Ya (Merah menyala)';
                        userState.urgency = 'URGENT';
                        userState.step = 'LAPOR_GANGGUAN_ASK_LAMPU_DETAIL';
                        return reply(`🚨 *ALERT: GANGGUAN FIBER OPTIK TERDETEKSI!*\n\n🔴 *Status: URGENT - Prioritas Tinggi*\n\n⚠️ *Lampu LOS Merah Menandakan:*\n├ 🔸 Kabel fiber optik putus/rusak\n├ 🔸 Gangguan pada jaringan utama (ODP/ODC)\n├ 🔸 Konektor fiber kotor atau lepas\n└ 🔸 Memerlukan penanganan teknisi SEGERA\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📊 *Langkah 4 dari 6: Detail Lampu Indikator*\n\nUntuk memastikan diagnosis yang tepat, mohon sebutkan *SEMUA LAMPU* yang menyala/mati di modem Anda.\n\n📝 *Panduan Menjawab:*\nPerhatikan dan sebutkan kondisi setiap lampu:\n• *Power* → Hijau/Merah/Mati?\n• *PON* → Hijau/Merah/Mati?\n• *LOS* → Merah (sudah terkonfirmasi)\n• *LAN 1-4* → Hijau/Mati?\n• *WiFi/WLAN* → Hijau/Kedip/Mati?\n\n✅ *Contoh Jawaban yang Baik:*\n• \"Power hijau, PON mati, LOS merah, LAN1 hijau, WiFi hijau\"\n• \"Hanya Power hijau dan LOS merah yang nyala\"\n• \"Semua lampu nyala kecuali PON\"\n\n✏️ *Ketik kondisi lampu modem Anda:*`);
                        
                    } else if (response === 'tidak' || response === 'no' || response === 'n' || response === 'gak ada') {
                        userState.lampu_los = 'Tidak';
                        userState.urgency = 'Normal';
                        userState.step = 'LAPOR_GANGGUAN_ASK_LAMPU_DETAIL';
                        return reply(`✅ *Kabar Baik: Tidak Ada LOS Merah*\n└ Koneksi fiber optik kemungkinan normal\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📊 *Langkah 4 dari 6: Pemeriksaan Detail Lampu*\n\nUntuk mendiagnosis masalah dengan tepat, saya perlu mengetahui kondisi *SEMUA LAMPU INDIKATOR* pada modem Anda.\n\n🔦 *Lampu-Lampu yang Perlu Dicek:*\n\n1️⃣ *POWER* (Daya/Listrik)\n   └ Normal: Hijau menyala\n\n2️⃣ *PON* (Passive Optical Network)\n   └ Normal: Hijau menyala\n\n3️⃣ *LAN 1-4* (Kabel Internet)\n   └ Normal: Hijau jika ada kabel terpasang\n\n4️⃣ *WiFi/WLAN* (Sinyal Nirkabel)\n   └ Normal: Hijau menyala/berkedip\n\n5️⃣ *INTERNET* (Status Koneksi)\n   └ Normal: Hijau menyala\n\n📝 *Cara Menjawab yang Benar:*\nSebutkan nama lampu dan warnanya\n\n✅ *Contoh Jawaban:*\n• \"Semua lampu hijau menyala normal\"\n• \"Power hijau, PON hijau, WiFi mati, LAN1 hijau\"\n• \"Power dan PON hijau, yang lain mati\"\n\n✏️ *Silakan ketik kondisi lampu modem:*`);
                        
                    } else {
                        return reply(`⚠️ *Maaf, saya tidak mengerti jawaban Anda*\n\nPertanyaan: Apakah ada lampu *LOS MERAH* menyala?\n\n✅ Ketik *'ya'* → jika ada lampu LOS merah\n❌ Ketik *'tidak'* → jika tidak ada\n\n💡 *Tips Mencari Lampu LOS:*\n• Cek panel depan modem\n• Cari tulisan \"LOS\" di dekat lampu\n• Jika bermasalah, lampunya MERAH terang\n• Jika normal, lampunya MATI\n\nSilakan ketik jawaban Anda:`);
                    }
                }
                
                case 'LAPOR_GANGGUAN_ASK_LAMPU_DETAIL': {
                    const lampuResponse = chats.trim();
                    
                    if (!lampuResponse || lampuResponse === "") {
                        return reply("⚠️ *Jawaban tidak boleh kosong*\n\nMohon sebutkan kondisi lampu-lampu pada modem Anda.\n\n📝 *Contoh jawaban:*\n• \"Power hijau, PON hijau, WiFi hijau\"\n• \"Semua lampu hijau menyala\"\n• \"Hanya Power yang nyala\"\n\nSilakan ketik kondisi lampu modem:");
                    }
                    
                    // Simpan detail lampu
                    userState.detail_lampu = lampuResponse;
                    
                    // Analisis sederhana untuk memberikan indikasi masalah
                    let indikasi_masalah = '';
                    const lampuLower = lampuResponse.toLowerCase();
                    
                    if (userState.lampu_los === 'Ya (Merah menyala)') {
                        indikasi_masalah = '🔴 Kemungkinan: Kabel fiber putus/gangguan jaringan fiber';
                    } else if (lampuLower.includes('power') && !lampuLower.includes('pon')) {
                        indikasi_masalah = '🟡 Kemungkinan: Kabel fiber tidak terpasang dengan baik';
                    } else if (lampuLower.includes('semua') && lampuLower.includes('hijau')) {
                        indikasi_masalah = '🟢 Lampu normal, kemungkinan masalah di pengaturan/router';
                    } else if (!lampuLower.includes('wifi') && !lampuLower.includes('wlan')) {
                        indikasi_masalah = '🟡 Kemungkinan: WiFi mati/tidak aktif';
                    }
                    
                    userState.indikasi_masalah = indikasi_masalah;
                    userState.step = 'LAPOR_GANGGUAN_ASK_DETAIL_TAMBAHAN';
                    
                    let pesanIndikasi = indikasi_masalah ? `🔍 *HASIL DIAGNOSIS AWAL:*\n${indikasi_masalah}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` : '';
                    
                    return reply(`${pesanIndikasi}📝 *Langkah 5 dari 6: Informasi Tambahan*\n\nApakah ada *informasi tambahan* yang perlu kami ketahui?\n\n💡 *Contoh Info yang Membantu:*\n• Kapan masalah mulai terjadi\n• Apakah ada hujan/petir sebelumnya\n• Apakah ada perbaikan jalan/galian kabel\n• Apakah tagihan sudah dibayar\n• Perangkat apa yang bermasalah (HP/Laptop/TV)\n• Sudah coba dengan perangkat lain?\n\n✏️ *Silakan ketik informasi tambahan*\natau ketik *'tidak ada'* jika tidak ada info lain:`);
                }
                
                case 'LAPOR_GANGGUAN_ASK_DETAIL_TAMBAHAN': {
                    const detailTambahan = chats.trim();
                    const { keluhan, sudah_reboot, lampu_los, detail_lampu, indikasi_masalah, targetUser } = userState;
                    
                    // Set detail tambahan
                    let infoTambahan = detailTambahan;
                    if (detailTambahan.toLowerCase() === 'tidak ada' || detailTambahan.toLowerCase() === 'tidak' || detailTambahan.toLowerCase() === 'gak ada') {
                        infoTambahan = 'Tidak ada';
                    }
                    
                    userState.info_tambahan = infoTambahan;
                    userState.step = 'LAPOR_GANGGUAN_CONFIRM';
                    
                    // Tampilkan ringkasan untuk konfirmasi
                    const urgencyBadge = userState.urgency === 'URGENT' ? '🔴 *[URGENT]* ' : '🟡 *[NORMAL]* ';
                    const kategoriIcon = userState.kategoriMasalah === 'Internet Mati Total' ? '⛔' : 
                                        userState.kategoriMasalah === 'Koneksi Lambat' ? '🐌' :
                                        userState.kategoriMasalah === 'Koneksi Tidak Stabil' ? '📶' :
                                        userState.kategoriMasalah === 'Masalah WiFi' ? '📡' : '⚠️';
                    
                    const ringkasan = `📋 *KONFIRMASI LAPORAN GANGGUAN*\n\n${urgencyBadge}${kategoriIcon} ${userState.kategoriMasalah}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📝 *DETAIL LAPORAN:*\n\n1️⃣ *Keluhan Utama:*\n└ ${keluhan}\n\n2️⃣ *Troubleshooting:*\n└ Sudah restart modem: ${sudah_reboot}\n\n3️⃣ *Status Lampu Indikator:*\n├ LOS: ${lampu_los}\n└ Detail: ${detail_lampu}\n\n4️⃣ *Informasi Tambahan:*\n└ ${infoTambahan}\n\n${indikasi_masalah ? `5️⃣ *Diagnosis Sistem:*\n└ ${indikasi_masalah}\n\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━\n\n✅ *Langkah 6 dari 6: Konfirmasi*\n\nApakah semua informasi di atas sudah *BENAR*?\n\n✏️ *Pilihan:*\n• Ketik *'ya'* → Kirim laporan ke teknisi\n• Ketik *'tidak'* → Batalkan dan mulai ulang\n\nSilakan konfirmasi:`;
                    
                    return reply(ringkasan);
                }
                
                case 'LAPOR_GANGGUAN_CONFIRM': {
                    const response = userReply.toLowerCase().trim();
                    const { keluhan, sudah_reboot, lampu_los, detail_lampu, indikasi_masalah, info_tambahan, targetUser } = userState;
                    
                    if (response === 'ya' || response === 'yes' || response === 'y' || response === 'kirim') {
                        // Buat tiket dengan format lengkap
                        const ticketId = generateTicketId();
                        const fullDescription = `Keluhan: ${keluhan}\nSudah coba reboot: ${sudah_reboot}\nLampu LOS: ${lampu_los}\nDetail Lampu: ${detail_lampu}\nInfo tambahan: ${info_tambahan}`;
                        
                        const newReport = {
                            ticketId: ticketId,
                            pelangganId: sender,
                            pelangganPushName: pushname,
                            pelangganDataSystem: targetUser,
                            laporanText: fullDescription,
                            status: 'baru',
                            createdAt: new Date().toISOString(),
                            processedByTeknisiId: null,
                            processedByTeknisiName: null,
                            processingStartedAt: null,
                            resolvedAt: null,
                            resolvedByTeknisiId: null,
                            resolvedByTeknisiName: null,
                            notes: `${lampu_los === 'Ya (Merah menyala)' ? 'LOS MERAH - ' : ''}${indikasi_masalah || 'Perlu diagnosa lebih lanjut'}`
                        };
                        
                        global.reports.push(newReport);
                        saveReportsToFile(global.reports);
                        
                        delete temp[sender];
                        
                        // Tips berdasarkan indikasi masalah
                        let additionalMessage = '';
                        let estimasiWaktu = '';
                        
                        // Import getResponseTimeMessage
                        const { getResponseTimeMessage } = require('./handlers/../lib/working-hours-helper');
                        
                        if (lampu_los === 'Ya (Merah menyala)') {
                            const highPriorityTime = getResponseTimeMessage('HIGH');
                            additionalMessage = `\n🔴 *STATUS URGENT - PRIORITAS TINGGI*\n├ Gangguan fiber optik terdeteksi\n├ Teknisi akan diprioritaskan untuk kasus Anda\n└ Estimasi penanganan: ${highPriorityTime}\n`;
                            estimasiWaktu = highPriorityTime;
                        } else if (sudah_reboot === 'Tidak') {
                            const mediumPriorityTime = getResponseTimeMessage('MEDIUM');
                            additionalMessage = '\n💡 *SARAN SAMBIL MENUNGGU:*\nCoba restart modem dengan cara:\n1️⃣ Cabut kabel power dari modem\n2️⃣ Tunggu 10 detik\n3️⃣ Pasang kembali kabel\n4️⃣ Tunggu 2-3 menit hingga lampu stabil\n';
                            estimasiWaktu = mediumPriorityTime;
                        } else {
                            estimasiWaktu = getResponseTimeMessage('MEDIUM');
                        }
                        
                        const currentTime = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                        
                        return reply(`✅ *LAPORAN BERHASIL TERKIRIM!*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🎫 *DETAIL TIKET ANDA:*\n\n📌 *ID Tiket:* \`${ticketId}\`\n📅 *Waktu Laporan:* ${currentTime}\n⏱️ *Estimasi Penanganan:* ${estimasiWaktu}\n📊 *Status Saat Ini:* 🟡 Menunggu Antrian\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${indikasi_masalah ? `🔍 *DIAGNOSIS SISTEM:*\n${indikasi_masalah}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` : ''}${additionalMessage}\n📱 *NOTIFIKASI OTOMATIS:*\nAnda akan menerima pesan WhatsApp saat:\n✅ Teknisi mulai menangani tiket\n✅ Teknisi dalam perjalanan\n✅ Masalah sudah selesai\n\n💬 *CEK STATUS TIKET:*\nKetik: \`cektiket ${ticketId}\`\n\n📞 *BUTUH BANTUAN URGENT?*\nHubungi hotline: 0812-3456-7890\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\nTerima kasih telah melaporkan gangguan.\nKami akan segera menangani masalah Anda! 🙏`);
                        
                    } else if (response === 'tidak' || response === 'no' || response === 'n' || response === 'ulang') {
                        // Reset ke awal
                        delete temp[sender];
                        return reply(`❌ *LAPORAN DIBATALKAN*\n\nLaporan gangguan Anda telah dibatalkan.\n\n🔄 Jika ingin membuat laporan baru, silakan ketik:\n→ *'lapor'* untuk memulai dari awal\n\nTerima kasih! 🙏`);
                        
                    } else {
                        return reply(`⚠️ *Maaf, saya tidak mengerti jawaban Anda*\n\nMohon konfirmasi dengan:\n\n✅ Ketik *'ya'* → untuk mengirim laporan\n❌ Ketik *'tidak'* → untuk membatalkan\n\nSilakan pilih:`);
                    }
                }

                // --- Langkah-langkah untuk REBOOT MODEM ---
                case 'CONFIRM_REBOOT': {
                    if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
                        const { targetUser } = userState;
                        reply(`Baik, permintaan reboot untuk modem *${targetUser.name}* sedang diproses. Mohon tunggu sekitar 5-10 menit hingga modem menyala kembali dan semua lampu indikator stabil. Terima kasih atas kesabarannya! 🙏`);
                        rebootRouter(targetUser.device_id)
                            .catch(err => {
                                console.error("[REBOOT_ERROR]", err);
                                // Informasikan user jika ada error, meskipun jarang terjadi pada proses reboot
                                reply(`Maaf, sepertinya ada sedikit kendala saat saya mencoba mengirim perintah reboot. Namun, perintah sudah terkirim. Mohon tetap periksa modem Anda.`);
                            });
                        delete temp[sender];
                    } else {
                        reply("Mohon balas *'ya'* untuk melanjutkan atau ketik *'batal'* untuk membatalkan.");
                    }
                    return;
                }

                // --- Langkah-langkah untuk GANTI POWER ---
                case 'ASK_POWER_LEVEL': {
                    const newPowerLevel = chats.trim();
                    if (!['100', '80', '60', '40', '20'].includes(newPowerLevel)) {
                        return reply(`⚠️ Maaf, Kak. Level daya tidak valid. Mohon pilih salah satu dari: *100, 80, 60, 40, 20*.\n\nAtau ketik *batal* untuk membatalkan.`);
                    }
                    userState.step = 'CONFIRM_GANTI_POWER';
                    userState.level_daya = newPowerLevel;
                    return reply(`Siap. Saya konfirmasi ya, kekuatan sinyal WiFi akan diubah ke level *${newPowerLevel}%*. Sudah benar?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* jika ada yang salah.`);
                }
                case 'CONFIRM_GANTI_POWER': {
                    if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
                        const { targetUser, level_daya } = userState;
                        reply(`Oke, ditunggu sebentar ya. Saya sedang mengatur kekuatan sinyal WiFi untuk *${targetUser.name}*... ⏳`);

                        axios.post(`${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`, {
                            name: 'setParameterValues',
                            parameterValues: [
                                ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TransmitPower", `${level_daya}`, "xsd:string"]
                            ]
                        })
                        .then(response => {
                            reply(`✅ Berhasil! Kekuatan sinyal WiFi Anda sudah saya atur ke *${level_daya}%*.`);
                        })
                        .catch(error => {
                            console.error("[GANTIPOWER_ERROR]", error);
                            reply(`⚠️ Aduh, maaf Kak. Sepertinya ada kendala teknis saat saya mencoba mengubah kekuatan sinyal WiFi Anda. Mohon coba lagi nanti atau hubungi Admin.`);
                        });
                        delete temp[sender];
                    } else {
                        reply("Mohon balas *'ya'* untuk melanjutkan atau ketik *'batal'* untuk membatalkan.");
                    }
                    return;
                }
            }

            // --- Langkah-langkah untuk UBAH PAKET ---
            switch (userState.step) {
                // --- AWAL LANGKAH BARU: MEMBELI VOUCHER ---
                case 'SELECT_SOD_CHOICE': {
                    const chosenIndex = parseInt(userReply, 10);
                    const selectedOption = userState.options.find(opt => opt.index === chosenIndex);

                    if (!selectedOption) {
                        return reply("Pilihan tidak valid. Mohon balas dengan nomor yang sesuai dari daftar, atau ketik *batal*.");
                    }

                    userState.step = 'CONFIRM_SOD_CHOICE';
                    userState.selectedOption = selectedOption;
                    const durationText = selectedOption.durationKey.replace('_', ' ');

                    return reply(`Anda memilih Speed on Demand:\n*Paket:* ${selectedOption.package.name}\n*Durasi:* ${durationText}\n*Harga:* ${convertRupiah.convert(selectedOption.price)}\n\nApakah Anda yakin ingin melanjutkan? Balas *'ya'* untuk konfirmasi.`);
                }
                case 'CONFIRM_SOD_CHOICE': {
                    if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
                        const { user, selectedOption } = userState;

                        const newRequest = {
                            id: `sod_${Date.now()}_${user.id}`,
                            userId: user.id,
                            userName: user.name,
                            requestedPackageName: selectedOption.package.name,
                            durationKey: selectedOption.durationKey,
                            price: selectedOption.price,
                            status: 'pending',
                            createdAt: new Date().toISOString(),
                            updatedAt: null,
                            approvedBy: null,
                            notes: '',
                            expirationDate: null
                        };

                        global.speed_requests.unshift(newRequest);
                        saveSpeedRequests();

                        // Notify admin
                        if (global.conn && global.config.ownerNumber && Array.isArray(global.config.ownerNumber)) {
                            const durationText = selectedOption.durationKey.replace('_', ' ');
                            const notifMessage = `⚡ *Permintaan Speed on Demand Baru* ⚡\n\nPelanggan telah mengajukan permintaan Speed on Demand.\n\n*Pelanggan:* ${user.name}\n*No. HP:* ${plainSenderNumber}\n*Paket Diminta:* ${selectedOption.package.name}\n*Durasi:* ${durationText}\n*Harga:* ${convertRupiah.convert(selectedOption.price)}\n\nMohon segera ditinjau di panel admin pada menu Speed Requests.`;
                            for (const ownerNum of global.config.ownerNumber) {
                                const ownerJid = ownerNum.endsWith('@s.whatsapp.net') ? ownerNum : `${ownerNum}@s.whatsapp.net`;
                                try {
                                    raf.sendMessage(ownerJid, { text: notifMessage });
                                } catch (e) {
                                    console.error(`[SOD_NOTIF_ERROR] Gagal mengirim notifikasi ke owner ${ownerJid}:`, e.message);
                                }
                            }
                        }
                        delete temp[sender];
                        return reply("✅ Permintaan Speed on Demand Anda telah berhasil dikirim. Silakan tunggu konfirmasi dari Admin. Terima kasih!");
                    } else {
                        reply("Mohon balas *'ya'* untuk melanjutkan atau ketik *'batal'* untuk membatalkan.");
                    }
                    return;
                }
                case 'ASK_PACKAGE_CHOICE': {
                    const chosenIndex = parseInt(userReply, 10);
                    // Adjust index to be 0-based
                    const selectedPackage = userState.options[chosenIndex - 1];

                    if (!selectedPackage) {
                        return reply("Maaf, nomor yang Anda masukkan tidak valid. Mohon balas dengan salah satu nomor dari daftar, atau ketik *batal*.");
                    }

                    userState.step = 'CONFIRM_PACKAGE_CHOICE';
                    userState.selectedPackage = selectedPackage;
                    const newPriceFormatted = convertRupiah.convert(selectedPackage.price);

                    return reply(`Anda telah memilih *${selectedPackage.name}* dengan harga *${newPriceFormatted}* per bulan.\n\nApakah Anda yakin ingin melanjutkan? Balas *'ya'* untuk konfirmasi.`);
                }
                case 'CONFIRM_PACKAGE_CHOICE': {
                    if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
                        const { user, selectedPackage } = userState;

                        const newRequest = {
                            id: `pkgchange_${Date.now()}_${user.id}`,
                            userId: user.id,
                            userName: user.name,
                            currentPackageName: user.subscription,
                            requestedPackageName: selectedPackage.name,
                            status: 'pending',
                            createdAt: new Date().toISOString(),
                            updatedAt: null,
                            approvedBy: null
                        };

                        global.packageChangeRequests.unshift(newRequest);
                        savePackageChangeRequests();

                        // Notify admin
                        if (global.conn && global.config.ownerNumber && Array.isArray(global.config.ownerNumber)) {
                            const notifMessage = `🔄 *Permintaan Perubahan Paket Baru* 🔄\n\nPelanggan telah mengajukan permintaan perubahan paket.\n\n*Pelanggan:* ${user.name}\n*No. HP:* ${plainSenderNumber}\n*Paket Saat Ini:* ${user.subscription}\n*Paket Diminta:* ${selectedPackage.name}\n\nMohon segera ditinjau di panel admin.`;
                            for (const ownerNum of global.config.ownerNumber) {
                                const ownerJid = ownerNum.endsWith('@s.whatsapp.net') ? ownerNum : `${ownerNum}@s.whatsapp.net`;
                                try {
                                    raf.sendMessage(ownerJid, { text: notifMessage });
                                } catch (e) {
                                    console.error(`[PACKAGE_CHANGE_NOTIF_ERROR] Gagal mengirim notifikasi ke owner ${ownerJid}:`, e.message);
                                }
                            }
                        }
                        delete temp[sender];
                        return reply("✅ Permintaan Anda untuk perubahan paket telah berhasil dikirim. Silakan tunggu konfirmasi dari Admin. Terima kasih!");
                    } else {
                        reply("Mohon balas *'ya'* untuk melanjutkan atau ketik *'batal'* untuk membatalkan.");
                    }
                    return;
                }
            }
        }

        let intent;
        let entities = {}; // Default entitas kosong
        let matchedKeywordLength = 0; // Menyimpan jumlah kata dari keyword yang cocok

        // --- ALUR BARU DENGAN PRE-FILTER UNTUK MENGHEMAT API GEMINI ---
        // Jangan proses jika pesan kosong atau hanya spasi
        if (!chats || chats.trim() === '') return;

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

        // Specific alias handling for "menu pelanggan"
        if (chats.toLowerCase().replace(/\s+/g, '') === 'menupelanggan') {
            intent = 'MENU_PELANGGAN';
        } else {
            // 1. Cek Intent dari Keyword Handler (Prioritas Utama)
            const keywordResult = getIntentFromKeywords(chats);
            if (keywordResult) {
                intent = keywordResult.intent;
                matchedKeywordLength = keywordResult.matchedKeywordLength;
                console.log(color('[KEYWORD_COMMAND]'), `Phrase: "${chats}" -> Intent: ${intent} (Matched ${matchedKeywordLength} words)`);
            } else {
            // 2. Jika tidak ada, cek perintah statis satu kata (Prioritas Kedua)
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
        }}

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
                if (!isOwner && !isTeknisi) return reply(mess.teknisiOrOwnerOnly);
                reply("⏳ Sedang mengambil statistik PPPoE, mohon tunggu...");

                getPppStats()
                    .then(pppStats => {
                        let replyText = `📊 *Statistik PPPoE Saat Ini (${global.config.nama || "Layanan Kami"}):*\n\n`;
                        replyText += `👤 Total Pengguna PPPoE: *${pppStats.total !== undefined ? pppStats.total : 'N/A'}*\n`;
                        replyText += `🟢 Aktif Saat Ini: *${pppStats.online !== undefined ? pppStats.online : 'N/A'}*\n`;
                        // Menghilangkan kata "(Terdaftar)"
                        replyText += `🔴 Tidak Aktif: *${pppStats.offline !== undefined ? pppStats.offline : 'N/A'}*\n`;

                        // Menambahkan daftar pengguna tidak aktif
                        if (pppStats.inactive_users_list && Array.isArray(pppStats.inactive_users_list) && pppStats.inactive_users_list.length > 0) {
                            replyText += `\n📜 *Daftar Pengguna PPPoE Tidak Aktif:*\n`;
                            // Batasi jumlah yang ditampilkan jika terlalu banyak untuk menghindari pesan panjang
                            const maxInactiveToShow = 20; // Misalnya, tampilkan maksimal 20 user
                            const inactiveToShow = pppStats.inactive_users_list.slice(0, maxInactiveToShow);

                            inactiveToShow.forEach((user, index) => {
                                replyText += `${index + 1}. ${user}\n`;
                            });

                            if (pppStats.inactive_users_list.length > maxInactiveToShow) {
                                replyText += `... dan ${pppStats.inactive_users_list.length - maxInactiveToShow} pengguna lainnya.\n`;
                            }
                        } else if (pppStats.offline > 0) {
                            replyText += `\n📜 *Daftar Pengguna PPPoE Tidak Aktif:* (Detail daftar tidak tersedia saat ini)\n`;
                        } else {
                            replyText += `\n👍 Semua pengguna PPPoE yang terdaftar saat ini aktif atau tidak ada pengguna tidak aktif.\n`;
                        }

                        replyText += `\n----\nℹ️ _Data diambil pada: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}_\nTim ${global.config.namabot || "Bot Kami"}`;
                        reply(replyText);
                    })
                    .catch(err => {
                        console.error("[statusppp_ERROR_COMMAND]", err.message);
                        reply(`🚫 Gagal mengambil statistik PPPoE: ${err.message}. Silakan coba lagi nanti atau hubungi Admin.`);
                    });
            }
            break;
            case 'statushotspot': {
                if (!isOwner && !isTeknisi) return reply(mess.teknisiOrOwnerOnly);
                reply("⏳ Sedang mengambil statistik Hotspot, mohon tunggu...");

                getHotspotStats() // Call the new function from wifi.js
                    .then(hotspotStats => {
                        // Use correct keys from PHP script: hotspotStats.total, hotspotStats.active
                        const replyText = `📊 *Statistik Hotspot Saat Ini (${global.config.nama || "Layanan Kami"}):*\n\n`;
                        replyText += `👥 Total Pengguna Hotspot Terdaftar: *${hotspotStats.total !== undefined ? hotspotStats.total : 'N/A'}*\n`;
                        replyText += `🟢 Aktif Saat Ini: *${hotspotStats.active !== undefined ? hotspotStats.active : 'N/A'}*\n\n----\nℹ️ _Data diambil pada: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}_\nTim ${global.config.namabot || "Bot Kami"}`;
                        reply(replyText);
                    })
                    .catch(err => {
                        console.error("[statushotspot_ERROR_COMMAND]", err.message);
                        reply(`🚫 Gagal mengambil statistik Hotspot: ${err.message}. Silakan coba lagi nanti atau hubungi Admin.`);
                    });
            }
            break;
            // LAPOR_GANGGUAN already handled in combined case above
            case 'CEK_TIKET': { // Sesuaikan dengan intent yang mungkin dari Gemini
                if (!q) {
                    return reply(`⚠️ Mohon sertakan ID Tiket yang ingin Anda periksa.\n\n*Contoh Penggunaan:*\ncektiket ABC123\n\nAnda bisa menemukan ID Tiket pada pesan konfirmasi saat Anda pertama kali membuat laporan.`);
                }

                const ticketIdToCheck = q.trim();
                const report = global.reports.find(r => r.ticketId && r.ticketId.toLowerCase() === ticketIdToCheck.toLowerCase());

                const namaLayanan = global.config.nama || "Layanan Kami";
                const namaBotKami = global.config.namabot || "Bot Kami";

                if (!report) {
                    return reply(`🚫 Maaf Kak ${pushname}, tiket dengan ID "*${ticketIdToCheck}*" tidak ditemukan di sistem kami.\n\nPastikan ID Tiket yang Anda masukkan sudah benar, atau hubungi Admin jika Anda yakin tiket tersebut ada.`);
                }

                if (!isOwner && !isTeknisi && report.pelangganId !== sender) {
                    return reply(`🚫 Maaf Kak ${pushname}, Anda hanya dapat memeriksa tiket laporan milik Anda sendiri. Tiket ID "*${ticketIdToCheck}*" tidak terdaftar atas nama Anda.`);
                }

                const namaPelanggan = report.pelangganName || report.pelangganPushName || (report.pelangganDataSystem ? report.pelangganDataSystem.name : "N/A");
                // Support both new field (pelangganSubscription) and old field (pelangganDataSystem.subscription)
                const layananPelanggan = report.pelangganSubscription || 
                                       (report.pelangganDataSystem && report.pelangganDataSystem.subscription) || 
                                       "Tidak terinfo";
                // Menggunakan cuplikanLaporan sesuai dengan yang Anda berikan sebelumnya, tanpa "..." jika tidak ada pemotongan eksplisit di sini
                const cuplikanLaporan = report.laporanText.substring(0, 150) + (report.laporanText.length > 150 ? '...' : ''); // Anda bisa sesuaikan panjang cuplikan

                const optionsDateFormat = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' };
                const tanggalDibuatFormatted = new Date(report.createdAt).toLocaleString('id-ID', optionsDateFormat);

                let statusDetail = "";
                let pesanTambahan = "";

                // Map new status values to user-friendly messages
                if (report.status === 'pending' || report.status === 'baru') {
                    statusDetail = `*Menunggu* (Dalam antrian teknisi).\nEstimasi penanganan akan diinformasikan lebih lanjut.`;
                    pesanTambahan = `Mohon kesabarannya ya Kak, laporan Anda akan segera kami proses. 🙏`;
                } else if (report.status === 'process' || report.status === 'processing' || report.status === 'diproses teknisi') {
                    const teknisiYangProses = report.processedByTeknisiName || report.teknisiName || "Teknisi Kami";
                    const waktuMulaiProses = report.processingStartedAt ? new Date(report.processingStartedAt).toLocaleString('id-ID', optionsDateFormat) : "N/A";
                    statusDetail = `*Sedang Diproses* oleh ${teknisiYangProses}.\n👨‍🔧 *Mulai Ditangani Sejak:* ${waktuMulaiProses}`;
                    pesanTambahan = `Teknisi kami sedang bekerja untuk Anda! Jika ada perkembangan, kami akan informasikan.`;
                } else if (report.status === 'otw' || report.status === 'on_the_way') {
                    const teknisiYangProses = report.processedByTeknisiName || report.teknisiName || "Teknisi Kami";
                    statusDetail = `*Teknisi Dalam Perjalanan* 🚗\n👨‍🔧 *Teknisi:* ${teknisiYangProses}`;
                    pesanTambahan = `Teknisi sedang menuju lokasi Anda. Harap bersiap untuk menerima teknisi.`;
                } else if (report.status === 'on_location') {
                    const teknisiYangProses = report.processedByTeknisiName || report.teknisiName || "Teknisi Kami";
                    statusDetail = `*Teknisi Tiba di Lokasi* 📍\n👨‍🔧 *Teknisi:* ${teknisiYangProses}`;
                    pesanTambahan = `Teknisi sudah tiba di lokasi dan sedang melakukan perbaikan.`;
                } else if (report.status === 'in_progress') {
                    const teknisiYangProses = report.processedByTeknisiName || report.teknisiName || "Teknisi Kami";
                    statusDetail = `*Perbaikan Sedang Berlangsung* 🔧\n👨‍🔧 *Teknisi:* ${teknisiYangProses}`;
                    pesanTambahan = `Teknisi sedang melakukan perbaikan. Mohon menunggu.`;
                } else if (report.status === 'completed' || report.status === 'selesai') {
                    const teknisiYangSelesaikan = report.resolvedByTeknisiName || report.resolvedBy || "Teknisi Kami";
                    const waktuSelesai = report.resolvedAt || report.completedAt ? new Date(report.resolvedAt || report.completedAt).toLocaleString('id-ID', optionsDateFormat) : "N/A";
                    statusDetail = `*Selesai* ditangani oleh ${teknisiYangSelesaikan}.\n✅ *Diselesaikan Pada:* ${waktuSelesai}`;
                    if (report.resolutionNotes) {
                        statusDetail += `\n📝 *Catatan:* ${report.resolutionNotes}`;
                    }
                    pesanTambahan = `Semoga layanan kami kembali normal dan memuaskan. Jika masih ada kendala, silakan hubungi Admin.`;
                } else if (report.status === 'cancelled' || report.status === 'dibatalkan') {
                    statusDetail = `*Dibatalkan*.`;
                    pesanTambahan = `Laporan ini telah dibatalkan. Jika Anda merasa ini adalah kesalahan, silakan hubungi Admin.`;
                } else {
                    statusDetail = `*${report.status}*.`;
                    pesanTambahan = `Untuk informasi lebih lanjut mengenai status ini, silakan hubungi Admin.`;
                }

                // Pesan hasil cek tiket dalam satu baris kode menggunakan template literal
                const messageReply = `📊 *STATUS TIKET LAPORAN ANDA - ${namaLayanan}*\n\nHalo Kak ${pushname}! Berikut adalah informasi terkini untuk tiket laporan Anda:\n\n-----------------------------------\n🧾 *Nomor Tiket:* *${report.ticketId}*\n👤 *Nama Pelapor:* ${namaPelanggan}\n📦 *Layanan/Paket Terlapor:* ${layananPelanggan}\n📅 *Dilaporkan Pada:* ${tanggalDibuatFormatted}\n🗒️ *Ringkasan Keluhan Anda:*\n"${cuplikanLaporan}"\n-----------------------------------\n🚦 *Status Saat Ini:* ${statusDetail}\n-----------------------------------\n\n${pesanTambahan}\n\nTerima kasih telah menggunakan layanan kami.\nTim ${namaBotKami}`;

                reply(messageReply);
            }
            break;
            case 'BATALKAN_TIKET': {
                // Fitur ini hanya untuk pelanggan, bukan admin/teknisi via WA
                if (isOwner || isTeknisi) {
                    return reply(`Fitur ini khusus untuk pelanggan. Admin dapat membatalkan tiket melalui antarmuka web.`);
                }

                // Cari laporan aktif milik pelanggan yang mengirim pesan
                const activeReport = global.reports.find(
                    r => r.pelangganId === sender && (r.status === 'baru' || r.status === 'diproses teknisi')
                );

                if (!activeReport) {
                    return reply(`Halo Kak ${pushname}, saat ini Anda tidak memiliki laporan aktif yang bisa dibatalkan.`);
                }

                // Jika laporan sudah diproses, tidak bisa dibatalkan
                if (activeReport.status === 'diproses teknisi') {
                    return reply(`⚠️ Maaf, laporan Anda dengan ID *${activeReport.ticketId}* sudah dalam penanganan teknisi dan tidak dapat dibatalkan melalui bot. Silakan hubungi Admin jika ada keperluan mendesak.`);
                }

                // Jika laporan masih 'baru', minta konfirmasi
                if (activeReport.status === 'baru') {
                    const reportDetails = activeReport.laporanText.substring(0, 75) + (activeReport.laporanText.length > 75 ? '...' : '');

                    // Simpan state untuk langkah konfirmasi
                    temp[sender] = {
                        step: 'CONFIRM_CANCEL_TICKET',
                        ticketIdToCancel: activeReport.ticketId
                    };

                    return reply(`Kami menemukan laporan aktif Anda dengan ID *${activeReport.ticketId}* mengenai:\n_"${reportDetails}"_\n\nAnda yakin ingin membatalkan laporan ini?\n\nBalas *'ya'* untuk konfirmasi, atau *'batal'* untuk tidak jadi.`);
                }
                break;
            }
            break;
            
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
                if (!q) throw `contoh penggunaan: topup 10000`;
                let number = parseInt(q);
                if (command == "topup" && (isNaN(number) || number < 1000 || number > 1_000_000)) throw `Jumlah topup invalid!\nMinimum topup Rp. 1000 & Maksimal topup Rp. 1.000.000`;
                const reff = Math.floor(Math.random() * 1677721631342).toString(16);
                let profvc = checkprofvc(q);
                if (command == "buynow") {
                    if (!checkhargavoucher(q)) throw `Harga Voucher Tersebut Tidak Terdaftar. Silahkan Periksa Lagi.\n\nTerima Kasih`;
                    number = checkhargavc(profvc);
                }
                const res = await pay({
                    amount: number,
                    reffId: reff,
                    comment: command == 'topup' ? `Topup dana saldo sebesar Rp. ${number}` : command == 'buynow' ? `pembelian voucher ${profvc} sebesar Rp. ${number}` : '',
                    name: pushname,
                    phone: sender.split("@")[0],
                    email: sender,
                })
                let text = `*GO TO PAY*\n\n- Sub Total: Rp. ${res.subTotal}\n- Biaya admin: Rp. ${res.fee}\n- Total dibayarkan: Rp. ${res.total}\nSilahkan simpan QR ini, pergi ke aplikasi ewallet/bank virtual anda, lalu scan QR ini dengan aplikasi ewallet/bank virtual anda lalu bayarkan!`;
                await addPayment(reff, res.id, sender, command, number, 'QRIS', `Topup ${number} to ${sender}`);
                let qrr = await qr.imageSync(res.qrString, { type: "png", ec_level: 'H' });
                await raf.sendMessage(from, { image: qrr, caption: text }, { quoted: msg });
            }
            break;
            case 'BELI_VOUCHER': {
                // Ambil harga dari entities (hasil AI) atau dari q (perintah manual)
                const hargaVoucher = entities.harga_voucher || q;

                if (hargaVoucher) {
                    // Jika harga ada, langsung proses
                    await processVoucherPurchase(sender, pushname, hargaVoucher, reply);
                } else {
                    // Jika tidak ada harga, mulai percakapan
                    temp[sender] = {
                        step: 'ASK_VOUCHER_CHOICE'
                    };

                    let voucherListString = "";
                    if (global.voucher && global.voucher.length > 0) {
                        global.voucher.forEach(v => {
                            const hargaFormatted = parseInt(v.hargavc) ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(parseInt(v.hargavc)) : `Rp ${v.hargavc}`;
                            voucherListString += `  • 💸 ${v.namavc || 'Voucher'} (${v.durasivc || 'N/A'}) - *${hargaFormatted}*\n`;
                        });
                    } else {
                        voucherListString = "Maaf, saat ini tidak ada voucher yang tersedia.\n";
                    }

                    const message = `Tentu, Kak ${pushname}! Mau beli voucher yang mana?\n\n*Pilihan Voucher Tersedia:*\n${voucherListString}\nSilakan balas dengan *harga* voucher yang ingin dibeli (contoh: \`1000\`).\n\nAtau ketik *batal* untuk membatalkan.`;
                    reply(message);
                }
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
                const namaLayanan = global.config.nama || "Layanan Kami";
                const namaBot = global.config.namabot || "Asisten Virtual";
                reply(format('bantuan', { nama_layanan: namaLayanan, pushname, nama_bot: namaBot }));
            }
            break;
            case 'SAPAAN_UMUM':
            case 'hallo':
            case 'halo':
            case 'hi':
            case 'hai':
            case 'min':
            case 'kak':
            case 'mas':
            {
                const namaLayanan = global.config.nama || "Layanan Kami";
                const namaBot = global.config.namabot || "Asisten Virtual Anda";
                const greetingKeys = ['sapaan_umum_1', 'sapaan_umum_2', 'sapaan_umum_3', 'sapaan_umum_4'];
                const randomGreetingKey = greetingKeys[Math.floor(Math.random() * greetingKeys.length)];
                reply(format(randomGreetingKey, { pushname, nama_layanan: namaLayanan, nama_bot: namaBot }));
            }
            break;
            case 'MENU_PELANGGAN' :
            case 'menupelanggan': {
                const user = users.find(v => v.phone_number.split("|").find(vv => vv == (/^([^:@]+)[:@]?.*$/.exec(sender)[1])));
                if(!user) throw mess.userNotRegister;
                reply(customermenu(global.config.nama, global.config.namabot))
            }
            break;
            case 'MENU_UTAMA':
            case 'help':
            case 'menu wifi' :
            case 'menuwifi': {
                reply(wifimenu(global.config.nama, global.config.namabot))
            }
            break;
            case 'MENU_TEKNISI': {
                reply(techinisionmenu(global.config.nama, global.config.namabot))
            }
            break;
            // case 'menuvoucher': {
            //     reply(menuvoucher(global.config.nama, global.config.namabot))
            // }
            break;
            case 'MENU_OWNER': {
                if (!isOwner) throw mess.owner;
                reply(menuowner(global.config.nama, global.config.namabot))
            }
            break;
            case 'TANYA_CARA_PASANG': {
                reply(menupasang(global.config.nama, global.config.namabot))
            }
            break;
            case 'TANYA_PAKET_BULANAN': {
                reply(menupaket(global.config.nama, global.config.namabot))
            }
            break;
            case 'TUTORIAL_TOPUP': {
                reply(menubelivoucher(global.config.nama, global.config.namabot))
            }
            break;
            case 'listprofstatik': {
                if(!isOwner) throw mess.owner;
                let txtx = `「 *LIST-PROFIL-STATIK* 」\n\nJumlah : ${statik.length}\n\n`
                for (let i of statik){
                    txtx += `• *PROFIL:* ${i.prof}\n`
                    txtx += `• *LIMIT AT:* ${i.limitat}\n`
                    txtx += `• *MAX LIMIT:* ${i.maxlimit}\n\n`
                }
                reply(`${txtx}`)
            }
            break;
            case 'listprofvoucher': {
                if(!isOwner) throw mess.owner;
                let txtx = `「 *LIST-PROFIL-VOUCHER* 」\n\nJumlah : ${voucher.length}\n\n`
                for (let i of voucher){
                    txtx += `• *NAMA PROFIL:* ${i.prof}\n`
                    txtx += `• *NAMA VOUCHER:* ${i.namavc}\n`
                    txtx += `• *DURASI VOUCHER:* ${i.durasivc}\n`
                    txtx += `• *HARGA VOUCHER:* ${i.hargavc}\n\n`
                }
                reply(`${txtx}`)
            }
            break;
            case 'CEK_SALDO': {
                const currentNumericSaldo = checkATMuser(sender);
                const formattedSaldo = convertRupiah.convert(currentNumericSaldo);
                const namaLayanan = global.config.nama || "Layanan Kami";
                const namaBot = global.config.namabot || "Bot Kami";

                let pesanKondisional = (currentNumericSaldo < 2000)
                    ? format('cek_saldo_menipis', { formattedSaldo })
                    : format('cek_saldo_cukup', { formattedSaldo });

                reply(format('cek_saldo', {
                    nama_layanan: namaLayanan,
                    pushname,
                    formattedSaldo,
                    pesanKondisional,
                    nama_bot: namaBot
                }));
            }
            break;
            case 'TANYA_HARGA_VOUCHER': {
                const namaLayanan = global.config.nama || "Layanan Kami";
                const adminWaLink = `https://wa.me/${global.config.ownerNumber && global.config.ownerNumber[0] ? global.config.ownerNumber[0].replace(/\D/g, '') : '6285233047094'}`;

                let voucherListString = "";
                if (global.voucher && global.voucher.length > 0) {
                    global.voucher.forEach(v => {
                        const hargaFormatted = parseInt(v.hargavc) ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(parseInt(v.hargavc)) : `Rp ${v.hargavc}`;
                        voucherListString += `  • 💸 ${v.namavc || 'Voucher'} ${v.durasivc ? `(${v.durasivc})` : ''} - *${hargaFormatted}*\n`;
                    });
                } else {
                    voucherListString = "Oops! Saat ini belum ada daftar voucher yang tersedia. Silakan cek kembali nanti atau hubungi Admin.\n";
                }

                const contohHargaVoucher = global.voucher && global.voucher.length > 0 ? global.voucher[0].hargavc : '1000';
                const contohHargaRupiah = global.voucher && global.voucher.length > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(parseInt(global.voucher[0].hargavc)) : 'Rp 1.000';
                
                reply(format('tanya_harga_voucher', {
                    nama_layanan: namaLayanan,
                    pushname,
                    voucherListString: voucherListString.trim(),
                    contoh_harga_voucher: contohHargaVoucher,
                    contoh_harga_rupiah: contohHargaRupiah,
                    adminWaLink
                }));
            }
            break;
            case 'ACCESS_MANAGEMENT': {
                const user = global.users.find(v => v.phone_number.split("|").find(vv => vv == (/^([^:@]+)[:@]?.*$/.exec(sender)[1])));
                if(!user) throw "❌ Maaf! Nomor Anda tidak terdaftar sebagai pelanggan.\n\nSilakan hubungi admin untuk informasi lebih lanjut.";
                
                const phoneNumbers = user.phone_number.split("|");
                const primaryPhone = phoneNumbers[0]; // Nomor utama (pertama)
                const accessLimit = global.config.accessLimit || 3;
                
                switch(args[1]){
                    case "list":
                        if(phoneNumbers.length === 1) {
                            reply(`📱 *Daftar Akses Bot*\n\n✅ ${primaryPhone} (Nomor Utama)\n\n_Anda belum memberikan akses ke nomor lain._\n\n💡 Gunakan *akses tambah 628xxx* untuk menambahkan nomor yang dapat mengakses bot ini.\n\n📊 Kuota: ${phoneNumbers.length}/${accessLimit}`);
                        } else {
                            const accessList = phoneNumbers.map((num, idx) => 
                                idx === 0 ? `✅ ${num} (Nomor Utama)` : `📱 ${num}`
                            ).join("\n");
                            reply(`📱 *Daftar Akses Bot*\n\n${accessList}\n\n📊 Kuota: ${phoneNumbers.length}/${accessLimit}\n\n💡 Gunakan *akses hapus 628xxx* untuk menghapus akses.`);
                        }
                        break;
                        
                    case "add":
                    case "tambah":
                        if(args.length < 3) {
                            throw "❌ Format tidak lengkap!\n\n📝 *Cara Penggunaan:*\nakses tambah 628xxx\n\n*Contoh:*\nakses tambah 628123456789\n\n💡 Nomor harus diawali dengan 62 (kode negara Indonesia).";
                        }
                        
                        const phoneToAdd = args[2].trim();
                        
                        // Validasi format nomor
                        if(!phoneToAdd.startsWith('62')) {
                            throw '❌ Format nomor salah!\n\nNomor harus diawali dengan *62* (kode negara Indonesia).\n\n*Contoh yang benar:*\n628123456789\n\n*Contoh yang salah:*\n08123456789 ❌\n+628123456789 ❌';
                        }
                        
                        if(!/^62\d{9,13}$/.test(phoneToAdd)) {
                            throw '❌ Format nomor tidak valid!\n\nPastikan:\n• Diawali dengan 62\n• Hanya berisi angka\n• Panjang 11-15 digit\n\n*Contoh yang benar:*\n628123456789';
                        }
                        
                        // Validasi batas maksimal
                        if(phoneNumbers.length >= accessLimit) {
                            throw `❌ Batas maksimal tercapai!\n\nAnda sudah memberikan akses ke ${phoneNumbers.length} nomor (maksimal ${accessLimit}).\n\n💡 Hapus nomor lain terlebih dahulu dengan:\nakses hapus 628xxx`;
                        }
                        
                        // Validasi duplikasi
                        if(phoneNumbers.find(v => v === phoneToAdd)) {
                            throw `❌ Nomor sudah terdaftar!\n\nNomor *${phoneToAdd}* sudah memiliki akses ke bot ini.\n\n📱 Gunakan *akses list* untuk melihat semua nomor yang memiliki akses.`;
                        }

                        const newPhoneNumbersAdd = `${user.phone_number}|${phoneToAdd}`;
                        db.run(`UPDATE users SET phone_number = ? WHERE id = ?`, [newPhoneNumbersAdd, user.id], function(err) {
                            if (err) {
                                console.error("[DB_UPDATE_ERROR] Gagal update nomor telepon:", err.message);
                                reply("❌ Maaf, terjadi kesalahan sistem saat memperbarui data.\n\nSilakan coba lagi dalam beberapa saat atau hubungi admin jika masalah berlanjut.");
                                return;
                            }
                            console.log(`[DB_UPDATE_SUCCESS] Nomor telepon untuk user ID ${user.id} berhasil diperbarui.`);
                            // Update in-memory global.users as well
                            const userIndex = global.users.findIndex(u => u.id === user.id);
                            if (userIndex !== -1) {
                                global.users[userIndex].phone_number = newPhoneNumbersAdd;
                            }
                            const newCount = phoneNumbers.length + 1;
                            reply(`✅ *Akses Berhasil Diberikan!*\n\nNomor *${phoneToAdd}* sekarang dapat mengakses bot ini.\n\n📊 Total akses: ${newCount}/${accessLimit}\n\n💡 Gunakan *akses list* untuk melihat semua nomor yang memiliki akses.`);
                        });
                        break;
                        
                    case "del":
                    case "delete":
                    case "hapus":
                        if (args.length < 3) {
                            throw "❌ Format tidak lengkap!\n\n📝 *Cara Penggunaan:*\nakses hapus 628xxx\n\n*Contoh:*\nakses hapus 628123456789\n\n💡 Gunakan *akses list* untuk melihat nomor yang dapat dihapus.";
                        }
                        
                        const phoneToDelete = args[2].trim();
                        
                        // Validasi nomor ada dalam daftar
                        if(!phoneNumbers.find(v => v === phoneToDelete)) {
                            throw `❌ Nomor tidak ditemukan!\n\nNomor *${phoneToDelete}* tidak ada dalam daftar akses.\n\n📱 Gunakan *akses list* untuk melihat nomor yang terdaftar.`;
                        }
                        
                        // Validasi tidak menghapus nomor utama
                        if(phoneToDelete === primaryPhone) {
                            throw `❌ Tidak dapat menghapus nomor utama!\n\nNomor *${primaryPhone}* adalah nomor utama akun Anda dan tidak dapat dihapus.\n\n💡 Anda hanya dapat menghapus nomor tambahan yang telah ditambahkan.`;
                        }

                        const newPhoneNumbersDel = phoneNumbers.filter(vv => vv !== phoneToDelete).join("|");
                        db.run(`UPDATE users SET phone_number = ? WHERE id = ?`, [newPhoneNumbersDel, user.id], function(err) {
                            if (err) {
                                console.error("[DB_UPDATE_ERROR] Gagal menghapus nomor telepon:", err.message);
                                reply("❌ Maaf, terjadi kesalahan sistem saat memperbarui data.\n\nSilakan coba lagi dalam beberapa saat atau hubungi admin jika masalah berlanjut.");
                                return;
                            }
                            console.log(`[DB_UPDATE_SUCCESS] Nomor telepon untuk user ID ${user.id} berhasil dihapus.`);
                            // Update in-memory global.users as well
                            const userIndex = global.users.findIndex(u => u.id === user.id);
                            if (userIndex !== -1) {
                                global.users[userIndex].phone_number = newPhoneNumbersDel;
                            }
                            const newCount = phoneNumbers.length - 1;
                            reply(`✅ *Akses Berhasil Dihapus!*\n\nNomor *${phoneToDelete}* tidak dapat lagi mengakses bot ini.\n\n📊 Total akses: ${newCount}/${accessLimit}\n\n💡 Gunakan *akses list* untuk melihat nomor yang tersisa.`);
                        });
                        break;
                        
                    default:
                        reply(`📱 *Manajemen Akses Bot*\n\nFitur ini memungkinkan Anda memberikan akses bot kepada nomor lain (misal: keluarga atau karyawan).\n\n📝 *Perintah yang tersedia:*\n\n1️⃣ *akses list*\n   Melihat daftar nomor yang memiliki akses\n\n2️⃣ *akses tambah 628xxx*\n   Menambahkan nomor baru\n   Contoh: akses tambah 628123456789\n\n3️⃣ *akses hapus 628xxx*\n   Menghapus akses nomor\n   Contoh: akses hapus 628123456789\n\n📊 Batas maksimal: ${accessLimit} nomor\n\n💡 *Tips:*\n• Nomor utama tidak dapat dihapus\n• Format nomor harus diawali 62\n• Gunakan perintah *hp*, *akses*, atau *access*`);
                        break;
                }
            }
            break;
            case 'admin': {
                sendContact(from, `${ownerNumber[0]}`, `Admin ${global.config.nama}`, msg)
            }
            break;
            case 'statusap': {
                if (!isOwner) throw mess.owner;
                statusap()
                    .then(async (body) => {
                        const tod = body.split()
                        const statusap = tod[Math.floor(Math.random() * tod.length)]
                        var splitnya = 'Nama' + statusap.replace('NAMA', '').split('NAMA').join('\nNAMA').split('</br>').join(' ').split(' : ').join(':').split(' ').join('\n')
                        await reply(`STATUS AP :\n\n${splitnya}\n\nBy Bot`)
                    })
                    .catch(async (err) => {
                        console.error(err)
                        await reply('Error!')
                    })
            }
            break
            case 'allsaldo': {
                if (!isOwner) throw mess.owner;
                let txtx = `「 *${global.config.nama}* 」\n\nJumlah Saldo Semua User.\n\n`
                for (let i of atm){
                    txtx += `User  : ${i.id}\nSaldo :  Rp.${i.saldo}\n\n`
                }
                reply(`${txtx}`)
            }
            break
            // Respon Button Wifi
            case 'vc123': {
                let txtx = `List Harga Voucher 「 *${global.config.nama}* 」\n==================================\n\n`
                for (let i of voucher){
                    txtx += `${i.namavc} = Rp. ${i.hargavc}\n`
                }
                reply(`${txtx}\n==================================\nCara Pembelian Voucher Silahkan Ketik : \n*belivoucher [harga]*\ncontoh : _*belivoucher 1500*_\nCara Topup Saldo Silahkan Ketik : _*tutorial*_\n==================================\nNOTE :\nHarga Voucher Bisa Berubah Sewaktu-Waktu.\n_Jika ada pertanyaan, chat admin di bawah_\nWhatsapp : https://wa.me/6285233047094\n==================================\n\nTerima Kasih\n${global.config.namabot}`)
            }
            break
            case 'alluser':
                reply(`ALL USERS\n\n${users.map(user => 'Nama: ' + user.name + '\nNo Telepon: ' + user.phone_number.split("|").join(", ") + '\nPaket Langganan: ' + user.subscription + '\nAlamat: ' + user.address + '\nUsername PPPoE: ' + user.pppoe_username + '\nPassword PPPoE: ' + user.pppoe_password).join('\n\n')}`)
            break
case 'GANTI_NAMA_WIFI': {
    // 1. Validasi Awal (User terdaftar, punya device_id, dll)
    let user;
    let newName;
    let providedId = null;

    // --- Argument parsing logic (DIPERBAIKI: Menggunakan matchedKeywordLength) ---
    // matchedKeywordLength berisi jumlah kata yang cocok dari keyword
    // Contoh: "ganti nama" = 2 kata, "gantinama" = 1 kata
    
    const keywordLength = matchedKeywordLength || 1; // Default 1 jika tidak ada
    
    if ((isOwner || isTeknisi) && args.length > keywordLength + 1 && !isNaN(parseInt(args[keywordLength], 10))) {
        // Admin dengan ID: <keyword> <id> <name>
        // Contoh: "ganti nama 123 WiFiKeren" -> args[2]=123, args[3..]=WiFiKeren
        providedId = args[keywordLength];
        newName = args.slice(keywordLength + 1).join(' ').trim();
    } else {
        // Customer tanpa ID: <keyword> <name>
        // Contoh: "ganti nama WiFiKeren" -> args[2..]=WiFiKeren
        newName = args.length > keywordLength ? args.slice(keywordLength).join(' ').trim() : '';
    }

    if (providedId) {
        user = users.find(v => v.id == providedId);
    } else {
        const plainSenderNumber = sender.split('@')[0];
        user = users.find(v => v.phone_number && v.phone_number.split("|").includes(plainSenderNumber));
    }
    // --- End of argument parsing ---

    if(!user) {
        // Jika owner/teknisi salah input ID atau pelanggan tidak terdaftar
        const pesanErrorUser = (isOwner || isTeknisi)
            ? (providedId ? `Maaf Kak ${pushname}, pelanggan dengan ID "${providedId}" tidak ditemukan.` : `Kak ${pushname}, mohon sebutkan ID Pelanggan. Contoh: gantinama 1 WiFiKeren`)
            : mess.userNotRegister;
        return reply(pesanErrorUser);
    }

    if (user.subscription === 'PAKET-VOUCHER' && !(isOwner || isTeknisi)) {
        return reply(`Maaf Kak ${pushname}, fitur ganti nama WiFi saat ini hanya tersedia untuk pelanggan bulanan.`);
    }

    if (!user.device_id) {
        return reply(`Maaf Kak ${pushname}, data device ID ${(isOwner || isTeknisi) ? `untuk pelanggan "${user.name}"` : 'Anda'} tidak ditemukan. ${!(isOwner || isTeknisi) ? 'Silakan hubungi Admin.' : 'Tidak bisa melanjutkan.'}`);
    }

    // 2. Cek status modem dan dapatkan informasi SSID
    await reply("⏳ Sedang memeriksa informasi WiFi...");

    try {
        const useBulk = global.config.custom_wifi_modification && user.bulk && user.bulk.length > 0;
        const hasMultipleSSIDs = user.bulk && user.bulk.length > 0;
        
        // 3. Penanganan SSID - dengan pilihan untuk bulk atau individual
        if (useBulk) {
            try {
                const { ssid } = await getSSIDInfo(user.device_id);

                // Dapatkan nama-nama SSID saat ini untuk ditampilkan
                const currentSSIDs = user.bulk.map((bulkId, index) => {
                    const matchedSSID = ssid.find(s => String(s.id) === String(bulkId));
                    return `${index + 1}. SSID ${bulkId}: "${matchedSSID?.name || 'Tidak diketahui'}"`;
                }).join('\n');

                // Jika nama sudah diberikan, tanyakan mode perubahan
                if (newName && newName.trim().length > 0) {
                    // Validasi nama WiFi
                    if (newName.length > 32) {
                        return reply(`⚠️ Nama WiFi terlalu panjang (maksimal 32 karakter).`);
                    }

                    if (/[^\w\s\-.]/.test(newName)) {
                        return reply(`⚠️ Nama WiFi mengandung karakter yang tidak diperbolehkan. Gunakan hanya huruf, angka, spasi, titik, dan tanda hubung.`);
                    }

                    temp[sender] = {
                        step: 'SELECT_CHANGE_MODE',
                        targetUser: user,
                        nama_wifi_baru: newName,
                        bulk_ssids: user.bulk,
                        ssid_info: currentSSIDs
                    };

                    reply(`Nama WiFi saat ini:\n${currentSSIDs}\n\nAnda ingin mengubah nama WiFi menjadi: *"${newName}"*\n\nPilih mode perubahan:\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`);
                } else {
                    // Jika nama belum diberikan, tanyakan dulu mode perubahan
                    temp[sender] = {
                        step: 'SELECT_CHANGE_MODE_FIRST',
                        targetUser: user,
                        bulk_ssids: user.bulk,
                        ssid_info: currentSSIDs
                    };

                    reply(`Nama WiFi saat ini:\n${currentSSIDs}\n\nPilih mode perubahan:\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`);
                }
            } catch (error) {
                console.error(`[GANTI_NAMA_WIFI] Error getting current SSID:`, error);

                // Fallback jika gagal mendapatkan nama WiFi saat ini
                if (newName && newName.trim().length > 0) {
                    // Validasi nama WiFi
                    if (newName.length > 32) {
                        return reply(`⚠️ Nama WiFi terlalu panjang (maksimal 32 karakter).`);
                    }

                    if (/[^\w\s\-.]/.test(newName)) {
                        return reply(`⚠️ Nama WiFi mengandung karakter yang tidak diperbolehkan. Gunakan hanya huruf, angka, spasi, titik, dan tanda hubung.`);
                    }

                    temp[sender] = {
                        step: 'SELECT_CHANGE_MODE',
                        targetUser: user,
                        nama_wifi_baru: newName,
                        bulk_ssids: user.bulk
                    };

                    reply(`Anda ingin mengubah nama WiFi menjadi: *"${newName}"*\n\nPilih mode perubahan:\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`);
                } else {
                    // Jika nama belum diberikan, tanyakan dulu mode perubahan
                    temp[sender] = {
                        step: 'SELECT_CHANGE_MODE_FIRST',
                        targetUser: user,
                        bulk_ssids: user.bulk
                    };

                    reply(`Pilih mode perubahan nama WiFi:\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`);
                }
            }
        } else if (hasMultipleSSIDs && !global.config.custom_wifi_modification) {
            // Mode Kustom NONAKTIF: Langsung ubah semua SSID tanpa konfirmasi
            
            // VALIDASI: Nama WiFi tidak boleh kosong
            if (!newName || newName.trim().length === 0) {
                // Jika nama kosong, tanyakan nama baru tanpa menampilkan pilihan SSID
                temp[sender] = {
                    step: 'ASK_NEW_NAME_FOR_BULK_AUTO',
                    targetUser: user,
                    bulk_ssids: user.bulk
                };
                return reply(`Silakan ketik nama WiFi baru yang Anda inginkan.\n\n📝 *Ketentuan nama WiFi:*\n• Maksimal 32 karakter\n• Boleh menggunakan huruf, angka, spasi, titik, dan tanda hubung\n• Contoh: WiFiRumah, Keluarga-Bahagia\n\n⚠️ Nama ini akan diterapkan ke *semua SSID* WiFi Anda.\n\n💡 Ketik *batal* jika ingin membatalkan proses ini.`);
            }
            
            try {
                const { ssid } = await getSSIDInfo(user.device_id);

                // Dapatkan nama-nama SSID saat ini untuk ditampilkan
                const currentSSIDs = user.bulk.map((bulkId, index) => {
                    const matchedSSID = ssid.find(s => String(s.id) === String(bulkId));
                    return `${index + 1}. SSID ${bulkId}: "${matchedSSID?.name || 'Tidak diketahui'}"`;
                }).join('\n');

                // Validasi nama WiFi
                if (newName.length > 32) {
                    return reply(`⚠️ Nama WiFi terlalu panjang (maksimal 32 karakter).`);
                }

                if (/[^\w\s\-.]/.test(newName)) {
                    return reply(`⚠️ Nama WiFi mengandung karakter yang tidak diperbolehkan. Gunakan hanya huruf, angka, spasi, titik, dan tanda hubung.`);
                }

                // Jika nama sudah diberikan dan valid, langsung eksekusi
                if (newName && newName.trim().length > 0) {
                    // Tampilkan daftar SSID yang akan diubah
                    reply(`📋 *Daftar SSID yang akan diubah:*\n${currentSSIDs}\n\n⏳ Sedang mengubah semua nama WiFi menjadi *"${newName}"*...`);

                    // Langsung eksekusi tanpa konfirmasi
                    const parameterValues = user.bulk.map(ssidId => {
                        return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.SSID`, newName, "xsd:string"];
                    });

                    axios.post(`${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(user.device_id)}/tasks?connection_request`, {
                        name: 'setParameterValues',
                        parameterValues: parameterValues
                    })
                    .then(async response => {
                        // Log WiFi change
                        try {
                            const { logWifiChange } = require('../lib/wifi-logger');
                            
                            let ssidChangeDetails = [];
                            user.bulk.forEach((ssidId, index) => {
                                const matchedSSID = ssid.find(s => String(s.id) === String(ssidId));
                                const oldName = matchedSSID?.name || 'Unknown';
                                ssidChangeDetails.push(`SSID ${ssidId}: "${oldName}" → "${newName}"`);
                            });
                            
                            const logData = {
                                userId: user.id,
                                deviceId: user.device_id,
                                changeType: 'ssid_name',
                                changes: {
                                    oldSsidName: 'Multiple SSIDs',
                                    newSsidName: ssidChangeDetails.join('; ')
                                },
                                changedBy: 'customer',
                                changeSource: 'wa_bot',
                                customerName: user.name,
                                customerPhone: sender.replace('@s.whatsapp.net', ''),
                                reason: 'Perubahan nama WiFi melalui WhatsApp Bot (Mode Kustom Nonaktif)',
                                notes: `Mengubah ${user.bulk.length} SSID secara otomatis tanpa konfirmasi`,
                                ipAddress: 'WhatsApp',
                                userAgent: 'WhatsApp Bot'
                            };

                            await logWifiChange(logData);
                            console.log(`[WA_WIFI_LOG] WiFi name changed (auto): ${user.bulk.length} SSID(s) for user ${user.id}`);
                        } catch (logError) {
                            console.error(`[WA_WIFI_LOG_ERROR] ${logError.message}`);
                        }
                        
                        reply(`✨ Berhasil! Nama WiFi untuk *semua SSID* sudah diubah menjadi *"${newName}"*.\n\nSilakan cari nama WiFi baru tersebut di perangkat Anda dan sambungkan kembali menggunakan kata sandi yang sama ya. Jika ada kendala, jangan ragu hubungi saya lagi! 😊`);
                    })
                    .catch(error => {
                        console.error("[GANTINAMA_BULK_AUTO_ERROR]", error.response ? error.response.data : error.message);
                        reply(`⚠️ Aduh, maaf Kak. Sepertinya ada kendala teknis saat saya mencoba mengubah nama WiFi Anda. Mohon pastikan modem dalam keadaan menyala dan coba lagi beberapa saat, ya. Jika masih gagal, silakan hubungi Admin.`);
                    });
                } else {
                    // Jika nama belum diberikan, tanyakan nama baru
                    temp[sender] = {
                        step: 'ASK_NEW_NAME_FOR_BULK_AUTO',
                        targetUser: user,
                        bulk_ssids: user.bulk,
                        ssid_info: currentSSIDs
                    };

                    reply(`📋 *Daftar SSID Anda:*\n${currentSSIDs}\n\nSilakan ketik nama WiFi baru yang Anda inginkan.\n\n📝 *Ketentuan nama WiFi:*\n• Maksimal 32 karakter\n• Boleh menggunakan huruf, angka, spasi, titik, dan tanda hubung\n• Contoh: WiFiRumah, Keluarga-Bahagia\n\n⚠️ Nama ini akan diterapkan ke *semua SSID* di atas.\n\n💡 Ketik *batal* jika ingin membatalkan proses ini.`);
                }
            } catch (error) {
                console.error(`[GANTI_NAMA_WIFI] Error getting current SSID:`, error);

                // Fallback jika gagal mendapatkan nama WiFi saat ini
                // Validasi nama WiFi
                if (newName.length > 32) {
                    return reply(`⚠️ Nama WiFi terlalu panjang (maksimal 32 karakter).`);
                }

                if (/[^\w\s\-.]/.test(newName)) {
                    return reply(`⚠️ Nama WiFi mengandung karakter yang tidak diperbolehkan. Gunakan hanya huruf, angka, spasi, titik, dan tanda hubung.`);
                }

                reply(`⏳ Sedang mengubah semua nama WiFi menjadi *"${newName}"*...`);

                    const parameterValues = user.bulk.map(ssidId => {
                        return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.SSID`, newName, "xsd:string"];
                    });

                    axios.post(`${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(user.device_id)}/tasks?connection_request`, {
                        name: 'setParameterValues',
                        parameterValues: parameterValues
                    })
                    .then(async response => {
                        try {
                            const { logWifiChange } = require('../lib/wifi-logger');
                            const logData = {
                                userId: user.id,
                                deviceId: user.device_id,
                                changeType: 'ssid_name',
                                changes: {
                                    oldSsidName: 'Multiple SSIDs',
                                    newSsidName: `All ${user.bulk.length} SSIDs → "${newName}"`
                                },
                                changedBy: 'customer',
                                changeSource: 'wa_bot',
                                customerName: user.name,
                                customerPhone: sender.replace('@s.whatsapp.net', ''),
                                reason: 'Perubahan nama WiFi melalui WhatsApp Bot (Mode Kustom Nonaktif)',
                                notes: `Mengubah ${user.bulk.length} SSID secara otomatis tanpa konfirmasi`,
                                ipAddress: 'WhatsApp',
                                userAgent: 'WhatsApp Bot'
                            };
                            await logWifiChange(logData);
                        } catch (logError) {
                            console.error(`[WA_WIFI_LOG_ERROR] ${logError.message}`);
                        }
                        reply(`✨ Berhasil! Nama WiFi untuk *semua SSID* sudah diubah menjadi *"${newName}"*.\n\nSilakan cari nama WiFi baru tersebut di perangkat Anda dan sambungkan kembali menggunakan kata sandi yang sama ya. Jika ada kendala, jangan ragu hubungi saya lagi! 😊`);
                    })
                    .catch(error => {
                        console.error("[GANTINAMA_BULK_AUTO_ERROR]", error.response ? error.response.data : error.message);
                        reply(`⚠️ Aduh, maaf Kak. Sepertinya ada kendala teknis saat saya mencoba mengubah nama WiFi Anda. Mohon pastikan modem dalam keadaan menyala dan coba lagi beberapa saat, ya. Jika masih gagal, silakan hubungi Admin.`);
                    });
            }
        } else {
            // 4. Kode untuk single SSID (atau jika custom_wifi_modification false)
            try {
                const { ssid } = await getSSIDInfo(user.device_id);
                const targetSsidId = "1"; // Default SSID ID
                const currentSSID = ssid && ssid.length > 0
                    ? (ssid.find(s => String(s.id) === targetSsidId)?.name || "Tidak diketahui")
                    : "Tidak diketahui";

                // Validasi dan konfirmasi nama baru
                if (newName && newName.trim().length > 0) {
                    // Validasi nama WiFi
                    if (newName.length > 32) {
                        return reply(`⚠️ Nama WiFi terlalu panjang (maksimal 32 karakter).`);
                    }

                    if (/[^\w\s\-.]/.test(newName)) {
                        return reply(`⚠️ Nama WiFi mengandung karakter yang tidak diperbolehkan. Gunakan hanya huruf, angka, spasi, titik, dan tanda hubung.`);
                    }

                    temp[sender] = {
                        step: 'CONFIRM_GANTI_NAMA',
                        targetUser: user,
                        nama_wifi_baru: newName,
                        ssid_id: targetSsidId,
                        current_ssid: currentSSID
                    };

                    reply(`Nama WiFi saat ini: *"${currentSSID}"*\n\nAnda yakin ingin mengubah nama WiFi menjadi: *"${newName}"* ?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
                } else {
                    // Jika nama baru tidak ada, tanya dulu
                    temp[sender] = {
                        step: 'ASK_NEW_NAME',
                        targetUser: user,
                        ssid_id: targetSsidId,
                        current_ssid: currentSSID
                    };

                    reply(`Nama WiFi saat ini: *"${currentSSID}"*\n\nSilakan ketik nama WiFi baru yang Anda inginkan.\n\n📝 *Ketentuan nama WiFi:*\n• Maksimal 32 karakter\n• Boleh menggunakan huruf, angka, spasi, titik, dan tanda hubung\n• Contoh: WiFiRumah, Keluarga-Bahagia\n\n💡 Ketik *batal* jika ingin membatalkan proses ini.`);
                }
            } catch (error) {
                console.error(`[GANTI_NAMA_WIFI] Error getting current SSID:`, error);

                // Fallback jika gagal mendapatkan nama WiFi saat ini
                if (newName && newName.trim().length > 0) {
                    // Validasi nama WiFi
                    if (newName.length > 32) {
                        return reply(`⚠️ Nama WiFi terlalu panjang (maksimal 32 karakter).`);
                    }

                    if (/[^\w\s\-.]/.test(newName)) {
                        return reply(`⚠️ Nama WiFi mengandung karakter yang tidak diperbolehkan. Gunakan hanya huruf, angka, spasi, titik, dan tanda hubung.`);
                    }

                    temp[sender] = {
                        step: 'CONFIRM_GANTI_NAMA',
                        targetUser: user,
                        nama_wifi_baru: newName,
                        ssid_id: "1"
                    };

                    reply(`Anda yakin ingin mengubah nama WiFi menjadi: *"${newName}"* ?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
                } else {
                    // Jika nama baru tidak ada, tanya dulu
                    temp[sender] = {
                        step: 'ASK_NEW_NAME',
                        targetUser: user,
                        ssid_id: "1"
                    };

                    reply("Tentu, mau diganti jadi apa nama WiFi nya? Silakan ketik nama yang baru.\n\n📝 *Ketentuan nama WiFi:*\n• Maksimal 32 karakter\n• Boleh menggunakan huruf, angka, spasi, titik, dan tanda hubung\n• Contoh: WiFiRumah, Keluarga-Bahagia\n\n💡 Ketik *batal* jika ingin membatalkan proses ini.");
                }
            }
        }
    } catch (e) {
        console.error(`[GANTI_NAMA_WIFI_ERROR] Error:`, e);
        reply(`Maaf, terjadi kesalahan saat memeriksa informasi WiFi. Silakan coba lagi nanti atau hubungi admin.`);
    }
    break;
}
            //GenieACS Change Pass
case 'GANTI_SANDI_WIFI': {
    // 1. Validasi Awal (User terdaftar, punya device_id, dll)
    let user;
    let newPassword;
    let providedId = null;

    // --- Argument parsing logic (DIPERBAIKI: Menggunakan matchedKeywordLength) ---
    // matchedKeywordLength berisi jumlah kata yang cocok dari keyword
    // Contoh: "ubah password" = 2 kata, "gantisandi" = 1 kata
    
    const keywordLength = matchedKeywordLength || 1; // Default 1 jika tidak ada
    
    if ((isOwner || isTeknisi) && args.length > keywordLength + 1 && !isNaN(parseInt(args[keywordLength], 10))) {
        // Admin dengan ID: <keyword> <id> <password>
        // Contoh: "ubah password 123 HOME1009" -> args[2]=123, args[3..]=HOME1009
        providedId = args[keywordLength];
        newPassword = args.slice(keywordLength + 1).join(' ').trim();
    } else {
        // Customer tanpa ID: <keyword> <password>
        // Contoh: "ubah password HOME1009" -> args[2..]=HOME1009
        newPassword = args.length > keywordLength ? args.slice(keywordLength).join(' ').trim() : '';
    }

    if (providedId) {
        user = users.find(v => v.id == providedId);
    } else {
        const plainSenderNumber = sender.split('@')[0];
        user = users.find(v => v.phone_number && v.phone_number.split("|").includes(plainSenderNumber));
    }
    // --- End of argument parsing ---

    if(!user) {
        // Jika owner/teknisi salah input ID atau pelanggan tidak terdaftar
        const pesanErrorUser = (isOwner || isTeknisi)
            ? (providedId ? `Maaf Kak ${pushname}, pelanggan dengan ID "${providedId}" tidak ditemukan.` : `Kak ${pushname}, mohon sebutkan ID Pelanggan. Contoh: gantisandi 1 PassBaru123`)
            : mess.userNotRegister;
        return reply(pesanErrorUser);
    }

    if (user.subscription === 'PAKET-VOUCHER' && !(isOwner || isTeknisi)) {
        return reply(`Maaf Kak ${pushname}, fitur ganti kata sandi WiFi saat ini hanya tersedia untuk pelanggan bulanan.`);
    }

    if (!user.device_id) {
        return reply(`Maaf Kak ${pushname}, data device ID ${(isOwner || isTeknisi) ? `untuk pelanggan "${user.name}"` : 'Anda'} tidak ditemukan. ${!(isOwner || isTeknisi) ? 'Silakan hubungi Admin.' : 'Tidak bisa melanjutkan.'}`);
    }

    // 2. Cek status modem dan dapatkan informasi SSID
    await reply("⏳ Sedang memeriksa informasi WiFi...");

    try {
        const useBulk = global.config.custom_wifi_modification && user.bulk && user.bulk.length > 0;
        const hasMultipleSSIDs = user.bulk && user.bulk.length > 0;

        // 3. Penanganan SSID - dengan pilihan untuk bulk atau individual
        if (useBulk) {
            try {
                const { ssid } = await getSSIDInfo(user.device_id);

                // Dapatkan nama-nama SSID saat ini untuk ditampilkan
                const currentSSIDs = user.bulk.map((bulkId, index) => {
                    const matchedSSID = ssid.find(s => String(s.id) === String(bulkId));
                    return `${index + 1}. SSID ${bulkId}: "${matchedSSID?.name || 'Tidak diketahui'}"`;
                }).join('\n');

                // Jika password sudah diberikan, tanyakan mode perubahan
                if (newPassword && newPassword.trim().length > 0) {
                    // Validasi password WiFi
                    if (newPassword.length < 8) {
                        return reply(`⚠️ Kata sandi terlalu pendek, minimal harus 8 karakter.`);
                    }

                    temp[sender] = {
                        step: 'SELECT_CHANGE_PASSWORD_MODE',
                        targetUser: user,
                        sandi_wifi_baru: newPassword,
                        bulk_ssids: user.bulk,
                        ssid_info: currentSSIDs
                    };

                    reply(`SSID WiFi yang tersedia:\n${currentSSIDs}\n\nAnda ingin mengubah kata sandi WiFi menjadi: \`${newPassword}\`\n\nPilih mode perubahan:\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`);
                } else {
                    // Jika password belum diberikan, tanyakan dulu mode perubahan
                    temp[sender] = {
                        step: 'SELECT_CHANGE_PASSWORD_MODE_FIRST',
                        targetUser: user,
                        bulk_ssids: user.bulk,
                        ssid_info: currentSSIDs
                    };

                    reply(`SSID WiFi yang tersedia:\n${currentSSIDs}\n\nPilih mode perubahan kata sandi:\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`);
                }
            } catch (error) {
                console.error(`[GANTI_SANDI_WIFI] Error getting current SSID:`, error);

                // Fallback jika gagal mendapatkan info SSID
                if (newPassword && newPassword.trim().length > 0) {
                    // Validasi password WiFi
                    if (newPassword.length < 8) {
                        return reply(`⚠️ Kata sandi terlalu pendek, minimal harus 8 karakter.`);
                    }

                    temp[sender] = {
                        step: 'SELECT_CHANGE_PASSWORD_MODE',
                        targetUser: user,
                        sandi_wifi_baru: newPassword,
                        bulk_ssids: user.bulk
                    };

                    reply(`Anda ingin mengubah kata sandi WiFi menjadi: \`${newPassword}\`\n\nPilih mode perubahan:\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`);
                } else {
                    // Jika password belum diberikan, tanyakan dulu mode perubahan
                    temp[sender] = {
                        step: 'SELECT_CHANGE_PASSWORD_MODE_FIRST',
                        targetUser: user,
                        bulk_ssids: user.bulk
                    };

                    reply(`Pilih mode perubahan kata sandi WiFi:\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`);
                }
            }
        } else if (hasMultipleSSIDs && !global.config.custom_wifi_modification) {
            // Mode Kustom NONAKTIF: Langsung ubah semua SSID tanpa konfirmasi
            
            // VALIDASI: Kata sandi WiFi tidak boleh kosong
            if (!newPassword || newPassword.trim().length === 0) {
                // Jika password kosong, tanyakan password baru tanpa menampilkan pilihan SSID
                temp[sender] = {
                    step: 'ASK_NEW_PASSWORD_BULK_AUTO',
                    targetUser: user,
                    bulk_ssids: user.bulk
                };
                return reply(`Silakan ketik kata sandi WiFi baru yang Anda inginkan.\n\n🔐 *Ketentuan kata sandi WiFi:*\n• Minimal 8 karakter\n• Boleh menggunakan huruf, angka, dan simbol\n• Contoh: Password123, MyWiFi2024!\n\n⚠️ Kata sandi ini akan diterapkan ke *semua SSID* WiFi Anda.\n\n💡 Ketik *batal* jika ingin membatalkan proses ini.`);
            }
            
            // VALIDASI: Kata sandi minimal 8 karakter
            if (newPassword.length < 8) {
                return reply(`⚠️ *Kata sandi terlalu pendek!*\n\nKata sandi WiFi minimal harus *8 karakter*.\n\nSilakan coba lagi dengan kata sandi yang lebih panjang.`);
            }
            
            try {
                const { ssid } = await getSSIDInfo(user.device_id);

                // Dapatkan nama-nama SSID saat ini untuk ditampilkan
                const currentSSIDs = user.bulk.map((bulkId, index) => {
                    const matchedSSID = ssid.find(s => String(s.id) === String(bulkId));
                    return `${index + 1}. SSID ${bulkId}: "${matchedSSID?.name || 'Tidak diketahui'}"`;
                }).join('\n');

                // Jika password sudah diberikan dan valid, langsung eksekusi
                if (newPassword && newPassword.trim().length > 0) {

                    // Tampilkan daftar SSID yang akan diubah
                    reply(`📋 *Daftar SSID yang akan diubah:*\n${currentSSIDs}\n\n⏳ Sedang mengubah kata sandi untuk *semua SSID*...`);

                    // Langsung eksekusi tanpa konfirmasi
                    const parameterValues = user.bulk.map(ssidId => {
                        return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.PreSharedKey.1.PreSharedKey`, newPassword, "xsd:string"];
                    });

                    axios.post(`${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(user.device_id)}/tasks?connection_request`, {
                        name: 'setParameterValues',
                        parameterValues: parameterValues
                    })
                    .then(async response => {
                        // Log WiFi password change for bulk
                        try {
                            const { logWifiChange } = require('../lib/wifi-logger');
                            
                            const passwordChangeDetails = user.bulk.map(ssidId => 
                                `SSID ${ssidId} password: "${newPassword}"`
                            ).join('; ');
                            
                            const logData = {
                                userId: user.id,
                                deviceId: user.device_id,
                                changeType: 'password',
                                changes: {
                                    oldPassword: 'ada',
                                    newPassword: passwordChangeDetails
                                },
                                changedBy: 'customer',
                                changeSource: 'wa_bot',
                                customerName: user.name,
                                customerPhone: sender.replace('@s.whatsapp.net', ''),
                                reason: 'Perubahan password WiFi melalui WhatsApp Bot (Mode Kustom Nonaktif)',
                                notes: `Mengubah password untuk ${user.bulk.length} SSID secara otomatis tanpa konfirmasi: ${user.bulk.join(', ')}`,
                                ipAddress: 'WhatsApp',
                                userAgent: 'WhatsApp Bot'
                            };

                            await logWifiChange(logData);
                            console.log(`[WA_WIFI_LOG] Bulk password changed (auto): ${user.bulk.length} SSID(s)`);
                        } catch (logError) {
                            console.error(`[WA_WIFI_LOG_ERROR] ${logError.message}`);
                        }
                        
                        reply(`✨ Berhasil! Kata sandi untuk *semua SSID* Anda sudah diubah menjadi *"${newPassword}"*.\n\nSilakan sambungkan kembali perangkat Anda dengan kata sandi yang baru.`);
                    })
                    .catch(error => {
                        console.error("[GANTI_SANDI_BULK_AUTO_ERROR]", error.response ? error.response.data : error.message);
                        reply(`⚠️ Aduh, maaf. Sepertinya ada kendala teknis saat saya mencoba mengubah kata sandi WiFi Anda. Mohon pastikan modem dalam keadaan menyala dan coba lagi beberapa saat, ya.`);
                    });
                }
            } catch (error) {
                console.error(`[GANTI_SANDI_WIFI] Error getting current SSID:`, error);

                // Fallback jika gagal mendapatkan info SSID
                reply(`⏳ Sedang mengubah kata sandi untuk *semua SSID*...`);

                    const parameterValues = user.bulk.map(ssidId => {
                        return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.PreSharedKey.1.PreSharedKey`, newPassword, "xsd:string"];
                    });

                    axios.post(`${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(user.device_id)}/tasks?connection_request`, {
                        name: 'setParameterValues',
                        parameterValues: parameterValues
                    })
                    .then(async response => {
                        try {
                            const { logWifiChange } = require('../lib/wifi-logger');
                            const passwordChangeDetails = user.bulk.map(ssidId => 
                                `SSID ${ssidId} password: "${newPassword}"`
                            ).join('; ');
                            
                            const logData = {
                                userId: user.id,
                                deviceId: user.device_id,
                                changeType: 'password',
                                changes: {
                                    oldPassword: 'ada',
                                    newPassword: passwordChangeDetails
                                },
                                changedBy: 'customer',
                                changeSource: 'wa_bot',
                                customerName: user.name,
                                customerPhone: sender.replace('@s.whatsapp.net', ''),
                                reason: 'Perubahan password WiFi melalui WhatsApp Bot (Mode Kustom Nonaktif)',
                                notes: `Mengubah password untuk ${user.bulk.length} SSID secara otomatis tanpa konfirmasi: ${user.bulk.join(', ')}`,
                                ipAddress: 'WhatsApp',
                                userAgent: 'WhatsApp Bot'
                            };
                            await logWifiChange(logData);
                        } catch (logError) {
                            console.error(`[WA_WIFI_LOG_ERROR] ${logError.message}`);
                        }
                        reply(`✨ Berhasil! Kata sandi untuk *semua SSID* Anda sudah diubah menjadi *"${newPassword}"*.\n\nSilakan sambungkan kembali perangkat Anda dengan kata sandi yang baru.`);
                    })
                    .catch(error => {
                        console.error("[GANTI_SANDI_BULK_AUTO_ERROR]", error.response ? error.response.data : error.message);
                        reply(`⚠️ Aduh, maaf. Sepertinya ada kendala teknis saat saya mencoba mengubah kata sandi WiFi Anda. Mohon pastikan modem dalam keadaan menyala dan coba lagi beberapa saat, ya.`);
                    });
            }
        } else {
            // 4. Kode untuk single SSID (atau jika custom_wifi_modification false)
            try {
                const { ssid } = await getSSIDInfo(user.device_id);
                const targetSsidId = "1"; // Default SSID ID
                const currentSSID = ssid && ssid.length > 0
                    ? (ssid.find(s => String(s.id) === targetSsidId)?.name || "Tidak diketahui")
                    : "Tidak diketahui";

                // Validasi dan konfirmasi password baru
                if (newPassword && newPassword.trim().length > 0) {
                    // Validasi password WiFi
                    if (newPassword.length < 8) {
                        return reply(`⚠️ Kata sandi terlalu pendek, minimal harus 8 karakter.`);
                    }

                    temp[sender] = {
                        step: 'CONFIRM_GANTI_SANDI',
                        targetUser: user,
                        sandi_wifi_baru: newPassword,
                        ssid_id: targetSsidId,
                        current_ssid: currentSSID
                    };

                    reply(`SSID: *"${currentSSID}"*\n\nAnda yakin ingin mengubah kata sandi WiFi menjadi: \`${newPassword}\` ?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
                } else {
                    // Jika password baru tidak ada, tanya dulu
                    temp[sender] = {
                        step: 'ASK_NEW_PASSWORD',
                        targetUser: user,
                        ssid_id: targetSsidId,
                        current_ssid: currentSSID
                    };

                    reply(`SSID: *"${currentSSID}"*\n\nSilakan ketik kata sandi WiFi baru yang Anda inginkan.\n\n🔐 *Ketentuan kata sandi WiFi:*\n• Minimal 8 karakter\n• Boleh menggunakan huruf, angka, dan simbol\n• Contoh: Password123, MyWiFi2024!\n\n💡 Ketik *batal* jika ingin membatalkan proses ini.`);
                }
            } catch (error) {
                console.error(`[GANTI_SANDI_WIFI] Error getting current SSID:`, error);

                // Fallback jika gagal mendapatkan info SSID
                if (newPassword && newPassword.trim().length > 0) {
                    // Validasi password WiFi
                    if (newPassword.length < 8) {
                        return reply(`⚠️ Kata sandi terlalu pendek, minimal harus 8 karakter.`);
                    }

                    temp[sender] = {
                        step: 'CONFIRM_GANTI_SANDI',
                        targetUser: user,
                        sandi_wifi_baru: newPassword,
                        ssid_id: "1"
                    };

                    reply(`Anda yakin ingin mengubah kata sandi WiFi menjadi: \`${newPassword}\` ?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
                } else {
                    // Jika password baru tidak ada, tanya dulu
                    temp[sender] = {
                        step: 'ASK_NEW_PASSWORD',
                        targetUser: user,
                        ssid_id: "1"
                    };

                    reply("Silakan ketik kata sandi WiFi baru yang Anda inginkan.\n\n🔐 *Ketentuan kata sandi WiFi:*\n• Minimal 8 karakter\n• Boleh menggunakan huruf, angka, dan simbol\n• Contoh: Password123, MyWiFi2024!\n\n💡 Ketik *batal* jika ingin membatalkan proses ini.");
                }
            }
        }
    } catch (e) {
        console.error(`[GANTI_SANDI_WIFI_ERROR] Error:`, e);
        reply(`Maaf, terjadi kesalahan saat memeriksa informasi WiFi. Silakan coba lagi nanti atau hubungi admin.`);
    }
    break;
}
            //Change Power Modem
            case 'GANTI_POWER_WIFI': {
                const user = users.find(v => (isOwner || isTeknisi) ? v.id == args[1] : v.phone_number.split("|").find(vv => vv == (/^([^:@]+)[:@]?.*$/.exec(sender)[1])));
                if(!user) throw (isOwner || isTeknisi) ? mess.notRegister : mess.userNotRegister
                if (user.subscription == 'PAKET-VOUCHER') throw mess.onlyMonthly
                if (!q) throw `Silahkan Isi Berapa Power Wifi\n\nContoh : gantipower 80\n\nFungsi : Untuk Mengatur Luas Jangkauan Wifi\n\nNB : Untuk Power Hanya Bisa Diisi 100, 80, 60, 40, 20.`;
                if(!['100', '80', '60', '40', '20'].includes(q)) throw `*ERROR!*\n\nSilahkan Cek format gantipower dan coba lagi.\n\nTerimakasih\n${global.config.namabot}`;
                axios.post(global.config.genieacsBaseUrl + "/devices/" + encodeURIComponent(user.device_id) + "/tasks?connection_request", {
                    name: 'setParameterValues',
                    parameterValues: [
                    ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TransmitPower", `${q}`, "xsd:string"]
                    ]
                })
                .then(response => {
                    console.log(response.data);
                    reply(`Power Wifi Berhasil Dirubah Ke :\n\n==================================\n${q}%\n==================================\n\n${global.config.namabot}`)
                })
                    .catch(error => {
                    console.error(error);
                    reply(`Gagal Mengubah Power Wifi\n\nSilahkan Cek Format Power Wifi Atau Hubungi Admin\n\nTerimakasih\n\n${global.config.namabot}`)
                    });}
                break
            //Reboot Modem
            case 'REBOOT_MODEM': {
                // --- PERBAIKAN: Menggunakan logika pencarian user yang lebih aman dan konsisten ---
                let user;
                const providedId = entities.id_pelanggan;

                if ((isOwner || isTeknisi) && providedId && !isNaN(parseInt(providedId))) {
                    user = users.find(v => v.id == providedId);
                } else {
                    user = users.find(v => v.phone_number && v.phone_number.split("|").includes(plainSenderNumber));
                }

                if(!user) {
                    const errorMessage = (isOwner || isTeknisi)
                        ? (providedId ? `Maaf, Kak. Pelanggan dengan ID "${providedId}" tidak ditemukan.` : "Anda belum terdaftar sebagai pelanggan. Untuk reboot modem pelanggan lain, sebutkan ID pelanggannya.")
                        : mess.userNotRegister;
                    return reply(errorMessage);
                }
                if (user.subscription === 'PAKET-VOUCHER' && !(isOwner || isTeknisi)) {
                    return reply(`Maaf Kak ${pushname}, fitur reboot modem saat ini hanya tersedia untuk pelanggan bulanan.`);
                }
                if (!user.device_id) {
                    return reply(`Maaf Kak ${pushname}, data device ID untuk pelanggan "${user.name || 'ini'}" tidak ditemukan sehingga saya tidak bisa melakukan reboot. Silakan hubungi Admin.`);
                }

                // Memulai percakapan konfirmasi
                temp[sender] = { step: 'CONFIRM_REBOOT', targetUser: user };
                reply(`Tentu, saya bisa me-reboot modem Anda. Perlu diingat, proses ini akan membuat koneksi internet terputus selama beberapa menit.\n\nAnda yakin ingin melanjutkan?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
                break;
            }
case 'CEK_WIFI': {
    // --- LOGIKA PENCARIAN USER YANG DIPERBAIKI ---
    let user;
    const providedId = entities.id_pelanggan || (args[1] && !isNaN(parseInt(args[1])) ? args[1] : null);
    const providedName = entities.nama_pelanggan || null;

    // Prioritas 1: Jika pengirim adalah Teknisi/Owner dan mereka memberikan ID pelanggan via teks natural.
    if ((isOwner || isTeknisi) && providedId && !isNaN(parseInt(providedId))) {
        user = users.find(v => v.id == providedId);
    // Prioritas 2: Jika pengirim adalah Teknisi/Owner dan mereka memberikan nama pelanggan.
    } else if ((isOwner || isTeknisi) && providedName) {
        user = users.find(v => v.name.toLowerCase().includes(providedName.toLowerCase()));
    } else {
    // Prioritas 3 (Fallback): Cari berdasarkan nomor WhatsApp pengirim.
        user = users.find(v => v.phone_number && v.phone_number.split("|").includes(plainSenderNumber));
    }

    if (!user) {
        const errorMessage = (isOwner || isTeknisi)
            ? (providedId ? `Maaf, Kak. Pelanggan dengan ID "${providedId}" tidak ditemukan.` : "Anda belum terdaftar sebagai pelanggan. Untuk cek pelanggan lain, bisa sebutkan ID atau nama pelanggannya ya.")
            : mess.userNotRegister;
        return reply(errorMessage);
    }

    if (!user.device_id) {
        return reply(`Maaf, Kak. Data device ID untuk pelanggan "${user.name || 'ini'}" tidak ditemukan di sistem kami, jadi saya tidak bisa melakukan pengecekan.`);
    }

    await reply("⏳ Sedang mengambil informasi WiFi dan modem Anda, mohon tunggu sebentar...");

    try {
        // Buat fungsi untuk mengirim refresh request dan menunggu hasilnya
        const refreshDevice = async (deviceId, objectName) => {
            try {
                const response = await axios.post(
                    `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`,
                    {
                        name: "refreshObject",
                        objectName: objectName
                    },
                    { timeout: 20000 }
                );

                console.log(`[CEK_WIFI] Refresh request sent for ${objectName}, status: ${response.status}`);
                return response.status >= 200 && response.status < 300;
            } catch (err) {
                console.error(`[CEK_WIFI] Error refreshing ${objectName}:`, err.message);
                return false;
            }
        };

        // Kirim permintaan refresh dan tunggu beberapa saat
        const refreshLAN = refreshDevice(user.device_id, "InternetGatewayDevice.LANDevice.1");
        const refreshVirtual = refreshDevice(user.device_id, "VirtualParameters");

        // Tunggu kedua refresh selesai
        await Promise.all([refreshLAN, refreshVirtual]);

        // Tunggu beberapa detik untuk memastikan data sudah diperbarui di server
        await sleep(10000);

        // Ambil data terbaru setelah refresh
        const { uptime, ssid } = await getSSIDInfo(user.device_id);

        let ssidInfoText = "";
        let filteredSsids = [];

        if (user.bulk && user.bulk.length > 0) {
            const bulkSsidIds = user.bulk.map(String);
            filteredSsids = ssid.filter(s => {
                return s.id && bulkSsidIds.includes(String(s.id));
            });
        } else {
            filteredSsids = ssid.filter(s => String(s.id) === "1");
        }

        if (filteredSsids.length > 0) {
            ssidInfoText = filteredSsids.map(s_item => {
                let ssidIdentifier = "";
                if (s_item.id) ssidIdentifier = `(SSID ID: ${s_item.id})`;
                else ssidIdentifier = "(Band Tidak Diketahui)";

                let devicesConnectedText = "  Tidak ada perangkat terhubung ke SSID ini.";
                if (s_item.associatedDevices && s_item.associatedDevices.length > 0) {
                    devicesConnectedText = `  *Daftar Perangkat Terhubung (${s_item.associatedDevices.length}):*\n` +
                          s_item.associatedDevices.map((d, index) =>
                              `    ${index + 1}. ${d.hostName || "Tanpa Nama"} (IP: ${d.ip || "-"}) Sinyal: ${d.signal ? d.signal + " dBm" : "-"}`
                          ).join("\n");
                }

                return `📶 *Detail SSID: "${s_item.name || 'N/A'}"* ${ssidIdentifier}\n` +
                       `   ⚡ *Transmit Power:* ${s_item.transmitPower ? s_item.transmitPower + "%" : "Tidak Terbaca"}\n` +
                       `${devicesConnectedText}`;
            }).join("\n\n-----------------------------------\n");
        } else {
            ssidInfoText = "Informasi SSID tidak tersedia atau tidak dapat diambil untuk konfigurasi Anda saat ini.";
        }

        const namaPelangganTampil = user.name || pushname;
        const namaLayanan = global.config.nama || "Layanan Kami";
        const botNama = global.config.namabot || "Bot Asisten";

        const messageReply = `📡 *STATUS MODEM ANDA - ${namaLayanan}* 📡\n\nHalo Kak ${namaPelangganTampil}! Berikut adalah informasi modem Anda:\n\n⏱️ *Uptime Perangkat:* ${uptime || "Tidak terbaca"}\n-----------------------------------\n${ssidInfoText}\n-----------------------------------\n\n💡 *Tips Singkat:*\n- Jika ada perangkat dengan sinyal lemah (misalnya, di bawah -75 dBm), coba dekatkan perangkat ke modem atau periksa penghalang sinyal.\n- Jika mengalami kendala, Anda dapat mencoba me-restart modem dengan kalimat "reboot modem saya" atau melaporkannya dengan "lapor wifi saya lemot".\n\nJika ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi saya lagi ya!\n\nTerima kasih,\nTim ${botNama}`;

        await reply(messageReply);

    } catch(e) {
        console.error(`[CEK_WIFI_ERROR] Gagal mengambil info WiFi untuk ${user.name} (Device ID: ${user.device_id}):`, e);

        let userFriendlyError = `*MAAF, TERJADI KESALAHAN!* 😟\n\nTidak dapat mengambil informasi modem untuk pelanggan "${user.name || 'ini'}" saat ini.\nKemungkinan penyebab:\n- Modem sedang offline atau tidak terjangkau.\n- Ada gangguan pada sistem pemantauan.`;

        if (e.response && e.response.status === 404) {
            userFriendlyError += `\n- Perangkat dengan Device ID ${user.device_id} tidak ditemukan di sistem manajemen perangkat.`;
        } else if (e.code === 'ECONNABORTED' || e.message.includes('timeout')) {
            userFriendlyError += `\n- Permintaan ke modem timeout. Mungkin modem sedang tidak aktif atau koneksi terputus.`;
        } else if (e.message.includes('request to device management server failed')) {
             userFriendlyError += `\n- Gagal berkomunikasi dengan server manajemen perangkat. Status: ${e.response?.status || 'Tidak diketahui'}.`;
        }

        userFriendlyError += `\n\nSilakan coba lagi dalam beberapa saat atau hubungi Admin jika masalah berlanjut.\n\nTerima Kasih,\n${global.config.namabot || "Bot Asisten"}`;
        reply(userFriendlyError);
    }
}
break;
            //Monitoring All Modem
            case 'monitorwifi': {
                if(!(isOwner || isTeknisi)) throw mess.owner;
                let replyMsg = "> INFO PELANGGAN\n\n"
                const devices = (await axios.get(global.config.genieacsBaseUrl + "/devices")).data;
                replyMsg += users.map(u => {
                    const d = devices.find(v => v._id == u.device_id);
                    if(!d) return "";
                    return `*ID* : ${u?.id || "Tidak Terdaftar"}\n*Name* : ${u?.name  || "Tidak Terdaftar"}\n*◉SSID* : ${d.InternetGatewayDevice.LANDevice['1'].WLANConfiguration['1'].SSID._value}\n*◉Jumlah Device Terkoneksi* : ${d.InternetGatewayDevice.LANDevice['1'].WLANConfiguration['1'].TotalAssociations._value || d.InternetGatewayDevice.LANDevice['1'].WLANConfiguration['1'].TotalAssociations._value == 0 ? d.InternetGatewayDevice.LANDevice['1'].WLANConfiguration['1'].TotalAssociations._value : "Tidak Terbaca"}\n*◉Transmit Power Wifi* : ${d.InternetGatewayDevice.LANDevice['1'].WLANConfiguration['1'].TransmitPower._value}%\n*◉Uptime Perangkat* : ${d.VirtualParameters.uptimeDevice._value}\n*◉Redaman* : ${d.VirtualParameters.RXPower._value} dBm\n*◉PPP Username* : ${d.VirtualParameters.pppUsername._value}\n*◉No Hp* : wa.me/${u.phone_number}\n\n`
                }).join("");
                replyMsg += "\n\n\n" + namabot;
                reply(replyMsg)
                }
            break
            case 'addprofvoucher': {
                if(!isOwner) throw mess.owner;
                let [profvc123, namavc123, durasivc123, hargavc123] = q.split('|')
                const cekprof = checkprofvoucher(profvc123)
                if (cekprof === true) {
                    reply(`Mohon Maaf Profil Yang Akan Ditambahkan Sudah Ada Di Dalam Database. Silahkan Cek Kembali Pada Penulisan Profil Voucher Anda.\n\nTerima Kasih`)
                } else {
                addvoucher(profvc123, namavc123, durasivc123, hargavc123)
                reply(`Berhasil Membuat Profil Voucher\n\nProfil : ${profvc123}\nNama Voucher : ${namavc123}\nDurasi Voucher : ${durasivc123}\nHarga Voucher : ${hargavc123}\n\nTerima Kasih`)
            }}
            break
            case 'delprofvoucher': {
                if(!isOwner) throw mess.owner
                if (!q) throw mess.notProfile
                const cekprof = checkprofvoucher(q)
                if (cekprof === false) {
                    reply(`Profil Tidak Ditemukan !!!`)
                } else {
                    voucher.splice(q, 1)
                    fs.writeFileSync('./database/voucher.json', JSON.stringify(voucher))
                    reply(`Berhasil Menghapus Profil Voucher`)
                }
            }
            break
            case 'addprofstatik': {
                if(!isOwner) throw mess.owner
                let [profstatik, limitat, maxlimit] = q.split('|')
                const cekprof = checkStatik(profstatik)
                if (cekprof === true) {
                    reply(`Mohon Maaf Profil Yang Akan Ditambahkan Sudah Ada Di Dalam Database. Silahkan Cek Kembali Pada Penulisan Profil Statik.\n\nTerima Kasih`)
                } else {
                addStatik(profstatik, limitat, maxlimit)
                reply(`Berhasil Membuat Profil Statik\n\nNama Profil : ${profstatik}\nLimit At : ${limitat}\nMax Limit : ${maxlimit}`)
            }}
            break
            case 'delprofstatik': {
                if(!isOwner) throw mess.owner
                if (!q) throw mess.notProfile
                const cekprof = checkStatik(q)
                if (cekprof === false) {
                    reply(`Profil Tidak Ditemukan !!!`)
                } else {
                    statik.splice(q, 1)
                    fs.writeFileSync('./database/statik.json', JSON.stringify(statik))
                    reply(`Berhasil Menghapus Profil Statik`)
                }
            }
            break
            case 'addbinding': {
                if(!isOwner) throw mess.owner
                const parent = `${global.config.parentbinding}`
                let [komen, ip, mac, prof] = q.split('|');
                const cekprof = checkStatik(prof)
                const ceklimitat = checkLimitAt(prof)
                const cekmaxlimit = checkMaxLimit(prof)
                if (cekprof === false) {
                    reply(`Profil Tidak Ditemukan !!!`)
                } else if (mac.toLowerCase() === 'kosong') {
                    addbinding(komen, ip)
                    .then(async (body) => {
                        const tod = body.split('\n')
                        const resultbinding = tod[Math.floor(Math.random() * tod.length)]
                        if (resultbinding === 'ERROR !!! IP ATAU MAC DI IP BINDING SUDAH TERDAFTAR DI MIKROTIK') {
                            reply(`Mohon Maaf Kak Mac Atau Ip Sudah Terdaftar Di IP Binding. Silahkan Cek Lagi Dalam Penulisannya.\n\nTerima Kasih`)
                        } else if (resultbinding === '') {
                            reply(`Mohon Maaf Kak Ada Kesalahan Teknis Saat Penambahan Ip Binding. Silahkan Hubungi Pembuat bot.\n\nTerima Kasih`)
                        } else if (resultbinding === 'ERROR !!! INVALID MAC ADDRESS') {
                            reply(`Mohon Maaf Kak Error Pada Mac Address. Silahkan Cek Kembali Pada Penulisan Mac Address.\n\nTerima Kasih`)
                        } else if (resultbinding === 'ERROR !!! RANGE IP MELEWATI BATAS YANG TELAH DITENTUKAN') {
                            reply(`Mohon Maaf Kak Ip Address Melebihi Range Yang Telah Ditentukan. Silahkan Cek Kembali Pada Penulisan Mac Address.\n\nTerima Kasih`)
                        } else {
                            reply(`Pembuatan Ip Binding Telah Selesai. Dengan Data Berikut :\n\nKomen : ${komen}\nIP : ${ip}\nMAC ADDRESS : ${mac}\n\nTerima Kasih`)
                        }
                    })
                }
                else {
                addbinding(komen, ip, mac)
                .then(async (body) => {
                    const tod = body.split('\n')
                    const resultbinding = tod[Math.floor(Math.random() * tod.length)]
                    if (resultbinding === 'ERROR !!! IP ATAU MAC DI IP BINDING SUDAH TERDAFTAR DI MIKROTIK') {
                        reply(`Mohon Maaf Kak Mac Atau Ip Sudah Terdaftar Di IP Binding. Silahkan Cek Lagi Dalam Penulisannya.\n\nTerima Kasih`)
                    } else if (resultbinding === '') {
                        reply(`Mohon Maaf Kak Ada Kesalahan Teknis Saat Penambahan Ip Binding. Silahkan Hubungi Pembuat bot.\n\nTerima Kasih`)
                    } else if (resultbinding === 'ERROR !!! INVALID MAC ADDRESS') {
                        reply(`Mohon Maaf Kak Error Pada Mac Address. Silahkan Cek Kembali Pada Penulisan Mac Address.\n\nTerima Kasih`)
                    } else if (resultbinding === 'ERROR !!! RANGE IP MELEWATI BATAS YANG TELAH DITENTUKAN') {
                        reply(`Mohon Maaf Kak Ip Address Melebihi Range Yang Telah Ditentukan. Silahkan Cek Kembali Pada Penulisan Mac Address.\n\nTerima Kasih`)
                    } else {
                        reply(`Pembuatan Ip Binding Telah Selesai. Dengan Data Berikut :\n\nKomen : ${komen}\nIP : ${ip}\nMAC ADDRESS : ${mac}\n\nTerima Kasih`)
                    }
                })
                .catch(async (err) => {
                    console.error(err)
                    await reply('Error!')
                })
                addqueue(prof, komen, ip, parent, ceklimitat, cekmaxlimit)
                .then(async (body) => {
                    const tod = body.split('\n')
                    const resultqueue = tod[Math.floor(Math.random() * tod.length)]
                    if (resultqueue === 'ERROR !!! PARENT TIDAK DITEMUKAN DI MIKROTIK') {
                        reply(`Mohon Maaf Kak Gagal Menambahkan Ke Simple Queue Dikarenakan Parent Tidak Ditemukan. Silahkan Cek Lagi Dalam Penulisannya.\n\nTerima Kasih`)
                    } else if (resultqueue === 'ERROR !!! NAMA SIMPLE QUEUE SUDAH TERDAFTAR DI MIKROTIK') {
                        reply(`Mohon Maaf Kak Gagal Menambahkan Ke Simple Queue Dikarenakan Nama Itu Sudah Terdaftar Di Simple Queue. Silahkan Cek Lagi Dalam Penulisannya.\n\nTerima Kasih`)
                    } else if (resultqueue === '') {
                        reply(`Mohon Maaf Kak Ada Kesalahan Teknis Saat Penambahan Simple Queue. Silahkan Hubungi Pembuat bot.\n\nTerima Kasih`)
                    } else if (resultqueue === 'ERROR !!! CEK PADA KONFIG DOWNLOAD ANDA.') {
                        reply(`Mohon Maaf Kak Limit At Download Lebih Besar Dari Max Limit. Silahkan Cek Konfigurasi Database Profil Anda.\n\nTerima Kasih`)
                    } else if (resultqueue === 'ERROR !!! CEK PADA KONFIG UPLOAD ANDA.') {
                        reply(`Mohon Maaf Kak Limit At Upload Lebih Besar Dari Max Limit. Silahkan Cek Konfigurasi Database Profil Anda.\n\nTerima Kasih`)
                    } else {
                        reply(`Pembuatan Simple Queue Telah Selesai. Dengan Data Berikut :\n\nNama : ${komen}\nIP : ${ip}\nParent : ${parent}\nLimit At : ${ceklimitat}\nMax Limit : ${cekmaxlimit}\n\nTerima Kasih`)
                    }
                })
                .catch(async (err) => {
                    console.error(err)
                    await reply('Error!')
                })
            }}
            break
            case 'addppp' : {
                if(!isOwner) throw mess.owner
                let [user, pw, profil] = q.split('|')
                addpppoe(user, pw, profil)
                .then(async (body) => {
                    const tod = body.split('\n')
                    const resultppp = tod[Math.floor(Math.random() * tod.length)]
                    if (resultppp === 'ERROR !!! KESALAHAN PENULISAN PROFILE') {
                        reply(`Mohon Maaf Kak Ada Kesalahan Dalam Penulisan Profil. Silahkan Cek Lagi Dalam Penulisan Profil.\n\nTerima Kasih`)
                    } else if (resultppp === 'ERROR !!! AKUN PPPOE SUDAH TERDAFTAR') {
                        reply(`Mohon Maaf Kak User PPPOE Tersebut Telah Terdaftar. Silahkan Buat User Baru Lagi Kak.\n\nTerima Kasih`)
                    } else if (resultppp === ``) {
                        reply(`Mohon Maaf Kak Ada Kesalahan Teknis. Silahkan Lapor Ke Pembuat Bot\n\nTerima Kasih`)
                    } else {
                        await reply(`Pembuatan Akun PPPOE Berhasil\n\nUsername : ${user}\nPassword : ${pw} \nProfile : ${profil}\n\nTerima Kasih`)
                    }
                })
                .catch(async (err) => {
                    console.error(err)
                    await reply('Error!')
                })
            }
            break
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
            case '<topup':
                if (!isOwner) throw mess.owner;
                if (!q.includes('|')) throw mess.wrongFormat
                let [tujuan, jumblah] = q.split('|')
                        if(isNaN(jumblah)) throw mess.mustNumber
                        const tujuantf = `${tujuan.replace("@", '')}@s.whatsapp.net`
                        const checkATM = checkATMuser(tujuantf)
                        try {
                            if (checkATM === undefined) addATM(tujuantf)
                            const uangsaku = 0
                            addKoinUser(tujuantf, uangsaku)
                        } catch (err) {
                            console.error(err)
                        }
                        addKoinUser(tujuantf, jumblah)
                        const kerupiah123 = convertRupiah.convert(jumblah)
                        reply(`*「 SUKSES 」*\n\nPengiriman uang telah sukses\nDari : +${sender.split("@")[0]}\nKe : +${tujuan}\nJumlah transfer : ${kerupiah123}`)
                        raf.sendMessage(tujuantf, {text: `*「 SUKSES 」*\n\nPengisian Saldo Dengan Jumlah\n${kerupiah123}\n\nSilahkan Cek Saldo Anda Dengan Ketik ceksaldo\n\nTerima Kasih Telah Melakukan Topup\nBy Bot`}, { quoted: msg })
                break
                case '<delsaldo': {
                    if (!isOwner) throw mess.owner;
                    if (!q) throw mess.wrongFormat
                    if(isNaN(q)) throw mess.mustNumber
                    const tujuandel = `${q.replace("@", '')}@s.whatsapp.net`
                    const checkATM = checkATMuser(tujuandel)
                    if (checkATM === undefined) {
                        reply('Nomor Yang Akan Dihapus Tidak Ditemukan.')
                    } else {
                    delSaldo(tujuandel)
                    reply(`*「 SUKSES 」*\n\nHapus Saldo User Dengan Nomor :\n${tujuandel}`)
                    }
                }
                break
                case 'transfer': {
                    if (!q.includes('|')) return  reply(format('mess_wrongFormat')); // Or a more specific template for transfer format
                    let tujuan = q.split('|')[0]
                    let jumblah = q.split('|')[1]
                    if(isNaN(jumblah)) throw mess.mustNumber
                    if (checkATMuser(sender) < jumblah) throw `uang mu tidak mencukupi untuk melakukan transfer.`;
                    const tujuantf = `${tujuan.replace("@", '')}@s.whatsapp.net`
                    const checkATM = checkATMuser(tujuantf)
                    try {
                        if (checkATM === undefined) addATM(tujuantf)
                        const uangsaku = 0
                        addKoinUser(tujuantf, uangsaku)
                    } catch (err) {
                        console.error(err)
                    }
                    confirmATM(sender, jumblah)
                    addKoinUser(tujuantf, jumblah)
                    const kerupiah123 = convertRupiah.convert(jumblah)
                    const sisaSaldo = convertRupiah.convert(checkATMuser(sender));
                    reply(format('transfer_sukses_pengirim', { nomorPengirim: sender.split("@")[0], nomorTujuan: tujuan, jumlah: kerupiah123, sisaSaldo }))
                    raf.sendMessage(tujuantf, {text: format('transfer_sukses_penerima', { jumlah: kerupiah123, nomorPengirim: sender.split("@")[0] })}, { quoted: msg })
                }
                break
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
                // 1. Find user by sender's phone number
                const user = global.users.find(u =>
                    u.phone_number &&
                    u.phone_number.split('|').some(num =>
                        num.trim() === plainSenderNumber ||
                        `62${num.trim().substring(1)}` === plainSenderNumber
                    )
                );

                if (!user) {
                    return reply(mess.userNotRegister);
                }

                // 2. Check if user is a monthly subscriber
                if (user.subscription === 'PAKET-VOUCHER') {
                    return reply(mess.onlyMonthly);
                }

                // 3. Find package details
                const packageInfo = global.packages.find(p => p.name === user.subscription);
                const packageName = packageInfo ? packageInfo.name : "Tidak Diketahui";
                const packagePrice = packageInfo ? parseInt(packageInfo.price) : 0;
                const formattedPrice = convertRupiah.convert(packagePrice);

                // 4. Check paid status and build response using templates
                const templateData = {
                    nama: user.name || pushname,
                    paket: packageName,
                    harga: packagePrice
                };

                let responseMessage;
                if (user.paid) {
                    responseMessage = renderTemplate('tagihan_lunas', templateData);
                } else {
                    responseMessage = renderTemplate('tagihan_belum_lunas', templateData);
                }

                reply(responseMessage);
                break;
            }
            case 'UBAH_PAKET': {
                const user = global.users.find(u => u.phone_number && u.phone_number.split('|').some(num => plainSenderNumber.includes(num)));
                if (!user) {
                    return reply(mess.userNotRegister);
                }

                if (user.subscription === 'PAKET-VOUCHER') {
                    return reply(mess.onlyMonthly);
                }

                const existingRequest = global.packageChangeRequests.find(r => r.userId === user.id && r.status === 'pending');
                if (existingRequest) {
                    return reply(`Anda sudah memiliki permintaan perubahan paket ke *${existingRequest.requestedPackageName}* yang sedang diproses. Mohon tunggu hingga permintaan tersebut diselesaikan oleh Admin.`);
                }

                const currentUserPackagePrice = global.packages.find(p => p.name === user.subscription)?.price || 0;

                const availablePackages = global.packages.filter(p => p.isSpeedBoost && p.name !== user.subscription && p.name !== 'PAKET-VOUCHER' && p.name !== 'PAKET-KHUSUS');

                const upgradePackages = availablePackages.filter(p => p.price > currentUserPackagePrice);
                const downgradePackages = availablePackages.filter(p => p.price < currentUserPackagePrice);

                let replyText = `Halo Kak ${pushname},\n\nAnda dapat mengubah paket langganan Anda. Paket Anda saat ini adalah *${user.subscription}*.\n\n`;

                let optionCounter = 1;
                if (upgradePackages.length > 0) {
                    replyText += "📈 *Pilihan Upgrade:*\n";
                    upgradePackages.forEach(p => {
                        replyText += `  *${optionCounter}.* *${p.name}* (${p.profile}) - ${convertRupiah.convert(p.price)}\n`;
                        optionCounter++;
                    });
                }

                if (downgradePackages.length > 0) {
                    replyText += "\n📉 *Pilihan Downgrade:*\n";
                    downgradePackages.forEach(p => {
                        replyText += `  *${optionCounter}.* *${p.name}* (${p.profile}) - ${convertRupiah.convert(p.price)}\n`;
                        optionCounter++;
                    });
                }

                if (availablePackages.length === 0) {
                    return reply("Maaf, saat ini tidak ada pilihan paket lain yang tersedia untuk Anda.");
                }

                replyText += "\nSilakan balas dengan *nomor* paket yang Anda inginkan (contoh: `1`). Atau ketik *batal* untuk membatalkan.";

                temp[sender] = {
                    step: 'ASK_PACKAGE_CHOICE',
                    user: user,
                    options: availablePackages // The options are already ordered correctly
                };

                return reply(replyText);
            }
            case 'REQUEST_SPEED_BOOST': {
                const user = global.users.find(u => u.phone_number && u.phone_number.split('|').some(num => plainSenderNumber.includes(num)));
                if (!user) {
                    return reply(mess.userNotRegister);
                }

                if (user.subscription === 'PAKET-VOUCHER') {
                    return reply(mess.onlyMonthly);
                }

                const activeBoost = global.speed_requests.find(r => r.userId === user.id && r.status === 'active');
                if (activeBoost) {
                    return reply(`Anda sudah memiliki Speed on Demand yang aktif untuk paket *${activeBoost.requestedPackageName}* dan akan berakhir pada ${new Date(activeBoost.expirationDate).toLocaleString('id-ID')}.`);
                }

                const pendingBoost = global.speed_requests.find(r => r.userId === user.id && r.status === 'pending');
                if (pendingBoost) {
                    return reply(`Anda sudah memiliki permintaan Speed on Demand untuk paket *${pendingBoost.requestedPackageName}* yang sedang menunggu persetujuan admin.`);
                }

                const currentUserPackage = global.packages.find(p => p.name === user.subscription);
                const currentUserPrice = currentUserPackage ? (Number(currentUserPackage.price) || 0) : 0;

                const sodPackages = global.packages.filter(p => p.isSpeedBoost && (Number(p.price) || 0) > currentUserPrice);

                if (sodPackages.length === 0) {
                    return reply("Maaf, saat ini tidak ada upgrade Speed on Demand yang tersedia untuk paket Anda.");
                }

                let optionsText = `Halo Kak ${pushname},\n\nSilakan pilih paket Speed on Demand yang Anda inginkan:\n\n`;
                let availableOptions = [];
                let optionCounter = 1;

                sodPackages.forEach(pkg => {
                    if (pkg.speedBoostPrices) {
                        const prices = pkg.speedBoostPrices;
                        if (prices['1_day'] > 0) {
                            optionsText += `*${optionCounter}.* ${pkg.name} - 1 Hari (*${convertRupiah.convert(prices['1_day'])}*)\n`;
                            availableOptions.push({ index: optionCounter, package: pkg, durationKey: '1_day', price: prices['1_day'] });
                            optionCounter++;
                        }
                        if (prices['3_days'] > 0) {
                            optionsText += `*${optionCounter}.* ${pkg.name} - 3 Hari (*${convertRupiah.convert(prices['3_days'])}*)\n`;
                            availableOptions.push({ index: optionCounter, package: pkg, durationKey: '3_days', price: prices['3_days'] });
                            optionCounter++;
                        }
                        if (prices['7_days'] > 0) {
                            optionsText += `*${optionCounter}.* ${pkg.name} - 7 Hari (*${convertRupiah.convert(prices['7_days'])}*)\n`;
                            availableOptions.push({ index: optionCounter, package: pkg, durationKey: '7_days', price: prices['7_days'] });
                            optionCounter++;
                        }
                    }
                });

                if(availableOptions.length === 0) {
                    return reply("Maaf, sepertinya tidak ada durasi yang valid untuk paket Speed on Demand saat ini.");
                }

                optionsText += "\nBalas dengan *nomor* pilihan Anda (contoh: `1`). Atau ketik *batal*.";

                temp[sender] = {
                    step: 'ASK_SOD_CHOICE',
                    user: user,
                    options: availableOptions
                };

                return reply(optionsText);
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
        }
    } catch (err) {
        if (typeof err === "string") return reply(String(err));
        console.log(err)
    }
}

/**
 * Fungsi terpusat untuk membuat laporan gangguan dan mengirim notifikasi.
 * Dipanggil setelah percakapan dengan pelanggan selesai.
 * @param {string} pelangganId - JID pelanggan
 * @param {string} pelangganPushName - Nama pushname pelanggan
 * @param {object} userPelanggan - Objek data pelanggan dari global.users (database)
 * @param {string} laporanLengkap - Teks laporan yang sudah dikumpulkan
 * @param {function} reply - Fungsi untuk membalas pesan
 * @param {object} raf - Objek koneksi Baileys
 */
async function buatLaporanGangguan(pelangganId, pelangganPushName, userPelanggan, laporanLengkap, reply, raf) {
    const pelangganPlainNumber = pelangganId.split('@')[0];
    const ticketId = generateTicketId(7);

    const newReport = {
        ticketId,
        pelangganId,
        pelangganPushName,
        pelangganDataSystem: {
            id: userPelanggan.id,
            name: userPelanggan.name,
            address: userPelanggan.address,
            subscription: userPelanggan.subscription,
            pppoe_username: userPelanggan.pppoe_username
        },
        laporanText: laporanLengkap,
        status: "baru",
        createdAt: new Date().toISOString(),
        assignedTeknisiId: null,
        processingStartedAt: null,
        processedByTeknisiId: null,
        processedByTeknisiName: null,
        resolvedAt: null,
        resolvedByTeknisiId: null,
        resolvedByTeknisiName: null,
        cancellationReason: null,
        cancellationTimestamp: null,
        cancelledBy: null
    };

    global.reports.push(newReport);
    saveReportsToFile(global.reports);

    // Pesan konfirmasi ke pelanggan (menampilkan laporan lengkap hasil percakapan)
    const detailPelangganInfoUntukPelanggan = `*Nama Terdaftar:* ${userPelanggan.name || pelangganPushName}\n*Layanan/Paket:* ${userPelanggan.subscription || 'Tidak terinfo'}\n`;
    const pesanKonfirmasiKePelanggan = `✨ *Laporan Anda Telah Diterima* ✨\n\nHalo ${pelangganPushName},\n\nTerima kasih telah menghubungi Layanan ${global.config.nama || "Kami"}. Laporan Anda yang telah kami rangkum telah berhasil dicatat dan akan segera kami proses.\n\nBerikut adalah detail laporan Anda:\n-----------------------------------\n*Nomor Tiket Anda:* *${ticketId}*\n${detailPelangganInfoUntukPelanggan}*Isi Laporan (Lengkap):*\n"${laporanLengkap}"\n-----------------------------------\n\nMohon simpan Nomor Tiket di atas untuk kemudahan pengecekan status laporan Anda di kemudian hari. Tim teknisi kami akan segera meninjau dan menangani laporan Anda. Anda akan menerima notifikasi lebih lanjut mengenai perkembangan laporan ini.\n\nKami menghargai kesabaran Anda.\n\nHormat kami,\nTim ${global.config.namabot || "Bot Kami"}`;

    await reply(pesanKonfirmasiKePelanggan);

    // Persiapan dan pengiriman notifikasi ke teknisi
    const teknisiAccounts = global.accounts.filter(acc => acc.role === 'teknisi' && acc.phone_number && acc.phone_number.trim() !== "");
    const waktuLaporFormatted = new Date(newReport.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
    const linkWaPelanggan = `https://wa.me/${pelangganPlainNumber}`;

    let detailPelangganUntukNotifTeknisi = `Dari (WA): ${pelangganPushName} (${pelangganPlainNumber})`;
    detailPelangganUntukNotifTeknisi += `\nNama Terdaftar: ${userPelanggan.name || "N/A"}`;
    detailPelangganUntukNotifTeknisi += `\nAlamat: ${userPelanggan.address || "N/A"}`;
    detailPelangganUntukNotifTeknisi += `\nPaket: ${userPelanggan.subscription || "N/A"}`;
    if (userPelanggan.pppoe_username) {
        detailPelangganUntukNotifTeknisi += `\nPPPoE: ${userPelanggan.pppoe_username}`;
    }

    const messageToTeknisi = `🔔 *LAPORAN BARU MASUK - SEGERA TINDAKLANJUTI* 🔔\n\nLaporan baru telah diterima dan membutuhkan perhatian Anda.\n\n*Informasi Pelanggan:*\n${detailPelangganUntukNotifTeknisi}\n*Kontak Pelanggan (WhatsApp):* ${linkWaPelanggan}\n\n*Isi Laporan Lengkap:*\n${laporanLengkap}\n\n*Waktu Lapor:* ${waktuLaporFormatted}\n-----------------------------------\n*LANGKAH SELANJUTNYA UNTUK TEKNISI:*\n\n1.  *Hubungi Pelanggan & Tangani Laporan:*\n    - Segera hubungi pelanggan melalui link WhatsApp di atas untuk konfirmasi detail dan mulai penanganan masalah.\n\n2.  *Update Status ke "Diproses" (via Web - Opsional):*\n    - Buka halaman Manajemen Tiket Teknisi di web.\n    - Temukan laporan ini (berdasarkan info pelanggan/isi laporan) dan klik tombol "Proses Tiket". Ini akan mengubah statusnya dan menunjukkan bahwa Anda sedang menanganinya (ID Tiket akan terlihat di web).\n\n3.  *Selesaikan Laporan (Setelah Pekerjaan Selesai):*\n    - Setelah masalah pelanggan teratasi, mintalah *Nomor Tiket* kepada pelanggan (yang mereka terima saat awal melapor).\n    - *Via WhatsApp:* Kirim perintah: \`selesaikantiket NOMOR_TIKET_DARI_PELANGGAN\`\n    - *Via Web:* Pada halaman Manajemen Tiket, masukkan Nomor Tiket yang diberikan pelanggan pada form "Selesaikan Tiket".\n\nMohon segera ditangani. Terima kasih atas kerjasamanya.\nTim Layanan ${global.config.nama || "Kami"}`;

    if (teknisiAccounts.length > 0) {
        for (const teknisi of teknisiAccounts) {
            let teknisiJid = teknisi.phone_number.trim();
            if (!teknisiJid.endsWith('@s.whatsapp.net')) {
                if (teknisiJid.startsWith('0')) {
                    teknisiJid = `62${teknisiJid.substring(1)}@s.whatsapp.net`;
                } else if (teknisiJid.startsWith('62')) {
                    teknisiJid = `${teknisiJid}@s.whatsapp.net`;
                } else {
                    console.warn(`[LAPORAN_WARN] Nomor teknisi tidak valid untuk JID: ${teknisi.phone_number}`);
                    continue;
                }
            }
            try {
                await raf.sendMessage(teknisiJid, { text: messageToTeknisi });
                await sleep(1000);
            } catch (err) {
                console.error(`[LAPORAN_ERROR] Gagal mengirim laporan ke teknisi ${teknisi.username} (${teknisiJid}):`, err.message);
            }
        }
    } else {
        console.warn("[LAPORAN_WARN] Tidak ada akun teknisi yang memiliki nomor telepon terdaftar untuk menerima notifikasi.");
        if (Array.isArray(global.config.ownerNumber) && global.config.ownerNumber.length > 0) {
            const fallbackMessageToOwner = `⚠️ *PERHATIAN: LAPORAN BARU DITERIMA (ID: ${ticketId}) TAPI TIDAK ADA TEKNISI AKTIF*\n\nPelanggan: ${pelangganPushName} (${pelangganPlainNumber}) - ${linkWaPelanggan}\nLaporan:\n${laporanLengkap}\n\nWaktu: ${waktuLaporFormatted}\n\nMohon segera ditindaklanjuti manual. Teknisi akan meminta ID tiket ke pelanggan setelah penanganan selesai.`;
            for (const ownerNum of global.config.ownerNumber) {
                let ownerJid = String(ownerNum).trim();
                if (!ownerJid.endsWith('@s.whatsapp.net')) {
                    if (ownerJid.startsWith('0')) ownerJid = `62${ownerJid.substring(1)}@s.whatsapp.net`;
                    else if (ownerJid.startsWith('62')) ownerJid = `${ownerJid}@s.whatsapp.net`;
                    else {
                         console.warn(`[LAPORAN_WARN] Format nomor Owner tidak valid: ${ownerNum}`);
                         continue;
                    }
                }
                try {
                    await raf.sendMessage(ownerJid, { text: fallbackMessageToOwner });
                } catch (e) {
                    console.error(`[LAPORAN_ERROR] Gagal mengirim fallback laporan ke owner ${ownerJid}:`, e.message);
                }
            }
        }
    }
}

/**
 * Fungsi terpusat untuk memproses pembelian voucher.
 * @param {string} sender - JID pengirim
 * @param {string} pushname - Nama pushname pengirim
 * @param {string} price - Harga voucher yang akan dibeli
 * @param {function} replyFunc - Fungsi untuk membalas pesan
 */
async function processVoucherPurchase(sender, pushname, price, replyFunc) {
    // Cek apakah harga voucher terdaftar
    if (!checkhargavoucher(price)) {
        await replyFunc(`Harga Voucher Rp ${price} Tidak Terdaftar. Silahkan Periksa Lagi.\n\nTerima Kasih`);
        return;
    }

    const profvc123 = checkprofvc(price);
    const durasivc123 = checkdurasivc(profvc123);
    const hargavc123 = checkhargavc(profvc123);

    // Cek saldo pengguna
    if (checkATMuser(sender) < hargavc123) {
        await replyFunc(`Saldo Anda tidak mencukupi untuk melakukan pembelian voucher seharga ${convertRupiah.convert(hargavc123)}. Silakan top up saldo terlebih dahulu.`);
        return;
    }

    try {
        await replyFunc("⏳ Sedang memproses pembelian voucher Anda, mohon tunggu sebentar...");

        const voucherData = await getvoucher(profvc123, sender);
        const voucherCode = `${voucherData.username}`;

        // Konfirmasi pengurangan saldo
        confirmATM(sender, hargavc123);
        const currentSaldoAfterPurchase = checkATMuser(sender);
        const formattedSaldoAfterPurchase = convertRupiah.convert(currentSaldoAfterPurchase);

        // Pesan sukses
        await replyFunc(`🎉 *Hore! Voucher Berhasil Dibeli!* 🎉\n\n=============================\n*Paket:* ${durasivc123}\n\n*Kode Voucher:* \`${voucherCode}\`\n\n*Sisa Saldo:* ${formattedSaldoAfterPurchase}\n=============================\nTerimakasih Atas Pembelian Anda\n\n${global.config.nama}!`);

    } catch (err) {
        console.error("[processVoucherPurchase_ERROR]", err);
        let userFriendlyErrorMessage = "Terjadi kesalahan saat membuat voucher. ";
        if (err.message) {
            if (err.message.includes("Kesalahan Koneksi Mikrotik")) {
                userFriendlyErrorMessage += "Bot gagal terhubung ke Mikrotik. Mohon laporkan ke Admin.";
            } else if (err.message.includes("Profil Hotspot yang dimasukkan salah atau tidak ditemukan")) {
                userFriendlyErrorMessage += "Profil voucher yang Anda pilih tidak valid. Mohon hubungi Admin.";
            } else if (err.message.includes("Voucher dengan username ini") || err.message.includes("already have user with this name")) {
                userFriendlyErrorMessage += "Terjadi duplikasi username saat membuat voucher. Mohon coba lagi atau hubungi Admin.";
            } else if (err.message.includes("data username/password tidak ditemukan")) {
                 userFriendlyErrorMessage += "Voucher berhasil dibuat, namun bot gagal mendapatkan username/passwordnya. Mohon laporkan ke Admin.";
            } else {
                userFriendlyErrorMessage += `Detail: ${err.message || 'Error tidak diketahui'}. Mohon coba lagi atau hubungi Admin.`;
            }
        }
        await replyFunc(`🚫 *PEMBELIAN VOUCHER GAGAL* 🚫\n=============================\n${userFriendlyErrorMessage}\n=============================\n_Mohon coba lagi nanti atau hubungi tim support kami._`);
    }
}
