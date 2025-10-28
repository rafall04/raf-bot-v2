"use strict";

/**
 * Agent Handler
 * Handles agent/outlet related commands via WhatsApp
 */

const agentManager = require('../../lib/agent-manager');
const { logger } = require('../../lib/logger');

/**
 * Handle list agents command
 * Shows all available agents/outlets
 */
async function handleListAgents(msg, sender, reply, pushname) {
    try {
        const agents = agentManager.getAllAgents(true);
        
        if (agents.length === 0) {
            return await reply('❌ Maaf, belum ada agent yang terdaftar.');
        }
        
        const message = agentManager.formatAgentList(agents, 'DAFTAR AGENT RAF NET');
        await reply(message);
        
    } catch (error) {
        logger.error('Error in handleListAgents:', error);
        await reply('❌ Terjadi kesalahan saat mengambil data agent.');
    }
}

/**
 * Handle agent by area
 * Shows agents in specific area
 */
async function handleAgentByArea(msg, sender, reply, area) {
    try {
        if (!area || area.trim() === '') {
            // Show all areas
            const agents = agentManager.getAllAgents(true);
            const areas = [...new Set(agents.map(a => a.area))].filter(Boolean);
            
            let message = `📍 *PILIH AREA AGENT*\n\n`;
            message += `Ketik: *agent [nama area]*\n\n`;
            message += `Area yang tersedia:\n`;
            areas.forEach(a => {
                const count = agents.filter(ag => ag.area === a).length;
                message += `• ${a} (${count} agent)\n`;
            });
            message += `\nContoh: *agent tanjung*`;
            
            return await reply(message);
        }
        
        const agents = agentManager.getAgentsByArea(area);
        
        if (agents.length === 0) {
            return await reply(`❌ Tidak ada agent di area "${area}".\n\nKetik *agent* untuk melihat semua area.`);
        }
        
        const message = agentManager.formatAgentList(agents, `AGENT DI AREA ${area.toUpperCase()}`);
        await reply(message);
        
    } catch (error) {
        logger.error('Error in handleAgentByArea:', error);
        await reply('❌ Terjadi kesalahan saat mengambil data agent.');
    }
}

/**
 * Handle agent services
 * Shows what services are available at agents
 */
async function handleAgentServices(msg, sender, reply) {
    try {
        let message = `🛍️ *LAYANAN AGENT RAF NET*\n\n`;
        
        // Get agents by service
        const topupAgents = agentManager.getAgentsByService('topup');
        const voucherAgents = agentManager.getAgentsByService('voucher');
        const paymentAgents = agentManager.getAgentsByService('pembayaran');
        
        message += `💰 *Topup Saldo* (${topupAgents.length} agent)\n`;
        message += `   Anda bisa topup saldo langsung di agent\n\n`;
        
        message += `🎫 *Beli Voucher* (${voucherAgents.length} agent)\n`;
        message += `   Tersedia voucher WiFi berbagai paket\n\n`;
        
        message += `💳 *Pembayaran* (${paymentAgents.length} agent)\n`;
        message += `   Bayar tagihan internet bulanan\n\n`;
        
        message += `📱 Ketik *agent* untuk melihat daftar lengkap\n`;
        message += `📍 Ketik *agent [area]* untuk agent di area tertentu`;
        
        await reply(message);
        
    } catch (error) {
        logger.error('Error in handleAgentServices:', error);
        await reply('❌ Terjadi kesalahan saat mengambil data layanan.');
    }
}

/**
 * Handle agent info
 * Shows detailed info about specific agent
 */
async function handleAgentInfo(msg, sender, reply, agentId) {
    try {
        const agent = agentManager.getAgentById(agentId);
        
        if (!agent) {
            return await reply('❌ Agent tidak ditemukan.');
        }
        
        let message = `📋 *INFORMASI AGENT*\n\n`;
        message += agentManager.formatAgentInfo(agent, true);
        
        // Add Google Maps link if location available
        if (agent.location) {
            message += `\n\n📍 *Lokasi di Google Maps:*\n`;
            message += `https://maps.google.com/?q=${agent.location.lat},${agent.location.lng}`;
        }
        
        message += `\n\n💬 Hubungi via WhatsApp:\n`;
        message += `wa.me/${agent.phone.replace(/[^0-9]/g, '')}`;
        
        await reply(message);
        
    } catch (error) {
        logger.error('Error in handleAgentInfo:', error);
        await reply('❌ Terjadi kesalahan saat mengambil info agent.');
    }
}

/**
 * Handle search agent
 * Search agents by name, area, or address
 */
async function handleSearchAgent(msg, sender, reply, query) {
    try {
        if (!query || query.trim() === '') {
            return await reply('❌ Masukkan kata kunci pencarian.\n\nContoh: *cari agent tanjung*');
        }
        
        const agents = agentManager.searchAgents(query);
        
        if (agents.length === 0) {
            return await reply(`❌ Tidak ada agent yang cocok dengan "${query}".\n\nCoba kata kunci lain atau ketik *agent* untuk melihat semua.`);
        }
        
        const message = agentManager.formatAgentList(agents, `HASIL PENCARIAN: ${query.toUpperCase()}`);
        await reply(message);
        
    } catch (error) {
        logger.error('Error in handleSearchAgent:', error);
        await reply('❌ Terjadi kesalahan saat mencari agent.');
    }
}

module.exports = {
    handleListAgents,
    handleAgentByArea,
    handleAgentServices,
    handleAgentInfo,
    handleSearchAgent
};
