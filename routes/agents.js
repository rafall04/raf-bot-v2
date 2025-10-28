const express = require('express');
const router = express.Router();
const agentManager = require('../lib/agent-manager');
const { logger } = require('../lib/logger');

// Middleware to check if user is logged in (JWT-based)
function isAuthenticated(req, res, next) {
    if (req.user) {
        return next();
    }
    res.status(401).json({ success: false, message: 'Unauthorized' });
}

// Get all agents
router.get('/list', isAuthenticated, (req, res) => {
    try {
        const activeOnly = req.query.active !== 'false';
        const agents = agentManager.getAllAgents(activeOnly);
        res.json({ success: true, data: agents });
    } catch (error) {
        logger.error('Error getting agents:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get agent by ID
router.get('/detail/:id', isAuthenticated, (req, res) => {
    try {
        const agent = agentManager.getAgentById(req.params.id);
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }
        res.json({ success: true, data: agent });
    } catch (error) {
        logger.error('Error getting agent detail:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add new agent
router.post('/add', isAuthenticated, (req, res) => {
    try {
        const { name, phone, address, area, services, operational_hours, location } = req.body;
        
        if (!name || !phone || !address || !area) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name, phone, address, and area are required' 
            });
        }
        
        const newAgent = agentManager.addAgent({
            name,
            phone,
            address,
            area,
            services: services || ['topup', 'voucher'],
            operational_hours: operational_hours || '08:00 - 20:00',
            location: location || null
        });
        
        logger.info('New agent added:', newAgent.id);
        res.json({ success: true, data: newAgent });
    } catch (error) {
        logger.error('Error adding agent:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update agent
router.put('/update/:id', isAuthenticated, (req, res) => {
    try {
        const agentId = req.params.id;
        const updates = req.body;
        
        const updatedAgent = agentManager.updateAgent(agentId, updates);
        if (!updatedAgent) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }
        
        logger.info('Agent updated:', agentId);
        res.json({ success: true, data: updatedAgent });
    } catch (error) {
        logger.error('Error updating agent:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Deactivate agent
router.delete('/delete/:id', isAuthenticated, (req, res) => {
    try {
        const agentId = req.params.id;
        const success = agentManager.deactivateAgent(agentId);
        
        if (!success) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }
        
        logger.info('Agent deactivated:', agentId);
        res.json({ success: true, message: 'Agent deactivated successfully' });
    } catch (error) {
        logger.error('Error deactivating agent:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get agents by area
router.get('/area/:area', isAuthenticated, (req, res) => {
    try {
        const agents = agentManager.getAgentsByArea(req.params.area);
        res.json({ success: true, data: agents });
    } catch (error) {
        logger.error('Error getting agents by area:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get agent statistics
router.get('/statistics', isAuthenticated, (req, res) => {
    try {
        const stats = agentManager.getAgentStatistics();
        res.json({ success: true, data: stats });
    } catch (error) {
        logger.error('Error getting agent statistics:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
