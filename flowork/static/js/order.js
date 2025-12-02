if (!window.OrderApp) {
    window.OrderApp = class OrderApp {
        constructor() {
            this.container = document.querySelector('.order-detail-container:not([data-initialized])');
            if (!this.container) return;
            this.container.dataset.initialized = "true";

            this.dom = {
                receptionToggles: this.container.querySelector('#reception-method-toggles'),
                addressWrapper: this.container.querySelector('#address-fields-wrapper'),
                statusSelect: this.container.querySelector('#order_status'),
                shippingWrapper: this.container.querySelector('#shipping-fields-wrapper'),
                completionWrapper: this.container.querySelector('#completion-date-wrapper'),
                completionInput: this.container.querySelector('#completed_at'),
                btnSearchAddress: this.container.querySelector('#btn-search-address'),
                pnInput: this.container.querySelector('#product_number'),
                pNameInput: this.container.querySelector('#product_name'),
                colorSelect: this.container.querySelector('#color'),
                sizeSelect: this.container.querySelector('#size'),
                btnSearch: this.container.querySelector('#btn-product-search'),
                resultsDiv: this.container.querySelector('#product-search-results'),
                processingBody: this.container.querySelector('#processing-table-body'),
                btnAddRow: this.container.querySelector('#btn-add-processing-row'),
                rowTemplate: document.getElementById('processing-row-template'),
                btnDeleteOrder: this.container.querySelector('#btn-delete-order'),
                formOrder: this.container.querySelector('#order-form'),
                formDelete: this.container.querySelector('#delete-order-form'),
                btnEnableEdit: this.container.querySelector('#btn-enable-edit'),
                postcodeInput: this.container.querySelector('#postcode'),
                address1Input: this.container.querySelector('#address1'),
                address2Input: this.container.querySelector('#address2')
            };
            
            this.urls = {
                lookup: this.container.dataset.productLookupUrl,
                search: this.container.dataset.productSearchUrl
            };
            
            this.data = {
                color: this.container.dataset.currentColor,
                size: this.container.dataset.currentSize
            };

            this.globalClickHandler = this.handleGlobalClick.bind(this);

            this.init();
        }

        init() {
            if(this.dom.receptionToggles) this.dom.receptionToggles.addEventListener('change', () => this.toggleAddressFields());
            if(this.dom.statusSelect) this.dom.statusSelect.addEventListener('change', () => this.toggleStatusFields());
            
            if(this.dom.btnSearchAddress) {
                this.dom.btnSearchAddress.addEventListener('click', () => {
                    if (typeof daum === 'undefined' || !daum.Postcode) {
                        window.Flowork.toast('주소 검색 서비스를 로드 중입니다. 잠시 후 시도해주세요.', 'warning');
                        return;
                    }
                    new daum.Postcode({
                        oncomplete: (data) => {
                            this.dom.postcodeInput.value = data.zonecode;
                            this.dom.address1Input.value = data.roadAddress || data.jibunAddress;
                            this.dom.address2Input.focus();
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

            document.addEventListener('click', this.globalClickHandler);

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
                    this.container.querySelectorAll('.editable-on-demand').forEach(el => {
                        el.disabled = false; el.readOnly = false;
                    });
                    const createdAt = this.container.querySelector('#created_at');
                    if(createdAt) createdAt.focus();
                    
                    this.dom.btnEnableEdit.style.display = 'none';
                    const submitBtn = this.container.querySelector('#btn-submit-order');
                    if(submitBtn) submitBtn.style.display = 'inline-block';
                });
            }

            this.toggleAddressFields();
            this.toggleStatusFields();
        }

        handleGlobalClick(e) {
            if (!document.body.contains(this.container)) {
                document.removeEventListener('click', this.globalClickHandler);
                return;
            }

            if (!this.container.contains(e.target)) {
                 if (this.dom.resultsDiv) this.dom.resultsDiv.style.display = 'none';
            } else {
                 if (this.dom.pnInput && !this.dom.pnInput.closest('.position-relative').contains(e.target)) {
                     if (this.dom.resultsDiv) this.dom.resultsDiv.style.display = 'none';
                 }
            }
        }

        toggleAddressFields() {
            if(!this.dom.receptionToggles) return;
            const selected = this.dom.receptionToggles.querySelector('input:checked');
            const isDelivery = selected && selected.value === '택배수령';
            
            if(this.dom.addressWrapper) {
                 this.dom.addressWrapper.style.display = isDelivery ? 'block' : 'none';
                 const addr1 = this.dom.addressWrapper.querySelector('#address1');
                 const addr2 = this.dom.addressWrapper.querySelector('#address2');
                 if(addr1) addr1.required = isDelivery;
                 if(addr2) addr2.required = isDelivery;
            }
        }

        toggleStatusFields() {
            if(!this.dom.statusSelect) return;
            const status = this.dom.statusSelect.value;
            
            if(this.dom.shippingWrapper) this.dom.shippingWrapper.style.display = (status === '택배 발송') ? 'block' : 'none';
            if(this.dom.completionWrapper) this.dom.completionWrapper.style.display = (status === '완료') ? 'block' : 'none';
            
            if(status === '완료' && this.dom.completionInput && !this.dom.completionInput.value) {
                this.dom.completionInput.value = window.Flowork.fmtDate(new Date());
            }
        }

        async searchProduct() {
            const query = this.dom.pnInput.value.trim();
            if(!query) {
                window.Flowork.toast('검색어를 입력하세요.', 'warning');
                if(this.dom.resultsDiv) this.dom.resultsDiv.style.display = 'none';
                return;
            }

            this.dom.resultsDiv.innerHTML = '<div class="list-group-item text-muted">검색 중...</div>';
            this.dom.resultsDiv.style.display = 'block';

            try {
                const data = await window.Flowork.post(this.urls.search, { query });
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
                    window.Flowork.toast(data.message, 'danger');
                    this.dom.resultsDiv.style.display = 'none';
                }
            } catch(e) {
                window.Flowork.toast('검색 오류 발생', 'danger');
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
                const data = await window.Flowork.post(this.urls.lookup, { product_number: pn });
                if(data.status === 'success') {
                    if(this.dom.pNameInput) this.dom.pNameInput.value = data.product_name;
                    this.dom.pnInput.value = data.product_number;
                    
                    this.populateSelect(this.dom.colorSelect, data.colors, this.data.color);
                    this.populateSelect(this.dom.sizeSelect, data.sizes, this.data.size);
                } else {
                    window.Flowork.toast(data.message, 'warning');
                }
            } catch(e) { window.Flowork.toast('상품 조회 오류', 'danger'); }
        }

        populateSelect(select, items, currentVal) {
            if(!select) return;
            select.innerHTML = `<option value="">선택</option>`;
            items.forEach(i => {
                const selected = (i === currentVal) ? 'selected' : '';
                select.insertAdjacentHTML('beforeend', `<option value="${i}" ${selected}>${i}</option>`);
            });
        }

        addProcessingRow() {
            if(!this.dom.rowTemplate) return;
            const clone = this.dom.rowTemplate.content.cloneNode(true);
            this.dom.processingBody.appendChild(clone);
        }

        deleteProcessingRow(btn) {
            if(this.dom.processingBody.querySelectorAll('tr').length > 1) {
                btn.closest('tr').remove();
            } else {
                window.Flowork.toast('최소 1개의 처리 내역이 필요합니다.', 'warning');
            }
        }

        validateForm(e) {
            const selected = this.dom.receptionToggles.querySelector('input:checked');
            if(selected && selected.value === '택배수령') {
                if(!this.dom.address1Input.value) {
                    e.preventDefault(); 
                    window.Flowork.toast('주소를 입력해주세요.', 'warning');
                    return;
                }
            }
            const selects = this.dom.processingBody.querySelectorAll('select[name="processing_source"]');
            for(let s of selects) {
                if(!s.value) {
                    e.preventDefault(); 
                    window.Flowork.toast('주문처를 선택해주세요.', 'warning');
                    s.focus(); 
                    return;
                }
            }
        }
    };
}

if (document.querySelector('.order-detail-container')) {
    new window.OrderApp();
}