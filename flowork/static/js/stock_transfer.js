document.addEventListener('DOMContentLoaded', () => {
    
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    if (!window.HAS_TRANSFER_LISTENERS) {
        window.HAS_TRANSFER_LISTENERS = true;
        
        document.body.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-ship')) {
                if (!confirm('출고 확정하시겠습니까? (재고 차감)')) return;
                await updateStatus(e.target.dataset.id, 'ship');
            }
            if (e.target.classList.contains('btn-reject')) {
                if (!confirm('거부하시겠습니까?')) return;
                await updateStatus(e.target.dataset.id, 'reject');
            }
            if (e.target.classList.contains('btn-receive')) {
                if (!confirm('입고 확정하시겠습니까? (재고 증가)')) return;
                await updateStatus(e.target.dataset.id, 'receive');
            }
        });
    }

    async function updateStatus(id, action) {
        try {
            const res = await fetch(`/api/stock_transfer/${id}/${action}`, {
                method: 'POST',
                headers: { 'X-CSRFToken': csrfToken }
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

    const reqPnInput = document.getElementById('req-pn');
    const searchBtn = document.getElementById('btn-search-prod');
    const searchResults = document.getElementById('search-results');
    const colorSelect = document.getElementById('req-color');
    const sizeSelect = document.getElementById('req-size');
    const submitReqBtn = document.getElementById('btn-submit-request');
    
    let selectedVariantId = null;
    let variantsCache = [];

    if (searchBtn) {
        searchBtn.onclick = async () => { 
            const query = reqPnInput.value.trim();
            if (!query) return;
            
            const url = document.body.dataset.productSearchUrl;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                body: JSON.stringify({ query })
            });
            const data = await res.json();
            
            searchResults.innerHTML = '';
            searchResults.style.display = 'block';
            
            if(data.products) {
                data.products.forEach(p => {
                    const item = document.createElement('button');
                    item.className = 'list-group-item list-group-item-action';
                    item.textContent = `${p.product_name} (${p.product_number})`;
                    item.onclick = (e) => { e.preventDefault(); selectProduct(p.product_number); };
                    searchResults.appendChild(item);
                });
            } else {
                searchResults.innerHTML = '<div class="p-2">검색 결과 없음</div>';
            }
        };
    }

    async function selectProduct(pn) {
        searchResults.style.display = 'none';
        reqPnInput.value = pn;
        
        const detailRes = await fetch('/api/sales/search_products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            body: JSON.stringify({ query: pn, mode: 'detail_stock' })
        });
        const detailData = await detailRes.json();
        
        colorSelect.innerHTML = '<option value="">선택</option>';
        sizeSelect.innerHTML = '<option value="">선택</option>';
        colorSelect.disabled = false;
        sizeSelect.disabled = true;
        
        variantsCache = detailData.variants || [];
        const colors = [...new Set(variantsCache.map(v => v.color))];
        
        colors.forEach(c => {
            const op = document.createElement('option');
            op.value = c;
            op.textContent = c;
            colorSelect.appendChild(op);
        });
    }
    
    if(colorSelect) {
        colorSelect.onchange = () => {
            const color = colorSelect.value;
            sizeSelect.innerHTML = '<option value="">선택</option>';
            
            const sizes = variantsCache.filter(v => v.color === color);
            sizes.forEach(v => {
                const op = document.createElement('option');
                op.value = v.variant_id;
                op.textContent = v.size;
                sizeSelect.appendChild(op);
            });
            sizeSelect.disabled = false;
        };
        
        sizeSelect.onchange = () => {
            selectedVariantId = sizeSelect.value;
        };
    }

    if(submitReqBtn) {
        submitReqBtn.onclick = async () => {
            const sourceId = document.getElementById('req-source-store').value;
            const qty = document.getElementById('req-qty').value;
            
            if(!sourceId || !selectedVariantId || !qty) {
                Flowork.toast('모든 항목을 입력하세요.', 'warning'); return;
            }
            
            try {
                const res = await fetch('/api/stock_transfer/request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                    body: JSON.stringify({
                        source_store_id: sourceId,
                        variant_id: selectedVariantId,
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
        };
    }
});