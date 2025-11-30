import traceback
import os
import gc
from flask import current_app
from flowork.extensions import celery
from flowork.services.excel import parse_stock_excel, verify_stock_excel
from flowork.services.inventory_service import InventoryService
from flowork.services.image_process import process_style_code_group

# ... (이미지 처리 태스크 생략) ...

@celery.task(bind=True)
def task_upsert_inventory(self, file_path, form_data, upload_mode, brand_id, target_store_id, excluded_indices, allow_create):
    """
    재고 업로드 태스크 (매장/본사/단순업데이트)
    엑셀 파일을 파싱하여 재고를 추가하거나 수정합니다.
    """
    try:
        # 1. 엑셀 파싱 (Pure Logic)
        # parse_stock_excel 함수를 통해 엑셀 데이터를 딕셔너리 리스트로 변환합니다.
        records, error_msg = parse_stock_excel(
            file_path, form_data, upload_mode, brand_id, excluded_indices
        )
        
        if error_msg or not records:
            return {'status': 'error', 'message': error_msg or "데이터 파싱 실패"}

        # 2. DB 업데이트 (Service Logic)
        # 진행률 업데이트를 위한 콜백 함수 정의
        def progress_callback(current, total):
            self.update_state(state='PROGRESS', meta={
                'current': current, 
                'total': total, 
                'percent': int((current / total) * 100) if total > 0 else 0
            })

        # InventoryService를 호출하여 실제 DB 트랜잭션을 수행합니다.
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
        # 3. 리소스 정리
        # 작업이 끝나면 임시 엑셀 파일을 삭제하고 가비지 컬렉션을 수행하여 메모리를 확보합니다.
        if os.path.exists(file_path):
            os.remove(file_path)
        gc.collect()

@celery.task(bind=True)
def task_import_db(self, file_path, form_data, brand_id):
    """
    상품 DB 엑셀 업로드 태스크 (전체 초기화)
    기존 상품 데이터를 모두 지우고 엑셀 파일 내용으로 새로 구축합니다.
    """
    try:
        # 1. 엑셀 파싱
        records, error_msg = parse_stock_excel(
            file_path, form_data, 'db', brand_id, None
        )
        
        if error_msg or not records:
            return {'status': 'error', 'message': error_msg or "데이터 파싱 실패"}

        # 2. DB 전체 초기화 및 삽입
        def progress_callback(current, total):
            self.update_state(state='PROGRESS', meta={
                'current': current, 
                'total': total, 
                'percent': int((current / total) * 100) if total > 0 else 0
            })

        # full_import_db는 기존 데이터를 삭제(Delete)하고 대량 삽입(Bulk Insert)을 수행합니다.
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
        # 3. 리소스 정리
        if os.path.exists(file_path):
            os.remove(file_path)
        gc.collect()