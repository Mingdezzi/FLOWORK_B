class CheckApp {
    constructor() {
        this.container = document.querySelector('.check-container:not([data-initialized])');
        if (!this.container) return; 
        this.container.dataset.initialized = "true";

        this.dom = {
            barcodeInput: this.container.querySelector('#barcode-input'),
            toggleBtn: this.container.querySelector('#toggle-scan-btn'),
            scanTableBody: this.container.querySelector('#scan-table-body'),
            scanStatusMsg: this.container.querySelector('#scan-status-msg'),
            scanTotalStatus: this.container.querySelector('#scan-total-status'),
            clearBtn: this.container.querySelector('#clear-scan-btn'),
            submitBtn: this.container.querySelector('#submit-scan-btn'),
            targetStoreSelect: this.container.querySelector('#target_store_select'),
            exportBtn: this.container.querySelector('#btn-export-excel'),
            resetHiddenInput: this.container.querySelector('#reset_target_store_id'),
            resetForm: this.container.querySelector('#form-reset-stock')
        };

        // 컨테이너 dataset에서 URL 읽기
        this.urls = {
            fetch: this.container.dataset.apiFetchVariantUrl,
            update: this.container.dataset.bulkUpdateActualStockUrl
        };

        this.state = {
            isScanning: false,
            scanList: {},
            targetStoreId: this.dom.targetStoreSelect ? this.dom.targetStoreSelect.value : null
        };

        this.init();
    }
    // ... (나머지 로직은 이전과 동일하되, Flowork.toast 사용) ...
    init() {
        if (this.dom.targetStoreSelect) {
            this.dom.targetStoreSelect.addEventListener('change', () => {
                this.state.targetStoreId = this.dom.targetStoreSelect.value;
                this.updateUiForStore(this.state.targetStoreId);
                
                if (Object.keys(this.state.scanList).length > 0) {
                    if (confirm('매장이 변경되어 현재 스캔 목록을 초기화합니다.')) {
                        this.clearScanList();
                    }
                }
            });
            this.updateUiForStore(this.state.targetStoreId);
        }

        if (this.dom.toggleBtn) {
            this.dom.toggleBtn.addEventListener('click', () => this.toggleScanning());
        }

        if (this.dom.barcodeInput) {
            this.dom.barcodeInput.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const barcode = this.dom.barcodeInput.value.trim();
                    if (barcode) await this.processBarcode(barcode);
                    this.dom.barcodeInput.value = ''; 
                }
            });
        }

        if (this.dom.clearBtn) {
            this.dom.clearBtn.addEventListener('click', () => {
                if (confirm('스캔 목록을 초기화하시겠습니까?')) this.clearScanList();
            });
        }

        if (this.dom.submitBtn) {
            this.dom.submitBtn.addEventListener('click', () => this.submitScan());
        }

        if (this.dom.resetForm) {
            this.dom.resetForm.addEventListener('submit', (e) => {
                if (this.dom.targetStoreSelect && !this.dom.resetHiddenInput.value) {
                    e.preventDefault();
                    Flowork.toast('초기화할 매장을 선택해주세요.', 'warning');
                }
            });
        }
    }

    updateUiForStore(storeId) {
        if (this.dom.exportBtn) {
            try {
                const url = new URL(this.dom.exportBtn.getAttribute('href'), window.location.origin);
                if (storeId) url.searchParams.set('target_store_id', storeId);
                else url.searchParams.delete('target_store_id');
                this.dom.exportBtn.setAttribute('href', url.pathname + url.search);
            } catch (e) { console.error(e); }
        }
        
        if (this.dom.resetHiddenInput) {
            this.dom.resetHiddenInput.value = storeId || '';
        }
    }

    toggleScanning() {
        if (this.dom.targetStoreSelect && !this.state.targetStoreId) {
            Flowork.toast('작업할 매장을 먼저 선택해주세요.', 'warning');
            this.dom.targetStoreSelect.focus();
            return;
        }

        this.state.isScanning = !this.state.isScanning;
        const btn = this.dom.toggleBtn;
        const input = this.dom.barcodeInput;

        if (this.state.isScanning) {
            btn.classList.replace('btn-success', 'btn-danger');
            btn.innerHTML = '<i class="bi bi-stop-circle me-1"></i>종료';
            input.disabled = false;
            input.focus();
            this.setStatus('스캔 대기 중...', 'text-primary');
        } else {
            btn.classList.replace('btn-danger', 'btn-success');
            btn.innerHTML = '<i class="bi bi-barcode me-1"></i>리딩 시작';
            input.disabled = true;
            input.value = '';
            this.setStatus('대기 중...', 'text-muted');
        }
    }

    async processBarcode(barcode) {
        this.setStatus('조회 중...', 'text-warning');
        
        try {
            const response = await fetch(this.urls.fetch, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': Flowork.getCsrfToken()
                },
                body: JSON.stringify({ 
                    barcode: barcode,
                    target_store_id: this.state.targetStoreId 
                })
            });

            const data = await response.json();

            if (response.ok && data.status === 'success') {
                this.addToList(data);
                this.setStatus(`스캔 완료: ${data.product_name}`, 'text-success');
                if(window.playBeep) window.playBeep('success');
            } else {
                this.setStatus(`오류: ${data.message}`, 'text-danger');
                if(window.playBeep) window.playBeep('error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.setStatus('서버 통신 오류', 'text-danger');
            if(window.playBeep) window.playBeep('error');
        }
    }

    addToList(data) {
        const key = data.barcode; 
        if (this.state.scanList[key]) {
            this.state.scanList[key].scan_quantity += 1;
        } else {
            this.state.scanList[key] = { ...data, scan_quantity: 1 };
        }
        this.renderTable();
    }

    renderTable() {
        this.dom.scanTableBody.innerHTML = '';
        let totalItems = 0;
        let totalQty = 0;

        const items = Object.values(this.state.scanList).reverse(); 

        items.forEach(item => {
            const tr = document.createElement('tr');
            
            const diff = item.scan_quantity - item.store_stock;
            let diffClass = 'text-muted';
            let diffText = '0';
            
            if (diff > 0) { diffClass = 'text-primary fw-bold'; diffText = `+${diff}`; } 
            else if (diff < 0) { diffClass = 'text-danger fw-bold'; diffText = `${diff}`; }

            tr.innerHTML = `
                <td class="text-start ps-3">
                    <div class="fw-bold text-truncate" style="max-width: 140px;">${item.product_name}</div>
                    <div class="small text-muted">${item.product_number}</div>
                </td>
                <td>${item.color}/${item.size}</td>
                <td class="text-muted">${item.store_stock}</td>
                <td>
                    <input type="tel" class="form-control form-control-sm text-center mx-auto" 
                           style="width: 50px;" 
                           data-barcode="${item.barcode}" 
                           value="${item.scan_quantity}" min="0">
                </td>
                <td class="${diffClass}">${diffText}</td>
            `;
            this.dom.scanTableBody.appendChild(tr);

            totalItems += 1;
            totalQty += item.scan_quantity;
        });

        this.dom.scanTotalStatus.textContent = `총 ${totalQty}개 (${totalItems}종)`;
        
        this.dom.scanTableBody.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', (e) => {
                const bc = e.target.dataset.barcode;
                const newQty = parseInt(e.target.value);
                if (this.state.scanList[bc] && newQty >= 0) {
                    this.state.scanList[bc].scan_quantity = newQty;
                    this.renderTable(); 
                }
            });
        });
    }

    clearScanList() {
        this.state.scanList = {};
        this.renderTable();
        this.setStatus('초기화됨', 'text-info');
        this.dom.barcodeInput.focus();
    }

    async submitScan() {
        const items = Object.values(this.state.scanList);
        if (items.length === 0) return Flowork.toast('스캔 내역이 없습니다.', 'warning');
        if (this.dom.targetStoreSelect && !this.state.targetStoreId) return Flowork.toast('매장을 선택하세요.', 'warning');

        if (!confirm(`총 ${items.length}종의 실사 재고를 반영하시겠습니까?`)) return;

        try {
            const payload = {
                items: items.map(item => ({
                    barcode: item.barcode,
                    quantity: item.scan_quantity
                })),
                target_store_id: this.state.targetStoreId 
            };

            const response = await fetch(this.urls.update, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': Flowork.getCsrfToken()
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                Flowork.toast('실사 재고가 반영되었습니다.', 'success');
                this.state.scanList = {};
                this.renderTable();
            } else {
                Flowork.toast(`저장 실패: ${result.message}`, 'danger');
            }

        } catch (error) {
            console.error(error);
            Flowork.toast('서버 통신 오류', 'danger');
        }
    }

    setStatus(msg, cls) {
        this.dom.scanStatusMsg.textContent = msg;
        this.dom.scanStatusMsg.className = cls;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.check-container')) new CheckApp();
});