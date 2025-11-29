document.addEventListener('DOMContentLoaded', () => {
    let csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (!csrfToken) {
        const input = document.querySelector('input[name="csrf_token"]');
        if (input) csrfToken = input.value;
    }

    const brandSelect = document.getElementById('brand_id');
    const storeSelect = document.getElementById('store_id');
    const apiBaseUrl = document.body.dataset.apiGetStoresUrl;
    
    if (!brandSelect || !storeSelect || !apiBaseUrl) return;

    brandSelect.addEventListener('change', async () => {
        const brandId = brandSelect.value;
        
        if (!brandId) {
            storeSelect.innerHTML = '<option value="">-- 브랜드를 먼저 선택하세요 --</option>';
            storeSelect.disabled = true;
            return;
        }

        storeSelect.innerHTML = '<option value="">목록 로드 중...</option>';
        storeSelect.disabled = true;

        const fetchUrl = apiBaseUrl.replace('/0/', `/${brandId}/`);

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (csrfToken) headers['X-CSRFToken'] = csrfToken;

            const response = await fetch(fetchUrl, { method: 'GET', headers: headers });
            const data = await response.json();

            if (!response.ok || data.status === 'error') {
                throw new Error(data.message || '매장 목록 로드 실패');
            }

            storeSelect.innerHTML = ''; 
            if (data.stores.length === 0) {
                storeSelect.innerHTML = '<option value="">-- 가입 가능한 매장이 없습니다 --</option>';
            } else {
                storeSelect.innerHTML = '<option value="">-- 매장을 선택하세요 --</option>';
                data.stores.forEach(store => {
                    const option = document.createElement('option');
                    option.value = store.id;
                    option.textContent = `${store.name} (코드: ${store.code || '-'})`;
                    storeSelect.appendChild(option);
                });
                storeSelect.disabled = false;
            }

        } catch (error) {
            console.error(error);
            storeSelect.innerHTML = `<option value="">오류: ${error.message}</option>`;
            storeSelect.disabled = true;
        }
    });
});