const jwt = require('jsonwebtoken');

/**
 * Middleware to ensure a customer is authenticated via a JWT Bearer token.
 * It verifies the token and attaches the full user object to req.customer.
 *
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The Express next middleware function.
 */
function apiAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        // No token provided
        return res.status(401).json({ status: 401, message: "Unauthorized: No token provided." });
    }

    jwt.verify(token, global.config.jwt, (err, decoded) => {
        if (err) {
            // Token is invalid or expired
            return res.status(403).json({ status: 403, message: "Forbidden: Invalid or expired token." });
        }

        // Find the user associated with the token
        const user = global.users.find(u => String(u.id) === String(decoded.id));

        if (!user) {
            // User from a valid token does not exist in our system anymore
            return res.status(404).json({ status: 404, message: "Not Found: User associated with this token not found." });
        }

        // Attach user object to the request for subsequent middleware or route handlers
        req.customer = user;
        next();
    });
}

module.exports = {
    apiAuth
};
