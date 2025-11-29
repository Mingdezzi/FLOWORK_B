import traceback
from datetime import date, datetime
from flask import render_template, request, abort
from flask_login import login_required, current_user
from sqlalchemy import func

from flowork.models import db, Sale, SaleItem, Store, Brand
from . import ui_bp

def _get_context_stores():
    """현재 사용자가 접근 가능한 매장 목록 반환"""
    if current_user.is_super_admin:
        # 슈퍼 관리자: 브랜드 선택이 있다면 해당 브랜드의 매장, 없으면 전체 매장 (또는 첫 브랜드)
        brand_id = request.args.get('brand_id', type=int)
        query = Store.query.filter_by(is_active=True)
        if brand_id:
            query = query.filter_by(brand_id=brand_id)
        return query.order_by(Store.store_name).all()
        
    elif current_user.is_admin: # 브랜드 관리자
        return Store.query.filter_by(
            brand_id=current_user.current_brand_id,
            is_active=True
        ).order_by(Store.store_name).all()
        
    elif current_user.store_id:
        return [current_user.store]
        
    return []

def _get_brands_for_super_admin():
    if current_user.is_super_admin:
        return Brand.query.order_by(Brand.brand_name).all()
    return []

@ui_bp.route('/sales')
@login_required
def sales_register():
    # 접근 권한 체크: 슈퍼관리자, 브랜드관리자, 매장관리자 모두 허용
    if not (current_user.is_super_admin or current_user.is_admin or current_user.store_id):
        abort(403, description="접근 권한이 없습니다.")
        
    stores = _get_context_stores()
    brands = _get_brands_for_super_admin()
    
    # 타겟 매장 결정
    target_store_id = request.args.get('store_id', type=int)
    
    # 관리자가 매장을 선택하지 않았을 때 기본값 설정
    if not target_store_id:
        if current_user.store_id:
            target_store_id = current_user.store_id
        elif stores:
            target_store_id = stores[0].id
            
    # 선택된 브랜드 (슈퍼관리자용)
    target_brand_id = request.args.get('brand_id', type=int)
    if not target_brand_id and current_user.brand_id:
        target_brand_id = current_user.brand_id
    elif not target_brand_id and brands:
        target_brand_id = brands[0].id

    return render_template(
        'sales.html', 
        active_page='sales', 
        stores=stores, 
        brands=brands,
        target_store_id=target_store_id,
        target_brand_id=target_brand_id
    )

@ui_bp.route('/sales/record')
@login_required
def sales_record():
    if not (current_user.is_super_admin or current_user.is_admin or current_user.store_id):
        abort(403, description="접근 권한이 없습니다.")
        
    stores = _get_context_stores()
    brands = _get_brands_for_super_admin()
    
    target_store_id = request.args.get('store_id', type=int)
    if not target_store_id:
        if current_user.store_id:
            target_store_id = current_user.store_id
        elif stores:
            target_store_id = stores[0].id

    # 슈퍼관리자용 브랜드 선택
    target_brand_id = request.args.get('brand_id', type=int)
    if not target_brand_id and current_user.brand_id:
        target_brand_id = current_user.brand_id
    elif not target_brand_id and brands:
        target_brand_id = brands[0].id

    # 기간 파라미터
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    today = date.today()
    start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date() if start_date_str else today
    end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date() if end_date_str else today
    
    page = request.args.get('page', 1, type=int)
    
    # 쿼리 구성
    query = Sale.query
    if target_store_id:
        query = query.filter(Sale.store_id == target_store_id)
    
    query = query.filter(
        Sale.sale_date >= start_date,
        Sale.sale_date <= end_date
    )
    
    pagination = query.order_by(Sale.created_at.desc()).paginate(page=page, per_page=20, error_out=False)
    
    # 통계 집계
    stats_query = db.session.query(
        func.sum(Sale.total_amount),
        func.count(Sale.id)
    ).filter(
        Sale.sale_date >= start_date,
        Sale.sale_date <= end_date,
        Sale.status == 'valid'
    )
    
    if target_store_id:
        stats_query = stats_query.filter(Sale.store_id == target_store_id)
        
    total_amount, total_count = stats_query.first()
    
    # 할인 총액
    discount_q = db.session.query(
        func.sum(SaleItem.discount_amount * SaleItem.quantity)
    ).join(Sale).filter(
        Sale.sale_date >= start_date,
        Sale.sale_date <= end_date,
        Sale.status == 'valid'
    )
    if target_store_id:
        discount_q = discount_q.filter(Sale.store_id == target_store_id)
        
    total_discount = discount_q.scalar()
    
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
        brands=brands,
        target_store_id=target_store_id,
        target_brand_id=target_brand_id
    )

@ui_bp.route('/sales/<int:sale_id>')
@login_required
def sales_detail(sale_id):
    sale = Sale.query.get_or_404(sale_id)
    
    # 권한 체크: 내 브랜드/매장의 판매 내역인지
    has_permission = False
    if current_user.is_super_admin:
        has_permission = True
    elif current_user.is_admin: # 브랜드 관리자
        if sale.store.brand_id == current_user.current_brand_id:
            has_permission = True
    elif current_user.store_id: # 매장 관리자
        if sale.store_id == current_user.store_id:
            has_permission = True
            
    if not has_permission:
        abort(403, description="해당 판매 내역에 접근할 권한이 없습니다.")
        
    return render_template('sales_detail.html', active_page='sales_record', sale=sale)