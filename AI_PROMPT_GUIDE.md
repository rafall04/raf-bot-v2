# 🤖 AI PROMPT GUIDE - HOW TO WORK WITH THIS CODEBASE

## 🚀 FOR AI ASSISTANTS

**IMPORTANT:** Before making ANY changes to this codebase, you MUST read the following files IN ORDER:

### 📚 REQUIRED READING (In This Order)

1. **AI_MAINTENANCE_GUIDE.md** - Complete maintenance guide
2. **WORKFLOW_DOCUMENTATION.md** - Full workflow mapping  
3. **REFACTORING_SUMMARY.md** - Current state overview
4. **AI_REFACTORING_RULES.md** - Rules and patterns

## 💬 RECOMMENDED PROMPTS FOR HUMANS TO USE

### For Adding New Features:
```
"I need to add [feature]. Please read AI_MAINTENANCE_GUIDE.md first, then identify which handler to modify and follow the patterns."
```

### For Fixing Bugs:
```
"There's a bug with [feature]. Please read WORKFLOW_DOCUMENTATION.md to understand the flow, then check the appropriate handler."
```

### For Understanding Code:
```
"How does [feature] work? Please check WORKFLOW_DOCUMENTATION.md and explain the flow from raf.js to the handlers."
```

### For Maintenance:
```
"I need to maintain [component]. Please read AI_MAINTENANCE_GUIDE.md and REFACTORING_SUMMARY.md first to understand the current structure."
```

## 🎯 KEY POINTS FOR AI

### ALWAYS:
- ✅ Read the guides BEFORE making changes
- ✅ Check if handler already exists before creating new
- ✅ Follow established patterns (multi-phone, state management, etc.)
- ✅ Test changes with appropriate test files
- ✅ Update documentation after changes

### NEVER:
- ❌ Add business logic to raf.js
- ❌ Create duplicate handlers
- ❌ Ignore the documentation
- ❌ Make changes without understanding the flow
- ❌ Break existing functionality

## 📊 CURRENT STATE (November 3, 2025)

```
✅ Refactoring: COMPLETE
✅ File Size: 1,866 lines (39.7% reduced)
✅ Handlers: 36 files organized
✅ Business Logic: 100% extracted
✅ Architecture: Clean and modular
```

## 🔍 QUICK REFERENCE

| Task | Read This First | Then Check |
|------|-----------------|------------|
| Add WiFi feature | AI_MAINTENANCE_GUIDE.md | handlers/wifi-*.js |
| Fix ticket issue | WORKFLOW_DOCUMENTATION.md | handlers/smart-report-*.js |
| Add payment feature | AI_MAINTENANCE_GUIDE.md | handlers/payment-*.js |
| Fix teknisi workflow | WORKFLOW_DOCUMENTATION.md | handlers/teknisi-*.js |
| Add multi-step flow | AI_REFACTORING_RULES.md | handlers/conversation-state-handler.js |
| Debug notifications | AI_MAINTENANCE_GUIDE.md | Multi-phone pattern section |
| Fix state issues | WORKFLOW_DOCUMENTATION.md | handlers/states/*.js |

## 🤝 WORKING WITH AI

### Example Interaction:

**Human:** "Add a new command to check internet speed"

**AI Response Pattern:**
1. "I'll read the AI_MAINTENANCE_GUIDE.md first..."
2. "Based on the guide, this is a monitoring feature..."
3. "I'll add it to monitoring-handler.js..."
4. "Following the established pattern..."
5. "Testing the changes..."
6. "Updating documentation..."

## 📝 DOCUMENTATION FILES

### Core Guides:
- **AI_MAINTENANCE_GUIDE.md** - How to maintain and add features
- **AI_REFACTORING_RULES.md** - Rules and patterns to follow
- **AI_PROMPT_GUIDE.md** - This file

### Reference Documents:
- **WORKFLOW_DOCUMENTATION.md** - Complete workflow mapping
- **REFACTORING_SUMMARY.md** - What was refactored and where
- **README.md** - User-facing documentation

### Test Documentation:
- **test/README_TEST_ISSUES.md** - Known test issues and solutions

## 💡 PRO TIPS

1. **Always start with the guides** - They contain critical patterns and rules
2. **Check existing handlers first** - Don't reinvent the wheel
3. **Follow the patterns** - Consistency is key
4. **Test incrementally** - Don't wait until the end
5. **Document changes** - Future AI/humans will thank you

## 🚨 CRITICAL WARNINGS

⚠️ **The codebase is ALREADY REFACTORED** - Don't try to refactor again!

⚠️ **raf.js is ONLY a router** - All logic must be in handlers!

⚠️ **36 handlers exist** - Check before creating new ones!

⚠️ **Multi-phone pattern is MANDATORY** - All notifications must follow it!

⚠️ **State management has rules** - Check conversation-state-handler.js!

---

**Remember:** The documentation is your friend. Read it, understand it, follow it!

*Last Updated: November 3, 2025*
*Version: 1.0*
*Purpose: Guide AI assistants to work effectively with this codebase*
