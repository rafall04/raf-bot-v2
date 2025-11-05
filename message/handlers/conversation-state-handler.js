/**
 * Conversation State Handler
 * Handles all multi-step conversation flows using temp state management
 * 
 * CRITICAL: This handler manages complex state machines for various features.
 * DO NOT modify without understanding the complete flow of each state.
 */

const axios = require('axios');
const convertRupiah = require('rupiah-format');

// Import all state sub-handlers
const {
    handleSelectChangeMode,
    handleSelectSsidToChange,
    handleAskNewName,
    handleAskNewNameBulkAuto,
    handleConfirmGantiNamaBulk
} = require('./states/wifi-name-state-handler');

const {
    handleSelectPasswordMode,
    handleSelectSsidPassword,
    handleAskNewPassword,
    handleAskNewPasswordBulk,
    handleAskNewPasswordBulkAuto,
    handleConfirmGantiSandi,
    handleConfirmGantiSandiBulk
} = require('./states/wifi-password-state-handler');

const {
    handleLaporGangguanDescription,
    handleLaporGangguanAskReboot,
    handleLaporGangguanAskLos,
    handleLaporGangguanAskLampu,
    handleLaporGangguanDetailTambahan,
    handleLaporGangguanConfirm
} = require('./states/report-state-handler');

const {
    handleConfirmCancelTicket,
    handleConfirmReboot,
    handleAskPowerLevel,
    handleConfirmGantiPower,
    handleSelectSodChoice,
    handleConfirmSodChoice,
    handleAskPackageChoice,
    handleConfirmPackageChoice
} = require('./states/other-state-handler');

/**
 * Main handler for conversation state management
 * @param {Object} params - Parameters object
 * @returns {Promise<void>}
 */
async function handleConversationState(params) {
    const {
        sender,
        chats,
        temp,
        reply,
        global,
        isOwner,
        isTeknisi,
        users,
        args,
        entities,
        plainSenderNumber,
        pushname,
        mess,
        sleep,
        getSSIDInfo,
        namabot,
        buatLaporanGangguan
    } = params;

    // Get user state from temp
    const userState = temp[sender];
    const userReply = chats.toLowerCase().trim();

    // Universal cancel commands
    if (['batal', 'cancel', 'ga jadi', 'gak jadi'].includes(userReply)) {
        delete temp[sender];
        return reply("Baik, permintaan sebelumnya telah dibatalkan. Ada lagi yang bisa saya bantu?");
    }

    // Handle based on stored step
    switch (userState.step) {
        // ========== WiFi Name Change States ==========
        case 'SELECT_CHANGE_MODE_FIRST':
        case 'SELECT_CHANGE_MODE': {
            return handleSelectChangeMode(userState, userReply, reply);
        }

        case 'SELECT_SSID_TO_CHANGE': {
            return handleSelectSsidToChange(userState, userReply, reply);
        }

        case 'ASK_NEW_NAME_FOR_SINGLE': // Single SSID without bulk
        case 'ASK_NEW_NAME_FOR_SINGLE_BULK': // Single from bulk selection
        case 'ASK_NEW_NAME_FOR_BULK': { // All SSIDs in bulk
            return handleAskNewName(userState, chats, reply, sender, temp, global);
        }

        case 'ASK_NEW_NAME_FOR_BULK_AUTO': {
            return handleAskNewNameBulkAuto(userState, chats, reply, sender, temp, global, axios);
        }

        case 'CONFIRM_GANTI_NAMA':
        case 'CONFIRM_GANTI_NAMA_BULK': {
            const { handleConfirmGantiNamaBulk } = require('./states/wifi-name-state-handler');
            return handleConfirmGantiNamaBulk(userState, userReply, reply, sender, temp, global, axios);
        }

        // ========== WiFi Password Change States ==========
        case 'SELECT_CHANGE_PASSWORD_MODE':
        case 'SELECT_CHANGE_PASSWORD_MODE_FIRST': {
            return handleSelectPasswordMode(userState, userReply, reply, sender, temp);
        }

        case 'SELECT_SSID_PASSWORD':
        case 'SELECT_SSID_PASSWORD_FIRST': {
            return handleSelectSsidPassword(userState, userReply, reply, sender, temp);
        }

        case 'ASK_NEW_PASSWORD': {
            return handleAskNewPassword(userState, chats, reply, sender, temp, global);
        }

        case 'ASK_NEW_PASSWORD_BULK': {
            return handleAskNewPasswordBulk(userState, chats, reply, sender, temp, global);
        }

        case 'ASK_NEW_PASSWORD_BULK_AUTO': {
            return handleAskNewPasswordBulkAuto(userState, chats, reply, sender, temp, global, axios);
        }

        case 'CONFIRM_GANTI_SANDI': {
            const { handleConfirmGantiSandi } = require('./states/wifi-password-state-handler');
            return handleConfirmGantiSandi(userState, userReply, reply, sender, temp, global, axios);
        }

        case 'CONFIRM_GANTI_SANDI_BULK': {
            const { handleConfirmGantiSandiBulk } = require('./states/wifi-password-state-handler');
            return handleConfirmGantiSandiBulk(userState, userReply, reply, sender, temp, global, axios);
        }

        // ========== Report/Laporan States ==========
        case 'LAPOR_GANGGUAN_AWAITING_DESCRIPTION': {
            return handleLaporGangguanDescription(userState, chats, reply);
        }

        case 'LAPOR_GANGGUAN_ASK_REBOOT': {
            return handleLaporGangguanAskReboot(userState, userReply, reply);
        }

        case 'LAPOR_GANGGUAN_ASK_LOS': {
            return handleLaporGangguanAskLos(userState, userReply, reply);
        }

        case 'LAPOR_GANGGUAN_ASK_LAMPU_DETAIL': {
            return handleLaporGangguanAskLampu(userState, chats, reply);
        }

        case 'LAPOR_GANGGUAN_ASK_DETAIL_TAMBAHAN': {
            return handleLaporGangguanDetailTambahan(userState, chats, reply);
        }

        case 'LAPOR_GANGGUAN_CONFIRM': {
            return handleLaporGangguanConfirm(userState, userReply, reply, sender, temp, global, plainSenderNumber, pushname);
        }

        // ========== Other Confirmation States ==========
        case 'CONFIRM_CANCEL_TICKET': {
            return handleConfirmCancelTicket(userState, userReply, reply, sender, temp, global, pushname);
        }

        case 'CONFIRM_REBOOT': {
            return handleConfirmReboot(userState, userReply, reply, sender, temp, global, axios);
        }

        case 'ASK_POWER_LEVEL': {
            return handleAskPowerLevel(userState, chats, reply);
        }

        // CONFIRM_GANTI_POWER removed - power changes execute directly

        case 'SELECT_SOD_CHOICE': {
            return handleSelectSodChoice(userState, userReply, reply, convertRupiah);
        }

        case 'CONFIRM_SOD_CHOICE': {
            return handleConfirmSodChoice(userState, userReply, reply, sender, temp, global);
        }

        case 'ASK_PACKAGE_CHOICE': {
            return handleAskPackageChoice(userState, userReply, reply, convertRupiah);
        }

        case 'CONFIRM_PACKAGE_CHOICE': {
            return handleConfirmPackageChoice(userState, userReply, reply, sender, temp, global);
        }

        default:
            console.log(`[CONVERSATION_STATE] Unknown step: ${userState.step}`);
            delete temp[sender];
            return reply("Maaf, terjadi kesalahan dalam proses. Silakan coba lagi dari awal.");
    }
}

module.exports = {
    handleConversationState
};
