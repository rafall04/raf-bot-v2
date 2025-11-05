# 🤝 HUMAN-AI COLLABORATION CONTRACT

## 📜 MUTUAL UNDERSTANDING AGREEMENT

This document establishes clear expectations between Human and AI for effective collaboration on RAF Bot V2 project.

---

## 👤 HUMAN RESPONSIBILITIES

### 1. **Provide Clear Context**
- ✅ I will explain WHAT needs to be done
- ✅ I will explain WHY it needs to be done  
- ✅ I will specify WHERE (which files/handlers) if known
- ✅ I will describe the current behavior vs expected behavior

### 2. **Reference Documentation**
- ✅ I will ask AI to read relevant docs first
- ✅ I will mention specific sections when applicable
- ✅ I will keep documentation updated after changes

### 3. **Set Clear Boundaries**
- ✅ I will specify what should NOT be changed
- ✅ I will mention backward compatibility needs
- ✅ I will define the scope clearly

### 4. **Provide Feedback**
- ✅ I will inform if the solution works or not
- ✅ I will provide error messages if any
- ✅ I will ask for clarification if needed

---

## 🤖 AI RESPONSIBILITIES

### 1. **Read Documentation First**
- ✅ I will ALWAYS read mentioned documentation
- ✅ I will reference docs in my responses
- ✅ I will follow established patterns
- ✅ I will check existing handlers before creating new

### 2. **Ask for Clarification**
- ✅ I will ask if context is unclear
- ✅ I will confirm understanding before proceeding
- ✅ I will list assumptions if any
- ✅ I will request missing information

### 3. **Provide Complete Solutions**
- ✅ I will give working code, not pseudocode
- ✅ I will include error handling
- ✅ I will provide test verification steps
- ✅ I will explain changes made

### 4. **Maintain Quality**
- ✅ I will preserve existing functionality
- ✅ I will follow naming conventions
- ✅ I will keep code clean and readable
- ✅ I will update relevant documentation

---

## 🔄 INTERACTION PROTOCOL

### PHASE 1: UNDERSTANDING
```
Human: States problem/requirement with context
AI: Reads docs, confirms understanding
Human: Clarifies if needed
AI: Proposes approach
```

### PHASE 2: IMPLEMENTATION
```
AI: Implements solution following patterns
AI: Provides code with explanations
Human: Reviews implementation
Human: Tests the solution
```

### PHASE 3: REFINEMENT
```
Human: Reports results/issues
AI: Adjusts if needed
Human: Confirms working
AI: Updates documentation
```

---

## 📋 COMMUNICATION STANDARDS

### Human Should Provide:
```markdown
1. **Situation**: Current state/problem
2. **Task**: What needs to be done
3. **Intent**: Why it needs to be done
4. **Restrictions**: What to avoid
5. **Expectations**: Desired outcome
```

### AI Should Provide:
```markdown
1. **Understanding**: Restate the problem
2. **Approach**: How I'll solve it
3. **Implementation**: Actual code/solution
4. **Verification**: How to test
5. **Documentation**: What was changed
```

---

## 🎯 QUALITY METRICS

Both parties agree to maintain:

| Aspect | Standard |
|--------|----------|
| **Clarity** | No ambiguous instructions or responses |
| **Completeness** | Full context given, full solution provided |
| **Consistency** | Follow existing patterns and conventions |
| **Correctness** | Test before declaring done |
| **Documentation** | Update after changes |

---

## 🚦 ESCALATION RULES

### When Human Should Provide More Info:
- AI asks for clarification
- AI lists multiple interpretations
- AI indicates missing context

### When AI Should Ask for Help:
- Conflicting requirements detected
- Breaking changes unavoidable
- Multiple valid approaches exist
- Documentation contradicts request

---

## 📝 EXAMPLE INTERACTION

### ✅ GOOD INTERACTION:

**Human:**
```
Bug: OTP tidak muncul saat teknisi sampai.
Lokasi: teknisi-workflow-handler.js handleSampaiLokasi
Baca AI_MAINTENANCE_GUIDE.md section debugging.
Fix dengan add recovery mechanism.
Test: teknisi sampai tanpa OTP.
```

**AI:**
```
Understood. I'll:
1. Read AI_MAINTENANCE_GUIDE.md debugging section
2. Check handleSampaiLokasi() in teknisi-workflow-handler.js
3. Add OTP recovery mechanism if missing
4. Maintain existing format
5. Test the scenario

[Provides code]
[Explains changes]
[Gives test steps]
```

### ❌ BAD INTERACTION:

**Human:**
```
fix otp
```

**AI:**
```
[Makes assumptions]
[Provides generic solution]
[No documentation check]
```

---

## 🏆 SUCCESS CRITERIA

A successful collaboration results in:
- ✅ Problem solved on first or second attempt
- ✅ No new bugs introduced
- ✅ Documentation stays current
- ✅ Code remains maintainable
- ✅ Both parties understand what was done

---

## 📜 AGREEMENT TERMS

By working on this project:

**Human agrees to:**
- Provide clear, contextual prompts
- Test solutions before deployment
- Update docs when needed
- Give feedback on solutions

**AI agrees to:**
- Read documentation first
- Follow established patterns
- Provide complete solutions
- Explain all changes made

---

## 🔄 CONTINUOUS IMPROVEMENT

This contract should be updated when:
- New patterns are established
- Common misunderstandings occur
- Better practices are discovered
- Project structure changes

---

## ✍️ SIGNATURES

**Human**: I understand my responsibilities for clear communication  
**AI**: I understand my responsibilities for quality solutions

**Effective Date**: November 3, 2025  
**Version**: 1.0

---

*"Good communication makes good code"* 💪
