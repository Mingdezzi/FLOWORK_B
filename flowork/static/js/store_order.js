class StoreOrderApp {
    constructor() {
        this.container = document.querySelector('.store-order-container:not([data-initialized])');
        if (!this.container) return;
        this.container.dataset.initialized = "true";

        this.csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
        
        // 모달은 컨테이너 형제 요소 (block content 내)
        // 탭 로직 상 page-content-layer > .unique-content-area > [container, modal] 구조임.
        const pageLayer = this.container.closest('.unique-content-area') || document;
        this.modalEl = pageLayer.querySelector('#orderModal');
        this.modal = this.modalEl ? new bootstrap.Modal(this.modalEl) : null;

        this.dom = {
            openBtn: this.container.querySelector('.btn-open-modal'),
            dateInput: pageLayer.querySelector('#req-date'),
            reqPnInput: pageLayer.querySelector('#req-pn'),
            searchBtn: pageLayer.querySelector('#btn-search-prod'),
            searchResults: pageLayer.querySelector('#search-results'),
            colorSelect: pageLayer.querySelector('#req-color'),
            sizeSelect: pageLayer.querySelector('#req-size'),
            submitBtn: pageLayer.querySelector('#btn-submit-order')
        };

        this.selectedVariantId = null;
        this.variantsCache = [];

        this.init();
    }

    init() {
        const today = new Date().toISOString().split('T')[0];
        if (this.dom.dateInput) this.dom.dateInput.value = today;

        if (this.dom.openBtn) {
            this.dom.openBtn.addEventListener('click', () => {
                if(this.modal) this.modal.show();
            });
        }

        if (this.dom.searchBtn) {
            this.dom.searchBtn.addEventListener('click', (e) => {
                e.preventDefault(); // form submit 방지
                this.searchProduct();
            });
            this.dom.reqPnInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.searchProduct();
                }
            });
        }

        if (this.dom.colorSelect) {
            this.dom.colorSelect.addEventListener('change', () => this.handleColorChange());
            this.dom.sizeSelect.addEventListener('change', () => {
                this.selectedVariantId = this.dom.sizeSelect.value;
            });
        }

        if (this.dom.submitBtn) {
            this.dom.submitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.submitOrder();
            });
        }
        
        // 목록에서 승인/거절 버튼 위임
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-approve')) {
                const id = e.target.dataset.id;
                const reqQty = e.target.dataset.qty;
                const confQty = prompt('확정 수량을 입력하세요:', reqQty);
                if (confQty !== null) this.updateStatus(id, 'APPROVED', confQty);
            }
            if (e.target.classList.contains('btn-reject')) {
                if (confirm('거절하시겠습니까?')) {
                    this.updateStatus(e.target.dataset.id, 'REJECTED', 0);
                }
            }
        });
    }

    async searchProduct() {
        const query = this.dom.reqPnInput.value.trim();
        if (!query) return Flowork.toast('품번을 입력하세요', 'warning');
        
        const url = document.body.dataset.productSearchUrl; // body dataset 사용 (공통)
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken },
                body: JSON.stringify({ query })
            });
            const data = await res.json();
            
            this.dom.searchResults.innerHTML = '';
            this.dom.searchResults.style.display = 'block';
            
            if(data.products && data.products.length > 0) {
                data.products.forEach(p => {
                    const item = document.createElement('button');
                    item.className = 'list-group-item list-group-item-action text-start';
                    item.textContent = `${p.product_name} (${p.product_number})`;
                    item.onclick = (e) => { e.preventDefault(); this.selectProduct(p.product_number); };
                    this.dom.searchResults.appendChild(item);
                });
            } else {
                this.dom.searchResults.innerHTML = '<div class="p-2 text-muted">검색 결과 없음</div>';
            }
        } catch(e) { Flowork.toast('검색 오류', 'danger'); }
    }

    async selectProduct(pn) {
        this.dom.searchResults.style.display = 'none';
        this.dom.reqPnInput.value = pn;
        
        try {
            const detailRes = await fetch('/api/sales/search_products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken },
                body: JSON.stringify({ query: pn, mode: 'detail_stock' })
            });
            const detailData = await detailRes.json();
            
            this.dom.colorSelect.innerHTML = '<option value="">선택</option>';
            this.dom.sizeSelect.innerHTML = '<option value="">선택</option>';
            this.dom.colorSelect.disabled = false;
            this.dom.sizeSelect.disabled = true;
            
            this.variantsCache = detailData.variants || [];
            const colors = [...new Set(this.variantsCache.map(v => v.color))];
            colors.forEach(c => {
                const op = document.createElement('option');
                op.value = c; op.textContent = c;
                this.dom.colorSelect.appendChild(op);
            });
        } catch(e) { Flowork.toast('상품 정보 로드 실패', 'danger'); }
    }

    handleColorChange() {
        const color = this.dom.colorSelect.value;
        this.dom.sizeSelect.innerHTML = '<option value="">선택</option>';
        const sizes = this.variantsCache.filter(v => v.color === color);
        sizes.forEach(v => {
            const op = document.createElement('option');
            op.value = v.variant_id; op.textContent = v.size;
            this.dom.sizeSelect.appendChild(op);
        });
        this.dom.sizeSelect.disabled = false;
    }

    async submitOrder() {
        if (!this.selectedVariantId) { Flowork.toast('상품을 선택하세요.', 'warning'); return; }
        // 모달 내부 qty input 찾기
        const qtyInput = this.modalEl.querySelector('#req-qty');
        const qty = qtyInput.value;
        const url = document.body.dataset.apiCreate; // body dataset 사용

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken },
                body: JSON.stringify({
                    variant_id: this.selectedVariantId,
                    quantity: qty,
                    date: this.dom.dateInput.value
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                Flowork.toast(data.message, 'success');
                setTimeout(() => window.location.reload(), 1000);
            } else {
                Flowork.toast(data.message, 'danger');
            }
        } catch(e) { Flowork.toast('통신 오류', 'danger'); }
    }

    async updateStatus(id, status, qty) {
        const urlPrefix = document.body.dataset.apiStatusPrefix;
        if (!urlPrefix) return;

        try {
            const res = await fetch(urlPrefix + id + '/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken },
                body: JSON.stringify({ status: status, confirmed_quantity: qty })
            });
            const data = await res.json();
            if (data.status === 'success') {
                Flowork.toast(data.message, 'success');
                setTimeout(() => window.location.reload(), 1000);
            } else {
                Flowork.toast(data.message, 'danger');
            }
        } catch(e) { Flowork.toast('통신 오류', 'danger'); }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.store-order-container')) new StoreOrderApp();
});