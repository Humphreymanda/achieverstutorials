import { supabase } from '/js/supabaseClient.js';
import { requireAuth } from '/js/guard.js';

export async function initAppLayout() {
  const session = await requireAuth();
  if (!session) return null;

  const currentTheme = localStorage.getItem('theme');
  if (currentTheme === 'dark') document.body.classList.add('dark-theme');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'Student';
  const initials = firstName.charAt(0).toUpperCase();

  // Time-based greeting
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';

    // Top Navbar
  const navPlaceholder = document.getElementById('navbar-placeholder');
  if (navPlaceholder) {
    const path = window.location.pathname;
    navPlaceholder.innerHTML = `
      <nav class="navbar">
        <div class="nav-container">
          <a href="/browse" class="nav-brand">
            <img src="/assets/logo.png" alt="achievers tutorials" />
          </a>
          <div class="nav-links">
            <a href="/browse" class="${path.includes('browse') ? 'active' : ''}">Browse</a>
            <a href="/my-courses" class="${path.includes('my-courses') ? 'active' : ''}">My Courses</a>
          </div>
          <div class="nav-user">
            <button id="desktop-account-btn" class="avatar-btn">${initials}</button>
          </div>
        </div>
      </nav>
    `;
  }

  // Account Modal
  const accountModal = document.createElement('div');
  accountModal.id = 'account-modal';
  accountModal.className = 'modal-backdrop';
  accountModal.innerHTML = `
    <div class="account-sheet">
      <div class="profile-info">
        <div class="profile-avatar">${initials}</div>
        <h2 class="profile-name">${profile?.full_name || 'Student'}</h2>
        <p class="profile-email">${session.user.email}</p>
        <p style="font-size: 13px; color: var(--ink-600); margin-top: 6px; font-weight: 500;">ID: ${profile?.student_number || 'N/A'}</p>
      </div>
      <div class="settings-row">
        <span class="settings-label">Dark Mode</span>
        <label class="toggle-switch">
          <input type="checkbox" id="theme-toggle" ${currentTheme === 'dark' ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
      <button id="modal-logout" class="btn-primary" style="width: 100%; margin-top: 24px; background: var(--navy-900); color: var(--bg-card); padding: 14px; border-radius: 12px; border: none; font-weight: 600; font-size: 15px; cursor: pointer;">Log out</button>
    </div>
  `;
  document.body.appendChild(accountModal);

  // Mobile Bottom Nav
  const mobileNav = document.createElement('div');
  mobileNav.className = 'mobile-bottom-nav';
  const path = window.location.pathname;
  
  mobileNav.innerHTML = `
    <a href="/browse" class="${path.includes('browse') ? 'active' : ''}">
      <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
      <span>Home</span>
    </a>
    <a href="/my-courses" class="${path.includes('my-courses') ? 'active' : ''}">
      <svg viewBox="0 0 24 24"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>
      <span>Courses</span>
    </a>
    <button id="mobile-account-btn">
      <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
      <span>Account</span>
    </button>
  `;
  document.body.appendChild(mobileNav);

  // Events
  const handleLogout = async () => { await supabase.auth.signOut(); window.location.replace('/login'); };
  document.getElementById('modal-logout').addEventListener('click', handleLogout);

  const toggleModal = () => accountModal.classList.toggle('show');
  document.getElementById('desktop-account-btn')?.addEventListener('click', toggleModal);
  document.getElementById('mobile-account-btn')?.addEventListener('click', toggleModal);
  
  accountModal.addEventListener('click', (e) => {
    if (e.target === accountModal) accountModal.classList.remove('show');
  });

  document.getElementById('theme-toggle').addEventListener('change', (e) => {
    if (e.target.checked) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  });

  return { session, greeting, firstName };
}