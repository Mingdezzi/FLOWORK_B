import traceback
from flask import render_template, flash, redirect, url_for, abort
from flask_login import login_required, current_user
from sqlalchemy.orm import selectinload

from flowork.models import db, Product, Order
from flowork.constants import OrderStatus
from . import ui_bp

@ui_bp.route('/')
@login_required
def home():
    if current_user.is_super_admin:
        flash("슈퍼 관리자 계정입니다. (시스템 설정)", "info")
        return redirect(url_for('ui.setting_page'))
    
    try:
        store_id = current_user.store_id
        
        pending_orders = []
        if store_id:
            pending_orders = Order.query.filter(
                Order.store_id == store_id,
                Order.order_status.in_(OrderStatus.PENDING)
            ).order_by(Order.created_at.desc()).limit(5).all()
            
        context = {
            'active_page': 'home',
            'pending_orders': pending_orders
        }
        return render_template('index.html', **context)

    except Exception as e:
        print(f"Error loading dashboard: {e}")
        traceback.print_exc()
        return render_template('index.html', active_page='home', error=str(e))

@ui_bp.route('/search')
@login_required
def search_page():
    if current_user.is_super_admin:
        abort(403, description="슈퍼 관리자는 상품 검색을 사용할 수 없습니다.")

    try:
        current_brand_id = current_user.current_brand_id
        
        db_categories = [
            r[0] for r in db.session.query(Product.item_category)
            .filter(Product.brand_id == current_brand_id)
            .distinct()
            .order_by(Product.item_category)
            .all() 
            if r[0]
        ]
        
        buttons = [{'label': '전체', 'value': '전체'}]
        for cat in db_categories[:24]:
            buttons.append({'label': cat, 'value': cat})
            
        category_config = {
            'columns': 5,
            'buttons': buttons
        }

        products_query = Product.query.options(selectinload(Product.variants)).filter(
            Product.brand_id == current_brand_id, 
            Product.is_favorite == 1
        )
        products = products_query.order_by(Product.item_category, Product.product_name).all()
        
        context = {
            'active_page': 'search',
            'showing_favorites': True,
            'products': products,
            'query': '',
            'selected_category': '전체',
            'category_config': category_config
        }
        return render_template('search.html', **context)
    
    except Exception as e:
        print(f"Error loading search page: {e}")
        traceback.print_exc()
        flash("페이지 로드 중 오류가 발생했습니다.", "error")
        fallback_config = {'columns': 5, 'buttons': [{'label': '전체', 'value': '전체'}]}
        return render_template('search.html', active_page='search', showing_favorites=True, products=[], query='', selected_category='전체', category_config=fallback_config)

@ui_bp.route('/mail')
@login_required
def mail_box():
    """점간 메일함 (준비중)"""
    return render_template('index.html', active_page='mail', error="메일함 기능은 현재 준비 중입니다.")