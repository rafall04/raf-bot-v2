# 📚 GitHub Repository Setup & Auto-Commit Guide

## 🚀 Quick Setup

### 1️⃣ **Create GitHub Repository**
1. Login to [GitHub](https://github.com)
2. Click "New" or go to https://github.com/new
3. Repository settings:
   - **Repository name:** `raf-bot-v2`
   - **Description:** "WhatsApp Bot untuk manajemen ISP dengan integrasi GenieACS dan MikroTik"
   - **Visibility:** `Private` (recommended untuk keamanan)
   - ⚠️ **JANGAN** centang "Add a README file"
   - ⚠️ **JANGAN** centang "Add .gitignore"
   - ⚠️ **JANGAN** centang "Choose a license"

### 2️⃣ **Connect to GitHub**
```bash
# Option A: Run the setup script
setup-github.bat

# Option B: Manual commands
git remote add origin https://github.com/YOUR_USERNAME/raf-bot-v2.git
git branch -M main
git push -u origin main
```

### 3️⃣ **Setup GitHub Authentication**

#### **Using Personal Access Token (Recommended)**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Settings:
   - **Note:** "RAF-BOT Auto-Commit"
   - **Expiration:** 90 days atau "No expiration"
   - **Scopes:** Check `repo` (full control)
4. Copy the token
5. When pushing, use:
   - **Username:** Your GitHub username
   - **Password:** The token (not your GitHub password)

#### **Save Credentials (Windows)**
```bash
git config --global credential.helper manager
```

---

## 🤖 Auto-Commit System

### **Features**
- ✅ Monitors all file changes automatically
- ✅ Commits changes every 10 seconds after last modification
- ✅ Pushes to GitHub automatically
- ✅ Ignores sensitive files (config.json, database files, etc.)
- ✅ Smart debouncing to avoid too many commits

### **How to Use**

#### **Option 1: Simple Batch Script** (Basic)
```bash
# Run the basic auto-commit script
auto-commit.bat
```
- Checks for changes every 5 minutes
- Simple and lightweight
- Good for basic needs

#### **Option 2: Node.js Watcher** (Advanced) ⭐ RECOMMENDED
```bash
# Start the advanced auto-commit service
start-auto-commit.bat

# Or run directly with npm
npm run auto-commit
```
- Real-time file monitoring
- Smart debouncing (10 second delay)
- Detailed logging
- Better error handling

### **Run as Background Service**

#### **Using PM2 (Best for Production)**
```bash
# Install PM2 globally
npm install -g pm2

# Start auto-commit as service
pm2 start auto-commit.js --name "raf-auto-commit"

# Save PM2 configuration
pm2 save

# Setup auto-start on system boot
pm2 startup
```

#### **PM2 Commands**
```bash
pm2 list                    # Show all services
pm2 logs raf-auto-commit    # View logs
pm2 stop raf-auto-commit    # Stop service
pm2 restart raf-auto-commit # Restart service
pm2 delete raf-auto-commit  # Remove service
```

---

## 📁 Files Explained

| File | Purpose |
|------|---------|
| `.gitignore` | Lists files/folders to exclude from Git |
| `config.example.json` | Template config without sensitive data |
| `auto-commit.bat` | Simple Windows batch auto-commit script |
| `auto-commit.js` | Advanced Node.js auto-commit with file watching |
| `start-auto-commit.bat` | Launcher for Node.js auto-commit |
| `setup-github.bat` | Interactive GitHub repository setup |

---

## 🔒 Security Notes

### **What's Excluded from Repository**
- ✅ `config.json` - Contains API keys and secrets
- ✅ `database.sqlite` - User database
- ✅ Database JSON files with user data
- ✅ Session files (WhatsApp auth)
- ✅ Upload folders with user files
- ✅ Temporary and log files

### **Best Practices**
1. **Never commit sensitive data**
   - API keys, passwords, tokens should be in `config.json`
   - `config.json` is in `.gitignore`

2. **Use config.example.json**
   - Shows structure without real data
   - New developers copy this to `config.json`

3. **Regular backups**
   - Backup `config.json` separately
   - Backup database files separately
   - Store backups securely (not in Git)

---

## 🛠️ Troubleshooting

### **Push Failed: Authentication Error**
```bash
# Update remote URL to use token
git remote set-url origin https://TOKEN@github.com/USERNAME/raf-bot-v2.git

# Or use SSH (if configured)
git remote set-url origin git@github.com:USERNAME/raf-bot-v2.git
```

### **Large File Error**
```bash
# If you accidentally committed a large file
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/large/file" \
  --prune-empty --tag-name-filter cat -- --all
```

### **Reset Auto-Commit**
```bash
# Stop the service
# Press Ctrl+C in the terminal

# Clear any stuck commits
git reset HEAD~1  # Undo last commit (keep changes)
git push -f       # Force push (use carefully)
```

---

## 📊 Monitoring

### **View Commit History**
```bash
# View recent commits
git log --oneline -10

# View commits with details
git log --stat -5

# View auto-commits today
git log --since="today" --oneline
```

### **GitHub Insights**
1. Go to your repository on GitHub
2. Click "Insights" tab
3. View:
   - Commit activity
   - Code frequency
   - Contributors

---

## 💡 Tips

1. **Commit Message Format**
   - Auto-commits use: `Auto-commit: YYYY-MM-DD HH:MM:SS (X files)`
   - Manual commits: Be descriptive (e.g., "Fix WiFi command handler bug")

2. **Branching Strategy**
   - `main` - Stable production code
   - `develop` - Development branch
   - `feature/*` - New features

3. **Reduce Auto-Commit Frequency**
   - Edit `auto-commit.js`
   - Change `debounceDelay: 10000` to higher value (milliseconds)
   - Example: `60000` = 1 minute delay

4. **Exclude More Files**
   - Add patterns to `.gitignore`
   - Update `excludePaths` in `auto-commit.js`

---

## 📞 Support

Jika ada masalah dengan setup GitHub atau auto-commit:
1. Check error messages carefully
2. Verify GitHub token/credentials
3. Ensure Git is properly installed
4. Check network connection

---

**Last Updated:** October 2024
**Version:** 1.0.0
