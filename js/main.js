// avokatfinder.com
const SUPA_URL = 'https://myizauhtpcnkwguralwc.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15aXphdWh0cGNua3dndXJhbHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTY2MzQsImV4cCI6MjA5MDAzMjYzNH0.8ApElblHWaZo5knum86q6fPk7qu5D0dU-aNSZPRoA0U';
const LS_EMAIL = 'af_email';
const LS_UNLOCKED = 'af_unlocked';

// ── Supabase helper ────────────────────────────────────────────────────────────
async function supaFetch(method, path, body) {
  const r = await fetch(SUPA_URL + path, {
    method,
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=minimal' : 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (method === 'POST') return r.ok;
  return r.json();
}

// ── Email storage ──────────────────────────────────────────────────────────────
function getEmail() { return localStorage.getItem(LS_EMAIL) || ''; }
function setEmail(e) { localStorage.setItem(LS_EMAIL, e); localStorage.setItem(LS_UNLOCKED, '1'); }
function isUnlocked() { return !!localStorage.getItem(LS_UNLOCKED); }

// ── Email gate modal ───────────────────────────────────────────────────────────
function buildGateModal(onSuccess) {
  const overlay = document.createElement('div');
  overlay.className = 'gate-overlay';
  overlay.innerHTML = `
    <div class="gate-modal" role="dialog" aria-modal="true" aria-label="Unlock contact details">
      <button class="gate-close" aria-label="Close">✕</button>
      <div class="gate-icon">🔓</div>
      <h3>See Full Contact Details</h3>
      <p>Enter your email to unlock firm contact details and client reviews — free, no spam.</p>
      <input type="email" class="gate-email" placeholder="your@email.com" autocomplete="email">
      <button class="btn btn-primary gate-submit">Unlock for free →</button>
      <p class="gate-error" style="display:none;color:var(--red);font-size:0.85rem;"></p>
      <p class="gate-small">We'll check in once after 7 days to see if you found the right lawyer. That's it.</p>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  const emailInput = overlay.querySelector('.gate-email');
  const btn = overlay.querySelector('.gate-submit');
  const err = overlay.querySelector('.gate-error');
  overlay.querySelector('.gate-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  async function submit() {
    const email = emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      err.style.display = 'block'; err.textContent = 'Please enter a valid email address.'; return;
    }
    btn.disabled = true; btn.textContent = 'Unlocking…';
    // Save to Supabase
    await supaFetch('POST', '/rest/v1/avokatfinder_leads', {
      email,
      page_slug: location.pathname,
      firm_slug: document.querySelector('.firm-card[data-firm-slug]')?.dataset.firmSlug || null,
      situation: null
    });
    setEmail(email);
    overlay.remove();
    revealAllContacts();
    if (onSuccess) onSuccess();
  }

  btn.addEventListener('click', submit);
  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  setTimeout(() => emailInput.focus(), 100);
}

// ── Contact reveal ─────────────────────────────────────────────────────────────
function revealAllContacts() {
  document.querySelectorAll('.firm-contacts-locked').forEach(el => {
    el.classList.remove('firm-contacts-locked');
    el.classList.add('firm-contacts-open');
  });
  document.querySelectorAll('.lock-overlay').forEach(el => el.remove());
}

function lockContacts() {
  document.querySelectorAll('.firm-links').forEach(linksDiv => {
    const card = linksDiv.closest('.firm-card');
    if (!card) return;
    linksDiv.classList.add('firm-contacts-locked');
    const lo = document.createElement('div');
    lo.className = 'lock-overlay';
    lo.innerHTML = `<button class="lock-btn"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Show contact details</button>`;
    lo.querySelector('.lock-btn').addEventListener('click', e => {
      e.stopPropagation();
      if (isUnlocked()) { revealAllContacts(); }
      else { buildGateModal(() => {}); }
    });
    linksDiv.parentNode.insertBefore(lo, linksDiv.nextSibling);
  });
}

// ── Star helpers ───────────────────────────────────────────────────────────────
function starsHtml(rating, interactive) {
  return [1,2,3,4,5].map(n =>
    `<span class="star${interactive ? ' star-btn' : ''}" data-v="${n}">${n <= rating ? '★' : '☆'}</span>`
  ).join('');
}

// ── Reviews ────────────────────────────────────────────────────────────────────
async function loadReviews(firmSlug, container) {
  const data = await supaFetch('GET',
    `/rest/v1/avokatfinder_reviews?firm_slug=eq.${encodeURIComponent(firmSlug)}&approved=eq.true&order=created_at.desc&limit=10`
  );
  const list = container.querySelector('.reviews-list');
  const summary = container.querySelector('.reviews-summary');
  if (!Array.isArray(data) || data.length === 0) {
    list.innerHTML = '';
    return;
  }
  const avg = (data.reduce((s, r) => s + r.rating, 0) / data.length).toFixed(1);
  summary.innerHTML = `<span class="stars-display">${starsHtml(Math.round(avg), false)}</span>
    <strong>${avg}</strong>/5 &nbsp;·&nbsp; ${data.length} review${data.length > 1 ? 's' : ''}`;
  list.innerHTML = data.map(r => `
    <div class="review-item">
      <div class="review-header">
        <span class="stars-display">${starsHtml(r.rating, false)}</span>
        <span class="review-name">${r.reviewer_name}</span>
        <span class="review-date">${new Date(r.created_at).toLocaleDateString('en-GB', {month:'short',year:'numeric'})}</span>
      </div>
      ${r.comment ? `<p class="review-comment">${r.comment}</p>` : ''}
    </div>`).join('');
}

function buildReviewWidget(firmSlug) {
  const div = document.createElement('div');
  div.className = 'reviews-widget';
  div.innerHTML = `
    <div class="reviews-summary"></div>
    <div class="reviews-list"><p class="reviews-empty">Loading…</p></div>
    <div class="review-form-wrap">
      <div class="star-picker">${starsHtml(0, true)}</div>
      <input type="hidden" class="rating-val" value="0">
      <input class="review-name-input" type="text" placeholder="Your name (optional)" maxlength="60">
      <textarea class="review-comment-input" placeholder="Describe your experience (optional)" rows="3" maxlength="500"></textarea>
      <button class="btn btn-primary review-submit">Submit Review</button>
      <p class="review-note">Reviews are published after moderation (usually within 24h).</p>
      <p class="review-msg" style="display:none;margin-top:8px;"></p>
    </div>`;

  const stars = div.querySelectorAll('.star-btn');
  const ratingInput = div.querySelector('.rating-val');
  stars.forEach(s => {
    s.addEventListener('click', () => {
      const v = parseInt(s.dataset.v);
      ratingInput.value = v;
      stars.forEach(x => x.textContent = parseInt(x.dataset.v) <= v ? '★' : '☆');
    });
    s.addEventListener('mouseenter', () => {
      const v = parseInt(s.dataset.v);
      stars.forEach(x => x.textContent = parseInt(x.dataset.v) <= v ? '★' : '☆');
    });
    s.addEventListener('mouseleave', () => {
      const cur = parseInt(ratingInput.value);
      stars.forEach(x => x.textContent = parseInt(x.dataset.v) <= cur ? '★' : '☆');
    });
  });

  div.querySelector('.review-submit').addEventListener('click', async () => {
    if (!isUnlocked()) { buildGateModal(() => {}); return; }
    const rating = parseInt(ratingInput.value);
    const msg = div.querySelector('.review-msg');
    if (!rating) { msg.style.display='block'; msg.textContent='Please select a star rating.'; return; }
    const name = (div.querySelector('.review-name-input').value.trim() || 'Anonymous').slice(0, 60);
    const comment = div.querySelector('.review-comment-input').value.trim().slice(0, 500);
    const btn = div.querySelector('.review-submit');
    btn.disabled = true; btn.textContent = 'Submitting…';
    const ok = await supaFetch('POST', '/rest/v1/avokatfinder_reviews', {
      firm_slug: firmSlug, reviewer_name: name, rating, comment
    });
    msg.style.display = 'block';
    if (ok) {
      msg.style.color = 'green';
      msg.textContent = '✓ Thank you! Your review will appear after moderation.';
      div.querySelector('.review-form-wrap').style.opacity = '0.5';
      btn.style.display = 'none';
    } else {
      msg.style.color = 'var(--red)';
      msg.textContent = 'Something went wrong — please try again.';
      btn.disabled = false; btn.textContent = 'Submit Review';
    }
  });
  return div;
}

// ── Save firm ──────────────────────────────────────────────────────────────────
async function saveFirm(firmSlug, firmName, btn) {
  if (!isUnlocked()) { buildGateModal(() => saveFirm(firmSlug, firmName, btn)); return; }
  const email = getEmail();
  const ok = await supaFetch('POST', '/rest/v1/avokatfinder_saved', { email, firm_slug: firmSlug, firm_name: firmName });
  if (ok) { btn.textContent = '✓ Saved'; btn.disabled = true; }
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
async function loadDashboard() {
  const container = document.getElementById('dashboard-root');
  if (!container) return;
  const email = getEmail();
  if (!email) {
    container.innerHTML = `<div class="dash-gate">
      <p>Enter the email you used on avokatfinder.com to access your saved firms and reviews.</p>
      <input type="email" id="dash-email" placeholder="your@email.com">
      <button class="btn btn-primary" id="dash-login">Access my dashboard →</button>
    </div>`;
    document.getElementById('dash-login').addEventListener('click', () => {
      const e = document.getElementById('dash-email').value.trim();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setEmail(e); loadDashboard(); }
    });
    return;
  }

  container.innerHTML = `<p style="color:var(--text-muted);">Loading your dashboard…</p>`;
  const saved = await supaFetch('GET', `/rest/v1/avokatfinder_saved?email=eq.${encodeURIComponent(email)}&order=created_at.desc`);
  const reviews = await supaFetch('GET', `/rest/v1/avokatfinder_reviews?reviewer_name=neq.Anonymous&order=created_at.desc&limit=20`);

  const savedHtml = Array.isArray(saved) && saved.length
    ? saved.map(s => `<div class="dash-firm">
        <strong>${s.firm_name || s.firm_slug}</strong>
        <a href="/practice-areas/" class="btn btn-small">Find similar</a>
      </div>`).join('')
    : '<p class="reviews-empty">No saved firms yet. Click "Save" on any firm card.</p>';

  container.innerHTML = `
    <div class="dash-header">
      <h2>Your Dashboard</h2>
      <p class="dash-email-display">Logged in as <strong>${email}</strong> &nbsp;
        <button class="btn-link" id="dash-logout">Log out</button></p>
    </div>
    <h3>Saved Firms (${Array.isArray(saved) ? saved.length : 0})</h3>
    <div class="dash-saved-list">${savedHtml}</div>
    <div style="margin-top:32px;">
      <a href="/" class="btn btn-primary">Browse more firms →</a>
    </div>`;

  document.getElementById('dash-logout')?.addEventListener('click', () => {
    localStorage.removeItem(LS_EMAIL); localStorage.removeItem(LS_UNLOCKED); location.reload();
  });
}

// ── Filter ─────────────────────────────────────────────────────────────────────
function initFilter() {
  const btns = document.querySelectorAll('.filter-btn');
  if (!btns.length) return;
  // Ensure empty-state element exists
  let emptyState = document.getElementById('filter-empty-state');
  if (!emptyState) {
    const grid = document.querySelector('.firms-grid');
    if (grid) {
      emptyState = document.createElement('div');
      emptyState.id = 'filter-empty-state';
      emptyState.style.cssText = 'display:none;grid-column:1/-1;text-align:center;padding:48px 24px;';
      emptyState.innerHTML = '<div style="font-size:2.5rem;margin-bottom:12px">🔍</div><h3 style="margin-bottom:8px">No firms match this filter</h3><p style="color:#6b7280;margin-bottom:20px">Try a different practice area or use the lawyer wizard for personalised matches.</p><a href="/find-a-lawyer/" class="btn btn-primary">Use the Lawyer Wizard</a>';
      grid.appendChild(emptyState);
    }
  }
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const area = btn.dataset.area;
      let visible = 0;
      document.querySelectorAll('.firm-card').forEach(card => {
        if (area === 'all') {
          card.style.display = '';
          visible++;
        } else {
          const areas = (card.dataset.areas || '').split(',');
          const show = areas.includes(area);
          card.style.display = show ? '' : 'none';
          if (show) visible++;
        }
      });
      if (emptyState) emptyState.style.display = visible === 0 ? '' : 'none';
    });
  });
}

// ── Init ───────────────────────────────────────────────────────────────────────
(function init() {
  // Mobile nav
  const ham = document.querySelector('.hamburger');
  const navEl = document.querySelector('nav');
  if (ham && navEl) {
    ham.addEventListener('click', () => navEl.classList.toggle('open'));
    document.addEventListener('click', e => {
      if (!ham.contains(e.target) && !navEl.contains(e.target)) navEl.classList.remove('open');
    });
  }

  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
      const ans = q.nextElementSibling;
      const isOpen = ans.classList.contains('open');
      document.querySelectorAll('.faq-answer').forEach(a => a.classList.remove('open'));
      document.querySelectorAll('.faq-question .faq-icon').forEach(i => i.textContent = '+');
      if (!isOpen) { ans.classList.add('open'); q.querySelector('.faq-icon').textContent = '−'; }
    });
  });

  // Lock/unlock contacts
  if (isUnlocked()) { /* already unlocked, contacts visible */ }
  else { lockContacts(); }

  // Mount review widgets + save buttons on firm cards
  document.querySelectorAll('.firm-card[data-firm-slug]').forEach(card => {
    const slug = card.dataset.firmSlug;
    const firmName = card.querySelector('h3')?.textContent || slug;

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-save';
    saveBtn.textContent = '♡ Save firm';
    saveBtn.addEventListener('click', () => saveFirm(slug, firmName, saveBtn));
    card.querySelector('.firm-links')?.after(saveBtn);

    // Review widget
    const widget = buildReviewWidget(slug);
    card.appendChild(widget);
    loadReviews(slug, widget);
  });

  // Filter bar
  initFilter();

  // Dashboard
  loadDashboard();
})();
