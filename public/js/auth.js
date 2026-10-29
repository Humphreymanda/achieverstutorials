import { supabase } from '/js/supabaseClient.js';
import { redirectIfLoggedIn } from '/js/guard.js';

redirectIfLoggedIn();

const $ = (s) => document.querySelector(s);

function makeFormHandler({ formId, mode }) {
  const form = document.getElementById(formId);
  if (!form) return;
  const errEl = form.querySelector('.form-error');
  const btn = form.querySelector('button[type="submit"]');
  const label = btn.querySelector('.btn-label');
  const spinner = btn.querySelector('.btn-spinner');
  const defaultLabel = label.textContent;

  const showError = (m) => { errEl.textContent = m; errEl.hidden = false; };
  const setLoading = (on) => {
    btn.disabled = on;
    label.textContent = on ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : defaultLabel;
    spinner.hidden = !on;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true;

    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return showError('Please fill in all required fields.');

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.replace('/browse');
      } else {
        const full_name = form.full_name.value.trim();
        const student_number = form.student_number.value.trim();
        if (!full_name) throw new Error('Please enter your full name.');
        if (!student_number) throw new Error('Please enter your student number.');

        const { data: taken } = await supabase.rpc('student_number_taken', { sn: student_number });
        if (taken) throw new Error('That student number is already registered.');

        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name, student_number } },
        });
        if (error) throw error;

        const { data: s } = await supabase.auth.getSession();
        if (s.session) window.location.replace('/browse');
        else showError('Account created. Check your email to confirm, then sign in.');
      }
    } catch (err) {
      showError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  });
}

makeFormHandler({ formId: 'login-form', mode: 'login' });
makeFormHandler({ formId: 'signup-form', mode: 'signup' });