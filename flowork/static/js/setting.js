// [수정] 클래스 재선언 방지를 위해 window 객체에 할당
if (!window.SettingApp) {
    window.SettingApp = class SettingApp {
        constructor() {
            this.container = document.querySelector('.setting-container:not([data-initialized])');
            if (!this.container) return;
            this.container.dataset.initialized = "true";

            const ds = this.container.dataset;
            
            // URL 로드 및 검증
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
            const c = this.container;
            const parent = c.closest('.page-content-layer') || document;

            return {
                formBrand: c.querySelector('#form-brand-name'),
                btnLoadSettings: c.querySelector('#btn-load-settings'),
                formAddStore: c.querySelector('#form-add-store'),
                tableStores: c.querySelector('#all-stores-table'),
                formAddStaff: c.querySelector('#form-add-staff'),
                tableStaff: c.querySelector('#all-staff-table'),
                formCat: c.querySelector('#form-category-config'),
                catContainer: c.querySelector('#cat-buttons-container'),
                btnCatAdd: c.querySelector('#btn-add-cat-row'),
                
                // 모달은 이미 존재할 수 있으므로 안전하게 선택
                modalStore: parent.querySelector('#edit-store-modal') ? new bootstrap.Modal(parent.querySelector('#edit-store-modal')) : null,
                modalStaff: parent.querySelector('#edit-staff-modal') ? new bootstrap.Modal(parent.querySelector('#edit-staff-modal')) : null,

                editStoreInputs: {
                    code: parent.querySelector('#edit_store_code'),
                    name: parent.querySelector('#edit_store_name'),
                    phone: parent.querySelector('#edit_store_phone'),
                    btnSave: parent.querySelector('#btn-save-edit-store')
                },
                editStaffInputs: {
                    name: parent.querySelector('#edit_staff_name'),
                    pos: parent.querySelector('#edit_staff_position'),
                    contact: parent.querySelector('#edit_staff_contact'),
                    btnSave: parent.querySelector('#btn-save-edit-staff')
                },
                newStoreInputs: {
                    code: c.querySelector('#new_store_code'),
                    name: c.querySelector('#new_store_name'),
                    phone: c.querySelector('#new_store_phone')
                },
                newStaffInputs: {
                    name: c.querySelector('#new_staff_name'),
                    pos: c.querySelector('#new_staff_position'),
                    contact: c.querySelector('#new_staff_contact')
                },
                brandNameInput: c.querySelector('#brand-name-input'),
                catColumnsInput: c.querySelector('#cat-columns')
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
                    
                    // 이벤트 위임 처리
                    if(btn.classList.contains('btn-delete-store')) { e.preventDefault(); this.deleteStore(btn); }
                    else if(btn.classList.contains('btn-edit-store')) { e.preventDefault(); this.openStoreModal(btn); }
                    else if(btn.classList.contains('btn-approve-store')) { e.preventDefault(); this.approveStore(btn); }
                    else if(btn.classList.contains('btn-reset-store')) { e.preventDefault(); this.resetStore(btn); }
                    else if(btn.classList.contains('btn-toggle-active-store')) { e.preventDefault(); this.toggleStoreActive(btn); }
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
            
            if(this.dom.editStoreInputs.btnSave) {
                // 이벤트 중복 방지를 위해 기존 리스너 제거가 어렵다면 cloneNode 사용 고려 (여기선 생략)
                this.dom.editStoreInputs.btnSave.onclick = () => this.saveStoreEdit(this.dom.editStoreInputs.btnSave);
            }
            if(this.dom.editStaffInputs.btnSave) {
                this.dom.editStaffInputs.btnSave.onclick = () => this.saveStaffEdit(this.dom.editStaffInputs.btnSave);
            }
        }

        // ... (API 호출 메서드들은 기존 로직과 동일하므로 유지) ...
        async setBrandName(e) {
            e.preventDefault();
            const name = this.dom.brandNameInput.value.trim();
            if(!name) return window.Flowork.toast('이름을 입력하세요', 'warning');
            
            try {
                const res = await window.Flowork.post(this.urls.setBrand, { brand_name: name });
                window.Flowork.toast(res.message, 'success');
            } catch(e) { window.Flowork.toast('저장 실패', 'danger'); }
        }

        async loadSettings() {
            if(!confirm('설정 파일을 로드하시겠습니까?')) return;
            this.dom.btnLoadSettings.disabled = true;
            try {
                const res = await window.Flowork.post(this.urls.loadSettings, {});
                window.Flowork.toast(res.message, 'success');
                setTimeout(() => window.location.reload(), 1500);
            } catch(e) {
                window.Flowork.toast(e.message, 'danger');
            } finally {
                this.dom.btnLoadSettings.disabled = false;
            }
        }

        async addStore(e) {
            e.preventDefault();
            
            if (!this.urls.addStore) {
                window.Flowork.toast('API 설정 오류: 매장 추가 URL이 없습니다.', 'danger');
                return;
            }

            const payload = {
                store_code: this.dom.newStoreInputs.code.value,
                store_name: this.dom.newStoreInputs.name.value,
                store_phone: this.dom.newStoreInputs.phone.value
            };
            try {
                const res = await window.Flowork.post(this.urls.addStore, payload);
                window.Flowork.toast(res.message, 'success');
                setTimeout(() => window.location.reload(), 1000);
            } catch(e) { window.Flowork.toast(e.message, 'danger'); }
        }

        async deleteStore(btn) {
            if(!confirm('삭제하시겠습니까?')) return;
            try {
                await window.Flowork.api(`${this.urls.delStore}${btn.dataset.id}`, { method: 'DELETE' });
                window.Flowork.toast('삭제되었습니다', 'success');
                btn.closest('tr').remove();
            } catch(e) { window.Flowork.toast(e.message, 'danger'); }
        }

        openStoreModal(btn) {
            this.dom.editStoreInputs.code.value = btn.dataset.code;
            this.dom.editStoreInputs.name.value = btn.dataset.name;
            this.dom.editStoreInputs.phone.value = btn.dataset.phone;
            this.dom.editStoreInputs.btnSave.dataset.storeId = btn.dataset.id;
            this.dom.modalStore.show();
        }

        async saveStoreEdit(btn) {
            const id = btn.dataset.storeId;
            const payload = {
                store_code: this.dom.editStoreInputs.code.value,
                store_name: this.dom.editStoreInputs.name.value,
                store_phone: this.dom.editStoreInputs.phone.value
            };
            try {
                await window.Flowork.post(`${this.urls.updateStore}${id}`, payload);
                window.Flowork.toast('수정되었습니다', 'success');
                this.dom.modalStore.hide();
                setTimeout(() => window.location.reload(), 1000);
            } catch(e) { window.Flowork.toast(e.message, 'danger'); }
        }

        async approveStore(btn) {
            if(!confirm('승인하시겠습니까?')) return;
            try { 
                await window.Flowork.post(`${this.urls.approveStore}${btn.dataset.id}`, {}); 
                window.Flowork.toast('승인되었습니다', 'success');
                setTimeout(() => window.location.reload(), 1000); 
            } catch(e) { window.Flowork.toast(e.message, 'danger'); }
        }

        async resetStore(btn) {
            if(!confirm('가입 정보를 초기화하시겠습니까?')) return;
            try { 
                await window.Flowork.post(`${this.urls.resetStore}${btn.dataset.id}`, {}); 
                window.Flowork.toast('초기화되었습니다', 'success');
                setTimeout(() => window.location.reload(), 1000); 
            } catch(e) { window.Flowork.toast(e.message, 'danger'); }
        }

        async toggleStoreActive(btn) {
            try { 
                const res = await window.Flowork.post(`${this.urls.toggleActive}${btn.dataset.id}`, {}); 
                window.Flowork.toast(res.message, 'success');
                setTimeout(() => window.location.reload(), 1000); 
            } catch(e) { window.Flowork.toast(e.message, 'danger'); }
        }

        async addStaff(e) {
            e.preventDefault();
            const payload = {
                name: this.dom.newStaffInputs.name.value,
                position: this.dom.newStaffInputs.pos.value,
                contact: this.dom.newStaffInputs.contact.value
            };
            try {
                await window.Flowork.post(this.urls.addStaff, payload);
                window.Flowork.toast('직원이 추가되었습니다', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } catch(e) { window.Flowork.toast(e.message, 'danger'); }
        }

        async deleteStaff(btn) {
            if(!confirm('삭제하시겠습니까?')) return;
            try {
                await window.Flowork.api(`${this.urls.delStaff}${btn.dataset.id}`, { method: 'DELETE' });
                window.Flowork.toast('삭제되었습니다', 'success');
                btn.closest('tr').remove();
            } catch(e) { window.Flowork.toast(e.message, 'danger'); }
        }

        openStaffModal(btn) {
            this.dom.editStaffInputs.name.value = btn.dataset.name;
            this.dom.editStaffInputs.pos.value = btn.dataset.position;
            this.dom.editStaffInputs.contact.value = btn.dataset.contact;
            this.dom.editStaffInputs.btnSave.dataset.staffId = btn.dataset.id;
            this.dom.modalStaff.show();
        }

        async saveStaffEdit(btn) {
            const id = btn.dataset.staffId;
            const payload = {
                name: this.dom.editStaffInputs.name.value,
                position: this.dom.editStaffInputs.pos.value,
                contact: this.dom.editStaffInputs.contact.value
            };
            try {
                await window.Flowork.post(`${this.urls.updateStaff}${id}`, payload);
                window.Flowork.toast('수정되었습니다', 'success');
                this.dom.modalStaff.hide();
                setTimeout(() => window.location.reload(), 1000);
            } catch(e) { window.Flowork.toast(e.message, 'danger'); }
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
                if(saved.columns) this.dom.catColumnsInput.value = saved.columns;
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
                    columns: parseInt(this.dom.catColumnsInput.value),
                    buttons: buttons
                };
                
                try {
                    await window.Flowork.post(this.urls.updateSetting, { key: 'CATEGORY_CONFIG', value: config });
                    window.Flowork.toast('설정이 저장되었습니다', 'success');
                } catch(e) {
                    window.Flowork.toast(e.message, 'danger');
                }
            };
        }
    };
}

// [수정] DOMContentLoaded 없이 즉시 실행 (SPA 탭 로드 후 바로 실행)
if (document.querySelector('.setting-container')) {
    new window.SettingApp();
}