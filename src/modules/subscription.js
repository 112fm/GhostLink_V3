(() => {
const GhostLinkV3 = window.GhostLinkV3 = window.GhostLinkV3 || {};

GhostLinkV3.initSubscriptionModule = function initSubscriptionModule(dependencies = {}) {
  const { showToast, copyText, openOverlay, closeOverlay, returnToHome } = dependencies;

// Extend Subscription Page Logic
const bentoExtend = document.querySelector('.bento-extend');
const pageExtend = document.getElementById('page-extend');
const btnExtendBack = document.getElementById('btn-extend-back');

if (bentoExtend && pageExtend && btnExtendBack) {
  bentoExtend.addEventListener('click', () => {
    openOverlay(pageExtend);
  });
  
  btnExtendBack.addEventListener('click', () => {
    closeOverlay(pageExtend);
  });
}

// Checkout (Payment) Page State Machine & Logic
const btnPay = document.getElementById('btn-pay');
const pageCheckout = document.getElementById('page-checkout');
const btnCheckoutBack = document.getElementById('btn-checkout-back');

const checkoutFormView = document.getElementById('checkout-form-view');
const checkoutPendingView = document.getElementById('checkout-pending-view');
const checkoutApprovedView = document.getElementById('checkout-approved-view');
const checkoutRejectedView = document.getElementById('checkout-rejected-view');
const btnPendingHome = document.getElementById('btn-pending-home');

const btnCopyPhone = document.getElementById('btn-copy-phone');
const btnSubmitPayment = document.getElementById('btn-submit-payment');
const btnRetryPayment = document.getElementById('btn-retry-payment');
const payerNameInput = document.getElementById('payer-name-input');
const reqBankName = document.getElementById('req-bank-name');
const reqPhoneNum = document.getElementById('req-phone-num');
const reqRecipientName = document.getElementById('req-recipient-name');
const pendingBankEl = document.getElementById('pending-bank-val');
const pendingPayerEl = document.getElementById('pending-payer-val');
const pendingTimeEl = document.getElementById('pending-time-val');
const approvedAmountEl = document.getElementById('approved-amount-val');
const rejectedPlanEl = document.getElementById('rejected-plan-val');
const rejectedAmountEl = document.getElementById('rejected-amount-val');
const rejectedPayerEl = document.getElementById('rejected-payer-val');
const confirmationNameDot = document.getElementById('confirmation-name-dot');
const confirmationNameText = document.getElementById('confirmation-name-text');
const confirmationBankName = document.getElementById('confirmation-bank-name');
const paymentConfig = window.GhostLinkPaymentConfig;
let currentPaymentRequest = null;

function renderPaymentDetails(details) {
  const bankLabel = paymentConfig?.banks[details.bankKey] || paymentConfig?.banks.tbank || 'Т-Банк';
  if (pageCheckout) pageCheckout.dataset.bank = details.bankKey;
  if (reqBankName) reqBankName.textContent = bankLabel;
  if (confirmationBankName) confirmationBankName.textContent = bankLabel;
  if (pendingBankEl) pendingBankEl.textContent = bankLabel;
  if (reqPhoneNum) reqPhoneNum.textContent = details.destination || details.phone;
  if (reqRecipientName) reqRecipientName.textContent = `Получатель: ${details.recipient}`;
  if (btnCopyPhone) {
    const destinationLabel = details.destinationLabel || 'Номер';
    btnCopyPhone.setAttribute('aria-label', `Скопировать: ${destinationLabel.toLowerCase()}`);
    btnCopyPhone.setAttribute('title', `Скопировать: ${destinationLabel.toLowerCase()}`);
  }
}

function isValidPayerName(value) {
  return /^\p{L}{2,}(?:[\s-]+\p{L}{1,}\.?)+$/u.test(value.trim());
}

function updatePayerCheck() {
  const hasName = isValidPayerName(payerNameInput?.value || '');
  if (confirmationNameDot) {
    confirmationNameDot.textContent = hasName ? '✓' : '•';
    confirmationNameDot.classList.toggle('is-ready', hasName);
  }
  if (confirmationNameText) {
    confirmationNameText.textContent = hasName ? 'Имя отправителя указано' : 'Укажи имя и фамилию как в банке';
  }
  payerNameInput?.classList.toggle('is-valid', hasName);
  return hasName;
}

function setPaymentDetails(nextDetails) {
  const details = paymentConfig ? paymentConfig.set(nextDetails) : nextDetails;
  renderPaymentDetails(details);
  return details;
}

// Admin integration point: the future settings form can use this API without knowing the markup.
window.GhostLinkPayment = Object.freeze({
  getDetails: () => paymentConfig?.get() || {},
  setDetails: setPaymentDetails,
  setBank: bankKey => setPaymentDetails({ bankKey }),
  resetDetails: () => {
    const details = paymentConfig?.reset() || {};
    renderPaymentDetails(details);
    return details;
  },
});

renderPaymentDetails(paymentConfig?.get() || {
  bankKey: 'tbank',
  phone: '+7 (000) 000-00-00',
  recipient: 'Тестовый получатель',
});
updatePayerCheck();

if (payerNameInput) {
  payerNameInput.addEventListener('input', () => {
    payerNameInput.classList.remove('error');
    updatePayerCheck();
  });
}

function setCheckoutView(state) {
  if (!checkoutFormView) return;
  checkoutFormView.style.display = state === 'form' ? 'flex' : 'none';
  checkoutPendingView.style.display = state === 'pending' ? 'flex' : 'none';
  checkoutApprovedView.style.display = state === 'approved' ? 'flex' : 'none';
  checkoutRejectedView.style.display = state === 'rejected' ? 'flex' : 'none';
}

// V3 prototype starts every new session at the payment form.
setCheckoutView('form');

if (btnPay && pageCheckout && btnCheckoutBack) {
  btnPay.addEventListener('click', () => {
    // Never reopen a stale pending screen when starting a new payment flow.
    setCheckoutView('form');
    // Collect active values from Extend screen
    const activeTariff = document.querySelector('input[name="tariff-period"]:checked');
    const activeDeviceType = document.querySelector('input[name="device-type"]:checked').value;
    const months = activeTariff ? parseInt(activeTariff.value, 10) : 1;
    const totalDev = activeDeviceType === 'flex' ? flexDevCount : 2;
    const totalAmount = PRICE_TABLE[totalDev][months];

    const planName = activeDeviceType === 'flex' ? `Flex Squad ${totalDev}` : 'Solo Ghost';
    const periodText = `${months} ${months === 1 ? 'месяц' : 'месяца'} · ${totalDev} ${totalDev === 2 || totalDev === 3 || totalDev === 4 ? 'устройства' : 'устройств'}`;

    // Populate Checkout screen safely
    const targetPlanEl = document.getElementById('checkout-target-plan');
    const targetPeriodEl = document.getElementById('checkout-target-period');
    const targetDevEl = document.getElementById('checkout-target-dev');
    const targetAmountEl = document.getElementById('checkout-target-amount');
    const pendingPlanEl = document.getElementById('pending-plan-val');
    const pendingAmountEl = document.getElementById('pending-amount-val');
    const approvedPlanEl = document.getElementById('approved-plan-val');
    const approvedDevEl = document.getElementById('approved-dev-val');

    if (targetPlanEl) targetPlanEl.textContent = activeDeviceType === 'flex' ? `Flex Squad ${totalDev}` : 'Solo Ghost';
    if (targetPeriodEl) targetPeriodEl.textContent = `${months} ${months === 1 ? 'месяц' : 'месяца'}`;
    if (targetDevEl) targetDevEl.textContent = `${totalDev} ${totalDev === 2 || totalDev === 3 || totalDev === 4 ? 'устройства' : 'устройств'}`;
    if (targetAmountEl) targetAmountEl.textContent = `${totalAmount} ₽`;
    if (pendingPlanEl) pendingPlanEl.textContent = planName;
    if (pendingAmountEl) pendingAmountEl.textContent = `${totalAmount} ₽`;
    if (pendingBankEl) pendingBankEl.textContent = reqBankName?.textContent || 'Т-Банк';
    if (approvedPlanEl) approvedPlanEl.textContent = planName;
    if (approvedDevEl) approvedDevEl.textContent = `${totalDev}`;
    if (approvedAmountEl) approvedAmountEl.textContent = `${totalAmount} ₽`;
    if (rejectedPlanEl) rejectedPlanEl.textContent = planName;
    if (rejectedAmountEl) rejectedAmountEl.textContent = `${totalAmount} ₽`;

    // Each new request receives its own immutable payment-details snapshot.
    // Changing the active admin profile later must not rewrite this checkout.
    if (window.GhostLinkV3?.PaymentSettingsMock) {
      currentPaymentRequest = window.GhostLinkV3.PaymentSettingsMock.createPaymentSnapshot({
        requestId: `local-payment-${Date.now()}`,
        planId: activeDeviceType === 'flex' ? `flex-${totalDev}` : 'solo-ghost',
        amount: totalAmount,
      });
      const snapshotView = paymentConfig?.fromSnapshot(
        currentPaymentRequest.paymentDetailsSnapshot,
      );
      if (snapshotView) renderPaymentDetails(snapshotView);
    }

    openOverlay(pageCheckout);
  });

  btnCheckoutBack.addEventListener('click', () => {
    closeOverlay(pageCheckout);
  });
}

// Copy phone number
if (btnCopyPhone) {
  btnCopyPhone.addEventListener('click', async () => {
    const phoneNum = document.getElementById('req-phone-num')?.textContent || '+7 (000) 000-00-00';
    const copied = await copyText(phoneNum);
    showToast(copied ? 'Реквизиты скопированы' : 'Не удалось скопировать. Нажмите и удерживайте реквизиты.');
  });
}

// Submit payment confirmation
if (btnSubmitPayment && payerNameInput) {
  btnSubmitPayment.addEventListener('click', () => {
    const nameVal = payerNameInput.value.trim();
    const validName = updatePayerCheck();
    if (!validName) {
      payerNameInput.classList.add('error');
      showToast(nameVal ? "Укажи имя и фамилию как в банковском переводе" : "Укажи имя отправителя перевода");
      payerNameInput.focus();
      return;
    }
    
    payerNameInput.classList.remove('error');
    if (pendingPayerEl) pendingPayerEl.textContent = nameVal;
    if (rejectedPayerEl) rejectedPayerEl.textContent = nameVal;
    if (pendingTimeEl) {
      pendingTimeEl.textContent = new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());
    }
    
    // Prevent double submission
    btnSubmitPayment.disabled = true;
    btnSubmitPayment.textContent = 'Заявка отправляется...';

    setTimeout(() => {
      setCheckoutView('pending');
      btnSubmitPayment.disabled = false;
      btnSubmitPayment.textContent = 'Я оплатил';
    }, 600);
  });

  payerNameInput.addEventListener('input', () => {
    payerNameInput.classList.remove('error');
  });
}

// Retry payment button
if (btnRetryPayment) {
  btnRetryPayment.addEventListener('click', () => {
    if (payerNameInput) {
      payerNameInput.value = '';
      payerNameInput.classList.remove('error');
    }
    updatePayerCheck();
    setCheckoutView('form');
  });
}

if (btnPendingHome) {
  btnPendingHome.addEventListener('click', () => {
    returnToHome();
  });
}

const btnApprovedHome = document.getElementById('btn-approved-home');
if (btnApprovedHome) {
  btnApprovedHome.addEventListener('click', () => {
    returnToHome();
  });
}

// Pricing Calculator Logic
const tariffRadios = document.querySelectorAll('input[name="tariff-period"]');
const deviceRadios = document.querySelectorAll('input[name="device-type"]');
const flexCountEl = document.getElementById('flex-dev-count');
const btnDevMinus = document.getElementById('btn-dev-minus');
const btnDevPlus = document.getElementById('btn-dev-plus');

let flexDevCount = 3;

const PRICE_TABLE = {
  2: { 1: 150, 2: 290, 3: 430 },
  3: { 1: 350, 2: 630, 3: 840 },
  4: { 1: 450, 2: 810, 3: 1080 },
  5: { 1: 500, 2: 900, 3: 1200 }
};

function calculateTotals() {
  const activeTariff = document.querySelector('input[name="tariff-period"]:checked');
  const activeDeviceType = document.querySelector('input[name="device-type"]:checked').value;
  
  let totalDevices = 2; // Solo Ghost
  if (activeDeviceType === 'flex') {
    totalDevices = flexDevCount;
  }

  // Update prices shown on the month cards dynamically based on totalDevices
  const price1 = PRICE_TABLE[totalDevices][1];
  const price2 = PRICE_TABLE[totalDevices][2];
  const price3 = PRICE_TABLE[totalDevices][3];

  const pCard1 = document.getElementById('price-card-1');
  const pCard2 = document.getElementById('price-card-2');
  const pCard3 = document.getElementById('price-card-3');
  const subCard1 = document.getElementById('subprice-card-1');
  const subCard2 = document.getElementById('subprice-card-2');
  const subCard3 = document.getElementById('subprice-card-3');

  if (pCard1) pCard1.textContent = `${price1} ₽`;
  if (pCard2) pCard2.textContent = `${price2} ₽`;
  if (pCard3) pCard3.textContent = `${price3} ₽`;
  if (subCard1) subCard1.textContent = `${price1} ₽ / мес`;
  if (subCard2) subCard2.textContent = `${Math.round(price2 / 2)} ₽ / мес`;
  if (subCard3) subCard3.textContent = `${Math.round(price3 / 3)} ₽ / мес`;
  
  const months = parseInt(activeTariff.value, 10);
  const totalPrice = PRICE_TABLE[totalDevices][months];
  
  // Dynamic Description Above Swiper
  const devicesDescEl = document.getElementById('devices-desc');
  if (devicesDescEl) {
    if (activeDeviceType === 'flex') {
      devicesDescEl.textContent = 'Гибкий тариф под нужное количество устройств';
    } else {
      devicesDescEl.textContent = 'Базовый тариф — всего 2 устройства';
    }
  }

  // Dynamic Highlight for Device Icons Pill Widget
  const iconPhone = document.getElementById('icon-phone');
  const iconLaptop = document.getElementById('icon-laptop');
  const iconTv = document.getElementById('icon-tv');
  if (iconPhone && iconLaptop && iconTv) {
    if (totalDevices === 2) {
      iconPhone.classList.add('active');
      iconLaptop.classList.add('active');
      iconTv.classList.remove('active');
    } else {
      iconPhone.classList.add('active');
      iconLaptop.classList.add('active');
      iconTv.classList.add('active');
    }
  }
  
  // Summary Update
  const monthText = months === 1 ? '1 месяц' : `${months} месяца`;
  const devText = `${totalDevices} ${totalDevices === 2 || totalDevices === 3 || totalDevices === 4 ? 'устройства' : 'устройств'}`;
  
  const summaryDetailsEl = document.getElementById('summary-details');
  if (summaryDetailsEl) {
    summaryDetailsEl.textContent = `${monthText} · ${devText}`;
  }
  
  const days = months * 30;
  const costPerDay = (totalPrice / days).toFixed(2).replace('.', ',');
  const summaryDayCostEl = document.getElementById('summary-day-cost');
  if (summaryDayCostEl) {
    summaryDayCostEl.textContent = `${costPerDay} ₽ / день`;
  }
  
  // Update Pay Button
  document.getElementById('pay-total').textContent = `${totalPrice} ₽`;
  
  // Discount badge / old price calculation
  const baseFullPrice = price1 * months;
  if (baseFullPrice > totalPrice) {
    const oldPrice = baseFullPrice;
    const discountPct = Math.round((1 - totalPrice / baseFullPrice) * 100);
    document.getElementById('pay-old').textContent = `${oldPrice} ₽`;
    document.getElementById('pay-old').style.display = 'inline';
    document.getElementById('pay-discount').textContent = `-${discountPct}%`;
    document.getElementById('pay-discount').style.display = 'inline-block';
  } else {
    document.getElementById('pay-old').style.display = 'none';
    document.getElementById('pay-discount').style.display = 'none';
  }
}

// Event Listeners for Calculator
tariffRadios.forEach(radio => radio.addEventListener('change', calculateTotals));
deviceRadios.forEach(radio => radio.addEventListener('change', calculateTotals));

if (btnDevMinus && btnDevPlus) {
  btnDevMinus.addEventListener('click', (e) => {
    e.preventDefault();
    if (flexDevCount > 3) {
      flexDevCount--;
      flexCountEl.textContent = flexDevCount;
      document.querySelector('input[value="flex"]').checked = true; // Auto select Flex Squad
      calculateTotals();
    }
  });
  
  btnDevPlus.addEventListener('click', (e) => {
    e.preventDefault();
    if (flexDevCount < 5) {
      flexDevCount++;
      flexCountEl.textContent = flexDevCount;
      document.querySelector('input[value="flex"]').checked = true; // Auto select Flex Squad
      calculateTotals();
    }
  });
}

// Initial calculation
calculateTotals();

// Sync Swiper Dots & Radio & Tap-to-Scroll
const deviceSwiper = document.querySelector('.device-swiper-container');
const deviceSlides = document.querySelectorAll('.device-slide');
const paginationDots = document.querySelectorAll('#device-pagination .dot');

if (deviceSwiper && deviceSlides.length > 0) {
  // 1. Scroll listener for drag / swipe gestures
  deviceSwiper.addEventListener('scroll', () => {
    const scrollLeft = deviceSwiper.scrollLeft;
    const width = deviceSwiper.clientWidth;
    const activeIndex = Math.round(scrollLeft / (width * 0.88));
    
    paginationDots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === activeIndex);
    });
    
    const targetRadio = deviceRadios[activeIndex];
    if (targetRadio && !targetRadio.checked) {
      targetRadio.checked = true;
      calculateTotals();
    }
  });

  // 2. Click/Tap listener to smoothly center the clicked slide
  deviceSlides.forEach((slide, idx) => {
    slide.addEventListener('click', () => {
      const targetScroll = slide.offsetLeft - (deviceSwiper.clientWidth - slide.clientWidth) / 2;
      deviceSwiper.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    });
  });

  // 3. Click listener on pagination dots
  paginationDots.forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      const slide = deviceSlides[idx];
      if (slide) {
        const targetScroll = slide.offsetLeft - (deviceSwiper.clientWidth - slide.clientWidth) / 2;
        deviceSwiper.scrollTo({
          left: Math.max(0, targetScroll),
          behavior: 'smooth'
        });
      }
    });
  });
}

};
})();
