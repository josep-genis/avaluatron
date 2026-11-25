# Integration Checklist - Institutional Layer with app.js

This checklist outlines the steps needed to fully integrate the institutional layer with the existing Avaluatron application.

## Phase 1: Prepare Supabase Backend

- [ ] Create Supabase project (or use existing)
- [ ] Copy `supabase/institutional-schema.sql` to Supabase migrations
- [ ] Run migrations: `supabase db push`
- [ ] Verify all 7 tables created:
  - [ ] institutions
  - [ ] user_profiles
  - [ ] institutional_workspaces
  - [ ] institution_invitations
  - [ ] teacher_students
  - [ ] local_workspace_sync
  - [ ] institutional_audit_log (if included)
- [ ] Verify RLS policies are active
- [ ] Test helper functions:
  - [ ] verify_teacher_email()
  - [ ] redeem_institution_invitation()
  - [ ] save_institutional_workspace()

## Phase 2: Update Application Configuration

- [ ] Add Supabase credentials to environment:
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_ANON_KEY
- [ ] Create config file or update `.env`
- [ ] Update index.html to include institutional styles:
  ```html
  <link rel="stylesheet" href="styles-institutional.css">
  ```

## Phase 3: Import Institutional Modules

In app.js, add imports:

```javascript
// Near top of app.js, after existing imports
import { InstitutionalManager } from "./js/institutional.js";
import {
  renderInstitutionalLogin,
  renderInstitutionalDashboard,
  renderTeacherProfileSetup,
  renderInstitutionInvitation,
  renderAccessModeBanner
} from "./js/institutional-ui.js";
```

- [ ] Add imports to app.js
- [ ] Verify no import conflicts
- [ ] Check for name collisions

## Phase 4: Initialize Institutional Manager

In app.js, after Supabase client initialization:

```javascript
// Initialize Supabase client
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize institutional manager
let institutional = new InstitutionalManager(supabaseClient);

// Make available globally for debugging
window.institutional = institutional;
```

- [ ] Initialize InstitutionalManager with Supabase client
- [ ] Export to window for console access
- [ ] Test initialization: `window.institutional` in console

## Phase 5: Implement Authentication Flow

- [ ] Determine where to show institutional login vs. local mode
- [ ] Add event handler for "Create Account" or "Sign Up" button:
  ```javascript
  // On sign-up click
  content.innerHTML = renderInstitutionalLogin();
  setupInstitutionalLoginHandlers();
  ```
- [ ] Implement `setupInstitutionalLoginHandlers()`:
  - [ ] Handle sign-up form submission
  - [ ] Handle sign-in form submission
  - [ ] Handle "Create institution" flow
- [ ] Add check for existing Supabase auth session:
  ```javascript
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    // Load institutional profile
    const profile = await institutional.getCurrentUserProfile();
  }
  ```

## Phase 6: Implement Email Verification

- [ ] Setup email verification trigger in Supabase Auth
- [ ] Create UI for email verification status display
- [ ] Implement verification flow:
  - [ ] Send verification email on signup
  - [ ] Handle verification link clicks
  - [ ] Update is_email_verified in database
  - [ ] Show success message
  - [ ] Unlock cloud features
- [ ] Add `verifyEmail()` function:
  ```javascript
  async function verifyEmail(userId) {
    const verified = await institutional.verifyTeacherEmail(userId);
    if (verified) {
      showAccessModeBanner();
    }
  }
  ```

## Phase 7: Implement Access Mode Detection

- [ ] Add `getAccessMode()` call on app load:
  ```javascript
  const accessMode = await institutional.getAccessMode(userId);
  // Returns: 'local_only', 'cloud_only', or 'hybrid'
  ```
- [ ] Update UI based on access mode:
  - [ ] Show local-only banner for unverified teachers
  - [ ] Show cloud features for verified users
  - [ ] Show hybrid options for future phases
- [ ] Add permission checks before cloud operations:
  ```javascript
  async function saveToCloud(data) {
    if (!await institutional.canEditCloud(currentUserId)) {
      showToast("Verifica el teu correu per editar institucional", true);
      return;
    }
    // Proceed with save
  }
  ```

## Phase 8: Implement Institutional Workspace Sync

- [ ] Add `loadInstitutionalWorkspace()` function:
  ```javascript
  async function loadInstitutionalWorkspace(institutionId) {
    const workspace = await institutional.getInstitutionalWorkspace(institutionId);
    if (workspace) {
      mergeWithLocalData(workspace.payload);
    }
  }
  ```
- [ ] Add `saveInstitutionalWorkspace()` function:
  ```javascript
  async function saveToInstitutionalWorkspace(institutionId) {
    const success = await institutional.saveInstitutionalWorkspace(
      institutionId,
      currentRevision,
      data
    );
    if (!success) {
      // Handle conflict - show UI for merge
    }
  }
  ```
- [ ] Implement conflict resolution UI
- [ ] Add local-to-cloud migration on email verification

## Phase 9: Implement Teacher Assignment UI

- [ ] Add teacher-student assignment in subject detail view
- [ ] Create UI component `renderTeacherAssignment()`:
  ```html
  <div class="teacher-assignment">
    <select id="teacher-select">
      <option>Select teacher...</option>
      <!-- Teachers from institution -->
    </select>
    <button onclick="assignTeacher()">Assign</button>
  </div>
  ```
- [ ] Implement assignment logic:
  ```javascript
  async function assignTeacher(subjectId, teacherId) {
    // Add to subject.teachers array
    // Call institutional.assignStudentToTeacher() if needed
  }
  ```
- [ ] Add permissions check for multi-teacher editing

## Phase 10: Implement Institutional Dashboard

- [ ] Create dashboard view: `renderInstitutionalDashboard()`
- [ ] Add navigation to dashboard (new menu item or modal)
- [ ] Implement sections:
  - [ ] Institution info and settings
  - [ ] Member list with filtering
  - [ ] Pending invitations
  - [ ] Teacher-student relationships
  - [ ] Quick stats (students, teachers, subjects)
- [ ] Add event handlers for:
  - [ ] Invite teacher button
  - [ ] Remove teacher button
  - [ ] Update teacher role
  - [ ] Assign students to teacher

## Phase 11: Update Data Save/Load

- [ ] Modify `saveData()` to check access mode:
  ```javascript
  async function saveData() {
    const data_clone = clone(withoutUnmodifiedBank(data));
    
    if (cloud?.isActive()) {
      // Save to cloud workspace
      await saveToInstitutionalWorkspace();
    } else {
      // Save locally
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data_clone));
    }
  }
  ```
- [ ] Modify `loadData()` to load from institutional workspace if available
- [ ] Add data migration check on first institutional login

## Phase 12: Add Institutional Audit Logging

- [ ] Log all institutional operations:
  - [ ] User login/logout
  - [ ] Data modifications
  - [ ] Permission changes
  - [ ] Invitations sent/accepted
- [ ] Implement audit log viewer (admin only)
- [ ] Add retention policy (e.g., keep 1 year)

## Phase 13: Testing

- [ ] Run full test suite: `TestRunner`
- [ ] Manual testing scenarios:
  - [ ] Teacher signs up without email
  - [ ] Teacher works locally
  - [ ] Teacher verifies email
  - [ ] Teacher accesses institutional workspace
  - [ ] Admin invites teacher
  - [ ] Multiple teachers edit rubric
  - [ ] Offline sync on reconnect
- [ ] Performance testing:
  - [ ] Load time with large dataset
  - [ ] Sync performance
  - [ ] Memory usage
- [ ] Browser compatibility:
  - [ ] Chrome/Chromium
  - [ ] Firefox
  - [ ] Safari
  - [ ] Edge
  - [ ] Mobile browsers

## Phase 14: Deployment

- [ ] Deploy schema to Supabase production
- [ ] Update environment variables in production
- [ ] Deploy app.js changes to production
- [ ] Test in production environment
- [ ] Setup email service (SendGrid, Mailgun, etc.)
- [ ] Configure email templates
- [ ] Setup monitoring and alerting

## Phase 15: Documentation & Support

- [ ] Update user documentation
- [ ] Create teacher onboarding guide
- [ ] Create admin setup guide
- [ ] Record video tutorials
- [ ] Setup FAQ and support channels
- [ ] Create troubleshooting guide

---

## Quick Reference Commands

### Local Testing
```bash
cd /Users/pep/Documents/avaluatron
python3 server.py
# Visit http://localhost:3000
```

### Run Tests
```javascript
// In browser console
const runner = new TestRunner();
runner.runAll();
```

### Check Institutional Files
```javascript
// In browser console
console.log(window.InstitutionalManager);
console.log(window.institutional);
```

### View Institutional Config
```javascript
// In browser console
const institutions = await institutional.getInstitutions();
console.table(institutions);
```

---

## Priority Levels

**Must Have (MVP)**:
- [ ] Phase 1-2: Supabase setup
- [ ] Phase 3-5: Imports and auth
- [ ] Phase 6: Email verification
- [ ] Phase 7: Access mode detection
- [ ] Phase 13: Testing

**Should Have (Phase 1)**:
- [ ] Phase 8: Workspace sync
- [ ] Phase 9: Teacher assignment UI
- [ ] Phase 10: Dashboard
- [ ] Phase 11: Save/load integration

**Nice to Have (Future)**:
- [ ] Phase 12: Audit logging
- [ ] Advanced features

---

## Estimated Effort

- Phase 1-2: 2 hours (Supabase setup)
- Phase 3-5: 4 hours (Integration)
- Phase 6: 3 hours (Email verification)
- Phase 7-8: 4 hours (Access control)
- Phase 9-10: 6 hours (UI implementation)
- Phase 11-12: 4 hours (Save/load, logging)
- Phase 13-15: 8 hours (Testing, docs, deployment)

**Total Estimated Time**: ~31 hours

---

**Last Updated**: 2024
**Current Status**: Ready to implement
**Next Step**: Deploy schema to Supabase
