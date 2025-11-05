# ✨ CREATE REQUEST: INTELLIGENT CACHING SYSTEM

## 📋 PREREQUISITES
1. Analyze current database query patterns
2. Identify frequently accessed data
3. Review memory usage patterns
4. Understand data update frequency

## 🎯 OBJECTIVE
Implement a multi-layer caching system to reduce database queries by 70%, improve response time by 50%, and reduce GenieACS API calls.

## 📊 REQUIREMENTS

### Functional Requirements:
1. **In-Memory Cache (Layer 1)**
   - User data caching (5 minute TTL)
   - Device status caching (2 minute TTL)
   - WiFi configuration caching (10 minute TTL)
   - Template caching (1 hour TTL)

2. **Redis Cache (Layer 2)**
   - Session data
   - Temporary states
   - Queue management
   - Rate limiting counters

3. **Smart Invalidation**
   - Event-driven invalidation
   - Partial cache updates
   - Cascade invalidation
   - Version-based caching

4. **Cache Warming**
   - Pre-load frequently used data
   - Background refresh
   - Predictive caching
   - Peak time optimization

### Technical Requirements:
- Use node-cache for in-memory
- Optional Redis integration
- LRU eviction policy
- Maximum 100MB memory usage
- Async cache operations

## 🏗️ IMPLEMENTATION PLAN

### Phase 1: Cache Manager
```javascript
// lib/cache-manager.js
const NodeCache = require('node-cache');

class CacheManager {
    constructor() {
        this.layers = {
            hot: new NodeCache({ stdTTL: 300, checkperiod: 60 }),     // 5 min
            warm: new NodeCache({ stdTTL: 600, checkperiod: 120 }),    // 10 min
            cold: new NodeCache({ stdTTL: 3600, checkperiod: 600 })    // 1 hour
        };
        
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
    }
    
    async get(key, fetcher = null) {
        // Try hot cache first
        let value = this.layers.hot.get(key);
        if (value !== undefined) {
            this.stats.hits++;
            return value;
        }
        
        // Try warm cache
        value = this.layers.warm.get(key);
        if (value !== undefined) {
            this.stats.hits++;
            // Promote to hot cache
            this.layers.hot.set(key, value);
            return value;
        }
        
        // Try cold cache
        value = this.layers.cold.get(key);
        if (value !== undefined) {
            this.stats.hits++;
            // Promote to warm cache
            this.layers.warm.set(key, value);
            return value;
        }
        
        // Cache miss
        this.stats.misses++;
        
        // If fetcher provided, get fresh data
        if (fetcher) {
            value = await fetcher();
            this.set(key, value);
            return value;
        }
        
        return null;
    }
    
    set(key, value, layer = 'hot', ttl = null) {
        this.stats.sets++;
        if (ttl) {
            this.layers[layer].set(key, value, ttl);
        } else {
            this.layers[layer].set(key, value);
        }
    }
    
    invalidate(pattern) {
        this.stats.deletes++;
        // Invalidate matching keys in all layers
        Object.values(this.layers).forEach(cache => {
            const keys = cache.keys();
            keys.forEach(key => {
                if (key.includes(pattern)) {
                    cache.del(key);
                }
            });
        });
    }
}
```

### Phase 2: Cache Integration
```javascript
// lib/cached-wifi.js
class CachedWiFi {
    constructor(cache) {
        this.cache = cache;
    }
    
    async getSSIDInfo(deviceId) {
        const cacheKey = `wifi:ssid:${deviceId}`;
        
        return await this.cache.get(cacheKey, async () => {
            // Get from GenieACS
            const data = await originalGetSSIDInfo(deviceId);
            return data;
        });
    }
    
    async setSSIDName(deviceId, ssidId, name) {
        // Update in GenieACS
        const result = await originalSetSSIDName(deviceId, ssidId, name);
        
        // Invalidate cache
        this.cache.invalidate(`wifi:ssid:${deviceId}`);
        
        return result;
    }
}
```

### Phase 3: Database Query Cache
```javascript
// lib/cached-database.js
class CachedDatabase {
    constructor(cache) {
        this.cache = cache;
        this.db = new sqlite3.Database('./database.sqlite');
    }
    
    async getUser(phoneNumber) {
        const cacheKey = `user:phone:${phoneNumber}`;
        
        return await this.cache.get(cacheKey, async () => {
            return new Promise((resolve, reject) => {
                this.db.get(
                    'SELECT * FROM users WHERE phone_number LIKE ?',
                    [`%${phoneNumber}%`],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
        });
    }
    
    async updateUser(userId, updates) {
        // Update database
        await this.executeUpdate(userId, updates);
        
        // Invalidate user caches
        this.cache.invalidate(`user:id:${userId}`);
        this.cache.invalidate(`user:phone:`);
    }
}
```

## 📁 FILES TO CREATE/MODIFY
- `lib/cache-manager.js` - Core caching engine
- `lib/cached-wifi.js` - WiFi operations cache wrapper
- `lib/cached-database.js` - Database cache wrapper
- `lib/cache-warmup.js` - Cache pre-loading
- `config/cache-config.json` - Cache configuration
- `message/raf.js` - Use cached operations
- `lib/wifi.js` - Integrate caching
- `lib/database.js` - Add cache layer

## 🔗 INTEGRATION POINTS
```javascript
// Global cache instance
global.cache = new CacheManager();

// Wrap existing functions
const cachedWifi = new CachedWiFi(global.cache);
const cachedDb = new CachedDatabase(global.cache);

// Replace direct calls
// OLD: const user = await getUserFromDB(phone);
// NEW: const user = await cachedDb.getUser(phone);

// Cache warming on startup
async function warmupCache() {
    // Pre-load active users
    const activeUsers = await getActiveUsers();
    activeUsers.forEach(user => {
        global.cache.set(`user:id:${user.id}`, user, 'warm');
    });
    
    // Pre-load templates
    const templates = await loadTemplates();
    global.cache.set('templates:all', templates, 'cold', 3600);
}
```

## 🧪 ACCEPTANCE CRITERIA
1. ✅ Database queries reduced by 70%
2. ✅ GenieACS API calls reduced by 60%
3. ✅ Response time improved by 50%
4. ✅ Memory usage stays under 100MB
5. ✅ Cache hit ratio > 80%
6. ✅ No stale data issues
7. ✅ Graceful cache failure handling

## 📈 PERFORMANCE METRICS
- Cache hit ratio: > 80%
- Average response time: < 200ms
- Memory usage: < 100MB
- Database queries/min: < 100
- API calls/min: < 50

## 🔧 TESTING SCENARIOS
1. Cache miss and fetch
2. Cache invalidation cascade
3. Memory limit reached
4. Concurrent access
5. Cache corruption
6. TTL expiration
7. Cache warming performance

## 📝 DOCUMENTATION
- Add caching architecture diagram
- Document cache keys naming convention
- Create cache tuning guide
- Add monitoring metrics
