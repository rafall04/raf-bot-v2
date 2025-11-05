# ✨ CREATE REQUEST: RATE LIMITING & ANTI-SPAM SYSTEM

## 📋 PREREQUISITES
1. Understand current message flow in raf.js
2. Analyze command processing patterns
3. Review user permission levels
4. Check existing spam detection

## 🎯 OBJECTIVE
Implement comprehensive rate limiting and anti-spam protection to prevent abuse, ensure fair usage, and protect system resources while maintaining good user experience.

## 📊 REQUIREMENTS

### Functional Requirements:
1. **Command Rate Limiting**
   - Per-user limits (10 commands/minute)
   - Per-command limits (WiFi changes: 5/hour)
   - Global limits (1000 commands/hour)
   - Burst allowance (3 quick commands)

2. **Spam Detection**
   - Duplicate message detection
   - Pattern-based spam identification
   - Flood detection (>5 messages/second)
   - Automated temporary bans

3. **Progressive Penalties**
   - Warning after 1st violation
   - 5-minute timeout after 2nd
   - 1-hour ban after 3rd
   - 24-hour ban for severe abuse

4. **Whitelist/Blacklist**
   - Admin bypass
   - Trusted user higher limits
   - Permanent ban list
   - IP-based blocking

5. **Smart Throttling**
   - Queue excess requests
   - Priority-based processing
   - Graceful degradation
   - Load balancing

### Technical Requirements:
- Token bucket algorithm
- Sliding window counters
- Redis or in-memory storage
- Minimal latency impact (<10ms)
- Configurable limits

## 🏗️ IMPLEMENTATION PLAN

### Phase 1: Rate Limiter Core
```javascript
// lib/rate-limiter.js
class RateLimiter {
    constructor() {
        this.buckets = new Map();
        this.violations = new Map();
        this.bans = new Map();
        
        this.config = {
            global: { limit: 1000, window: 3600000 },      // 1000/hour
            perUser: { limit: 10, window: 60000 },         // 10/minute
            perCommand: {
                'GANTI_NAMA_WIFI': { limit: 5, window: 3600000 },     // 5/hour
                'GANTI_SANDI_WIFI': { limit: 5, window: 3600000 },    // 5/hour
                'REBOOT_MODEM': { limit: 2, window: 3600000 },        // 2/hour
                'CEK_WIFI': { limit: 20, window: 60000 },             // 20/minute
                'LAPOR': { limit: 3, window: 3600000 }                // 3/hour
            }
        };
    }
    
    async checkLimit(userId, command) {
        // Check if user is banned
        if (this.isBanned(userId)) {
            return { 
                allowed: false, 
                reason: 'BANNED',
                retryAfter: this.getBanExpiry(userId)
            };
        }
        
        // Check global limit
        if (!this.checkGlobalLimit()) {
            return {
                allowed: false,
                reason: 'GLOBAL_LIMIT_EXCEEDED',
                retryAfter: 60000
            };
        }
        
        // Check user limit
        const userKey = `user:${userId}`;
        if (!this.checkBucket(userKey, this.config.perUser)) {
            this.recordViolation(userId, 'USER_LIMIT');
            return {
                allowed: false,
                reason: 'USER_LIMIT_EXCEEDED',
                retryAfter: this.getRetryAfter(userKey)
            };
        }
        
        // Check command-specific limit
        if (this.config.perCommand[command]) {
            const cmdKey = `cmd:${userId}:${command}`;
            if (!this.checkBucket(cmdKey, this.config.perCommand[command])) {
                this.recordViolation(userId, 'COMMAND_LIMIT');
                return {
                    allowed: false,
                    reason: 'COMMAND_LIMIT_EXCEEDED',
                    retryAfter: this.getRetryAfter(cmdKey)
                };
            }
        }
        
        // All checks passed
        this.consumeToken(userKey);
        if (this.config.perCommand[command]) {
            this.consumeToken(`cmd:${userId}:${command}`);
        }
        
        return { allowed: true };
    }
    
    checkBucket(key, config) {
        if (!this.buckets.has(key)) {
            this.buckets.set(key, {
                tokens: config.limit,
                lastRefill: Date.now()
            });
        }
        
        const bucket = this.buckets.get(key);
        const now = Date.now();
        const timePassed = now - bucket.lastRefill;
        
        // Refill tokens based on time passed
        const tokensToAdd = Math.floor(timePassed / config.window * config.limit);
        bucket.tokens = Math.min(config.limit, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
        
        return bucket.tokens > 0;
    }
    
    recordViolation(userId, type) {
        const violations = this.violations.get(userId) || [];
        violations.push({ type, timestamp: Date.now() });
        this.violations.set(userId, violations);
        
        // Check for penalty
        const recentViolations = violations.filter(
            v => Date.now() - v.timestamp < 3600000  // Last hour
        );
        
        if (recentViolations.length >= 3) {
            this.ban(userId, 86400000);  // 24 hour ban
        } else if (recentViolations.length === 2) {
            this.ban(userId, 3600000);   // 1 hour ban
        }
    }
    
    ban(userId, duration) {
        this.bans.set(userId, {
            until: Date.now() + duration,
            reason: 'RATE_LIMIT_VIOLATIONS'
        });
    }
}
```

### Phase 2: Spam Detector
```javascript
// lib/spam-detector.js
class SpamDetector {
    constructor() {
        this.messageHistory = new Map();
        this.patterns = [
            /(.)\1{10,}/,                    // Repeated characters
            /^[A-Z\s]{20,}$/,               // All caps spam
            /(bit\.ly|tinyurl|goo\.gl)/i,   // Suspicious links
            /\b(viagra|casino|lottery)\b/i   // Spam keywords
        ];
    }
    
    async checkSpam(userId, message) {
        // Check message history for duplicates
        const history = this.getHistory(userId);
        const isDuplicate = history.some(m => 
            m.text === message && 
            Date.now() - m.timestamp < 60000
        );
        
        if (isDuplicate) {
            return { isSpam: true, reason: 'DUPLICATE_MESSAGE' };
        }
        
        // Check flood (too many messages)
        const recentMessages = history.filter(
            m => Date.now() - m.timestamp < 5000
        );
        
        if (recentMessages.length > 5) {
            return { isSpam: true, reason: 'FLOODING' };
        }
        
        // Check spam patterns
        for (const pattern of this.patterns) {
            if (pattern.test(message)) {
                return { isSpam: true, reason: 'SPAM_PATTERN' };
            }
        }
        
        // Add to history
        this.addToHistory(userId, message);
        
        return { isSpam: false };
    }
    
    getHistory(userId) {
        if (!this.messageHistory.has(userId)) {
            this.messageHistory.set(userId, []);
        }
        return this.messageHistory.get(userId);
    }
    
    addToHistory(userId, message) {
        const history = this.getHistory(userId);
        history.push({
            text: message,
            timestamp: Date.now()
        });
        
        // Keep only last 100 messages
        if (history.length > 100) {
            history.shift();
        }
    }
}
```

### Phase 3: Integration Layer
```javascript
// lib/anti-abuse.js
class AntiAbuseSystem {
    constructor() {
        this.rateLimiter = new RateLimiter();
        this.spamDetector = new SpamDetector();
        this.whitelist = new Set(global.config.whitelist || []);
        this.blacklist = new Set();
    }
    
    async processMessage(message, sender) {
        const userId = sender.replace('@s.whatsapp.net', '');
        
        // Check blacklist
        if (this.blacklist.has(userId)) {
            return {
                allowed: false,
                reason: 'BLACKLISTED',
                message: '⛔ Anda telah diblokir dari sistem.'
            };
        }
        
        // Skip checks for whitelisted users
        if (this.whitelist.has(userId)) {
            return { allowed: true };
        }
        
        // Check spam
        const spamCheck = await this.spamDetector.checkSpam(userId, message.text);
        if (spamCheck.isSpam) {
            return {
                allowed: false,
                reason: spamCheck.reason,
                message: '⚠️ Pesan terdeteksi sebagai spam. Mohon tidak mengirim pesan berulang.'
            };
        }
        
        // Extract command from message
        const command = this.extractCommand(message.text);
        
        // Check rate limit
        const rateCheck = await this.rateLimiter.checkLimit(userId, command);
        if (!rateCheck.allowed) {
            const retryIn = Math.ceil(rateCheck.retryAfter / 1000);
            return {
                allowed: false,
                reason: rateCheck.reason,
                message: `⏱️ Anda terlalu sering menggunakan command. Silakan coba lagi dalam ${retryIn} detik.`
            };
        }
        
        return { allowed: true };
    }
}
```

## 📁 FILES TO CREATE/MODIFY
- `lib/rate-limiter.js` - Rate limiting engine
- `lib/spam-detector.js` - Spam detection
- `lib/anti-abuse.js` - Integration layer
- `config/rate-limits.json` - Configurable limits
- `database/violations.sqlite` - Violation history
- `message/raf.js` - Integrate anti-abuse
- `config.json` - Add whitelist config

## 🔗 INTEGRATION POINTS
```javascript
// In message/raf.js
const { AntiAbuseSystem } = require('./lib/anti-abuse');
const antiAbuse = new AntiAbuseSystem();

// Before processing any message
raf.ev.on('messages.upsert', async (m) => {
    const message = m.messages[0];
    const sender = message.key.remoteJid;
    
    // Check anti-abuse
    const abuseCheck = await antiAbuse.processMessage(message, sender);
    
    if (!abuseCheck.allowed) {
        // Send warning and stop processing
        await raf.sendMessage(sender, {
            text: abuseCheck.message
        });
        
        // Log violation
        console.log(`[ANTI-ABUSE] Blocked: ${abuseCheck.reason} from ${sender}`);
        
        return; // Don't process message
    }
    
    // Continue normal processing
    await processMessage(message);
});
```

## 🧪 ACCEPTANCE CRITERIA
1. ✅ No user can send >10 commands/minute
2. ✅ WiFi changes limited to 5/hour
3. ✅ Spam messages auto-blocked
4. ✅ Progressive penalties applied correctly
5. ✅ Admin users bypass all limits
6. ✅ Clear user feedback on limits
7. ✅ <10ms latency added

## 📈 SUCCESS METRICS
- Spam blocked: > 95%
- False positives: < 1%
- System load reduction: > 30%
- User complaints: < 5/month
- Response time impact: < 10ms

## 🔧 TESTING SCENARIOS
1. Send 15 commands in 1 minute
2. Change WiFi name 6 times in 1 hour
3. Send identical message 5 times
4. Flood with 10 messages/second
5. Test whitelist bypass
6. Test ban and unban cycle
7. Stress test with 100 concurrent users

## 📝 DOCUMENTATION
- Document rate limit policies
- Create user guide for limits
- Add admin management commands
- Create monitoring dashboard
