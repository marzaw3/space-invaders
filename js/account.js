// Hexfall - okno logowania i zakładania konta (formularz HTML nad płótnem).
// Zwykły formularz zamiast rysowania na płótnie: działa menedżer haseł, pole hasła i wklejanie.
(function () {
  'use strict';

  const C = window.CONFIG;
  const L = window.Logic;

  const MESSAGES = {
    nick: 'Nick: ' + C.account.nickMinLength + '–' + C.account.nickMaxLength + ' znaków – litery, cyfry, _ i -',
    password: 'Hasło musi mieć co najmniej ' + C.account.passwordMinLength + ' znaków',
    weak_password: 'Hasło musi mieć co najmniej ' + C.account.passwordMinLength + ' znaków',
    nick_taken: 'Ten nick jest zajęty',
    bad_credentials: 'Zły nick lub hasło',
    rate_limit: 'Za dużo prób – spróbuj za chwilę',
    offline: 'Brak połączenia – logowanie działa tylko online',
    unknown: 'Coś poszło nie tak – spróbuj ponownie',
  };

  const root = document.getElementById('account');
  const form = root.querySelector('form');
  const nickInput = form.elements.nick;
  const passwordInput = form.elements.password;
  const errorBox = root.querySelector('.account-error');
  const buttons = Array.from(form.querySelectorAll('button'));
  nickInput.maxLength = C.account.nickMaxLength;

  let onClose = null;
  let busy = false;

  function showError(key) {
    errorBox.textContent = key ? MESSAGES[key] : '';
  }

  function setBusy(value) {
    busy = value;
    buttons.forEach(b => { b.disabled = value; });
  }

  function close(result) {
    if (root.hidden) return;
    // Fokus w ukrytym polu łapałby jeszcze chwilę klawisze, a okno nie przepuszcza ich do gry.
    if (root.contains(document.activeElement)) document.activeElement.blur();
    root.hidden = true;
    passwordInput.value = '';
    showError(null);
    const done = onClose;
    onClose = null;
    if (done) done(result);
  }

  // Enter w polu = pierwszy przycisk (Zaloguj).
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    const action = e.submitter && e.submitter.value === 'register' ? 'register' : 'login';
    const nick = L.validateNick(nickInput.value, C);
    if (!nick.ok) {
      showError('nick');
      nickInput.focus();
      return;
    }
    if (!L.validatePassword(passwordInput.value, C).ok) {
      showError('password');
      passwordInput.focus();
      return;
    }
    showError(null);
    setBusy(true);
    const result = await Cloud[action](nick.nick, passwordInput.value);
    setBusy(false);
    if (result.ok) close(action);
    else showError(result.error);
  });

  // Klawisze nie dochodzą do gry, dopóki okno jest otwarte; Esc zamyka bez zmian.
  function cancel() {
    if (!busy) close(null);
  }

  root.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.code === 'Escape') cancel();
  });
  root.addEventListener('keyup', e => e.stopPropagation());
  form.querySelector('.account-cancel').addEventListener('click', cancel);
  // Kliknięcie w przyciemnione tło (poza oknem) też wraca do menu.
  root.addEventListener('click', e => { if (e.target === root) cancel(); });

  window.Account = {
    // onDone(wynik): 'login' | 'register' po udanym zalogowaniu/rejestracji, null po zamknięciu.
    open(onDone) {
      onClose = onDone;
      root.hidden = false;
      showError(Cloud.status() === 'offline' ? 'offline' : null);
      nickInput.focus();
      nickInput.select();
    },
    // Zamyka bez zmian (jak Esc); w trakcie wysyłania nic nie robi.
    close: cancel,
  };
})();
