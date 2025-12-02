if (!window.StockApp) {
    window.StockApp = class StockApp {
        constructor() {
            this.container = document.querySelector('.stock-mgmt-container:not([data-initialized])');
            if (!this.container) return;
            this.container.dataset.initialized = "true";

            this.dom = {
                analyzeExcelUrl: this.container.dataset.analyzeExcelUrl,
                horizontalSwitches: this.container.querySelectorAll('.horizontal-mode-switch')
            };
            
            this.init();
        }

        init() {
            this.setupExcelAnalyzer({
                fileInputId: 'store_stock_excel_file',
                formId: 'form-update-store',
                wrapperId: 'wrapper-store-file',
                statusId: 'status-store-file',
                gridId: 'grid-update-store',
            });
            
            this.setupExcelAnalyzer({
                fileInputId: 'hq_stock_excel_file_full',
                formId: 'form-update-hq-full',
                wrapperId: 'wrapper-hq-file-full',
                statusId: 'status-hq-file-full',
                gridId: 'grid-update-hq-full',
            });

            this.setupExcelAnalyzer({
                fileInputId: 'db_excel_file',
                formId: 'form-import-db',
                wrapperId: 'wrapper-db-file',
                statusId: 'status-db-file',
                gridId: 'grid-import-db',
            });

            this.dom.horizontalSwitches.forEach(sw => {
                sw.addEventListener('change', (e) => this.toggleHorizontalMode(e.target));
                this.toggleHorizontalMode(sw);
            });
        }

        toggleHorizontalMode(switchEl) {
            const form = switchEl.closest('form');
            const isHorizontal = switchEl.checked;
            const conditionalFields = form.querySelectorAll('.conditional-field[data-show-if="vertical"]');
            
            conditionalFields.forEach(wrapper => {
                const select = wrapper.querySelector('select');
                if (isHorizontal) {
                    wrapper.style.display = 'none';
                    if (select) select.removeAttribute('required');
                } else {
                    wrapper.style.display = 'block';
                    if (select) select.setAttribute('required', 'true');
                }
            });
        }

        setupExcelAnalyzer(config) {
            const { fileInputId, formId, wrapperId, statusId, gridId } = config;
            const fileInput = this.container.querySelector(`#${fileInputId}`);
            const form = this.container.querySelector(`#${formId}`);
            const wrapper = this.container.querySelector(`#${wrapperId}`);
            const statusText = this.container.querySelector(`#${statusId}`);
            const grid = this.container.querySelector(`#${gridId}`);
            
            if (!fileInput || !form || !grid) return;

            const submitButton = form.querySelector('button[type="submit"]');
            const selects = grid.querySelectorAll('select');
            const previews = grid.querySelectorAll('.col-preview');

            let currentPreviewData = {};
            let currentColumnLetters = [];

            const resetUi = () => {
                wrapper.classList.remove('success', 'error', 'loading');
                statusText.textContent = '클릭하여 엑셀 파일 업로드';
                grid.style.display = 'none';
                if (submitButton) submitButton.style.display = 'none';
                currentPreviewData = {};
                currentColumnLetters = [];
                selects.forEach(sel => { sel.innerHTML = ''; sel.disabled = true; });
                previews.forEach(pre => pre.innerHTML = '');
                fileInput.value = ''; 
            };

            const populateSelects = () => {
                selects.forEach(select => {
                    select.innerHTML = '<option value="">열 선택</option>';
                    currentColumnLetters.forEach(letter => {
                        const option = document.createElement('option');
                        option.value = letter;
                        option.textContent = letter;
                        select.appendChild(option);
                    });
                    select.disabled = false;
                });
                previews.forEach(pre => pre.innerHTML = '');
            };

            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return resetUi();

                wrapper.classList.remove('success', 'error');
                wrapper.classList.add('loading');
                statusText.textContent = '분석 중...';
                grid.style.display = 'none';
                if (submitButton) submitButton.style.display = 'none';

                const formData = new FormData();
                formData.append('excel_file', file);

                try {
                    const response = await fetch(this.dom.analyzeExcelUrl, {
                        method: 'POST',
                        headers: { 'X-CSRFToken': window.Flowork.getCsrfToken() }, 
                        body: formData
                    });
                    const data = await response.json();

                    if (data.status !== 'success') throw new Error(data.message);

                    currentPreviewData = data.preview_data;
                    currentColumnLetters = data.column_letters;
                    
                    populateSelects();

                    wrapper.classList.remove('loading');
                    wrapper.classList.add('success');
                    statusText.textContent = `완료: ${file.name} (${currentColumnLetters.length}열)`;
                    grid.style.display = 'grid';
                    if (submitButton) submitButton.style.display = 'block';

                } catch (error) {
                    console.error('Analyze Error:', error);
                    resetUi();
                    wrapper.classList.remove('loading');
                    wrapper.classList.add('error');
                    statusText.textContent = '분석 실패';
                    window.Flowork.toast(error.message, 'danger');
                }
            });

            grid.addEventListener('change', (e) => {
                if (e.target.tagName !== 'SELECT') return;
                const letter = e.target.value;
                const previewEl = e.target.closest('.mapping-item-wrapper')?.querySelector('.col-preview');
                
                if (previewEl) {
                    if (letter && currentPreviewData[letter]) {
                        const list = currentPreviewData[letter].map(v => `<span>${v || '-'}</span>`).join(', ');
                        previewEl.innerHTML = list;
                    } else {
                        previewEl.innerHTML = '';
                    }
                }
            });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!confirm('엑셀 업로드를 시작하시겠습니까?')) return;

                const formData = new FormData(form);
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 처리 중...';
                }

                try {
                    const verifyResp = await fetch('/api/verify_excel', {
                        method: 'POST',
                        headers: { 'X-CSRFToken': window.Flowork.getCsrfToken() },
                        body: formData
                    });
                    const verifyResult = await verifyResp.json();

                    if (verifyResult.status !== 'success') throw new Error(verifyResult.message);

                    if (verifyResult.suspicious_rows && verifyResult.suspicious_rows.length > 0) {
                        this.showVerificationModal(verifyResult.suspicious_rows, formData, () => this.startUpload(form.action, formData, submitButton));
                    } else {
                        this.startUpload(form.action, formData, submitButton);
                    }

                } catch (error) {
                    window.Flowork.toast(error.message, 'danger');
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.innerHTML = '재시도';
                    }
                }
            });
        }

        showVerificationModal(rows, formData, confirmCallback) {
            const pageLayer = this.container.closest('.page-content-layer') || document;
            const scopedModalEl = pageLayer.querySelector('#verification-modal');
            
            if (!scopedModalEl || typeof bootstrap === 'undefined') {
                if(confirm(`검증 경고: ${rows.length}개의 의심 행이 있습니다. 진행하시겠습니까?`)) confirmCallback();
                return;
            }
            
            const modal = new bootstrap.Modal(scopedModalEl);
            const tbody = scopedModalEl.querySelector('#suspicious-rows-tbody');
            const countSpan = scopedModalEl.querySelector('#suspicious-count');
            if(countSpan) countSpan.textContent = rows.length;
            
            tbody.innerHTML = rows.map(r => `
                <tr data-row-index="${r.row_index}">
                    <td>${r.row_index}</td>
                    <td class="text-start">${r.preview}</td>
                    <td class="text-danger">${r.reasons}</td>
                    <td><button type="button" class="btn btn-outline-danger btn-sm py-0 px-2 btn-exclude">제외</button></td>
                </tr>
            `).join('');

            tbody.onclick = (e) => {
                const btn = e.target.closest('.btn-exclude');
                if (btn) {
                    const tr = btn.closest('tr');
                    tr.classList.toggle('table-danger');
                    tr.classList.toggle('text-decoration-line-through');
                    tr.classList.toggle('excluded');
                }
            };

            const btnConfirm = scopedModalEl.querySelector('#btn-confirm-upload');
            btnConfirm.onclick = () => {
                const excluded = Array.from(tbody.querySelectorAll('tr.excluded')).map(tr => tr.dataset.rowIndex);
                formData.append('excluded_row_indices', excluded.join(','));
                modal.hide();
                confirmCallback();
            };

            modal.show();
        }

        async startUpload(url, formData, submitButton) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'X-CSRFToken': window.Flowork.getCsrfToken() },
                    body: formData
                });
                const data = await response.json();

                if(data.status === 'success') {
                    if(data.task_id) {
                        this.pollTask(data.task_id, submitButton);
                    } else {
                        window.Flowork.toast(data.message, 'success');
                        setTimeout(() => window.location.reload(), 1500);
                    }
                } else {
                    throw new Error(data.message);
                }
            } catch(e) {
                window.Flowork.toast(e.message, 'danger');
                if(submitButton) {
                    submitButton.disabled = false;
                    submitButton.innerHTML = '재시도';
                }
            }
        }

        pollTask(taskId, submitButton) {
            const interval = setInterval(async () => {
                try {
                    const task = await window.Flowork.get(`/api/task_status/${taskId}`);
                    if(task.status === 'processing') {
                        if(submitButton) submitButton.innerHTML = `처리 중... ${task.percent}%`;
                    } else {
                        clearInterval(interval);
                        if(task.status === 'completed') {
                            if(submitButton) submitButton.innerHTML = '완료';
                            window.Flowork.toast(task.result.message, 'success');
                            setTimeout(() => window.location.reload(), 1500);
                        } else {
                            if(submitButton) {
                                submitButton.disabled = false;
                                submitButton.innerHTML = '재시도';
                            }
                            window.Flowork.toast(`작업 오류: ${task.message}`, 'danger');
                        }
                    }
                } catch(e) { clearInterval(interval); }
            }, 1000);
        }
    };
}

if (document.querySelector('.stock-mgmt-container')) {
    new window.StockApp();
}