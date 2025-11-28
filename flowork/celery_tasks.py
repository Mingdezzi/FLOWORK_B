import traceback
import os
import gc
from flowork.extensions import celery
from flowork.services.excel import parse_stock_excel
from flowork.services.inventory_service import InventoryService

@celery.task(bind=True)
def task_upsert_inventory(self, file_path, form_data, upload_mode, brand_id, target_store_id, excluded_indices, allow_create):
    try:
        # 1. 엑셀 파싱 (Pure Logic)
        records, error_msg = parse_stock_excel(
            file_path, form_data, upload_mode, brand_id, excluded_indices
        )
        
        if error_msg or not records:
            return {'status': 'error', 'message': error_msg or "데이터 파싱 실패"}

        # 2. DB 업데이트 (Service Logic)
        def progress_callback(current, total):
            self.update_state(state='PROGRESS', meta={'current': current, 'total': total, 'percent': int((current / total) * 100) if total > 0 else 0})

        cnt_update, cnt_var, message = InventoryService.process_stock_data(
            records, upload_mode, brand_id, target_store_id, allow_create, progress_callback
        )
        
        return {
            'status': 'completed',
            'result': {'message': message}
        }
    except Exception as e:
        traceback.print_exc()
        return {'status': 'error', 'message': str(e)}
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
        gc.collect()

@celery.task(bind=True)
def task_import_db(self, file_path, form_data, brand_id):
    try:
        # 1. 엑셀 파싱
        records, error_msg = parse_stock_excel(
            file_path, form_data, 'db', brand_id, None
        )
        
        if error_msg or not records:
            return {'status': 'error', 'message': error_msg or "데이터 파싱 실패"}

        # 2. DB 전체 초기화 및 삽입
        def progress_callback(current, total):
            self.update_state(state='PROGRESS', meta={'current': current, 'total': total, 'percent': int((current / total) * 100) if total > 0 else 0})

        success, message = InventoryService.full_import_db(
            records, brand_id, progress_callback
        )
        
        if success:
            return {
                'status': 'completed',
                'result': {'message': message}
            }
        else:
            return {
                'status': 'error',
                'message': message
            }
    except Exception as e:
        traceback.print_exc()
        return {'status': 'error', 'message': str(e)}
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
        gc.collect()