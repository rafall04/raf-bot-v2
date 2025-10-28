"use strict";

/**
 * Agent Manager
 * Manages agent/outlet data for topup and voucher sales
 */

const fs = require('fs');
const path = require('path');

// Database paths
const AGENTS_DB = path.join(__dirname, '../database/agents.json');

// Load data
let agents = [];

// Initialize database
function initDatabase() {
    try {
        // Load agents
        if (fs.existsSync(AGENTS_DB)) {
            agents = JSON.parse(fs.readFileSync(AGENTS_DB, 'utf8'));
        } else {
            fs.writeFileSync(AGENTS_DB, '[]');
        }
    } catch (error) {
        console.error('Error initializing agent database:', error);
    }
}

// Save agents
function saveAgents() {
    fs.writeFileSync(AGENTS_DB, JSON.stringify(agents, null, 2));
}

// Get all agents
function getAllAgents(activeOnly = true) {
    if (activeOnly) {
        return agents.filter(a => a.active);
    }
    return agents;
}

// Get agents by area
function getAgentsByArea(area) {
    return agents.filter(a => 
        a.active && 
        a.area && 
        a.area.toLowerCase().includes(area.toLowerCase())
    );
}

// Get agent by ID
function getAgentById(agentId) {
    return agents.find(a => a.id === agentId);
}

// Get agents by service
function getAgentsByService(service) {
    return agents.filter(a => 
        a.active && 
        a.services && 
        a.services.includes(service)
    );
}

// Add new agent
function addAgent(agentData) {
    const newAgent = {
        id: `AGT${Date.now().toString().slice(-6)}`,
        name: agentData.name,
        phone: agentData.phone,
        address: agentData.address,
        area: agentData.area,
        services: agentData.services || ['topup', 'voucher'],
        operational_hours: agentData.operational_hours || '08:00 - 20:00',
        location: agentData.location || null,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    
    agents.push(newAgent);
    saveAgents();
    return newAgent;
}

// Update agent
function updateAgent(agentId, updates) {
    const index = agents.findIndex(a => a.id === agentId);
    if (index === -1) {
        return {
            success: false,
            message: 'Agent not found'
        };
    }
    
    agents[index] = {
        ...agents[index],
        ...updates,
        updated_at: new Date().toISOString()
    };
    
    saveAgents();
    return {
        success: true,
        agent: agents[index]
    };
}

// Delete/deactivate agent
function deactivateAgent(agentId) {
    const index = agents.findIndex(a => a.id === agentId);
    if (index === -1) return false;
    
    agents[index].active = false;
    agents[index].updated_at = new Date().toISOString();
    
    saveAgents();
    return true;
}

// Format agent info for WhatsApp
function formatAgentInfo(agent, includeServices = true) {
    let info = `📍 *${agent.name}*\n`;
    info += `📱 Telp: ${agent.phone}\n`;
    info += `🏠 Alamat: ${agent.address}\n`;
    info += `🌍 Area: ${agent.area}\n`;
    info += `⏰ Jam Buka: ${agent.operational_hours}`;
    
    if (includeServices && agent.services) {
        info += `\n📦 Layanan: ${agent.services.map(s => {
            switch(s) {
                case 'topup': return 'Topup Saldo';
                case 'voucher': return 'Jual Voucher';
                case 'pembayaran': return 'Terima Pembayaran';
                default: return s;
            }
        }).join(', ')}`;
    }
    
    return info;
}

// Format agent list for WhatsApp
function formatAgentList(agentList, title = 'DAFTAR AGENT') {
    if (!agentList || agentList.length === 0) {
        return '❌ Tidak ada agent yang tersedia di area ini.';
    }
    
    let message = `📋 *${title}*\n`;
    message += `_Total: ${agentList.length} agent_\n\n`;
    
    agentList.forEach((agent, index) => {
        message += `${index + 1}. ${formatAgentInfo(agent)}\n\n`;
    });
    
    message += `💡 _Tips: Hubungi agent terdekat untuk topup saldo atau beli voucher_`;
    
    return message;
}

// Get nearest agents (simple distance calculation)
function getNearestAgents(lat, lng, limit = 3) {
    const agentsWithDistance = agents
        .filter(a => a.active && a.location)
        .map(agent => {
            // Simple distance calculation (not accurate for large distances)
            const distance = Math.sqrt(
                Math.pow(agent.location.lat - lat, 2) + 
                Math.pow(agent.location.lng - lng, 2)
            );
            return { ...agent, distance };
        })
        .sort((a, b) => a.distance - b.distance);
    
    return agentsWithDistance.slice(0, limit);
}

// Search agents
function searchAgents(query) {
    const lowerQuery = query.toLowerCase();
    return agents.filter(a => 
        a.active && (
            a.name.toLowerCase().includes(lowerQuery) ||
            a.area.toLowerCase().includes(lowerQuery) ||
            a.address.toLowerCase().includes(lowerQuery)
        )
    );
}

// Get statistics
function getAgentStatistics() {
    const total = agents.length;
    const active = agents.filter(a => a.active).length;
    const byArea = {};
    const byService = {};
    
    agents.forEach(agent => {
        if (agent.active) {
            // Count by area
            if (agent.area) {
                byArea[agent.area] = (byArea[agent.area] || 0) + 1;
            }
            
            // Count by service
            if (agent.services) {
                agent.services.forEach(service => {
                    byService[service] = (byService[service] || 0) + 1;
                });
            }
        }
    });
    
    return {
        total,
        active,
        inactive: total - active,
        byArea,
        byService
    };
}

// Get agent by WhatsApp number (for agent confirmation)
function getAgentByWhatsapp(whatsappNumber) {
    // Import agent transaction manager for credentials lookup
    const agentTransactionManager = require('./agent-transaction-manager');
    
    // Get credentials from agent transaction manager
    const credentials = agentTransactionManager.getAgentByWhatsapp(whatsappNumber);
    
    if (!credentials) {
        return null;
    }
    
    // Get full agent data
    const agent = getAgentById(credentials.agentId);
    
    if (!agent) {
        return null;
    }
    
    // Return agent with credential info
    return {
        ...agent,
        whatsappNumber: credentials.whatsappNumber,
        isRegistered: true,
        lastLogin: credentials.lastLogin
    };
}

// Check if agent is registered
function isAgentRegistered(agentId) {
    const agentTransactionManager = require('./agent-transaction-manager');
    const allCredentials = agentTransactionManager.getAllCredentials?.() || [];
    return allCredentials.some(c => c.agentId === agentId && c.active);
}

// Format agent list for selection (numbered list)
function formatAgentForSelection(agentList) {
    if (!agentList || agentList.length === 0) {
        return null;
    }
    
    let message = `📍 *PILIH AGENT*\n\n`;
    message += `Silakan pilih agent terdekat:\n\n`;
    
    agentList.forEach((agent, index) => {
        const icon = index === 0 ? '⭐' : '📍';
        
        message += `${index + 1}. ${icon} *${agent.name}*\n`;
        message += `   📍 ${agent.area}\n`;
        message += `   📱 ${agent.phone}\n`;
        message += `   🏠 ${agent.address}\n`;
        message += `   ⏰ ${agent.operational_hours}\n`;
        
        // Add operational status
        const status = checkAgentOperationalStatus(agent);
        message += `   ${status.isOpen ? '🟢 Buka sekarang' : '🔴 Tutup sekarang'}\n`;
        
        // Add Google Maps link if location available
        if (agent.location) {
            message += `   🗺️ Google Maps\n`;
        }
        
        message += `\n`;
    });
    
    message += `Balas dengan nomor agent pilihan Anda (1-${agentList.length})\n`;
    message += `Ketik *batal* untuk membatalkan`;
    
    return message;
}

// Check if agent is currently open
function checkAgentOperationalStatus(agent) {
    if (!agent.operational_hours) {
        return { isOpen: true, reason: 'No hours specified' };
    }
    
    try {
        // Parse operational hours (format: "08:00 - 20:00")
        const [start, end] = agent.operational_hours.split('-').map(t => t.trim());
        const [startHour, startMin] = start.split(':').map(Number);
        const [endHour, endMin] = end.split(':').map(Number);
        
        // Get current time
        const now = new Date();
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const currentTime = currentHour * 60 + currentMin;
        
        // Calculate start and end in minutes
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        
        const isOpen = currentTime >= startTime && currentTime <= endTime;
        
        return {
            isOpen,
            reason: isOpen ? 'Within operational hours' : 'Outside operational hours',
            openTime: start,
            closeTime: end
        };
    } catch (error) {
        // If parsing fails, assume open
        return { isOpen: true, reason: 'Parse error, assume open' };
    }
}

// Get all unique areas
function getAllAreas() {
    const areas = new Set();
    agents.forEach(agent => {
        if (agent.active && agent.area) {
            areas.add(agent.area);
        }
    });
    return Array.from(areas).sort();
}

// Get agent count by area
function getAgentCountByArea(area) {
    return agents.filter(a => 
        a.active && 
        a.area && 
        a.area.toLowerCase() === area.toLowerCase()
    ).length;
}

// Initialize on load
initDatabase();

module.exports = {
    // Agent management
    getAllAgents,
    getAgentsByArea,
    getAgentById,
    getAgentsByService,
    addAgent,
    updateAgent,
    deactivateAgent,
    
    // Search and filter
    searchAgents,
    getNearestAgents,
    getAllAreas,
    getAgentCountByArea,
    
    // Formatting
    formatAgentInfo,
    formatAgentList,
    formatAgentForSelection,
    
    // Agent credentials (for transaction system)
    getAgentByWhatsapp,
    isAgentRegistered,
    
    // Operational status
    checkAgentOperationalStatus,
    
    // Statistics
    getAgentStatistics,
    
    // Database
    saveAgents
};
