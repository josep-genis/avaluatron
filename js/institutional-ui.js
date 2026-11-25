/**
 * Institutional UI Views
 * Components for institution, teacher, and student management
 */

export function renderInstitutionalLogin() {
  return `
    <div class="auth-container">
      <div class="auth-box">
        <h1>Avaluatró · Institució</h1>
        <p>Plataforma col·laborativa per a institució educatives</p>
        
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Accedir</button>
          <button class="auth-tab" data-tab="signup">Crear Compte</button>
        </div>

        <div class="auth-tab-content" data-content="login">
          <form id="auth-login-form">
            <div class="field">
              <label for="login-email">Correu Electrònic</label>
              <input id="login-email" type="email" name="email" required>
            </div>
            <div class="field">
              <label for="login-password">Contrasenya</label>
              <input id="login-password" type="password" name="password" required>
            </div>
            <button type="submit" class="button primary full">Accedir</button>
          </form>
        </div>

        <div class="auth-tab-content" data-content="signup" style="display: none;">
          <form id="auth-signup-form">
            <div class="field">
              <label for="signup-name">Nom Complet</label>
              <input id="signup-name" type="text" name="display_name" required maxlength="120">
            </div>
            <div class="field">
              <label for="signup-email">Correu Electrònic</label>
              <input id="signup-email" type="email" name="email" required>
            </div>
            <div class="field">
              <label for="signup-password">Contrasenya</label>
              <input id="signup-password" type="password" name="password" required minlength="8">
            </div>
            <div class="field">
              <label for="signup-institution">Institució (opcional)</label>
              <input id="signup-institution" type="text" name="institution_code" placeholder="Codi d'institució">
            </div>
            <p class="field-hint">Si tens codi d'institució, ingresa'l per unir-te automàticament. Sinó, podràs crear una nova institució.</p>
            <button type="submit" class="button primary full">Crear Compte</button>
          </form>
        </div>
      </div>
    </div>
  `;
}

export function renderInstitutionalDashboard(user, institution, stats) {
  return `
    <div class="institutional-dashboard">
      <div class="dashboard-header">
        <div class="header-content">
          <h1>${institution.name}</h1>
          <p class="institution-code">Codi: ${institution.code}</p>
          ${institution.email_domain ? `<p class="institution-domain">Domini: ${institution.email_domain}</p>` : ''}
        </div>
        <div class="header-actions">
          <button class="button secondary" id="btn-manage-settings">Configuració</button>
          <button class="button" id="btn-invite-users">Convidar Usuaris</button>
        </div>
      </div>

      <div class="dashboard-stats">
        <div class="stat-card">
          <div class="stat-icon">👨‍🏫</div>
          <div class="stat-content">
            <div class="stat-label">Professors</div>
            <div class="stat-value">${stats.teachers || 0}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">👨‍🎓</div>
          <div class="stat-content">
            <div class="stat-label">Alumnes</div>
            <div class="stat-value">${stats.students || 0}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-content">
            <div class="stat-label">Pares/Mares</div>
            <div class="stat-value">${stats.parents || 0}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚙️</div>
          <div class="stat-content">
            <div class="stat-label">Administradors</div>
            <div class="stat-value">${stats.admins || 0}</div>
          </div>
        </div>
      </div>

      <div class="dashboard-sections">
        <section class="dashboard-section">
          <div class="section-header">
            <h2>Professors</h2>
            <button class="button small" id="btn-add-teacher">Afegir Professor/a</button>
          </div>
          <div id="teachers-list" class="users-list"></div>
        </section>

        <section class="dashboard-section">
          <div class="section-header">
            <h2>Alumnes</h2>
            <button class="button small" id="btn-add-student">Afegir Alumne/a</button>
          </div>
          <div id="students-list" class="users-list"></div>
        </section>

        <section class="dashboard-section">
          <div class="section-header">
            <h2>Invitacions Pendents</h2>
            <button class="button small" id="btn-send-invitation">Enviar Invitació</button>
          </div>
          <div id="invitations-list" class="invitations-list"></div>
        </section>
      </div>
    </div>
  `;
}

export function renderTeacherProfileSetup(user) {
  return `
    <div class="teacher-profile-setup">
      <div class="setup-container">
        <h2>Perfil del Professor/a</h2>
        <p class="setup-description">Completa el teu perfil per accedir a funcionalitats de col·laboració institucional</p>

        <form id="teacher-profile-form" class="setup-form">
          <div class="form-section">
            <h3>Informació Bàsica</h3>
            
            <div class="field">
              <label for="profile-name">Nom Complet</label>
              <input id="profile-name" type="text" name="display_name" value="${user.user_metadata?.name || ''}" required maxlength="120">
            </div>

            <div class="field">
              <label for="profile-email">Correu Electrònic</label>
              <input id="profile-email" type="email" name="email" value="${user.email}" disabled>
              <small>Este correu s'ha verificat automàticament</small>
            </div>

            <div class="field">
              <label for="profile-phone">Telèfon (opcional)</label>
              <input id="profile-phone" type="tel" name="phone" maxlength="20">
            </div>

            <div class="field">
              <label for="profile-bio">Biografia (opcional)</label>
              <textarea id="profile-bio" name="bio" maxlength="500" rows="4" placeholder="Presenta't breument als alumnes i col·legues"></textarea>
            </div>
          </div>

          <div class="form-section">
            <h3>Accés a Funcionalitats</h3>
            
            <div class="feature-info">
              <div class="feature-row">
                <div class="feature-status">
                  <span class="badge local-only">LOCAL</span>
                  <span class="badge cloud-only disabled">NÚVOL</span>
                </div>
                <div class="feature-desc">
                  <strong>Edició de Rúbriques</strong>
                  <p>Actualment pots editar rúbriques localment. Per colaborar amb altres professors a nivell institucional, verifica el teu correu.</p>
                </div>
              </div>

              <div class="feature-row">
                <div class="feature-status">
                  <span class="badge local-only">LOCAL</span>
                  <span class="badge cloud-only disabled">NÚVOL</span>
                </div>
                <div class="feature-desc">
                  <strong>Qualificació de Proves</strong>
                  <p>Actualment qualifiques localment. Verifica el teu correu per collaborar a través del núvol.</p>
                </div>
              </div>

              <div class="feature-row">
                <div class="feature-status">
                  <span class="badge cloud-only">NÚVOL</span>
                </div>
                <div class="feature-desc">
                  <strong>Seguiment Institucional</strong>
                  <p>Accés a dades consolidades de l'alumnat i informes institucionals quan verifiquis el teu correu.</p>
                </div>
              </div>
            </div>

            <div class="email-verification">
              <h4>Verificació de Correu</h4>
              <p>El teu correu electrònic és: <strong>${user.email}</strong></p>
              <p class="verification-status">✓ Verificat</p>
              <p class="verification-note">Un enllaç de verificació s'ha enviat a aquest correu. Per favor, confirma que és correcte.</p>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="button primary">Guardar Perfil</button>
            <button type="button" class="button secondary" id="btn-skip-profile">Continuar més tard (Mode Local)</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function renderInstitutionInvitation() {
  return `
    <div class="invitation-dialog">
      <div class="invitation-content">
        <h3>Convidar a Usuaris</h3>
        <p>Envia invitacions per correu electrònic per afegir professors, alumnes o pares a la institució.</p>

        <form id="invitation-form">
          <div class="field">
            <label for="invitation-email">Correu Electrònic</label>
            <input id="invitation-email" type="email" name="email" required placeholder="exemple@escola.cat">
          </div>

          <div class="field">
            <label for="invitation-role">Rol</label>
            <select id="invitation-role" name="role" required>
              <option value="">-- Selecciona un rol --</option>
              <option value="teacher">Professor/a</option>
              <option value="student">Alumne/a</option>
              <option value="parent">Mare/Pare</option>
            </select>
          </div>

          <div class="field">
            <label for="invitation-message">Missatge Personalitzat (opcional)</label>
            <textarea id="invitation-message" name="message" maxlength="300" rows="3" placeholder="Afegeix un missatge personal a la invitació"></textarea>
          </div>

          <div class="form-actions">
            <button type="submit" class="button primary">Enviar Invitació</button>
            <button type="button" class="button secondary" id="btn-cancel-invitation">Cancel·lar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function renderUserCard(user, role) {
  return `
    <div class="user-card" data-user-id="${user.id}">
      <div class="user-avatar">
        ${user.avatar_url 
          ? `<img src="${user.avatar_url}" alt="${user.display_name}">` 
          : `<div class="avatar-placeholder">${(user.display_name || user.email).charAt(0).toUpperCase()}</div>`
        }
      </div>
      <div class="user-info">
        <div class="user-name">${user.display_name || user.email}</div>
        <div class="user-email">${user.email}</div>
        <div class="user-role">${formatRole(user.role)}</div>
        ${user.role === 'teacher' && !user.is_email_verified 
          ? `<div class="user-status unverified">⚠️ Correu no verificat</div>` 
          : `<div class="user-status verified">✓ Verificat</div>`
        }
      </div>
      <div class="user-actions">
        <button class="button small secondary" data-action="view-profile">Veure Perfil</button>
        <button class="button small danger" data-action="remove-user">Eliminar</button>
      </div>
    </div>
  `;
}

export function renderInvitationCard(invitation) {
  const expiresAt = new Date(invitation.expires_at);
  const isExpired = expiresAt < new Date();
  
  return `
    <div class="invitation-card ${isExpired ? 'expired' : ''}" data-invitation-id="${invitation.id}">
      <div class="invitation-info">
        <div class="invitation-email">${invitation.email}</div>
        <div class="invitation-role">${formatRole(invitation.role)}</div>
        <div class="invitation-date">Enviada: ${new Date(invitation.created_at).toLocaleDateString('ca-ES')}</div>
        <div class="invitation-expiry ${isExpired ? 'expired-text' : ''}">
          Vencimiento: ${expiresAt.toLocaleDateString('ca-ES')}
        </div>
      </div>
      <div class="invitation-actions">
        ${!isExpired 
          ? `<button class="button small secondary" data-action="resend">Reenviar</button>` 
          : `<span class="badge">Vencida</span>`
        }
        <button class="button small danger" data-action="delete">Eliminar</button>
      </div>
    </div>
  `;
}

export function renderAccessModeBanner(accessMode, profile) {
  const bannerConfig = {
    'local_only': {
      icon: '💾',
      title: 'Mode Local',
      message: profile.role === 'teacher' 
        ? 'Estàs treballant localment. Verifica el teu correu per collaborar a nivell institucional.'
        : 'Estàs treballant localment.',
      color: 'info'
    },
    'cloud_only': {
      icon: '☁️',
      title: 'Mode Institucional',
      message: 'Pots colaborar amb altres professors i accedir a dades institucionals.',
      color: 'success'
    },
    'hybrid': {
      icon: '🔄',
      title: 'Mode Híbrid',
      message: 'Pots treballar tant localment com institucional. Els canvis es sincronitzen automàticament.',
      color: 'info'
    }
  };

  const config = bannerConfig[accessMode] || bannerConfig['local_only'];

  return `
    <div class="access-mode-banner banner-${config.color}">
      <span class="banner-icon">${config.icon}</span>
      <div class="banner-content">
        <strong>${config.title}</strong>
        <p>${config.message}</p>
      </div>
      ${accessMode === 'local_only' && profile.role === 'teacher'
        ? `<button class="button small" id="btn-verify-email">Verificar Correu</button>`
        : ''
      }
    </div>
  `;
}

function formatRole(role) {
  const roles = {
    'school_admin': 'Administrator',
    'teacher': 'Professor/a',
    'student': 'Alumne/a',
    'parent': 'Mare/Pare'
  };
  return roles[role] || role;
}

export default {
  renderInstitutionalLogin,
  renderInstitutionalDashboard,
  renderTeacherProfileSetup,
  renderInstitutionInvitation,
  renderUserCard,
  renderInvitationCard,
  renderAccessModeBanner
};
