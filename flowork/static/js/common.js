const Flowork = {
    getCsrfToken: () => {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    },

    api: async (url, options = {}) => {
        const defaults = {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': Flowork.getCsrfToken(),
                'X-Requested-With': 'XMLHttpRequest'
            }
        };
        
        const settings = { ...defaults, ...options };
        if (options.headers) {
            settings.headers = { ...defaults.headers, ...options.headers };
        }

        try {
            const response = await fetch(url, settings);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `Server Error: ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error("API Error:", error);
            Flowork.toast(error.message, 'danger');
            throw error;
        }
    },

    get: async (url) => {
        return await Flowork.api(url, { method: 'GET' });
    },

    post: async (url, body) => {
        return await Flowork.api(url, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    fmtNum: (num) => {
        return (num || 0).toLocaleString();
    },

    fmtDate: (dateObj) => {
        if (!dateObj) dateObj = new Date();
        if (typeof dateObj === 'string') dateObj = new Date(dateObj);
        
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    toast: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        if (!container) return alert(message);

        const id = 'toast_' + Date.now();
        const icon = type === 'success' ? 'check-circle-fill' : (type === 'danger' ? 'exclamation-circle-fill' : 'info-circle-fill');
        const color = type === 'success' ? 'text-success' : (type === 'danger' ? 'text-danger' : 'text-info');

        const html = `
            <div id="${id}" class="toast align-items-center border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body d-flex align-items-center">
                        <i class="bi bi-${icon} ${color} fs-5 me-2"></i>
                        <span>${message}</span>
                    </div>
                    <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', html);
        const toastEl = document.getElementById(id);
        const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
        toast.show();

        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }
};

window.Flowork = Flowork;