# Complete Analysis: WhatsApp Bot Message Templates

## Executive Summary
This document provides a comprehensive analysis of all messages in the RAF Bot WhatsApp system and outlines the plan to make them customizable via templates.

## Phase Overview

### Phase 1: Discovery & Analysis ✅
- Inventory all handlers
- Identify hardcoded messages
- Categorize message types
- Document current state

### Phase 2: Template Structure Design
- Design template categories
- Create naming conventions
- Define placeholder standards
- Plan migration strategy

### Phase 3-10: Implementation by Category
Each phase will handle a specific category of messages

### Phase 11: Testing & Validation
- Comprehensive testing
- Documentation update
- Deployment guide

---

## Phase 1: Discovery & Analysis

### 1.1 Handler Files Inventory (42 files)
```
message/handlers/
├── Core Handlers (10)
│   ├── admin-handler.js
│   ├── customer-handler.js
│   ├── teknisi-workflow-handler.js
│   ├── conversation-handler.js
│   ├── conversation-state-handler.js
│   ├── menu-handler.js
│   ├── monitoring-handler.js
│   ├── utility-handler.js
│   ├── utils.js
│   └── agent.js
├── WiFi Management (5)
│   ├── wifi-management-handler.js
│   ├── wifi-check-handler.js
│   ├── wifi-history-handler.js
│   ├── wifi-power-handler.js
│   └── wifi-logger.js
├── Payment & Billing (7)
│   ├── payment-handler.js
│   ├── payment-processor-handler.js
│   ├── billing-management-handler.js
│   ├── saldo-handler.js
│   ├── saldo-voucher-handler.js
│   ├── voucher-management-handler.js
│   └── topup-handler.js
├── Speed Management (3)
│   ├── speed-boost-handler.js
│   ├── speed-payment-handler.js
│   └── speed-status-handler.js
├── Ticket System (3)
│   ├── ticket-creation-handler.js
│   ├── ticket-process-handler.js
│   └── simple-location-handler.js
├── Reporting (3)
│   ├── smart-report-handler.js
│   ├── smart-report-hybrid.js
│   └── smart-report-text-menu.js
├── Photo Handling (4)
│   ├── customer-photo-handler.js
│   ├── photo-upload-queue.js
│   ├── photo-workflow-handler.js
│   └── teknisi-photo-handler-v3.js
├── Network & Access (4)
│   ├── network-management-handler.js
│   ├── package-management-handler.js
│   ├── access-management-handler.js
│   └── balance-management-handler.js
└── Others (1)
    └── reboot-modem-handler.js
```

### 1.2 State Handlers (4 files)
```
message/handlers/states/
├── report-state-handler.js
├── wifi-name-state-handler.js
├── wifi-password-state-handler.js
└── conversation-tracker.js
```

### 1.3 Step Handlers (7 files)
```
message/handlers/steps/
├── general-steps.js
├── customer-steps.js
├── approval-steps.js
├── pelanggan-steps.js
├── troubleshooting-steps.js
├── speed-on-demand-steps.js
└── speed-on-demand-pelanggan-steps.js
```

---

## Message Categories Identified

### 1. System Messages
- Welcome messages
- Error messages
- Success confirmations
- Invalid input responses
- Permission denied messages

### 2. Menu Messages
- Main menu
- Sub-menus (WiFi, Payment, etc.)
- Help menus
- Admin menus

### 3. Workflow Messages
- Ticket creation
- Ticket processing
- Status updates
- Completion messages

### 4. Notification Messages
- Payment reminders
- Status changes
- Alert messages
- Broadcast messages

### 5. Interactive Messages
- Questions/Prompts
- Confirmation requests
- Input validations
- Step-by-step guides

### 6. Report Messages
- Status reports
- Summary reports
- Detail views
- Error reports

### 7. Transaction Messages
- Payment confirmations
- Balance updates
- Voucher messages
- Top-up notifications

---

## Current Template Status

### Already Using Templates ✅
1. **Ticket Notifications** (8 templates)
   - ticket_process_customer
   - ticket_otw_customer
   - ticket_arrived_customer
   - ticket_working_customer
   - ticket_completed_customer
   - ticket_created_teknisi
   - ticket_cancelled_customer
   - ticket_cancelled_teknisi

2. **Payment Notifications** (6 templates)
   - speed_on_demand_applied
   - speed_on_demand_reverted
   - unpaid_reminder
   - tagihan_lunas
   - tagihan_belum_lunas
   - sudah_bayar_notification

3. **System Notifications** (5 templates)
   - isolir_notification
   - compensation_applied
   - compensation_reverted
   - customer_welcome
   - redaman_alert

### Hardcoded Messages (Need Migration) ❌
1. **Menu Messages** - All menus are hardcoded
2. **Error Messages** - Scattered across handlers
3. **Success Messages** - Inline in handlers
4. **Workflow Steps** - Hardcoded in step handlers
5. **Interactive Prompts** - Embedded in logic
6. **Status Reports** - Generated inline
7. **Help Messages** - Hardcoded strings

---

## Template Naming Convention

### Proposed Structure:
```
{category}_{action}_{target}

Examples:
- menu_main_customer
- error_invalid_input_general
- success_payment_confirmed
- workflow_ticket_created
- prompt_ask_name_customer
- report_status_wifi
```

### Categories:
- menu: All menu displays
- error: Error messages
- success: Success confirmations
- workflow: Process/workflow messages
- prompt: Interactive questions
- report: Status/detail reports
- notification: Alert/reminder messages
- help: Help and guidance messages

---

## Implementation Phases

### Phase 2: Core System Messages
- Error messages
- Success messages
- Invalid input responses
- Permission messages

### Phase 3: Menu Templates
- Main menu
- WiFi menu
- Payment menu
- Admin menu
- Help menu

### Phase 4: WiFi Management Messages
- WiFi status
- WiFi changes
- WiFi troubleshooting
- WiFi reports

### Phase 5: Payment & Billing Messages
- Payment confirmations
- Balance updates
- Billing notifications
- Top-up messages

### Phase 6: Ticket Workflow Messages
- Creation flow
- Processing flow
- Status updates
- Resolution messages

### Phase 7: Report Messages
- Smart reports
- Status reports
- Summary views
- Detail displays

### Phase 8: Interactive Prompts
- Input requests
- Confirmations
- Validations
- Step guides

### Phase 9: Admin & Teknisi Messages
- Admin notifications
- Teknisi workflows
- Management messages
- System alerts

### Phase 10: Help & Documentation
- Help messages
- Usage guides
- Feature explanations
- Error guidance

### Phase 11: Testing & Validation
- Unit tests
- Integration tests
- User acceptance testing
- Documentation

---

## Technical Requirements

### 1. Template System Enhancement
- Support for conditional sections
- Nested templates
- Array iterations
- Complex placeholders

### 2. Migration Strategy
- Backward compatibility
- Gradual rollout
- Feature flags
- Rollback plan

### 3. Performance Considerations
- Template caching
- Lazy loading
- Minimal overhead
- Memory management

### 4. Admin Interface
- Template editor
- Preview system
- Version control
- Bulk operations

---

## Next Steps

1. **Complete Phase 1 Analysis** (Current)
   - Deep dive into each handler
   - Extract all hardcoded messages
   - Create migration checklist

2. **Begin Phase 2 Implementation**
   - Start with core system messages
   - Create template files
   - Update handlers
   - Test and commit

3. **Continue Phases 3-11**
   - Systematic migration
   - Regular commits
   - Documentation updates
   - Testing at each phase

---

## Success Metrics

- ✅ All messages customizable via templates
- ✅ No hardcoded messages in handlers
- ✅ Consistent naming convention
- ✅ Complete documentation
- ✅ Admin interface fully functional
- ✅ Zero regression bugs
- ✅ Performance maintained or improved

---

## Risk Mitigation

1. **Breaking Changes**
   - Use feature flags
   - Maintain backward compatibility
   - Gradual rollout

2. **Performance Impact**
   - Benchmark before/after
   - Optimize template rendering
   - Cache aggressively

3. **User Experience**
   - A/B testing
   - User feedback loops
   - Quick rollback capability

---

This document will be updated as we progress through each phase.
