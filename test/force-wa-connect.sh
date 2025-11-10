#!/bin/bash

# Force WhatsApp Connection Script for Ubuntu
# Run this after starting the server if bot shows offline

echo "RAF BOT - Force WhatsApp Connection"
echo "===================================="
echo ""

# Check if server is running
echo "1. Checking if server is running..."
if curl -s http://localhost:3100/api/bot-status > /dev/null 2>&1; then
    echo "   ✅ Server is running"
else
    echo "   ❌ Server not running!"
    echo "   Start server first: npm start"
    exit 1
fi

# Get current status
echo ""
echo "2. Current bot status:"
curl -s http://localhost:3100/api/bot-status | python3 -c "import sys, json; data = json.load(sys.stdin); print(f'   Bot Status: {\"ONLINE\" if data.get(\"botStatus\") else \"OFFLINE\"}'); print(f'   Connection State: {data.get(\"connectionState\", \"undefined\")}'); print(f'   Has RAF Object: {data.get(\"hasRafObject\", False)}'); print(f'   Has User Info: {bool(data.get(\"userInfo\"))}');"

# Force start
echo ""
echo "3. Forcing WhatsApp connection..."
response=$(curl -s http://localhost:3100/api/start)
echo "   Response: $response"

# Wait for connection
echo ""
echo "4. Waiting 5 seconds for connection..."
sleep 5

# Check status again
echo ""
echo "5. Checking new status:"
curl -s http://localhost:3100/api/bot-status | python3 -c "import sys, json; data = json.load(sys.stdin); print(f'   Bot Status: {\"ONLINE\" if data.get(\"botStatus\") else \"OFFLINE\"}'); print(f'   Connection State: {data.get(\"connectionState\", \"undefined\")}'); print(f'   Has RAF Object: {data.get(\"hasRafObject\", False)}'); print(f'   Has User Info: {bool(data.get(\"userInfo\"))}');"

# Check if it's online now
status=$(curl -s http://localhost:3100/api/bot-status | python3 -c "import sys, json; print('online' if json.load(sys.stdin).get('botStatus') else 'offline')")

if [ "$status" == "online" ]; then
    echo ""
    echo "✅ SUCCESS! Bot is now ONLINE"
else
    echo ""
    echo "❌ Bot still OFFLINE"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check server logs for errors"
    echo "2. The session might be invalid - try deleting and rescanning:"
    echo "   rm -rf sessions/raf"
    echo "   Then restart server and scan QR code"
    echo "3. Check if you see QR code in the terminal"
    echo "4. Run: node test/check-wa-connection.js"
fi

echo ""
echo "===================================="
echo "To monitor server logs:"
echo "  If using PM2: pm2 logs"
echo "  If using screen: screen -r"
echo "  If direct: Check terminal output"
