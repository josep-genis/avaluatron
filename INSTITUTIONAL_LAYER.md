# Institutional Layer Implementation Guide

## Overview
This document describes the institutional layer architecture for Avaluatron, enabling multi-institution support with role-based access control and email verification requirements for cloud-based editing.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     AVALUATRÓ INSTITUTIONAL LAYER                │
└─────────────────────────────────────────────────────────────────┘

                        ┌──────────────────────┐
                        │   Authentication     │
                        │  (Supabase Auth)     │
                        └──────────────────────┘
                                  │
                        ┌─────────┴──────────┐
                        │                    │
                   ┌────▼────┐          ┌────▼────┐
                   │  Local   │          │  Cloud  │
                   │  Storage │          │ Storage │
                   └──────────┘          └────┬────┘
                        │                     │
            ┌───────────┴─────────┐          │
            │                     │          │
        ┌───▼────┐          ┌────▼─────┐    │
        │Teacher │          │Institutional│   │
        │ Local  │          │ Workspace │    │
        │ Mode   │          └───────────┘    │
        └────────┘                            │
                                    ┌─────────▼──────────┐
                                    │  Role-Based Access │
                                    │  - School Admin    │
                                    │  - Teacher         │
                                    │  - Student         │
                                    │  - Parent          │
                                    └────────────────────┘

Access Rules:
- Teachers (Local): Unlimited, no email required
- Teachers (Cloud): Email verified + account required
- School Admin: Full institutional access
- Student/Parent: Read-only institutional data
```

## Data Model

### Core Tables

#### `institutions`
- Represents a school or educational organization
- Has unique code for invitations
- Stores optional email domain for verification
- Supports custom settings

```sql
CREATE TABLE institutions (
  id UUID PRIMARY KEY,
  name TEXT,
  code TEXT UNIQUE,
  email_domain TEXT,
  settings JSONB
)
```

#### `user_profiles`
- Extends Supabase auth.users
- Links users to institutions
- Tracks email verification status
- Supports multiple roles

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY (references auth.users),
  institution_id UUID,
  email TEXT UNIQUE,
  display_name TEXT,
  role TEXT ('school_admin', 'teacher', 'student', 'parent'),
  is_email_verified BOOLEAN
)
```

#### `institutional_workspaces`
- Cloud storage for institution-wide data
- One workspace per institution
- Shared by all users in the institution
- Tracks revision for optimistic locking

```sql
CREATE TABLE institutional_workspaces (
  id UUID PRIMARY KEY,
  institution_id UUID UNIQUE,
  revision BIGINT,
  payload JSONB
)
```

#### `institution_invitations`
- Sends invitations to join institution
- Email-based with expiration
- Tracks who invited and who redeemed

```sql
CREATE TABLE institution_invitations (
  id UUID PRIMARY KEY,
  institution_id UUID,
  email TEXT,
  role TEXT,
  invited_by UUID,
  created_at TIMESTAMP,
  expires_at TIMESTAMP,
  redeemed_at TIMESTAMP,
  redeemed_by UUID
)
```

#### `teacher_students`
- N-to-N relationship between teachers and students
- Institution-scoped
- Used for grade access control

```sql
CREATE TABLE teacher_students (
  id UUID PRIMARY KEY,
  teacher_id UUID,
  student_id UUID,
  institution_id UUID
)
```

## User Roles & Permissions

### School Administrator
- **Access Mode**: Cloud-only
- **Permissions**:
  - Create and manage institutions
  - Edit institutional workspace
  - Invite teachers, students, parents
  - View all users in institution
  - Manage teacher-student relationships
  - Create/manage courses and assignments
- **Email Requirement**: Required at signup

### Teacher
- **Access Modes**:
  - **Local-only** (default): Work offline on device, no email required
  - **Cloud** (after email verification): Collaborate with other teachers, access institutional data
- **Permissions (Local)**:
  - Create and edit own rubrics
  - Grade own students
  - View own assessments
- **Permissions (Cloud, with verified email)**:
  - All local permissions
  - Collaboratively edit institutional rubrics
  - View grades across class groups
  - Access institutional reports
  - View assigned students from institution
  - Assign grades to assigned students
- **Email Requirement**: 
  - Optional for local work
  - Required to unlock cloud features

### Student
- **Access Mode**: Cloud-only (read-only)
- **Permissions**:
  - View own assessments
  - View own grades
  - View own progress
- **Email Requirement**: Not required
- **Future**: Student accounts optional in Phase 1

### Parent
- **Access Mode**: Cloud-only (read-only)
- **Permissions**:
  - View assigned child's grades
  - View assigned child's progress
  - Communicate with assigned teachers
- **Email Requirement**: Not required
- **Future**: Parent accounts optional in Phase 1

## Data Sync Strategy: Cloud-Only

**Rationale**: 
- Teachers need to work locally without internet
- Cloud is for institutional collaboration and reporting
- Clear separation: Local = individual, Cloud = institutional

**Implementation**:
1. Local workspace: Stored on device using existing mechanism
2. Cloud workspace: Stored in Supabase per institution
3. Sync direction: Local → Cloud (teacher uploads work to share)
4. Conflict resolution: Teacher chooses version (local or cloud)
5. Access control: Teachers with verified email can read/write cloud

## Access Control Matrix

```
                 │ Local-Only │ Cloud (Email Verified) │ Cloud (Admin)
─────────────────┼────────────┼───────────────────────┼──────────────
School Admin      │     —      │         —             │   FULL RW
Teacher           │  FULL RW   │        FULL RW        │     —
Student           │   LIMITED  │      READ ONLY        │     —
Parent            │     —      │      READ ONLY        │     —
```

## Email Verification Flow

```
┌────────────────────┐
│ Teacher Signs Up   │
└──────┬─────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Account Created (Local Mode)         │
│ email_verified = false               │
│ can_edit_cloud = false               │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Verification Email Sent              │
│ Contains: Link to verify             │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Teacher Clicks Verification Link     │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Email Verified in Database           │
│ is_email_verified = true             │
│ can_edit_cloud = true                │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Teacher Gains Cloud Access           │
│ Can edit institutional workspaces    │
│ Can view institutional reports       │
└──────────────────────────────────────┘
```

## Code Integration Points

### 1. Modify `app.js` to Check Email Verification

```javascript
// When teacher tries to edit in cloud mode
if (isCloudMode) {
  const canEdit = await institutional.canEditCloud(currentUserId);
  if (!canEdit) {
    showToast("Verifica el teu correu per editar institucional", true);
    return;
  }
}
```

### 2. Update `js/data.js` to Support Institutional Mode

```javascript
export function validateInstitutionalData(value, makeId) {
  // Validate institutional workspace payload
  // Similar to validateData but for shared workspaces
}
```

### 3. Create `js/institutional-auth.js` for Auth Flows

```javascript
export async function loginTeacher(email, password) {
  // 1. Login with Supabase
  // 2. Get user profile
  // 3. Check access mode
  // 4. Load appropriate workspace
}

export async function signupTeacher(email, password, displayName) {
  // 1. Create Supabase user
  // 2. Create user profile
  // 3. Send verification email
  // 4. Load local workspace
}
```

### 4. Update UI to Show Access Mode

```javascript
// In renderSubjectDetail or appropriate place
if (data.teacherProfile?.role === 'teacher') {
  const accessMode = institutional.getAccessMode(profile);
  renderAccessModeBanner(accessMode, profile);
}
```

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [x] Create Supabase schema
- [x] Implement InstitutionalManager class
- [x] Create UI components
- [ ] Integrate authentication flows
- [ ] Add email verification
- [ ] Implement local/cloud mode detection

### Phase 2: Teacher Verification (Weeks 3-4)
- [ ] Email verification workflow
- [ ] Teacher profile completion UI
- [ ] Access mode banner in app
- [ ] Permission guards for cloud editing
- [ ] Testing with sample data

### Phase 3: Institutional Collaboration (Weeks 5-6)
- [ ] Institutional workspace upload/download
- [ ] Data sync between local and cloud
- [ ] Collaborative rubric editing
- [ ] Grade sharing across teachers
- [ ] Institutional reporting dashboard

### Phase 4: Students & Parents (Weeks 7-8)
- [ ] Student account creation (optional)
- [ ] Parent account creation (optional)
- [ ] Student grade viewing
- [ ] Parent notifications
- [ ] Advanced features and polish

## Security Considerations

### Row-Level Security (RLS)
- Implemented for all tables
- Teachers only see their own data
- School admins see institution data
- Students see only own assessments

### Email Verification
- Required for cloud editing
- Prevents unauthorized access
- Domain verification optional (for future)

### Conflict Resolution
- Optimistic locking using revision counter
- Last-write-wins for now
- Future: 3-way merge for complex scenarios

### Data Privacy
- PII stored securely in Supabase
- Local storage encrypted (browser-dependent)
- GDPR compliance considerations

## API Reference

### InstitutionalManager

```javascript
// Institutions
getInstitutions()
getInstitution(institutionId)
createInstitution(name, code, settings)

// User Profiles
getUserProfile(userId)
getCurrentUserProfile()
createUserProfile(userId, email, displayName, role, institutionId)
updateUserProfile(userId, updates)
verifyTeacherEmail(userId)

// Workspaces
getInstitutionalWorkspace(institutionId)
saveInstitutionalWorkspace(institutionId, expectedRevision, payload)

// Invitations
getInstitutionInvitations(institutionId)
createInvitation(institutionId, email, role, userId)
redeemInvitation(invitationId, userId)
deleteInvitation(invitationId)

// Relationships
getTeacherStudents(teacherId)
getStudentTeachers(studentId)
assignStudentToTeacher(teacherId, studentId, institutionId)
unassignStudentFromTeacher(teacherId, studentId)

// Authorization
isSchoolAdmin(userId, institutionId)
isTeacherInInstitution(userId, institutionId)
isTeacherEmailVerified(userId)
canEditCloud(userId)
```

## Testing Scenarios

### Scenario 1: Teacher Local Work
1. Teacher signs up without email
2. Works locally on device
3. Creates rubrics and grades
4. No network required

### Scenario 2: Teacher Cloud Access
1. Teacher signs up and verifies email
2. Gets access to institutional workspace
3. Can collaborate with other teachers
4. Can see institutional reports

### Scenario 3: School Admin Setup
1. Admin creates institution
2. Admin invites teachers
3. Teachers join via invitation
4. Admin manages teacher-student relationships

### Scenario 4: Offline-First Teacher
1. Teacher works offline on device
2. Later verifies email
3. Uploads local data to cloud
4. Continues with cloud access

## Future Enhancements

1. **Domain-based Verification**: Auto-verify if email matches institution domain
2. **Single Sign-On (SSO)**: SAML/OAuth integration for schools
3. **Mobile Apps**: Native iOS/Android apps with offline support
4. **Student Portals**: Full-featured student grade viewing
5. **Parent Notifications**: Email/SMS alerts for grades
6. **API**: REST API for third-party integrations
7. **Analytics**: Advanced institutional reporting and dashboards
8. **Audit Logs**: Track all data modifications for compliance

## Deployment Checklist

- [ ] Supabase schema deployed to production
- [ ] Institutional files deployed to app
- [ ] Auth flows tested and working
- [ ] Email verification service configured
- [ ] Environment variables set
- [ ] RLS policies reviewed and applied
- [ ] Backup and disaster recovery plan in place
- [ ] Documentation updated
- [ ] User guides created
- [ ] Support team trained

## References

- Supabase Docs: https://supabase.com/docs
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Email Verification Best Practices: https://www.owasp.org/index.php/Email_Verification
