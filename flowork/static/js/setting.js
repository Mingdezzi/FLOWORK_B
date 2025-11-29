class SettingApp {
    constructor() {
        const ds = document.body.dataset;
        this.urls = {
            setBrand: ds.apiBrandNameSetUrl,
            addStore: ds.apiStoresAddUrl,
            updateStore: ds.apiStoreUpdateUrlPrefix,
            delStore: ds.apiStoreDeleteUrlPrefix,
            approveStore: ds.apiStoreApproveUrlPrefix,
            toggleActive: ds.apiStoreToggleActiveUrlPrefix,
            resetStore: ds.apiStoreResetUrlPrefix,
            addStaff: ds.apiStaffAddUrl,
            updateStaff: ds.apiStaffUpdateUrlPrefix,
            delStaff: ds.apiStaffDeleteUrlPrefix,
            loadSettings: ds.apiLoadSettingsUrl,
            updateSetting: ds.apiSettingUrl
        };

        this.dom = this.cacheDom();
        this.init();
    }

    cacheDom() {
        return {
            formBrand: document.getElementById('form-brand-name'),
            btnLoadSettings: document.getElementById('btn-load-settings'),
            formAddStore: document.getElementById('form-add-store'),
            tableStores: document.getElementById('all-stores-table'),
            formAddStaff: document.getElementById('form-add-staff'),
            tableStaff: document.getElementById('all-staff-table'),
            formCat: document.getElementById('form-category-config'),
            catContainer: document.getElementById('cat-buttons-container'),
            btnCatAdd: document.getElementById('btn-add-cat-row'),
            modalStore: new bootstrap.Modal(document.getElementById('edit-store-modal') || document.createElement('div')),
            modalStaff: new bootstrap.Modal(document.getElementById('edit-staff-modal') || document.createElement('div'))
        };
    }

    init() {
        if(this.dom.formBrand) this.dom.formBrand.addEventListener('submit', (e) => this.setBrandName(e));
        if(this.dom.btnLoadSettings) this.dom.btnLoadSettings.addEventListener('click', () => this.loadSettings());
        if(this.dom.formAddStore) this.dom.formAddStore.addEventListener('submit', (e) => this.addStore(e));
        
        if(this.dom.tableStores) {
            this.dom.tableStores.addEventListener('click', (e) => {
                const btn = e.target.closest('a, button');
                if(!btn) return;
                if(btn.classList.contains('btn-delete-store')) { e.preventDefault(); this.deleteStore(btn); }
                if(btn.classList.contains('btn-edit-store')) { e.preventDefault(); this.openStoreModal(btn); }
                if(btn.classList.contains('btn-approve-store')) this.approveStore(btn);
                if(btn.classList.contains('btn-reset-store')) { e.preventDefault(); this.resetStore(btn); }
                if(btn.classList.contains('btn-toggle-active-store')) this.toggleStoreActive(btn);
            });
        }

        if(this.dom.formAddStaff) this.dom.formAddStaff.addEventListener('submit', (e) => this.addStaff(e));
        
        if(this.dom.tableStaff) {
            this.dom.tableStaff.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if(!btn) return;
                if(btn.classList.contains('btn-delete-staff')) this.deleteStaff(btn);
                if(btn.classList.contains('btn-edit-staff')) this.openStaffModal(btn);
            });
        }

        this.initCategoryForm();
        
        const btnSaveStore = document.getElementById('btn-save-edit-store');
        if(btnSaveStore) btnSaveStore.addEventListener('click', () => this.saveStoreEdit(btnSaveStore));
        
        const btnSaveStaff = document.getElementById('btn-save-edit-staff');
        if(btnSaveStaff) btnSaveStaff.addEventListener('click', () => this.saveStaffEdit(btnSaveStaff));
    }

    async setBrandName(e) {
        e.preventDefault();
        const name = document.getElementById('brand-name-input').value.trim();
        if(!name) return Flowork.toast('이름을 입력하세요', 'warning');
        
        try {
            const res = await Flowork.post(this.urls.setBrand, { brand_name: name });
            Flowork.toast(res.message, 'success');
        } catch(e) { Flowork.toast('저장 실패', 'danger'); }
    }

    async loadSettings() {
        if(!confirm('설정 파일을 로드하시겠습니까?')) return;
        this.dom.btnLoadSettings.disabled = true;
        try {
            const res = await Flowork.post(this.urls.loadSettings, {});
            Flowork.toast(res.message, 'success');
        } catch(e) {
            Flowork.toast(e.message, 'danger');
        } finally {
            this.dom.btnLoadSettings.disabled = false;
        }
    }

    async addStore(e) {
        e.preventDefault();
        const payload = {
            store_code: document.getElementById('new_store_code').value,
            store_name: document.getElementById('new_store_name').value,
            store_phone: document.getElementById('new_store_phone').value
        };
        try {
            const res = await Flowork.post(this.urls.addStore, payload);
            Flowork.toast(res.message, 'success');
            setTimeout(() => window.location.reload(), 1000);
        } catch(e) { Flowork.toast(e.message, 'danger'); }
    }

    async deleteStore(btn) {
        if(!confirm('삭제하시겠습니까?')) return;
        try {
            await Flowork.api(`${this.urls.delStore}${btn.dataset.id}`, { method: 'DELETE' });
            Flowork.toast('삭제되었습니다', 'success');
            btn.closest('tr').remove();
        } catch(e) { Flowork.toast(e.message, 'danger'); }
    }

    openStoreModal(btn) {
        document.getElementById('edit_store_code').value = btn.dataset.code;
        document.getElementById('edit_store_name').value = btn.dataset.name;
        document.getElementById('edit_store_phone').value = btn.dataset.phone;
        document.getElementById('btn-save-edit-store').dataset.storeId = btn.dataset.id;
        this.dom.modalStore.show();
    }

    async saveStoreEdit(btn) {
        const id = btn.dataset.storeId;
        const payload = {
            store_code: document.getElementById('edit_store_code').value,
            store_name: document.getElementById('edit_store_name').value,
            store_phone: document.getElementById('edit_store_phone').value
        };
        try {
            await Flowork.post(`${this.urls.updateStore}${id}`, payload);
            Flowork.toast('수정되었습니다', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } catch(e) { Flowork.toast(e.message, 'danger'); }
    }

    async approveStore(btn) {
        if(!confirm('승인하시겠습니까?')) return;
        try { 
            await Flowork.post(`${this.urls.approveStore}${btn.dataset.id}`, {}); 
            Flowork.toast('승인되었습니다', 'success');
            setTimeout(() => window.location.reload(), 1000); 
        } catch(e) { Flowork.toast(e.message, 'danger'); }
    }

    async resetStore(btn) {
        if(!confirm('가입 정보를 초기화하시겠습니까?')) return;
        try { 
            await Flowork.post(`${this.urls.resetStore}${btn.dataset.id}`, {}); 
            Flowork.toast('초기화되었습니다', 'success');
            setTimeout(() => window.location.reload(), 1000); 
        } catch(e) { Flowork.toast(e.message, 'danger'); }
    }

    async toggleStoreActive(btn) {
        try { 
            const res = await Flowork.post(`${this.urls.toggleActive}${btn.dataset.id}`, {}); 
            Flowork.toast(res.message, 'success');
            setTimeout(() => window.location.reload(), 1000); 
        } catch(e) { Flowork.toast(e.message, 'danger'); }
    }

    async addStaff(e) {
        e.preventDefault();
        const payload = {
            name: document.getElementById('new_staff_name').value,
            position: document.getElementById('new_staff_position').value,
            contact: document.getElementById('new_staff_contact').value
        };
        try {
            await Flowork.post(this.urls.addStaff, payload);
            Flowork.toast('직원이 추가되었습니다', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } catch(e) { Flowork.toast(e.message, 'danger'); }
    }

    async deleteStaff(btn) {
        if(!confirm('삭제하시겠습니까?')) return;
        try {
            await Flowork.api(`${this.urls.delStaff}${btn.dataset.id}`, { method: 'DELETE' });
            Flowork.toast('삭제되었습니다', 'success');
            btn.closest('tr').remove();
        } catch(e) { Flowork.toast(e.message, 'danger'); }
    }

    openStaffModal(btn) {
        document.getElementById('edit_staff_name').value = btn.dataset.name;
        document.getElementById('edit_staff_position').value = btn.dataset.position;
        document.getElementById('edit_staff_contact').value = btn.dataset.contact;
        document.getElementById('btn-save-edit-staff').dataset.staffId = btn.dataset.id;
        this.dom.modalStaff.show();
    }

    async saveStaffEdit(btn) {
        const id = btn.dataset.staffId;
        const payload = {
            name: document.getElementById('edit_staff_name').value,
            position: document.getElementById('edit_staff_position').value,
            contact: document.getElementById('edit_staff_contact').value
        };
        try {
            await Flowork.post(`${this.urls.updateStaff}${id}`, payload);
            Flowork.toast('수정되었습니다', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } catch(e) { Flowork.toast(e.message, 'danger'); }
    }

    initCategoryForm() {
        if(!this.dom.formCat) return;
        
        const saved = window.initialCategoryConfig;
        const addRow = (l='', v='') => {
            const html = `
                <div class="input-group input-group-sm mb-1 cat-row">
                    <input type="text" class="form-control cat-label" value="${l}" placeholder="라벨">
                    <input type="text" class="form-control cat-value" value="${v}" placeholder="값(카테고리명)">
                    <button type="button" class="btn btn-outline-danger btn-remove-cat"><i class="bi bi-x"></i></button>
                </div>`;
            this.dom.catContainer.insertAdjacentHTML('beforeend', html);
        };

        if(saved) {
            if(saved.columns) document.getElementById('cat-columns').value = saved.columns;
            if(saved.buttons) {
                this.dom.catContainer.innerHTML = '';
                saved.buttons.forEach(b => addRow(b.label, b.value));
            }
        } else {
            if(this.dom.catContainer.children.length === 0) {
                ['전체','신발','의류','용품'].forEach(t => addRow(t, t));
            }
        }

        this.dom.btnCatAdd.onclick = () => addRow();
        this.dom.catContainer.onclick = (e) => {
            if(e.target.closest('.btn-remove-cat')) e.target.closest('.cat-row').remove();
        };

        this.dom.formCat.onsubmit = async (e) => {
            e.preventDefault();
            const buttons = [];
            this.dom.catContainer.querySelectorAll('.cat-row').forEach(r => {
                const l = r.querySelector('.cat-label').value.trim();
                const v = r.querySelector('.cat-value').value.trim();
                if(l && v) buttons.push({label: l, value: v});
            });
            
            const config = {
                columns: parseInt(document.getElementById('cat-columns').value),
                buttons: buttons
            };
            
            try {
                await Flowork.post(this.urls.updateSetting, { key: 'CATEGORY_CONFIG', value: config });
                Flowork.toast('설정이 저장되었습니다', 'success');
            } catch(e) {
                Flowork.toast(e.message, 'danger');
            }
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('form-brand-name')) new SettingApp();
});