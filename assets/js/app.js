(() => {
  'use strict';

  document.documentElement.classList.add('js');

  const DATA = window.LQ_DATA;
  const COINS = DATA.coins;
  const COIN_MAP = Object.fromEntries(COINS.map(coin => [coin.id, coin]));
  const GRADES = DATA.grades;
  const STATES = DATA.states;
  const STYLES = DATA.styles;
  const STORAGE_KEY = 'laoqian.collection.v1';
  const MAX_COLLECTION = 8;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const fmt = value => new Intl.NumberFormat('zh-CN').format(value);
  const pad = value => String(value).padStart(3, '0');
  const escapeHTML = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const debounce = (fn, wait = 120) => {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), wait);
    };
  };

  /* ────────────────────────────────
     Date + toast + generic UI
     ──────────────────────────────── */
  function stampToday() {
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const pick = type => parts.find(part => part.type === type)?.value || '';
    const text = `${pick('year')}.${pick('month')}.${pick('day')}`;
    $$('[data-today]').forEach(node => { node.textContent = text; });
  }

  let toastTimer = 0;
  function showToast(message) {
    const toast = $('[data-toast]');
    const text = $('[data-toast-text]');
    if (!toast || !text) return;
    clearTimeout(toastTimer);
    toast.classList.remove('is-leaving');
    text.textContent = message;
    toast.hidden = false;
    void toast.offsetWidth;
    toast.style.animation = '';
    toastTimer = window.setTimeout(() => {
      toast.classList.add('is-leaving');
      window.setTimeout(() => {
        toast.hidden = true;
        toast.classList.remove('is-leaving');
      }, 280);
    }, 2800);
  }

  function setScrollLock(locked) {
    document.body.classList.toggle('modal-open', locked);
  }

  /* ────────────────────────────────
     Header / mobile navigation
     ──────────────────────────────── */
  const header = $('[data-header]');
  const mobileNav = $('#mobileNav');
  const menuToggle = $('.menu-toggle');
  const mobileNavClose = $('.mobile-nav-close');

  function handleScroll() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 12);
  }
  handleScroll();
  window.addEventListener('scroll', handleScroll, { passive: true });

  function setMobileNav(open) {
    if (!mobileNav || !menuToggle) return;
    const backgroundRegions = [$('.announce'), $('.site-header'), $('#main'), $('.site-footer')].filter(Boolean);
    mobileNav.hidden = !open;
    document.body.classList.toggle('nav-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
    backgroundRegions.forEach(region => {
      if (open) region.setAttribute('inert', '');
      else region.removeAttribute('inert');
    });
    if (open) {
      window.setTimeout(() => mobileNavClose?.focus(), 50);
    } else if (document.activeElement === mobileNavClose) {
      menuToggle.focus();
    }
  }

  menuToggle?.addEventListener('click', () => setMobileNav(mobileNav.hidden));
  mobileNavClose?.addEventListener('click', () => setMobileNav(false));
  $$('a', mobileNav || document.createElement('div')).forEach(link => {
    link.addEventListener('click', () => setMobileNav(false));
  });

  /* ────────────────────────────────
     Cards, tape & collection preview rendering
     ──────────────────────────────── */
  function priceRange(coin) {
    return `<small>¥</small>${fmt(coin.price[0])}<span class="range-dash">–</span>${fmt(coin.price[1])}`;
  }

  function changeMarkup(change) {
    const up = change >= 0;
    return `<span class="${up ? 'is-up' : 'is-down'}">${up ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}%</span>`;
  }

  function sparkBars(coin) {
    const dir = coin.change >= 0 ? 1 : -1;
    const heights = [5, 8, 6, 9, 7, 11, 8, 12, 9, 13, 11];
    return heights.map((height, index) => {
      const adjusted = Math.max(3, Math.min(13, height + dir * (index - 5) * .55));
      return `<i style="height:${adjusted.toFixed(1)}px"></i>`;
    }).join('');
  }

  function itemCard(coin, index, badge = '本期精选') {
    const isNote = coin.kind === 'note';
    const hasBack = Boolean(coin.back);
    const artVisual = isNote
      ? `<div class="note-stage">
          <span class="note-stage-label">PAPER CURRENCY / ${escapeHTML(coin.year.replace(/\s+/g, ''))}</span>
          <span class="note-stage-serial">${escapeHTML(coin.lot.replace('LOT ', 'NO. '))}</span>
          <div class="note-stage-inner">
            <img class="coin-card-img coin-card-img--note" src="${coin.image}" alt="${escapeHTML(coin.name)}${coin.frontLabel ? '·' + coin.frontLabel : ''}" decoding="async">
          </div>
          <span class="note-stage-caption">${escapeHTML(coin.denomination || coin.weightLabel)} · ${escapeHTML(coin.process || 'PAPER')}</span>
        </div>`
      : `<img class="coin-card-img" src="${coin.image}" alt="${escapeHTML(coin.name)}${coin.frontLabel ? '·' + coin.frontLabel : ''}" decoding="async">`;
    return `
      <article class="coin-card${isNote ? ' coin-card--note' : ''} tone-${index % 6}" data-coin-card="${coin.id}" data-face="front" data-kind="${isNote ? 'note' : 'coin'}">
        <div class="coin-card-art">
          <div class="card-art-top">
            <span class="card-lot">${escapeHTML(coin.lot)}</span>
            <span class="card-badge">${escapeHTML(badge)}</span>
          </div>
          ${artVisual}
          <span class="card-face-label">${escapeHTML(coin.frontLabel)}</span>
          ${hasBack ? `<button class="card-flip" type="button" aria-label="翻转查看${escapeHTML(coin.name)}背面" data-flip-card>
            <svg aria-hidden="true"><use href="#i-flip"></use></svg>
          </button>` : ''}
        </div>
        <div class="coin-card-info">
          <div class="card-kicker">${escapeHTML(coin.period)}<span></span>${escapeHTML(isNote ? '纸币' : coin.category)}</div>
          <h3 class="card-title">${escapeHTML(coin.name)}</h3>
          <p class="card-subtitle">${escapeHTML(coin.subtitle)}</p>
          <div class="card-meta">
            <span>${escapeHTML(coin.material)} · ${escapeHTML(coin.diameter)}</span>
            <span class="card-grade">${escapeHTML(coin.sampleGrade)}</span>
          </div>
          <div class="card-price-row">
            <div class="card-price">
              <span class="card-price-label">回收参考 · ${escapeHTML(coin.marketGrade)}</span>
              <span class="card-price-value">${priceRange(coin)}</span>
            </div>
            <button class="card-view" type="button" data-open-coin="${coin.id}">查看展签 <svg aria-hidden="true"><use href="#i-arrow"></use></svg></button>
          </div>
        </div>
      </article>`;
  }

  function renderFeatured() {
    const grid = $('[data-featured-grid]');
    if (!grid) return;
    const items = ['yuan-3', 'fen5-1988', 'rmb-2yuan-1960', 'xianfeng-baoquan']
      .map(id => COIN_MAP[id])
      .filter(Boolean);
    grid.innerHTML = items.map((coin, index) => itemCard(coin, index, '本期精选')).join('');
  }

  const atlasState = { filter: 'all', query: '' };

  function getFilteredCoins() {
    return COINS.filter(coin => {
      const matchesFilter = atlasState.filter === 'all' || coin.category === atlasState.filter;
      const haystack = [coin.name, coin.shortName, coin.period, coin.year, coin.mint, coin.category, ...coin.tags]
        .join(' ')
        .toLowerCase();
      return matchesFilter && haystack.includes(atlasState.query.toLowerCase());
    });
  }

  function renderAtlas() {
    const grid = $('[data-atlas-grid]');
    if (!grid) return;
    const items = getFilteredCoins();
    grid.innerHTML = items.map((coin, index) => itemCard(coin, index, '馆藏样张')).join('');
    $$('[data-atlas-result]').forEach(node => { node.textContent = items.length; });
    const empty = $('[data-atlas-empty]');
    if (empty) empty.hidden = items.length !== 0;
    grid.hidden = items.length === 0;
  }

  function updateCatalogCounts() {
    const totals = {
      all: COINS.length,
      '银币': COINS.filter(coin => coin.category === '银币').length,
      '铜元': COINS.filter(coin => coin.category === '铜元').length,
      '古钱': COINS.filter(coin => coin.category === '古钱').length,
      '硬币': COINS.filter(coin => coin.category === '硬币').length,
      '纸币': COINS.filter(coin => coin.category === '纸币').length
    };
    $$('[data-filter-count]').forEach(node => {
      const value = totals[node.dataset.filterCount];
      node.textContent = typeof value === 'number' ? String(value).padStart(2, '0') : '';
    });
    $$('[data-atlas-count], [data-coin-count]').forEach(node => {
      node.textContent = String(COINS.length);
    });
  }

  function renderTape() {
    const track = $('[data-market-tape]');
    if (!track) return;
    const items = ['yuan-3', 'fen5-1988', 'rmb-2yuan-1960', 'panda-2019']
      .map(id => COIN_MAP[id])
      .filter(Boolean);
    track.innerHTML = items.map(coin => `
      <span class="tape-item">
        <span class="tape-name">${escapeHTML(coin.shortName)}</span>
        <span class="tape-price">¥${fmt(coin.price[0])}–${fmt(coin.price[1])}</span>
        <span class="${coin.change >= 0 ? 'tape-up' : 'tape-down'}">${coin.change >= 0 ? '↑' : '↓'} ${Math.abs(coin.change).toFixed(1)}%</span>
      </span>`).join('');
  }

  function renderHomeMarket() {
    const wrap = $('[data-home-market]');
    if (!wrap) return;
    const items = ['yuan-3', 'fen5-1988', 'rmb-2yuan-1960', 'rmb-3yuan-1953'].map(id => COIN_MAP[id]).filter(Boolean);
    wrap.innerHTML = items.map(coin => `
      <div class="market-row">
        <div class="market-coin">
          <img src="${coin.image}" alt="" loading="lazy"${coin.kind === 'note' ? ' class="is-note"' : ''}>
          <div><b>${escapeHTML(coin.name)}</b><em>${escapeHTML(coin.subtitle)}</em></div>
        </div>
        <span class="market-grade">${escapeHTML(coin.marketGrade)}</span>
        <span class="market-range"><small>¥</small>${fmt(coin.price[0])} – ${fmt(coin.price[1])}</span>
        <span class="market-trend ${coin.change >= 0 ? 'is-up' : 'is-down'}"><b>${coin.change >= 0 ? '+' : ''}${coin.change.toFixed(1)}%</b><span>${sparkBars(coin)}</span></span>
      </div>`).join('');
  }

  function renderMarketTable(query = '') {
    const body = $('[data-price-table-body]');
    if (!body) return;
    const normalized = query.trim().toLowerCase();
    const items = COINS.filter(coin => {
      if (!normalized) return true;
      return [coin.name, coin.shortName, coin.period, coin.year, coin.mint, coin.category, ...coin.tags]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
    body.innerHTML = items.map(coin => `
      <button class="price-row" type="button" data-price-id="${coin.id}">
        <span class="price-coin">
          <img src="${coin.image}" alt=""${coin.kind === 'note' ? ' class="is-note"' : ''}>
          <span><b>${escapeHTML(coin.name)}</b><em>${escapeHTML(coin.period)} · ${escapeHTML(coin.marketGrade)}</em></span>
        </span>
        <span class="price-grade">${escapeHTML(coin.marketGrade)}</span>
        <span class="price-range"><small>¥</small>${fmt(coin.price[0])} – ${fmt(coin.price[1])}</span>
        <span class="price-change ${coin.change >= 0 ? 'is-up' : 'is-down'}">${coin.change >= 0 ? '↑' : '↓'} ${Math.abs(coin.change).toFixed(1)}%</span>
        <span class="row-arrow"><svg aria-hidden="true"><use href="#i-arrow-up"></use></svg></span>
      </button>`).join('');
    const empty = $('[data-market-empty]');
    if (empty) empty.hidden = items.length !== 0;
  }

  /* ────────────────────────────────
     Estimator
     ──────────────────────────────── */
  const estimateState = {
    coinId: COINS[0]?.id || '',
    grade: '美品',
    state: 'none'
  };

  function populateEstimator() {
    const select = $('[data-estimate-coin]');
    if (!select) return;
    select.innerHTML = COINS.map(coin => `<option value="${coin.id}">${escapeHTML(coin.name)} · ${escapeHTML(coin.year)}</option>`).join('');
    select.value = estimateState.coinId;
  }

  function roundToTen(value) {
    return Math.max(10, Math.round(value / 10) * 10);
  }

  function calculateEstimate() {
    const coin = COIN_MAP[estimateState.coinId] || COINS[0];
    const grade = GRADES[estimateState.grade] || GRADES['美品'];
    const state = STATES[estimateState.state] || STATES.none;
    const low = roundToTen(coin.price[0] * grade.factor[0] * state.factor);
    const high = roundToTen(coin.price[1] * grade.factor[1] * state.factor);
    const lowNode = $('[data-estimate-low]');
    const highNode = $('[data-estimate-high]');
    const noteNode = $('[data-estimate-note]');
    if (lowNode) lowNode.textContent = fmt(low);
    if (highNode) highNode.textContent = fmt(high);
    if (noteNode) noteNode.textContent = `按${coin.name} · ${estimateState.grade}${estimateState.state === 'none' ? '' : ' · ' + state.label}计算`;

    $$('[data-grade]').forEach(button => {
      const active = button.dataset.grade === estimateState.grade;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function bindEstimator() {
    const select = $('[data-estimate-coin]');
    const stateSelect = $('[data-estimate-state]');
    select?.addEventListener('change', event => {
      estimateState.coinId = event.target.value;
      calculateEstimate();
    });
    stateSelect?.addEventListener('change', event => {
      estimateState.state = event.target.value;
      calculateEstimate();
    });
    $$('[data-grade]').forEach(button => {
      button.addEventListener('click', () => {
        estimateState.grade = button.dataset.grade;
        calculateEstimate();
      });
    });
    const marketSearch = $('#marketSearch');
    marketSearch?.addEventListener('input', debounce(event => {
      renderMarketTable(event.target.value);
    }, 100));
    $('[data-price-table-body]')?.addEventListener('click', event => {
      const row = event.target.closest('[data-price-id]');
      if (!row) return;
      estimateState.coinId = row.dataset.priceId;
      estimateState.grade = '美品';
      estimateState.state = 'none';
      if (select) select.value = estimateState.coinId;
      if (stateSelect) stateSelect.value = 'none';
      calculateEstimate();
      const estimator = $('.estimator');
      estimator?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      window.setTimeout(() => {
        const coin = COIN_MAP[estimateState.coinId];
        showToast(`已带入「${coin.name}」的参考行情`);
      }, 260);
    });
  }

  /* ────────────────────────────────
     Atlas filters + keyboard shortcut
     ──────────────────────────────── */
  function bindAtlas() {
    $$('[data-filter]').forEach(button => {
      button.addEventListener('click', () => {
        atlasState.filter = button.dataset.filter;
        $$('[data-filter]').forEach(item => {
          item.classList.toggle('is-active', item === button);
          item.setAttribute('aria-pressed', String(item === button));
        });
        renderAtlas();
      });
    });
    const search = $('#atlasSearch');
    search?.addEventListener('input', debounce(event => {
      atlasState.query = event.target.value;
      renderAtlas();
    }, 110));
    $('[data-reset-atlas]')?.addEventListener('click', () => {
      atlasState.filter = 'all';
      atlasState.query = '';
      if (search) search.value = '';
      $$('[data-filter]').forEach(item => {
        const active = item.dataset.filter === 'all';
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      renderAtlas();
    });
    document.addEventListener('keydown', event => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      event.preventDefault();
      if (currentRoute !== 'atlas') {
        window.location.hash = '#/atlas';
        window.setTimeout(() => $('#atlasSearch')?.focus(), 180);
      } else {
        $('#atlasSearch')?.focus();
      }
    });
  }


  /* ────────────────────────────────
     Card interactions + coin modal
     ──────────────────────────────── */
  const modal = $('#coinModal');
  let lastFocused = null;
  let modalCoin = null;
  let modalFace = 'front';

  function openCoinModal(id) {
    const coin = COIN_MAP[id];
    if (!coin || !modal) return;
    const isNote = coin.kind === 'note';
    modalCoin = coin;
    modalFace = 'front';
    lastFocused = document.activeElement;
    const dialog = $('.modal-dialog', modal);
    if (!dialog) return;
    const specs = isNote
      ? [
          ['发行年代', coin.year],
          ['发行机构', coin.issuer || '中国人民银行'],
          ['票面尺寸', coin.diameter],
          ['面额', coin.denomination || coin.weightLabel],
          ['票面品相', coin.sampleGrade],
          ['版别特征', coin.highlight]
        ]
      : [
          ['年代', coin.year],
          ['材质 / 规格', `${coin.material} · ${coin.diameter}`],
          ['铸造 / 产地', coin.mint],
          ['重量 / 面值', `${coin.weight} · ${coin.weightLabel}`],
          ['样例品相', coin.sampleGrade],
          ['版别特征', coin.highlight]
        ];
    const specMarkup = specs.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('');
    const thumbs = isNote
      ? `<div class="modal-thumbs" role="group" aria-label="切换票面正反面">
          <button class="modal-thumb modal-thumb--note is-active" type="button" data-modal-face="front" aria-label="查看票面"><img src="${coin.image}" alt=""></button>
          ${coin.back ? `<button class="modal-thumb modal-thumb--note" type="button" data-modal-face="back" aria-label="查看票背"><img src="${coin.back}" alt=""></button>` : ''}
        </div>`
      : `<div class="modal-thumbs" role="group" aria-label="切换钱币正反面">
          <button class="modal-thumb is-active" type="button" data-modal-face="front" aria-label="查看正面"><img src="${coin.image}" alt=""></button>
          ${coin.back ? `<button class="modal-thumb" type="button" data-modal-face="back" aria-label="查看背面"><img src="${coin.back}" alt=""></button>` : ''}
        </div>`;
    const visual = isNote
      ? `<div class="modal-visual modal-visual--note">
          <div class="modal-note-stage">
            <div class="modal-note-head"><span>PAPER CURRENCY · LAO QIAN</span><span>${escapeHTML(coin.lot)}</span></div>
            <div class="modal-note-img-wrap"><img src="${coin.image}" alt="${escapeHTML(coin.name)}票面" data-modal-main></div>
            <div class="modal-note-foot"><span data-modal-caption>${escapeHTML(coin.highlight)}</span><span>${escapeHTML(coin.denomination)} · ${escapeHTML(coin.year)}</span></div>
          </div>
          ${thumbs}
          <div class="modal-visual-foot"><span>LQ · ${escapeHTML(coin.lot.replace('LOT ', ''))}</span><span>纸币影像档案 / ${escapeHTML(coin.year)}</span></div>
        </div>`
      : `<div class="modal-visual">
          <div class="modal-frame">
            <div class="modal-frame-mat">
              <div class="modal-frame-head"><span>LAO QIAN ARCHIVE</span><span>${escapeHTML(coin.lot)}</span></div>
              <div class="modal-frame-img-wrap">
                <img src="${coin.image}" alt="${escapeHTML(coin.name)}正面" data-modal-main>
              </div>
              <div class="modal-frame-caption" data-modal-caption>${escapeHTML(coin.highlight)}</div>
            </div>
          </div>
          ${thumbs}
          <div class="modal-visual-foot"><span>LQ · ${escapeHTML(coin.lot.replace('LOT ', ''))}</span><span>钱币影像档案 / ${escapeHTML(coin.year)}</span></div>
        </div>`;
    dialog.innerHTML = `
      <button class="modal-close" type="button" aria-label="关闭展签" data-close-modal>
        <svg aria-hidden="true"><use href="#i-close"></use></svg>
      </button>
      ${visual}
      <div class="modal-info">
        <p class="eyebrow"><span class="eyebrow-dash"></span>泉藏档案 <em>${escapeHTML(coin.lot)} · ${escapeHTML(isNote ? '纸币' : coin.category)}</em></p>
        <h2 class="modal-title" id="modalTitle">${escapeHTML(coin.name)}</h2>
        <p class="modal-subtitle">${escapeHTML(coin.subtitle)}</p>
        <p class="modal-description">${escapeHTML(coin.story)}</p>
        <dl class="modal-specs">
          ${specMarkup}
        </dl>
        <div class="modal-price">
          <div>
            <span class="modal-price-label">当前回收参考 · ${escapeHTML(coin.marketGrade)}</span>
            <strong><small>¥</small>${fmt(coin.price[0])}<small>—</small>${fmt(coin.price[1])}</strong>
          </div>
          <span class="modal-price-note">参考区间<br>非实时成交价</span>
        </div>
        <div class="modal-actions">
          <a class="btn btn-ink" href="#/studio?sample=${coin.id}" data-close-modal>装裱同款展签 <svg aria-hidden="true"><use href="#i-arrow"></use></svg></a>
          <a class="btn btn-ghost" href="#/market?coin=${coin.id}" data-close-modal>查看回收行情</a>
        </div>
        <p class="modal-disclaimer">影像与行情均为演示样本。${escapeHTML(coin.detailNote)} 实际交易请以实物鉴定为准。</p>
      </div>`;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    setScrollLock(true);
    window.setTimeout(() => $('.modal-close', modal)?.focus(), 30);
  }

  function closeCoinModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    setScrollLock(false);
    modalCoin = null;
    lastFocused?.focus?.({ preventScroll: true });
  }

  function setModalFace(face) {
    if (!modalCoin) return;
    const source = face === 'back' ? modalCoin.back : modalCoin.image;
    if (!source) return;
    modalFace = face;
    const image = $('[data-modal-main]', modal);
    if (image) {
      image.classList.add('is-swapping');
      window.setTimeout(() => {
        image.src = source;
        image.alt = `${modalCoin.name}${face === 'back' ? '背面' : '正面'}`;
        image.addEventListener('load', () => image.classList.remove('is-swapping'), { once: true });
        window.setTimeout(() => image.classList.remove('is-swapping'), 500);
      }, 140);
    }
    const caption = $('[data-modal-caption]', modal);
    if (caption) {
      caption.textContent = face === 'back'
        ? (modalCoin.kind === 'note' ? '票背 · 档案影像' : '背面 · 纹样与文字')
        : modalCoin.highlight;
    }
    $$('[data-modal-face]', modal).forEach(button => {
      button.classList.toggle('is-active', button.dataset.modalFace === face);
    });
  }

  function handleCardFlip(card) {
    const coin = COIN_MAP[card.dataset.coinCard];
    if (!coin?.back) return;
    const showingBack = card.dataset.face === 'back';
    const nextFace = showingBack ? 'front' : 'back';
    const image = $('.coin-card-img', card);
    const label = $('.card-face-label', card);
    if (!image) return;
    card.dataset.face = nextFace;
    image.classList.add('is-swapping');
    window.clearTimeout(card._flipTimer);
    card._flipTimer = window.setTimeout(() => {
      image.src = nextFace === 'back' ? coin.back : coin.image;
      image.alt = `${coin.name}${nextFace === 'back' ? '背面' : '正面'}`;
      if (label) label.textContent = nextFace === 'back' ? coin.backLabel : coin.frontLabel;
      const flipButton = $('[data-flip-card]', card);
      if (flipButton) flipButton.setAttribute('aria-label', nextFace === 'back' ? `翻转查看${coin.name}正面` : `翻转查看${coin.name}背面`);
      image.addEventListener('load', () => image.classList.remove('is-swapping'), { once: true });
      window.setTimeout(() => image.classList.remove('is-swapping'), 450);
    }, 150);
  }

  ['[data-featured-grid]', '[data-atlas-grid]'].forEach(selector => {
    const grid = $(selector);
    if (!grid) return;
    grid.addEventListener('click', event => {
      const flip = event.target.closest('[data-flip-card]');
      if (flip) {
        event.stopPropagation();
        const card = flip.closest('[data-coin-card]');
        if (card) handleCardFlip(card);
        return;
      }
      const openButton = event.target.closest('[data-open-coin]');
      if (openButton) {
        openCoinModal(openButton.dataset.openCoin);
        return;
      }
      const card = event.target.closest('[data-coin-card]');
      if (card) openCoinModal(card.dataset.coinCard);
    });
    grid.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('[data-coin-card]');
      if (!card || event.target.closest('button')) return;
      event.preventDefault();
      openCoinModal(card.dataset.coinCard);
    });
  });

  modal?.addEventListener('click', event => {
    if (event.target.closest('[data-close-modal]')) {
      closeCoinModal();
      return;
    }
    const faceButton = event.target.closest('[data-modal-face]');
    if (faceButton) setModalFace(faceButton.dataset.modalFace);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (modal && !modal.hidden) closeCoinModal();
      else if (mobileNav && !mobileNav.hidden) setMobileNav(false);
    }
    if (event.key === 'Tab' && modal && !modal.hidden) {
      const focusable = $$('a[href], button:not([disabled]), input, select, textarea', modal)
        .filter(node => node.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  /* ────────────────────────────────
     Hero interactions
     ──────────────────────────────── */
  let heroBack = false;
  function flipHero() {
    const heroCoin = COIN_MAP['yuan-3'];
    const image = $('[data-hero-image]');
    const thumb = $('[data-hero-thumb]');
    const faceLabel = $('[data-hero-face]');
    const trigger = $('[data-hero-flip]');
    if (!image || !thumb) return;
    heroBack = !heroBack;
    image.classList.add('is-swapping');
    window.setTimeout(() => {
      image.src = heroBack ? heroCoin.back : heroCoin.image;
      image.alt = `袁世凯像壹圆银币${heroBack ? '背面' : '正面'}`;
      thumb.src = heroBack ? heroCoin.image : heroCoin.back;
      thumb.alt = `袁世凯像壹圆银币${heroBack ? '正面' : '背面'}`;
      if (faceLabel) faceLabel.textContent = heroBack ? '背 / 面' : '正 / 面';
      trigger?.setAttribute('aria-label', heroBack ? '翻转查看钱币正面' : '翻转查看钱币背面');
      image.addEventListener('load', () => image.classList.remove('is-swapping'), { once: true });
      window.setTimeout(() => image.classList.remove('is-swapping'), 500);
    }, 160);
  }
  $('[data-hero-flip]')?.addEventListener('click', flipHero);

  function bindHeroTilt() {
    const scene = $('[data-tilt-scene]');
    const card = $('[data-tilt-card]');
    if (!scene || !card || reduceMotion) return;
    let frame = 0;
    scene.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const rect = scene.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        card.style.setProperty('--tilt-y', `${(x * 3.8).toFixed(2)}deg`);
        card.style.setProperty('--tilt-x', `${(-y * 3.1).toFixed(2)}deg`);
        frame = 0;
      });
    });
    scene.addEventListener('pointerleave', () => {
      card.style.setProperty('--tilt-y', '0deg');
      card.style.setProperty('--tilt-x', '0deg');
    });
  }
  bindHeroTilt();

  $('.skip-link')?.addEventListener('click', event => {
    event.preventDefault();
    const main = document.getElementById('main');
    if (!main) return;
    main.focus({ preventScroll: true });
    main.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });

  /* ────────────────────────────────
     Routing
     ──────────────────────────────── */
  const titles = {
    home: '老钱 LAO QIAN｜中国钱币与老纸币的影像装裱与回收参考',
    atlas: '泉藏图录 · 钱币与老纸币｜老钱 LAO QIAN',
    market: '钱币与老纸币回收行情｜老钱 LAO QIAN',
    studio: '装裱工坊｜老钱 LAO QIAN',
    collection: '我的展柜｜老钱 LAO QIAN',
    about: '关于老钱｜老钱 LAO QIAN'
  };
  const routes = {
    '/': 'home',
    '/atlas': 'atlas',
    '/market': 'market',
    '/studio': 'studio',
    '/collection': 'collection',
    '/about': 'about'
  };
  let currentRoute = 'home';
  let firstRoute = true;
  let pendingStudioFile = null;

  function parseRoute() {
    const raw = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : '/';
    const [pathPart, queryPart = ''] = raw.split('?');
    const normalized = pathPart.replace(/\/+$/, '') || '/';
    return {
      name: routes[normalized] || 'home',
      query: new URLSearchParams(queryPart)
    };
  }

  function applyRoute(options = {}) {
    const { scroll = true } = options;
    const { name, query } = parseRoute();
    const routeChanged = name !== currentRoute;
    currentRoute = name;

    $$('[data-view]').forEach(view => {
      view.hidden = view.dataset.view !== name;
    });
    $$('[data-nav]').forEach(link => {
      const active = link.dataset.nav === name;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.title = titles[name];
    if (scroll && !firstRoute) window.scrollTo({ top: 0, behavior: 'auto' });
    if (name === 'collection') renderCollection();
    if (name === 'atlas') {
      requestAnimationFrame(() => {
        $$('[data-atlas-grid] img').forEach(image => {
          image.loading = 'eager';
        });
      });
    }
    if (name === 'studio') {
      const sampleCoin = COIN_MAP[query.get('sample')];
      if (sampleCoin) {
        loadStudioSampleCoin(sampleCoin, { notify: true });
      } else if (query.get('style') && STYLES[query.get('style')]) {
        setStudioStyle(query.get('style'), { manual: true });
      }
      if (pendingStudioFile) {
        const file = pendingStudioFile;
        pendingStudioFile = null;
        window.setTimeout(() => handleStudioUpload(file), 130);
      }
    }
    if (name === 'market' && query.get('coin')) {
      const coin = COIN_MAP[query.get('coin')];
      if (coin) {
        estimateState.coinId = coin.id;
        const select = $('[data-estimate-coin]');
        if (select) select.value = coin.id;
        calculateEstimate();
      }
    }
    if (routeChanged) setMobileNav(false);
    firstRoute = false;
    requestAnimationFrame(() => {
      $$('[data-view]:not([hidden]) .reveal').forEach(node => revealObserver?.observe(node));
    });
  }

  window.addEventListener('hashchange', () => applyRoute({ scroll: true }));

  /* ────────────────────────────────
     Reveal observer
     ──────────────────────────────── */
  let revealObserver = null;
  if ('IntersectionObserver' in window && !reduceMotion) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .1, rootMargin: '0px 0px -36px 0px' });
    $$('.reveal').forEach(node => revealObserver.observe(node));
  } else {
    $$('.reveal').forEach(node => node.classList.add('is-visible'));
  }

  /* ────────────────────────────────
     Studio state + controls
     ──────────────────────────────── */
  const studioState = {
    style: 'heritage',
    format: 'coin',
    previewNo: 18,
    file: null,
    sample: true,
    originalDataUrl: null,
    cutoutSrc: 'assets/img/coins/yuan-obv.webp',
    circleSrc: null,
    noteSrc: null,
    activeSrc: 'assets/img/coins/yuan-obv.webp',
    bgRemoved: false,
    processing: false
  };

  const studioFields = {
    name: $('[data-studio-name]'),
    era: $('[data-studio-era]'),
    mint: $('[data-studio-mint]'),
    note: $('[data-studio-note]'),
    category: $('[data-studio-category]'),
    grade: $('[data-studio-grade]')
  };

  const categoryLabels = {
    '银币': '机制银币',
    '铜元': '清代铜元',
    '古钱': '历代古钱',
    '硬币': '现代硬币',
    '纸币': '老纸币',
    '其他': '旧物影像'
  };

  function autoStyleForCategory(category) {
    if (category === '铜元' || category === '硬币' || category === '纸币') return 'catalogue';
    if (category === '古钱') return 'scroll';
    return 'heritage';
  }

  function setStudioFormat(format, options = {}) {
    const { silent = true } = options;
    const nextFormat = format === 'note' ? 'note' : 'coin';
    studioState.format = nextFormat;
    const art = $('[data-studio-art]');
    if (art) art.classList.toggle('is-note', nextFormat === 'note');
    $$('[data-format]').forEach(button => {
      const active = button.dataset.format === nextFormat;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const cutoutSwitch = $('[data-use-cutout]');
    if (cutoutSwitch) {
      cutoutSwitch.disabled = nextFormat === 'note';
      cutoutSwitch.closest('.switch-row')?.classList.toggle('is-disabled', nextFormat === 'note');
    }
    let source = null;
    if (nextFormat === 'note') {
      source = studioState.noteSrc || studioState.activeSrc;
    } else if (studioState.file) {
      const useCutout = $('[data-use-cutout]')?.checked !== false;
      source = useCutout ? (studioState.cutoutSrc || studioState.activeSrc) : (studioState.circleSrc || studioState.cutoutSrc);
    } else if (studioState.sample) {
      source = studioState.cutoutSrc || studioState.activeSrc;
    }
    if (source && source !== studioState.activeSrc) {
      setStudioImage(source);
    }
    updateStudioPreview();
    if (!silent) showToast(nextFormat === 'note' ? '已切换为纸钞画幅' : '已切换为圆形硬币画幅');
  }

  function setStudioStyle(style, options = {}) {
    const { manual = false, silent = true } = options;
    if (!STYLES[style]) return;
    studioState.style = style;
    if (manual) {
      const autoStyleInput = $('[data-auto-style]');
      if (autoStyleInput) autoStyleInput.checked = false;
    }
    const art = $('[data-studio-art]');
    if (art) {
      art.classList.remove('frame--heritage', 'frame--catalogue', 'frame--scroll');
      art.classList.add(`frame--${style}`);
    }
    $$('[data-select-style]').forEach(button => {
      const active = button.dataset.selectStyle === style;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-checked', String(active));
    });
    const info = STYLES[style];
    const head = $('[data-art-head]');
    const lot = $('[data-art-lot]');
    const date = $('[data-art-date]');
    const styleLabel = $('[data-style-label]');
    if (head) head.textContent = info.head;
    if (lot) lot.textContent = info.lot;
    if (date) date.textContent = info.footer;
    if (styleLabel) styleLabel.textContent = `${info.label} · ${info.latin}`;
    if (!silent) showToast(`已切换为${info.label}`);
  }

  function studioSnapshot() {
    const fallback = {
      name: studioState.sample ? '袁世凯像壹圆' : '未命名旧钱',
      era: studioState.sample ? '民国三年 · 1914' : '年代待考',
      mint: studioState.sample ? '天津造币总厂' : '产地待考',
      note: studioState.sample ? '嘉禾纹 · 原味包浆' : ''
    };
    const category = studioFields.category?.value || '银币';
    return {
      name: studioFields.name?.value.trim() || fallback.name,
      era: studioFields.era?.value.trim() || fallback.era,
      mint: studioFields.mint?.value.trim() || fallback.mint,
      note: studioFields.note?.value.trim() || fallback.note,
      category,
      grade: studioFields.grade?.value || '极美',
      style: studioState.style,
      format: studioState.format,
      image: studioState.activeSrc,
      previewNo: studioState.previewNo
    };
  }

  function updateStudioPreview() {
    const snapshot = studioSnapshot();
    const nameNode = $('[data-art-name]');
    const kickerNode = $('[data-art-kicker]');
    const metaNode = $('[data-art-meta]');
    const idNode = $('[data-preview-id]');
    const kicker = `${categoryLabels[snapshot.category] || snapshot.category} · ${snapshot.mint}`;
    const metaParts = [snapshot.era, snapshot.grade];
    if (snapshot.note) metaParts.push(snapshot.note);
    if (nameNode) nameNode.textContent = snapshot.name;
    if (kickerNode) kickerNode.textContent = kicker;
    if (metaNode) metaNode.textContent = metaParts.filter(Boolean).join('　|　');
    if (idNode) idNode.textContent = String(studioState.previewNo).padStart(5, '0');
    syncStudioImageAlt(snapshot.name);
  }

  function syncStudioImageAlt(name) {
    const image = $('[data-studio-image]');
    if (image) image.alt = `${name || '钱币'}装裱预览`;
    const thumb = $('[data-upload-thumb]');
    if (thumb) thumb.alt = `${name || '当前钱币'}照片预览`;
  }

  function setStudioImage(src) {
    studioState.activeSrc = src;
    const image = $('[data-studio-image]');
    if (image) {
      image.classList.add('is-swapping');
      image.src = src;
      image.addEventListener('load', () => image.classList.remove('is-swapping'), { once: true });
      window.setTimeout(() => image.classList.remove('is-swapping'), 500);
    }
    const thumb = $('[data-upload-thumb]');
    if (thumb) thumb.src = src;
  }

  function showStudioProcessing(show) {
    studioState.processing = show;
    const processing = $('[data-upload-processing]');
    const empty = $('[data-upload-empty]');
    const filled = $('[data-upload-filled]');
    if (processing) processing.hidden = !show;
    if (show) {
      if (empty) empty.hidden = true;
      if (filled) filled.hidden = true;
    }
    const generate = $('[data-generate]');
    if (generate) generate.disabled = show;
  }

  function fillUploadedState(file, variant) {
    const empty = $('[data-upload-empty]');
    const filled = $('[data-upload-filled]');
    const processing = $('[data-upload-processing]');
    if (empty) empty.hidden = true;
    if (filled) filled.hidden = false;
    if (processing) processing.hidden = true;
    const nameNode = $('[data-upload-name]');
    if (nameNode) nameNode.textContent = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || '我的旧钱';
    const statusNode = $('[data-upload-status]');
    if (statusNode) {
      statusNode.textContent = studioState.format === 'note'
        ? '纸钞画幅已识别 · 请核对票面裁切并补全展签'
        : (variant.bgRemoved ? '智能抠圆与去背已完成 · 请在第 02 步补全展签' : '已完成圆形构图 · 请在第 02 步补全展签');
    }
    const thumb = $('[data-upload-thumb]');
    if (thumb) thumb.src = studioState.activeSrc;
  }

  function restoreUploadEmpty() {
    const empty = $('[data-upload-empty]');
    const filled = $('[data-upload-filled]');
    const processing = $('[data-upload-processing]');
    if (empty) empty.hidden = false;
    if (filled) filled.hidden = true;
    if (processing) processing.hidden = true;
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error('无法读取图片'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('图片加载失败'));
      image.src = src;
    });
  }

  function median(values) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function analyseBorders(data, width, height) {
    const samples = [];
    const inset = Math.max(1, Math.round(Math.min(width, height) * .012));
    const step = Math.max(1, Math.round(Math.max(width, height) / 80));
    for (let x = inset; x < width - inset; x += step) {
      [inset, height - 1 - inset].forEach(y => {
        const index = (y * width + x) * 4;
        samples.push([data[index], data[index + 1], data[index + 2]]);
      });
    }
    for (let y = inset; y < height - inset; y += step) {
      [inset, width - 1 - inset].forEach(x => {
        const index = (y * width + x) * 4;
        samples.push([data[index], data[index + 1], data[index + 2]]);
      });
    }
    const bg = [0, 1, 2].map(channel => median(samples.map(sample => sample[channel])));
    const distances = samples.map(sample => Math.hypot(
      sample[0] - bg[0],
      sample[1] - bg[1],
      sample[2] - bg[2]
    ));
    const meanDistance = distances.reduce((sum, value) => sum + value, 0) / Math.max(1, distances.length);
    const closeShare = distances.filter(distance => distance < 42).length / Math.max(1, distances.length);
    return {
      bg,
      uniform: meanDistance < 22 && closeShare > 0.74,
      meanDistance
    };
  }

  function createCircularVariant(sourceCanvas, cx, cy, radius) {
    const size = 1000;
    const padding = 20;
    const outputSize = size + padding * 2;
    const output = document.createElement('canvas');
    output.width = outputSize;
    output.height = outputSize;
    const ctx = output.getContext('2d');
    ctx.save();
    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(sourceCanvas, cx - radius, cy - radius, radius * 2, radius * 2, padding, padding, size, size);
    ctx.restore();
    return output;
  }

  function createRectVariant(sourceCanvas, cleanedCanvas, bounds, bgRemoved) {
    // Banknotes keep their original ink and paper: bright areas are part of the
    // note, so do not apply the coin background alpha mask to the rectangular crop.
    const source = sourceCanvas;
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    let x0;
    let y0;
    let x1;
    let y1;
    if (bgRemoved) {
      x0 = bounds.x0;
      y0 = bounds.y0;
      x1 = bounds.x1;
      y1 = bounds.y1;
    } else {
      x0 = Math.round(width * .02);
      y0 = Math.round(height * .02);
      x1 = Math.round(width * .98);
      y1 = Math.round(height * .98);
    }
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * .012);
    x0 = Math.max(0, Math.floor(x0 - pad));
    y0 = Math.max(0, Math.floor(y0 - pad));
    x1 = Math.min(width - 1, Math.ceil(x1 + pad));
    y1 = Math.min(height - 1, Math.ceil(y1 + pad));
    const sourceWidth = Math.max(1, x1 - x0 + 1);
    const sourceHeight = Math.max(1, y1 - y0 + 1);
    const maxWidth = 1500;
    const scale = sourceWidth > maxWidth ? maxWidth / sourceWidth : 1;
    const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
    const outputHeight = Math.max(1, Math.round(sourceHeight * scale));
    const output = document.createElement('canvas');
    output.width = outputWidth;
    output.height = outputHeight;
    const ctx = output.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, x0, y0, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
    return {
      src: canvasToImageDataUrl(output),
      aspect: outputWidth / outputHeight
    };
  }

  function canvasToImageDataUrl(canvas) {
    let result = '';
    try {
      result = canvas.toDataURL('image/webp', .9);
    } catch (error) {
      result = canvas.toDataURL('image/png');
    }
    if (!result || result === 'data:,') result = canvas.toDataURL('image/png');
    return result;
  }

  function createCoinVariants(image) {
    const maxSide = 1400;
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    if (!naturalWidth || !naturalHeight) throw new Error('图片尺寸异常');
    const scale = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));

    const source = document.createElement('canvas');
    source.width = width;
    source.height = height;
    const sourceCtx = source.getContext('2d', { willReadFrequently: true });
    sourceCtx.drawImage(image, 0, 0, width, height);
    const originalData = sourceCtx.getImageData(0, 0, width, height);
    const pixels = originalData.data;
    const analysis = analyseBorders(pixels, width, height);

    let cleanedCanvas = null;
    let bgRemoved = false;
    let bounds = { x0: 0, y0: 0, x1: width - 1, y1: height - 1 };

    if (analysis.uniform) {
      const cleanedData = new Uint8ClampedArray(pixels);
      let opaque = 0;
      for (let i = 0; i < cleanedData.length; i += 4) {
        const distance = Math.hypot(
          cleanedData[i] - analysis.bg[0],
          cleanedData[i + 1] - analysis.bg[1],
          cleanedData[i + 2] - analysis.bg[2]
        );
        let alpha = cleanedData[i + 3];
        if (distance <= 17) alpha = 0;
        else if (distance < 52) alpha = Math.min(alpha, Math.round((distance - 17) / 35 * 255));
        cleanedData[i + 3] = alpha;
        if (alpha > 36) opaque += 1;
      }
      const coverage = opaque / (width * height);
      if (coverage > 0.045 && coverage < 0.985) {
        let x0 = width;
        let y0 = height;
        let x1 = 0;
        let y1 = 0;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (cleanedData[(y * width + x) * 4 + 3] > 36) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
          }
        }
        const boundsWidth = x1 - x0 + 1;
        const boundsHeight = y1 - y0 + 1;
        if (boundsWidth > width * .16 && boundsHeight > height * .16) {
          bounds = { x0, y0, x1, y1 };
          cleanedCanvas = document.createElement('canvas');
          cleanedCanvas.width = width;
          cleanedCanvas.height = height;
          cleanedCanvas.getContext('2d').putImageData(new ImageData(cleanedData, width, height), 0, 0);
          bgRemoved = true;
        }
      }
    }

    let cx;
    let cy;
    let radius;
    if (bgRemoved) {
      cx = (bounds.x0 + bounds.x1) / 2;
      cy = (bounds.y0 + bounds.y1) / 2;
      radius = Math.min(bounds.x1 - bounds.x0 + 1, bounds.y1 - bounds.y0 + 1) / 2;
    } else {
      cx = width / 2;
      cy = height / 2;
      radius = Math.min(width, height) * .47;
    }
    radius = Math.max(40, radius * 1.01);

    const circle = createCircularVariant(source, cx, cy, radius);
    const circleSrc = canvasToImageDataUrl(circle);
    let cutoutSrc = circleSrc;
    if (bgRemoved) {
      const cutout = createCircularVariant(cleanedCanvas, cx, cy, radius);
      cutoutSrc = canvasToImageDataUrl(cutout);
    }
    const rect = createRectVariant(source, cleanedCanvas, bounds, bgRemoved);
    const noteSrc = rect.src;
    const isWide = rect.aspect > 1.42;

    return {
      cutoutSrc,
      circleSrc,
      noteSrc,
      noteAspect: rect.aspect,
      isWide,
      bgRemoved,
      backgroundDistance: analysis.meanDistance
    };
  }

  function validateImageFile(file) {
    if (!file) return false;
    if (!file.type || !file.type.startsWith('image/')) {
      showToast('请选择 JPG、PNG 或 WebP 图片');
      return false;
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast('图片请控制在 20MB 以内');
      return false;
    }
    return true;
  }

  async function handleStudioUpload(file) {
    if (!file || studioState.processing) return;
    if (!validateImageFile(file)) return;
    const startedAt = performance.now();
    showStudioProcessing(true);
    const previousActive = studioState.activeSrc;
    try {
      const dataUrl = await readFileAsDataURL(file);
      const image = await loadImage(dataUrl);
      const variants = createCoinVariants(image);
      const elapsed = performance.now() - startedAt;
      if (elapsed < 680) {
        await new Promise(resolve => window.setTimeout(resolve, 680 - elapsed));
      }
      if (studioState.sample) {
        const fileBase = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        const isUntouched = field => !field || !field.value.trim();
        if (!studioFields.name || studioFields.name.value.trim() === '袁世凯像壹圆' || isUntouched(studioFields.name)) {
          if (studioFields.name) studioFields.name.value = '';
        }
        if (!studioFields.era || studioFields.era.value.trim() === '民国三年 · 1914') {
          if (studioFields.era) studioFields.era.value = '';
        }
        if (!studioFields.mint || studioFields.mint.value.trim() === '天津造币总厂') {
          if (studioFields.mint) studioFields.mint.value = '';
        }
        if (!studioFields.note || studioFields.note.value.trim() === '嘉禾纹 · 原味包浆') {
          if (studioFields.note) studioFields.note.value = '';
        }
        if (studioFields.grade) studioFields.grade.value = '美品';
        if (variants.isWide && studioFields.category) studioFields.category.value = '纸币';
        const hint = $('[data-upload-name]');
        if (hint) hint.textContent = fileBase || '我的旧钱';
      }
      studioState.file = file;
      studioState.sample = false;
      studioState.originalDataUrl = dataUrl;
      studioState.cutoutSrc = variants.cutoutSrc;
      studioState.circleSrc = variants.circleSrc;
      studioState.noteSrc = variants.noteSrc;
      studioState.bgRemoved = variants.bgRemoved;
      studioState.previewNo = Math.max(19, studioState.previewNo + 1);
      const nextFormat = variants.isWide ? 'note' : 'coin';
      setStudioFormat(nextFormat, { silent: true });
      fillUploadedState(file, variants);
      showStudioProcessing(false);
      updateStudioPreview();
      const autoStyle = $('[data-auto-style]');
      if (autoStyle?.checked) {
        setStudioStyle(autoStyleForCategory(studioFields.category?.value || '银币'), { silent: true });
      }
      showToast(variants.isWide ? '纸钞画幅识别完成，已自动放入展框' : '币缘识别完成，已自动放入展框');
    } catch (error) {
      console.error(error);
      showStudioProcessing(false);
      restoreUploadEmpty();
      setStudioImage(previousActive || 'assets/img/coins/yuan-obv.webp');
      showToast('这张图片暂时无法处理，请换一张清晰照片');
    }
  }

  function studioSampleGrade(grade) {
    const value = String(grade || '');
    if (/未流通|原光|精制|UNC|MS/i.test(value)) return '未流通';
    if (/九五品|九品|极美|AU|XF/i.test(value)) return '极美';
    return '美品';
  }

  function loadStudioSampleCoin(coin, options = {}) {
    if (!coin) return;
    const { notify = false } = options;
    const isNote = coin.kind === 'note';
    studioState.file = null;
    studioState.sample = true;
    studioState.originalDataUrl = null;
    studioState.cutoutSrc = coin.image;
    studioState.circleSrc = coin.image;
    studioState.noteSrc = isNote ? coin.image : null;
    studioState.bgRemoved = true;
    studioState.previewNo = Math.max(19, studioState.previewNo + 1);
    if (studioFields.name) studioFields.name.value = coin.name;
    if (studioFields.era) {
      studioFields.era.value = [coin.period, coin.year].filter(Boolean).join(' · ');
    }
    if (studioFields.mint) studioFields.mint.value = coin.mint;
    if (studioFields.note) studioFields.note.value = coin.highlight || '';
    if (studioFields.category) studioFields.category.value = coin.category;
    if (studioFields.grade) studioFields.grade.value = studioSampleGrade(coin.sampleGrade);
    const cutout = $('[data-use-cutout]');
    if (cutout) cutout.checked = true;
    const autoStyle = $('[data-auto-style]');
    if (autoStyle) autoStyle.checked = true;
    restoreUploadEmpty();
    showStudioProcessing(false);
    setStudioFormat(isNote ? 'note' : 'coin', { silent: true });
    setStudioStyle(autoStyleForCategory(coin.category), { silent: true });
    updateStudioPreview();
    if (notify) showToast(`已载入「${coin.name}」样例，可替换为你的照片`);
  }

  function restoreStudioSample(options = {}) {
    const { notify = true } = options;
    studioState.file = null;
    studioState.sample = true;
    studioState.originalDataUrl = null;
    studioState.cutoutSrc = 'assets/img/coins/yuan-obv.webp';
    studioState.circleSrc = null;
    studioState.noteSrc = null;
    studioState.activeSrc = 'assets/img/coins/yuan-obv.webp';
    studioState.bgRemoved = false;
    studioState.previewNo = Math.max(19, studioState.previewNo + 1);
    studioState.format = 'coin';
    if (studioFields.name) studioFields.name.value = '袁世凯像壹圆';
    if (studioFields.era) studioFields.era.value = '民国三年 · 1914';
    if (studioFields.mint) studioFields.mint.value = '天津造币总厂';
    if (studioFields.note) studioFields.note.value = '嘉禾纹 · 原味包浆';
    if (studioFields.category) studioFields.category.value = '银币';
    if (studioFields.grade) studioFields.grade.value = '极美';
    const cutout = $('[data-use-cutout]');
    if (cutout) cutout.checked = true;
    const autoStyle = $('[data-auto-style]');
    if (autoStyle) autoStyle.checked = true;
    restoreUploadEmpty();
    showStudioProcessing(false);
    setStudioImage('assets/img/coins/yuan-obv.webp');
    setStudioFormat('coin', { silent: true });
    setStudioStyle(autoStyleForCategory('银币'), { silent: true });
    updateStudioPreview();
    if (notify) showToast('已恢复示例藏品');
  }

  function openStudioPicker() {
    const input = $('#studioFile');
    input?.click();
  }

  let collection = [];
  let collectionLoaded = false;

  function loadCollection() {
    if (collectionLoaded) return;
    collectionLoaded = true;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      collection = Array.isArray(parsed) ? parsed.filter(item => item && item.id && item.image) : [];
    } catch (error) {
      collection = [];
    }
    updateCollectionCount();
  }

  function persistCollection() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
      updateCollectionCount();
      return true;
    } catch (error) {
      console.error(error);
      showToast('本地存储空间不足，请先移除一些展品');
      return false;
    }
  }

  function updateCollectionCount() {
    loadCollection();
    $$('[data-collection-count]').forEach(node => { node.textContent = collection.length; });
    $$('[data-collection-total]').forEach(node => { node.textContent = collection.length; });
  }

  function formatSavedDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    try {
      const parts = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(date);
      const pick = type => parts.find(part => part.type === type)?.value || '';
      return `${pick('year')}.${pick('month')}.${pick('day')}`;
    } catch (error) {
      return '';
    }
  }

  function renderCollection() {
    loadCollection();
    const grid = $('[data-collection-grid]');
    const empty = $('[data-collection-empty]');
    if (!grid || !empty) return;
    updateCollectionCount();
    if (!collection.length) {
      grid.innerHTML = '';
      grid.hidden = true;
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    grid.hidden = false;
    grid.innerHTML = collection.map(item => {
      const isNote = item.format === 'note';
      return `
      <article class="saved-card" data-saved-id="${escapeHTML(item.id)}">
        <div class="saved-visual">
          <span class="saved-visual-id">LQ · ${escapeHTML(item.serial || '00000')}</span>
          <div class="saved-visual-actions">
            <button class="saved-mini-btn" type="button" title="下载高清展签" aria-label="下载${escapeHTML(item.name)}展签" data-saved-download>
              <svg aria-hidden="true"><use href="#i-download"></use></svg>
            </button>
            <button class="saved-mini-btn" type="button" title="从展柜移除" aria-label="从展柜移除${escapeHTML(item.name)}" data-saved-remove>
              <svg aria-hidden="true"><use href="#i-trash"></use></svg>
            </button>
          </div>
          <div class="saved-frame style-${escapeHTML(item.style || 'heritage')}${isNote ? ' is-note' : ''}">
            <div class="saved-frame-mat">
              <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}装裱预览" loading="lazy">
              <span>${escapeHTML(item.name)}</span>
            </div>
          </div>
        </div>
        <div class="saved-info">
          <div class="saved-info-brow"><span>${escapeHTML(isNote ? '纸币' : (item.category || '旧钱币'))} · ${escapeHTML(item.grade || '自评品相')}</span><span>${escapeHTML(formatSavedDate(item.savedAt))}</span></div>
          <h3>${escapeHTML(item.name)}</h3>
          <p>${escapeHTML(item.era || '年代待考')}　|　${escapeHTML(item.mint || '产地待考')}</p>
          <div class="saved-info-foot">
            <span>展签样式 <b>${escapeHTML(STYLES[item.style]?.latin || 'HERITAGE')}</b></span>
            <span>${isNote ? '纸钞画幅' : '本地保存'}</span>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  function requireStudioName() {
    if (studioFields.name?.value.trim()) return true;
    showToast('先为这枚钱币写一个展签名字');
    studioFields.name?.focus();
    return false;
  }

  async function downloadStudioArt(options = {}) {
    const { notifyStart = true } = options;
    if (studioState.processing) {
      showToast('照片仍在处理中，请稍候');
      return;
    }
    if (!requireStudioName()) return;
    const snapshot = studioSnapshot();
    if (notifyStart) showToast('正在生成 1600 × 2000 高清展签…');
    try {
      const blob = await buildArtBlob(snapshot);
      triggerDownload(blob, `老钱展签-${safeFileName(snapshot.name)}.png`);
      showToast('高清展签已开始下载');
    } catch (error) {
      console.error(error);
      showToast('生成展签失败，请更换照片后重试');
    }
  }

  function safeFileName(value) {
    return String(value || '旧钱').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32) || '旧钱';
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1600);
  }

  function saveCurrentToCollection() {
    loadCollection();
    if (collection.length >= MAX_COLLECTION) {
      showToast(`展柜最多保存 ${MAX_COLLECTION} 件展品，请先移除一件`);
      return;
    }
    if (!requireStudioName()) return;
    const snapshot = studioSnapshot();
    const item = {
      id: (window.crypto?.randomUUID?.() || `lq-${Date.now()}`),
      serial: String(studioState.previewNo).padStart(5, '0'),
      name: snapshot.name,
      era: snapshot.era,
      mint: snapshot.mint,
      note: snapshot.note,
      category: snapshot.category,
      grade: snapshot.grade,
      style: snapshot.style,
      format: snapshot.format || 'coin',
      image: snapshot.image,
      savedAt: new Date().toISOString()
    };
    collection.unshift(item);
    if (!persistCollection()) {
      collection.shift();
      updateCollectionCount();
      return;
    }
    renderCollection();
    showToast(`「${item.name}」已存入我的展柜`);
  }

  function bindStudio() {
    if (!$('[data-studio-art]')) return;

    ['input', 'change'].forEach(eventName => {
      [studioFields.name, studioFields.era, studioFields.mint, studioFields.note]
        .filter(Boolean)
        .forEach(field => field.addEventListener(eventName, updateStudioPreview));
    });

    studioFields.category?.addEventListener('change', () => {
      if ($('[data-auto-style]')?.checked) {
        setStudioStyle(autoStyleForCategory(studioFields.category.value), { silent: true });
      }
      updateStudioPreview();
    });
    studioFields.grade?.addEventListener('change', updateStudioPreview);

    $$('[data-format]').forEach(button => {
      button.addEventListener('click', () => setStudioFormat(button.dataset.format, { silent: false }));
    });

    $$('[data-select-style]').forEach(button => {
      button.addEventListener('click', () => {
        setStudioStyle(button.dataset.selectStyle, { manual: true, silent: false });
        syncAutoStyleCheckbox(false);
      });
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const options = $$('[data-select-style]');
        const currentIndex = options.indexOf(button);
        const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
        const next = options[(currentIndex + direction + options.length) % options.length];
        next.focus();
        setStudioStyle(next.dataset.selectStyle, { manual: true, silent: true });
        syncAutoStyleCheckbox(false);
      });
    });

    $('[data-auto-style]')?.addEventListener('change', event => {
      if (event.target.checked) {
        const category = studioFields.category?.value || '银币';
        setStudioStyle(autoStyleForCategory(category), { silent: true });
        showToast('已根据类别自动匹配装裱');
      }
    });

    $('[data-use-cutout]')?.addEventListener('change', event => {
      if (studioState.sample) {
        event.target.checked = true;
        showToast('示例藏品已完成预裁切');
        return;
      }
      if (!studioState.cutoutSrc || !studioState.circleSrc) return;
      setStudioImage(event.target.checked ? studioState.cutoutSrc : studioState.circleSrc);
      const statusNode = $('[data-upload-status]');
      if (statusNode) {
        statusNode.textContent = event.target.checked
          ? (studioState.bgRemoved ? '智能抠圆与去背已完成 · 可继续完善展签' : '已启用圆形构图 · 建议使用纯色背景')
          : '已保留原图背景 · 仅做圆形构图';
      }
    });

    $$('[data-choose-studio-file]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        openStudioPicker();
      });
    });
    $('#studioFile')?.addEventListener('change', event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) handleStudioUpload(file);
    });
    $$('[data-use-sample]').forEach(button => {
      button.addEventListener('click', () => restoreStudioSample());
    });

    const dropZone = $('[data-studio-drop]');
    dropZone?.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      if (!$('[data-upload-processing]')?.hidden) return;
      openStudioPicker();
    });
    dropZone?.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === dropZone) {
        event.preventDefault();
        openStudioPicker();
      }
    });
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone?.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone?.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.remove('is-dragover');
      });
    });
    dropZone?.addEventListener('drop', event => {
      const file = event.dataTransfer?.files?.[0];
      if (file) handleStudioUpload(file);
    });

    $('[data-generate]')?.addEventListener('click', () => {
      if (studioState.processing) {
        showToast('照片仍在处理中，请稍候');
        return;
      }
      const snapshot = studioSnapshot();
      if (!studioFields.name?.value.trim()) {
        studioFields.name?.focus();
        showToast('先为这枚钱币写一个名字');
        return;
      }
      const art = $('[data-studio-art]');
      art?.classList.remove('is-generating');
      void art?.offsetWidth;
      art?.classList.add('is-generating');
      showToast('展签已生成 · 可下载高清 PNG 或存入展柜');
      const button = $('[data-generate]');
      if (button) {
        const original = button.innerHTML;
        button.innerHTML = '<svg aria-hidden="true"><use href="#i-check"></use></svg>展签已生成';
        button.disabled = true;
        window.setTimeout(() => {
          button.innerHTML = original;
          button.disabled = false;
        }, 2100);
      }
    });

    $('[data-download]')?.addEventListener('click', () => downloadStudioArt());
    $('[data-save-collection]')?.addEventListener('click', () => saveCurrentToCollection());

    setStudioFormat(studioState.format, { silent: true });
    updateStudioPreview();
    setStudioStyle(studioState.style, { silent: true });
  }

  function syncAutoStyleCheckbox(auto) {
    const input = $('[data-auto-style]');
    if (input) input.checked = Boolean(auto);
  }

  $('[data-collection-grid]')?.addEventListener('click', async event => {
    const downloadButton = event.target.closest('[data-saved-download]');
    const removeButton = event.target.closest('[data-saved-remove]');
    if (downloadButton) {
      const card = downloadButton.closest('[data-saved-id]');
      const item = collection.find(entry => entry.id === card?.dataset.savedId);
      if (!item) return;
      showToast('正在重建高清展签…');
      try {
        const snapshot = { ...item, style: item.style || 'heritage', format: item.format || 'coin', image: item.image, previewNo: item.serial || 1 };
        const blob = await buildArtBlob(snapshot);
        triggerDownload(blob, `老钱展签-${safeFileName(item.name)}.png`);
        showToast('展签已开始下载');
      } catch (error) {
        console.error(error);
        showToast('高清展签生成失败');
      }
      return;
    }
    if (removeButton) {
      const card = removeButton.closest('[data-saved-id]');
      const item = collection.find(entry => entry.id === card?.dataset.savedId);
      if (!item) return;
      if (removeButton.dataset.confirm !== '1') {
        removeButton.dataset.confirm = '1';
        removeButton.classList.add('is-confirming');
        removeButton.innerHTML = '<span>确认?</span>';
        window.setTimeout(() => {
          if (!removeButton.isConnected) return;
          removeButton.dataset.confirm = '';
          removeButton.classList.remove('is-confirming');
          removeButton.innerHTML = '<svg aria-hidden="true"><use href="#i-trash"></use></svg>';
        }, 2600);
        return;
      }
      collection = collection.filter(entry => entry.id !== item.id);
      persistCollection();
      renderCollection();
      showToast(`已从展柜移除「${item.name}」`);
    }
  });

  /* ────────────────────────────────
     Quick upload from home
     ──────────────────────────────── */
  function goToStudioWithFile(file) {
    if (!validateImageFile(file)) return;
    if (currentRoute === 'studio') {
      handleStudioUpload(file);
      return;
    }
    pendingStudioFile = file;
    if (window.location.hash === '#/studio') applyRoute({ scroll: true });
    else window.location.hash = '#/studio';
  }

  function bindQuickUpload() {
    const input = $('#quickUploadInput');
    const drop = $('[data-quick-drop]');
    if (!input || !drop) return;
    const choose = () => input.click();
    drop.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      choose();
    });
    drop.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        choose();
      }
    });
    $('.quick-select')?.addEventListener('click', choose);
    input.addEventListener('change', event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) goToStudioWithFile(file);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
      drop.addEventListener(eventName, event => {
        event.preventDefault();
        drop.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      drop.addEventListener(eventName, event => {
        event.preventDefault();
        drop.classList.remove('is-dragover');
      });
    });
    drop.addEventListener('drop', event => {
      const file = event.dataTransfer?.files?.[0];
      if (file) goToStudioWithFile(file);
    });
    $$('[data-try-sample]').forEach(button => {
      button.addEventListener('click', () => {
        restoreStudioSample({ notify: false });
        if (currentRoute !== 'studio') {
          window.location.hash = '#/studio';
          showToast('已载入示例藏品，试着改一改展签吧');
        } else {
          showToast('已载入示例藏品');
        }
      });
    });
  }

  /* ────────────────────────────────
     Export artwork (canvas → PNG)
     ──────────────────────────────── */
  const ART_W = 1600;
  const ART_H = 2000;
  const ART_SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", "SimSun", serif';
  const ART_SANS = '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';
  const ART_LATIN = '"Bodoni 72", "Didot", "Bodoni MT", "Times New Roman", serif';
  const ART_MONO = '"SFMono-Regular", "Cascadia Mono", "Consolas", monospace';

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function artFont(ctx, size, family = 'serif', weight = 400) {
    const stack = family === 'latin' ? ART_LATIN : family === 'mono' ? ART_MONO : family === 'sans' ? ART_SANS : ART_SERIF;
    ctx.font = `${weight} ${Math.round(size)}px ${stack}`;
  }

  function paintText(ctx, text, x, y, options = {}) {
    const {
      size = 24,
      family = 'sans',
      weight = 400,
      color = '#241f18',
      align = 'left',
      baseline = 'middle',
      tracking = 0,
      maxWidth = 0,
      opacity = 1
    } = options;
    ctx.save();
    artFont(ctx, size, family, weight);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.globalAlpha = opacity;
    let content = String(text ?? '');
    if (maxWidth > 0) {
      let measured = ctx.measureText(content).width;
      if (measured > maxWidth) {
        while (content.length > 1 && ctx.measureText(`${content}…`).width > maxWidth) {
          content = content.slice(0, -1);
        }
        content += '…';
      }
    }
    ctx.fillText(content, x, y);
    const measured = ctx.measureText(content).width;
    ctx.restore();
    return measured;
  }

  function fitArtFont(ctx, text, maxWidth, startSize, minSize, family = 'serif', weight = 400) {
    let size = startSize;
    while (size > minSize) {
      artFont(ctx, size, family, weight);
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 2;
    }
    return size;
  }

  function drawArtRule(ctx, x1, y1, x2, y2, color = 'rgba(49,38,24,.28)', width = 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawArtDiamond(ctx, x, y, size, color = '#9b3328') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function drawArtSeal(ctx, x, y, size, rotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = '#973126';
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.strokeStyle = 'rgba(251, 238, 219, .52)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-size / 2 + Math.max(3, size * .09), -size / 2 + Math.max(3, size * .09), size - Math.max(6, size * .18), size - Math.max(6, size * .18));
    ctx.fillStyle = '#f7e9d5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    artFont(ctx, size * .31, 'serif', 500);
    ctx.fillText('老', 0, -size * .17);
    ctx.fillText('钱', 0, size * .19);
    ctx.restore();
  }

  function drawArtNoise(ctx, seed, count = 5600, opacity = 1) {
    const rand = seededRandom(seed);
    ctx.save();
    for (let i = 0; i < count; i += 1) {
      const x = rand() * ART_W;
      const y = rand() * ART_H;
      const alpha = (rand() * .045 + .01) * opacity;
      ctx.fillStyle = `rgba(60, 43, 24, ${alpha.toFixed(3)})`;
      const size = rand() > .82 ? 1.4 : .75;
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
  }

  function drawArtBackground(ctx, type) {
    const palettes = {
      heritage: { top: '#eae2d4', bottom: '#e1d6c5' },
      catalogue: { top: '#eeeae1', bottom: '#e4ded3' },
      scroll: { top: '#d9cbb6', bottom: '#cfc0a9' }
    };
    const palette = palettes[type] || palettes.heritage;
    const gradient = ctx.createLinearGradient(0, 0, ART_W, ART_H);
    gradient.addColorStop(0, palette.top);
    gradient.addColorStop(1, palette.bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ART_W, ART_H);

    const vignette = ctx.createRadialGradient(ART_W / 2, ART_H * .42, 130, ART_W / 2, ART_H * .52, 1050);
    vignette.addColorStop(0, 'rgba(255, 251, 241, .17)');
    vignette.addColorStop(.68, 'rgba(255, 251, 241, 0)');
    vignette.addColorStop(1, 'rgba(66, 48, 28, .08)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, ART_W, ART_H);

    if (type === 'scroll') {
      ctx.save();
      ctx.strokeStyle = 'rgba(87, 65, 39, .055)';
      ctx.lineWidth = 1;
      for (let x = 12; x < ART_W; x += 7) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ART_H);
        ctx.stroke();
      }
      for (let y = 14; y < ART_H; y += 9) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ART_W, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = type === 'catalogue' ? 'rgba(77, 59, 35, .07)' : 'rgba(92, 68, 39, .1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ART_W / 2, 870, 620, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ART_W / 2, 870, 540, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawArtNoise(ctx, type === 'scroll' ? 2901 : type === 'catalogue' ? 1881 : 9137, type === 'catalogue' ? 3700 : 5400, 1);
  }

  function drawArtCoin(ctx, image, cx, cy, size) {
    const halo = ctx.createRadialGradient(cx - size * .08, cy - size * .1, size * .08, cx, cy, size * .56);
    halo.addColorStop(0, 'rgba(255, 252, 245, .32)');
    halo.addColorStop(.55, 'rgba(242, 233, 218, .13)');
    halo.addColorStop(1, 'rgba(242, 233, 218, 0)');
    ctx.save();
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, size * .56, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(41, 26, 12, .27)';
    ctx.shadowBlur = size * .055;
    ctx.shadowOffsetY = size * .03;
    ctx.drawImage(image, cx - size / 2, cy - size / 2, size, size);
    ctx.restore();
  }

  function frameMeta(snapshot) {
    const category = categoryLabels[snapshot.category] || snapshot.category || '旧钱币';
    const meta = [snapshot.era, snapshot.grade];
    if (snapshot.note) meta.push(snapshot.note);
    return {
      category,
      kicker: `${category} · ${snapshot.mint || '产地待考'}`,
      meta: meta.filter(Boolean).join('　·　'),
      serial: String(snapshot.previewNo ?? snapshot.serial ?? '18').replace(/^0+(?=\d)/, '').padStart(3, '0')
    };
  }

  function drawArtObject(ctx, image, snapshot, cx, cy, size) {
    if (snapshot.format === 'note') {
      const aspect = Math.max(.7, Math.min(4.2, image.naturalWidth / image.naturalHeight));
      let width = Math.min(1000, size * 1.32);
      let height = width / aspect;
      if (height > size * .88) {
        height = size * .88;
        width = height * aspect;
      }
      const padX = 28;
      const padY = 22;
      const boardW = width + padX * 2;
      const boardH = height + padY * 2;
      const boardX = cx - boardW / 2;
      const boardY = cy - boardH / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(34, 22, 10, .3)';
      ctx.shadowBlur = 36;
      ctx.shadowOffsetY = 22;
      const board = ctx.createLinearGradient(boardX, boardY, boardX + boardW, boardY + boardH);
      board.addColorStop(0, '#242019');
      board.addColorStop(.52, '#14120e');
      board.addColorStop(1, '#211d16');
      ctx.fillStyle = board;
      ctx.fillRect(boardX, boardY, boardW, boardH);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = 'rgba(209, 177, 122, .38)';
      ctx.lineWidth = 1;
      ctx.strokeRect(boardX + 9, boardY + 9, boardW - 18, boardH - 18);
      ctx.shadowColor = 'rgba(0, 0, 0, .4)';
      ctx.shadowBlur = 25;
      ctx.shadowOffsetY = 12;
      ctx.drawImage(image, cx - width / 2, cy - height / 2, width, height);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 229, 201, .12)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - width / 2, cy - height / 2, width, height);
      ctx.restore();
      return;
    }
    drawArtCoin(ctx, image, cx, cy, size);
  }

  function drawHeritageArt(ctx, image, snapshot) {
    const info = frameMeta(snapshot);
    drawArtBackground(ctx, 'heritage');

    const fx = 105;
    const fy = 88;
    const fw = 1390;
    const fh = 1824;
    ctx.save();
    ctx.shadowColor = 'rgba(31, 20, 10, .38)';
    ctx.shadowBlur = 68;
    ctx.shadowOffsetY = 33;
    ctx.fillStyle = '#18130d';
    ctx.fillRect(fx, fy, fw, fh);
    ctx.restore();

    const wood = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh);
    wood.addColorStop(0, '#4b3b27');
    wood.addColorStop(.2, '#281f15');
    wood.addColorStop(.52, '#17120d');
    wood.addColorStop(.8, '#3b2d1e');
    wood.addColorStop(1, '#21190f');
    ctx.fillStyle = wood;
    ctx.fillRect(fx + 5, fy + 5, fw - 10, fh - 10);

    ctx.strokeStyle = 'rgba(205, 172, 115, .6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(fx + 25, fy + 25, fw - 50, fh - 50);
    ctx.strokeStyle = 'rgba(205, 172, 115, .22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(fx + 36, fy + 36, fw - 72, fh - 72);

    const mx = fx + 58;
    const my = fy + 58;
    const mw = fw - 116;
    const mh = fh - 116;
    const mat = ctx.createLinearGradient(mx, my, mx + mw, my + mh);
    mat.addColorStop(0, '#f3ebdc');
    mat.addColorStop(.52, '#ece1d0');
    mat.addColorStop(1, '#f1e7d7');
    ctx.save();
    ctx.shadowColor = 'rgba(23, 15, 7, .31)';
    ctx.shadowBlur = 23;
    ctx.fillStyle = mat;
    ctx.fillRect(mx, my, mw, mh);
    ctx.restore();

    ctx.strokeStyle = 'rgba(107, 81, 47, .26)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 28, my + 28, mw - 56, mh - 56);
    ctx.strokeStyle = 'rgba(255, 251, 242, .65)';
    ctx.strokeRect(mx + 33, my + 33, mw - 66, mh - 66);

    const headY = my + 69;
    paintText(ctx, STYLES.heritage.head, mx + 52, headY, { size: 17, family: 'latin', color: '#89785f', tracking: 2.3 });
    paintText(ctx, `PLATE ${info.serial}`, mx + mw - 52, headY, { size: 17, family: 'latin', color: '#89785f', tracking: 2.3, align: 'right' });
    drawArtRule(ctx, mx + 52, headY + 26, mx + mw - 52, headY + 26, 'rgba(95, 72, 42, .21)');

    drawArtObject(ctx, image, snapshot, 800, 796, 762);

    const kickerY = 1285;
    paintText(ctx, info.kicker, 800, kickerY, {
      size: 24,
      family: 'sans',
      color: '#8a775e',
      align: 'center',
      tracking: 2.1
    });

    const nameSize = fitArtFont(ctx, snapshot.name, 1050, 80, 48, 'serif', 600);
    paintText(ctx, snapshot.name, 800, 1364, {
      size: nameSize,
      family: 'serif',
      weight: 600,
      color: '#241e17',
      align: 'center',
      tracking: 3
    });
    paintText(ctx, info.meta, 800, 1432, {
      size: 23,
      family: 'sans',
      color: '#796956',
      align: 'center',
      tracking: .8,
      maxWidth: 1020
    });
    drawArtRule(ctx, 708, 1488, 892, 1488, 'rgba(100, 75, 43, .28)');
    drawArtDiamond(ctx, 800, 1488, 5, 'rgba(155, 51, 40, .78)');

    paintText(ctx, '旧 钱 有 光 · 岁 月 有 价', 800, 1540, {
      size: 17,
      family: 'serif',
      color: 'rgba(104, 86, 63, .56)',
      align: 'center',
      tracking: 5
    });

    const footLineY = 1772;
    drawArtRule(ctx, mx + 52, footLineY, mx + mw - 52, footLineY, 'rgba(95, 72, 42, .18)');
    paintText(ctx, '老钱 · 钱币影像', mx + 52, footLineY + 32, { size: 17, family: 'sans', color: '#8b7a62', tracking: .8 });
    paintText(ctx, 'LAO QIAN / 2026', mx + mw - 52, footLineY + 32, { size: 17, family: 'latin', color: '#8b7a62', tracking: 1.7, align: 'right' });
    drawArtSeal(ctx, 800, footLineY + 33, 51, -.025);
  }

  function drawCatalogueArt(ctx, image, snapshot) {
    const info = frameMeta(snapshot);
    drawArtBackground(ctx, 'catalogue');

    const fx = 126;
    const fy = 84;
    const fw = 1348;
    const fh = 1832;
    ctx.save();
    ctx.shadowColor = 'rgba(35, 27, 17, .2)';
    ctx.shadowBlur = 54;
    ctx.shadowOffsetY = 28;
    ctx.fillStyle = '#1c1b18';
    ctx.fillRect(fx, fy, fw, fh);
    ctx.restore();
    ctx.fillStyle = '#fbf8f1';
    ctx.fillRect(fx + 15, fy + 15, fw - 30, fh - 30);
    ctx.strokeStyle = 'rgba(51, 43, 31, .15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(fx + 35, fy + 35, fw - 70, fh - 70);

    const headY = fy + 104;
    paintText(ctx, 'LAO QIAN · CATALOGUE RAISONNÉ', fx + 74, headY, {
      size: 16, family: 'latin', color: '#8c7f6c', tracking: 2.2
    });
    paintText(ctx, `NO. ${info.serial}`, fx + fw - 74, headY, {
      size: 16, family: 'latin', color: '#8c7f6c', tracking: 2.2, align: 'right'
    });
    drawArtRule(ctx, fx + 74, headY + 28, fx + fw - 74, headY + 28, 'rgba(53, 43, 29, .14)');

    drawArtObject(ctx, image, snapshot, 800, 716, 786);

    const textX = fx + 122;
    const kickerY = 1207;
    paintText(ctx, info.kicker.toUpperCase(), textX, kickerY, {
      size: 22, family: 'sans', color: '#8b7962', tracking: 2.2
    });
    const nameSize = fitArtFont(ctx, snapshot.name, 980, 76, 45, 'serif', 600);
    paintText(ctx, snapshot.name, textX, 1291, {
      size: nameSize, family: 'serif', weight: 600, color: '#211f1a', tracking: 2.6
    });
    paintText(ctx, info.meta, textX, 1366, {
      size: 22, family: 'sans', color: '#766a5a', tracking: .6, maxWidth: 980
    });
    drawArtRule(ctx, textX, 1427, fx + fw - 122, 1427, 'rgba(53, 43, 29, .17)');

    ctx.save();
    ctx.fillStyle = 'rgba(155, 51, 40, .8)';
    ctx.fillRect(textX, 1468, 3, 118);
    ctx.restore();
    paintText(ctx, '所 见 即 所 藏', textX + 23, 1502, {
      size: 17, family: 'serif', color: 'rgba(101, 86, 65, .58)', tracking: 4
    });
    paintText(ctx, 'OLD COINS, NEW LIGHT.', textX + 23, 1544, {
      size: 14, family: 'latin', color: 'rgba(127, 111, 87, .53)', tracking: 2.4
    });

    const footY = 1788;
    drawArtRule(ctx, fx + 74, footY, fx + fw - 74, footY, 'rgba(53, 43, 29, .15)');
    paintText(ctx, '老钱 · 私人影像档案', fx + 74, footY + 34, { size: 17, family: 'sans', color: '#8c7e6a', tracking: .6 });
    paintText(ctx, `${snapshot.category.toUpperCase()} · PRIVATE ARCHIVE`, fx + fw - 74, footY + 34, {
      size: 15, family: 'latin', color: '#8c7e6a', tracking: 1.9, align: 'right'
    });
    drawArtSeal(ctx, fx + fw - 150, fy + 139, 62, .035);
  }

  function drawScrollArt(ctx, image, snapshot) {
    const info = frameMeta(snapshot);
    drawArtBackground(ctx, 'scroll');

    ctx.save();
    ctx.shadowColor = 'rgba(55, 38, 19, .22)';
    ctx.shadowBlur = 46;
    ctx.shadowOffsetY = 23;
    ctx.fillStyle = '#efe6d6';
    ctx.fillRect(297, 107, 1006, 1786);
    ctx.restore();

    ctx.fillStyle = '#f1e8d8';
    ctx.fillRect(297, 107, 1006, 1786);
    ctx.strokeStyle = 'rgba(105, 77, 43, .24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(315, 125, 970, 1750);
    ctx.strokeStyle = 'rgba(155, 51, 40, .7)';
    ctx.lineWidth = 1.4;
    drawArtRule(ctx, 240, 151, 1360, 151, 'rgba(155, 51, 40, .64)', 1.4);
    drawArtRule(ctx, 240, 1847, 1360, 1847, 'rgba(155, 51, 40, .64)', 1.4);

    paintText(ctx, '舊幣影像 · 手卷', 800, 207, {
      size: 19, family: 'serif', color: '#8f7659', tracking: 5, align: 'center'
    });
    paintText(ctx, `卷 · ${info.serial}`, 800, 243, {
      size: 13, family: 'mono', color: 'rgba(121, 98, 67, .55)', tracking: 2, align: 'center'
    });

    drawArtObject(ctx, image, snapshot, 800, 700, 682);

    paintText(ctx, info.kicker, 800, 1158, {
      size: 22, family: 'sans', color: '#8b7459', tracking: 2, align: 'center'
    });
    const nameSize = fitArtFont(ctx, snapshot.name, 710, 68, 42, 'serif', 600);
    paintText(ctx, snapshot.name, 800, 1238, {
      size: nameSize, family: 'serif', weight: 600, color: '#251f18', tracking: 3, align: 'center'
    });
    paintText(ctx, info.meta, 800, 1304, {
      size: 21, family: 'sans', color: '#7c6c58', tracking: .5, align: 'center', maxWidth: 710
    });
    drawArtRule(ctx, 720, 1352, 880, 1352, 'rgba(112, 82, 47, .3)');
    drawArtDiamond(ctx, 800, 1352, 5, 'rgba(155, 51, 40, .75)');

    const sideText = '舊幣有光';
    [...sideText].forEach((character, index) => {
      paintText(ctx, character, 1265, 1555 + index * 35, {
        size: 18, family: 'serif', color: 'rgba(117, 89, 56, .5)', align: 'center'
      });
    });

    const footY = 1723;
    paintText(ctx, '老钱 · 钱币影像', 391, footY, { size: 15, family: 'sans', color: '#8d7a61', tracking: .8 });
    paintText(ctx, '歲月有痕', 1209, footY, { size: 15, family: 'serif', color: '#8d7a61', tracking: 2.7, align: 'right' });
    drawArtSeal(ctx, 800, 1783, 55, -.035);
    paintText(ctx, 'LAO QIAN · 2026', 800, 1834, {
      size: 12, family: 'latin', color: 'rgba(113, 88, 57, .5)', tracking: 2.2, align: 'center'
    });
  }

  function renderArtCanvas(snapshot, image) {
    const canvas = document.createElement('canvas');
    canvas.width = ART_W;
    canvas.height = ART_H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const style = STYLES[snapshot.style] ? snapshot.style : 'heritage';
    if (style === 'catalogue') drawCatalogueArt(ctx, image, snapshot);
    else if (style === 'scroll') drawScrollArt(ctx, image, snapshot);
    else drawHeritageArt(ctx, image, snapshot);
    return canvas;
  }

  async function buildArtBlob(snapshot) {
    if (!snapshot?.image) throw new Error('缺少钱币影像');
    const image = await loadImage(snapshot.image);
    const canvas = renderArtCanvas(snapshot, image);
    return new Promise((resolve, reject) => {
      if (canvas.toBlob) {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('无法输出图片'));
        }, 'image/png');
      } else {
        try {
          const base64 = canvas.toDataURL('image/png').split(',')[1];
          const bytes = atob(base64);
          const buffer = new Uint8Array(bytes.length);
          for (let index = 0; index < bytes.length; index += 1) buffer[index] = bytes.charCodeAt(index);
          resolve(new Blob([buffer], { type: 'image/png' }));
        } catch (error) {
          reject(error);
        }
      }
    });
  }

  /* ────────────────────────────────
     Boot
     ──────────────────────────────── */
  stampToday();
  loadCollection();
  updateCatalogCounts();
  renderFeatured();
  renderAtlas();
  renderTape();
  renderHomeMarket();
  populateEstimator();
  renderMarketTable();
  bindEstimator();
  bindAtlas();
  bindStudio();
  bindQuickUpload();
  calculateEstimate();
  applyRoute({ scroll: false });

  /* Global helper for demo surfaces */
  window.LaoQian = {
    coins: COINS,
    restoreStudioSample,
    showToast
  };
})();

