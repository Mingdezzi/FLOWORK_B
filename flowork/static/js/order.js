class OrderApp {
    constructor() {
        this.dom = {
            receptionToggles: document.getElementById('reception-method-toggles'),
            addressWrapper: document.getElementById('address-fields-wrapper'),
            statusSelect: document.getElementById('order_status'),
            shippingWrapper: document.getElementById('shipping-fields-wrapper'),
            completionWrapper: document.getElementById('completion-date-wrapper'),
            completionInput: document.getElementById('completed_at'),
            btnSearchAddress: document.getElementById('btn-search-address'),
            pnInput: document.getElementById('product_number'),
            pNameInput: document.getElementById('product_name'),
            colorSelect: document.getElementById('color'),
            sizeSelect: document.getElementById('size'),
            statusText: document.getElementById('product-lookup-status'),
            btnSearch: document.getElementById('btn-product-search'),
            resultsDiv: document.getElementById('product-search-results'),
            processingBody: document.getElementById('processing-table-body'),
            btnAddRow: document.getElementById('btn-add-processing-row'),
            rowTemplate: document.getElementById('processing-row-template'),
            btnDeleteOrder: document.getElementById('btn-delete-order'),
            formOrder: document.getElementById('order-form'),
            formDelete: document.getElementById('delete-order-form'),
            btnEnableEdit: document.getElementById('btn-enable-edit')
        };
        
        this.urls = {
            lookup: document.body.dataset.productLookupUrl,
            search: document.body.dataset.productSearchUrl
        };
        
        this.data = {
            color: document.body.dataset.currentColor,
            size: document.body.dataset.currentSize
        };

        this.init();
    }

    init() {
        if(this.dom.receptionToggles) this.dom.receptionToggles.addEventListener('change', () => this.toggleAddressFields());
        if(this.dom.statusSelect) this.dom.statusSelect.addEventListener('change', () => this.toggleStatusFields());
        
        if(this.dom.btnSearchAddress) {
            this.dom.btnSearchAddress.addEventListener('click', () => {
                new daum.Postcode({
                    oncomplete: (data) => {
                        document.getElementById('postcode').value = data.zonecode;
                        document.getElementById('address1').value = data.roadAddress || data.jibunAddress;
                        document.getElementById('address2').focus();
                    }
                }).open();
            });
        }

        if(this.dom.btnSearch) this.dom.btnSearch.addEventListener('click', () => this.searchProduct());
        if(this.dom.resultsDiv) {
            this.dom.resultsDiv.addEventListener('click', (e) => {
                const target = e.target.closest('.list-group-item-action');
                if(target) {
                    e.preventDefault();
                    this.selectProduct(target.dataset.pn);
                }
            });
        }
        
        if(this.dom.pnInput) {
            this.dom.pnInput.addEventListener('keydown', (e) => {
                if(e.key === 'Enter') { e.preventDefault(); this.dom.btnSearch.click(); }
            });
            if(this.dom.pnInput.value) this.fetchProductOptions(this.dom.pnInput.value);
        }

        document.addEventListener('click', (e) => {
            if(!this.dom.pnInput || !document.body.contains(this.dom.pnInput)) return;
            const container = this.dom.pnInput.closest('.position-relative');
            if(container && !container.contains(e.target)) this.dom.resultsDiv.style.display = 'none';
        });

        if(this.dom.btnAddRow) this.dom.btnAddRow.addEventListener('click', () => this.addProcessingRow());
        if(this.dom.processingBody) {
            this.dom.processingBody.addEventListener('click', (e) => {
                if(e.target.closest('.btn-delete-row')) this.deleteProcessingRow(e.target);
            });
        }

        if(this.dom.btnDeleteOrder) {
            this.dom.btnDeleteOrder.addEventListener('click', () => {
                if(confirm('🚨 이 주문 내역을 삭제하시겠습니까?')) this.dom.formDelete.submit();
            });
        }

        if(this.dom.formOrder) {
            this.dom.formOrder.addEventListener('submit', (e) => this.validateForm(e));
        }

        if(this.dom.btnEnableEdit) {
            this.dom.btnEnableEdit.addEventListener('click', (e) => {
                e.preventDefault();
                document.body.dataset.pageMode = 'edit';
                document.querySelectorAll('.editable-on-demand').forEach(el => {
                    el.disabled = false; el.readOnly = false;
                });
                document.getElementById('created_at').focus();
            });
        }

        this.toggleAddressFields();
        this.toggleStatusFields();
    }

    toggleAddressFields() {
        if(!this.dom.receptionToggles) return;
        const selected = this.dom.receptionToggles.querySelector('input:checked');
        const isDelivery = selected && selected.value === '택배수령';
        
        this.dom.addressWrapper.style.display = isDelivery ? 'block' : 'none';
        document.getElementById('address1').required = isDelivery;
        document.getElementById('address2').required = isDelivery;
    }

    toggleStatusFields() {
        if(!this.dom.statusSelect) return;
        const status = this.dom.statusSelect.value;
        
        this.dom.shippingWrapper.style.display = (status === '택배 발송') ? 'block' : 'none';
        this.dom.completionWrapper.style.display = (status === '완료') ? 'block' : 'none';
        
        if(status === '완료' && !this.dom.completionInput.value) {
            this.dom.completionInput.value = Flowork.fmtDate(new Date());
        }
    }

    async searchProduct() {
        const query = this.dom.pnInput.value.trim();
        if(!query) {
            Flowork.toast('검색어를 입력하세요.', 'warning');
            this.dom.resultsDiv.style.display = 'none';
            return;
        }

        this.dom.resultsDiv.innerHTML = '<div class="list-group-item text-muted">검색 중...</div>';
        this.dom.resultsDiv.style.display = 'block';

        try {
            const data = await Flowork.post(this.urls.search, { query });
            this.dom.resultsDiv.innerHTML = '';
            
            if(data.status === 'success') {
                if(data.products.length === 0) {
                    this.dom.resultsDiv.innerHTML = '<div class="list-group-item text-muted">검색 결과 없음</div>';
                    return;
                }
                data.products.forEach(p => {
                    const html = `<button type="button" class="list-group-item list-group-item-action text-start p-2" data-pn="${p.product_number}">
                        <div class="fw-bold small">${p.product_name}</div>
                        <div class="text-muted" style="font-size:0.75rem;">${p.product_number}</div>
                    </button>`;
                    this.dom.resultsDiv.insertAdjacentHTML('beforeend', html);
                });
            } else {
                Flowork.toast(data.message, 'danger');
                this.dom.resultsDiv.style.display = 'none';
            }
        } catch(e) {
            Flowork.toast('검색 오류 발생', 'danger');
            this.dom.resultsDiv.style.display = 'none';
        }
    }

    selectProduct(pn) {
        this.dom.pnInput.value = pn;
        this.dom.resultsDiv.style.display = 'none';
        this.fetchProductOptions(pn);
    }

    async fetchProductOptions(pn) {
        if(!pn) return;
        
        try {
            const data = await Flowork.post(this.urls.lookup, { product_number: pn });
            if(data.status === 'success') {
                this.dom.pNameInput.value = data.product_name;
                this.dom.pnInput.value = data.product_number;
                
                this.populateSelect(this.dom.colorSelect, data.colors, this.data.color);
                this.populateSelect(this.dom.sizeSelect, data.sizes, this.data.size);
            } else {
                Flowork.toast(data.message, 'warning');
            }
        } catch(e) { Flowork.toast('상품 조회 오류', 'danger'); }
    }

    populateSelect(select, items, currentVal) {
        select.innerHTML = `<option value="">선택</option>`;
        items.forEach(i => {
            const selected = (i === currentVal) ? 'selected' : '';
            select.insertAdjacentHTML('beforeend', `<option value="${i}" ${selected}>${i}</option>`);
        });
    }

    addProcessingRow() {
        const clone = this.dom.rowTemplate.content.cloneNode(true);
        this.dom.processingBody.appendChild(clone);
    }

    deleteProcessingRow(btn) {
        if(this.dom.processingBody.querySelectorAll('tr').length > 1) {
            btn.closest('tr').remove();
        } else {
            Flowork.toast('최소 1개의 처리 내역이 필요합니다.', 'warning');
        }
    }

    validateForm(e) {
        const selected = this.dom.receptionToggles.querySelector('input:checked');
        if(selected && selected.value === '택배수령') {
            if(!document.getElementById('address1').value) {
                e.preventDefault(); 
                Flowork.toast('주소를 입력해주세요.', 'warning');
                return;
            }
        }
        const selects = this.dom.processingBody.querySelectorAll('select[name="processing_source"]');
        for(let s of selects) {
            if(!s.value) {
                e.preventDefault(); 
                Flowork.toast('주문처를 선택해주세요.', 'warning');
                s.focus(); 
                return;
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('order-form')) new OrderApp();
});