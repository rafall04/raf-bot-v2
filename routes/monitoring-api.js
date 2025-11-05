/**
 * Monitoring API Routes
 * Handles all monitoring-related API endpoints
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { exec } = require('child_process');

/**
 * Helper function to execute PHP files
 */
function executePHP(phpFile, req, res) {
    const phpPath = path.join(__dirname, '..', 'views', phpFile);
    
    // Build query string WITHOUT the leading '?' - PHP parse_str doesn't need it
    const queryString = Object.keys(req.query).length > 0 
        ? new URLSearchParams(req.query).toString() 
        : '';
    
    // Debug log (comment out after testing)
    // console.log(`[Monitoring API] Executing ${phpFile} with QUERY_STRING: "${queryString}"`);
    
    // Execute PHP file
    exec(`php "${phpPath}"`, {
        env: {
            ...process.env,
            QUERY_STRING: queryString,
            REQUEST_METHOD: req.method,
            CONTENT_TYPE: req.get('Content-Type') || '',
            HTTP_HOST: req.get('Host') || 'localhost'
        }
    }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[Monitoring API] Error executing ${phpFile}:`, error);
            return res.status(500).json({
                status: 500,
                message: 'Internal server error',
                error: error.message
            });
        }
        
        // Only log actual PHP errors, filter out debug logs
        if (stderr && !stderr.includes('[API]')) {
            console.error(`[PHP Error]:`, stderr);
        }
        
        try {
            // Try to parse as JSON
            const data = JSON.parse(stdout);
            res.json(data);
        } catch (parseError) {
            // If not JSON, return as text
            res.send(stdout);
        }
    });
}

/**
 * GET /api/monitoring/live
 * Main live data endpoint
 */
router.get('/live', (req, res) => {
    executePHP('api-monitoring-live.php', req, res);
});

/**
 * GET /api/monitoring/health
 * System health endpoint
 */
router.get('/health', (req, res) => {
    executePHP('api-system-health.php', req, res);
});

/**
 * GET /api/monitoring/traffic
 * Traffic statistics endpoint
 */
router.get('/traffic', (req, res) => {
    executePHP('api-traffic-stats.php', req, res);
});

/**
 * GET /api/monitoring/users
 * Users statistics endpoint
 */
router.get('/users', (req, res) => {
    executePHP('api-users-stats.php', req, res);
});

/**
 * GET /api/monitoring/history
 * Traffic history for charts
 */
router.get('/history', (req, res) => {
    executePHP('api-traffic-history.php', req, res);
});

/**
 * Backward compatibility endpoints
 */
router.get('/live-data', (req, res) => {
    executePHP('api-monitoring-live.php', req, res);
});

router.get('/traffic-history', (req, res) => {
    executePHP('api-traffic-history.php', req, res);
});

module.exports = router;
