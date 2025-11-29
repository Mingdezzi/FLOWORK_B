document.addEventListener('DOMContentLoaded', () => {
    
    if (window.HAS_ORDER_LIST_LISTENERS) return;
    window.HAS_ORDER_LIST_LISTENERS = true;

    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    
    document.body.addEventListener('click', async (e) => {
        const updateStatusUrl = document.body.dataset.updateStatusUrl;
        
        const targetButton = e.target.closest('.status-btn');
        if (!targetButton) return;

        const orderId = targetButton.dataset.orderId;
        const newStatus = targetButton.dataset.newStatus;
        
        if (!orderId || !newStatus || !updateStatusUrl) return;

        if (confirm(`상태를 [${newStatus}](으)로 변경하시겠습니까?`)) {
            try {
                const response = await fetch(updateStatusUrl, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify({
                        order_id: orderId,
                        new_status: newStatus
                    })
                });

                const data = await response.json();

                if (response.ok && data.status === 'success') {
                    Flowork.toast('상태가 변경되었습니다.', 'success');
                    setTimeout(() => window.location.reload(), 1000); 
                } else {
                    Flowork.toast(data.message || '실패했습니다.', 'danger');
                }
            } catch (error) {
                console.error('Order status update error:', error);
                Flowork.toast('오류 발생', 'danger');
            }
        }
    });
});