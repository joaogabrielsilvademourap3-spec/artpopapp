const state = {
  products: [
    { id: crypto.randomUUID(), name: 'Café 500g', price: 17.9 },
    { id: crypto.randomUUID(), name: 'Leite Integral 1L', price: 5.4 },
    { id: crypto.randomUUID(), name: 'Pão Francês (kg)', price: 14.0 },
  ],
  cart: [],
  history: [],
};

const els = {
  productForm: document.querySelector('#product-form'),
  productName: document.querySelector('#product-name'),
  productPrice: document.querySelector('#product-price'),
  productList: document.querySelector('#product-list'),
  saleForm: document.querySelector('#sale-form'),
  saleProduct: document.querySelector('#sale-product'),
  saleQty: document.querySelector('#sale-qty'),
  cartList: document.querySelector('#cart-list'),
  totalValue: document.querySelector('#total-value'),
  cashReceived: document.querySelector('#cash-received'),
  changeValue: document.querySelector('#change-value'),
  finishSale: document.querySelector('#finish-sale'),
  clearSale: document.querySelector('#clear-sale'),
  historyList: document.querySelector('#history-list'),
  receiptTemplate: document.querySelector('#receipt-template'),
};

function money(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function totalCart() {
  return state.cart.reduce((acc, item) => acc + item.qty * item.price, 0);
}

function renderProducts() {
  els.productList.innerHTML = '';
  els.saleProduct.innerHTML = '';

  state.products.forEach((product) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${product.name}</span><strong>${money(product.price)}</strong>`;
    els.productList.appendChild(li);

    const opt = document.createElement('option');
    opt.value = product.id;
    opt.textContent = `${product.name} — ${money(product.price)}`;
    els.saleProduct.appendChild(opt);
  });
}

function renderCart() {
  els.cartList.innerHTML = '';

  state.cart.forEach((item, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${item.name} x${item.qty}</span>
      <div>
        <strong>${money(item.qty * item.price)}</strong>
        <button data-remove="${index}" class="secondary" type="button">Remover</button>
      </div>`;
    els.cartList.appendChild(li);
  });

  els.totalValue.textContent = money(totalCart());
  updateChange();
}

function updateChange() {
  const received = Number(els.cashReceived.value || 0);
  const change = Math.max(received - totalCart(), 0);
  els.changeValue.textContent = money(change);
}

function renderHistory() {
  els.historyList.innerHTML = '';
  state.history.slice(-10).reverse().forEach((sale) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${sale.date}</span><strong>${money(sale.total)}</strong>`;
    els.historyList.appendChild(li);
  });
}

function addReceipt(sale) {
  const fragment = els.receiptTemplate.content.cloneNode(true);
  const receipt = fragment.querySelector('.receipt');
  const ul = receipt.querySelector('ul');
  const [totalLine, receivedLine, changeLine] = receipt.querySelectorAll('.line strong');

  sale.items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = `${item.name} x${item.qty} — ${money(item.price * item.qty)}`;
    ul.appendChild(li);
  });

  totalLine.textContent = money(sale.total);
  receivedLine.textContent = money(sale.received);
  changeLine.textContent = money(sale.change);

  const old = document.querySelector('.receipt');
  if (old) {
    old.remove();
  }

  document.querySelector('.panel:last-child').appendChild(fragment);
}

els.productForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = els.productName.value.trim();
  const price = Number(els.productPrice.value);

  if (!name || price <= 0) return;

  state.products.push({ id: crypto.randomUUID(), name, price });
  els.productForm.reset();
  renderProducts();
});

els.saleForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const selectedId = els.saleProduct.value;
  const qty = Number(els.saleQty.value);

  const product = state.products.find((item) => item.id === selectedId);
  if (!product || qty <= 0) return;

  const existing = state.cart.find((item) => item.id === selectedId);
  if (existing) {
    existing.qty += qty;
  } else {
    state.cart.push({ ...product, qty });
  }

  els.saleQty.value = '1';
  renderCart();
});

els.cartList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-remove]');
  if (!button) return;

  const index = Number(button.dataset.remove);
  state.cart.splice(index, 1);
  renderCart();
});

els.cashReceived.addEventListener('input', updateChange);

els.finishSale.addEventListener('click', () => {
  const total = totalCart();
  const received = Number(els.cashReceived.value || 0);

  if (state.cart.length === 0 || received < total) {
    alert('Adicione itens e informe um valor recebido suficiente.');
    return;
  }

  const sale = {
    date: new Date().toLocaleString('pt-BR'),
    items: structuredClone(state.cart),
    total,
    received,
    change: received - total,
  };

  state.history.push(sale);
  addReceipt(sale);
  state.cart = [];
  els.cashReceived.value = '';
  renderCart();
  renderHistory();
});

els.clearSale.addEventListener('click', () => {
  state.cart = [];
  els.cashReceived.value = '';
  renderCart();
});

renderProducts();
renderCart();
renderHistory();
