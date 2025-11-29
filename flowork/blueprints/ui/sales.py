import traceback
from datetime import date, datetime
from flask import render_template, request, abort
from flask_login import login_required, current_user
from sqlalchemy import func

from flowork.models import db, Sale, SaleItem, Store, Brand
from . import ui_bp

def _get_context_stores():
    """현재 사용자가 접근 가능한 매장 목록 반환"""
    if current_user.store_id:
        # 매장 관리자는 본인 매장만
        return [current_user.store]
    
    # 관리자 (슈퍼 또는 브랜드)
    query = Store.query.filter_by(is_active=True)
    
    if not current_user.is_super_admin:
        # 브랜드 관리자는 해당 브랜드 매장만
        query = query.filter_by(brand_id=current_user.current_brand_id)
    else:
        # 슈퍼 관리자는 브랜드 선택이 있다면 필터링 (기본은 전체)
        brand_id = request.args.get('brand_id', type=int)
        if brand_id:
            query = query.filter_by(brand_id=brand_id)
            
    return query.order_by(Store.store_name).all()

@ui_bp.route('/sales')
@login_required
def sales_register():
    # [수정] 관리자도 접근 가능하도록 권한 체크 변경
    if not (current_user.store_id or current_user.is_admin or current_user.is_super_admin):
        abort(403, description="접근 권한이 없습니다.")
        
    stores = _get_context_stores()
    
    # 선택된 매장 (없으면 첫 번째 매장)
    target_store_id = request.args.get('store_id', type=int)
    if not target_store_id and current_user.store_id:
        target_store_id = current_user.store_id
    elif not target_store_id and stores:
        target_store_id = stores[0].id
        
    return render_template('sales.html', active_page='sales', stores=stores, target_store_id=target_store_id)

@ui_bp.route('/sales/record')
@login_required
def sales_record():
    # [수정] 관리자 접근 허용
    if not (current_user.store_id or current_user.is_admin or current_user.is_super_admin):
        abort(403, description="접근 권한이 없습니다.")
        
    stores = _get_context_stores()
    
    target_store_id = request.args.get('store_id', type=int)
    if not target_store_id and current_user.store_id:
        target_store_id = current_user.store_id
    elif not target_store_id and stores:
        target_store_id = stores[0].id

    # 1. 기간 파라미터 받기 (기본값: 오늘)
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    today = date.today()
    start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date() if start_date_str else today
    end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date() if end_date_str else today
    
    page = request.args.get('page', 1, type=int)
    
    # 2. 쿼리 (선택된 매장 + 기간)
    query = Sale.query.filter(
        Sale.store_id == target_store_id,
        Sale.sale_date >= start_date,
        Sale.sale_date <= end_date
    )
    
    # 3. 리스트 조회
    pagination = query.order_by(Sale.created_at.desc()).paginate(page=page, per_page=20, error_out=False)
    
    # 4. 통계 집계
    stats_query = db.session.query(
        func.sum(Sale.total_amount),
        func.count(Sale.id)
    ).filter(
        Sale.store_id == target_store_id,
        Sale.sale_date >= start_date,
        Sale.sale_date <= end_date,
        Sale.status == 'valid'
    )
    total_amount, total_count = stats_query.first()
    
    total_discount = db.session.query(
        func.sum(SaleItem.discount_amount * SaleItem.quantity)
    ).join(Sale).filter(
        Sale.store_id == target_store_id,
        Sale.sale_date >= start_date,
        Sale.sale_date <= end_date,
        Sale.status == 'valid'
    ).scalar()
    
    total_summary = {
        'total_amount': int(total_amount or 0),
        'total_discount': int(total_discount or 0),
        'total_count': int(total_count or 0)
    }
    
    return render_template(
        'sales_record.html', 
        active_page='sales_record',
        pagination=pagination, 
        sales=pagination.items,
        start_date=start_date.strftime('%Y-%m-%d'),
        end_date=end_date.strftime('%Y-%m-%d'),
        total_summary=total_summary,
        stores=stores,
        target_store_id=target_store_id
    )

@ui_bp.route('/sales/<int:sale_id>')
@login_required
def sales_detail(sale_id):
    # 상세 페이지는 store_id 체크를 느슨하게 하거나, 해당 sale이 관리 범위 내인지 확인해야 함
    sale = Sale.query.get_or_404(sale_id)
    
    # 권한 체크
    has_permission = False
    if current_user.is_super_admin:
        has_permission = True
    elif current_user.is_admin and sale.store.brand_id == current_user.current_brand_id:
        has_permission = True
    elif current_user.store_id and sale.store_id == current_user.store_id:
        has_permission = True
        
    if not has_permission:
        abort(403, description="해당 판매 내역에 접근할 권한이 없습니다.")
        
    return render_template('sales_detail.html', active_page='sales_record', sale=sale)