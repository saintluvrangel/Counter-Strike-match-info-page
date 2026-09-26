(function initUsersModule(root) {
  'use strict';

  let initialized = false;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  function roleOptions(user) {
    const roles = user.role === 'root'
      ? [['user', 'Пользователь'], ['media_editor', 'Media editor'], ['admin', 'Administrator'], ['root', 'Root']]
      : [['user', 'Пользователь'], ['media_editor', 'Media editor'], ['admin', 'Administrator']];
    return roles.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  }

  async function render() {
    if (!root.Auth.can('users_manage')) return;
    const currentUser = root.Auth.getUser();
    document.getElementById('role-select').innerHTML = roleOptions(currentUser);
    document.getElementById('role-hint').textContent = currentUser.role === 'root'
      ? 'Root может назначать роли Пользователь, Media editor, Administrator и Root.'
      : 'Administrator может назначать роли Пользователь, Media editor и Administrator. Root-аккаунты защищены.';
    const list = document.getElementById('users-list');
    list.innerHTML = '<div class="view-loading">Загрузка пользователей…</div>';
    try {
      const users = await root.Auth.listUsers();
      list.innerHTML = users.map((user) => `<article class="user-row">
        <span class="user-avatar" aria-hidden="true">${escapeHtml(user.email.slice(0, 2).toUpperCase())}</span>
        <div><strong>${escapeHtml(user.email)}</strong><small>${escapeHtml(root.Auth.roleLabel(user.role))}${user.isSystem ? ' · системный аккаунт' : ''}</small></div>
        <button type="button" class="secondary-button" data-user-email="${escapeHtml(user.email)}" ${user.isSystem || user.id === currentUser.id ? 'disabled' : ''}>Выбрать</button>
      </article>`).join('');
    } catch (error) {
      list.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    document.getElementById('users-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-user-email]');
      if (!button || button.disabled) return;
      document.getElementById('role-email').value = button.dataset.userEmail;
      document.getElementById('role-email').focus();
    });
    document.getElementById('role-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = document.getElementById('role-error');
      const success = document.getElementById('role-success');
      const submit = event.currentTarget.querySelector('[type="submit"]');
      const data = new FormData(event.currentTarget);
      error.hidden = true;
      success.hidden = true;
      submit.disabled = true;
      try {
        const user = await root.Auth.assignRole(data.get('email'), data.get('role'));
        success.textContent = `Для ${user.email} назначена роль ${root.Auth.roleLabel(user.role)}.`;
        success.hidden = false;
        await render();
      } catch (assignError) {
        error.textContent = assignError.message;
        error.hidden = false;
      } finally {
        submit.disabled = false;
      }
    });
  }

  root.Users = { init, render };
})(window);
