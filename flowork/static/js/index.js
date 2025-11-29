class SearchApp {
    constructor() {
        this.container = document.querySelector('.search-container:not([data-initialized])');
        if (!this.container) return;
        this.container.dataset.initialized = "true";

        this.csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
        this.liveSearchUrl = this.container.dataset.liveSearchUrl;
        
        this.dom = {
            searchInput: this.container.querySelector('#search-query-input'),
            clearTopBtn: this.container.querySelector('#keypad-clear-top'),
            categoryBar: this.container.querySelector('#category-bar'),
            hiddenCategoryInput: this.container.querySelector('#selected-category'),
            keypadContainer: this.container.querySelector('#keypad-container'),
            keypadNum: this.container.querySelector('#keypad-num'),
            keypadKor: this.container.querySelector('#keypad-kor'),
            keypadEng: this.container.querySelector('#keypad-eng'),
            productListUl: this.container.querySelector('#product-list-ul'),
            productListHeader: this.container.querySelector('#product-list-header'),
            paginationUL: this.container.querySelector('#search-pagination'),
            listContainer: this.container.querySelector('#product-list-view'),
            detailContainer: this.container.querySelector('#product-detail-view'),
            detailIframe: this.container.querySelector('#product-detail-iframe'),
            backButton: this.container.querySelector('#btn-back-to-list'),
            searchForm: this.container.querySelector('#search-form'),
            categoryButtons: this.container.querySelectorAll('.category-btn')
        };

        this.state = {
            debounceTimer: null,
            isKorShiftActive: false
        };

        this.korKeyMap = {'ㅂ':'ㅃ', 'ㅈ':'ㅉ', 'ㄷ':'ㄸ', 'ㄱ':'ㄲ', 'ㅅ':'ㅆ', 'ㅐ':'ㅒ', 'ㅔ':'ㅖ'};
        this.korReverseKeyMap = {'ㅃ':'ㅂ', 'ㅉ':'ㅈ', 'ㄸ':'ㄷ', 'ㄲ':'ㄱ', 'ㅆ':'ㅅ', 'ㅒ':'ㅐ', 'ㅖ':'ㅔ'};

        this.init();
    }

    init() {
        this.checkMobileMode();
        this.bindEvents();
        this.showKeypad('num');
        
        if (this.dom.hiddenCategoryInput) {
            const currentCategory = this.dom.hiddenCategoryInput.value || '전체';
            this.dom.categoryButtons.forEach(btn => {
                if (btn.dataset.category === currentCategory) btn.classList.add('active');
            });
        }
        
        this.performSearch(1);
    }

    checkMobileMode() {
        // 모바일에서 키패드 사용을 강제하기 위해 readOnly 처리
        if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && this.dom.searchInput) {
            this.dom.searchInput.setAttribute('readonly', true);
            this.dom.searchInput.setAttribute('inputmode', 'none');
        }
    }

    bindEvents() {
        if (this.dom.productListUl) {
            this.dom.productListUl.addEventListener('click', (e) => this.handleProductClick(e));
        }
        if (this.dom.backButton) {
            this.dom.backButton.addEventListener('click', () => this.handleBackButtonClick());
        }
        if (this.dom.keypadContainer) {
            this.dom.keypadContainer.addEventListener('click', (e) => this.handleKeypadClick(e));
        }
        if (this.dom.categoryBar) {
            this.dom.categoryBar.addEventListener('click', (e) => this.handleCategoryClick(e));
        }
        if (this.dom.clearTopBtn) {
            this.dom.clearTopBtn.addEventListener('click', () => {
                this.dom.searchInput.value = '';
                this.triggerSearch(true); 
                this.dom.searchInput.focus();
            });
        }
        if (this.dom.searchInput) {
            this.dom.searchInput.addEventListener('input', (e) => {
                if (e.isTrusted && !e.target.readOnly) this.triggerSearch();
            });
            this.dom.searchInput.addEventListener('keydown', (e) => {
                if (e.target.readOnly) return;
                if (e.key === 'Enter') { clearTimeout(this.state.debounceTimer); this.performSearch(1); }
            });
        }
        if (this.dom.searchForm) {
            this.dom.searchForm.addEventListener('submit', (e) => {
                e.preventDefault(); clearTimeout(this.state.debounceTimer); this.performSearch(1);
            });
        }
    }

    handleProductClick(e) {
        const link = e.target.closest('a.product-item');
        if (link && window.innerWidth >= 992) {
            e.preventDefault();
            const targetUrl = link.getAttribute('href');
            const detailUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'partial=1';
            
            if (this.dom.detailIframe) this.dom.detailIframe.src = detailUrl;
            if (this.dom.listContainer && this.dom.detailContainer) {
                this.dom.listContainer.style.display = 'none';
                this.dom.detailContainer.style.display = 'flex';
            }
        }
    }

    handleBackButtonClick() {
        if (this.dom.listContainer && this.dom.detailContainer) {
            this.dom.listContainer.style.display = 'flex';
            this.dom.detailContainer.style.display = 'none';
        }
        if (this.dom.detailIframe) this.dom.detailIframe.src = 'about:blank';
    }
    
    handleKeypadClick(e) {
        // 버튼 또는 버튼 내부 요소를 클릭했을 때 처리
        const keyBtn = e.target.closest('.keypad-btn, .qwerty-key');
        if (!keyBtn) return;
        
        const dataKey = keyBtn.dataset.key;
        if (!dataKey) return;

        const input = this.dom.searchInput;

        if (dataKey === 'backspace') {
            if (input.value.length > 0) {
                // 한글 자소 단위 삭제 지원 (Hangul.d 사용)
                if (window.Hangul) {
                    let disassembled = Hangul.d(input.value);
                    disassembled.pop();
                    input.value = Hangul.a(disassembled);
                } else {
                    input.value = input.value.slice(0, -1);
                }
            }
            this.triggerSearch();
        } else if (dataKey === 'mode-kor') {
            this.showKeypad('kor');
        } else if (dataKey === 'mode-eng') {
            this.showKeypad('eng');
            this.resetShift();
        } else if (dataKey === 'mode-num') {
            this.showKeypad('num');
            this.resetShift();
        } else if (dataKey === 'shift-kor') {
            this.toggleShift();
        } else if (dataKey === 'shift-eng') {
            // 영문 쉬프트 구현 (대소문자 토글)
        } else if (dataKey === ' ') {
            input.value += ' ';
            this.triggerSearch();
        } else {
            // 한글 조합 또는 일반 문자 입력
             if (window.Hangul && this.dom.keypadKor && !this.dom.keypadKor.classList.contains('keypad-hidden')) {
                input.value = Hangul.assemble(input.value + dataKey);
            } else {
                input.value += dataKey;
            }
            this.triggerSearch();
        }
        input.focus();
    }

    handleCategoryClick(e) {
        const target = e.target.closest('.category-btn');
        if (!target) return;
        this.dom.categoryButtons.forEach(btn => btn.classList.remove('active'));
        target.classList.add('active');
        this.dom.hiddenCategoryInput.value = target.dataset.category;
        this.performSearch(1);
        this.dom.searchInput.focus();
    }

    showKeypad(mode) {
        this.dom.keypadNum.classList.add('keypad-hidden');
        this.dom.keypadKor.classList.add('keypad-hidden');
        this.dom.keypadEng.classList.add('keypad-hidden');

        if (mode === 'kor') {
            this.dom.keypadKor.classList.remove('keypad-hidden');
            document.body.dataset.inputMode = 'kor';
        } else if (mode === 'eng') {
            this.dom.keypadEng.classList.remove('keypad-hidden');
            document.body.dataset.inputMode = 'eng';
        } else {
            this.dom.keypadNum.classList.remove('keypad-hidden');
            document.body.dataset.inputMode = 'num';
        }
    }

    resetShift() {
        if (this.state.isKorShiftActive) this.toggleShift();
    }

    toggleShift() {
        this.state.isKorShiftActive = !this.state.isKorShiftActive;
        const korShiftBtn = this.container.querySelector('#keypad-kor [data-key="shift-kor"]');
        
        if (this.state.isKorShiftActive) {
            korShiftBtn.classList.add('active', 'btn-primary');
            korShiftBtn.classList.remove('btn-outline-secondary');
            for (const [base, shifted] of Object.entries(this.korKeyMap)) {
                const el = this.container.querySelector(`#keypad-kor [data-key="${base}"]`);
                if (el) { el.dataset.key = shifted; el.textContent = shifted; }
            }
        } else {
            korShiftBtn.classList.remove('active', 'btn-primary');
            korShiftBtn.classList.add('btn-outline-secondary');
            for (const [shifted, base] of Object.entries(this.korReverseKeyMap)) {
                const el = this.container.querySelector(`#keypad-kor [data-key="${shifted}"]`);
                if (el) { el.dataset.key = base; el.textContent = base; }
            }
        }
    }
    
    triggerSearch(immediate = false) {
        clearTimeout(this.state.debounceTimer);
        if (immediate) this.performSearch(1);
        else this.state.debounceTimer = setTimeout(() => this.performSearch(1), 300);
    }

    async performSearch(page = 1) {
        const query = this.dom.searchInput.value;
        const category = this.dom.hiddenCategoryInput.value;
        
        this.dom.productListUl.innerHTML = '<li class="list-group-item text-center text-muted p-4">검색 중...</li>';
        this.dom.paginationUL.innerHTML = '';

        try {
            const response = await fetch(this.liveSearchUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken },
                body: JSON.stringify({ query, category, page, per_page: 10 })
            });
            const data = await response.json();
            
            if (data.status === 'success') {
                // 데스크탑에서는 상세화면 iframe 초기화
                if (this.dom.listContainer && this.dom.detailContainer) {
                    this.dom.listContainer.style.display = 'flex';
                    this.dom.detailContainer.style.display = 'none';
                }
                if (this.dom.detailIframe) this.dom.detailIframe.src = 'about:blank';

                this.renderResults(data.products, data.showing_favorites, data.selected_category);
                this.renderPagination(data.total_pages, data.current_page);
            } else throw new Error(data.message);
        } catch (error) {
            console.error('Search error:', error);
            this.dom.productListUl.innerHTML = '<li class="list-group-item text-center text-danger p-4">오류 발생</li>';
        }
    }

    renderResults(products, showingFavorites, selectedCategory) {
        if (showingFavorites) {
            this.dom.productListHeader.innerHTML = '<i class="bi bi-star-fill me-2 text-warning"></i>즐겨찾기';
        } else {
            const badge = (selectedCategory && selectedCategory !== '전체') ? `<span class="badge bg-success ms-2">${selectedCategory}</span>` : '';
            this.dom.productListHeader.innerHTML = `<i class="bi bi-card-list me-2"></i>검색 결과 ${badge}`;
        }
        
        this.dom.productListUl.innerHTML = '';
        if (products.length === 0) {
            this.dom.productListUl.innerHTML = `<li class="list-group-item text-center text-muted p-4">${showingFavorites ? '즐겨찾기 없음' : '검색 결과 없음'}</li>`;
            return;
        }

        products.forEach(p => {
            const html = `
                <li class="list-group-item p-0">
                    <a href="/product/${p.product_id}" class="product-item d-flex align-items-center text-decoration-none text-body spa-link p-3">
                        <img src="${p.image_url}" alt="${p.product_name}" class="item-image rounded border flex-shrink-0" onerror="imgFallback(this)">
                        <div class="item-details flex-grow-1 ms-3 overflow-hidden">
                            <div class="product-name fw-bold text-truncate">${p.product_name}</div>
                            <div class="product-meta small text-muted d-flex align-items-center">
                                <span class="meta-item me-2">${p.product_number}</span>
                                ${p.colors ? `<span class="meta-item text-truncate d-none d-sm-inline me-2" style="max-width:100px;">| ${p.colors}</span>` : ''}
                            </div>
                            <div class="d-flex align-items-center mt-1">
                                <span class="meta-item me-2 fw-bold text-dark">${p.sale_price}</span>
                                <span class="meta-item discount small fw-bold ${p.original_price > 0 ? 'text-danger' : 'text-secondary'}">${p.discount}</span>
                            </div>
                        </div>
                    </a>
                </li>`;
            this.dom.productListUl.insertAdjacentHTML('beforeend', html);
        });
    }

    renderPagination(totalPages, currentPage) {
        if (totalPages <= 1) return;
        
        const createItem = (page, text, isActive, isDisabled) => {
            const li = document.createElement('li');
            li.className = `page-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`;
            const a = document.createElement('a');
            a.className = 'page-link shadow-none border-0 text-secondary';
            a.href = '#';
            a.textContent = text;
            if (!isDisabled && !isActive) a.onclick = (e) => { e.preventDefault(); this.performSearch(page); };
            li.appendChild(a);
            return li;
        };

        this.dom.paginationUL.appendChild(createItem(currentPage - 1, 'Prev', false, currentPage === 1));
        
        // 페이지네이션 로직 간소화 (현재 페이지 주변만 표시)
        let start = Math.max(1, currentPage - 1);
        let end = Math.min(totalPages, currentPage + 1);

        if(start > 1) this.dom.paginationUL.appendChild(createItem(1, '1', false, false));
        if(start > 2) this.dom.paginationUL.appendChild(createItem(null, '...', false, true));

        for (let i = start; i <= end; i++) {
            this.dom.paginationUL.appendChild(createItem(i, i, i === currentPage, false));
        }
        
        if(end < totalPages - 1) this.dom.paginationUL.appendChild(createItem(null, '...', false, true));
        if(end < totalPages) this.dom.paginationUL.appendChild(createItem(totalPages, totalPages, false, false));
        
        this.dom.paginationUL.appendChild(createItem(currentPage + 1, 'Next', false, currentPage === totalPages));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.search-container')) new SearchApp();
});