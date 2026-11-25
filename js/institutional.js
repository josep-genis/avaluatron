/**
 * Institutional Layer for Avaluatron
 * Manages multi-institution support with role-based access control
 */

export class InstitutionalManager {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  // ====================================================================
  // INSTITUTION MANAGEMENT
  // ====================================================================

  async getInstitutions() {
    const { data, error } = await this.supabase
      .from('institutions')
      .select('id, name, code, email_domain, description, logo_url, settings');
    
    if (error) throw error;
    return data || [];
  }

  async getInstitution(institutionId) {
    const { data, error } = await this.supabase
      .from('institutions')
      .select('*')
      .eq('id', institutionId)
      .single();
    
    if (error) throw error;
    return data;
  }

  async createInstitution(name, code, settings = {}) {
    const { data, error } = await this.supabase
      .from('institutions')
      .insert({
        name,
        code,
        settings
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // ====================================================================
  // USER PROFILE MANAGEMENT
  // ====================================================================

  async getUserProfile(userId) {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  }

  async getCurrentUserProfile() {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return null;
    return this.getUserProfile(user.id);
  }

  async createUserProfile(userId, email, displayName, role, institutionId = null) {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .insert({
        id: userId,
        email,
        display_name: displayName,
        role,
        institution_id: institutionId
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateUserProfile(userId, updates) {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async verifyTeacherEmail(userId) {
    const { data, error } = await this.supabase.rpc('verify_teacher_email', {
      user_id_param: userId
    });
    
    if (error) throw error;
    return true;
  }

  // ====================================================================
  // INSTITUTIONAL WORKSPACE MANAGEMENT
  // ====================================================================

  async getInstitutionalWorkspace(institutionId) {
    const { data, error } = await this.supabase
      .from('institutional_workspaces')
      .select('id, revision, payload, created_at, updated_at')
      .eq('institution_id', institutionId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    return data || null;
  }

  async saveInstitutionalWorkspace(institutionId, expectedRevision, payload) {
    const { data, error } = await this.supabase.rpc(
      'save_institutional_workspace',
      {
        institution_id_param: institutionId,
        expected_revision: expectedRevision,
        new_payload: payload
      }
    );
    
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Conflict: Workspace has been modified elsewhere');
    }
    return data[0].revision;
  }

  // ====================================================================
  // INVITATION MANAGEMENT
  // ====================================================================

  async getInstitutionInvitations(institutionId) {
    const { data, error } = await this.supabase
      .from('institution_invitations')
      .select('*')
      .eq('institution_id', institutionId)
      .is('redeemed_at', null)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async createInvitation(institutionId, email, role, userId) {
    const { data, error } = await this.supabase
      .from('institution_invitations')
      .insert({
        institution_id: institutionId,
        email,
        role,
        invited_by: userId
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async redeemInvitation(invitationId, userId) {
    const { data, error } = await this.supabase.rpc(
      'redeem_institution_invitation',
      {
        invitation_id_param: invitationId,
        user_id_param: userId
      }
    );
    
    if (error) throw error;
    if (!data || !data[0] || !data[0].success) {
      throw new Error('Invalid or expired invitation');
    }
    return data[0];
  }

  async deleteInvitation(invitationId) {
    const { error } = await this.supabase
      .from('institution_invitations')
      .delete()
      .eq('id', invitationId);
    
    if (error) throw error;
  }

  // ====================================================================
  // TEACHER-STUDENT RELATIONSHIPS
  // ====================================================================

  async getTeacherStudents(teacherId) {
    const { data, error } = await this.supabase
      .from('teacher_students')
      .select('student_id, students:student_id(id, display_name, email)')
      .eq('teacher_id', teacherId);
    
    if (error) throw error;
    return data || [];
  }

  async getStudentTeachers(studentId) {
    const { data, error } = await this.supabase
      .from('teacher_students')
      .select('teacher_id, teachers:teacher_id(id, display_name, email)')
      .eq('student_id', studentId);
    
    if (error) throw error;
    return data || [];
  }

  async assignStudentToTeacher(teacherId, studentId, institutionId) {
    const { data, error } = await this.supabase
      .from('teacher_students')
      .insert({
        teacher_id: teacherId,
        student_id: studentId,
        institution_id: institutionId
      })
      .select()
      .single();
    
    if (error && error.code !== '23505') {
      throw error;
    }
    return data;
  }

  async unassignStudentFromTeacher(teacherId, studentId) {
    const { error } = await this.supabase
      .from('teacher_students')
      .delete()
      .eq('teacher_id', teacherId)
      .eq('student_id', studentId);
    
    if (error) throw error;
  }

  // ====================================================================
  // INSTITUTION MEMBERS
  // ====================================================================

  async getInstitutionMembers(institutionId, role = null) {
    let query = this.supabase
      .from('user_profiles')
      .select('id, email, display_name, role, is_email_verified, avatar_url, created_at')
      .eq('institution_id', institutionId);
    
    if (role) {
      query = query.eq('role', role);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async getInstitutionTeachers(institutionId) {
    return this.getInstitutionMembers(institutionId, 'teacher');
  }

  async getInstitutionStudents(institutionId) {
    return this.getInstitutionMembers(institutionId, 'student');
  }

  async getInstitutionParents(institutionId) {
    return this.getInstitutionMembers(institutionId, 'parent');
  }

  // ====================================================================
  // AUTHORIZATION HELPERS
  // ====================================================================

  async isSchoolAdmin(userId, institutionId) {
    const profile = await this.getUserProfile(userId);
    return profile && profile.role === 'school_admin' && profile.institution_id === institutionId;
  }

  async isTeacherInInstitution(userId, institutionId) {
    const profile = await this.getUserProfile(userId);
    return profile && profile.role === 'teacher' && profile.institution_id === institutionId;
  }

  async isTeacherEmailVerified(userId) {
    const profile = await this.getUserProfile(userId);
    return profile && profile.role === 'teacher' && profile.is_email_verified;
  }

  async canEditCloud(userId) {
    const profile = await this.getUserProfile(userId);
    if (!profile) return false;
    
    // Teachers must have verified email to edit in cloud
    if (profile.role === 'teacher') {
      return profile.is_email_verified;
    }
    
    // School admins and parents can edit
    return profile.role in ['school_admin', 'parent'];
  }

  // ====================================================================
  // LOCAL WORKSPACE SYNC
  // ====================================================================

  async getLocalSyncStatus(userId) {
    const { data, error } = await this.supabase
      .from('local_workspace_sync')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    return data || null;
  }

  async updateLocalSyncStatus(userId, localData, syncStatus = 'synced', lastError = null) {
    const existing = await this.getLocalSyncStatus(userId);
    
    if (existing) {
      const { error } = await this.supabase
        .from('local_workspace_sync')
        .update({
          local_data: localData,
          synced_at: now(),
          sync_status: syncStatus,
          last_error: lastError
        })
        .eq('user_id', userId);
      
      if (error) throw error;
    } else {
      const { error } = await this.supabase
        .from('local_workspace_sync')
        .insert({
          user_id: userId,
          local_data: localData,
          synced_at: now(),
          sync_status: syncStatus,
          last_error: lastError
        });
      
      if (error) throw error;
    }
  }

  // ====================================================================
  // UTILITY FUNCTIONS
  // ====================================================================

  /**
   * Check if a teacher can edit the given subject
   * Rules:
   * - If local mode: always allow
   * - If cloud mode: require verified email
   */
  canTeacherEditSubject(profile, isLocalMode = true) {
    if (isLocalMode) return true;
    
    if (profile.role !== 'teacher') return false;
    return profile.is_email_verified;
  }

  /**
   * Get access mode for user
   * Returns: 'local_only', 'cloud_only', or 'hybrid'
   */
  getAccessMode(profile) {
    if (!profile) return 'local_only';
    
    if (profile.role === 'teacher' && !profile.is_email_verified) {
      return 'local_only';
    }
    
    if (profile.role === 'school_admin' || profile.role === 'parent' || profile.is_email_verified) {
      return 'cloud_only';
    }
    
    return 'local_only';
  }

  /**
   * Format user display for UI
   */
  formatUserDisplay(profile) {
    return {
      name: profile.display_name || profile.email,
      email: profile.email,
      role: this.formatRole(profile.role),
      verified: profile.role === 'teacher' ? profile.is_email_verified : true
    };
  }

  formatRole(role) {
    const roles = {
      'school_admin': 'Administrator',
      'teacher': 'Professor/a',
      'student': 'Alumne/a',
      'parent': 'Pares/Mares'
    };
    return roles[role] || role;
  }
}

export default InstitutionalManager;
