from flask import render_template, request
from . import ui_bp
from ...extensions import db
import traceback

# 엔드포인트(뷰 함수 이름)와 네비게이션 메뉴 ID(active_page) 매핑 테이블
ENDPOINT_MAP = {
    # 영업 관리
    'ui.sales_register': 'sales',
    'ui.sales_record': 'sales_record',
    'ui.sales_detail': 'sales_record',
    'ui.order_list': 'order',
    'ui.new_order': 'order',
    'ui.order_detail': 'order',
    'ui.store_order_list': 'store_orders',
    'ui.store_return_list': 'store_returns',

    # 재고/물류
    'ui.search_page': 'search',
    'ui.product_detail': 'search',
    'ui.list_page': 'list',
    'ui.check_page': 'check',
    'ui.stock_transfer_in': 'transfer_in',
    'ui.stock_transfer_out': 'transfer_out',
    'ui.stock_transfer_status': 'transfer_status',
    'ui.stock_overview': 'stock_overview',

    # 시스템 설정
    'ui.stock_management': 'stock',
    'ui.setting_page': 'setting',
    
    # 홈
    'ui.home': 'home'
}

def get_active_page():
    try:
        if request.endpoint in ENDPOINT_MAP:
            return ENDPOINT_MAP[request.endpoint]
        
        path = request.path
        if path.startswith('/sales/'): return 'sales_record'
        if path.startswith('/order'): return 'order'
        if path.startswith('/store/orders'): return 'store_orders'
        if path.startswith('/store/returns'): return 'store_returns'
        if path.startswith('/product'): return 'search'
        if path.startswith('/stock/transfer/in'): return 'transfer_in'
        if path.startswith('/stock/transfer/out'): return 'transfer_out'
        
    except Exception:
        pass
    
    return 'home'

@ui_bp.app_errorhandler(404)
def not_found_error(error):
    return render_template('404.html', 
                           error_description=getattr(error, 'description', '페이지를 찾을 수 없습니다.'),
                           active_page=get_active_page()), 404

@ui_bp.app_errorhandler(500)
def internal_error(error):
    db.session.rollback()
    print(f"Internal Server Error: {error}")
    traceback.print_exc() 
    return render_template('500.html', 
                           error_message=str(error),
                           active_page=get_active_page()), 500

@ui_bp.app_errorhandler(403)
def forbidden_error(error):
    return render_template('403.html',
                           error_description=getattr(error, 'description', '이 작업에 대한 권한이 없습니다.'),
                           active_page=get_active_page()), 403