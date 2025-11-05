# 📝 UPDATE UNTUK AI_MAINTENANCE_GUIDE.md

## Tambahkan setelah line 542:

```markdown
### WiFi Data Structures:

#### getSSIDInfo Return Format:
```javascript
{
  deviceId: "00259E-HG8145V5-...",
  ssid: [  // ARRAY of SSID objects
    { 
      id: "1", 
      name: "MyWiFi",
      transmitPower: 100,
      associatedDevices: []
    }
  ]
}
```

#### Correct Pattern:
```javascript
// WRONG
oldName = oldInfo.ssid;  

// CORRECT  
const targetSsid = oldInfo.ssid.find(s => s.id === targetId);
oldName = targetSsid?.name || 'Unknown';
```

### WiFi Change Messages:
- Name Change: NO restart - "WiFi akan terputus"
- Password Change: YES restart - "Modem akan restart"
```

## Update Common Issues Table (after line 504):

```markdown
| Log shows "[object Object]" | wifi-name-state-handler.js | Use .find() for specific SSID |
| Wrong restart message | wifi-name-state-handler.js | Name no restart, password yes |
```

## Update Version (line 589):

```markdown
*Last Updated: 2025-11-05*
*Version: 2.2*
```

---

**Copy these updates into AI_MAINTENANCE_GUIDE.md at the specified line numbers.**
