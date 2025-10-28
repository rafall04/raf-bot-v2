/**
 * Agent Self-Service Handler
 * Handle agent profile updates and self-management
 */

const agentManager = require('../../lib/agent-manager');
const agentTransactionManager = require('../../lib/agent-transaction-manager');
const logger = require('../../lib/logger');

/**
 * Handle agent PIN change
 */
async function handleAgentPinChange(msg, sender, reply, args) {
    try {
        // Get agent by WhatsApp number
        const agentCred = agentTransactionManager.getAgentByWhatsapp(sender);
        
        if (!agentCred) {
            return reply('❌ Anda bukan agent terdaftar atau belum memiliki credential.\n\nHubungi admin untuk registrasi.');
        }
        
        // Parse arguments: ganti pin [old] [new]
        const oldPin = args[2]; // Skip "ganti" and "pin"
        const newPin = args[3];
        
        if (!oldPin || !newPin) {
            return reply('⚠️ *Format salah!*\n\n' +
                        'Format yang benar:\n' +
                        '`ganti pin [PIN_LAMA] [PIN_BARU]`\n\n' +
                        'Contoh:\n' +
                        '`ganti pin 1234 5678`\n\n' +
                        'PIN minimal 4 digit');
        }
        
        if (newPin.length < 4) {
            return reply('❌ PIN baru minimal 4 digit!');
        }
        
        if (oldPin === newPin) {
            return reply('❌ PIN baru harus berbeda dengan PIN lama!');
        }
        
        // Update PIN
        const result = await agentTransactionManager.updateAgentPin(
            agentCred.agentId,
            sender,
            oldPin,
            newPin
        );
        
        if (result.success) {
            reply('✅ *PIN BERHASIL DIUBAH!*\n\n' +
                  '🔐 PIN baru Anda telah aktif\n' +
                  '⚠️ Gunakan PIN baru untuk konfirmasi transaksi berikutnya\n\n' +
                  '_Jangan bagikan PIN Anda ke siapapun!_');
            
            logger.info('Agent PIN changed successfully', {
                agentId: agentCred.agentId,
                whatsapp: sender
            });
        } else {
            reply(`❌ *GAGAL UBAH PIN*\n\n${result.message}\n\n` +
                  'Pastikan PIN lama Anda benar.');
        }
        
    } catch (error) {
        logger.error('Error handling agent PIN change', {
            error: error.message,
            sender: sender
        });
        
        reply('❌ Terjadi kesalahan saat mengubah PIN.\n\nSilakan coba lagi atau hubungi admin.');
    }
}

/**
 * Handle agent profile update
 */
async function handleAgentProfileUpdate(msg, sender, reply, args, updateType) {
    try {
        // Get agent by WhatsApp number
        const agentCred = agentTransactionManager.getAgentByWhatsapp(sender);
        
        if (!agentCred) {
            return reply('❌ Anda bukan agent terdaftar.\n\nHubungi admin untuk registrasi.');
        }
        
        // Get full agent data
        const agent = agentManager.getAgentById(agentCred.agentId);
        
        if (!agent) {
            return reply('❌ Data agent tidak ditemukan.\n\nHubungi admin.');
        }
        
        // Handle different update types
        let updateData = {};
        let successMessage = '';
        
        switch (updateType) {
            case 'address':
                // Format: update alamat [alamat baru]
                const newAddress = args.slice(2).join(' '); // Skip "update" and "alamat"
                
                if (!newAddress || newAddress.length < 10) {
                    return reply('⚠️ *Format salah!*\n\n' +
                                'Format: `update alamat [alamat lengkap]`\n\n' +
                                'Contoh:\n' +
                                '`update alamat Jl. Raya Tanjung No. 123, RT 01/02`\n\n' +
                                'Alamat minimal 10 karakter');
                }
                
                updateData.address = newAddress;
                successMessage = `✅ *ALAMAT BERHASIL DIUBAH!*\n\n📍 Alamat baru:\n${newAddress}\n\n_Alamat akan tampil di list agent untuk customer_`;
                break;
                
            case 'hours':
                // Format: update jam [08:00]-[21:00] or [08:00] - [21:00]
                const hoursText = args.slice(2).join(' ');
                const hoursMatch = hoursText.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
                
                if (!hoursMatch) {
                    return reply('⚠️ *Format salah!*\n\n' +
                                'Format: `update jam [BUKA]-[TUTUP]`\n\n' +
                                'Contoh:\n' +
                                '`update jam 08:00-21:00`\n' +
                                '`update jam 09:00 - 20:00`\n\n' +
                                'Format waktu: HH:MM (24 jam)');
                }
                
                const openTime = hoursMatch[1];
                const closeTime = hoursMatch[2];
                updateData.operational_hours = `${openTime} - ${closeTime}`;
                successMessage = `✅ *JAM OPERASIONAL BERHASIL DIUBAH!*\n\n🕐 Jam baru:\n${openTime} - ${closeTime}\n\n_Jam operasional akan tampil di list agent_`;
                break;
                
            case 'phone':
                // Format: update phone [nomor]
                const newPhone = args[2];
                
                if (!newPhone || !/^(0|62|628)\d{8,12}$/.test(newPhone.replace(/\D/g, ''))) {
                    return reply('⚠️ *Format salah!*\n\n' +
                                'Format: `update phone [nomor]`\n\n' +
                                'Contoh:\n' +
                                '`update phone 085233047094`\n' +
                                '`update phone 6285233047094`\n\n' +
                                'Nomor minimal 10 digit');
                }
                
                updateData.phone = newPhone;
                successMessage = `✅ *NOMOR TELEPON BERHASIL DIUBAH!*\n\n📱 Nomor baru:\n${newPhone}\n\n_Nomor akan tampil di list agent untuk customer_`;
                break;
                
            default:
                return reply('❌ Tipe update tidak valid');
        }
        
        // Update agent data
        const result = agentManager.updateAgent(agent.id, updateData);
        
        if (result.success) {
            reply(successMessage);
            
            logger.info('Agent profile updated', {
                agentId: agent.id,
                updateType: updateType,
                updatedBy: sender
            });
        } else {
            reply(`❌ *GAGAL UPDATE PROFIL*\n\n${result.message}`);
        }
        
    } catch (error) {
        logger.error('Error updating agent profile', {
            error: error.message,
            sender: sender,
            updateType: updateType
        });
        
        reply('❌ Terjadi kesalahan saat update profil.\n\nSilakan coba lagi atau hubungi admin.');
    }
}

/**
 * Handle agent status toggle
 */
async function handleAgentStatusToggle(msg, sender, reply, status) {
    try {
        // Get agent by WhatsApp number
        const agentCred = agentTransactionManager.getAgentByWhatsapp(sender);
        
        if (!agentCred) {
            return reply('❌ Anda bukan agent terdaftar.\n\nHubungi admin untuk registrasi.');
        }
        
        // Get full agent data
        const agent = agentManager.getAgentById(agentCred.agentId);
        
        if (!agent) {
            return reply('❌ Data agent tidak ditemukan.\n\nHubungi admin.');
        }
        
        const newStatus = (status === 'open');
        
        // Update agent status
        const result = agentManager.updateAgent(agent.id, {
            active: newStatus
        });
        
        if (result.success) {
            if (newStatus) {
                reply('✅ *OUTLET DIBUKA*\n\n' +
                      '🟢 Status: *BUKA*\n\n' +
                      'Outlet Anda sekarang muncul di list agent untuk customer.\n\n' +
                      '_Ketik "tutup sementara" untuk menonaktifkan_');
            } else {
                reply('✅ *OUTLET DITUTUP SEMENTARA*\n\n' +
                      '🔴 Status: *TUTUP*\n\n' +
                      'Outlet Anda tidak akan muncul di list agent untuk customer.\n\n' +
                      '_Ketik "buka kembali" untuk mengaktifkan kembali_');
            }
            
            logger.info('Agent status toggled', {
                agentId: agent.id,
                newStatus: newStatus ? 'open' : 'closed',
                changedBy: sender
            });
        } else {
            reply(`❌ *GAGAL UPDATE STATUS*\n\n${result.message}`);
        }
        
    } catch (error) {
        logger.error('Error toggling agent status', {
            error: error.message,
            sender: sender
        });
        
        reply('❌ Terjadi kesalahan saat update status.\n\nSilakan coba lagi atau hubungi admin.');
    }
}

/**
 * Handle agent info/profile view
 */
async function handleAgentInfo(msg, sender, reply) {
    try {
        // Get agent by WhatsApp number
        const agentCred = agentTransactionManager.getAgentByWhatsapp(sender);
        
        if (!agentCred) {
            return reply('❌ Anda bukan agent terdaftar.\n\nHubungi admin untuk registrasi.');
        }
        
        // Get full agent data
        const agent = agentManager.getAgentById(agentCred.agentId);
        
        if (!agent) {
            return reply('❌ Data agent tidak ditemukan.\n\nHubungi admin.');
        }
        
        // Get transaction statistics
        const stats = agentTransactionManager.getAgentStatistics(agent.id, 'month');
        
        let message = `👤 *PROFIL AGENT*\n\n`;
        message += `📋 *DATA OUTLET:*\n`;
        message += `• Nama: ${agent.name}\n`;
        message += `• ID: ${agent.id}\n`;
        message += `• Area: ${agent.area}\n`;
        message += `• Status: ${agent.active ? '🟢 BUKA' : '🔴 TUTUP'}\n\n`;
        
        message += `📍 *INFORMASI KONTAK:*\n`;
        message += `• Alamat: ${agent.address}\n`;
        message += `• Telepon: ${agent.phone}\n`;
        message += `• WhatsApp: ${agentCred.whatsappNumber}\n\n`;
        
        message += `🕐 *JAM OPERASIONAL:*\n`;
        message += `${agent.operational_hours}\n\n`;
        
        message += `💼 *LAYANAN:*\n`;
        if (agent.services && agent.services.length > 0) {
            agent.services.forEach(service => {
                message += `• ${service.charAt(0).toUpperCase() + service.slice(1)}\n`;
            });
        } else {
            message += `Belum ada layanan terdaftar\n`;
        }
        message += `\n`;
        
        message += `📊 *STATISTIK BULAN INI:*\n`;
        message += `• Total Transaksi: ${stats.total}\n`;
        message += `• Completed: ${stats.completed}\n`;
        message += `• Pending: ${stats.pending}\n`;
        message += `• Total Amount: Rp ${stats.totalAmount.toLocaleString('id-ID')}\n\n`;
        
        message += `🔐 *SECURITY:*\n`;
        message += `• PIN: ✅ Terdaftar\n`;
        message += `• Last Login: ${agentCred.lastLogin ? new Date(agentCred.lastLogin).toLocaleString('id-ID') : 'Belum pernah'}\n\n`;
        
        message += `💡 *COMMAND TERSEDIA:*\n`;
        message += `• \`ganti pin [lama] [baru]\`\n`;
        message += `• \`update alamat [alamat]\`\n`;
        message += `• \`update jam [buka]-[tutup]\`\n`;
        message += `• \`tutup sementara\`\n`;
        message += `• \`buka kembali\`\n`;
        message += `• \`transaksi hari ini\`\n`;
        message += `• \`konfirmasi [ID] [PIN]\``;
        
        reply(message);
        
    } catch (error) {
        logger.error('Error getting agent info', {
            error: error.message,
            sender: sender
        });
        
        reply('❌ Terjadi kesalahan saat mengambil data.\n\nSilakan coba lagi atau hubungi admin.');
    }
}

module.exports = {
    handleAgentPinChange,
    handleAgentProfileUpdate,
    handleAgentStatusToggle,
    handleAgentInfo
};
