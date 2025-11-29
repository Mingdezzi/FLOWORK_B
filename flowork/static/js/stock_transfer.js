class StockTransferApp {
    constructor() {
        // 컨테이너 식별 (In 또는 Out)
        this.container = document.querySelector('.transfer-in-container:not([data-initialized]), .transfer-out-container:not([data-initialized])');
        if (!this.container) return;
        this.container.dataset.initialized = "true";

        this.csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
        
        // 모달 찾기 (컨테이너 형제)
        const pageLayer = this.container.closest('.unique-content-area') || document;
        this.modalEl = pageLayer.querySelector('#requestModal');
        this.modal = this.modalEl ? new bootstrap.Modal(this.modalEl) : null;

        this.dom = {
            openBtn: this.container.querySelector('.btn-open-modal'),
            sourceStoreSelect: pageLayer.querySelector('#req-source-store'),
            reqPnInput: pageLayer.querySelector('#req-pn'),
            searchBtn: pageLayer.querySelector('#btn-search-prod'),
            searchResults: pageLayer.querySelector('#search-results'),
            colorSelect: pageLayer.querySelector('#req-color'),
            sizeSelect: pageLayer.querySelector('#req-size'),
            qtyInput: pageLayer.querySelector('#req-qty'),
            submitReqBtn: pageLayer.querySelector('#btn-submit-request')
        };

        this.selectedVariantId = null;
        this.variantsCache = [];

        this.init();
    }

    init() {
        // 리스트 액션 (출고확정/거부/입고확정) - 컨테이너 내 이벤트 위임
        this.container.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-ship')) {
                if (!confirm('출고 확정하시겠습니까? (재고 차감)')) return;
                await this.updateStatus(e.target.dataset.id, 'ship');
            }
            if (e.target.classList.contains('btn-reject')) {
                if (!confirm('요청을 거부하시겠습니까?')) return;
                await this.updateStatus(e.target.dataset.id, 'reject');
            }
            if (e.target.classList.contains('btn-receive')) {
                if (!confirm('물품을 수령하셨습니까? (재고 증가)')) return;
                await this.updateStatus(e.target.dataset.id, 'receive');
            }
        });

        // 요청 모달 로직 (입고 페이지용)
        if (this.dom.openBtn) {
            this.dom.openBtn.addEventListener('click', () => this.modal.show());
        }

        if (this.dom.searchBtn) {
            this.dom.searchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.searchProduct();
            });
        }
        
        if (this.dom.colorSelect) {
            this.dom.colorSelect.addEventListener('change', () => this.handleColorChange());
            this.dom.sizeSelect.addEventListener('change', () => {
                this.selectedVariantId = this.dom.sizeSelect.value;
            });
        }

        if (this.dom.submitReqBtn) {
            this.dom.submitReqBtn.addEventListener('click', () => this.submitRequest());
        }
    }

    async updateStatus(id, action) {
        try {
            const res = await fetch(`/api/stock_transfer/${id}/${action}`, {
                method: 'POST',
                headers: { 'X-CSRFToken': this.csrfToken }
            });
            const data = await res.json();
            if (data.status === 'success') {
                Flowork.toast(data.message, 'success');
                setTimeout(() => window.location.reload(), 1000);
            } else {
                Flowork.toast(data.message, 'danger');
            }
        } catch (err) {
            Flowork.toast('서버 통신 오류', 'danger');
        }
    }

    async searchProduct() {
        const query = this.dom.reqPnInput.value.trim();
        if (!query) return Flowork.toast('품번을 입력하세요', 'warning');
        
        const url = document.body.dataset.productSearchUrl; 
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken },
                body: JSON.stringify({ query })
            });
            const data = await res.json();
            
            this.dom.searchResults.innerHTML = '';
            this.dom.searchResults.style.display = 'block';
            
            if(data.products) {
                data.products.forEach(p => {
                    const item = document.createElement('button');
                    item.className = 'list-group-item list-group-item-action';
                    item.textContent = `${p.product_name} (${p.product_number})`;
                    item.onclick = (e) => { e.preventDefault(); this.selectProduct(p.product_number); };
                    this.dom.searchResults.appendChild(item);
                });
            } else {
                this.dom.searchResults.innerHTML = '<div class="p-2">검색 결과 없음</div>';
            }
        } catch(e) { Flowork.toast('오류 발생', 'danger'); }
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

    async submitRequest() {
        const sourceId = this.dom.sourceStoreSelect.value;
        const qty = this.dom.qtyInput.value;
        
        if(!sourceId || !this.selectedVariantId || !qty) {
            Flowork.toast('모든 항목을 입력하세요.', 'warning'); return;
        }
        
        try {
            const res = await fetch('/api/stock_transfer/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken },
                body: JSON.stringify({
                    source_store_id: sourceId,
                    variant_id: this.selectedVariantId,
                    quantity: qty
                })
            });
            const data = await res.json();
            if(data.status === 'success') {
                Flowork.toast('요청되었습니다.', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } else {
                Flowork.toast(data.message, 'danger');
            }
        } catch(e) { Flowork.toast('오류 발생', 'danger'); }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.transfer-in-container') || document.querySelector('.transfer-out-container')) {
        new StockTransferApp();
    }
});