class StockApp {
    constructor() {
        // 스코프 격리: 초기화되지 않은 컨테이너 찾기
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
            wrapper.style.display = isHorizontal ? 'none' : 'block';
        });
    }

    setupExcelAnalyzer(config) {
        const { fileInputId, formId, wrapperId, statusId, gridId } = config;
        // [중요] 컨테이너 내부에서 요소 찾기
        const fileInput = this.container.querySelector(`#${fileInputId}`);
        const form = this.container.querySelector(`#${formId}`);
        const wrapper = this.container.querySelector(`#${wrapperId}`);
        const statusText = this.container.querySelector(`#${statusId}`);
        const grid = this.container.querySelector(`#${gridId}`);
        
        if (!fileInput || !form || !grid) return;

        const submitButton = form.querySelector('button[type="submit"]');
        const progressBar = form.querySelector('.progress-bar');
        const progressWrapper = form.querySelector('.progress-wrapper');
        const progressStatus = form.querySelector('.progress-status');
        const selects = grid.querySelectorAll('select');
        const previews = grid.querySelectorAll('.col-preview');

        let currentPreviewData = {};
        let currentColumnLetters = [];

        const resetUi = () => {
            wrapper.classList.remove('success', 'error', 'loading');
            statusText.textContent = '엑셀 파일을 선택하세요.';
            grid.style.display = 'none';
            if (submitButton) submitButton.style.display = 'none';
            if (progressWrapper) progressWrapper.style.display = 'none';
            currentPreviewData = {};
            currentColumnLetters = [];
            selects.forEach(sel => { sel.innerHTML = '<option value="">-- 열 선택 --</option>'; sel.disabled = true; });
            previews.forEach(pre => pre.innerHTML = '');
            fileInput.value = ''; 
        };

        const populateSelects = () => {
            selects.forEach(select => {
                const defaultText = select.querySelector('option:first-child')?.textContent || '-- 열 선택 --';
                select.innerHTML = `<option value="">${defaultText}</option>`;
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
                    headers: { 'X-CSRFToken': Flowork.getCsrfToken() }, 
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
                Flowork.toast(error.message, 'danger');
            }
        });

        grid.addEventListener('change', (e) => {
            if (e.target.tagName !== 'SELECT') return;
            const letter = e.target.value;
            const previewEl = e.target.closest('.mapping-item-wrapper')?.querySelector('.col-preview');
            
            if (previewEl) {
                if (letter && currentPreviewData[letter]) {
                    const list = currentPreviewData[letter].map(v => `<li>${v || '(빈 값)'}</li>`).join('');
                    previewEl.innerHTML = `<ul>${list}</ul>`;
                } else {
                    previewEl.innerHTML = '';
                }
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!confirm('엑셀 파일 검증 및 업로드를 시작하시겠습니까?')) return;

            const formData = new FormData(form);
            
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 검증 중...';
            }

            try {
                const verifyResp = await fetch('/api/verify_excel', {
                    method: 'POST',
                    headers: { 'X-CSRFToken': Flowork.getCsrfToken() },
                    body: formData
                });
                const verifyResult = await verifyResp.json();

                if (verifyResult.status !== 'success') throw new Error(verifyResult.message);

                if (verifyResult.suspicious_rows && verifyResult.suspicious_rows.length > 0) {
                    this.showVerificationModal(verifyResult.suspicious_rows, formData, () => this.startUpload(form.action, formData, progressBar, progressStatus, submitButton));
                } else {
                    this.startUpload(form.action, formData, progressBar, progressStatus, submitButton);
                }

            } catch (error) {
                Flowork.toast(error.message, 'danger');
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.innerHTML = '재시도';
                }
            }
        });
    }

    showVerificationModal(rows, formData, confirmCallback) {
        // 모달은 템플릿에 포함되어 있으나, bootstrap Modal 인스턴스를 만들 때 ID 충돌 방지를 위해 
        // container 부모의 sibling인 모달을 찾거나, 전역 모달을 쓰되 내용을 동적으로 채워야 함.
        // TabManager 구조상 모든 모달도 .unique-content-area 안에 래핑되어 있음.
        // 따라서 this.container의 형제 요소가 아니라 this.container 내부 혹은 근처에 있음.
        // 하지만 stock.html 구조를 보면 모달은 block content의 마지막에 있음.
        // 즉, this.container의 형제가 아니라, .stock-mgmt-container의 형제일 수 있음 (block content 전체가 container로 감싸지지 않음).
        
        // *수정*: stock.html 에서는 .stock-mgmt-container 가 block content의 첫 요소이고,
        // 모달은 그 뒤에 있음. 따라서 this.container의 다음 형제 요소들 중에서 모달을 찾아야 함.
        
        // 안전한 방법: 현재 탭 페이지 레이어(.page-content-layer) 내부에서 검색
        const pageLayer = this.container.closest('.page-content-layer');
        const scopedModalEl = pageLayer ? pageLayer.querySelector('#verification-modal') : document.getElementById('verification-modal');
        
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
                <td class="text-center">${r.row_index}</td>
                <td>${r.preview}</td>
                <td class="text-danger small">${r.reasons}</td>
                <td class="text-center"><button type="button" class="btn btn-outline-danger btn-sm py-0 px-1 btn-exclude"><i class="bi bi-x-lg"></i></button></td>
            </tr>
        `).join('');

        tbody.onclick = (e) => {
            const btn = e.target.closest('.btn-exclude');
            if (btn) {
                const tr = btn.closest('tr');
                tr.classList.toggle('table-danger');
                tr.classList.toggle('text-decoration-line-through');
                tr.classList.toggle('excluded');
                btn.classList.toggle('active');
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

    async startUpload(url, formData, progressBar, progressStatus, submitButton) {
        if(submitButton) submitButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 업로드 중...';
        const pWrapper = this.container.querySelector('.progress-wrapper');
        if(pWrapper) pWrapper.style.display = 'block';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'X-CSRFToken': Flowork.getCsrfToken() },
                body: formData
            });
            const data = await response.json();

            if(data.status === 'success') {
                if(data.task_id) {
                    this.pollTask(data.task_id, progressBar, progressStatus);
                } else {
                    Flowork.toast(data.message, 'success');
                    setTimeout(() => window.location.reload(), 1500);
                }
            } else {
                throw new Error(data.message);
            }
        } catch(e) {
            Flowork.toast(e.message, 'danger');
            if(submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = '재시도';
            }
        }
    }

    pollTask(taskId, progressBar, progressStatus) {
        const interval = setInterval(async () => {
            try {
                const task = await Flowork.get(`/api/task_status/${taskId}`);
                if(task.status === 'processing') {
                    const pct = task.percent || 0;
                    if(progressBar) { progressBar.style.width = `${pct}%`; progressBar.textContent = `${pct}%`; }
                    if(progressStatus) progressStatus.textContent = `처리 중... (${task.current}/${task.total})`;
                } else {
                    clearInterval(interval);
                    if(task.status === 'completed') {
                        if(progressBar) { progressBar.className = 'progress-bar bg-success'; progressBar.textContent = '완료'; }
                        Flowork.toast(task.result.message, 'success');
                        setTimeout(() => window.location.reload(), 1500);
                    } else {
                        if(progressBar) progressBar.className = 'progress-bar bg-danger';
                        Flowork.toast(`작업 오류: ${task.message}`, 'danger');
                    }
                }
            } catch(e) { clearInterval(interval); }
        }, 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.stock-mgmt-container')) new StockApp();
});